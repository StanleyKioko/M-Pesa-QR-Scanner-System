const express = require("express");
const { verifyToken } = require("../middlewares/auth");
const { 
  createTransaction, 
  getTransactions, 
  getTransactionById, 
  getTransactionAnalytics,
  debugTransactions  // NEW import
} = require("../controllers/transactions");

const router = express.Router();

router.post("/", verifyToken, createTransaction);
router.get("/", verifyToken, getTransactions);
router.get("/analytics", verifyToken, getTransactionAnalytics);
router.get("/debug", verifyToken, debugTransactions); // NEW: Debug endpoint
router.get("/:transactionId", verifyToken, getTransactionById);

module.exports = router;