// src/firebase.js

// Import the functions you need from the SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database"; // Realtime Database
import { getStorage } from "firebase/storage";    // Firebase Storage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAvd_XMZ9RHAOxroj1KTU7Zqd8SBft1o8s",
  authDomain: "login-auth-b2a71.firebaseapp.com",
  databaseURL: "https://login-auth-b2a71-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "login-auth-b2a71",
  storageBucket: "login-auth-b2a71.appspot.com",
  messagingSenderId: "226480554659",
  appId: "1:226480554659:web:41c9af734a86adc3d8f516"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth, database, and storage instances
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);  // <-- added storage

export default app;
    