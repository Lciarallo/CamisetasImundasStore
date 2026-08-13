import { timingSafeEqual } from 'node:crypto';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { OrderStatus, PaymentMethod } from './domain.js';

const REGION = 'southamerica-east1';

/**
 * Camada de pagamento.
 *
 * Hoje não há cobrança real: a loja não tem CNPJ nem conta em provedor. Mas o
 * ponto de troca fica isolado atrás desta interface, então plugar Mercado
 * Pago, Asaas ou Pagar.me depois é escrever uma implementação e trocar a
 * constante `gateway` — sem tocar em `placeOrder` nem no checkout.
 *
 * O que já está no lugar para a virada:
 *  - o pedido guarda `payment.providerRef`, onde vai o id da cobrança;
 *  - o webhook abaixo já sabe promover o pedido quando o pagamento confirma;
 *  - PIX e boleto nascem como `aguardando-pagamento`, esperando essa confirmação.
 */

export interface ChargeRequest {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  installments: number;
  customer: { name: string; email: string; cpf: string };
}

export interface ChargeResult {
  /** Identificador da cobrança no provedor. */
  providerRef: string;
  /** Situação inicial. Cartão costuma aprovar na hora; PIX e boleto, não. */
  status: 'aprovado' | 'pendente' | 'recusado';
  /** Copia e cola do PIX ou linha digitável do boleto, quando houver. */
  payload?: string;
  expiresAt?: string;
}

export interface PaymentGateway {
  readonly name: string;
  createCharge(input: ChargeRequest): Promise<ChargeResult>;
}

/**
 * Implementação simulada. Não conversa com ninguém: devolve uma referência
 * local e o status que o método teria de verdade.
 */
const simulatedGateway: PaymentGateway = {
  name: 'simulado',
  async createCharge(input) {
    logger.info('cobrança simulada', {
      orderId: input.orderId,
      method: input.method,
      amount: input.amount,
    });

    return {
      providerRef: `SIM-${input.orderId}`,
      status: input.method === 'cartao' ? 'aprovado' : 'pendente',
      ...(input.method === 'pix'
        ? { expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }
        : {}),
    };
  },
};

/** Troque aqui ao contratar um provedor. */
export const gateway: PaymentGateway = simulatedGateway;

/* -------------------------------------------------------------------------- */
/* Confirmação                                                                */
/* -------------------------------------------------------------------------- */

/** Promove o pedido para pago. Compartilhado pelo webhook e pela confirmação manual. */
async function markPaid(orderId: string, providerRef: string | null, by: string) {
  const db = getFirestore();
  const ref = db.collection('orders').doc(orderId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');

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
 * Webhook do provedor. Ainda não recebe tráfego real, mas já existe com o
 * formato certo — inclusive a verificação de assinatura, que é o passo que
 * costuma ser esquecido e transforma o endpoint numa porta aberta para
 * qualquer um marcar pedidos como pagos.
 */
export const paymentWebhook = onRequest(
  { region: REGION, cors: false },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('PAYMENT_WEBHOOK_SECRET não configurado; webhook recusado.');
      response.status(503).send('Webhook não configurado');
      return;
    }

    const signature = request.get('x-webhook-signature');
    const isValid = (() => {
      if (!signature) return false;
      const bufA = Buffer.from(signature, 'utf8');
      const bufB = Buffer.from(secret, 'utf8');
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    })();

    if (!isValid) {
      logger.warn('webhook com assinatura inválida', { ip: request.ip });
      response.status(401).send('Assinatura inválida');
      return;
    }

    const { orderId, providerRef, event } = (request.body ?? {}) as {
      orderId?: string;
      providerRef?: string;
      event?: string;
    };

    if (!orderId) {
      response.status(400).send('orderId ausente');
      return;
    }

    try {
      if (event === 'payment.approved') {
        await markPaid(orderId, providerRef ?? null, gateway.name);
      }
      // Sempre 200 em evento conhecido: devolver erro faria o provedor
      // reenviar indefinidamente um evento que já tratamos.
      response.status(200).send('ok');
    } catch (cause) {
      logger.error('falha ao processar webhook', { orderId, cause });
      response.status(500).send('erro interno');
    }
  },
);

/**
 * Confirmação manual, para quem recebe PIX fora do provedor e precisa liberar
 * o pedido na mão. Exige privilégio de pedidos.
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
