require('dotenv').config();

const axios = require('axios');
const { admin, db } = require('../config/firebase');
const { getTransactionByCheckoutRequestID } = require('./transactions');

// Set base URL depending on environment
const MPESA_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// Helper to check required env vars
function checkEnvVars() {
  const required = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'SERVER_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Generate M-Pesa access token
async function generateAccessToken() {
  checkEnvVars();
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  try {
    console.log('🔑 Requesting M-Pesa access token...');
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
      console.error('❌ No access token in response:', response.data);
      throw new Error('No access token in response');
    }
    console.log('✅ Access Token generated successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('💥 generateAccessToken error:', error.response?.data || error.message);
    throw new Error(`Failed to generate access token: ${error.response?.data?.errorMessage || error.message}`);
  }
}

// Health check endpoint
async function healthCheck(req, res) {
  try {
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      SERVER_URL: process.env.SERVER_URL,
      MPESA_SHORTCODE: process.env.MPESA_SHORTCODE,
      HAS_CONSUMER_KEY: !!process.env.MPESA_CONSUMER_KEY,
      HAS_CONSUMER_SECRET: !!process.env.MPESA_CONSUMER_SECRET,
      HAS_PASSKEY: !!process.env.MPESA_PASSKEY,
      MPESA_BASE_URL: MPESA_BASE_URL
    };

    // Test database connection
    let dbStatus = 'unknown';
    try {
      await db.collection('test').limit(1).get();
      dbStatus = 'connected';
    } catch (dbError) {
      dbStatus = 'disconnected';
      console.error('❌ Database connection error:', dbError);
    }

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: dbStatus,
      endpoints: {
        customerPayment: '/daraja/customer-payment',
        merchantPayment: '/daraja/scan-qr',
        callback: '/daraja/stk-callback',
        testToken: '/daraja/test-token'
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Test endpoint to check M-Pesa API connectivity
async function testMpesaConnection(req, res) {
  try {
    console.log('🧪 Testing M-Pesa API connection...');
    
    const accessToken = await generateAccessToken();
    
    res.status(200).json({
      success: true,
      message: 'M-Pesa API connection successful',
      environment: process.env.NODE_ENV || 'development',
      baseUrl: MPESA_BASE_URL,
      hasToken: !!accessToken,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 M-Pesa connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'M-Pesa API connection failed',
      error: error.message,
      environment: process.env.NODE_ENV || 'development'
    });
  }
}

// Test registration endpoint (for frontend testing)
async function testRegister(req, res) {
  try {
    const { email, password, name, phone, shortcode } = req.body;
    
    console.log('🧪 Test registration request:', { email, name, phone, shortcode });
    
    // Create Firebase user first
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name
    });
    
    console.log('✅ Firebase user created:', userRecord.uid);
    
    // Store merchant in Firestore
    await db.collection('merchants').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      name: name,
      phone: phone,
      shortcode: shortcode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Merchant stored in Firestore');
    
    res.status(201).json({
      success: true,
      message: 'Test user created successfully',
      data: {
        uid: userRecord.uid,
        email: email,
        name: name
      }
    });
    
  } catch (error) {
    console.error('💥 Test registration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Test registration failed',
      error: error.message
    });
  }
}

// FIXED: Customer payment function with consistent field naming
async function triggerCustomerPayment(req, res) {
  console.log('💰 Customer payment initiated');
  const { phoneNumber, amount, qrData } = req.body;
  
  // Validate required fields
  if (!phoneNumber || !amount || !qrData) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: phoneNumber, amount, qrData'
    });
  }

  try {
    // Format phone number
    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    console.log('📞 Formatted phone number:', formattedPhone);

    // Validate phone number format
    if (!/^254\d{9}$/.test(formattedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Must be 254XXXXXXXXX'
      });
    }

    // Sandbox only works with test number
    if (process.env.NODE_ENV !== 'production' && formattedPhone !== '254708374149') {
      return res.status(400).json({
        success: false,
        message: 'Sandbox only works with test number 254708374149'
      });
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Get access token
    const accessToken = await generateAccessToken();
    if (!accessToken) {
      throw new Error('Failed to generate access token');
    }

    // Prepare STK push request
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    // Extract data from qrData
    const { merchantId, businessName, businessShortCode } = qrData;

    const stkPushData = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: parsedAmount,
      PartyA: formattedPhone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: `${process.env.SERVER_URL}/daraja/stk-callback`,
      AccountReference: `QR-${merchantId}`,
      TransactionDesc: `Payment to ${businessName || 'Merchant'}`
    };

    console.log('📤 STK Push request data:', stkPushData);

    // Send STK push request
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      stkPushData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📥 M-Pesa STK response:', response.data);

    if (response.data.ResponseCode === "0") {
      // FIXED: Create consistent transaction record with proper field naming
      const transactionData = {
        // Basic transaction info - CONSISTENT merchantId field
        merchantId: merchantId, // ✅ Consistent with analytics query
        amount: parsedAmount,
        phoneNumber: formattedPhone,
        
        // FIXED: M-Pesa response data with CONSISTENT field naming (uppercase)
        CheckoutRequestID: response.data.CheckoutRequestID, // ✅ Consistent uppercase
        MerchantRequestID: response.data.MerchantRequestID, // ✅ Consistent uppercase
        
        // Status tracking
        status: 'pending',
        
        // QR and merchant data
        qrData: qrData,
        businessName: businessName,
        businessShortCode: businessShortCode,
        
        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        
        // Payment metadata
        paymentType: 'customer_initiated',
        source: 'qr_scanner',
        
        // Transaction reference
        transactionRef: `CUST-${timestamp}`,
        
        // FIXED: Complete M-Pesa response with consistent structure
        mpesaResponse: {
          ResponseCode: response.data.ResponseCode,
          ResponseDescription: response.data.ResponseDescription,
          MerchantRequestID: response.data.MerchantRequestID, // ✅ Consistent uppercase
          CheckoutRequestID: response.data.CheckoutRequestID, // ✅ Consistent uppercase
          CustomerMessage: response.data.CustomerMessage
        },
        
        // Additional metadata
        metadata: {
          apiVersion: 'v1',
          environment: process.env.NODE_ENV,
          timestamp: timestamp,
          userAgent: req.headers['user-agent'] || '',
          ipAddress: req.ip || req.connection.remoteAddress
        }
      };

      // Store transaction in database
      const transactionRef = await db.collection('transactions').add(transactionData);
      console.log('✅ FIXED: Transaction created in database with consistent fields:', transactionRef.id);
      console.log('🔍 Stored CheckoutRequestID:', response.data.CheckoutRequestID);
      console.log('🔍 Stored merchantId:', merchantId);

      // Return success response
      res.status(200).json({
        success: true,
        message: 'STK push sent successfully',
        data: {
          CheckoutRequestID: response.data.CheckoutRequestID,
          MerchantRequestID: response.data.MerchantRequestID,
          CustomerMessage: response.data.CustomerMessage,
          ResponseDescription: response.data.ResponseDescription,
          transactionId: transactionRef.id,
          transactionRef: transactionData.transactionRef
        }
      });
    } else {
      // Handle M-Pesa API errors
      console.error('💥 M-Pesa API error:', response.data);
      
      // Still store failed transaction for tracking with CONSISTENT fields
      const failedTransactionData = {
        merchantId: merchantId, // ✅ Consistent
        amount: parsedAmount,
        phoneNumber: formattedPhone,
        status: 'failed',
        error: response.data.ResponseDescription || 'M-Pesa API error',
        qrData: qrData,
        businessName: businessName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentType: 'customer_initiated',
        source: 'qr_scanner',
        mpesaResponse: response.data
      };
      
      await db.collection('transactions').add(failedTransactionData);
      console.log('⚠️ Failed transaction stored with consistent fields');
      
      throw new Error(`M-Pesa API error: ${response.data.ResponseDescription}`);
    }

  } catch (error) {
    console.error('💥 Customer payment error:', error);
    
    let errorMessage = 'Failed to initiate payment';
    if (error.response) {
      console.error('📥 M-Pesa API error response:', error.response.data);
      errorMessage = error.response.data.errorMessage || error.response.data.ResponseDescription || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// FIXED: Enhanced callback handler with robust transaction lookup
async function handleCallback(req, res) {
  try {
    const callbackData = req.body;
    console.log('📞 M-Pesa Callback received:', JSON.stringify(callbackData, null, 2));

    if (callbackData.Body && callbackData.Body.stkCallback) {
      const stkCallback = callbackData.Body.stkCallback;
      const checkoutRequestID = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      
      // Determine status based on result code
      let status;
      if (resultCode === 0) {
        status = 'success';
      } else if (resultCode === 1032) {
        status = 'cancelled'; // User cancelled
      } else {
        status = 'failed';
      }

      console.log(`📊 Processing callback for CheckoutRequestID: ${checkoutRequestID}, ResultCode: ${resultCode}, Status: ${status}`);

      // Extract callback metadata
      const callbackMetadata = {};
      if (stkCallback.CallbackMetadata && stkCallback.CallbackMetadata.Item) {
        stkCallback.CallbackMetadata.Item.forEach(item => {
          callbackMetadata[item.Name] = item.Value;
        });
      }

      console.log('📋 Callback metadata:', callbackMetadata);

      // FIXED: Find the transaction using the improved helper function
      const transactionDoc = await getTransactionByCheckoutRequestID(checkoutRequestID);

      if (transactionDoc) {
        console.log(`✅ Found transaction ${transactionDoc.id} for update`);
        
        const updateData = {
          status,
          resultCode,
          resultDescription: resultDesc,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          callbackData: stkCallback,
          callbackMetadata,
          callbackReceivedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add payment details if successful
        if (resultCode === 0 && callbackMetadata.Amount) {
          updateData.paymentDetails = {
            amount: parseFloat(callbackMetadata.Amount),
            mpesaReceiptNumber: callbackMetadata.MpesaReceiptNumber,
            transactionDate: callbackMetadata.TransactionDate,
            phoneNumber: callbackMetadata.PhoneNumber
          };
          
          // Update customer message for successful payment
          updateData['mpesaResponse.CustomerMessage'] = `Payment of KSH ${callbackMetadata.Amount} received from ${callbackMetadata.PhoneNumber}. Receipt: ${callbackMetadata.MpesaReceiptNumber}`;
        }

        // Update the transaction in database
        await transactionDoc.ref.update(updateData);
        console.log(`✅ Transaction ${transactionDoc.id} updated with status: ${status}`);
        
        // Log payment result
        if (status === 'success') {
          console.log(`💰 Payment successful: KSH ${callbackMetadata.Amount} from ${callbackMetadata.PhoneNumber}`);
        } else {
          console.log(`❌ Payment ${status}: ${resultDesc}`);
        }
      } else {
        console.log(`⚠️ No transaction found for CheckoutRequestID: ${checkoutRequestID}`);
        
        // Store orphaned callback for investigation
        await db.collection('orphaned_callbacks').add({
          checkoutRequestID,
          callbackData,
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
          reason: 'No matching transaction found',
          searchedFields: ['CheckoutRequestID', 'mpesaResponse.CheckoutRequestID', 'checkoutRequestId']
        });
        console.log('🗃️ Orphaned callback stored for investigation');
      }
    } else {
      console.log('❌ Invalid callback data format');
      return res.status(400).json({ error: 'Invalid callback data format' });
    }

    res.status(200).json({ 
      status: 'success',
      message: 'Callback processed successfully' 
    });
  } catch (err) {
    console.error('💥 Callback processing error:', err);
    res.status(500).json({ error: 'Failed to process callback' });
  }
}

// FIXED: Merchant STK Push with consistent field naming
async function triggerSTKPush(req, res) {
  const { phoneNumber, amount, reference, description } = req.body;
  const merchantId = req.user.uid; // From auth middleware
  
  console.log('🏪 Merchant STK Push request:', { 
    phoneNumber, 
    amount, 
    reference, 
    description,
    merchantId 
  });

  if (!phoneNumber || !amount) {
    console.error('❌ Phone number and amount are required');
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }

  // Validate phone number format
  if (!/^254\d{9}$/.test(phoneNumber)) {
    console.error('❌ Invalid phone number format:', phoneNumber);
    return res.status(400).json({ error: 'Phone number must be in format 254XXXXXXXXX (12 digits)' });
  }

  // Sandbox only works with test number 254708374149
  if (process.env.NODE_ENV !== 'production' && phoneNumber !== '254708374149') {
    console.error('⚠️ Sandbox only works with test number 254708374149');
    return res.status(400).json({ error: 'Sandbox only works with test number 254708374149' });
  }

  // Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    console.error('❌ Invalid amount:', amount);
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    // Verify merchant exists
    const merchantDoc = await db.collection('merchants').doc(merchantId).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const merchantData = merchantDoc.data();
    console.log('✅ Merchant found:', merchantData.name);

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

    console.log('📤 STK Push Payload:', JSON.stringify(payload, null, 2));

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

    console.log('📥 STK Push Response:', JSON.stringify(response.data, null, 2));

    // FIXED: Enhanced transaction storage with CONSISTENT field naming
    const transactionData = {
      // Basic transaction info
      merchantId, // ✅ Consistent with analytics query
      transactionRef,
      phoneNumber,
      amount: parsedAmount,
      description: description || 'QR Payment',
      
      // Status and timestamps
      status: response.data.ResponseCode === '0' ? 'pending' : 'failed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      // FIXED: M-Pesa response data with CONSISTENT field naming (uppercase)
      CheckoutRequestID: response.data.CheckoutRequestID, // ✅ Consistent uppercase
      MerchantRequestID: response.data.MerchantRequestID, // ✅ Consistent uppercase
      
      // Complete M-Pesa response
      mpesaResponse: {
        ResponseCode: response.data.ResponseCode,
        ResponseDescription: response.data.ResponseDescription,
        MerchantRequestID: response.data.MerchantRequestID, // ✅ Consistent
        CheckoutRequestID: response.data.CheckoutRequestID, // ✅ Consistent
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
        source: 'qr_scanner',
        paymentType: 'merchant_initiated'
      }
    };

    const docRef = await db.collection('transactions').add(transactionData);

    console.log(`✅ FIXED: Transaction ${docRef.id} created successfully with consistent fields`);
    console.log('🔍 Stored CheckoutRequestID:', response.data.CheckoutRequestID);
    console.log('🔍 Stored merchantId:', merchantId);

    // Check for error in response
    if (response.data.errorCode || response.data.errorMessage) {
      console.error('💥 STK Push API error:', response.data);
      
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
      transactionRef,
      checkoutRequestID: response.data.CheckoutRequestID
    });

  } catch (error) {
    console.error('💥 triggerSTKPush error:', error);
    
    // Store failed transaction with consistent fields
    try {
      await db.collection('transactions').add({
        merchantId, // ✅ Consistent
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
          environment: process.env.NODE_ENV,
          paymentType: 'merchant_initiated'
        }
      });
      console.log('⚠️ Error transaction stored with consistent fields');
    } catch (dbError) {
      console.error('💥 Failed to store error transaction:', dbError);
    }

    if (error.response) {
      console.error('📥 Response status:', error.response.status);
      console.error('📥 Response data:', error.response.data);
      return res.status(500).json({
        error: error.response.data.errorMessage || error.response.data.error || 'Failed to initiate STK push',
        details: error.response.data,
        status: error.response.status,
      });
    } else if (error.request) {
      console.error('📤 No response received:', error.request);
      return res.status(500).json({
        error: 'No response received from M-Pesa API',
        details: error.message,
      });
    } else {
      console.error('⚙️ Error setting up request:', error.message);
      return res.status(500).json({
        error: error.message || 'Failed to initiate STK push'
      });
    }
  }
}

// NEW: Debug endpoint for testing transaction creation
async function createTestTransaction(req, res) {
  try {
    const { merchantId, amount, phoneNumber } = req.body;
    
    if (!merchantId || !amount || !phoneNumber) {
      return res.status(400).json({
        error: 'Missing required fields: merchantId, amount, phoneNumber'
      });
    }

    console.log('🧪 Creating test transaction...');
    
    const testTransactionData = {
      merchantId: merchantId, // ✅ Consistent field name
      amount: parseFloat(amount),
      phoneNumber: phoneNumber,
      status: 'pending',
      CheckoutRequestID: `TEST_${Date.now()}`, // ✅ Consistent uppercase
      MerchantRequestID: `MR_${Date.now()}`, // ✅ Consistent uppercase
      transactionRef: `TEST_${Date.now()}`,
      source: 'test_endpoint',
      paymentType: 'test',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      mpesaResponse: {
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CheckoutRequestID: `TEST_${Date.now()}`,
        MerchantRequestID: `MR_${Date.now()}`,
        CustomerMessage: 'Test transaction'
      }
    };
    
    const docRef = await db.collection('transactions').add(testTransactionData);
    console.log('✅ Test transaction created:', docRef.id);
    
    res.status(201).json({
      success: true,
      message: 'Test transaction created successfully',
      transactionId: docRef.id,
      data: testTransactionData
    });
    
  } catch (error) {
    console.error('💥 Test transaction creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// COMPLETE EXPORTS - All functions properly exported
module.exports = { 
  // Core M-Pesa functions
  triggerSTKPush, 
  handleCallback, 
  generateAccessToken, 
  triggerCustomerPayment,
  
  // Utility functions
  healthCheck,
  testMpesaConnection,
  testRegister,
  
  // NEW: Debug function
  createTestTransaction
};

// Log successful module load
console.log('✅ daraja.js module loaded successfully with all fixes applied');
console.log('🔧 Fixed issues:');
console.log('   - CheckoutRequestID field consistency');
console.log('   - merchantId field consistency');
console.log('   - Enhanced callback transaction lookup');
console.log('   - Improved error handling and logging');
console.log('   - Added test transaction endpoint');