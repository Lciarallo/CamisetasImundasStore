import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';

/**
 * Inicialização do Firebase.
 *
 * As chaves vêm de variáveis de ambiente `VITE_*`. Elas são públicas por
 * natureza — vão no bundle e qualquer um lê no navegador. O que protege os
 * dados são as regras de segurança e as Cloud Functions, nunca o segredo da
 * apiKey, que não é segredo nenhum.
 *
 * Sem configuração, a loja cai no modo local (localStorage) em vez de quebrar.
 * Isso mantém a demonstração de pé em quem clona o repositório sem projeto
 * Firebase próprio.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Região das funções — precisa bater com a declarada em `functions/src/index.ts`. */
export const FUNCTIONS_REGION = 'southamerica-east1';

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

/** Emuladores locais: ligados por `VITE_USE_EMULATORS=true` no `.env.local`. */
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let functionsInstance: Functions | null = null;
let storageInstance: FirebaseStorage | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase não configurado. Defina as variáveis VITE_FIREBASE_*.');
  }
  if (!app) app = initializeApp(config);
  return app;
}

export function firebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
    if (useEmulators) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return authInstance;
}

export function firestore(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(ensureApp());
    if (useEmulators) connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
  }
  return dbInstance;
}

export function functions(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(ensureApp(), FUNCTIONS_REGION);
    if (useEmulators) connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);
  }
  return functionsInstance;
}

export function storage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(ensureApp());
    if (useEmulators) connectStorageEmulator(storageInstance, '127.0.0.1', 9199);
  }
  return storageInstance;
}
