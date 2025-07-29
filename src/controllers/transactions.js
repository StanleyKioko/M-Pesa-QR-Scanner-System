const admin = require("../config/firebase").admin;
const db = require("../config/firebase").db;

// Get merchant transactions
async function getTransactions(req, res) {
  const merchantId = req.user.uid;

  try {
    const transactionsSnapshot = await db.collection("transactions")
      .where("merchantId", "==", merchantId)
      .orderBy("createdAt", "desc")
      .get();

    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ status: "success", data: transactions });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch transactions: ${error.message}` });
  }
}

module.exports = { getTransactions };