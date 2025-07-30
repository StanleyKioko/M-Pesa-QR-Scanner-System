const express = require("express");
const { triggerSTKPush, handleSTKCallback } = require("../controllers/daraja");
const { verifyToken } = require('../middlewares/auth');

const router = express.Router();

router.post("/scan-qr", verifyToken, triggerSTKPush);
router.post("/stk-callback", handleSTKCallback);

module.exports = router;