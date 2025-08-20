const admin = require("../config/firebase").admin;
const db = require("../config/firebase").db;

// Firestore timestamp serialization helpers
function convertFirestoreTimestamp(timestamp) {
  if (!timestamp) return null;
  
  if (timestamp._seconds && timestamp._nanoseconds) {
    return new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
  }
  
  if (timestamp.seconds && timestamp.nanoseconds) {
    return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
  }
  
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  return null;
}

function serializeTransaction(transaction) {
  if (!transaction) return null;
  
  const serialized = { ...transaction };
  
  // Convert Firestore timestamps to ISO strings
  ['createdAt', 'updatedAt', 'callbackReceivedAt', 'lastCallbackAt'].forEach(field => {
    if (serialized[field]) {
      const converted = convertFirestoreTimestamp(serialized[field]);
      serialized[field] = converted ? converted.toISOString() : null;
    }
  });
  
  // Handle nested timestamp fields
  if (serialized.guestMerchantInfo?.createdAt) {
    const converted = convertFirestoreTimestamp(serialized.guestMerchantInfo.createdAt);
    serialized.guestMerchantInfo.createdAt = converted ? converted.toISOString() : null;
  }
  
  if (serialized.paymentDetails?.completedAt) {
    const converted = convertFirestoreTimestamp(serialized.paymentDetails.completedAt);
    serialized.paymentDetails.completedAt = converted ? converted.toISOString() : null;
  }
  
  return serialized;
}

// ✅ ENHANCED: Safe query executor with fallback for index issues
async function executeQueriesWithFallback(directQuery, guestQuery, period, filterDate, endFilterDate) {
  try {
    // Try to execute both queries with date filtering
    const [directSnapshot, guestSnapshot] = await Promise.all([
      directQuery.get(),
      guestQuery.get()
    ]);
    
    console.log(`✅ Successfully executed queries with date filtering`);
    return [directSnapshot, guestSnapshot];
    
  } catch (error) {
    console.log(`⚠️ Query with date filtering failed (likely missing index): ${error.message}`);
    
    // Fallback: Execute queries without date filtering and filter in memory
    console.log(`🔄 Falling back to queries without date filtering...`);
    
    try {
      // Remove date filtering from queries
      const directQuerySimple = db.collection("transactions")
        .where("merchantId", "==", directQuery._delegate._query.filters[0].value);
        
      const guestQuerySimple = db.collection("transactions")
        .where("guestMerchantInfo.originalMerchantId", "==", guestQuery._delegate._query.filters[0].value);
      
      const [directSnapshot, guestSnapshot] = await Promise.all([
        directQuerySimple.get(),
        guestQuerySimple.get()
      ]);
      
      console.log(`✅ Fallback queries executed successfully`);
      
      // Filter results in memory if date filtering was needed
      if (period !== 'all' && filterDate) {
        console.log(`🔍 Applying client-side date filtering for period: ${period}`);
        
        const filterDirectDocs = directSnapshot.docs.filter(doc => {
          const createdAt = convertFirestoreTimestamp(doc.data().createdAt);
          if (!createdAt) return false;
          
          if (endFilterDate) {
            return createdAt >= filterDate && createdAt <= endFilterDate;
          } else {
            return createdAt >= filterDate;
          }
        });
        
        const filterGuestDocs = guestSnapshot.docs.filter(doc => {
          const createdAt = convertFirestoreTimestamp(doc.data().createdAt);
          if (!createdAt) return false;
          
          if (endFilterDate) {
            return createdAt >= filterDate && createdAt <= endFilterDate;
          } else {
            return createdAt >= filterDate;
          }
        });
        
        console.log(`📊 Client-side filtering: ${filterDirectDocs.length} direct + ${filterGuestDocs.length} guest transactions`);
        
        // Create mock snapshots with filtered docs
        return [
          { docs: filterDirectDocs },
          { docs: filterGuestDocs }
        ];
      }
      
      return [directSnapshot, guestSnapshot];
      
    } catch (fallbackError) {
      console.error(`💥 Fallback query also failed:`, fallbackError);
      throw fallbackError;
    }
  }
}

// Create merchant transaction
async function createTransaction(req, res) {
  const { phoneNumber, amount } = req.body;
  const merchantId = req.user.uid;
  
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
    console.error('Create transaction error:', error);
    res.status(500).json({ error: `Failed to create transaction: ${error.message}` });
  }
}

// ✅ ENHANCED: getTransactions with index-safe querying
async function getTransactions(req, res) {
  const merchantId = req.user.uid;
  const { 
    period = 'all', 
    status, 
    startDate, 
    endDate, 
    limit = 100,
    includeGuest = true
  } = req.query;

  try {
    console.log(`🔍 getTransactions - merchant: ${merchantId}, period: ${period}, status: ${status}, includeGuest: ${includeGuest}`);

    // Calculate date range
    const now = new Date();
    let filterDate = null;
    let endFilterDate = null;

    if (period === 'custom' && startDate && endDate) {
      filterDate = new Date(startDate);
      filterDate.setHours(0, 0, 0, 0);
      
      endFilterDate = new Date(endDate);
      endFilterDate.setHours(23, 59, 59, 999);
    } else if (period !== 'all') {
      filterDate = new Date();
      switch (period) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          endFilterDate = new Date();
          endFilterDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
    }

    // Build queries with potential date filtering
    let directQuery = db.collection("transactions")
      .where("merchantId", "==", merchantId);
    
    let guestQuery = db.collection("transactions")
      .where("guestMerchantInfo.originalMerchantId", "==", merchantId);

    // Apply date filtering if needed
    if (filterDate && period !== 'all') {
      const startTimestamp = admin.firestore.Timestamp.fromDate(filterDate);
      directQuery = directQuery.where("createdAt", ">=", startTimestamp);
      guestQuery = guestQuery.where("createdAt", ">=", startTimestamp);
      
      if (endFilterDate) {
        const endTimestamp = admin.firestore.Timestamp.fromDate(endFilterDate);
        directQuery = directQuery.where("createdAt", "<=", endTimestamp);
        guestQuery = guestQuery.where("createdAt", "<=", endTimestamp);
      }
    }

    // Apply limit
    directQuery = directQuery.limit(parseInt(limit));
    guestQuery = guestQuery.limit(parseInt(limit));

    // Execute queries with fallback
    const [directSnapshot, guestSnapshot] = await executeQueriesWithFallback(
      directQuery, guestQuery, period, filterDate, endFilterDate
    );

    console.log(`📊 Found ${directSnapshot.docs.length} direct + ${guestSnapshot.docs.length} guest transactions`);

    // Combine and deduplicate
    const allTransactionDocs = [
      ...directSnapshot.docs,
      ...guestSnapshot.docs.filter(doc => 
        !directSnapshot.docs.some(directDoc => directDoc.id === doc.id)
      )
    ];

    // Map and serialize transactions
    let transactions = allTransactionDocs.map(doc => {
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
    });

    // Apply status filtering
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
    }

    // Sort by creation date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`✅ Returning ${transactions.length} transactions for merchant ${merchantId}`);

    res.status(200).json({
      status: 'success',
      transactions,
      metadata: {
        total: transactions.length,
        directTransactions: directSnapshot.docs.length,
        guestTransactions: guestSnapshot.docs.length,
        totalReturned: transactions.length,
        merchantId: merchantId,
        filters: { period, status, includeGuest },
        queryMethod: period === 'all' ? 'direct' : 'fallback-safe'
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: `Failed to retrieve transactions: ${error.message}` });
  }
}

// ✅ ENHANCED: Transaction analytics with index-safe querying
async function getTransactionAnalytics(req, res) {
  const merchantId = req.user.uid;
  const { 
    period = 'week', 
    status,           
    startDate,        
    endDate,
    includeGuest = true
  } = req.query;

  try {
    console.log(`🔍 Analytics request - merchant: ${merchantId}, period: ${period}, status: ${status}, includeGuest: ${includeGuest}`);

    // Calculate date range
    const now = new Date();
    let queryStartDate = new Date();
    let queryEndDate = null;
    
    if (period === 'custom' && startDate && endDate) {
      queryStartDate = new Date(startDate);
      queryStartDate.setHours(0, 0, 0, 0);
      
      queryEndDate = new Date(endDate);
      queryEndDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case 'today':
          queryStartDate.setHours(0, 0, 0, 0);
          queryEndDate = new Date();
          queryEndDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          queryStartDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          queryStartDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          queryStartDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'all':
        default:
          queryStartDate = new Date('2020-01-01');
          break;
      }
      console.log(`📅 Period: ${period} - from ${queryStartDate.toISOString()}`);
    }

    // Build queries
    let directMerchantQuery = db.collection("transactions")
      .where("merchantId", "==", merchantId);
    
    let guestTransactionQuery = db.collection("transactions")
      .where("guestMerchantInfo.originalMerchantId", "==", merchantId);

    // Apply date filtering if not "all" period
    if (period !== 'all') {
      const startTimestamp = admin.firestore.Timestamp.fromDate(queryStartDate);
      directMerchantQuery = directMerchantQuery.where("createdAt", ">=", startTimestamp);
      guestTransactionQuery = guestTransactionQuery.where("createdAt", ">=", startTimestamp);
      
      if (queryEndDate) {
        const endTimestamp = admin.firestore.Timestamp.fromDate(queryEndDate);
        directMerchantQuery = directMerchantQuery.where("createdAt", "<=", endTimestamp);
        guestTransactionQuery = guestTransactionQuery.where("createdAt", "<=", endTimestamp);
      }
    }

    // Execute queries with fallback
    const [directSnapshot, guestSnapshot] = await executeQueriesWithFallback(
      directMerchantQuery, guestTransactionQuery, period, queryStartDate, queryEndDate
    );

    console.log(`📊 Found ${directSnapshot.docs.length} direct merchant transactions`);
    console.log(`📊 Found ${guestSnapshot.docs.length} guest transactions`);

    // Combine and deduplicate transactions
    const allTransactionDocs = [
      ...directSnapshot.docs,
      ...guestSnapshot.docs.filter(doc => 
        !directSnapshot.docs.some(directDoc => directDoc.id === doc.id)
      )
    ];

    console.log(`📊 Total combined transactions: ${allTransactionDocs.length}`);

    // Map transactions with enhanced metadata
    let transactions = allTransactionDocs.map(doc => {
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
    });

    // Apply status filtering
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
      console.log(`🏷️ After status filtering (${status}): ${transactions.length} transactions`);
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate analytics
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'success');
    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    const failedTransactions = transactions.filter(t => ['failed', 'cancelled', 'error'].includes(t.status));
    
    const realMerchantTransactions = transactions.filter(t => t.merchantValidation?.isValid === true);
    const guestTransactions = transactions.filter(t => t.merchantValidation?.isValid === false);
    const customerInitiated = transactions.filter(t => t.paymentType === 'customer_initiated');
    const merchantInitiated = transactions.filter(t => t.paymentType === 'merchant_initiated');

    const totalRevenue = successfulTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const averageTransaction = successfulTransactions.length > 0 
      ? totalRevenue / successfulTransactions.length 
      : 0;

    console.log(`💰 Revenue calculation: ${successfulTransactions.length} successful transactions = KSH ${totalRevenue}`);

    // Calculate daily summaries
    const dailySummaries = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      const dateKey = date.toISOString().split('T')[0];
      
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
          realMerchant: 0,
          guestMerchant: 0,
          transactions: []
        };
      }
      
      const summary = dailySummaries[dateKey];
      summary.totalTransactions++;
      summary.transactions.push(transaction);
      
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
        case 'cancelled':
        case 'error':
          summary.failed++;
          break;
      }
    });

    const dailySummariesArray = Object.values(dailySummaries)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

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
        transactionBreakdown: {
          realMerchantTransactions: realMerchantTransactions.length,
          guestTransactions: guestTransactions.length,
          customerInitiated: customerInitiated.length,
          merchantInitiated: merchantInitiated.length
        }
      },
      dailySummaries: dailySummariesArray,
      transactions: transactions.slice(0, 50),
      merchantLinking: {
        directTransactions: directSnapshot.docs.length,
        guestTransactions: guestSnapshot.docs.length,
        totalLinked: allTransactionDocs.length,
        merchantId: merchantId,
        linkingHealth: ((realMerchantTransactions.length + guestTransactions.length) / Math.max(totalTransactions, 1) * 100).toFixed(1) + '%'
      }
    };

    console.log(`✅ Analytics completed: ${totalTransactions} total, ${successfulTransactions.length} successful, ${failedTransactions.length} failed`);

    res.status(200).json({
      status: 'success',
      analytics
    });
  } catch (error) {
    console.error('💥 Analytics error:', error);
    res.status(500).json({ error: `Failed to get analytics: ${error.message}` });
  }
}

// Get single transaction with merchant validation info
async function getTransactionById(req, res) {
  const { transactionId } = req.params;
  const merchantId = req.user.uid;

  try {
    const transactionDoc = await db.collection("transactions").doc(transactionId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = transactionDoc.data();

    // Support both real merchant transactions and guest transactions
    const belongsToMerchant = transaction.merchantId === merchantId ||
      (transaction.guestMerchantInfo?.originalMerchantId === merchantId);

    if (!belongsToMerchant) {
      return res.status(403).json({ error: "Access denied" });
    }

    const serializedTransaction = serializeTransaction({
      id: transactionDoc.id,
      ...transaction,
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

// Get transaction by CheckoutRequestID (for callback updates)
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

// Debug endpoint with merchant linking analysis
async function debugTransactions(req, res) {
  const merchantId = req.user.uid;
  
  try {
    console.log(`🐛 Debug request for merchant: ${merchantId}`);

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
      validMerchantTransactions: allTransactions.filter(t => t.isValidMerchant === true).length,
      guestTransactions: allTransactions.filter(t => t.isValidMerchant === false || t.guestMerchantInfo).length,
      nullMerchantId: allTransactions.filter(t => t.merchantId === null).length
    };

    const statusDistribution = {
      success: merchantTransactions.filter(t => t.status === 'success').length,
      pending: merchantTransactions.filter(t => t.status === 'pending').length,
      failed: merchantTransactions.filter(t => t.status === 'failed').length,
      error: merchantTransactions.filter(t => t.status === 'error').length,
      other: merchantTransactions.filter(t => !['success', 'pending', 'failed', 'error'].includes(t.status)).length
    };

    const paymentTypeDistribution = {
      customerToMerchant: allTransactions.filter(t => t.paymentType === 'customer_initiated').length,
      merchantInitiated: allTransactions.filter(t => t.paymentType === 'merchant_initiated').length,
      unknown: allTransactions.filter(t => !t.paymentType).length
    };

    const recentTransactions = merchantTransactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(tx => ({
        id: tx.id,
        amount: tx.amount,
        status: tx.status,
        phoneNumber: tx.phoneNumber || tx.customerPhoneNumber,
        hasCallbackData: !!(tx.callbackData || tx.callbackMetadata),
        merchantId: tx.merchantId,
        CheckoutRequestID: tx.CheckoutRequestID || tx.mpesaResponse?.CheckoutRequestID,
        createdAt: tx.createdAt,
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
      paymentTypeDistribution,
      recentTransactions,
      merchantLinking: {
        validMerchantTransactions: fieldIssues.validMerchantTransactions,
        guestTransactions: fieldIssues.guestTransactions,
        totalLinked: fieldIssues.validMerchantTransactions + fieldIssues.guestTransactions,
        linkingHealthPercentage: allTransactions.length > 0 ? 
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

// ✅ ENHANCED: Get all transactions for a merchant with index-safe querying
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

    // Calculate date range for filtering
    const now = new Date();
    let filterDate = null;
    let endFilterDate = null;

    if (period === 'custom' && startDate && endDate) {
      filterDate = new Date(startDate);
      filterDate.setHours(0, 0, 0, 0);
      
      endFilterDate = new Date(endDate);
      endFilterDate.setHours(23, 59, 59, 999);
    } else if (period !== 'all') {
      filterDate = new Date();
      switch (period) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          endFilterDate = new Date();
          endFilterDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
    }

    // Build queries
    let realMerchantQuery = db.collection("transactions")
      .where("merchantId", "==", merchantId);

    let guestMerchantQuery = db.collection("transactions")
      .where("guestMerchantInfo.originalMerchantId", "==", merchantId);

    // Apply date filtering if needed
    if (filterDate && period !== 'all') {
      const startTimestamp = admin.firestore.Timestamp.fromDate(filterDate);
      realMerchantQuery = realMerchantQuery.where("createdAt", ">=", startTimestamp);
      guestMerchantQuery = guestMerchantQuery.where("createdAt", ">=", startTimestamp);
      
      if (endFilterDate) {
        const endTimestamp = admin.firestore.Timestamp.fromDate(endFilterDate);
        realMerchantQuery = realMerchantQuery.where("createdAt", "<=", endTimestamp);
        guestMerchantQuery = guestMerchantQuery.where("createdAt", "<=", endTimestamp);
      }
    }

    // Apply limits
    realMerchantQuery = realMerchantQuery.limit(parseInt(limit));
    guestMerchantQuery = guestMerchantQuery.limit(parseInt(limit));

    // Execute queries with fallback
    const [realTransactions, guestTransactions] = await executeQueriesWithFallback(
      realMerchantQuery, guestMerchantQuery, period, filterDate, endFilterDate
    );

    // Combine and deduplicate transactions
    const allTransactionDocs = [
      ...realTransactions.docs,
      ...guestTransactions.docs.filter(doc => 
        !realTransactions.docs.some(realDoc => realDoc.id === doc.id)
      )
    ];

    console.log(`📊 Found ${realTransactions.docs.length} real + ${guestTransactions.docs.length} guest = ${allTransactionDocs.length} total transactions`);

    // Map and serialize transactions
    let transactions = allTransactionDocs.map(doc => {
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
    });

    // Apply status filtering
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
    }

    // Sort by creation date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate summary statistics
    const summary = {
      total: transactions.length,
      successful: transactions.filter(t => t.status === 'success').length,
      pending: transactions.filter(t => t.status === 'pending').length,
      failed: transactions.filter(t => ['failed', 'cancelled', 'error'].includes(t.status)).length,
      totalRevenue: transactions
        .filter(t => t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0),
      realMerchantTransactions: transactions.filter(t => t.merchantValidation?.isValid === true).length,
      guestTransactions: transactions.filter(t => t.merchantValidation?.isValid === false).length
    };

    console.log(`✅ Returning ${transactions.length} transactions for merchant ${merchantId}`);

    res.status(200).json({
      status: 'success',
      transactions,
      summary,
      metadata: {
        merchantId,
        filters: { period, status },
        totalReturned: transactions.length,
        directTransactions: realTransactions.docs.length,
        guestTransactions: guestTransactions.docs.length,
        queryTimestamp: new Date().toISOString(),
        queryMethod: period === 'all' ? 'direct' : 'fallback-safe'
      }
    });

  } catch (error) {
    console.error('💥 getMerchantAllTransactions error:', error);
    res.status(500).json({ 
      error: `Failed to get merchant transactions: ${error.message}`,
      merchantId 
    });
  }
}

// ✅ NEW: Update transaction status (for manual status updates)
async function updateTransactionStatus(req, res) {
  const { transactionId } = req.params;
  const { status, reason } = req.body;
  const merchantId = req.user.uid;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const validStatuses = ['pending', 'success', 'failed', 'cancelled', 'error'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const transactionRef = db.collection("transactions").doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = transactionDoc.data();

    // Verify merchant owns this transaction
    const belongsToMerchant = transaction.merchantId === merchantId ||
      (transaction.guestMerchantInfo?.originalMerchantId === merchantId);

    if (!belongsToMerchant) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update transaction
    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastStatusUpdate: {
        status,
        reason: reason || 'Manual update by merchant',
        updatedBy: merchantId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    };

    await transactionRef.update(updateData);

    console.log(`✅ Transaction ${transactionId} status updated to ${status} by merchant ${merchantId}`);

    // Return updated transaction
    const updatedDoc = await transactionRef.get();
    const updatedTransaction = serializeTransaction({
      id: updatedDoc.id,
      ...updatedDoc.data(),
      merchantValidation: {
        isValid: transaction.isValidMerchant || false,
        merchantType: transaction.isValidMerchant ? 'registered' : 'guest',
        paymentType: transaction.paymentType || 'unknown',
        source: transaction.source || 'unknown'
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Transaction status updated successfully',
      transaction: updatedTransaction
    });

  } catch (error) {
    console.error('💥 Update transaction status error:', error);
    res.status(500).json({ 
      error: `Failed to update transaction: ${error.message}` 
    });
  }
}

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionAnalytics,
  getTransactionById,
  getTransactionByCheckoutRequestID,
  debugTransactions,
  getMerchantAllTransactions,
  updateTransactionStatus
};