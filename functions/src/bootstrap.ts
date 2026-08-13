import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ROLE_PERMISSIONS, type AdminUserDoc, type CouponDoc } from './domain.js';
import { applyStaffAccess, requirePermission } from './auth.js';

const REGION = 'southamerica-east1';

/**
 * Cria o primeiro Mestre.
 *
 * Existe para resolver o ovo e a galinha: criar usuário exige o privilégio
 * `users.edit`, que ninguém tem numa loja recém-instalada. Por isso a função
 * só responde enquanto a coleção `adminUsers` está vazia — depois do primeiro
 * uso ela se fecha sozinha e passa a recusar qualquer chamada.
 */
export const bootstrap = onCall({ region: REGION }, async (request) => {
  const db = getFirestore();

  const existing = await db.collection('adminUsers').limit(1).get();
  if (!existing.empty) {
    throw new HttpsError(
      'failed-precondition',
      'A loja já tem administrador. Use o login normal.',
    );
  }

  const { email, password, name } = (request.data ?? {}) as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpsError('invalid-argument', 'E-mail inválido.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'A senha precisa de ao menos 6 caracteres.');
  }
  if (typeof name !== 'string' || name.trim().length < 2) {
    throw new HttpsError('invalid-argument', 'Nome inválido.');
  }

  const auth = getAuth();

  // A conta pode já existir no Auth sem perfil no Firestore — por exemplo se
  // um bootstrap anterior falhou no meio. Reaproveitar evita travar aí.
  let uid: string;
  try {
    const found = await auth.getUserByEmail(email);
    uid = found.uid;
    await auth.updateUser(uid, { password, displayName: name.trim(), disabled: false });
  } catch {
    const created = await auth.createUser({
      email,
      password,
      displayName: name.trim(),
    });
    uid = created.uid;
  }

  await applyStaffAccess(uid, 'mestre', ROLE_PERMISSIONS.mestre, true);

  const doc: AdminUserDoc = {
    name: name.trim(),
    email,
    role: 'mestre',
    permissions: ROLE_PERMISSIONS.mestre,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.collection('adminUsers').doc(uid).set(doc);

  return { uid, ...doc };
});

/**
 * Popula catálogo e cupons a partir do que o cliente envia.
 *
 * O catálogo inicial mora no front (`src/data/products.ts`), então mandá-lo
 * daqui evita duplicar trezentas linhas de dados num pacote que só existe para
 * validar. As peças passam pela mesma sanitização do CRUD normal.
 */
export const seedCatalog = onCall({ region: REGION }, async (request) => {
  requirePermission(request, 'products.edit');

  const { products, coupons, replace } = (request.data ?? {}) as {
    products?: { id: string; product: unknown }[];
    coupons?: { code: string; coupon: CouponDoc }[];
    replace?: boolean;
  };

  if (!Array.isArray(products) || products.length === 0) {
    throw new HttpsError('invalid-argument', 'Nenhuma peça enviada.');
  }
  if (products.length > 200) {
    throw new HttpsError('invalid-argument', 'Lote grande demais.');
  }

  const db = getFirestore();
  const { sanitizeForSeed } = await import('./catalogSanitizer.js');

  if (replace) {
    const old = await db.collection('products').get();
    // O lote do Firestore aceita 500 operações; o teto acima já cabe nisso.
    const wipe = db.batch();
    old.docs.forEach((doc) => wipe.delete(doc.ref));
    await wipe.commit();
  }

  const batch = db.batch();
  for (const entry of products) {
    if (!entry?.id || typeof entry.id !== 'string') {
      throw new HttpsError('invalid-argument', 'Peça sem identificador.');
    }
    batch.set(db.collection('products').doc(entry.id), sanitizeForSeed(entry.product));
  }

  for (const entry of coupons ?? []) {
    if (!entry?.code || typeof entry.code !== 'string') continue;
    batch.set(db.collection('coupons').doc(entry.code.toUpperCase()), {
      percent: Math.max(0, Math.min(100, Number(entry.coupon?.percent) || 0)),
      minSubtotal: Math.max(0, Number(entry.coupon?.minSubtotal) || 0),
      active: entry.coupon?.active !== false,
    });
  }

  await batch.commit();

  return { products: products.length, coupons: coupons?.length ?? 0 };
});
