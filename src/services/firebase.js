import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyABEhIdI8IHxisdfncpGbet8P-w0XfrvN4",
    authDomain: "saloon-7b4c2.firebaseapp.com",
    projectId: "saloon-7b4c2",
    storageBucket: "saloon-7b4c2.firebasestorage.app",
    messagingSenderId: "690175406563",
    appId: "1:690175406563:web:a0734feb12d360e153f0d6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth + Firestore for use across app
export const auth = getAuth(app);
export const db = getFirestore(app);
