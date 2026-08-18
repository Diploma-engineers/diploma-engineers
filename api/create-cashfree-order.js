const admin = require("firebase-admin");
const crypto = require("crypto");

const API_VERSION = "2025-01-01";
const COURSE_ID = "civil_special";
const AMOUNT = 1;
const CURRENCY = "INR";

const CASHFREE_SANDBOX_API = "https://sandbox.cashfree.com/pg";
const CASHFREE_PRODUCTION_API = "https://api.cashfree.com/pg";

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  return admin;
}

function json(res, status, data) {
  return res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return json(res, 405, {
      message: "Method not allowed.",
    });
  }

  try {
    /*
     * ---------------------------------------------------------
     * 1. CHECK FIREBASE ADMIN CONFIG
     * ---------------------------------------------------------
     */

    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY ||
      !process.env.FIREBASE_DATABASE_URL
    ) {
      return json(res, 500, {
        message: "Firebase Admin environment variables are missing.",
      });
    }

    const firebase = initFirebase();

    /*
     * ---------------------------------------------------------
     * 2. GET FIREBASE ID TOKEN
     * ---------------------------------------------------------
     */

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return json(res, 401, {
        message: "Missing Firebase Authorization token.",
      });
    }

    const idToken = authorization.substring(7).trim();

    if (!idToken) {
      return json(res, 401, {
        message: "Invalid Firebase Authorization token.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 3. VERIFY FIREBASE USER
     * ---------------------------------------------------------
     */

    const decodedToken = await firebase
      .auth()
      .verifyIdToken(idToken);

    const uid = decodedToken.uid;

    if (!uid) {
      return json(res, 401, {
        message: "Firebase UID could not be verified.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 4. VERIFY REQUESTED COURSE
     * ---------------------------------------------------------
     */

    let body = {};

    try {
      body =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body || {};
    } catch (error) {
      return json(res, 400, {
        message: "Invalid JSON request body.",
      });
    }

    const requestedCourseId = String(
      body.courseId || ""
    ).trim();

    if (requestedCourseId !== COURSE_ID) {
      return json(res, 400, {
        message: "Invalid course.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 5. GET USER PROFILE
     * ---------------------------------------------------------
     */

    const userSnapshot = await firebase
      .database()
      .ref(`users/${uid}`)
      .once("value");

    const userData = userSnapshot.val() || {};

    const name =
      userData.name ||
      decodedToken.name ||
      "Student";

    const email =
      userData.email ||
      decodedToken.email ||
      "";

    const mobile =
      userData.mobile ||
      "";

    /*
     * Cashfree requires a valid customer phone.
     */

    const customerPhone = String(mobile)
      .replace(/\D/g, "");

    if (!customerPhone || customerPhone.length < 10) {
      return json(res, 400, {
        message:
          "A valid 10-digit mobile number is required for Cashfree payment.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 6. SELECT CASHFREE ENVIRONMENT
     * ---------------------------------------------------------
     */

    const environment = String(
      process.env.CASHFREE_ENVIRONMENT || "sandbox"
    ).toLowerCase();

    const CASHFREE_API =
      environment === "sandbox"
        ? CASHFREE_SANDBOX_API
        : CASHFREE_PRODUCTION_API;

    /*
     * ---------------------------------------------------------
     * 7. CHECK CASHFREE CREDENTIALS
     * ---------------------------------------------------------
     */

    if (
      !process.env.CASHFREE_CLIENT_ID ||
      !process.env.CASHFREE_CLIENT_SECRET
    ) {
      return json(res, 500, {
        message:
          "Cashfree Client ID or Client Secret is missing.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 8. CREATE UNIQUE ORDER ID
     * ---------------------------------------------------------
     */

    const orderId =
      "CIVIL_" +
      uid.substring(0, 10) +
      "_" +
      Date.now();

    /*
     * ---------------------------------------------------------
     * 9. FORCE TEST PRICE
     *
     * IMPORTANT:
     * Backend controls the price.
     * Frontend cannot change it.
     * ---------------------------------------------------------
     */

    if (AMOUNT !== 1) {
      return json(res, 500, {
        message:
          "Civil test amount is not configured as ₹1.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 10. CASHFREE ORDER PAYLOAD
     * ---------------------------------------------------------
     */

    const payload = {
      order_id: orderId,

      order_amount: AMOUNT,

      order_currency: CURRENCY,

      customer_details: {
        customer_id: uid,

        customer_name: String(name).substring(0, 100),

        customer_email:
          email || `${uid}@example.com`,

        customer_phone: customerPhone,
      },

      order_meta: {
        return_url:
          "https://diplomaengineers.vercel.app/civil-2nd-year-paid.html?order_id={order_id}",

        notify_url:
          "https://diplomaengineers.vercel.app/api/cashfree-webhook",
      },

      order_note:
        "Civil Engineering 2nd Year - Lifetime Course Access",
    };

    /*
     * ---------------------------------------------------------
     * 11. CREATE CASHFREE ORDER
     * ---------------------------------------------------------
     */

    const cashfreeResponse = await fetch(
      `${CASHFREE_API}/orders`,
      {
        method: "POST",

        headers: {
          "Accept": "application/json",

          "Content-Type":
            "application/json",

          "x-api-version":
            API_VERSION,

          "x-client-id":
            process.env.CASHFREE_CLIENT_ID,

          "x-client-secret":
            process.env.CASHFREE_CLIENT_SECRET,

          "x-request-id":
            crypto.randomUUID(),

          "x-idempotency-key":
            crypto.randomUUID(),
        },

        body: JSON.stringify(payload),
      }
    );

    /*
     * ---------------------------------------------------------
     * 12. READ CASHFREE RESPONSE
     * ---------------------------------------------------------
     */

    const responseText =
      await cashfreeResponse.text();

    let cashfreeData = {};

    try {
      cashfreeData =
        responseText
          ? JSON.parse(responseText)
          : {};
    } catch (error) {
      cashfreeData = {
        raw: responseText,
      };
    }

    /*
     * ---------------------------------------------------------
     * 13. HANDLE CASHFREE ERROR
     * ---------------------------------------------------------
     */

    if (!cashfreeResponse.ok) {
      console.error(
        "Cashfree order creation failed:",
        cashfreeResponse.status,
        cashfreeData
      );

      return json(res, 502, {
        message:
          "Cashfree order could not be created.",

        details:
          cashfreeData.message ||
          cashfreeData.type ||
          cashfreeData.code ||
          "Cashfree API rejected the order.",

        cashfree_status:
          cashfreeResponse.status,
      });
    }

    /*
     * ---------------------------------------------------------
     * 14. VERIFY PAYMENT SESSION ID
     * ---------------------------------------------------------
     */

    const paymentSessionId =
      cashfreeData.payment_session_id;

    if (!paymentSessionId) {
      console.error(
        "Cashfree response missing payment_session_id:",
        cashfreeData
      );

      return json(res, 502, {
        message:
          "Cashfree did not return payment_session_id.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 15. SAVE PENDING ORDER MAPPING
     *
     * IMPORTANT:
     *
     * cashfreeOrders/{orderId}
     *
     * is later used by webhook to determine:
     *
     * Cashfree Order
     *        ↓
     * Firebase UID
     *        ↓
     * Civil Course
     * ---------------------------------------------------------
     */

    await firebase
      .database()
      .ref(`cashfreeOrders/${orderId}`)
      .set({
        uid: uid,

        courseId: COURSE_ID,

        courseName:
          "Civil Engineering 2nd Year",

        orderId: orderId,

        amount: AMOUNT,

        currency: CURRENCY,

        status: "PENDING",

        customerEmail: email || null,

        customerPhone:
          customerPhone || null,

        createdAt:
          admin.database.ServerValue.TIMESTAMP,
      });

    /*
     * ---------------------------------------------------------
     * 16. RETURN PAYMENT SESSION TO FRONTEND
     * ---------------------------------------------------------
     */

    return json(res, 200, {
      success: true,

      order_id: orderId,

      payment_session_id:
        paymentSessionId,

      amount: AMOUNT,

      currency: CURRENCY,

      courseId: COURSE_ID,
    });
  } catch (error) {
    console.error(
      "create-cashfree-order error:",
      error
    );

    return json(res, 500, {
      message:
        "Unable to create Cashfree order.",

      details:
        error.message ||
        "Unknown server error.",
    });
  }
};
