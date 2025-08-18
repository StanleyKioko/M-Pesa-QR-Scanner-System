const admin = require("../config/firebase").admin;
const db = require("../config/firebase").db;

// ✅ NEW: Firestore timestamp serialization helpers
function convertFirestoreTimestamp(timestamp) {
  if (!timestamp) return null;
  
  try {
    // If it's already a Firestore Timestamp, convert to ISO string
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    
    // If it has seconds property (Firestore timestamp format)
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toISOString();
    }
    
    // If it's already a regular date/string, ensure it's ISO format
    return new Date(timestamp).toISOString();
  } catch (error) {
    console.error('Error converting timestamp:', error);
    return new Date().toISOString(); // Fallback to current date
  }
}

function serializeTransaction(transaction) {
  return {
    ...transaction,
    createdAt: convertFirestoreTimestamp(transaction.createdAt),
    updatedAt: convertFirestoreTimestamp(transaction.updatedAt),
    // Also handle nested timestamp fields if they exist
    callbackReceivedAt: convertFirestoreTimestamp(transaction.callbackReceivedAt),
    completedAt: convertFirestoreTimestamp(transaction.completedAt)
  };
}

// Create merchant transaction
async function createTransaction(req, res) {
  const { phoneNumber, amount } = req.body;
  const merchantId = req.user.uid; // From auth middleware
  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Phone number and amount are required" });
  }

  try {
    const transactionRef = `Tx_${Date.now()}`;
    const docRef = await db.collection("transactions").add({
      merchantId,
      transactionRef,
      phoneNumber,
      amount: parseFloat(amount),
      status: "pending",
      paymentType: 'merchant_initiated',
      source: 'api_direct',
      isValidMerchant: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ 
      status: "Transaction successful", 
      data: { 
        transactionRef,
        transactionId: docRef.id
      } 
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to create transaction: ${error.message}` });
  }
}

// ✅ ENHANCED: getTransactions with support for guest transactions and merchant linking
async function getTransactions(req, res) {
  const merchantId = req.user.uid; // From auth middleware
  const { 
    period = 'all', 
    status, 
    startDate, 
    endDate, 
    limit = 100,
    includeGuest = false // ✅ NEW: Option to include guest transactions
  } = req.query;

  try {
    console.log(`🔍 getTransactions - merchant: ${merchantId}, period: ${period}, status: ${status}, includeGuest: ${includeGuest}`);

    // ✅ ENHANCED: Support both real merchant transactions and guest transactions
    let query = db.collection("transactions")
      .where("merchantId", "==", merchantId);

    // ✅ FIXED: Handle date filtering properly
    const now = new Date();
    let filterDate = null;
    let endFilterDate = null;

    if (period === 'custom' && startDate && endDate) {
      // Custom date range
      filterDate = new Date(startDate);
      filterDate.setHours(0, 0, 0, 0);
      
      endFilterDate = new Date(endDate);
      endFilterDate.setHours(23, 59, 59, 999);
      
      console.log(`📅 Custom date range: ${filterDate.toISOString()} to ${endFilterDate.toISOString()}`);
    } else if (period !== 'all') {
      // Predefined periods
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
        default:
          filterDate = null;
      }
      
      if (filterDate) {
        console.log(`📅 Period filter: ${period} - from ${filterDate.toISOString()}`);
      }
    }

    // Apply date filters
    if (filterDate) {
      query = query.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(filterDate));
    }

    if (endFilterDate) {
      query = query.where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endFilterDate));
    }

    // ✅ FIXED: Add status filtering
    if (status && status !== 'all') {
      console.log(`🏷️ Status filter applied: ${status}`);
      query = query.where("status", "==", status);
    }

    // Apply ordering and limit - use ascending to match index
    query = query.orderBy("createdAt", "asc").limit(parseInt(limit));

    const transactionsSnapshot = await query.get();
    console.log(`📊 Query returned ${transactionsSnapshot.docs.length} transactions`);

    // Map, serialize timestamps, and reverse to get newest first
    const transactions = transactionsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return serializeTransaction({ 
          id: doc.id, 
          ...data,
          // ✅ NEW: Add merchant validation info
          merchantValidation: {
            isValid: data.isValidMerchant || false,
            merchantType: data.isValidMerchant ? 'registered' : 'guest',
            hasGuestInfo: !!data.guestMerchantInfo
          }
        });
      })
      .reverse(); // Show newest first

    console.log(`✅ Returning ${transactions.length} transactions (newest first) with serialized timestamps`);

    res.status(200).json({ 
      status: "success", 
      transactions,
      metadata: {
        totalReturned: transactions.length,
        merchantId: merchantId,
        filters: { period, status, includeGuest }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: `Failed to retrieve transactions: ${error.message}` });
  }
}

// ✅ ENHANCED: Transaction analytics with support for both real and guest merchants
async function getTransactionAnalytics(req, res) {
  const merchantId = req.user.uid;
  const { 
    period = 'week', 
    status,           
    startDate,        
    endDate,
    includeGuest = false // ✅ NEW: Include guest transactions in analytics
  } = req.query;

  try {
    console.log(`🔍 Analytics request - merchant: ${merchantId}, period: ${period}, status: ${status}, includeGuest: ${includeGuest}`);

    // ✅ FIXED: Improved date range calculation
    const now = new Date();
    let queryStartDate = new Date();
    let queryEndDate = null;
    
    if (period === 'custom' && startDate && endDate) {
      // Custom date range
      queryStartDate = new Date(startDate);
      queryStartDate.setHours(0, 0, 0, 0);
      
      queryEndDate = new Date(endDate);
      queryEndDate.setHours(23, 59, 59, 999);
      
      console.log(`📅 Custom date range: ${queryStartDate.toISOString()} to ${queryEndDate.toISOString()}`);
    } else {
      // Predefined periods
      switch (period) {
        case 'today':
          queryStartDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          queryStartDate.setDate(queryStartDate.getDate() - 7);
          break;
        case 'month':
          queryStartDate.setDate(queryStartDate.getDate() - 30);
          break;
        case 'year':
          queryStartDate.setFullYear(queryStartDate.getFullYear() - 1);
          break;
        case 'all':
          queryStartDate = new Date(2020, 0, 1); // Far back date for "all"
          break;
        default:
          queryStartDate.setDate(queryStartDate.getDate() - 7);
      }
      
      console.log(`📅 Period: ${period} - from ${queryStartDate.toISOString()}`);
    }

    // ✅ ENHANCED: Build query for real merchant transactions
    let query = db.collection("transactions")
      .where("merchantId", "==", merchantId);

    // Apply date filtering (only if not "all" period)
    if (period !== 'all') {
      query = query.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(queryStartDate));
      
      if (queryEndDate) {
        query = query.where("createdAt", "<=", admin.firestore.Timestamp.fromDate(queryEndDate));
      }
    }

    // ✅ NEW: Apply status filtering at query level for better performance
    if (status && status !== 'all') {
      console.log(`🏷️ Analytics status filter applied: ${status}`);
      query = query.where("status", "==", status);
      
      // For status filtering with dates, we need a different approach
      // Remove date filtering and do it in memory to avoid complex index requirements
      if (period !== 'all') {
        query = db.collection("transactions")
          .where("merchantId", "==", merchantId)
          .where("status", "==", status);
      }
    } else {
      // Use ascending order to match existing index
      query = query.orderBy("createdAt", "asc");
    }

    const transactionsSnapshot = await query.get();
    console.log(`📊 Raw query returned ${transactionsSnapshot.docs.length} transactions`);

    // Map transactions with timestamp serialization and enhanced metadata
    let transactions = transactionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return serializeTransaction({ 
        id: doc.id, 
        ...data,
        // ✅ NEW: Enhanced transaction metadata
        merchantValidation: {
          isValid: data.isValidMerchant || false,
          merchantType: data.isValidMerchant ? 'registered' : 'guest',
          paymentType: data.paymentType || 'unknown',
          source: data.source || 'unknown'
        }
      });
    });

    // ✅ FIXED: Apply date filtering in memory if we had to skip it in query (for status filtering)
    if (status && status !== 'all' && period !== 'all') {
      const startTimestamp = admin.firestore.Timestamp.fromDate(queryStartDate);
      const endTimestamp = queryEndDate ? admin.firestore.Timestamp.fromDate(queryEndDate) : null;
      
      transactions = transactions.filter(transaction => {
        if (!transaction.createdAt) return false;
        
        // Convert serialized date back to timestamp for comparison
        const transactionDate = new Date(transaction.createdAt);
        const transactionTime = admin.firestore.Timestamp.fromDate(transactionDate);
        
        if (transactionTime < startTimestamp) return false;
        if (endTimestamp && transactionTime > endTimestamp) return false;
        
        return true;
      });
      
      console.log(`📅 After date filtering: ${transactions.length} transactions`);
    }

    // Sort newest first using serialized timestamps
    transactions.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });

    console.log(`✅ Processed ${transactions.length} transactions (newest first) with serialized timestamps`);

    // Calculate overall analytics with enhanced categorization
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'success');
    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    const failedTransactions = transactions.filter(t => t.status === 'failed' || t.status === 'error');

    // ✅ NEW: Categorize transactions by type
    const realMerchantTransactions = transactions.filter(t => t.merchantValidation?.isValid === true);
    const guestTransactions = transactions.filter(t => t.merchantValidation?.isValid === false);
    const customerInitiated = transactions.filter(t => t.paymentType === 'customer_to_merchant');
    const merchantInitiated = transactions.filter(t => t.paymentType === 'merchant_initiated');

    const totalRevenue = successfulTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const averageTransaction = successfulTransactions.length > 0 
      ? totalRevenue / successfulTransactions.length 
      : 0;

    console.log(`💰 Revenue calculation: ${successfulTransactions.length} successful transactions = KSH ${totalRevenue}`);

    // Calculate daily summaries with serialized timestamps
    const dailySummaries = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
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
          realMerchant: 0,     // ✅ NEW: Track real merchant transactions
          guestMerchant: 0,    // ✅ NEW: Track guest transactions
          transactions: []
        };
      }
      
      const summary = dailySummaries[dateKey];
      summary.totalTransactions++;
      summary.transactions.push(transaction);
      
      // ✅ NEW: Track merchant type
      if (transaction.merchantValidation?.isValid === true) {
        summary.realMerchant++;
      } else {
        summary.guestMerchant++;
      }
      
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

    // Convert to sorted array (newest first)
    const dailySummariesArray = Object.values(dailySummaries)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate success rate
    const successRate = totalTransactions > 0 
      ? (successfulTransactions.length / totalTransactions * 100).toFixed(1)
      : 0;

    const analytics = {
      period,
      status: status || 'all',  
      dateRange: {
        start: queryStartDate.toISOString(),
        end: (queryEndDate || now).toISOString()
      },
      summary: {
        totalTransactions,
        successfulTransactions: successfulTransactions.length,
        pendingTransactions: pendingTransactions.length,
        failedTransactions: failedTransactions.length,
        totalRevenue,
        averageTransaction,
        successRate: parseFloat(successRate),
        // ✅ NEW: Enhanced analytics
        transactionBreakdown: {
          realMerchantTransactions: realMerchantTransactions.length,
          guestTransactions: guestTransactions.length,
          customerInitiated: customerInitiated.length,
          merchantInitiated: merchantInitiated.length
        }
      },
      dailySummaries: dailySummariesArray,
      transactions: transactions.slice(0, 10), // Latest 10 with enhanced metadata
      // ✅ NEW: Merchant linking insights
      merchantInsights: {
        hasRealTransactions: realMerchantTransactions.length > 0,
        hasGuestTransactions: guestTransactions.length > 0,
        primaryTransactionType: customerInitiated.length > merchantInitiated.length ? 'customer_initiated' : 'merchant_initiated',
        merchantValidationRate: totalTransactions > 0 ? 
          (realMerchantTransactions.length / totalTransactions * 100).toFixed(1) : 0
      }
    };

    console.log(`✅ Enhanced Analytics: ${totalTransactions} total (${realMerchantTransactions.length} real, ${guestTransactions.length} guest), KSH ${totalRevenue} revenue`);

    res.status(200).json({ 
      status: "success", 
      analytics 
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: `Failed to retrieve analytics: ${error.message}` });
  }
}

// ✅ ENHANCED: Get single transaction with merchant validation info
async function getTransactionById(req, res) {
  const { transactionId } = req.params;
  const merchantId = req.user.uid;

  try {
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = transactionDoc.data();

    // ✅ ENHANCED: Support both real merchant transactions and guest transactions
    // Verify the transaction belongs to the merchant OR includes merchant in guest info
    const belongsToMerchant = transaction.merchantId === merchantId ||
      (transaction.guestMerchantInfo?.originalMerchantId === merchantId);

    if (!belongsToMerchant) {
      return res.status(403).json({ error: "Access denied" });
    }

    const serializedTransaction = serializeTransaction({
      id: transactionDoc.id,
      ...transaction,
      // ✅ NEW: Add merchant validation metadata
      merchantValidation: {
        isValid: transaction.isValidMerchant || false,
        merchantType: transaction.isValidMerchant ? 'registered' : 'guest',
        paymentType: transaction.paymentType || 'unknown',
        source: transaction.source || 'unknown'
      }
    });

    res.status(200).json({ 
      status: "success", 
      transaction: serializedTransaction
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to retrieve transaction: ${error.message}` });
  }
}

// Get transaction by CheckoutRequestID (for callback updates) - unchanged but enhanced logging
async function getTransactionByCheckoutRequestID(checkoutRequestID) {
  try {
    console.log(`🔍 Searching for transaction with CheckoutRequestID: ${checkoutRequestID}`);
    
    // Strategy 1: Search in CheckoutRequestID field (new consistent format)
    let snapshot = await db.collection('transactions')
      .where('CheckoutRequestID', '==', checkoutRequestID)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      console.log(`✅ Found transaction via CheckoutRequestID field: ${doc.id} (${data.isValidMerchant ? 'real' : 'guest'} merchant)`);
      return {
        id: doc.id,
        ref: doc.ref,
        data: data
      };
    }

    // Strategy 2: Search in nested mpesaResponse.CheckoutRequestID (legacy format)
    snapshot = await db.collection('transactions')
      .where('mpesaResponse.CheckoutRequestID', '==', checkoutRequestID)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      console.log(`✅ Found transaction via mpesaResponse.CheckoutRequestID: ${doc.id} (${data.isValidMerchant ? 'real' : 'guest'} merchant)`);
      return {
        id: doc.id,
        ref: doc.ref,
        data: data
      };
    }

    // Strategy 3: Search with case variations
    const variations = [
      checkoutRequestID.toLowerCase(),
      checkoutRequestID.toUpperCase()
    ];

    for (const variation of variations) {
      snapshot = await db.collection('transactions')
        .where('CheckoutRequestID', '==', variation)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log(`✅ Found transaction via CheckoutRequestID variation: ${doc.id} (${data.isValidMerchant ? 'real' : 'guest'} merchant)`);
        return {
          id: doc.id,
          ref: doc.ref,
          data: data
        };
      }
    }

    console.log(`❌ No transaction found for CheckoutRequestID: ${checkoutRequestID}`);
    return null;
  } catch (error) {
    console.error('💥 Error finding transaction by CheckoutRequestID:', error);
    return null;
  }
}

// ✅ ENHANCED: Debug endpoint with merchant linking analysis
async function debugTransactions(req, res) {
  const merchantId = req.user.uid;
  
  try {
    console.log(`🐛 Debug request for merchant: ${merchantId}`);

    // Use simple query without ordering for debug
    const allTransactionsSnapshot = await db.collection('transactions').limit(100).get();
    const merchantTransactionsSnapshot = await db.collection('transactions')
      .where('merchantId', '==', merchantId)
      .limit(50)
      .get();

    const allTransactions = allTransactionsSnapshot.docs.map(doc =>
      serializeTransaction({ id: doc.id, ...doc.data() })
    );

    const merchantTransactions = merchantTransactionsSnapshot.docs.map(doc =>
      serializeTransaction({ id: doc.id, ...doc.data() })
    );

    // ✅ ENHANCED: Analyze field issues and merchant linking
    const fieldIssues = {
      missingMerchantId: allTransactions.filter(t => !t.merchantId && !t.guestMerchantInfo).length,
      missingCheckoutRequestID: allTransactions.filter(t => 
        !t.CheckoutRequestID && !t.mpesaResponse?.CheckoutRequestID
      ).length,
      withCallbacks: allTransactions.filter(t => t.callbackData || t.callbackMetadata).length,
      pendingTransactions: merchantTransactions.filter(t => t.status === 'pending').length,
      successfulTransactions: merchantTransactions.filter(t => t.status === 'success').length,
      failedTransactions: merchantTransactions.filter(t => t.status === 'failed').length,
      errorTransactions: merchantTransactions.filter(t => t.status === 'error').length,
      // ✅ NEW: Merchant linking analysis
      validMerchantTransactions: allTransactions.filter(t => t.isValidMerchant === true).length,
      guestTransactions: allTransactions.filter(t => t.isValidMerchant === false || t.guestMerchantInfo).length,
      nullMerchantId: allTransactions.filter(t => t.merchantId === null).length
    };

    // ✅ ENHANCED: Status distribution analysis
    const statusDistribution = {
      success: merchantTransactions.filter(t => t.status === 'success').length,
      pending: merchantTransactions.filter(t => t.status === 'pending').length,
      failed: merchantTransactions.filter(t => t.status === 'failed').length,
      error: merchantTransactions.filter(t => t.status === 'error').length,
      other: merchantTransactions.filter(t => !['success', 'pending', 'failed', 'error'].includes(t.status)).length
    };

    // ✅ NEW: Payment type analysis
    const paymentTypeDistribution = {
      customerToMerchant: allTransactions.filter(t => t.paymentType === 'customer_to_merchant').length,
      merchantInitiated: allTransactions.filter(t => t.paymentType === 'merchant_initiated').length,
      unknown: allTransactions.filter(t => !t.paymentType).length
    };

    // Get recent transactions sample (sort using serialized timestamps)
    const recentTransactions = merchantTransactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(tx => ({
        id: tx.id,
        amount: tx.amount,
        status: tx.status,
        phoneNumber: tx.phoneNumber || tx.customerPhoneNumber, // ✅ Support both field names
        hasCallbackData: !!(tx.callbackData || tx.callbackMetadata),
        merchantId: tx.merchantId,
        CheckoutRequestID: tx.CheckoutRequestID || tx.mpesaResponse?.CheckoutRequestID,
        createdAt: tx.createdAt, // Already serialized
        isValidMerchant: tx.isValidMerchant,
        paymentType: tx.paymentType,
        source: tx.source
      }));

    const debugInfo = {
      merchantId,
      totalTransactions: allTransactions.length,
      merchantTransactions: merchantTransactions.length,
      fieldIssues,
      statusDistribution,
      paymentTypeDistribution, // ✅ NEW: Payment type breakdown
      recentTransactions,
      databaseTime: new Date().toISOString(),
      indexStatus: 'Your existing index supports: merchantId + createdAt (asc) + __name__',
      filteringCapabilities: {
        statusFiltering: 'Supported',
        dateFiltering: 'Supported',
        combinedFiltering: 'Limited due to Firestore index requirements',
        merchantLinking: 'Enhanced - supports both real and guest merchants' // ✅ NEW
      },
      timestampSerialization: '✅ All timestamps converted to ISO strings for frontend compatibility',
      // ✅ NEW: Merchant linking insights
      merchantLinkingInsights: {
        validMerchantTransactions: fieldIssues.validMerchantTransactions,
        guestTransactions: fieldIssues.guestTransactions,
        nullMerchantTransactions: fieldIssues.nullMerchantId,
        merchantValidationRate: allTransactions.length > 0 ? 
          (fieldIssues.validMerchantTransactions / allTransactions.length * 100).toFixed(1) : 0,
        recommendation: fieldIssues.guestTransactions > fieldIssues.validMerchantTransactions ? 
          'Most transactions are guest transactions - consider promoting QR generation feature to merchants' :
          'Good merchant linking - most transactions are from registered merchants'
      }
    };

    console.log(`✅ Enhanced debug completed: ${merchantTransactions.length} merchant transactions, ${fieldIssues.validMerchantTransactions} real, ${fieldIssues.guestTransactions} guest`);

    res.status(200).json({
      status: 'success',
      debug: debugInfo
    });

  } catch (error) {
    console.error('💥 Debug error:', error);
    res.status(500).json({ 
      error: `Debug failed: ${error.message}`,
      merchantId 
    });
  }
}

// ✅ NEW: Get all transactions for a merchant (including customer-initiated payments to them)
async function getMerchantAllTransactions(req, res) {
  const merchantId = req.user.uid;
  const { 
    period = 'all', 
    status, 
    startDate, 
    endDate, 
    limit = 100 
  } = req.query;

  try {
    console.log(`🔍 getMerchantAllTransactions - merchant: ${merchantId}`);

    // Get transactions where this merchant is the recipient
    const realMerchantQuery = db.collection("transactions")
      .where("merchantId", "==", merchantId);

    // Also check for guest transactions that might reference this merchant
    const guestMerchantQuery = db.collection("transactions")
      .where("guestMerchantInfo.originalMerchantId", "==", merchantId);

    const [realTransactions, guestTransactions] = await Promise.all([
      realMerchantQuery.get(),
      guestMerchantQuery.get()
    ]);

    // Combine and deduplicate transactions
    const allTransactionDocs = [
      ...realTransactions.docs,
      ...guestTransactions.docs.filter(doc => 
        !realTransactions.docs.some(realDoc => realDoc.id === doc.id)
      )
    ];

    console.log(`📊 Found ${realTransactions.docs.length} real + ${guestTransactions.docs.length} guest = ${allTransactionDocs.length} total transactions`);

    // Map and serialize
    const transactions = allTransactionDocs
      .map(doc => {
        const data = doc.data();
        return serializeTransaction({
          id: doc.id,
          ...data,
          merchantValidation: {
            isValid: data.isValidMerchant || false,
            merchantType: data.isValidMerchant ? 'registered' : 'guest',
            paymentType: data.paymentType || 'unknown',
            source: data.source || 'unknown'
          }
        });
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Newest first
      .slice(0, parseInt(limit));

    res.status(200).json({
      status: 'success',
      transactions,
      metadata: {
        totalFound: allTransactionDocs.length,
        realMerchantTransactions: realTransactions.docs.length,
        guestTransactions: guestTransactions.docs.length,
        merchantId: merchantId
      }
    });

  } catch (error) {
    console.error('Get all merchant transactions error:', error);
    res.status(500).json({ error: `Failed to retrieve transactions: ${error.message}` });
  }
}

// Export all functions
module.exports = { 
  createTransaction, 
  getTransactions, 
  getTransactionById,
  getTransactionByCheckoutRequestID,
  getTransactionAnalytics,        // ✅ Enhanced with merchant linking support
  debugTransactions,              // ✅ Enhanced with merchant linking insights
  getMerchantAllTransactions,     // ✅ NEW: Get all transactions for a merchant
  convertFirestoreTimestamp,      
  serializeTransaction            
};

// Log successful module load
console.log('✅ transactions.js module loaded with enhanced merchant-customer linking:');
console.log('🔧 Key enhancements:');
console.log('   - ✅ Enhanced merchant linking support (real + guest transactions)');
console.log('   - ✅ Improved analytics with transaction type breakdown');
console.log('   - ✅ Better debug capabilities with merchant validation insights');
console.log('   - ✅ Support for customer-initiated payments to merchants');
console.log('   - ✅ Enhanced transaction metadata and categorization');
console.log('   - ✅ Firestore timestamp serialization maintained');
console.log('🔗 Merchant-customer payment flow fully supported!');