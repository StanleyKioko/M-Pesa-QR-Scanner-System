const express = require('express');
const router = express.Router();
const { triggerSTKPush, handleCallback } = require('../controllers/daraja');
const { verifyToken } = require('../middlewares/auth');

// POST /daraja/scan-qr (requires authentication)
router.post('/scan-qr', verifyToken, triggerSTKPush);

// POST /api/trigger-stk-push (requires authentication)
router.post('/trigger-stk-push', verifyToken, triggerSTKPush);

// POST /daraja/stk-callback (public endpoint for M-Pesa callbacks)
router.post('/stk-callback', (req, res, next) => {
    console.log('Callback route hit:', req.body);
    next();
}, handleCallback);

module.exports = router;