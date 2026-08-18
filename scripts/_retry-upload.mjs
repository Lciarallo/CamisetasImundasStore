import fs from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

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
const bucket = getStorage(app);

const cred = await signInWithEmailAndPassword(auth, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
console.log('uid:', cred.user.uid);
await cred.user.getIdToken(true);

const bytes = fs.readFileSync('/tmp/tee-crops/mutilator-front.jpg');
try {
  const dest = storageRef(bucket, 'products/p-101/mutilator-front.jpg');
  await uploadBytes(dest, bytes, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(dest);
  console.log('OK:', url);
} catch (e) {
  console.log('FAIL:', e.code, e.message);
}
process.exit(0);
