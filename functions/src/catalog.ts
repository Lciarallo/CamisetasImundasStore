import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { SIZES, type ProductDoc, type Size } from './domain.js';
import { sanitizeProduct } from './catalogSanitizer.js';
import { requirePermission } from './auth.js';

const REGION = 'southamerica-east1';

export const saveProduct = onCall({ region: REGION }, async (request) => {
  requirePermission(request, 'products.edit');

  const { id, product } = (request.data ?? {}) as { id?: string; product?: unknown };
  if (!id || typeof id !== 'string' || id.length > 120 || id.includes('/')) {
    throw new HttpsError('invalid-argument', 'Identificador de peça inválido.');
  }

  const clean = sanitizeProduct(product);
  await getFirestore().collection('products').doc(id).set(clean);

  return { id, product: clean };
});

export const deleteProduct = onCall({ region: REGION }, async (request) => {
  requirePermission(request, 'products.edit');

  const { id } = (request.data ?? {}) as { id?: string };
  if (!id || typeof id !== 'string') {
    throw new HttpsError('invalid-argument', 'Peça não informada.');
  }

  await getFirestore().collection('products').doc(id).delete();

  // Apaga as fotos junto; deixá-las no bucket vazaria custo de armazenamento
  // para sempre, sem nada apontando para elas.
  try {
    await getStorage().bucket().deleteFiles({ prefix: `products/${id}/` });
  } catch {
    // O documento já foi embora; falha ao limpar o bucket não desfaz a exclusão.
  }

  return { ok: true };
});

/**
 * Ajuste de estoque separado do CRUD: quem cuida do estoque (Acólito) não
 * necessariamente pode editar preço e descrição.
 */
export const setStock = onCall({ region: REGION }, async (request) => {
  requirePermission(request, 'stock.edit');

  const { productId, size, value, delta } = (request.data ?? {}) as {
    productId?: string;
    size?: Size;
    value?: number;
    delta?: number;
  };

  if (!productId || typeof productId !== 'string') {
    throw new HttpsError('invalid-argument', 'Peça não informada.');
  }
  if (!SIZES.includes(size as Size)) {
    throw new HttpsError('invalid-argument', 'Tamanho inválido.');
  }

  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const ref = db.collection('products').doc(productId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Peça não encontrada.');

    const product = snap.data() as ProductDoc;
    if (product.fulfillment === 'sob-encomenda') {
      throw new HttpsError('failed-precondition', 'Peça sob encomenda não tem estoque.');
    }

    const current = product.stock?.[size as Size] ?? 0;
    // `delta` para os botões de mais/menos, `value` para digitar direto.
    // Ler dentro da transação evita perder um ajuste feito em paralelo.
    const next = typeof delta === 'number' ? current + delta : Number(value);

    if (!Number.isFinite(next)) throw new HttpsError('invalid-argument', 'Valor inválido.');

    tx.update(ref, {
      [`stock.${size}`]: Math.max(0, Math.min(100_000, Math.trunc(next))),
    });
  });

  return { ok: true };
});
