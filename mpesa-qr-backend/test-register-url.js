const axios = require('axios');
require('dotenv').config();

async function registerURL() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl',
      {
        ShortCode: process.env.MPESA_SHORTCODE,
        ResponseType: 'Completed',
        ConfirmationURL: `${process.env.SERVER_URL}/daraja/callback`,
        ValidationURL: `${process.env.SERVER_URL}/daraja/callback`,
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Register URL Response:', response.data);
  } catch (error) {
    console.error('Register URL Error:', error.response?.data || error.message);
  }
}

registerURL();
