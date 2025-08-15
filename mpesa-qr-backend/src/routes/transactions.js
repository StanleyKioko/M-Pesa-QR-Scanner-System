const express = require("express");
const { verifyToken } = require("../middlewares/auth");
const { 
  createTransaction, 
  getTransactions, 
  getTransactionById, 
  getTransactionAnalytics 
} = require("../controllers/transactions");

const router = express.Router();

router.post("/", verifyToken, createTransaction);
router.get("/", verifyToken, getTransactions);
router.get("/analytics", verifyToken, getTransactionAnalytics); // NEW: Analytics endpoint
router.get("/:transactionId", verifyToken, getTransactionById);

module.exports = router;