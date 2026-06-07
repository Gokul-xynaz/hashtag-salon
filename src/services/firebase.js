import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

// Export Auth + Firestore + Storage for use across app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence to drastically reduce reads on the free tier
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn("Persistence failed: multiple tabs open");
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn("Persistence not supported by browser");
    }
});
