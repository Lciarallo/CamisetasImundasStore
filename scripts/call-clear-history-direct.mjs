import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Mesma configuração pública usada no cliente web
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSy...",
  authDomain: "camisetas-imundas-store.firebaseapp.com",
  projectId: "camisetas-imundas-store",
  storageBucket: "camisetas-imundas-store.firebasestorage.app",
  messagingSenderId: "692693427304",
  appId: "1:692693427304:web:65e1ebca577eece1060934"
};

// Lê a API Key real de .env.production ou .env.local
import fs from 'node:fs';
if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  const match = content.match(/VITE_FIREBASE_API_KEY=(.+)/);
  if (match) firebaseConfig.apiKey = match[1].trim();
}

console.log('Autenticando como Mestre no Firebase...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fns = getFunctions(app, 'southamerica-east1');

try {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    'mestre@camisetasimundas.com.br',
    'admin123456'
  );
  console.log(`Logado com sucesso como: ${userCredential.user.email} (${userCredential.user.uid})`);

  console.log('Executando função clearTestHistory...');
  const clearFn = httpsCallable(fns, 'clearTestHistory');
  const result = await clearFn({});
  console.log('Resultado da limpeza:', result.data);

  console.log('\nExecutando restauração do catálogo padrão (seedCatalog)...');
  const seedFn = httpsCallable(fns, 'seedCatalog');
  const seedResult = await seedFn({ replace: true });
  console.log('Resultado do seedCatalog:', seedResult.data);

  console.log('\nHistórico de testes completamente limpo e banco pronto!');
  process.exit(0);
} catch (err) {
  console.error('Erro:', err.message);
  process.exit(1);
}
