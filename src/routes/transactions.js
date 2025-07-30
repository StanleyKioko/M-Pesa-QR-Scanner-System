const express = require("express");
const { createTransaction, getTransactions } = require("../controllers/transactions");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

router.post("/", authenticate, createTransaction);
router.get("/", authenticate, getTransactions);

module.exports = router;