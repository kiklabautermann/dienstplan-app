import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Deine Firebase Konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyC3t96BxNJ3oKFoFQReN0O36EEIM9bY8HA",
  authDomain: "dienstplansd.firebaseapp.com",
  projectId: "dienstplansd",
  storageBucket: "dienstplansd.firebasestorage.app",
  messagingSenderId: "755479288942",
  appId: "1:755479288942:web:aa0c9d6b807051ddbb1a7f"
};

// Firebase initialisieren
const app = initializeApp(firebaseConfig);

// Auth (für Login) und Firestore (für die Datenbank) initialisieren und exportieren
export const auth = getAuth(app);
export const db = getFirestore(app);
