const express = require("express");
const { triggerSTKPush, handleSTKCallback } = require("../controllers/daraja");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

router.post("/scan-qr", authenticate, triggerSTKPush);
router.post("/stk-callback", handleSTKCallback);

module.exports = router;