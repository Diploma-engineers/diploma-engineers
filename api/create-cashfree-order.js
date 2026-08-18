const admin = require("firebase-admin");
const crypto = require("crypto");

const CASHFREE_API = "https://api.cashfree.com/pg";
const API_VERSION = "2023-08-01";
const COURSE_ID = "civil_special";
const COURSE_NAME = "Civil Engineering 2nd Year";
const AMOUNT = 499; // Change this to your actual course price.

function initFirebase() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_CLIENT_EMAIL ||
        !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error("Firebase Admin environment variables are missing.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        "https://diploma-app-9a378-default-rtdb.firebaseio.com",
    });
  }
  return admin;
}

function json(res, status, data) {
  res.status(status).json(data);
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

function makeOrderId(uid) {
  const shortUid = uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  const stamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `DE_CIVIL_${shortUid}_${stamp}_${random}`.slice(0, 45);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed." });
  }

  try {
    if (!process.env.CASHFREE_CLIENT_ID ||
        !process.env.CASHFREE_CLIENT_SECRET) {
      return json(res, 500, {
        message: "Cashfree environment variables are missing.",
      });
    }

    const firebase = initFirebase();
    const token = getBearerToken(req);

    if (!token) {
      return json(res, 401, { message: "Firebase login token is required." });
    }

    const decoded = await firebase.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : (req.body || {});

    if (body.courseId !== COURSE_ID) {
      return json(res, 400, { message: "Invalid course." });
    }

    // Try common phone/mobile fields in the user's Firebase profile.
    const profileSnap = await firebase.database()
      .ref(`users/${uid}`)
      .once("value");

    const profile = profileSnap.val() || {};

    const email =
      decoded.email ||
      profile.email ||
      profile.emailAddress ||
      null;

    const phone =
      decoded.phone_number ||
      profile.phone ||
      profile.mobile ||
      profile.mobileNumber ||
      profile.phoneNumber ||
      null;

    const name =
      decoded.name ||
      profile.name ||
      profile.displayName ||
      "Diploma Engineers Student";

    if (!email) {
      return json(res, 400, {
        message: "Your account needs an email address before payment.",
      });
    }

    if (!phone) {
      return json(res, 400, {
        message: "Your account needs a mobile number before payment.",
      });
    }

    const orderId = makeOrderId(uid);
    const environment =
      (process.env.CASHFREE_ENVIRONMENT || "production").toLowerCase();

    const apiBase =
      environment === "sandbox"
        ? "https://sandbox.cashfree.com/pg"
        : CASHFREE_API;

    const returnUrl =
      process.env.CASHFREE_RETURN_URL ||
      "https://diplomaengineers.vercel.app/civil-2nd-year-paid.html?payment=return";

    const payload = {
      order_id: orderId,
      order_amount: AMOUNT,
      order_currency: "INR",
      customer_details: {
        customer_id: uid.slice(0, 50),
        customer_name: String(name).slice(0, 100),
        customer_email: String(email).slice(0, 100),
        customer_phone: String(phone).replace(/\s+/g, "").slice(0, 15),
      },
      order_note: COURSE_NAME,
      order_meta: {
        return_url: returnUrl,
      },
      order_tags: {
        course_id: COURSE_ID,
        firebase_uid: uid,
      },
    };

    const cfResponse = await fetch(`${apiBase}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": API_VERSION,
        "x-client-id": process.env.CASHFREE_CLIENT_ID,
        "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
        "x-request-id": crypto.randomUUID(),
        "x-idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    });

    const cfData = await cfResponse.json().catch(() => ({}));

    if (!cfResponse.ok || !cfData.payment_session_id) {
      console.error("Cashfree create order error:", cfData);
      return json(res, 502, {
        message: "Cashfree order could not be created.",
        details: cfData.message || cfData.type || undefined,
      });
    }

    // Pending record. It does NOT unlock the course.
    await firebase.database()
      .ref(`users/${uid}/purchases/${COURSE_ID}/pendingOrders/${orderId}`)
      .set({
        status: "pending",
        courseId: COURSE_ID,
        courseName: COURSE_NAME,
        orderId,
        amount: AMOUNT,
        currency: "INR",
        createdAt: admin.database.ServerValue.TIMESTAMP,
      });

    // Global lookup lets the webhook identify the Firebase UID
    // without trusting data supplied by the browser.
    await firebase.database()
      .ref(`cashfreeOrders/${orderId}`)
      .set({
        uid,
        courseId: COURSE_ID,
        amount: AMOUNT,
        currency: "INR",
        createdAt: admin.database.ServerValue.TIMESTAMP,
        status: "pending",
      });

    return json(res, 200, {
      order_id: orderId,
      payment_session_id: cfData.payment_session_id,
      mode: environment === "sandbox" ? "sandbox" : "production",
    });

  } catch (error) {
    console.error("create-cashfree-order:", error);
    return json(res, 500, {
      message: error.message || "Internal server error.",
    });
  }
};

