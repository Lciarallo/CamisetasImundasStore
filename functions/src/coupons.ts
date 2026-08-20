import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { requirePermission } from './auth.js';

const REGION = 'southamerica-east1';
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;

function couponCode(value: unknown): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(code)) {
    throw new HttpsError(
      'invalid-argument',
      'Use de 3 a 24 caracteres: letras, números, hífen ou sublinhado.',
    );
  }
  return code;
}

export const saveCoupon = onCall({ region: REGION }, async (request) => {
  await requirePermission(request, 'products.edit');

  const { code: rawCode, coupon } = (request.data ?? {}) as {
    code?: unknown;
    coupon?: { percent?: unknown; minSubtotal?: unknown; active?: unknown };
  };
  const code = couponCode(rawCode);
  const percent = Number(coupon?.percent);
  const minSubtotal = Number(coupon?.minSubtotal);

  // Limitar a 80% reduz o estrago de um erro de digitação sem impedir campanhas fortes.
  if (!Number.isFinite(percent) || percent <= 0 || percent > 80) {
    throw new HttpsError('invalid-argument', 'O desconto deve ficar entre 1% e 80%.');
  }
  if (!Number.isFinite(minSubtotal) || minSubtotal < 0 || minSubtotal > 100_000) {
    throw new HttpsError('invalid-argument', 'O pedido mínimo deve ficar entre R$ 0 e R$ 100.000.');
  }

  await getFirestore().collection('coupons').doc(code).set({
    percent: Math.round(percent * 100) / 100,
    minSubtotal: Math.round(minSubtotal * 100) / 100,
    active: coupon?.active === true,
  });

  return { code };
});

export const deleteCoupon = onCall({ region: REGION }, async (request) => {
  await requirePermission(request, 'products.edit');
  const code = couponCode((request.data ?? {}).code);
  await getFirestore().collection('coupons').doc(code).delete();
  return { ok: true };
});
