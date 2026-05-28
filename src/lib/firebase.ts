import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Verifica se as chaves mínimas do Firebase estão configuradas
export const isFirebaseConfigured = !!(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY
);

let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const dbId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    console.log(`Firebase/Firestore inicializado com sucesso. Banco ativo: ${dbId || "(default)"}`);
  } catch (error) {
    console.error("Erro crítico ao inicializar o Firebase:", error);
  }
}

export { db };
