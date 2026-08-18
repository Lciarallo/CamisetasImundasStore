import fs from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: '',
  authDomain: 'camisetas-imundas-store.firebaseapp.com',
  projectId: 'camisetas-imundas-store',
  storageBucket: 'camisetas-imundas-store.firebasestorage.app',
  messagingSenderId: '692693427304',
  appId: '1:692693427304:web:65e1ebca577eece1060934',
};
firebaseConfig.apiKey = fs.readFileSync('.env.local', 'utf8').match(/VITE_FIREBASE_API_KEY=(.+)/)[1].trim();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const cred = await signInWithEmailAndPassword(auth, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
const idToken = await cred.user.getIdToken(true);

const bytes = fs.readFileSync('/tmp/tee-crops/mutilator-front.jpg');
const bucket = 'camisetas-imundas-store.firebasestorage.app';
const objectPath = encodeURIComponent('products/p-101/mutilator-front.jpg');
const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${objectPath}`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Firebase ${idToken}`,
    'Content-Type': 'image/jpeg',
  },
  body: bytes,
});

console.log('status:', res.status);
console.log(await res.text());
process.exit(0);
