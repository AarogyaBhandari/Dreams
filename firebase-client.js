// Firebase web app configuration is public, but must match the registered web app.
// Get these values from Firebase Console > Project settings > Your apps.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCsvh5rskn7XucJ7BxX90HsIhQZnHzue7s",
    authDomain: "dreamswebsite-90f39.firebaseapp.com",
    projectId: "dreamswebsite-90f39",
    storageBucket: "dreamswebsite-90f39.firebasestorage.app",
    appId: "1:394976721488:web:74df712432a00da4406f55"
    
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value => value.startsWith("REPLACE_WITH_"));
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
