const admin = require("firebase-admin");
const crypto = require("crypto");

const API_VERSION = "2023-08-01";
const COURSE_ID = "civil_special";
const CASHFREE_PRODUCTION_API = "https://api.cashfree.com/pg";
const CASHFREE_SANDBOX_API = "https://sandbox.cashfree.com/pg";

// Vercel/Node must expose the raw request body for Cashfree signature verification.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeEqualText(a, b) {
  try {
    const aa = Buffer.from(a || "", "utf8");
    const bb = Buffer.from(b || "", "utf8");
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function json(res, status, data) {
  res.status(status).json(data);
}

async function cashfreeGet(path) {
  const environment =
    (process.env.CASHFREE_ENVIRONMENT || "production").toLowerCase();

  const base =
    environment === "sandbox"
      ? CASHFREE_SANDBOX_API
      : CASHFREE_PRODUCTION_API;

  const response = await fetch(`${base}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": process.env.CASHFREE_CLIENT_ID,
      "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
      "x-request-id": crypto.randomUUID(),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.message || "Cashfree API request failed.");
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { message: "Method not allowed." });
  }

  try {
    if (!process.env.CASHFREE_CLIENT_SECRET) {
      return json(res, 500, {
        message: "Cashfree secret is not configured.",
      });
    }

    const firebase = initFirebase();

    const rawBody = await readRawBody(req);
    const rawText = rawBody.toString("utf8");

    /*
      Cashfree webhook signature:
      Base64(HMAC-SHA256(timestamp + rawBody, clientSecret))

      The timestamp and signature come from webhook headers.
    */
    const timestamp =
      req.headers["x-webhook-timestamp"] ||
      req.headers["x-webhook-timestamp".toLowerCase()];

    const receivedSignature =
      req.headers["x-webhook-signature"] ||
      req.headers["x-webhook-signature".toLowerCase()];

    if (!timestamp || !receivedSignature) {
      return json(res, 400, {
        message: "Missing Cashfree webhook signature headers.",
      });
    }

    const signedPayload = `${timestamp}${rawText}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.CASHFREE_CLIENT_SECRET)
      .update(signedPayload)
      .digest("base64");

    if (!safeEqualText(expectedSignature, receivedSignature)) {
      console.warn("Invalid Cashfree webhook signature.");
      return json(res, 401, { message: "Invalid webhook signature." });
    }

    let event;
    try {
      event = JSON.parse(rawText);
    } catch {
      return json(res, 400, { message: "Invalid JSON payload." });
    }

    const orderId =
      event?.data?.order?.order_id ||
      event?.data?.order?.orderId ||
      event?.data?.order_id ||
      event?.order_id;

    if (!orderId) {
      // Signature was valid, but this event does not contain an order ID.
      return json(res, 200, { received: true, ignored: true });
    }

    const orderRef = firebase.database().ref(`cashfreeOrders/${orderId}`);
    const orderSnap = await orderRef.once("value");

    if (!orderSnap.exists()) {
      console.warn("Unknown Cashfree order:", orderId);
      // Do not unlock any Firebase user for an unknown order.
      return json(res, 200, { received: true, ignored: true });
    }

    const mapping = orderSnap.val() || {};
    const uid = mapping.uid;
    const courseId = mapping.courseId;

    if (!uid || courseId !== COURSE_ID) {
      return json(res, 200, { received: true, ignored: true });
    }

    /*
      Do not trust "success" text from the browser/webhook alone.
      Fetch the order directly from Cashfree and verify it is PAID.
    */
    const order = await cashfreeGet(`/orders/${encodeURIComponent(orderId)}`);

    const orderStatus = String(order.order_status || "").toUpperCase();

    if (orderStatus !== "PAID") {
      await orderRef.update({
        status: orderStatus || "UNKNOWN",
        lastWebhookAt: admin.database.ServerValue.TIMESTAMP,
      });

      return json(res, 200, {
        received: true,
        paid: false,
        order_status: orderStatus,
      });
    }

    // Fetch payments too, and require at least one successful payment.
    const payments = await cashfreeGet(
      `/orders/${encodeURIComponent(orderId)}/payments`
    );

    const successfulPayment =
      Array.isArray(payments)
        ? payments.find(
            p => String(p.payment_status || "").toUpperCase() === "SUCCESS"
          )
        : null;

    if (!successfulPayment) {
      return json(res, 200, {
        received: true,
        paid: false,
        reason: "No successful payment found.",
      });
    }

    const paymentId =
      successfulPayment.cf_payment_id ||
      successfulPayment.cfPaymentId ||
      successfulPayment.payment_id ||
      null;

    const amount =
      Number(order.order_amount) ||
      Number(successfulPayment.payment_amount) ||
      Number(mapping.amount) ||
      0;

    // Final unlock. This is the only place in this flow that grants access.
    await firebase.database()
      .ref(`users/${uid}/purchases/${COURSE_ID}`)
      .set({
        purchased: true,
        status: "paid",
        courseId: COURSE_ID,
        courseName: "Civil Engineering 2nd Year",
        orderId,
        paymentId,
        amount,
        currency: order.order_currency || "INR",
        paymentMethod: successfulPayment.payment_group || null,
        paidAt: admin.database.ServerValue.TIMESTAMP,
      });

    await firebase.database()
      .ref(`users/${uid}/purchases/${COURSE_ID}/pendingOrders/${orderId}`)
      .update({
        status: "paid",
        paymentId,
        verifiedAt: admin.database.ServerValue.TIMESTAMP,
      });

    await orderRef.update({
      status: "PAID",
      paymentId,
      verifiedAt: admin.database.ServerValue.TIMESTAMP,
    });

    console.log(`Civil course unlocked for Firebase UID ${uid}, order ${orderId}`);

    return json(res, 200, {
      received: true,
      paid: true,
      order_id: orderId,
    });

  } catch (error) {
    console.error("cashfree-webhook:", error);

    /*
      Return 500 so Cashfree can retry transient failures.
      Never mark a failed verification as paid.
    */
    return json(res, 500, {
      message: "Webhook processing failed.",
    });
  }
};

