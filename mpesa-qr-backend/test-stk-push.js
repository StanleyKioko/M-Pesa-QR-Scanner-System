const axios = require('axios');
require('dotenv').config();

async function generateAccessToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  try {
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` },
    });
    console.log('Access Token:', response.data.access_token);
    return response.data.access_token;
  } catch (error) {
    console.error('generateAccessToken error:', error.response?.data || error.message);
    throw error;
  }
}

async function testSTKPush() {
  try {
    const accessToken = await generateAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: '100',
        PartyA: '254708967800',
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: '254708967800',
        CallBackURL: `${process.env.SERVER_URL}/daraja/callback`,
        AccountReference: `QR_${timestamp}`,
        TransactionDesc: 'Payment via QR code',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('STK Push Response:', response.data);
  } catch (error) {
    console.error('testSTKPush error:', error.response?.data || error.message);
  }
}

testSTKPush();
