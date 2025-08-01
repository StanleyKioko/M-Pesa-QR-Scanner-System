const express = require('express');
const router = express.Router();
const { triggerSTKPush } = require('../controllers/daraja');

// POST /daraja/stkpush
router.post('/stkpush', triggerSTKPush);

module.exports = router;