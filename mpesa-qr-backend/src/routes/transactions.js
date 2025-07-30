const express = require("express");
const { verifyToken } = require("../middlewares/auth");
const { createTransaction, getTransactions } = require("../controllers/transactions");

const router = express.Router();

router.post("/", verifyToken, createTransaction);
router.get("/", verifyToken, getTransactions);

module.exports = router;