const axios = require("axios");
const { db, admin } = require("../config/firestore");
const DARAJA_API_URL = process.env.NODE_ENV === "development" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";

// Generate Daraja API access token
async function getDarajaToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  try {
    const response = await axios.get(`${DARAJA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return response.data.access_token;
  } catch (error) {
    const errorDetails = {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    };
    throw new Error(`Failed to generate Daraja token: ${errorDetails.message} (Status: ${errorDetails.status})`);
  }
}

// Trigger M-Pesa STK push
async function triggerSTKPush(req, res) {
  const { phoneNumber, amount } = req.body;
  const merchantId = req.user.uid;

  // Validate input
  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Phone number and amount are required" });
  }
  if (!/^\d{12}$/.test(phoneNumber) || phoneNumber.slice(0, 3) !== "254") {
    return res.status(400).json({ error: "Phone number must be 12 digits starting with 254" });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  try {
    // Verify merchant exists
    const merchantDoc = await db.collection("merchants").doc(merchantId).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    // Generate token and prepare STK push
    const token = await getDarajaToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");
    const transactionRef = `QR_${Date.now()}`;

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: parsedAmount,
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.SERVER_URL}/daraja/stk-callback`,
      AccountReference: transactionRef,
      TransactionDesc: "Payment for QR scan",
    };

    // Send STK push request
    const response = await axios.post(`${DARAJA_API_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Store transaction in Firestore
    await db.collection("transactions").add({
      merchantId,
      transactionRef,
      phoneNumber,
      amount: parsedAmount,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      status: "success",
      message: "STK push initiated",
      data: response.data,
    });
  } catch (error) {
    const errorMessage = error.response?.data?.errorMessage || error.message;
    const statusCode = error.response?.status || 500;
    return res.status(statusCode).json({ error: `Failed to initiate STK push: ${errorMessage}` });
  }
}

// Handle M-Pesa STK callback
async function handleSTKCallback(req, res) {
  const callbackData = req.body.Body?.stkCallback;
  if (!callbackData) {
    return res.status(400).json({ error: "Invalid callback data" });
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;
  const transactionRef = CallbackMetadata?.Item.find(item => item.Name === "AccountReference")?.Value;

  if (!transactionRef) {
    return res.status(400).json({ error: "Transaction reference not found in callback" });
  }

  try {
    // Find transaction in Firestore
    const transactionQuery = await db.collection("transactions").where("transactionRef", "==", transactionRef).get();
    if (transactionQuery.empty) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Update transaction status
    const transactionDoc = transactionQuery.docs[0];
    await transactionDoc.ref.update({
      status: ResultCode === 0 ? "paid" : "failed",
      mpesaResult: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Callback processed" });
  } catch (error) {
    return res.status(500).json({ error: `Failed to process callback: ${error.message}` });
  }
}

module.exports = { triggerSTKPush, handleSTKCallback };