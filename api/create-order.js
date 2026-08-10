export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const {
      name,
      branch,
      enrollmentNo,
      collegeName,
      mobile,
      email
    } = req.body || {};

    if (
      !name ||
      !branch ||
      !enrollmentNo ||
      !collegeName ||
      !mobile ||
      !email
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all details."
      });
    }

    const cleanMobile = String(mobile).replace(/\D/g, "");

    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number."
      });
    }

    const clientId = process.env.CASHFREE_APP_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: "Cashfree keys are missing."
      });
    }

    const orderId =
      "PREMIUM_" +
      Date.now() +
      "_" +
      Math.random().toString(36).substring(2, 8);

    const response = await fetch(
      "https://api.cashfree.com/pg/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2025-01-01",
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({
          order_id: orderId,
          order_amount: 99,
          order_currency: "INR",

          customer_details: {
            customer_id: "student_" + cleanMobile,
            customer_name: name,
            customer_email: email,
            customer_phone: cleanMobile
          },

          order_meta: {
            return_url:
              "https://diplomaengineers.vercel.app/?payment=success&order_id={order_id}"
          },

          order_note: "Diploma Engineers Premium Membership",

          order_tags: {
            membership: "Premium",
            branch: branch,
            enrollment_no: enrollmentNo,
            college_name: collegeName
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.message || "Cashfree order failed."
      });
    }

    return res.status(200).json({
      success: true,
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
}
