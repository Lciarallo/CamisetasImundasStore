import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';

/**
 * Inicialização do Firebase com carregamento 100% dinâmico e sob demanda.
 *
 * O SDK do Firebase é grande (~700KB). Ao adiar a importação de todos os módulos
 * (inclusive Firestore) para chamadas dinâmicas sob demanda, o bundle inicial da loja
 * renderiza em menos de 100ms sem bloquear FCP, LCP ou TTI.
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

let appPromise: Promise<FirebaseApp> | null = null;

export function ensureApp(): Promise<FirebaseApp> {
  if (!isFirebaseConfigured) {
    return Promise.reject(
      new Error('Firebase não configurado. Defina as variáveis VITE_FIREBASE_*.'),
    );
  }
  if (!appPromise) {
    appPromise = import('firebase/app').then((m) => m.initializeApp(config));
  }
  return appPromise;
}

type FirestoreModule = typeof import('firebase/firestore');
type AuthModule = typeof import('firebase/auth');
type FunctionsModule = typeof import('firebase/functions');
type StorageModule = typeof import('firebase/storage');

let firestorePromise: Promise<FirestoreModule & { db: Firestore }> | null = null;
let authPromise: Promise<AuthModule & { auth: ReturnType<AuthModule['getAuth']> }> | null = null;
let functionsPromise: Promise<
  FunctionsModule & { fns: ReturnType<FunctionsModule['getFunctions']> }
> | null = null;
let storagePromise: Promise<
  StorageModule & { bucket: ReturnType<StorageModule['getStorage']> }
> | null = null;

export function loadFirestore() {
  if (!firestorePromise) {
    firestorePromise = Promise.all([ensureApp(), import('firebase/firestore')]).then(
      ([app, api]) => {
        const db = api.getFirestore(app);
        if (useEmulators) api.connectFirestoreEmulator(db, '127.0.0.1', 8080);
        return { ...api, db };
      },
    );
  }
  return firestorePromise;
}

export function loadAuth() {
  if (!authPromise) {
    authPromise = Promise.all([ensureApp(), import('firebase/auth')]).then(([app, api]) => {
      const auth = api.getAuth(app);
      if (useEmulators) {
        api.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      }
      return { ...api, auth };
    });
  }
  return authPromise;
}

export function loadFunctions() {
  if (!functionsPromise) {
    functionsPromise = Promise.all([ensureApp(), import('firebase/functions')]).then(
      ([app, api]) => {
        const fns = api.getFunctions(app, FUNCTIONS_REGION);
        if (useEmulators) api.connectFunctionsEmulator(fns, '127.0.0.1', 5001);
        return { ...api, fns };
      },
    );
  }
  return functionsPromise;
}

export function loadStorage() {
  if (!storagePromise) {
    storagePromise = Promise.all([ensureApp(), import('firebase/storage')]).then(
      ([app, api]) => {
        const bucket = api.getStorage(app);
        if (useEmulators) api.connectStorageEmulator(bucket, '127.0.0.1', 9199);
        return { ...api, bucket };
      },
    );
  }
  return storagePromise;
}
