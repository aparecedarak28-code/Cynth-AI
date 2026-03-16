import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDf5w2OTYONk2BjavD13ECGfaAKLTZIPFI",
  authDomain: "cynthai-prime.firebaseapp.com",
  projectId: "cynthai-prime",
  storageBucket: "cynthai-prime.firebasestorage.app",
  messagingSenderId: "282136227894",
  appId: "1:282136227894:web:54e7089513225b80fea897"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
