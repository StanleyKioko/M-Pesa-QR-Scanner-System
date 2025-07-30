const admin = require("../config/firebase").admin;
const db = require("../config/firebase").db;

async function signUp(req, res) {
  const { email, password, name, phone, shortcode } = req.body;

  if (!email || !password || !name || !phone || !shortcode) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Store merchant details in Firestore
    await db.collection("merchants").doc(userRecord.uid).set({
      uid: userRecord.uid,
      name,
      phone,
      shortcode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ message: "Merchant registered successfully", uid: userRecord.uid });
  } catch (error) {
    res.status(500).json({ error: `Failed to register merchant: ${error.message}` });
  }
}

async function login(req, res) {
  // Note: Actual login is handled client-side with Firebase Auth SDK.
  // This endpoint verifies the user and returns merchant details.
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    const merchantDoc = await db.collection("merchants").doc(uid).get();

    if (!merchantDoc.exists) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    res.status(200).json({
      message: "Login successful",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: merchantDoc.data().name,
        phone: merchantDoc.data().phone,
        shortcode: merchantDoc.data().shortcode,
      },
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to log in: ${error.message}` });
  }
}

module.exports = { signUp, login };