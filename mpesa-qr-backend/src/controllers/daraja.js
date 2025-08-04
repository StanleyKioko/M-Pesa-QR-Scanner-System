require('dotenv').config();

const axios = require('axios');
const { admin, db } = require('../config/firebase');

// Log environment variables to verify loading
console.log('Loaded Environment Variables:', {
  MPESA_BASE_URL: process.env.MPESA_BASE_URL,
  MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
  MPESA_SHORTCODE: process.env.MPESA_SHORTCODE,
  SERVER_URL: process.env.SERVER_URL
});

// Set base URL depending on environment
const MPESA_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

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
      console.error(`Missing required environment variable: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

// Generate M-Pesa access token
async function generateAccessToken() {
  checkEnvVars();
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  try {
    console.log('Requesting M-Pesa access token...');
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Accept': 'application/json' // Added for consistency
        },
      }
    );
    if (!response.data.access_token) {
      console.error('No access token in response:', response.data);
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
  console.log('Received STK Push request:', { phoneNumber, amount });

  if (!phoneNumber || !amount) {
    console.error('Phone number and amount are required');
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }

  // Validate phone number format
  if (!/^2547\d{8}$/.test(phoneNumber)) {
    console.error('Invalid phone number format:', phoneNumber);
    return res.status(400).json({ error: 'Phone number must be in format 2547XXXXXXXX' });
  }

  // Sandbox only works with test number 254708374149
  if (process.env.NODE_ENV !== 'production' && phoneNumber !== '254708374149') {
    console.error('Sandbox only works with test number 254708374149');
    return res.status(400).json({ error: 'Sandbox only works with test number 254708374149' });
  }

  // Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    console.error('Invalid amount:', amount);
    return res.status(400).json({ error: 'Amount must be a positive number' });
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
      Amount: parsedAmount.toString(), // Ensure string
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.SERVER_URL}/daraja/stk-callback`,
      AccountReference: `QR_${timestamp}`,
      TransactionDesc: 'Payment via QR code',
    };

    console.log('STK Push Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json' // Added for consistency
        },
      }
    );

    console.log('STK Push Response:', JSON.stringify(response.data, null, 2));

    // Store transaction in Firestore
    const docRef = await db.collection('transactions').add({
      phoneNumber,
      amount: parsedAmount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      mpesa: response.data,
      status: response.data.ResponseCode === '0' ? 'pending' : 'failed',
      CheckoutRequestID: response.data.CheckoutRequestID || null
    });

    // Check for error in response
    if (response.data.errorCode || response.data.errorMessage) {
      console.error('STK Push API error:', response.data);
      return res.status(500).json({
        error: response.data.errorMessage || 'STK push error',
        details: response.data
      });
    }

    res.status(200).json({ status: 'success', data: response.data, transactionId: docRef.id });
  } catch (error) {
    console.error('triggerSTKPush error:', JSON.stringify(error, null, 2));
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
      return res.status(500).json({
        error: error.response.data.errorMessage || error.response.data.error || 'Failed to initiate STK push',
        details: error.response.data,
        status: error.response.status,
      });
    } else if (error.request) {
      console.error('Request:', error.request);
      return res.status(500).json({
        error: 'No response received from M-Pesa API',
        details: error.message,
      });
    } else {
      console.error('Error:', error.message);
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

module.exports = { triggerSTKPush, handleCallback, generateAccessToken };