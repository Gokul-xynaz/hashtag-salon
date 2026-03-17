import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBjQpWnuac34y_b9UmeC2G_L0kmlN-jYA4",
    authDomain: "hashtag-saloon.firebaseapp.com",
    projectId: "hashtag-saloon",
    storageBucket: "hashtag-saloon.firebasestorage.app",
    messagingSenderId: "1044580967073",
    appId: "1:1044580967073:web:0962907be5348ebdc786e0",
    measurementId: "G-BL3R5QB6Q3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth + Firestore for use across app
export const auth = getAuth(app);
export const db = getFirestore(app);
