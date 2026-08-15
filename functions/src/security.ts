import { createHash } from 'node:crypto';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Limitador distribuido simples para callables públicas.
 *
 * O endereço nunca é persistido: somente um hash por janela. App Check continua
 * recomendado, mas não substitui este limite — bots também conseguem executar o
 * frontend legítimo.
 */
export async function enforceRateLimit(
  request: CallableRequest,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const rawRequest = request.rawRequest;
  const source = rawRequest.ip || rawRequest.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucket = Math.floor(now / windowMs);
  const subjectHash = sha256(`${scope}:${source}`).slice(0, 32);
  const ref = getFirestore().collection('rateLimits').doc(`${scope}-${bucket}-${subjectHash}`);

  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = Number(snap.data()?.count ?? 0);
    if (count >= limit) {
      throw new HttpsError('resource-exhausted', 'Muitas tentativas. Aguarde um minuto.');
    }
    tx.set(
      ref,
      {
        count: count + 1,
        expiresAt: Timestamp.fromMillis((bucket + 2) * windowMs),
      },
      { merge: true },
    );
  });
}
