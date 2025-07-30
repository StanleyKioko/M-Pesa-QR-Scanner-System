const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyClidZ65rHH_lOzytpOrSWp35CgAQG1wts",
  authDomain: "mpesa-qr-backend.firebaseapp.com",
  projectId: "mpesa-qr-backend",
  storageBucket: "mpesa-qr-backend.firebasestorage.app",
  messagingSenderId: "35298766142",
  appId: "1:35298766142:web:f496b5bcf04e677de2506f",
  measurementId: "G-MKCW7ZY9HB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

signInWithEmailAndPassword(auth, "merchant@example.com", "password123")
  .then(userCredential => {
    userCredential.user.getIdToken().then(token => {
      console.log("ID Token:", token);
    });
  })
  .catch(error => {
    console.error("Error:", error.message);
  });