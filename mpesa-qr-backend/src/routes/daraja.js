const express = require('express');
const router = express.Router();
const { triggerSTKPush, handleCallback } = require('../controllers/daraja');

// POST /daraja/scan-qr (original endpoint)
router.post('/scan-qr', triggerSTKPush);

// POST /api/trigger-stk-push (frontend endpoint)
router.post('/trigger-stk-push', triggerSTKPush);

// POST /daraja/stk-callback
router.post('/stk-callback', (req, res, next) => {
    console.log('Callback route hit:', req.body);
    next();
}, handleCallback);

module.exports = router;