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

// Enhanced getTransactions with filtering
async function getTransactions(req, res) {
  const merchantId = req.user.uid; // From auth middleware
  const { 
    period = 'all', 
    status, 
    startDate, 
    endDate, 
    limit = 100 
  } = req.query;

  try {
    let query = db.collection("transactions")
      .where("merchantId", "==", merchantId);

    // Add date filtering
    if (period !== 'all') {
      const now = new Date();
      let filterDate;
      
      switch (period) {
        case 'today':
          filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          if (startDate) {
            filterDate = new Date(startDate);
          }
          break;
        default:
          filterDate = null;
      }

      if (filterDate) {
        query = query.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(filterDate));
      }

      if (period === 'custom' && endDate) {
        const endFilterDate = new Date(endDate);
        endFilterDate.setHours(23, 59, 59, 999); // End of day
        query = query.where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endFilterDate));
      }
    }

    // Add status filtering
    if (status && status !== 'all') {
      query = query.where("status", "==", status);
    }

    // Apply ordering and limit
    query = query.orderBy("createdAt", "desc").limit(parseInt(limit));

    const transactionsSnapshot = await query.get();

    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ status: "success", transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: `Failed to retrieve transactions: ${error.message}` });
  }
}

// NEW: Get transaction analytics with daily summaries
async function getTransactionAnalytics(req, res) {
  const merchantId = req.user.uid;
  const { period = 'week' } = req.query;

  try {
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const transactionsSnapshot = await db.collection("transactions")
      .where("merchantId", "==", merchantId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startDate))
      .orderBy("createdAt", "desc")
      .get();

    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate overall analytics
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'success');
    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    const failedTransactions = transactions.filter(t => t.status === 'failed' || t.status === 'error');

    const totalRevenue = successfulTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const averageTransaction = totalTransactions > 0 
      ? totalRevenue / successfulTransactions.length 
      : 0;

    // Calculate daily summaries
    const dailySummaries = {};
    
    transactions.forEach(transaction => {
      const date = transaction.createdAt?.toDate 
        ? transaction.createdAt.toDate() 
        : new Date(transaction.createdAt?.seconds * 1000);
      
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!dailySummaries[dateKey]) {
        dailySummaries[dateKey] = {
          date: dateKey,
          dateFormatted: date.toLocaleDateString('en-KE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          totalTransactions: 0,
          successful: 0,
          pending: 0,
          failed: 0,
          totalRevenue: 0,
          transactions: []
        };
      }
      
      const summary = dailySummaries[dateKey];
      summary.totalTransactions++;
      summary.transactions.push(transaction);
      
      switch (transaction.status) {
        case 'success':
          summary.successful++;
          summary.totalRevenue += transaction.amount || 0;
          break;
        case 'pending':
          summary.pending++;
          break;
        case 'failed':
        case 'error':
          summary.failed++;
          break;
      }
    });

    // Convert to sorted array
    const dailySummariesArray = Object.values(dailySummaries)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate success rate
    const successRate = totalTransactions > 0 
      ? (successfulTransactions.length / totalTransactions * 100).toFixed(1)
      : 0;

    const analytics = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalTransactions,
        successfulTransactions: successfulTransactions.length,
        pendingTransactions: pendingTransactions.length,
        failedTransactions: failedTransactions.length,
        totalRevenue,
        averageTransaction,
        successRate: parseFloat(successRate)
      },
      dailySummaries: dailySummariesArray,
      recentTransactions: transactions.slice(0, 10) // Latest 10
    };

    res.status(200).json({ 
      status: "success", 
      analytics 
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: `Failed to retrieve analytics: ${error.message}` });
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
  getTransactionByCheckoutRequestID,
  getTransactionAnalytics  // NEW function added
};