// src/firebase.js

// Firebase core SDK
import { initializeApp } from "firebase/app";

// Auth (email/password + Google)
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firestore database
import { getFirestore } from "firebase/firestore";

// OPTIONAL: Analytics (sirf browser env me use karo agar chahiye)
// import { getAnalytics } from "firebase/analytics";

// 👉 Ye config tumne Firebase console se diya tha:
const firebaseConfig = {
  apiKey: "AIzaSyAbz1MuOTVvfyZBHBHXQvijJM2U1WZLtdo",
  authDomain: "klxtraa.firebaseapp.com",
  projectId: "klxtraa",
  storageBucket: "klxtraa.firebasestorage.app",
  messagingSenderId: "768206495636",
  appId: "1:768206495636:web:6b9d3ed218a68332687981",
  measurementId: "G-DWRRVTYBR3",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);

// Google provider (for "Continue with Google")
const googleProvider = new GoogleAuthProvider();

// OPTIONAL: analytics (agar chahiye to uncomment karo, warna rehne do)
// let analytics;
// if (typeof window !== "undefined") {
//   analytics = getAnalytics(app);
// }

// Export jo tum App.jsx me use kar rahe ho
export { app, auth, db, googleProvider };
