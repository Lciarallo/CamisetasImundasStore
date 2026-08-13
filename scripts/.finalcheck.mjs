import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const app = initializeApp({
  apiKey: 'AIzaSyA-FzO3AoTMhBM-pxabF40GwYK2eUlvofk',
  authDomain: 'camisetas-imundas-store.firebaseapp.com',
  projectId: 'camisetas-imundas-store',
  storageBucket: 'camisetas-imundas-store.firebasestorage.app',
  appId: '1:692693427304:web:cebbea1e0648f96ea547dd',
});

const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, 'southamerica-east1');
const call = (n) => httpsCallable(fns, n);

const cred = await signInWithEmailAndPassword(
  auth,
  'luizeduardociarallo@gmail.com',
  'Cinza-Gelo-1820-f706b0',
);
console.log('uid:', cred.user.uid);
const token = await cred.user.getIdTokenResult(true);
console.log('cargo:', token.claims.role, '| privilégios:', token.claims.perms?.length);
console.log('currentUser depois do login:', auth.currentUser?.uid ?? 'NENHUM');

const p = await getDoc(doc(db, 'products', 'p-001'));
console.log('estoque M da peça comprada:', p.exists() ? p.data().stock?.M : 'não encontrada');

const step = async (label, status) => {
  try {
    await call('updateOrderStatus')({ orderId: 'INS-20001', status });
    console.log(`${label}: aceitou`);
  } catch (e) {
    console.log(`${label}: recusado (${e.code})`);
  }
};

await step('pular para enviado', 'enviado');
await step('cancelar', 'cancelado');

const o = await getDoc(doc(db, 'orders', 'INS-20001'));
console.log('pedido de teste agora:', o.data()?.status);
process.exit(0);
