const admin = require("firebase-admin");
const crypto = require("crypto");

const API_VERSION = "2025-01-01";

const COURSE_ID = "civil_special";

const EXPECTED_AMOUNT = 1;

const EXPECTED_CURRENCY = "INR";

const CASHFREE_SANDBOX_API =
  "https://sandbox.cashfree.com/pg";

const CASHFREE_PRODUCTION_API =
  "https://api.cashfree.com/pg";


/* =========================================================
   FIREBASE ADMIN INITIALIZATION
========================================================= */

function initFirebase() {

  if (!admin.apps.length) {

    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY ||
      !process.env.FIREBASE_DATABASE_URL
    ) {
      throw new Error(
        "Firebase Admin environment variables are missing."
      );
    }

    admin.initializeApp({

      credential:
        admin.credential.cert({

          projectId:
            process.env.FIREBASE_PROJECT_ID,

          clientEmail:
            process.env.FIREBASE_CLIENT_EMAIL,

          privateKey:
            process.env.FIREBASE_PRIVATE_KEY
              .replace(/\\n/g, "\n")

        }),

      databaseURL:
        process.env.FIREBASE_DATABASE_URL

    });
  }

  return admin;
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function json(res, status, data) {

  return res
    .status(status)
    .json(data);

}


/* =========================================================
   READ RAW WEBHOOK BODY

   IMPORTANT:
   Cashfree signature verification requires
   the ORIGINAL raw request body.
========================================================= */

function readRawBody(req) {

  return new Promise((resolve, reject) => {

    const chunks = [];

    req.on("data", chunk => {

      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk)
      );

    });

    req.on("end", () => {

      resolve(
        Buffer.concat(chunks)
      );

    });

    req.on("error", error => {

      reject(error);

    });

  });

}


/* =========================================================
   SAFE STRING COMPARISON
========================================================= */

function safeEqualText(a, b) {

  try {

    const aa =
      Buffer.from(a || "", "utf8");

    const bb =
      Buffer.from(b || "", "utf8");

    return (
      aa.length === bb.length &&
      crypto.timingSafeEqual(aa, bb)
    );

  } catch (error) {

    return false;

  }

}


/* =========================================================
   CASHFREE GET REQUEST
========================================================= */

async function cashfreeGet(path) {

  const environment =
    String(
      process.env.CASHFREE_ENVIRONMENT ||
      "sandbox"
    ).toLowerCase();

  const baseUrl =
    environment === "sandbox"
      ? CASHFREE_SANDBOX_API
      : CASHFREE_PRODUCTION_API;


  const response =
    await fetch(
      `${baseUrl}${path}`,
      {

        method: "GET",

        headers: {

          "Accept":
            "application/json",

          "x-api-version":
            API_VERSION,

          "x-client-id":
            process.env.CASHFREE_CLIENT_ID,

          "x-client-secret":
            process.env.CASHFREE_CLIENT_SECRET,

          "x-request-id":
            crypto.randomUUID()

        }

      }
    );


  const data =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {

    const error =
      new Error(
        data.message ||
        "Cashfree API request failed."
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;

  }


  return data;

}


/* =========================================================
   VERCEL API CONFIG

   Raw body must be available.
========================================================= */

module.exports.config = {

  api: {

    bodyParser: false

  }

};


/* =========================================================
   WEBHOOK HANDLER
========================================================= */

module.exports = async function handler(req, res) {


  /* -------------------------------------------------------
     ONLY POST REQUEST
  ------------------------------------------------------- */

  if (req.method !== "POST") {

    res.setHeader(
      "Allow",
      "POST"
    );

    return json(
      res,
      405,
      {
        message:
          "Method not allowed."
      }
    );

  }


  try {


    /* -----------------------------------------------------
       FIREBASE
    ----------------------------------------------------- */

    const firebase =
      initFirebase();


    /* -----------------------------------------------------
       READ RAW BODY
    ----------------------------------------------------- */

    const rawBody =
      await readRawBody(req);

    const rawText =
      rawBody.toString("utf8");


    /* -----------------------------------------------------
       CASHFREE WEBHOOK HEADERS
    ----------------------------------------------------- */

    const timestamp =
      req.headers[
        "x-webhook-timestamp"
      ];

    const receivedSignature =
      req.headers[
        "x-webhook-signature"
      ];


    if (
      !timestamp ||
      !receivedSignature
    ) {

      return json(
        res,
        400,
        {
          message:
            "Missing Cashfree webhook signature headers."
        }
      );

    }


    /* -----------------------------------------------------
       VERIFY CASHFREE SIGNATURE

       Cashfree signature:

       Base64(
         HMAC-SHA256(
           timestamp + rawBody,
           clientSecret
         )
       )
    ----------------------------------------------------- */

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.CASHFREE_CLIENT_SECRET
        )
        .update(
          `${timestamp}${rawText}`
        )
        .digest("base64");


    if (
      !safeEqualText(
        expectedSignature,
        receivedSignature
      )
    ) {

      console.error(
        "Invalid Cashfree webhook signature."
      );

      return json(
        res,
        401,
        {
          message:
            "Invalid webhook signature."
        }
      );

    }


    /* -----------------------------------------------------
       PARSE WEBHOOK JSON
    ----------------------------------------------------- */

    let event;

    try {

      event =
        JSON.parse(rawText);

    } catch (error) {

      return json(
        res,
        400,
        {
          message:
            "Invalid webhook JSON."
        }
      );

    }


    /* -----------------------------------------------------
       GET ORDER ID
    ----------------------------------------------------- */

    const orderId =

      event?.data?.order?.order_id ||

      event?.data?.order?.orderId ||

      event?.data?.order_id ||

      event?.order_id;


    /*
      Some Cashfree webhook events may not contain
      an order ID. Do not fail repeatedly.
    */

    if (!orderId) {

      return json(
        res,
        200,
        {
          received: true,
          ignored: true
        }
      );

    }


    /* -----------------------------------------------------
       FIND OUR ORDER MAPPING

       cashfreeOrders/{orderId}
    ----------------------------------------------------- */

    const orderRef =
      firebase
        .database()
        .ref(
          `cashfreeOrders/${orderId}`
        );


    const orderSnapshot =
      await orderRef.once("value");


    /*
      UNKNOWN ORDER

      Never unlock a course for an order
      that our backend did not create.
    */

    if (!orderSnapshot.exists()) {

      console.warn(
        "Unknown Cashfree order:",
        orderId
      );

      return json(
        res,
        200,
        {
          received: true,
          ignored: true
        }
      );

    }


    const mapping =
      orderSnapshot.val() || {};


    const uid =
      mapping.uid;

    const courseId =
      mapping.courseId;


    /* -----------------------------------------------------
       VERIFY UID + COURSE
    ----------------------------------------------------- */

    if (!uid) {

      return json(
        res,
        200,
        {
          received: true,
          ignored: true,
          reason:
            "UID mapping missing."
        }
      );

    }


    if (
      courseId !== COURSE_ID
    ) {

      return json(
        res,
        200,
        {
          received: true,
          ignored: true,
          reason:
            "Invalid course."
        }
      );

    }


    /* -----------------------------------------------------
       VERIFY ORDER DIRECTLY WITH CASHFREE

       Never trust only the webhook payload.
    ----------------------------------------------------- */

    const order =
      await cashfreeGet(
        `/orders/${encodeURIComponent(
          orderId
        )}`
      );


    const orderStatus =
      String(
        order.order_status || ""
      ).toUpperCase();


    /* -----------------------------------------------------
       ORDER MUST BE PAID
    ----------------------------------------------------- */

    if (
      orderStatus !== "PAID"
    ) {

      await orderRef.update({

        status:
          orderStatus ||
          "UNKNOWN",

        lastWebhookAt:
          admin.database
            .ServerValue
            .TIMESTAMP

      });


      return json(
        res,
        200,
        {
          received: true,

          paid: false,

          order_status:
            orderStatus
        }
      );

    }


    /* -----------------------------------------------------
       VERIFY AMOUNT
    ----------------------------------------------------- */

    const orderAmount =
      Number(
        order.order_amount
      );


    /* -----------------------------------------------------
       VERIFY CURRENCY
    ----------------------------------------------------- */

    const orderCurrency =
      String(
        order.order_currency ||
        ""
      ).toUpperCase();


    /*
      VERY IMPORTANT:

      Only ₹1 INR is accepted
      in this testing version.
    */

    if (
      orderAmount !==
        EXPECTED_AMOUNT ||

      orderCurrency !==
        EXPECTED_CURRENCY
    ) {


      await orderRef.update({

        status:
          "REJECTED_AMOUNT_OR_CURRENCY",

        verifiedAmount:
          orderAmount,

        verifiedCurrency:
          orderCurrency,

        lastWebhookAt:
          admin.database
            .ServerValue
            .TIMESTAMP

      });


      console.error(
        "Wrong payment amount/currency:",
        {
          orderId,
          orderAmount,
          orderCurrency
        }
      );


      return json(
        res,
        200,
        {
          received: true,

          paid: false,

          reason:
            "Amount or currency mismatch."
        }
      );

    }


    /* -----------------------------------------------------
       GET PAYMENT DETAILS FROM CASHFREE
    ----------------------------------------------------- */

    const payments =
      await cashfreeGet(
        `/orders/${encodeURIComponent(
          orderId
        )}/payments`
      );


    /* -----------------------------------------------------
       FIND SUCCESSFUL PAYMENT
    ----------------------------------------------------- */

    const successfulPayment =
      Array.isArray(payments)
        ? payments.find(
            payment =>
              String(
                payment.payment_status ||
                ""
              ).toUpperCase() ===
              "SUCCESS"
          )
        : null;


    if (!successfulPayment) {

      return json(
        res,
        200,
        {
          received: true,

          paid: false,

          reason:
            "No successful payment found."
        }
      );

    }


    /* -----------------------------------------------------
       PAYMENT ID
    ----------------------------------------------------- */

    const paymentId =

      successfulPayment
        .cf_payment_id ||

      successfulPayment
        .cfPaymentId ||

      successfulPayment
        .payment_id ||

      null;


    /* -----------------------------------------------------
       FIREBASE PURCHASE PATH
    ----------------------------------------------------- */

    const purchaseRef =
      firebase
        .database()
        .ref(
          `users/${uid}/purchases/${COURSE_ID}`
        );


    /* -----------------------------------------------------
       IDEMPOTENT PURCHASE WRITE

       Repeated webhook calls will safely
       update the same purchase record.
    ----------------------------------------------------- */

    await purchaseRef.set({

      purchased:
        true,

      status:
        "paid",

      courseId:
        COURSE_ID,

      courseName:
        "Civil Engineering 2nd Year",

      orderId:
        orderId,

      paymentId:
        paymentId,

      amount:
        EXPECTED_AMOUNT,

      currency:
        EXPECTED_CURRENCY,

      paymentMethod:
        successfulPayment
          .payment_group ||
        null,

      paidAt:
        admin.database
          .ServerValue
          .TIMESTAMP

    });


    /* -----------------------------------------------------
       MARK ORDER VERIFIED
    ----------------------------------------------------- */

    await orderRef.update({

      status:
        "PAID",

      paymentId:
        paymentId,

      verifiedAmount:
        EXPECTED_AMOUNT,

      verifiedCurrency:
        EXPECTED_CURRENCY,

      verifiedAt:
        admin.database
          .ServerValue
          .TIMESTAMP

    });


    /* -----------------------------------------------------
       SUCCESS
    ----------------------------------------------------- */

    console.log(
      "Civil course purchase verified:",
      {
        orderId,
        uid,
        courseId: COURSE_ID,
        amount: EXPECTED_AMOUNT,
        currency: EXPECTED_CURRENCY
      }
    );


    return json(
      res,
      200,
      {

        received:
          true,

        paid:
          true,

        order_id:
          orderId

      }
    );


  } catch (error) {


    console.error(
      "cashfree-webhook error:",
      error
    );


    /*
      Do not expose secrets or
      internal Firebase information.
    */

    return json(
      res,
      500,
      {
        message:
          "Webhook processing failed."
      }
    );

  }

};
