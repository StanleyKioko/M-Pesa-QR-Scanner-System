const express = require('express');
const router = express.Router();
const { 
  triggerSTKPush, 
  handleCallback, 
  triggerCustomerPayment,
  healthCheck,
  testMpesaConnection,
  testRegister,
  generateMerchantQR
} = require('../controllers/daraja');
const { verifyToken } = require('../middlewares/auth');

// Health and test endpoints
router.get('/health', healthCheck);
router.get('/test-token', testMpesaConnection);
router.post('/test-register', testRegister);

// POST /daraja/scan-qr (requires merchant authentication)
router.post('/scan-qr', verifyToken, triggerSTKPush);

// POST /daraja/customer-payment (PUBLIC - no authentication required for customers)
router.post('/customer-payment', triggerCustomerPayment);

// POST /api/trigger-stk-push (requires authentication)
router.post('/trigger-stk-push', verifyToken, triggerSTKPush);

// QR Generator endpoint
router.post("/generate-qr", verifyToken, generateMerchantQR);

// POST /daraja/stk-callback (public endpoint for M-Pesa callbacks)
router.post('/stk-callback', (req, res, next) => {
    console.log('Callback route hit:', req.body);
    next();
}, handleCallback);

module.exports = router;