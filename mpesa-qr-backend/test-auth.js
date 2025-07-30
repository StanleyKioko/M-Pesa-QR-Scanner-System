const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "mpesa-qr-backend.firebaseapp.com",
  projectId: "mpesa-qr-backend",
  storageBucket: "mpesa-qr-backend.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function getIdToken() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, "merchant@example.com", "your_secure_password");
    const idToken = await userCredential.user.getIdToken();
    console.log("ID Token:", idToken);
  } catch (error) {
    console.error("Error generating ID token:", error.message);
  }
}

getIdToken();
