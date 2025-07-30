const admin = require("../config/firebase").admin;
const db = require("../config/firebase").db;

// Create merchant transaction
async function createTransaction(req, res) {
  const { phoneNumber, amount } = req.body;
  const merchantId = req.user.uid; // From auth middleware
  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Phone number and amount are required" });
  }

  try {
    const transactionRef = `Tx_${Date.now()}`;
    await db.collection("transactions").add({
      merchantId,
      transactionRef,
      phoneNumber,
      amount: parseFloat(amount),
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ status: "Transaction successful", data: { transactionRef } });
  } catch (error) {
    res.status(500).json({ error: `Failed to create transaction: ${error.message}` });
  }
}

async function getTransactions(req, res) {
  const merchantId = req.user.uid; // From auth middleware

  try {
    const transactionsSnapshot = await db.collection("transactions")
      .where("merchantId", "==", merchantId)
      .orderBy("createdAt", "desc")
      .get();

    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ status: "success", transactions });
  } catch (error) {
    res.status(500).json({ error: `Failed to retrieve transactions: ${error.message}` });
  }
}

module.exports = { createTransaction, getTransactions };