/**
 * Firebase Configuration and Initialization
 * 
 * This file initializes Firebase services (Auth and Firestore)
 * Uses Firebase v10 modular SDK
 */

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBcXoRQfyXRAkLhhBk_TLvDb73MqL_qfho",
    authDomain: "blind-typing-1.firebaseapp.com",
    projectId: "blind-typing-1",
    storageBucket: "blind-typing-1.firebasestorage.app",
    messagingSenderId: "481728008930",
    appId: "1:481728008930:web:9368bff65c8f9be64cc4bb",
    measurementId: "G-T12DBYZEJN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, EmailAuthProvider, analytics };
