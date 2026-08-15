import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest, type Request } from 'firebase-functions/v2/https';
import type { OrderStatus } from './domain.js';
import { buildPixPayload } from './pixPayload.js';

const REGION = 'southamerica-east1';
const CURRENCY = 'BRL';
const CHARGE_TTL_MS = 30 * 60_000;
const WEBHOOK_CLOCK_TOLERANCE_MS = 5 * 60_000;
const PROVIDER_TIMEOUT_MS = 10_000;

/**
 * Nomes aceitos tanto como variáveis de ambiente quanto como secrets ligados
 * à Cloud Function. O chamador interno que usar createPaymentCharge deve ligar
 * MERCADO_PAGO_ACCESS_TOKEN nas opções da própria função.
 */
export const PAYMENT_RUNTIME_SECRETS = ['MERCADO_PAGO_ACCESS_TOKEN'] as const;

const PAYMENT_WEBHOOK_SECRETS = [
  'MERCADO_PAGO_ACCESS_TOKEN',
  'MERCADO_PAGO_WEBHOOK_SECRET',
] as const;

export interface ChargeRequest {
  /** Identificador criado pelo backend, depois de o total ser calculado. */
  orderId: string;
  amount: number;
  method: 'pix';
  customer: { name: string; email: string; cpf: string };
}

export interface ChargeResult {
  gateway: 'mercadopago' | 'pix-direto';
  providerRef: string;
  status: 'aprovado' | 'pendente' | 'recusado';
  payload?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt?: string;
}

export interface PaymentGateway {
  readonly name: string;
  createCharge(input: ChargeRequest): Promise<ChargeResult>;
}

interface MercadoPagoPayment {
  id: number | string;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  payment_method_id?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value !== '__EMULATOR_DISABLED__' ? value : undefined;
}

function isFirebaseEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true' || Boolean(process.env.FIREBASE_EMULATOR_HUB);
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value * 100);
  return Math.abs(value * 100 - rounded) < 1e-6 && Number.isSafeInteger(rounded)
    ? rounded
    : null;
}

/**
 * Converte o vencimento devolvido pelo provedor para ISO em UTC.
 *
 * O Mercado Pago responde com o deslocamento da conta (`...-03:00`), e esse
 * valor termina em `reservationExpiresAt`, que o agendador consulta com
 * `where('reservationExpiresAt', '<=', now)`. Firestore compara string byte a
 * byte: `2026-08-15T00:30:00.000-03:00` (03:30Z) aparece como *menor* que
 * `2026-08-15T01:00:00.000Z`, e uma cobrança ainda pagável seria cancelada com
 * o estoque devolvido — enquanto o cliente continua com um QR Code válido nas
 * mãos. Normalizar aqui, na entrada, mantém o resto do sistema com a única
 * invariante que ele já assume: ISO sempre em UTC.
 */
function toUtcIso(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
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
  if (
    !input.customer ||
    input.customer.name.trim().length < 3 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.customer.email.trim()) ||
    cpf.length !== 11
  ) {
    throw new Error('Dados internos do pagador inválidos.');
  }
}

function deterministicUuid(orderId: string): string {
  const hash = createHash('sha256')
    .update(`camisetas-imundas:mercado-pago:pix:${orderId}`)
    .digest('hex');
  // UUID determinístico: retries do mesmo pedido recebem a mesma cobrança.
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function directPixTxId(orderId: string): string {
  return `CI${createHash('sha256').update(`pix:${orderId}`).digest('hex').slice(0, 23)}`.toUpperCase();
}

function paymentWebhookUrl(): string {
  const configured = env('PAYMENT_WEBHOOK_URL');
  if (configured) return configured;
  const projectId = env('GCLOUD_PROJECT') ?? env('GCP_PROJECT') ?? 'camisetas-imundas-store';
  return `https://${REGION}-${projectId}.cloudfunctions.net/paymentWebhook`;
}

class MercadoPagoGateway implements PaymentGateway {
  readonly name = 'mercadopago';

  async createCharge(input: ChargeRequest): Promise<ChargeResult> {
    validateChargeRequest(input);

    const expiresAt = new Date(Date.now() + CHARGE_TTL_MS).toISOString();
    const token = env('MERCADO_PAGO_ACCESS_TOKEN');

    if (!token) {
      // Um BR Code estático não pode ser invalidado pelo banco quando a reserva
      // vence. Em produção, portanto, falhamos fechado e exigimos um PSP que
      // emita cobrança dinâmica com expiração real. O fallback serve somente
      // à suíte local dos emuladores e usa uma chave deliberadamente não pagável.
      if (!isFirebaseEmulator()) {
        throw new Error('O provedor de cobrança PIX não está configurado.');
      }
      const txId = directPixTxId(input.orderId);
      const payload = buildPixPayload({
        key: 'pix-emulador@example.invalid',
        merchantName: 'CAMISETAS TESTE',
        merchantCity: 'BRASILIA',
        amount: input.amount,
        txId,
        description: `Pedido ${input.orderId}`,
      });

      logger.info('Cobrança PIX direta criada', { orderId: input.orderId, txId });
      return {
        gateway: 'pix-direto',
        providerRef: `PIX-DIRECT-${txId}`,
        status: 'pendente',
        payload,
        expiresAt,
      };
    }

    const names = input.customer.name.trim().split(/\s+/);
    const firstName = names[0] || 'Cliente';
    const lastName = names.slice(1).join(' ') || 'Insanas';
    const cleanCpf = input.customer.cpf.replace(/\D/g, '');

    let response: globalThis.Response;
    try {
      response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': deterministicUuid(input.orderId),
        },
        body: JSON.stringify({
          transaction_amount: Number(input.amount.toFixed(2)),
          description: `Camisetas Insanas - Pedido #${input.orderId}`,
          payment_method_id: 'pix',
          date_of_expiration: expiresAt,
          payer: {
            email: input.customer.email.trim(),
            first_name: firstName,
            last_name: lastName,
            identification: { type: 'CPF', number: cleanCpf },
          },
          external_reference: input.orderId,
          notification_url: paymentWebhookUrl(),
        }),
      });
    } catch (error) {
      logger.error('Mercado Pago indisponível ao criar cobrança PIX', {
        orderId: input.orderId,
        error: error instanceof Error ? error.message : 'erro desconhecido',
      });
      throw new Error('Não foi possível criar a cobrança PIX no provedor configurado.');
    }

    if (!response.ok) {
      logger.error('Mercado Pago recusou a criação da cobrança PIX', {
        orderId: input.orderId,
        httpStatus: response.status,
      });
      // Falha fechada: quando o MP está configurado, nunca emitimos um PIX
      // direto silenciosamente para uma cobrança que o provedor recusou.
      throw new Error('Não foi possível criar a cobrança PIX no provedor configurado.');
    }

    let data: MercadoPagoPayment;
    try {
      data = (await response.json()) as MercadoPagoPayment;
    } catch {
      throw new Error('O provedor retornou uma cobrança PIX inválida.');
    }

    const txData = data.point_of_interaction?.transaction_data;
    if (!data.id || !txData?.qr_code) {
      logger.error('Mercado Pago retornou cobrança PIX sem identificador ou QR Code', {
        orderId: input.orderId,
      });
      throw new Error('O provedor retornou uma cobrança PIX incompleta.');
    }

    return {
      gateway: 'mercadopago',
      providerRef: String(data.id),
      status:
        data.status === 'approved'
          ? 'aprovado'
          : data.status === 'rejected'
            ? 'recusado'
            : 'pendente',
      payload: txData.qr_code,
      qrCodeBase64: txData.qr_code_base64,
      ticketUrl: txData.ticket_url,
      expiresAt: toUtcIso(data.date_of_expiration, expiresAt),
    };
  }
}

export const gateway: PaymentGateway = new MercadoPagoGateway();

/**
 * API exclusivamente interna. Ela não é registrada/exportada como Cloud
 * Function: orders.ts passa aqui somente o total que acabou de calcular no
 * servidor, depois de criar o identificador do pedido.
 */
export async function createPaymentCharge(input: ChargeRequest): Promise<ChargeResult> {
  return gateway.createCharge(input);
}

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
  currencyId: string;
  provider: 'mercadopago';
  by: string;
}

/** Valida pedido e pagamento na mesma transação que promove o status. */
async function markVerifiedPixPaid(payment: VerifiedPixPayment): Promise<'paid' | 'already-paid'> {
  const paidCents = cents(payment.transactionAmount);
  if (paidCents === null || payment.currencyId !== CURRENCY) {
    throw new WebhookError(422, 'Valor ou moeda do pagamento inválidos.');
  }
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
    .doc(createHash('sha256').update(`${payment.provider}:${payment.providerRef}`).digest('hex'));

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

    if (
      payment.provider === 'mercadopago' &&
      order.payment?.providerRef &&
      order.payment.providerRef !== payment.providerRef
    ) {
      throw new WebhookError(409, 'A cobrança não corresponde ao pedido informado.');
    }

    if (order.status === 'pago') {
      if (order.payment.providerRef && order.payment.providerRef !== payment.providerRef) {
        throw new WebhookError(409, 'O pedido já foi pago por outra transação.');
      }
      if (!eventSnap.exists) {
        tx.create(eventRef, {
          orderId: payment.orderId,
          provider: payment.provider,
          providerRef: payment.providerRef,
          confirmedAt: new Date().toISOString(),
        });
      }
      return 'already-paid';
    }

    if (!eventSnap.exists) {
      tx.create(eventRef, {
        orderId: payment.orderId,
        provider: payment.provider,
        providerRef: payment.providerRef,
        confirmedAt: new Date().toISOString(),
      });
    }
    tx.update(ref, {
      status: 'pago',
      'payment.status': 'aprovado',
      'payment.providerRef': payment.providerRef,
      history: FieldValue.arrayUnion({
        status: 'pago',
        at: new Date().toISOString(),
        by: payment.by,
      }),
    });
    return 'paid';
  });
}

function safeHexEqual(received: string, expected: string): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(received) || !/^[a-fA-F0-9]{64}$/.test(expected)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
}

function timestampWithinWindow(rawTimestamp: string): boolean {
  if (!/^\d{10,16}$/.test(rawTimestamp)) return false;
  const parsed = Number(rawTimestamp);
  if (!Number.isSafeInteger(parsed)) return false;
  const timestampMs = parsed < 100_000_000_000 ? parsed * 1000 : parsed;
  return Math.abs(Date.now() - timestampMs) <= WEBHOOK_CLOCK_TOLERANCE_MS;
}

function scalar(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }
  return undefined;
}

/** Validação HMAC-SHA256 definida oficialmente pelo Mercado Pago. */
function validateMercadoPagoSignature(request: Request, dataId: string, secret: string): boolean {
  const signature = request.get('x-signature');
  const requestId = request.get('x-request-id');
  if (!signature || !requestId || !dataId) return false;

  let timestamp: string | undefined;
  let receivedHash: string | undefined;
  for (const part of signature.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 'ts') timestamp = value;
    if (key === 'v1') receivedHash = value;
  }
  if (!timestamp || !receivedHash || !timestampWithinWindow(timestamp)) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  return safeHexEqual(receivedHash, expected);
}

async function fetchMercadoPagoPayment(paymentId: string, token: string): Promise<MercadoPagoPayment> {
  let response: globalThis.Response;
  try {
    response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      },
    );
  } catch (error) {
    logger.error('Falha de rede ao consultar pagamento no Mercado Pago', {
      paymentId,
      error: error instanceof Error ? error.message : 'erro desconhecido',
    });
    throw new WebhookError(502, 'Falha ao consultar o provedor.');
  }

  if (!response.ok) {
    logger.error('Mercado Pago recusou a consulta do pagamento', {
      paymentId,
      httpStatus: response.status,
    });
    throw new WebhookError(502, 'Falha ao consultar o provedor.');
  }

  try {
    return (await response.json()) as MercadoPagoPayment;
  } catch {
    throw new WebhookError(502, 'Resposta inválida do provedor.');
  }
}

async function handleMercadoPagoWebhook(request: Request, paymentId: string): Promise<void> {
  if (!/^\d{1,30}$/.test(paymentId)) {
    throw new WebhookError(400, 'Identificador Mercado Pago inválido.');
  }
  const token = env('MERCADO_PAGO_ACCESS_TOKEN');
  if (!token) throw new WebhookError(503, 'Provedor não configurado.');

  const webhookSecret = env('MERCADO_PAGO_WEBHOOK_SECRET');
  if (!webhookSecret) throw new WebhookError(503, 'Assinatura do provedor não configurada.');
  if (!validateMercadoPagoSignature(request, paymentId, webhookSecret)) {
    throw new WebhookError(401, 'Assinatura Mercado Pago inválida.');
  }

  const info = await fetchMercadoPagoPayment(paymentId, token);
  if (String(info.id) !== paymentId) {
    throw new WebhookError(502, 'Identificador divergente retornado pelo provedor.');
  }
  if (info.status !== 'approved') return;
  if (
    !info.external_reference ||
    info.payment_method_id !== 'pix' ||
    cents(info.transaction_amount) === null ||
    info.currency_id !== CURRENCY
  ) {
    throw new WebhookError(422, 'Pagamento aprovado com dados incompletos ou incompatíveis.');
  }

  await markVerifiedPixPaid({
    orderId: info.external_reference,
    providerRef: String(info.id),
    transactionAmount: info.transaction_amount!,
    currencyId: info.currency_id,
    provider: 'mercadopago',
    by: 'Mercado Pago (Webhook)',
  });
}

/** Webhook autenticado exclusivamente pelo manifesto oficial do Mercado Pago. */
export const paymentWebhook = onRequest(
  {
    region: REGION,
    cors: false,
    secrets: [...PAYMENT_WEBHOOK_SECRETS],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).send('Method Not Allowed');
      return;
    }

    try {
      const body = (request.body ?? {}) as {
        type?: unknown;
        topic?: unknown;
        action?: unknown;
        data?: { id?: unknown };
        id?: unknown;
      };
      const topic = scalar(request.query.topic) ?? scalar(request.query.type) ?? scalar(body.type) ?? scalar(body.topic);
      const action = scalar(body.action);
      const queryDataId = scalar(request.query['data.id']);
      const paymentId = queryDataId ?? scalar(request.query.id) ?? scalar(body.data?.id) ?? scalar(body.id);
      const isMercadoPago =
        Boolean(paymentId) && (topic === 'payment' || Boolean(action?.startsWith('payment.')));

      if (!isMercadoPago || !queryDataId) {
        throw new WebhookError(401, 'Notificação de pagamento não autenticável.');
      }
      await handleMercadoPagoWebhook(request, paymentId!);

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
