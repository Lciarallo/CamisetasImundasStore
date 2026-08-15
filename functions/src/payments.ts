/**
 * Cobrança PIX e confirmação de pagamento.
 *
 * O provedor é o Banco Inter, pela API Pix do BACEN. Duas invariantes mandam
 * em tudo aqui:
 *
 * 1. **O valor cobrado nasce no servidor.** `orders.ts` calcula o total e passa
 *    para cá; nada de dinheiro vem do navegador.
 * 2. **Webhook é aviso, não prova.** Qualquer um pode fazer POST na URL, então
 *    a notificação só serve para dizer *qual* cobrança olhar. Quem confirma o
 *    pagamento é a leitura que fazemos no Inter com as nossas credenciais.
 */
import { createHash } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import type { OrderStatus } from './domain.js';
import { buildPixPayload } from './pixPayload.js';
import {
  createInterCharge,
  fetchInterCharge,
  interTxId,
  isInterConfigured,
  orderIdFromTxId,
  INTER_SECRETS,
} from './interGateway.js';

const REGION = 'southamerica-east1';
const CHARGE_TTL_SECONDS = 30 * 60;

/** Secrets que as funções de cobrança e de webhook precisam ter ligados. */
export const PAYMENT_RUNTIME_SECRETS = INTER_SECRETS;

export interface ChargeRequest {
  /** Identificador criado pelo backend, depois de o total ser calculado. */
  orderId: string;
  amount: number;
  method: 'pix';
  customer: { name: string; email: string; cpf: string };
}

export interface ChargeResult {
  gateway: 'inter' | 'pix-direto';
  providerRef: string;
  status: 'aprovado' | 'pendente' | 'recusado';
  payload?: string;
  expiresAt?: string;
}

function isFirebaseEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true' || Boolean(process.env.FIREBASE_EMULATOR_HUB);
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value * 100);
  return Math.abs(value * 100 - rounded) < 1e-6 && Number.isSafeInteger(rounded) ? rounded : null;
}

function validateChargeRequest(input: ChargeRequest): void {
  if (!input || input.method !== 'pix') {
    throw new Error('O gateway aceita exclusivamente cobranças PIX à vista.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(input.orderId)) {
    throw new Error('Identificador interno de pedido inválido.');
  }
  if (cents(input.amount) === null) throw new Error('Valor interno da cobrança inválido.');

  const cpf = input.customer?.cpf?.replace(/\D/g, '') ?? '';
  if (!input.customer || input.customer.name.trim().length < 3 || cpf.length !== 11) {
    throw new Error('Dados internos do pagador inválidos.');
  }
}

/**
 * API exclusivamente interna. Não é exportada como Cloud Function: `orders.ts`
 * passa aqui somente o total que acabou de calcular, depois de criar o pedido.
 */
export async function createPaymentCharge(input: ChargeRequest): Promise<ChargeResult> {
  validateChargeRequest(input);

  if (!isInterConfigured()) {
    // Um BR Code estático não pode ser invalidado quando a reserva vence: ele
    // segue cobrando depois de o estoque voltar para a prateleira. Em produção,
    // portanto, falhamos fechado. O caminho abaixo serve só à suíte local e usa
    // uma chave deliberadamente não pagável.
    if (!isFirebaseEmulator()) {
      throw new Error('O provedor de cobrança PIX não está configurado.');
    }
    const txId = interTxId(input.orderId);
    const payload = buildPixPayload({
      key: 'pix-emulador@example.invalid',
      merchantName: 'CAMISETAS TESTE',
      merchantCity: 'BRASILIA',
      amount: input.amount,
      txId,
      description: `Pedido ${input.orderId}`,
    });

    logger.info('Cobrança PIX simulada criada (emulador)', { orderId: input.orderId, txId });
    return {
      gateway: 'pix-direto',
      providerRef: `PIX-DIRECT-${txId}`,
      status: 'pendente',
      payload,
      expiresAt: new Date(Date.now() + CHARGE_TTL_SECONDS * 1000).toISOString(),
    };
  }

  const charge = await createInterCharge({
    orderId: input.orderId,
    amount: input.amount,
    expirationSeconds: CHARGE_TTL_SECONDS,
    customer: { name: input.customer.name, cpf: input.customer.cpf },
  });

  return {
    gateway: 'inter',
    providerRef: charge.txid,
    status: charge.status,
    payload: charge.payload,
    expiresAt: charge.expiresAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Confirmação                                                                */
/* -------------------------------------------------------------------------- */

class WebhookError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

interface VerifiedPixPayment {
  orderId: string;
  providerRef: string;
  transactionAmount: number;
  by: string;
}

/**
 * Guarda um pagamento confirmado que não achou pedido em condição de recebê-lo.
 *
 * Sem isto o dinheiro sumiria: o webhook responderia um erro, o Inter desistiria
 * depois das retentativas, e ninguém saberia que entrou dinheiro sem pedido. A
 * lista aparece no painel para alguém resolver — estornar ou reativar.
 */
async function recordUnreconciled(
  providerRef: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const db = getFirestore();
  await db
    .collection('unreconciledPayments')
    .doc(createHash('sha256').update(`inter:${providerRef}`).digest('hex'))
    .set(
      { providerRef, provider: 'inter', detectedAt: new Date().toISOString(), ...detail },
      { merge: true },
    );
  logger.warn('Pagamento PIX recebido sem pedido apto', { providerRef, ...detail });
}

/** Valida pedido e pagamento na mesma transação que promove o status. */
async function markVerifiedPixPaid(payment: VerifiedPixPayment): Promise<'paid' | 'already-paid'> {
  const paidCents = cents(payment.transactionAmount);
  if (paidCents === null) throw new WebhookError(422, 'Valor do pagamento inválido.');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(payment.orderId) ||
    payment.providerRef.length > 160
  ) {
    throw new WebhookError(422, 'Referência de pagamento inválida.');
  }

  const db = getFirestore();
  const ref = db.collection('orders').doc(payment.orderId);
  const eventRef = db
    .collection('paymentEvents')
    .doc(createHash('sha256').update(`inter:${payment.providerRef}`).digest('hex'));

  return db.runTransaction(async (tx) => {
    const [snap, eventSnap] = await tx.getAll(ref, eventRef);
    if (!snap.exists) throw new WebhookError(404, 'Pedido não encontrado.');

    const order = snap.data() as {
      status?: OrderStatus;
      total?: number;
      payment?: { method?: string; providerRef?: string | null };
    };
    const expectedCents = cents(order.total);

    if (order.payment?.method !== 'pix') {
      throw new WebhookError(409, 'O pedido não foi criado para pagamento PIX.');
    }
    if (expectedCents === null || expectedCents !== paidCents) {
      throw new WebhookError(409, 'O valor pago não corresponde ao total do pedido.');
    }
    if (order.status !== 'aguardando-pagamento' && order.status !== 'pago') {
      throw new WebhookError(409, 'O pedido não está apto a receber confirmação.');
    }
    if (eventSnap.exists && eventSnap.data()?.orderId !== payment.orderId) {
      throw new WebhookError(409, 'Esta transação já foi vinculada a outro pedido.');
    }

    const registerEvent = () => {
      if (eventSnap.exists) return;
      tx.create(eventRef, {
        orderId: payment.orderId,
        provider: 'inter',
        providerRef: payment.providerRef,
        confirmedAt: new Date().toISOString(),
      });
    };

    if (order.status === 'pago') {
      if (order.payment.providerRef && order.payment.providerRef !== payment.providerRef) {
        throw new WebhookError(409, 'O pedido já foi pago por outra transação.');
      }
      registerEvent();
      return 'already-paid';
    }

    registerEvent();
    const now = new Date().toISOString();
    tx.update(ref, {
      status: 'pago',
      'payment.status': 'aprovado',
      'payment.settlementRef': payment.providerRef,
      history: FieldValue.arrayUnion({ status: 'pago', at: now, by: payment.by }),
    });
    return 'paid';
  });
}

/**
 * Confirma uma cobrança lendo o Inter, e não o corpo da notificação.
 *
 * O txid é derivado do número do pedido, então a volta de txid para pedido é
 * verificada: se o txid recebido não corresponde ao pedido que ele afirma ser,
 * a notificação é forjada.
 */
async function confirmChargeByTxId(txid: string, orderId: string): Promise<void> {
  if (interTxId(orderId) !== txid) {
    throw new WebhookError(422, 'txid não corresponde ao pedido informado.');
  }

  const proof = await fetchInterCharge(txid);
  if (!proof.paid) return; // Cobrança criada ou expirada: nada a confirmar.
  if (proof.amount === null) {
    throw new WebhookError(422, 'Cobrança liquidada sem valor legível.');
  }

  const providerRef = proof.endToEndId ?? txid;
  try {
    await markVerifiedPixPaid({
      orderId,
      providerRef,
      transactionAmount: proof.amount,
      by: 'Banco Inter (webhook)',
    });
  } catch (cause) {
    // 409 aqui significa dinheiro recebido para um pedido que não pode aceitá-lo
    // — vencido, cancelado ou com outro valor. Não pode virar só um log.
    if (cause instanceof WebhookError && cause.httpStatus === 409) {
      await recordUnreconciled(providerRef, {
        txid,
        orderId,
        amount: proof.amount,
        reason: cause.message,
      });
      return;
    }
    throw cause;
  }
}

function collectTxIds(body: unknown): string[] {
  const found = new Set<string>();
  const entries = (body as { pix?: unknown })?.pix;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const txid = (entry as { txid?: unknown })?.txid;
      if (typeof txid === 'string' && /^[a-zA-Z0-9]{26,35}$/.test(txid)) found.add(txid);
    }
  }
  const single = (body as { txid?: unknown })?.txid;
  if (typeof single === 'string' && /^[a-zA-Z0-9]{26,35}$/.test(single)) found.add(single);
  return [...found];
}

/**
 * Webhook do Inter.
 *
 * Aceita a notificação sem autenticá-la de propósito: ela não decide nada.
 * O corpo só informa quais txids olhar, e cada um é verificado contra a API do
 * Inter antes de qualquer escrita. Um POST forjado, no pior caso, faz o
 * servidor reler uma cobrança e concluir que ela não foi paga.
 */
export const paymentWebhook = onRequest(
  { region: REGION, cors: false, secrets: [...INTER_SECRETS] },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).send('Method Not Allowed');
      return;
    }

    try {
      const txids = collectTxIds(request.body).slice(0, 50);
      if (txids.length === 0) throw new WebhookError(400, 'Notificação sem txid utilizável.');

      for (const txid of txids) {
        const orderId = orderIdFromTxId(txid);
        if (!orderId) {
          // txid legítimo do Inter que não nasceu aqui: registra e segue.
          await recordUnreconciled(txid, { txid, reason: 'txid não corresponde a nenhum pedido.' });
          continue;
        }
        await confirmChargeByTxId(txid, orderId);
      }

      response.status(200).send('ok');
    } catch (error) {
      const status = error instanceof WebhookError ? error.httpStatus : 500;
      logger.warn('Webhook de pagamento rejeitado', {
        httpStatus: status,
        reason: error instanceof Error ? error.message : 'erro desconhecido',
      });
      response.status(status).send(status === 500 ? 'Internal Server Error' : 'Webhook rejected');
    }
  },
);
