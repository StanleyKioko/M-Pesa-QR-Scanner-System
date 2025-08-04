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
          'Accept': 'application/json'
        },
      }
    );
    if (!response.data.access_token) {
      console.error('No access token in response:', response.data);
      throw new Error('No access token in response');
    }
    console.log('Access Token generated successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('generateAccessToken error:', error.response?.data || error.message);
    throw new Error(`Failed to generate access token: ${error.response?.data?.errorMessage || error.message}`);
  }
}

// Trigger STK Push and store in Firestore
async function triggerSTKPush(req, res) {
  const { phoneNumber, amount, reference, description } = req.body;
  const merchantId = req.user.uid; // From auth middleware
  
  console.log('Received STK Push request:', { 
    phoneNumber, 
    amount, 
    reference, 
    description,
    merchantId 
  });

  if (!phoneNumber || !amount) {
    console.error('Phone number and amount are required');
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }

  // Validate phone number format
  if (!/^254\d{9}$/.test(phoneNumber)) {
    console.error('Invalid phone number format:', phoneNumber);
    return res.status(400).json({ error: 'Phone number must be in format 254XXXXXXXXX (12 digits)' });
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
    // Verify merchant exists
    const merchantDoc = await db.collection('merchants').doc(merchantId).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const merchantData = merchantDoc.data();

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

    const transactionRef = reference || `QR_${timestamp}`;

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: parsedAmount,
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.SERVER_URL}/daraja/stk-callback`,
      AccountReference: transactionRef,
      TransactionDesc: description || 'QR Payment',
    };

    console.log('STK Push Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('STK Push Response:', JSON.stringify(response.data, null, 2));

    // Enhanced transaction storage
    const transactionData = {
      // Basic transaction info
      merchantId,
      transactionRef,
      phoneNumber,
      amount: parsedAmount,
      description: description || 'QR Payment',
      
      // Status and timestamps
      status: response.data.ResponseCode === '0' ? 'pending' : 'failed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      // M-Pesa response data
      mpesaResponse: {
        ResponseCode: response.data.ResponseCode,
        ResponseDescription: response.data.ResponseDescription,
        MerchantRequestID: response.data.MerchantRequestID,
        CheckoutRequestID: response.data.CheckoutRequestID,
        CustomerMessage: response.data.CustomerMessage
      },
      
      // Merchant info
      merchantInfo: {
        name: merchantData.name,
        phone: merchantData.phone,
        shortcode: merchantData.shortcode
      },
      
      // Additional metadata
      metadata: {
        apiVersion: 'v1',
        environment: process.env.NODE_ENV,
        timestamp: timestamp,
        userAgent: req.headers['user-agent'] || '',
        source: 'qr_scanner'
      }
    };

    const docRef = await db.collection('transactions').add(transactionData);

    console.log(`Transaction ${docRef.id} created successfully`);

    // Check for error in response
    if (response.data.errorCode || response.data.errorMessage) {
      console.error('STK Push API error:', response.data);
      
      // Update transaction with error status
      await docRef.update({
        status: 'failed',
        error: response.data.errorMessage || 'STK push API error',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(500).json({
        error: response.data.errorMessage || 'STK push error',
        details: response.data
      });
    }

    res.status(200).json({ 
      status: 'success', 
      data: response.data, 
      transactionId: docRef.id,
      transactionRef
    });
  } catch (error) {
    console.error('triggerSTKPush error:', error);
    
    // Store failed transaction
    try {
      await db.collection('transactions').add({
        merchantId,
        transactionRef: reference || `QR_${Date.now()}`,
        phoneNumber,
        amount: parsedAmount,
        description: description || 'QR Payment',
        status: 'error',
        error: error.message,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          source: 'qr_scanner',
          environment: process.env.NODE_ENV
        }
      });
    } catch (dbError) {
      console.error('Failed to store error transaction:', dbError);
    }

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      return res.status(500).json({
        error: error.response.data.errorMessage || error.response.data.error || 'Failed to initiate STK push',
        details: error.response.data,
        status: error.response.status,
      });
    } else if (error.request) {
      console.error('No response received:', error.request);
      return res.status(500).json({
        error: 'No response received from M-Pesa API',
        details: error.message,
      });
    } else {
      console.error('Error setting up request:', error.message);
      return res.status(500).json({
        error: error.message || 'Failed to initiate STK push'
      });
    }
  }
}

// Enhanced callback handler
async function handleCallback(req, res) {
  try {
    const callbackData = req.body;
    console.log('Callback received:', JSON.stringify(callbackData, null, 2));

    if (callbackData.Body && callbackData.Body.stkCallback) {
      const stkCallback = callbackData.Body.stkCallback;
      const checkoutRequestID = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const status = resultCode === 0 ? 'success' : 'failed';

      // Extract callback metadata
      const callbackMetadata = {};
      if (stkCallback.CallbackMetadata && stkCallback.CallbackMetadata.Item) {
        stkCallback.CallbackMetadata.Item.forEach(item => {
          callbackMetadata[item.Name] = item.Value;
        });
      }

      // Find the transaction and update
      const transactionsRef = db.collection('transactions');
      const snapshot = await transactionsRef
        .where('mpesaResponse.CheckoutRequestID', '==', checkoutRequestID)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const updateData = {
          status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          callbackData: stkCallback,
          callbackMetadata
        };

        // Add payment details if successful
        if (resultCode === 0 && callbackMetadata.Amount) {
          updateData.paymentDetails = {
            amount: callbackMetadata.Amount,
            mpesaReceiptNumber: callbackMetadata.MpesaReceiptNumber,
            transactionDate: callbackMetadata.TransactionDate,
            phoneNumber: callbackMetadata.PhoneNumber
          };
        }

        await doc.ref.update(updateData);
        console.log(`Transaction ${doc.id} updated with status: ${status}`);
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