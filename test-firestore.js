const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAoQ8r-EWujyit6Ckn96JUY_GPS35f_fTs",
  authDomain: "agente-viagens2.firebaseapp.com",
  projectId: "agente-viagens2",
  storageBucket: "agente-viagens2.firebasestorage.app",
  messagingSenderId: "848133560430",
  appId: "1:848133560430:web:1c5af1e20882b4b57eae7f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "agenteviagens2");

async function test() {
  try {
    console.log("Executando query ordenada por criado_em desc...");
    const q = query(collection(db, "viagens"), orderBy("criado_em", "desc"));
    const snap = await getDocs(q);
    console.log(`Sucesso! Encontrados ${snap.docs.length} documentos.`);
    snap.docs.forEach(doc => {
      console.log("ID:", doc.id, "Dados:", doc.data());
    });
    process.exit(0);
  } catch (err) {
    console.error("Erro ao executar query ordenada:", err);
    process.exit(1);
  }
}

test();

