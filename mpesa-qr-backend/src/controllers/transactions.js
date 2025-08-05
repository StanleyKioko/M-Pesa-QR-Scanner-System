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

// Get single transaction by ID
async function getTransactionById(req, res) {
  const { transactionId } = req.params;
  const merchantId = req.user.uid;

  try {
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = transactionDoc.data();

    // Verify the transaction belongs to the merchant
    if (transaction.merchantId !== merchantId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.status(200).json({ 
      status: "success", 
      transaction: {
        id: transactionDoc.id,
        ...transaction
      }
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to retrieve transaction: ${error.message}` });
  }
}

// Get transaction by CheckoutRequestID (for callback updates)
async function getTransactionByCheckoutRequestID(checkoutRequestID) {
  try {
    const snapshot = await db.collection('transactions')
      .where('mpesaResponse.CheckoutRequestID', '==', checkoutRequestID)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ref: doc.ref,
        data: doc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error finding transaction by CheckoutRequestID:', error);
    return null;
  }
}

module.exports = { 
  createTransaction, 
  getTransactions, 
  getTransactionById,
  getTransactionByCheckoutRequestID 
};