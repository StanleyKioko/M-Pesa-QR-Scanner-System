const admin = require("firebase-admin");
const { initializeApp } = require("firebase/app");
const { getAuth } = require("firebase/auth");

const serviceAccount = require("./serviceAccountKey.json");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "mpesa-qr-backend.firebaseapp.com",
  projectId: "mpesa-qr-backend",
  storageBucket: "mpesa-qr-backend.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

module.exports = { admin, db, auth };