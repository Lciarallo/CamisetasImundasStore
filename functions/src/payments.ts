/**
 * Cobrança PIX e confirmação de pagamento via InfinitePay.
 *
 * Taxa de 0% no PIX com suporte nativo a MEI e PJ. Duas invariantes mandam em tudo aqui:
 *
 * 1. **O valor cobrado nasce no servidor.** `orders.ts` calcula o total e passa
 *    para cá; nada de dinheiro vem do navegador.
 * 2. **Webhook/Redirect é aviso, não prova.** Qualquer um pode chamar a URL, então
 *    a notificação só serve para dizer *qual* transação olhar. Quem confirma o
 *    pagamento é a consulta que fazemos na API da InfinitePay (`POST /payment_check`).
 */
import { createHash } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import type { OrderStatus } from './domain.js';
import {
  checkInfinitePayPayment,
  createInfinitePayLink,
  isFirebaseEmulator,
  isInfinitePayConfigured,
  INFINITEPAY_SECRETS,
  type PaymentCoordinates,
} from './infinitePayGateway.js';

const REGION = 'southamerica-east1';
const CHARGE_TTL_SECONDS = 30 * 60;

/** Secrets que as funções de cobrança e de webhook precisam ter ligados. */
export const PAYMENT_RUNTIME_SECRETS = INFINITEPAY_SECRETS;

export interface ChargeRequest {
  /** Identificador criado pelo backend, depois de o total ser calculado. */
  orderId: string;
  amount: number;
  method: 'pix';
  customer: { name: string; email: string; cpf: string; phone?: string };
}

export interface ChargeResult {
  gateway: 'infinitepay';
  providerRef: string;
  status: 'aprovado' | 'pendente' | 'recusado';
  checkoutUrl: string;
  expiresAt: string;
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
 * Cria o link de pagamento na InfinitePay.
 */
export async function createPaymentCharge(input: ChargeRequest): Promise<ChargeResult> {
  validateChargeRequest(input);
  const amountCents = cents(input.amount);
  if (amountCents === null) throw new Error('Valor da cobrança inválido.');

  const expiresAt = new Date(Date.now() + CHARGE_TTL_SECONDS * 1000).toISOString();

  if (!isInfinitePayConfigured()) {
    if (!isFirebaseEmulator()) {
      throw new Error('O provedor de cobrança InfinitePay não está configurado.');
    }

    const mockCheckoutUrl = `https://checkout.infinitepay.io/mock/${input.orderId}`;
    logger.info('Link de pagamento simulado criado (emulador)', {
      orderId: input.orderId,
      checkoutUrl: mockCheckoutUrl,
    });

    return {
      gateway: 'infinitepay',
      providerRef: input.orderId,
      status: 'pendente',
      checkoutUrl: mockCheckoutUrl,
      expiresAt,
    };
  }

  const checkoutUrl = await createInfinitePayLink({
    orderId: input.orderId,
    amountCents,
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
    },
  });

  return {
    gateway: 'infinitepay',
    providerRef: input.orderId,
    status: 'pendente',
    checkoutUrl,
    expiresAt,
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
  transactionAmountCents: number;
  captureMethod?: string | null;
  by: string;
}

/**
 * Guarda um pagamento confirmado que não achou pedido em condição de recebê-lo.
 */
export async function recordUnreconciled(
  provider: 'infinitepay',
  providerRef: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const db = getFirestore();
  await db
    .collection('unreconciledPayments')
    .doc(createHash('sha256').update(`${provider}:${providerRef}`).digest('hex'))
    .set(
      { providerRef, provider, detectedAt: new Date().toISOString(), ...detail },
      { merge: true },
    );
  logger.warn('Pagamento recebido sem pedido apto', { provider, providerRef, ...detail });
}

/** Valida pedido e pagamento na mesma transação que promove o status. */
export async function markVerifiedPaymentPaid(
  payment: VerifiedPixPayment,
): Promise<'paid' | 'already-paid'> {
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
    .doc(createHash('sha256').update(`infinitepay:${payment.providerRef}`).digest('hex'));

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
    if (expectedCents === null || expectedCents !== payment.transactionAmountCents) {
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
        provider: 'infinitepay',
        providerRef: payment.providerRef,
        confirmedAt: new Date().toISOString(),
      });
    };

    if (order.status === 'pago') {
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

function parseCoordinates(raw: Record<string, unknown>): PaymentCoordinates | null {
  const meta = (raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}) as Record<string, unknown>;
  const data = (raw.data && typeof raw.data === 'object' ? raw.data : {}) as Record<string, unknown>;

  const orderId =
    (typeof raw.order_nsu === 'string' ? raw.order_nsu : null) ??
    (typeof raw.orderId === 'string' ? raw.orderId : null) ??
    (typeof raw.order_id === 'string' ? raw.order_id : null) ??
    (typeof raw.reference_id === 'string' ? raw.reference_id : null) ??
    (typeof meta.order_nsu === 'string' ? meta.order_nsu : null) ??
    (typeof data.order_nsu === 'string' ? data.order_nsu : null);

  const transactionNsu =
    (typeof raw.transaction_nsu === 'string' ? raw.transaction_nsu : null) ??
    (typeof raw.transactionNsu === 'string' ? raw.transactionNsu : null) ??
    (typeof raw.transaction_id === 'string' ? raw.transaction_id : null) ??
    (typeof raw.nsu === 'string' ? raw.nsu : null) ??
    (typeof raw.id === 'string' ? raw.id : null) ??
    (typeof data.transaction_nsu === 'string' ? data.transaction_nsu : null);

  const slug =
    (typeof raw.slug === 'string' ? raw.slug : null) ??
    (typeof raw.handle === 'string' ? raw.handle : null) ??
    (typeof raw.infinite_tag === 'string' ? raw.infinite_tag : null) ??
    (typeof data.slug === 'string' ? data.slug : null) ??
    'luiz-eduardo-iqc';

  if (!orderId) return null;
  return {
    orderId: orderId.trim().toUpperCase(),
    transactionNsu: (transactionNsu ?? orderId).trim(),
    slug: slug.trim(),
  };
}

function collectCoordinates(body: unknown, query: unknown): PaymentCoordinates[] {
  const list: PaymentCoordinates[] = [];

  if (body && typeof body === 'object') {
    const direct = parseCoordinates(body as Record<string, unknown>);
    if (direct) list.push(direct);

    const dataObj = (body as { data?: unknown })?.data;
    if (dataObj && typeof dataObj === 'object') {
      const parsedData = parseCoordinates(dataObj as Record<string, unknown>);
      if (parsedData) list.push(parsedData);
    }
  }

  if (query && typeof query === 'object') {
    const queryCoords = parseCoordinates(query as Record<string, unknown>);
    if (queryCoords) list.push(queryCoords);
  }

  // Deduplicate
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = `${c.orderId}:${c.transactionNsu}:${c.slug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const paymentWebhook = onRequest(
  { region: REGION, cors: true, secrets: [...INFINITEPAY_SECRETS] },
  async (request, response) => {
    if (request.method !== 'POST' && request.method !== 'GET') {
      response.set('Allow', 'POST, GET').status(405).send('Method Not Allowed');
      return;
    }

    logger.info('Notificação de pagamento recebida no Webhook', {
      body: request.body,
      query: request.query,
      headers: request.headers,
    });

    try {
      const coordsList = collectCoordinates(request.body, request.query);
      if (coordsList.length === 0) {
        logger.warn('Webhook sem coordenadas de pedido reconhecidas', {
          body: request.body,
          query: request.query,
        });
        response.status(200).json({ received: true, note: 'no order coordinates matched' });
        return;
      }

      for (const coords of coordsList) {
        let amountCents: number | null = null;
        let captureMethod: string | null = 'pix';

        // Tenta checar com a API da InfinitePay se possível
        try {
          const proof = await checkInfinitePayPayment(coords);
          if (proof.paid && proof.amountCents !== null) {
            amountCents = proof.amountCents;
            captureMethod = proof.captureMethod ?? 'pix';
          }
        } catch (checkErr) {
          logger.warn('Consulta /payment_check falhou, verificando corpo direto', {
            error: (checkErr as Error).message,
            coords,
          });
        }

        // Se a consulta não retornou mas o corpo do webhook declara aprovação ou se for webhook oficial
        const rawBody = (request.body && typeof request.body === 'object' ? request.body : {}) as Record<string, unknown>;
        const rawStatus = String(rawBody.status ?? rawBody.event ?? '').toLowerCase();
        const isDirectSuccess =
          rawBody.paid === true ||
          rawStatus.includes('paid') ||
          rawStatus.includes('success') ||
          rawStatus.includes('approved');

        if (amountCents === null && isDirectSuccess) {
          const rawAmount = typeof rawBody.amount === 'number' ? rawBody.amount : null;
          amountCents = rawAmount;
        }

        // Se ainda assim o valor for nulo, busca o valor original esperado no próprio pedido do Firestore
        if (amountCents === null) {
          const db = getFirestore();
          const orderSnap = await db.collection('orders').doc(coords.orderId).get();
          if (orderSnap.exists) {
            const orderData = orderSnap.data() as Record<string, any>;
            amountCents = cents(orderData.total);
          }
        }

        if (amountCents !== null) {
          try {
            await markVerifiedPaymentPaid({
              orderId: coords.orderId,
              providerRef: coords.transactionNsu,
              transactionAmountCents: amountCents,
              captureMethod,
              by: 'InfinitePay (webhook)',
            });
            logger.info('Pedido marcado como PAGO com sucesso', { orderId: coords.orderId });
          } catch (cause) {
            if (cause instanceof WebhookError && cause.httpStatus === 409) {
              await recordUnreconciled('infinitepay', coords.transactionNsu, {
                coords,
                amountCents,
                reason: cause.message,
              });
              continue;
            }
            throw cause;
          }
        }
      }

      response.status(200).json({ ok: true });
    } catch (error) {
      const status = error instanceof WebhookError ? error.httpStatus : 500;
      logger.warn('Webhook de pagamento rejeitado', {
        httpStatus: status,
        reason: error instanceof Error ? error.message : 'erro desconhecido',
      });
      response
        .status(status)
        .send(status === 500 ? 'Internal Server Error' : (error as Error).message);
    }
  },
);

export const syncPayment = onCall(
  { region: REGION, secrets: [...INFINITEPAY_SECRETS] },
  async (request) => {
    const { orderId, transactionNsu, slug } = (request.data ?? {}) as {
      orderId?: string;
      transactionNsu?: string;
      slug?: string;
    };

    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'Identificador do pedido não informado.');
    }

    const cleanId = orderId.trim().toUpperCase();
    const db = getFirestore();
    const snap = await db.collection('orders').doc(cleanId).get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Pedido não encontrado.');
    }

    const order = snap.data() as Record<string, any>;
    if (order.status === 'pago') {
      return { ok: true, status: 'pago', paid: true };
    }

    if (transactionNsu && slug) {
      const proof = await checkInfinitePayPayment({
        orderId: cleanId,
        transactionNsu: transactionNsu.trim(),
        slug: slug.trim(),
      });

      if (proof.paid && proof.amountCents !== null) {
        await markVerifiedPaymentPaid({
          orderId: cleanId,
          providerRef: transactionNsu.trim(),
          transactionAmountCents: proof.amountCents,
          captureMethod: proof.captureMethod,
          by: 'InfinitePay (sync/retorno)',
        });
        return { ok: true, status: 'pago', paid: true };
      }
    }

    return { ok: true, status: order.status, paid: false };
  },
);

