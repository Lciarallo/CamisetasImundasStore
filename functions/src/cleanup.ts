/**
 * Ferramentas administrativas de limpeza de dados de teste e reenvio de e-mails.
 */
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { requirePermission } from './auth.js';
import { sendOrderStatusEmail, type EmailEventType, RESEND_SECRETS } from './emailService.js';

const REGION = 'southamerica-east1';

/**
 * Limpa todo o histórico de testes (pedidos, eventos de pagamento e conciliação).
 * Apenas administradores com privilégio mestre podem executar.
 */
export const clearTestHistory = onCall({ region: REGION }, async (request) => {
  await requirePermission(request, 'users.edit');

  const db = getFirestore();

  // 1. Apaga todos os pedidos
  const ordersSnap = await db.collection('orders').get();
  const orderBatch = db.batch();
  ordersSnap.docs.forEach((d) => orderBatch.delete(d.ref));
  await orderBatch.commit();

  // 2. Apaga todos os eventos de pagamento
  const eventsSnap = await db.collection('paymentEvents').get();
  const eventsBatch = db.batch();
  eventsSnap.docs.forEach((d) => eventsBatch.delete(d.ref));
  await eventsBatch.commit();

  // 3. Apaga pagamentos não conciliados
  const unrecSnap = await db.collection('unreconciledPayments').get();
  const unrecBatch = db.batch();
  unrecSnap.docs.forEach((d) => unrecBatch.delete(d.ref));
  await unrecBatch.commit();

  // 4. Reseta o contador de pedidos para 20000
  await db.collection('counters').doc('orderNumber').set({ value: 20000 }, { merge: true });

  return {
    ok: true,
    deletedOrders: ordersSnap.size,
    deletedEvents: eventsSnap.size,
    deletedUnreconciled: unrecSnap.size,
    resetCounterTo: 20000,
  };
});

/**
 * Permite ao lojista reenviar o e-mail transacional de qualquer etapa para o cliente.
 */
export const resendOrderEmail = onCall(
  { region: REGION, secrets: [...RESEND_SECRETS] },
  async (request) => {
    await requirePermission(request, 'orders.edit');

    const { orderId, event } = (request.data ?? {}) as {
      orderId?: string;
      event?: EmailEventType;
    };

    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'Identificador de pedido não informado.');
    }
    if (!event || typeof event !== 'string') {
      throw new HttpsError('invalid-argument', 'Etapa de e-mail não informada.');
    }

    const db = getFirestore();
    const snap = await db.collection('orders').doc(orderId.trim().toUpperCase()).get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Pedido não encontrado.');
    }

    const order = { id: snap.id, ...snap.data() };
    const result = await sendOrderStatusEmail(order, event);

    return { ok: true, ...result };
  },
);
