const axios = require("axios");
const { db, admin } = require("../config/firestore");
const DARAJA_API_URL = process.env.NODE_ENV === "development" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";

async function getDarajaToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  console.log("Attempting to generate Daraja token with auth:", auth);
  try {
    const response = await axios.get(`${DARAJA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    console.log("Daraja Token Response:", response.data);
    return response.data.access_token;
  } catch (error) {
    console.error("Daraja Token Error Details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      headers: error.response?.headers,
    });
    throw new Error(`Failed to generate Daraja token: ${error.message}`);
  }
}

async function triggerSTKPush(req, res) {
  const { phoneNumber, amount } = req.body;
  const merchantId = req.user.uid;
  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Phone number and amount are required" });
  }
  try {
    console.log("Accessing Firestore with merchantId:", merchantId);
    const merchantDoc = await db.collection("merchants").doc(merchantId).get();
    if (!merchantDoc.exists) {
      console.error("Merchant not found for ID:", merchantId);
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
    console.log("STK Push Payload:", JSON.stringify(payload, null, 2));
    const response = await axios.post(`${DARAJA_API_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await db.collection("transactions").add({
      merchantId,
      transactionRef,
      phoneNumber,
      amount: parseFloat(amount),
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({
      status: "success",
      message: "STK push initiated",
      data: response.data,
    });
  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ error: `Failed to initiate STK push: ${error.message}` });
  }
}

async function handleSTKCallback(req, res) {
  console.log("Callback received:", JSON.stringify(req.body, null, 2));
  const callbackData = req.body.Body?.stkCallback;
  if (!callbackData) {
    console.error("Invalid callback data");
    return res.status(400).json({ error: "Invalid callback data" });
  }
  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;
  const transactionRef = CallbackMetadata?.Item.find(item => item.Name === "AccountReference")?.Value;
  try {
    const transactionQuery = await db.collection("transactions").where("transactionRef", "==", transactionRef).get();
    if (transactionQuery.empty) {
      console.error("Transaction not found for reference:", transactionRef);
      return res.status(404).json({ error: "Transaction not found" });
    }
    const transactionDoc = transactionQuery.docs[0];
    await transactionDoc.ref.update({
      status: ResultCode === 0 ? "paid" : "failed",
      mpesaResult: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({ message: "Callback processed" });
  } catch (error) {
    console.error("Callback processing error:", error.message);
    res.status(500).json({ error: `Failed to process callback: ${error.message}` });
  }
}

module.exports = { triggerSTKPush, handleSTKCallback };