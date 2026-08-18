import fs from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: 'camisetas-imundas-store.firebaseapp.com',
  projectId: 'camisetas-imundas-store',
  storageBucket: 'camisetas-imundas-store.firebasestorage.app',
  messagingSenderId: '692693427304',
  appId: '1:692693427304:web:65e1ebca577eece1060934',
};

if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  const match = content.match(/VITE_FIREBASE_API_KEY=(.+)/);
  if (match) firebaseConfig.apiKey = match[1].trim();
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const fns = getFunctions(app, 'southamerica-east1');

  const email = process.env.ADMIN_EMAIL || 'luizeduardociarallo@gmail.com';
  const password = process.env.ADMIN_PASSWORD || 'Cinza-Gelo-1820-f706b0';

  console.log('Autenticando como admin...');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Autenticado como: ${cred.user.email}`);

  const snap = await getDocs(collection(db, 'products'));
  const saveProduct = httpsCallable(fns, 'saveProduct');

  for (const doc of snap.docs) {
    const data = doc.data();
    const isBMSS =
      data.band?.toLowerCase().includes('black magick') ||
      data.name?.toLowerCase().includes('black magick') ||
      doc.id === 'p-110';

    if (isBMSS) {
      console.log(`\nDesativando produto: [${doc.id}] ${data.name} (Banda: ${data.band})`);
      const { id, ...rest } = data;
      await saveProduct({
        id: doc.id,
        product: {
          ...rest,
          active: false,
        },
      });
      console.log(`✓ Produto [${doc.id}] marcado como active: false (oculto para clientes).`);
    }
  }

  console.log('\nOperação concluída com sucesso!');
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
