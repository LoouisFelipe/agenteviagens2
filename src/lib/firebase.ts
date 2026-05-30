import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAoQ8r-EWujyit6Ckn96JUY_GPS35f_fTs",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "agente-viagens2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "agente-viagens2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "agente-viagens2.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "848133560430",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:848133560430:web:1c5af1e20882b4b57eae7f",
};

// Evita inicializar o Firebase multiplas vezes no Next.js
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializa e exporta Autenticação
export const auth = getAuth(app);

// Suporta banco de dados padrão ou nomeado (ex: agenteviagens2)
const dbId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "agenteviagens2";
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Exporta verificação de configuração mínima
export const isFirebaseConfigured = !!(
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId) &&
  (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey)
);



