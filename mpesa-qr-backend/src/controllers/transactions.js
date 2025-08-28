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

// ENHANCED: Safe query executor with fallback for index issues
async function executeQueriesWithFallback(directQuery, guestQuery, period, filterDate, endFilterDate) {
  try {
    // Try to execute both queries with date filtering
    const [directSnapshot, guestSnapshot] = await Promise.all([
      directQuery.get(),
      guestQuery.get()
    ]);

    console.log(`Successfully executed queries with date filtering`);
    return [directSnapshot, guestSnapshot];
    
  } catch (error) {
    console.log(`Query with date filtering failed (likely missing index): ${error.message}`);
    
    // Fallback: Execute queries without date filtering and filter in memory
    console.log(`Falling back to queries without date filtering...`);
    
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
      
      console.log(`Fallback queries executed successfully`);
      
      // Filter results in memory if date filtering was needed
      if (period !== 'all' && filterDate) {
        console.log(`Applying client-side date filtering for period: ${period}`);
        
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
        
        console.log(`Client-side filtering: ${filterDirectDocs.length} direct + ${filterGuestDocs.length} guest transactions`);
        
        // Create mock snapshots with filtered docs
        return [
          { docs: filterDirectDocs },
          { docs: filterGuestDocs }
        ];
      }
      
      return [directSnapshot, guestSnapshot];
      
    } catch (fallbackError) {
      console.error(`Fallback query also failed:`, fallbackError);
      throw fallbackError;
    }
  }
}

// ENHANCED: Create merchant transaction with QR support
async function createTransaction(req, res) {
  const { phoneNumber, amount, qrData, reference, description } = req.body;
  const merchantId = req.user.uid;
  
  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Phone number and amount are required" });
  }

  try {
    const transactionRef = reference || `Tx_${Date.now()}`;
    
    // Enhanced transaction data with QR support
    const transactionData = {
      merchantId,
      transactionRef,
      phoneNumber,
      amount: parseFloat(amount),
      status: "pending",
      paymentType: 'merchant_initiated',
      source: qrData ? 'qr_generated' : 'api_direct',
      isValidMerchant: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add QR data if provided
    if (qrData) {
      transactionData.qrData = qrData;
      transactionData.description = description || qrData.description || 'QR Payment';
      transactionData.businessName = qrData.businessName;
      transactionData.qrMetadata = {
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        qrType: qrData.type || 'merchant_payment',
        qrVersion: qrData.version || '1.0'
      };
    } else if (description) {
      transactionData.description = description;
    }

    const docRef = await db.collection("transactions").add(transactionData);

    console.log(`Transaction ${docRef.id} created successfully - ${qrData ? 'QR-based' : 'Direct API'}`);

    res.status(201).json({ 
      status: "Transaction successful", 
      data: { 
        transactionRef,
        transactionId: docRef.id,
        qrSupported: !!qrData
      } 
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: `Failed to create transaction: ${error.message}` });
  }
}

// ENHANCED: getTransactions with QR metadata and improved filtering
async function getTransactions(req, res) {
  const merchantId = req.user.uid;
  const { 
    period = 'all', 
    status, 
    startDate, 
    endDate, 
    limit = 100,
    includeGuest = true,
    source // New: filter by transaction source (qr_scanner, api_direct, etc.)
  } = req.query;

  try {
    console.log(`getTransactions - merchant: ${merchantId}, period: ${period}, status: ${status}, source: ${source}, includeGuest: ${includeGuest}`);

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

    console.log(`Found ${directSnapshot.docs.length} direct + ${guestSnapshot.docs.length} guest transactions`);

    // Combine and deduplicate
    const allTransactionDocs = [
      ...directSnapshot.docs,
      ...guestSnapshot.docs.filter(doc => 
        !directSnapshot.docs.some(directDoc => directDoc.id === doc.id)
      )
    ];

    // ENHANCED: Map and serialize transactions with QR metadata
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
        },
        // Enhanced QR metadata
        qrMetadata: data.qrMetadata ? {
          ...data.qrMetadata,
          hasQRData: !!data.qrData,
          qrSource: data.source === 'qr_scanner' ? 'customer_scanned' : 
                   data.source === 'qr_generated' ? 'merchant_generated' : 'none'
        } : {
          hasQRData: !!data.qrData,
          qrSource: data.source === 'qr_scanner' ? 'customer_scanned' : 
                   data.source === 'qr_generated' ? 'merchant_generated' : 'none'
        }
      });
    });

    // Apply status filtering
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
    }

    // NEW: Apply source filtering for QR vs non-QR transactions
    if (source) {
      transactions = transactions.filter(t => {
        switch (source) {
          case 'qr':
            return t.source === 'qr_scanner' || t.source === 'qr_generated' || !!t.qrData;
          case 'manual':
            return t.source === 'api_direct' || t.source === 'merchant_dashboard';
          case 'customer_qr':
            return t.source === 'qr_scanner' && t.paymentType === 'customer_initiated';
          case 'merchant_qr':
            return t.source === 'qr_generated' && t.paymentType === 'merchant_initiated';
          default:
            return t.source === source;
        }
      });
    }

    // Sort by creation date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`Returning ${transactions.length} transactions for merchant ${merchantId}`);

    res.status(200).json({
      status: 'success',
      transactions,
      metadata: {
        total: transactions.length,
        directTransactions: directSnapshot.docs.length,
        guestTransactions: guestSnapshot.docs.length,
        totalReturned: transactions.length,
        merchantId: merchantId,
        filters: { period, status, source, includeGuest },
        queryMethod: period === 'all' ? 'direct' : 'fallback-safe',
        // Enhanced QR statistics
        qrStatistics: {
          qrTransactions: transactions.filter(t => t.qrMetadata?.hasQRData).length,
          customerScannedQR: transactions.filter(t => t.qrMetadata?.qrSource === 'customer_scanned').length,
          merchantGeneratedQR: transactions.filter(t => t.qrMetadata?.qrSource === 'merchant_generated').length,
          nonQrTransactions: transactions.filter(t => !t.qrMetadata?.hasQRData).length
        }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: `Failed to retrieve transactions: ${error.message}` });
  }
}

// ENHANCED: Transaction analytics with QR insights
async function getTransactionAnalytics(req, res) {
  const merchantId = req.user.uid;
  const { 
    period = 'week', 
    status,           
    startDate,        
    endDate,
    includeGuest = true,
    includeQRMetrics = true // New: include QR-specific analytics
  } = req.query;

  try {
    console.log(`Analytics request - merchant: ${merchantId}, period: ${period}, status: ${status}, includeQRMetrics: ${includeQRMetrics}`);

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
      console.log(`Period: ${period} - from ${queryStartDate.toISOString()}`);
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

    console.log(`Found ${directSnapshot.docs.length} direct merchant transactions`);
    console.log(`Found ${guestSnapshot.docs.length} guest transactions`);

    // Combine and deduplicate transactions
    const allTransactionDocs = [
      ...directSnapshot.docs,
      ...guestSnapshot.docs.filter(doc => 
        !directSnapshot.docs.some(directDoc => directDoc.id === doc.id)
      )
    ];

    console.log(`Total combined transactions: ${allTransactionDocs.length}`);

    // ENHANCED: Map transactions with QR metadata
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
        },
        qrMetadata: {
          hasQRData: !!data.qrData,
          qrSource: data.source === 'qr_scanner' ? 'customer_scanned' : 
                   data.source === 'qr_generated' ? 'merchant_generated' : 'none',
          qrType: data.qrData?.type || data.qrMetadata?.qrType || null
        }
      });
    });

    // Apply status filtering
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
      console.log(`After status filtering (${status}): ${transactions.length} transactions`);
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

    // NEW: QR-specific analytics
    const qrTransactions = transactions.filter(t => t.qrMetadata?.hasQRData);
    const customerScannedQR = transactions.filter(t => t.qrMetadata?.qrSource === 'customer_scanned');
    const merchantGeneratedQR = transactions.filter(t => t.qrMetadata?.qrSource === 'merchant_generated');
    const nonQrTransactions = transactions.filter(t => !t.qrMetadata?.hasQRData);

    const totalRevenue = successfulTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const qrRevenue = successfulTransactions.filter(t => t.qrMetadata?.hasQRData).reduce((sum, t) => sum + (t.amount || 0), 0);
    const nonQrRevenue = totalRevenue - qrRevenue;
    
    const averageTransaction = successfulTransactions.length > 0 
      ? totalRevenue / successfulTransactions.length 
      : 0;

    console.log(`Revenue calculation: ${successfulTransactions.length} successful transactions = KSH ${totalRevenue}`);
    console.log(`QR Revenue: KSH ${qrRevenue} (${qrTransactions.length} QR transactions)`);

    // Calculate daily summaries with QR insights
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
          qrTransactions: 0,
          customerScannedQR: 0,
          merchantGeneratedQR: 0,
          nonQrTransactions: 0,
          qrRevenue: 0,
          transactions: []
        };
      }
      
      const summary = dailySummaries[dateKey];
      summary.totalTransactions++;
      summary.transactions.push(transaction);
      
      // Merchant type tracking
      if (transaction.merchantValidation?.isValid === true) {
        summary.realMerchant++;
      } else {
        summary.guestMerchant++;
      }

      // QR tracking
      if (transaction.qrMetadata?.hasQRData) {
        summary.qrTransactions++;
        if (transaction.qrMetadata?.qrSource === 'customer_scanned') {
          summary.customerScannedQR++;
        } else if (transaction.qrMetadata?.qrSource === 'merchant_generated') {
          summary.merchantGeneratedQR++;
        }
      } else {
        summary.nonQrTransactions++;
      }
      
      // Status and revenue tracking
      switch (transaction.status) {
        case 'success':
          summary.successful++;
          summary.totalRevenue += transaction.amount || 0;
          if (transaction.qrMetadata?.hasQRData) {
            summary.qrRevenue += transaction.amount || 0;
          }
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

    const qrAdoptionRate = totalTransactions > 0
      ? (qrTransactions.length / totalTransactions * 100).toFixed(1)
      : 0;

    // ENHANCED: Analytics with QR insights
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
      // NEW: QR Analytics
      qrAnalytics: includeQRMetrics === 'true' ? {
        totalQRTransactions: qrTransactions.length,
        customerScannedQR: customerScannedQR.length,
        merchantGeneratedQR: merchantGeneratedQR.length,
        nonQrTransactions: nonQrTransactions.length,
        qrRevenue,
        nonQrRevenue,
        qrAdoptionRate: parseFloat(qrAdoptionRate),
        qrSuccessRate: qrTransactions.length > 0 
          ? (qrTransactions.filter(t => t.status === 'success').length / qrTransactions.length * 100).toFixed(1)
          : 0,
        averageQRTransaction: qrTransactions.filter(t => t.status === 'success').length > 0
          ? qrRevenue / qrTransactions.filter(t => t.status === 'success').length
          : 0,
        qrPaymentMethods: {
          customerScanned: customerScannedQR.length,
          merchantGenerated: merchantGeneratedQR.length
        }
      } : null,
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

    console.log(`Analytics completed: ${totalTransactions} total, ${qrTransactions.length} QR, ${successfulTransactions.length} successful`);

    res.status(200).json({
      status: 'success',
      analytics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: `Failed to get analytics: ${error.message}` });
  }
}

// ENHANCED: Get single transaction with QR metadata
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
      },
      // Enhanced QR metadata for single transaction
      qrMetadata: {
        hasQRData: !!transaction.qrData,
        qrSource: transaction.source === 'qr_scanner' ? 'customer_scanned' : 
                 transaction.source === 'qr_generated' ? 'merchant_generated' : 'none',
        qrType: transaction.qrData?.type || transaction.qrMetadata?.qrType || null,
        qrVersion: transaction.qrData?.version || transaction.qrMetadata?.qrVersion || null,
        businessName: transaction.qrData?.businessName || transaction.businessName || null,
        qrReference: transaction.qrData?.reference || null,
        qrDescription: transaction.qrData?.description || null
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

// Get transaction by CheckoutRequestID (for callback updates) - Enhanced with QR logging
async function getTransactionByCheckoutRequestID(checkoutRequestID) {
  try {
    console.log(`Searching for transaction with CheckoutRequestID: ${checkoutRequestID}`);
    
    // Strategy 1: Search in CheckoutRequestID field (new consistent format)
    let snapshot = await db.collection('transactions')
      .where('CheckoutRequestID', '==', checkoutRequestID)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      const qrInfo = data.qrData ? `QR:${data.qrData.type || 'unknown'}` : 'non-QR';
      console.log(`Found transaction via CheckoutRequestID field: ${doc.id} (${data.isValidMerchant ? 'real' : 'guest'} merchant, ${qrInfo})`);
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
      const qrInfo = data.qrData ? `QR:${data.qrData.type || 'unknown'}` : 'non-QR';
      console.log(`Found transaction via mpesaResponse.CheckoutRequestID: ${doc.id} (${data.isValidMerchant ? 'real' : 'guest'} merchant, ${qrInfo})`);
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
        const qrInfo = data.qrData ? `QR:${data.qrData.type || 'unknown'}` : 'non-QR';
        console.log(`Found transaction via CheckoutRequestID variation: ${doc.id} (${data.isValidMerchant ? 'real' : 'guest'} merchant, ${qrInfo})`);
        return {
          id: doc.id,
          ref: doc.ref,
          data: data
        };
      }
    }

    console.log(`No transaction found for CheckoutRequestID: ${checkoutRequestID}`);
    return null;
  } catch (error) {
    console.error('Error finding transaction by CheckoutRequestID:', error);
    return null;
  }
}

// ENHANCED: Debug endpoint with QR analytics
async function debugTransactions(req, res) {
  const merchantId = req.user.uid;
  
  try {
    console.log(`Debug request for merchant: ${merchantId}`);

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

    // Enhanced field issues tracking with QR metrics
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
      nullMerchantId: allTransactions.filter(t => t.merchantId === null).length,
      // NEW: QR-related issues
      qrTransactions: allTransactions.filter(t => !!t.qrData).length,
      qrWithoutMetadata: allTransactions.filter(t => !!t.qrData && !t.qrMetadata).length,
      incompleteQRData: allTransactions.filter(t => t.qrData && (!t.qrData.merchantId || !t.qrData.amount)).length
    };

    const statusDistribution = {
      success: merchantTransactions.filter(t => t.status === 'success').length,
      pending: merchantTransactions.filter(t => t.status === 'pending').length,
      failed: merchantTransactions.filter(t => t.status === 'failed').length,
      error: merchantTransactions.filter(t => t.status === 'error').length,
      other: merchantTransactions.filter(t => !['success', 'pending', 'failed', 'error'].includes(t.status)).length
    };

    // Enhanced payment type distribution with QR insights
    const paymentTypeDistribution = {
      customerToMerchant: allTransactions.filter(t => t.paymentType === 'customer_initiated').length,
      merchantInitiated: allTransactions.filter(t => t.paymentType === 'merchant_initiated').length,
      qrScanned: allTransactions.filter(t => t.source === 'qr_scanner').length,
      qrGenerated: allTransactions.filter(t => t.source === 'qr_generated').length,
      unknown: allTransactions.filter(t => !t.paymentType).length
    };

    // Enhanced recent transactions with QR info
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
        source: tx.source,
        // NEW: QR information
        hasQRData: !!tx.qrData,
        qrType: tx.qrData?.type || null,
        businessName: tx.qrData?.businessName || tx.businessName || null
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
      },
      // NEW: QR Diagnostics
      qrDiagnostics: {
        totalQRTransactions: fieldIssues.qrTransactions,
        qrAdoptionRate: allTransactions.length > 0 
          ? (fieldIssues.qrTransactions / allTransactions.length * 100).toFixed(1) + '%'
          : '0%',
        qrHealthIssues: {
          qrWithoutMetadata: fieldIssues.qrWithoutMetadata,
          incompleteQRData: fieldIssues.incompleteQRData
        },
        qrSources: {
          customerScanned: allTransactions.filter(t => t.source === 'qr_scanner').length,
          merchantGenerated: allTransactions.filter(t => t.source === 'qr_generated').length
        },
        qrRecommendation: fieldIssues.qrTransactions === 0 
          ? 'No QR transactions found - promote QR code features to merchants and customers'
          : fieldIssues.qrTransactions < allTransactions.length * 0.1
          ? 'Low QR adoption - consider improving QR code visibility and education'
          : 'Good QR adoption - continue promoting QR features'
      }
    };

    console.log(`Enhanced debug completed: ${merchantTransactions.length} merchant transactions, ${fieldIssues.qrTransactions} QR transactions`);

    res.status(200).json({
      status: 'success',
      debug: debugInfo
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ 
      error: `Debug failed: ${error.message}`,
      merchantId 
    });
  }
}

// ENHANCED: Get all transactions for a merchant with QR insights
async function getMerchantAllTransactions(req, res) {
  const merchantId = req.user.uid;
  const { 
    period = 'all', 
    status, 
    startDate, 
    endDate, 
    limit = 100,
    includeQRMetrics = true
  } = req.query;

  try {
    console.log(`getMerchantAllTransactions - merchant: ${merchantId}, includeQRMetrics: ${includeQRMetrics}`);

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

    console.log(`Found ${realTransactions.docs.length} real + ${guestTransactions.docs.length} guest = ${allTransactionDocs.length} total transactions`);

    //  ENHANCED: Map and serialize transactions with QR metadata
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
        },
        qrMetadata: includeQRMetrics === 'true' ? {
          hasQRData: !!data.qrData,
          qrSource: data.source === 'qr_scanner' ? 'customer_scanned' : 
                   data.source === 'qr_generated' ? 'merchant_generated' : 'none',
          qrType: data.qrData?.type || data.qrMetadata?.qrType || null,
          businessName: data.qrData?.businessName || data.businessName || null
        } : undefined
      });
    });

    // Apply status filtering
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
    }

    // Sort by creation date (newest first)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // ENHANCED: Calculate summary statistics with QR insights
    const qrTransactions = transactions.filter(t => t.qrMetadata?.hasQRData);
    const summary = {
      total: transactions.length,
      successful: transactions.filter(t => t.status === 'success').length,
      pending: transactions.filter(t => t.status === 'pending').length,
      failed: transactions.filter(t => ['failed', 'cancelled', 'error'].includes(t.status)).length,
      totalRevenue: transactions
        .filter(t => t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0),
      realMerchantTransactions: transactions.filter(t => t.merchantValidation?.isValid === true).length,
      guestTransactions: transactions.filter(t => t.merchantValidation?.isValid === false).length,
      // NEW: QR metrics
      qrMetrics: includeQRMetrics === 'true' ? {
        totalQRTransactions: qrTransactions.length,
        qrRevenue: qrTransactions.filter(t => t.status === 'success').reduce((sum, t) => sum + (t.amount || 0), 0),
        customerScannedQR: transactions.filter(t => t.qrMetadata?.qrSource === 'customer_scanned').length,
        merchantGeneratedQR: transactions.filter(t => t.qrMetadata?.qrSource === 'merchant_generated').length,
        qrSuccessRate: qrTransactions.length > 0 
          ? (qrTransactions.filter(t => t.status === 'success').length / qrTransactions.length * 100).toFixed(1) + '%'
          : '0%'
      } : undefined
    };

    console.log(`Returning ${transactions.length} transactions (${qrTransactions.length} QR) for merchant ${merchantId}`);

    res.status(200).json({
      status: 'success',
      transactions,
      summary,
      metadata: {
        merchantId,
        filters: { period, status, includeQRMetrics },
        totalReturned: transactions.length,
        directTransactions: realTransactions.docs.length,
        guestTransactions: guestTransactions.docs.length,
        queryTimestamp: new Date().toISOString(),
        queryMethod: period === 'all' ? 'direct' : 'fallback-safe'
      }
    });

  } catch (error) {
    console.error('getMerchantAllTransactions error:', error);
    res.status(500).json({ 
      error: `Failed to get merchant transactions: ${error.message}`,
      merchantId 
    });
  }
}

// ENHANCED: Update transaction status with QR logging
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
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        wasQRTransaction: !!transaction.qrData // Track if this was a QR transaction
      }
    };

    await transactionRef.update(updateData);

    const qrInfo = transaction.qrData ? ` (QR: ${transaction.qrData.type || 'unknown'})` : '';
    console.log(`Transaction ${transactionId} status updated to ${status} by merchant ${merchantId}${qrInfo}`);

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
      },
      qrMetadata: {
        hasQRData: !!transaction.qrData,
        qrSource: transaction.source === 'qr_scanner' ? 'customer_scanned' : 
                 transaction.source === 'qr_generated' ? 'merchant_generated' : 'none'
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Transaction status updated successfully',
      transaction: updatedTransaction
    });

  } catch (error) {
    console.error('Update transaction status error:', error);
    res.status(500).json({ 
      error: `Failed to update transaction: ${error.message}` 
    });
  }
}

// NEW: Get QR-specific transaction insights
async function getQRTransactionInsights(req, res) {
  const merchantId = req.user.uid;
  const { period = 'week', detailed = false } = req.query;

  try {
    console.log(`📱 QR Insights request - merchant: ${merchantId}, period: ${period}`);

    // Calculate date range
    const now = new Date();
    let queryStartDate = new Date();
    
    switch (period) {
      case 'today':
        queryStartDate.setHours(0, 0, 0, 0);
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

    // Query transactions
    const snapshot = await db.collection("transactions")
      .where("merchantId", "==", merchantId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(queryStartDate))
      .limit(500)
      .get();

    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter QR transactions
    const qrTransactions = transactions.filter(t => !!t.qrData);
    const nonQrTransactions = transactions.filter(t => !t.qrData);

    // Calculate insights
    const insights = {
      period,
      totalTransactions: transactions.length,
      qrTransactions: {
        count: qrTransactions.length,
        percentage: transactions.length > 0 
          ? (qrTransactions.length / transactions.length * 100).toFixed(1)
          : 0,
        revenue: qrTransactions
          .filter(t => t.status === 'success')
          .reduce((sum, t) => sum + (t.amount || 0), 0),
        averageAmount: qrTransactions.length > 0
          ? (qrTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) / qrTransactions.length).toFixed(2)
          : 0,
        successRate: qrTransactions.length > 0
          ? (qrTransactions.filter(t => t.status === 'success').length / qrTransactions.length * 100).toFixed(1)
          : 0
      },
      comparison: {
        nonQrTransactions: nonQrTransactions.length,
        qrVsNonQrSuccessRate: {
          qr: qrTransactions.length > 0
            ? (qrTransactions.filter(t => t.status === 'success').length / qrTransactions.length * 100).toFixed(1)
            : 0,
          nonQr: nonQrTransactions.length > 0
            ? (nonQrTransactions.filter(t => t.status === 'success').length / nonQrTransactions.length * 100).toFixed(1)
            : 0
        }
      },
      recommendations: []
    };

    // Add recommendations
    if (qrTransactions.length === 0) {
      insights.recommendations.push({
        type: 'adoption',
        message: 'Consider creating QR codes for your business to enable quick customer payments',
        priority: 'high'
      });
    } else if (qrTransactions.length < transactions.length * 0.2) {
      insights.recommendations.push({
        type: 'promotion',
        message: 'QR adoption is low. Display QR codes prominently to encourage customer usage',
        priority: 'medium'
      });
    }

    if (detailed === 'true') {
      insights.qrTypes = {};
      qrTransactions.forEach(t => {
        const type = t.qrData?.type || 'unknown';
        if (!insights.qrTypes[type]) {
          insights.qrTypes[type] = { count: 0, revenue: 0 };
        }
        insights.qrTypes[type].count++;
        if (t.status === 'success') {
          insights.qrTypes[type].revenue += t.amount || 0;
        }
      });
    }

    res.status(200).json({
      status: 'success',
      insights
    });

  } catch (error) {
    console.error('QR Insights error:', error);
    res.status(500).json({ error: `Failed to get QR insights: ${error.message}` });
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
  updateTransactionStatus,
  getQRTransactionInsights // NEW: QR-specific insights endpoint
};