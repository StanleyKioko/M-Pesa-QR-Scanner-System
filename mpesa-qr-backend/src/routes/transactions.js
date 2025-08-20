const express = require("express");
const { verifyToken } = require("../middlewares/auth");
const { 
  createTransaction, 
  getTransactions, 
  getTransactionById, 
  getTransactionAnalytics,
  debugTransactions,
  getMerchantAllTransactions // ✅ NEW: Import the new function
} = require("../controllers/transactions");

const router = express.Router();

router.post("/", verifyToken, createTransaction);
router.get("/", verifyToken, getTransactions);
router.get("/analytics", verifyToken, getTransactionAnalytics);
router.get("/debug", verifyToken, debugTransactions);

// ✅ NEW: Enhanced endpoint for getting all merchant transactions
router.get("/all", verifyToken, getMerchantAllTransactions);

router.get("/:transactionId", verifyToken, getTransactionById);

module.exports = router;