const axios = require("axios");
const admin = require("../config/firebase").admin;
const db = require("../config/firebase").db;

const DARAJA_API_URL = process.env.NODE_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

// Generate OAuth token for Daraja API
async function getDarajaToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  try {
    const response = await axios.get(`${DARAJA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return response.data.access_token;
  } catch (error) {
    throw new Error(`Failed to generate Daraja token: ${error.message}`);
  }
}

// Trigger M-Pesa STK push
async function triggerSTKPush(req, res) {
  const { phoneNumber, amount } = req.body;
  const merchantId = req.user.uid; // From auth middleware

  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Phone number and amount are required" });
  }

  try {
    // Verify merchant exists
    const merchantDoc = await db.collection("merchants").doc(merchantId).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    const token = await getDarajaToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");
    const transactionRef = `QR_${Date.now()}`;

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: parseFloat(amount),
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.SERVER_URL}/daraja/stk-callback`,
      AccountReference: transactionRef,
      TransactionDesc: "Payment for QR scan",
    };

    const response = await axios.post(`${DARAJA_API_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Store transaction
    await db.collection("transactions").add({
      merchantId,
      transactionRef,
      phoneNumber,
      amount: parseFloat(amount),
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      status: "success",
      message: "STK push initiated",
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to initiate STK push: ${error.message}` });
  }
}

// Handle M-Pesa callback
async function handleSTKCallback(req, res) {
  const callbackData = req.body.Body?.stkCallback;

  if (!callbackData) {
    console.error("Invalid callback data");
    return res.status(400).json({ error: "Invalid callback data" });
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = callbackData;
  const transactionRef = callbackData.CallbackMetadata?.Item.find(item => item.Name === "AccountReference")?.Value;
  const amount = callbackData.CallbackMetadata?.Item.find(item => item.Name === "Amount")?.Value;
  const phoneNumber = callbackData.CallbackMetadata?.Item.find(item => item.Name === "PhoneNumber")?.Value;

  const status = ResultCode === 0 ? "paid" : "failed";

  try {
    const transactions = await db.collection("transactions")
      .where("transactionRef", "==", transactionRef)
      .get();

    if (!transactions.empty) {
      const transactionDoc = transactions.docs[0];
      await transactionDoc.ref.update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        mpesaResult: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc },
      });
    }

    res.status(200).json({ message: "Callback processed" });
  } catch (error) {
    console.error("Error processing callback:", error.message);
    res.status(500).json({ error: "Error processing callback" });
  }
}

module.exports = { triggerSTKPush, handleSTKCallback };