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
  try {
    checkEnvVars();
    
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        timeout: 10000
      }
    );

    console.log('Access token generated successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('Access token generation failed:', error.response?.data || error.message);
    return null;
  }
}

// Health check endpoint
async function healthCheck(req, res) {
  try {
    console.log('Health check requested');
    
    const accessToken = await generateAccessToken();
    const tokenStatus = accessToken ? 'valid' : 'failed';
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      mpesa: {
        baseUrl: MPESA_BASE_URL,
        tokenStatus: tokenStatus,
        shortcode: process.env.MPESA_SHORTCODE
      },
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
    const accessToken = await generateAccessToken();
    
    if (accessToken) {
      res.status(200).json({
        success: true,
        message: 'M-Pesa API connection successful',
        token: accessToken.substring(0, 10) + '...',
        baseUrl: MPESA_BASE_URL
      });
    } else {
      throw new Error('Failed to generate access token');
    }
  } catch (error) {
    console.error('M-Pesa connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'M-Pesa API connection failed',
      error: error.message
    });
  }
}

// Test registration endpoint (for frontend testing)
async function testRegister(req, res) {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required'
      });
    }

    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name
    });

    res.status(201).json({
      success: true,
      message: 'Test user created successfully',
      user: {
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

// ✅ ENHANCED: Customer payment function with dynamic amount support
async function triggerCustomerPayment(req, res) {
  console.log('💰 Customer payment initiated');
  const { phoneNumber, amount, qrData } = req.body;
  
  // Validate required fields
  if (!phoneNumber || !qrData) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: phoneNumber, qrData'
    });
  }

  // Check if amount is provided or if it's a dynamic amount QR code
  if (!amount && !qrData.dynamicAmount) {
    return res.status(400).json({
      success: false,
      message: 'Amount is required for non-dynamic QR codes'
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

    // ✅ CRITICAL FIX: Validate merchant exists in database
    let isValidMerchant = false;
    let merchantData = null;
    
    if (merchantId && merchantId !== `manual-${Date.now()}` && !merchantId.startsWith('qr-') && !merchantId.startsWith('manual-')) {
      try {
        const merchantDoc = await db.collection('merchants').doc(merchantId).get();
        if (merchantDoc.exists) {
          isValidMerchant = true;
          merchantData = merchantDoc.data();
          console.log(`✅ Found valid merchant: ${merchantData.name} (${merchantId})`);
        } else {
          // Check in users collection as fallback
          const userDoc = await admin.auth().getUser(merchantId);
          if (userDoc) {
            isValidMerchant = true;
            merchantData = {
              name: userDoc.displayName || userDoc.email?.split('@')[0],
              email: userDoc.email,
              uid: userDoc.uid
            };
            console.log(`✅ Found valid user as merchant: ${merchantData.name} (${merchantId})`);
          } else {
            console.log(`⚠️ Merchant not found: ${merchantId}, treating as guest transaction`);
          }
        }
      } catch (error) {
        console.log(`⚠️ Error checking merchant: ${error.message}, treating as guest transaction`);
      }
    } else {
      console.log(`⚠️ Guest/manual transaction - merchantId: ${merchantId}`);
    }

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
      // ✅ ENHANCED: Create transaction record with proper merchant linking
      const transactionData = {
        // Core transaction data
        merchantId: isValidMerchant ? merchantId : null, // ✅ Only set if valid merchant
        amount: parsedAmount,
        phoneNumber: formattedPhone,
        status: 'pending',
        
        // M-Pesa identifiers (consistent uppercase)
        CheckoutRequestID: response.data.CheckoutRequestID,
        MerchantRequestID: response.data.MerchantRequestID,
        
        // Transaction reference
        transactionRef: `CUST_${timestamp}`,
        
        // QR and business data
        qrData: qrData,
        businessName: businessName,
        
        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        
        // M-Pesa response
        mpesaResponse: response.data,
        
        // ✅ CRITICAL: Enhanced metadata for proper categorization
        paymentType: 'customer_initiated',
        source: 'qr_scanner',
        isValidMerchant: isValidMerchant, // ✅ Mark if this is a real merchant
        isDynamicAmount: qrData.dynamicAmount || false, // ✅ Track if this was a dynamic amount transaction
        
        // ✅ NEW: Guest merchant tracking for dashboard queries
        ...(isValidMerchant ? {} : {
          guestMerchantInfo: {
            originalMerchantId: merchantId,
            businessName: businessName,
            businessShortCode: businessShortCode,
            isGuestTransaction: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          }
        }),
        
        // ✅ NEW: Enhanced merchant info for valid merchants
        ...(isValidMerchant && merchantData ? {
          merchantInfo: {
            name: merchantData.name,
            email: merchantData.email,
            phone: merchantData.phone
          }
        } : {}),

        // Additional metadata
        customerInfo: {
          phoneNumber: formattedPhone,
          initiatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      };

      const transactionRef = await db.collection('transactions').add(transactionData);
      
      console.log(`✅ ENHANCED: Customer transaction ${transactionRef.id} created`);
      console.log('🔍 Merchant linking:', {
        merchantId,
        isValidMerchant,
        businessName,
        isDynamicAmount: qrData.dynamicAmount || false,
        checkoutRequestID: response.data.CheckoutRequestID
      });

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
          transactionRef: transactionData.transactionRef,
          // ✅ NEW: Include merchant validation info for frontend
          merchantValidation: {
            isValidMerchant,
            merchantId: isValidMerchant ? merchantId : null,
            businessName
          }
        }
      });
    } else {
      // Handle M-Pesa API errors
      console.error('💥 M-Pesa API error:', response.data);
      
      // Still store failed transaction for tracking
      const failedTransactionData = {
        merchantId: isValidMerchant ? merchantId : null,
        amount: parsedAmount,
        phoneNumber: formattedPhone,
        status: 'failed',
        error: response.data.ResponseDescription || 'M-Pesa API error',
        qrData: qrData,
        businessName: businessName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentType: 'customer_initiated',
        source: 'qr_scanner',
        isValidMerchant: isValidMerchant,
        isDynamicAmount: qrData.dynamicAmount || false,
        mpesaResponse: response.data,
        ...(isValidMerchant ? {} : {
          guestMerchantInfo: {
            originalMerchantId: merchantId,
            businessName: businessName,
            isGuestTransaction: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          }
        })
      };
      
      await db.collection('transactions').add(failedTransactionData);
      console.log('⚠️ Failed transaction stored');
      
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

// ✅ ENHANCED: Callback handler with better transaction linking and status updates
async function handleCallback(req, res) {
  try {
    const callbackData = req.body;
    console.log('📞 M-Pesa Callback received:', JSON.stringify(callbackData, null, 2));

    if (callbackData.Body && callbackData.Body.stkCallback) {
      const stkCallback = callbackData.Body.stkCallback;
      const checkoutRequestID = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      
      let status;
      if (resultCode === 0) {
        status = 'success';
      } else if (resultCode === 1032) {
        status = 'cancelled';
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

      // Find the transaction using enhanced search
      const transactionDoc = await getTransactionByCheckoutRequestID(checkoutRequestID);

      if (transactionDoc) {
        console.log(`✅ Found transaction ${transactionDoc.id} for callback update`);
        console.log(`🏪 Transaction belongs to merchant: ${transactionDoc.data.merchantId || 'Guest'}`);
        
        const updateData = {
          status,
          resultCode,
          resultDescription: resultDesc,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          callbackData: stkCallback,
          callbackMetadata,
          callbackReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
          // ✅ NEW: Enhanced callback processing
          callbackProcessed: true,
          lastCallbackAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add payment details if successful
        if (resultCode === 0 && callbackMetadata.Amount) {
          updateData.paymentDetails = {
            amount: parseFloat(callbackMetadata.Amount),
            mpesaReceiptNumber: callbackMetadata.MpesaReceiptNumber,
            transactionDate: callbackMetadata.TransactionDate,
            phoneNumber: callbackMetadata.PhoneNumber,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          updateData['mpesaResponse.CustomerMessage'] = `Payment of KSH ${callbackMetadata.Amount} received from ${callbackMetadata.PhoneNumber}. Receipt: ${callbackMetadata.MpesaReceiptNumber}`;
        }

        // Update the transaction
        await transactionDoc.ref.update(updateData);
        console.log(`✅ Transaction ${transactionDoc.id} updated with status: ${status}`);
        
        // Log result with merchant info
        const merchantInfo = transactionDoc.data.merchantId ? 
          `for merchant ${transactionDoc.data.merchantId}` : 
          `for guest merchant ${transactionDoc.data.guestMerchantInfo?.businessName || 'Unknown'}`;
        
        if (status === 'success') {
          console.log(`💰 Payment successful: KSH ${callbackMetadata.Amount} from ${callbackMetadata.PhoneNumber} ${merchantInfo}`);
        } else {
          console.log(`❌ Payment ${status}: ${resultDesc} ${merchantInfo}`);
        }
      } else {
        console.log(`❌ No transaction found for CheckoutRequestID: ${checkoutRequestID}`);
        // ✅ ENHANCED: Store orphaned callbacks for debugging
        await db.collection('orphaned_callbacks').add({
          checkoutRequestID,
          callbackData,
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
          reason: 'transaction_not_found'
        });
      }
    }

    // Always acknowledge receipt
    res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Callback received successfully" 
    });

  } catch (error) {
    console.error('💥 Callback processing error:', error);
    res.status(500).json({ error: 'Failed to process callback' });
  }
}

// Merchant STK Push (existing functionality)
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

    // Enhanced transaction storage with consistent field naming
    const transactionData = {
      merchantId,
      phoneNumber,
      amount: parsedAmount,
      status: 'pending',
      transactionRef,
      description: description || 'QR Payment',
      MerchantRequestID: response.data.MerchantRequestID,
      CheckoutRequestID: response.data.CheckoutRequestID,
      CustomerMessage: response.data.CustomerMessage,
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
      paymentType: 'merchant_initiated',
      source: 'merchant_dashboard',
      isValidMerchant: true,
      isDynamicAmount: false
    };

    const docRef = await db.collection('transactions').add(transactionData);

    console.log(`✅ Transaction ${docRef.id} created successfully`);
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
    console.error('💥 STK Push error:', error);
    
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

// Debug endpoint for testing transaction creation
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
      merchantId: merchantId,
      amount: parseFloat(amount),
      phoneNumber: phoneNumber,
      status: 'pending',
      CheckoutRequestID: `TEST_${Date.now()}`,
      MerchantRequestID: `MR_${Date.now()}`,
      transactionRef: `TEST_${Date.now()}`,
      source: 'test_endpoint',
      paymentType: 'test',
      isValidMerchant: true,
      isDynamicAmount: false,
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

// ✅ UPDATED: Generate QR code for merchant with support for dynamic amounts
async function generateMerchantQR(req, res) {
  try {
    const merchantId = req.user.uid;
    const { description, reference, businessName, dynamicAmount = true } = req.body;

    // Get merchant info
    let merchantData = null;
    try {
      const merchantDoc = await db.collection('merchants').doc(merchantId).get();
      if (merchantDoc.exists) {
        merchantData = merchantDoc.data();
      } else {
        // Fallback to user auth data
        const userRecord = await admin.auth().getUser(merchantId);
        merchantData = {
          name: userRecord.displayName || userRecord.email?.split('@')[0],
          email: userRecord.email,
          phone: userRecord.phoneNumber
        };
      }
    } catch (error) {
      console.log('Could not fetch merchant data:', error.message);
    }

    const qrData = {
      merchantId: merchantId,
      businessName: businessName || merchantData?.name || 'Merchant Store',
      businessShortCode: process.env.MPESA_SHORTCODE,
      description: description || 'Payment',
      reference: reference || `QR_${Date.now()}`,
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'merchant_payment',
      dynamicAmount: dynamicAmount // New field indicating customer should enter amount
    };

    console.log('✅ Dynamic QR Code generated for merchant:', merchantId);

    res.status(200).json({
  success: true,
  message: 'QR Code generated successfully',
  data: {
    qrData: JSON.stringify(qrData), // <-- FIXED: now a string
    merchantId: merchantId,
    businessName: qrData.businessName,
    dynamicAmount: dynamicAmount
  }
});

  } catch (error) {
    console.error('💥 QR generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code',
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
  generateMerchantQR,
  
  // Debug function
  createTestTransaction
};

// Log successful module load
console.log('✅ daraja.js module loaded successfully with all fixes applied');
console.log('🔧 Fixed issues:');
console.log('   - Enhanced customer payment merchant linking');
console.log('   - Added support for dynamic amount QR codes');
console.log('   - Improved callback transaction lookup and updates');
console.log('   - Better transaction categorization and metadata');
console.log('   - Comprehensive merchant validation');
console.log('   - Enhanced error handling and logging');