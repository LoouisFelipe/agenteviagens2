const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
    const snap = await getDocs(collection(db, "viagens"));
    const viagemId = snap.docs[0].id;
    console.log("Viagem ID:", viagemId);
    
    console.log("Buscando hoteis...");
    await getDocs(collection(db, "viagens", viagemId, "hoteis"));
    console.log("Buscando passeios...");
    await getDocs(collection(db, "viagens", viagemId, "passeios"));
    console.log("Buscando roteiros...");
    await getDocs(collection(db, "viagens", viagemId, "roteiros"));
    console.log("Buscando despesas...");
    await getDocs(collection(db, "viagens", viagemId, "despesas"));
    
    console.log("Sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("Erro ao conectar subcoleção:", err);
    process.exit(1);
  }
}

test();
