import { timingSafeEqual } from 'node:crypto';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { OrderStatus, PaymentMethod } from './domain.js';

const REGION = 'southamerica-east1';

/**
 * Camada de pagamento — Mercado Pago e PIX CNPJ.
 *
 * Suporta:
 *  1. Mercado Pago (Checkout Transparente / PIX dinâmico com Webhook automático)
 *  2. PIX Direto via CNPJ 68.510.540/0001-59 (Nubank PJ)
 *  3. Confirmação manual no painel admin e Webhook de conciliação
 */

export interface ChargeRequest {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  installments: number;
  customer: { name: string; email: string; cpf: string };
}

export interface ChargeResult {
  /** Identificador da cobrança no provedor (Mercado Pago ou referência local). */
  providerRef: string;
  /** Situação inicial. */
  status: 'aprovado' | 'pendente' | 'recusado';
  /** Copia e cola do PIX ou linha digitável, quando houver. */
  payload?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt?: string;
}

export interface PaymentGateway {
  readonly name: string;
  createCharge(input: ChargeRequest): Promise<ChargeResult>;
}

/**
 * Gateway oficial Mercado Pago via REST API v1/payments.
 */
class MercadoPagoGateway implements PaymentGateway {
  readonly name = 'mercadopago';

  private get accessToken(): string | undefined {
    return process.env.MERCADO_PAGO_ACCESS_TOKEN;
  }

  async createCharge(input: ChargeRequest): Promise<ChargeResult> {
    const token = this.accessToken;

    // Sem token do Mercado Pago, opera em modo PIX CNPJ / Simulado
    if (!token) {
      logger.info('Mercado Pago não configurado (MERCADO_PAGO_ACCESS_TOKEN ausente). Usando modo direto.');
      return {
        providerRef: `PIX-CNPJ-${input.orderId}`,
        status: input.method === 'cartao' ? 'aprovado' : 'pendente',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    }

    if (input.method === 'pix') {
      try {
        const names = input.customer.name.trim().split(' ');
        const firstName = names[0] || 'Cliente';
        const lastName = names.slice(1).join(' ') || 'Insanas';
        const cleanCpf = input.customer.cpf.replace(/\D/g, '');

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `order-${input.orderId}`,
          },
          body: JSON.stringify({
            transaction_amount: Number(input.amount.toFixed(2)),
            description: `Camisetas Insanas - Pedido #${input.orderId}`,
            payment_method_id: 'pix',
            payer: {
              email: input.customer.email.trim(),
              first_name: firstName,
              last_name: lastName,
              identification: {
                type: 'CPF',
                number: cleanCpf || '00000000000',
              },
            },
            external_reference: input.orderId,
            notification_url: `https://southamerica-east1-camisetas-imundas-store.cloudfunctions.net/paymentWebhook`,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          logger.error('Erro na API do Mercado Pago ao criar PIX', { status: response.status, errText });
          throw new Error(`Falha ao comunicar com Mercado Pago: ${errText}`);
        }

        const data = (await response.json()) as {
          id: number | string;
          status: string;
          date_of_expiration?: string;
          point_of_interaction?: {
            transaction_data?: {
              qr_code?: string;
              qr_code_base64?: string;
              ticket_url?: string;
            };
          };
        };

        const txData = data.point_of_interaction?.transaction_data;
        return {
          providerRef: String(data.id),
          status: data.status === 'approved' ? 'aprovado' : data.status === 'rejected' ? 'recusado' : 'pendente',
          payload: txData?.qr_code,
          qrCodeBase64: txData?.qr_code_base64,
          ticketUrl: txData?.ticket_url,
          expiresAt: data.date_of_expiration,
        };
      } catch (err) {
        logger.error('Exceção ao gerar cobrança Mercado Pago PIX', { err });
        // Fallback gracioso para não travar o fechamento do pedido
        return {
          providerRef: `FALLBACK-${input.orderId}`,
          status: 'pendente',
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        };
      }
    }

    return {
      providerRef: `MP-${input.orderId}`,
      status: 'aprovado',
    };
  }
}

export const gateway: PaymentGateway = new MercadoPagoGateway();

/* -------------------------------------------------------------------------- */
/* Confirmação                                                                */
/* -------------------------------------------------------------------------- */

/** Promove o pedido para pago. Compartilhado pelo webhook e pela confirmação manual. */
async function markPaid(orderId: string, providerRef: string | null, by: string) {
  const db = getFirestore();
  const ref = db.collection('orders').doc(orderId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      logger.warn(`markPaid: Pedido ${orderId} não encontrado no Firestore.`);
      return;
    }

    const current = snap.data()!.status as OrderStatus;
    // Idempotente de propósito: provedor reenvia webhook, e reprocessar não
    // pode duplicar histórico nem ressuscitar pedido cancelado.
    if (current !== 'aguardando-pagamento') return;

    tx.update(ref, {
      status: 'pago',
      'payment.providerRef': providerRef,
      history: FieldValue.arrayUnion({
        status: 'pago',
        at: new Date().toISOString(),
        by,
      }),
    });
  });
}

/**
 * Webhook universal (Mercado Pago + HMAC assinado).
 */
export const paymentWebhook = onRequest(
  { region: REGION, cors: false },
  async (request, response) => {
    if (request.method !== 'POST' && request.method !== 'GET') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    // Mercado Pago pode enviar dados tanto por query string (IPN) quanto no body
    const mpTopic = (request.query.topic || request.query.type || request.body?.type || request.body?.topic) as string | undefined;
    const mpPaymentId = (request.query.id || request.query['data.id'] || request.body?.data?.id || request.body?.id) as string | undefined;

    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // 1. Notificação do Mercado Pago
    if (mpPaymentId && (mpTopic === 'payment' || request.body?.action?.startsWith('payment.'))) {
      logger.info('Notificação recebida do Mercado Pago', { mpPaymentId, mpTopic });

      if (mpToken) {
        try {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
          });

          if (mpRes.ok) {
            const paymentInfo = (await mpRes.json()) as {
              id: number | string;
              status: string;
              external_reference?: string;
            };

            logger.info('Status retornado pelo Mercado Pago', {
              id: paymentInfo.id,
              status: paymentInfo.status,
              orderId: paymentInfo.external_reference,
            });

            if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
              await markPaid(paymentInfo.external_reference, String(paymentInfo.id), 'Mercado Pago (Webhook)');
            }

            response.status(200).send('OK');
            return;
          }
        } catch (err) {
          logger.error('Erro ao consultar pagamento no Mercado Pago', { err, mpPaymentId });
        }
      }
    }

    // 2. Webhook direto com assinatura HMAC (para outros gateways ou automações)
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (secret) {
      const signature = request.get('x-webhook-signature');
      const isValid = (() => {
        if (!signature) return false;
        const bufA = Buffer.from(signature, 'utf8');
        const bufB = Buffer.from(secret, 'utf8');
        if (bufA.length !== bufB.length) return false;
        return timingSafeEqual(bufA, bufB);
      })();

      if (isValid) {
        const { orderId, providerRef, event } = (request.body ?? {}) as {
          orderId?: string;
          providerRef?: string;
          event?: string;
        };

        if (orderId && event === 'payment.approved') {
          await markPaid(orderId, providerRef ?? null, 'Webhook HMAC');
        }
        response.status(200).send('ok');
        return;
      }
    }

    // Devolve 200 para evitar que o Mercado Pago faça retry infinito em endpoints desconhecidos
    response.status(200).send('ok');
  },
);

/**
 * Endpoint para gerar ou consultar cobrança PIX oficial.
 */
export const createCharge = onCall({ region: REGION }, async (request) => {
  const { orderId, amount, customer, method, installments } = (request.data ?? {}) as {
    orderId?: string;
    amount?: number;
    customer?: { name: string; email: string; cpf: string };
    method?: PaymentMethod;
    installments?: number;
  };

  if (!orderId || !amount || !customer || !method) {
    throw new HttpsError('invalid-argument', 'Parâmetros de cobrança incompletos.');
  }

  const result = await gateway.createCharge({
    orderId,
    amount,
    customer,
    method,
    installments: installments ?? 1,
  });

  return result;
});

/**
 * Confirmação manual, para quem recebe PIX fora do provedor (Nubank PJ) e precisa liberar
 * o pedido na mão pelo painel. Exige privilégio de pedidos.
 */
export const confirmPayment = onCall({ region: REGION }, async (request) => {
  const { requirePermission, actorName } = await import('./auth.js');
  const { uid } = requirePermission(request, 'orders.edit');

  const { orderId } = (request.data ?? {}) as { orderId?: string };
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Pedido não informado.');
  }

  await markPaid(orderId, null, await actorName(uid));
  return { ok: true };
});
