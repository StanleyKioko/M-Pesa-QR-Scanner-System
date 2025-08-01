require('dotenv').config();

const axios = require('axios');
const { admin, db } = require('../config/firebase');

// Helper to check required env vars
function checkEnvVars() {
  const required = [
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_SHORTCODE',
    'MPESA_PASSKEY',
    'SERVER_URL'
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

// Generate M-Pesa access token
async function generateAccessToken() {
  checkEnvVars();
  let auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  auth = auth.replace(/(\r\n|\n|\r)/gm, ''); // Remove any line breaks
  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    if (!response.data.access_token) {
      throw new Error('No access token in response');
    }
    console.log('Access Token:', response.data.access_token);
    return response.data.access_token;
  } catch (error) {
    console.error('generateAccessToken error:', error.response?.data || error.message);
    throw new Error(`Failed to generate access token: ${error.response?.data?.errorMessage || error.message}`);
  }
}

// Trigger STK Push and store in Firestore
async function triggerSTKPush(req, res) {
  const { phoneNumber, amount } = req.body;
  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }

  // Validate phone number format
  if (!/^2547\d{8}$/.test(phoneNumber)) {
    return res.status(400).json({ error: 'Phone number must be in format 2547XXXXXXXX' });
  }

  try {
    const accessToken = await generateAccessToken();
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0'); // YYYYMMDDHHMMSS

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.SERVER_URL}/daraja/callback`,
      AccountReference: `QR_${timestamp}`,
      TransactionDesc: 'Payment via QR code',
    };

    console.log('STK Push Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('STK Push Response:', response.data);

    // Store transaction in Firestore
    const docRef = await db.collection('transactions').add({
      phoneNumber,
      amount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      mpesa: response.data,
      status: response.data.ResponseCode === '0' ? 'pending' : 'failed',
      CheckoutRequestID: response.data.CheckoutRequestID || null
    });

    // Check for error in response
    if (response.data.errorCode || response.data.errorMessage) {
      return res.status(500).json({
        error: response.data.errorMessage || 'STK push error',
        details: response.data
      });
    }

    res.status(200).json({ status: 'success', data: response.data, transactionId: docRef.id });
  } catch (error) {
    // Log full error for debugging
    if (error.response) {
      console.error('triggerSTKPush error:', error.response.data);
      return res.status(500).json({
        error: error.response.data.errorMessage || 'Failed to initiate STK push',
        details: error.response.data
      });
    } else {
      console.error('triggerSTKPush error:', error.message);
      return res.status(500).json({
        error: error.message || 'Failed to initiate STK push'
      });
    }
  }
}

// Handle M-Pesa callback and update transaction status
async function handleCallback(req, res) {
  try {
    const callbackData = req.body;
    console.log('Callback received:', JSON.stringify(callbackData, null, 2));

    // Find transaction by CheckoutRequestID and update status
    if (callbackData.Body && callbackData.Body.stkCallback) {
      const checkoutRequestID = callbackData.Body.stkCallback.CheckoutRequestID;
      const status = callbackData.Body.stkCallback.ResultCode === 0 ? 'success' : 'failed';

      // Find the transaction and update
      const transactionsRef = db.collection('transactions');
      const snapshot = await transactionsRef.where('CheckoutRequestID', '==', checkoutRequestID).get();

      if (!snapshot.empty) {
        snapshot.forEach(async (doc) => {
          await doc.ref.update({
            status,
            callback: callbackData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Transaction ${doc.id} updated with status: ${status}`);
        });
      } else {
        console.log(`No transaction found for CheckoutRequestID: ${checkoutRequestID}`);
      }
    } else {
      console.log('Invalid callback data format');
      return res.status(400).json({ error: 'Invalid callback data format' });
    }

    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Callback update error:', err);
    res.status(500).json({ error: 'Failed to update transaction status' });
  }
}

module.exports = { triggerSTKPush, handleCallback };