const admin = require("../config/firebase").admin;
const db = require("../config/firebase").db;

async function signUp(req, res) {
  console.log('🏢 Backend signUp called with data:', req.body);
  
  const { uid, email, name, phone, shortcode } = req.body;

  // Check for required fields
  if (!uid || !email || !name || !phone || !shortcode) {
    console.error('❌ Missing required fields:', { uid, email, name, phone, shortcode });
    return res.status(400).json({ error: "All fields are required including UID" });
  }

  try {
    console.log('🔍 Checking if Firebase user exists...');
    
    // Verify that the Firebase user exists (they should already be created by frontend)
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
      console.log('✅ Firebase user found:', userRecord.uid);
    } catch (userError) {
      console.error('❌ Firebase user not found:', userError);
      return res.status(400).json({ error: "Firebase user not found. Please ensure user is created first." });
    }

    console.log('💾 Storing merchant details in Firestore...');
    
    // Check if merchant already exists
    const existingMerchant = await db.collection("merchants").doc(uid).get();
    if (existingMerchant.exists) {
      console.log('⚠️ Merchant already exists');
      return res.status(400).json({ error: "Merchant already registered" });
    }

    // Store merchant details in Firestore using the existing Firebase UID
    await db.collection("merchants").doc(uid).set({
      uid: uid,
      email: email,
      name: name,
      phone: phone,
      shortcode: shortcode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Merchant stored in Firestore successfully');

    res.status(201).json({ 
      message: "Merchant registered successfully", 
      uid: uid,
      merchant: {
        uid,
        email,
        name,
        phone,
        shortcode
      }
    });

  } catch (error) {
    console.error('❌ Backend registration error:', error);
    res.status(500).json({ error: `Failed to register merchant: ${error.message}` });
  }
}

async function login(req, res) {
  console.log('🔐 Backend login called with data:', req.body);
  
  // Note: Actual login is handled client-side with Firebase Auth SDK.
  // This endpoint verifies the user and returns merchant details.
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  try {
    console.log('🔍 Looking up user and merchant data...');
    
    const userRecord = await admin.auth().getUser(uid);
    const merchantDoc = await db.collection("merchants").doc(uid).get();

    if (!merchantDoc.exists) {
      console.log('❌ Merchant not found in database');
      return res.status(404).json({ error: "Merchant not found" });
    }

    const merchantData = merchantDoc.data();
    console.log('✅ Merchant found:', merchantData);

    res.status(200).json({
      message: "Login successful",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: merchantData.name,
        phone: merchantData.phone,
        shortcode: merchantData.shortcode,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: `Failed to log in: ${error.message}` });
  }
}

module.exports = { signUp, login };