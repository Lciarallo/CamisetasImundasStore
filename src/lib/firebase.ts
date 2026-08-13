import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

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
 *
 * **Só o Firestore entra no pacote inicial.** Auth, Functions e Storage sobem
 * por `import()` sob demanda: quem só olha a vitrine nunca baixa o código de
 * login, de chamada de função nem de upload — junto, isso é a maior parte do
 * SDK. Por isso os acessos abaixo são assíncronos, e devolvem a instância
 * junto com o módulo (as funções soltas, tipo `signInWithEmailAndPassword`,
 * moram no mesmo pacote e seriam um segundo `import()` à toa).
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
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase não configurado. Defina as variáveis VITE_FIREBASE_*.');
  }
  if (!app) app = initializeApp(config);
  return app;
}

/** Único módulo carregado de imediato: é dele que sai a vitrine. */
export function firestore(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(ensureApp());
    if (useEmulators) connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
  }
  return dbInstance;
}

/* -------------------------------------------------------------------------- */
/* Módulos sob demanda                                                        */
/* -------------------------------------------------------------------------- */

type AuthModule = typeof import('firebase/auth');
type FunctionsModule = typeof import('firebase/functions');
type StorageModule = typeof import('firebase/storage');

// As promessas ficam guardadas, não só as instâncias: assim duas chamadas
// simultâneas esperam o mesmo `import()` em vez de disparar dois.
let authPromise: Promise<AuthModule & { auth: ReturnType<AuthModule['getAuth']> }> | null = null;
let functionsPromise: Promise<
  FunctionsModule & { fns: ReturnType<FunctionsModule['getFunctions']> }
> | null = null;
let storagePromise: Promise<
  StorageModule & { bucket: ReturnType<StorageModule['getStorage']> }
> | null = null;

export function loadAuth() {
  if (!authPromise) {
    authPromise = import('firebase/auth').then((api) => {
      const auth = api.getAuth(ensureApp());
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
    functionsPromise = import('firebase/functions').then((api) => {
      const fns = api.getFunctions(ensureApp(), FUNCTIONS_REGION);
      if (useEmulators) api.connectFunctionsEmulator(fns, '127.0.0.1', 5001);
      return { ...api, fns };
    });
  }
  return functionsPromise;
}

export function loadStorage() {
  if (!storagePromise) {
    storagePromise = import('firebase/storage').then((api) => {
      const bucket = api.getStorage(ensureApp());
      if (useEmulators) api.connectStorageEmulator(bucket, '127.0.0.1', 9199);
      return { ...api, bucket };
    });
  }
  return storagePromise;
}
