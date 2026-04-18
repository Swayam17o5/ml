// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const viteEnv = import.meta.env || {};
const legacyEnv = globalThis.process?.env || {};

const firebaseConfig = {
  apiKey: viteEnv.VITE_FIREBASE_API_KEY ?? legacyEnv.REACT_APP_FIREBASE_API_KEY,
  authDomain:
    viteEnv.VITE_FIREBASE_AUTH_DOMAIN ??
    legacyEnv.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:
    viteEnv.VITE_FIREBASE_PROJECT_ID ?? legacyEnv.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:
    viteEnv.VITE_FIREBASE_STORAGE_BUCKET ??
    legacyEnv.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ??
    legacyEnv.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: viteEnv.VITE_FIREBASE_APP_ID ?? legacyEnv.REACT_APP_FIREBASE_APP_ID,
  measurementId:
    viteEnv.VITE_FIREBASE_MEASUREMENT_ID ??
    legacyEnv.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
