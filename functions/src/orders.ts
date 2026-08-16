import { createHash, timingSafeEqual } from 'node:crypto';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_LINES_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  ORDER_STATUS_FLOW,
  PIX_DISCOUNT,
  SHIPPING_COST,
  round2,
  type CouponDoc,
  type OrderStatus,
  type PaymentMethod,
  type ProductDoc,
  type Size,
  type StockBySize,
} from './domain.js';
import { actorName, requirePermission } from './auth.js';
import { createPaymentCharge, PAYMENT_RUNTIME_SECRETS } from './payments.js';
import { enforceRateLimit } from './security.js';

const REGION = 'southamerica-east1';
const PAYMENT_RESERVATION_MINUTES = 30;
const APP_CHECK_ENABLED = process.env.ENABLE_APP_CHECK === 'true';

/* -------------------------------------------------------------------------- */
/* Validação da entrada                                                       */
/* -------------------------------------------------------------------------- */

interface CartLineInput {
  productId: string;
  size: Size;
  quantity: number;
}

interface PlaceOrderInput {
  idempotencyKey: string;
  items: CartLineInput[];
  customer: { name: string; email: string; cpf: string; phone: string };
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  };
  payment: { method: PaymentMethod };
  coupon?: string;
}

const isText = (value: unknown, min: number, max = 200): value is string =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

/** Validação de CPF com dígitos verificadores — a mesma do cliente, refeita aqui. */
function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const [length, position] of [
    [9, 10],
    [10, 11],
  ]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (position - i);
    if (((sum * 10) % 11) % 10 !== Number(cpf[length])) return false;
  }
  return true;
}

function parseInput(raw: unknown): PlaceOrderInput {
  const data = raw as Partial<PlaceOrderInput> | undefined;
  // Anotação explícita no const: sem ela o TypeScript não usa o retorno
  // `never` para estreitar tipos depois da chamada.
  const fail: (message: string) => never = (message) => {
    throw new HttpsError('invalid-argument', message);
  };

  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    fail('O pedido não tem itens.');
  }
  if (
    !isText(data.idempotencyKey, 20, 128) ||
    !/^[A-Za-z0-9_-]+$/.test(data.idempotencyKey)
  ) {
    fail('Identificador idempotente inválido. Recarregue o checkout e tente novamente.');
  }
  const items = data!.items!;
  if (items.length > MAX_LINES_PER_ORDER) fail('Pedido com itens demais.');

  for (const item of items) {
    if (!isText(item?.productId, 1, 120) || item.productId.includes('/')) {
      fail('Item sem produto.');
    }
    if (!['P', 'M', 'G', 'GG', 'XGG'].includes(item?.size)) fail('Tamanho inválido.');
    if (!Number.isInteger(item?.quantity) || item.quantity < 1) fail('Quantidade inválida.');
    if (item.quantity > MAX_QUANTITY_PER_LINE) {
      fail(`Máximo de ${MAX_QUANTITY_PER_LINE} unidades por item.`);
    }
  }

  const customer = data!.customer;
  if (!isText(customer?.name, 3)) fail('Nome inválido.');
  if (!isText(customer?.email, 5) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer!.email)) {
    fail('E-mail inválido.');
  }
  if (!isText(customer?.cpf, 11, 20) || !isValidCPF(customer.cpf)) fail('CPF inválido.');
  if (
    !isText(customer?.phone, 10, 30) ||
    customer.phone.replace(/\D/g, '').length < 10
  ) {
    fail('Telefone inválido.');
  }

  const address = data!.address;
  const cepDigits = (address?.cep ?? '').replace(/\D/g, '');
  if (cepDigits.length !== 8 || /^0{8}$/.test(cepDigits)) fail('CEP inválido.');
  for (const field of ['street', 'number', 'district', 'city'] as const) {
    if (!isText(address?.[field], 1)) fail(`Endereço incompleto: ${field}.`);
  }
  if (address?.complement != null && !isText(address.complement, 0, 200)) {
    fail('Complemento inválido.');
  }
  const uf = (address?.state ?? '').trim().toUpperCase();
  const validUFs = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
  if (!validUFs.includes(uf)) fail('UF inválida.');

  // A loja é PIX à vista e ponto. Qualquer outro método é entrada forjada:
  // nenhuma tela oferece a opção.
  if (data!.payment?.method !== 'pix') fail('A loja aceita exclusivamente PIX à vista.');

  if (data.coupon != null && !isText(data.coupon, 1, 40)) fail('Cupom inválido.');

  return {
    idempotencyKey: data.idempotencyKey.trim(),
    items: items.map((item) => ({
      productId: item.productId.trim(),
      size: item.size,
      quantity: item.quantity,
    })),
    customer: {
      name: customer!.name.trim(),
      email: customer!.email.trim().toLowerCase(),
      cpf: customer!.cpf.replace(/\D/g, ''),
      phone: customer!.phone.replace(/\D/g, ''),
    },
    address: {
      cep: cepDigits,
      street: address!.street.trim(),
      number: address!.number.trim(),
      ...(address!.complement?.trim()
        ? { complement: address!.complement.trim() }
        : {}),
      district: address!.district.trim(),
      city: address!.city.trim(),
      state: uf,
    },
    payment: { method: 'pix' },
    ...(data.coupon ? { coupon: data.coupon.trim().toUpperCase() } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Fechamento do pedido                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fecha o pedido. É a única porta de entrada para criar um pedido, e a razão
 * de o backend existir: **nada de dinheiro vem do cliente**. Ele manda apenas
 * o que quer comprar; preço, desconto, frete, juros e total são lidos do
 * banco e recalculados aqui.
 *
 * A conferência de estoque e a baixa acontecem dentro de uma transação, então
 * duas compras simultâneas da última peça não vendem a mesma unidade duas vezes.
 */
export const placeOrder = onCall(
  {
    region: REGION,
    enforceAppCheck: APP_CHECK_ENABLED,
    secrets: [...PAYMENT_RUNTIME_SECRETS],
  },
  async (request) => {
    const input = parseInput(request.data);
    await enforceRateLimit(request, 'place-order', 6, 60);

    const db = getFirestore();
    const requestHash = createHash('sha256')
      .update(JSON.stringify(input), 'utf8')
      .digest('hex');
    const customerAccessTokenHash = createHash('sha256')
      .update(input.idempotencyKey, 'utf8')
      .digest('hex');
    const attemptRef = db.collection('orderRequests').doc(customerAccessTokenHash);

    const created = await db.runTransaction(async (tx) => {
      /* --- 1. Todas as leituras primeiro -------------------------------- */
      const attemptSnap = await tx.get(attemptRef);
      if (attemptSnap.exists) {
        const attempt = attemptSnap.data() as { orderId?: string; requestHash?: string };
        if (attempt.requestHash !== requestHash || !attempt.orderId) {
          throw new HttpsError(
            'already-exists',
            'Este identificador já foi usado por outro pedido.',
          );
        }
        const existingSnap = await tx.get(db.collection('orders').doc(attempt.orderId));
        if (!existingSnap.exists) {
          throw new HttpsError('internal', 'Pedido idempotente inconsistente.');
        }
        return { order: existingSnap.data()!, reused: true };
      }

      const uniqueIds = [...new Set(input.items.map((item) => item.productId))];
      const refs = uniqueIds.map((id) => db.collection('products').doc(id));
      const snaps = await tx.getAll(...refs);

      let couponDoc: CouponDoc | undefined;
      let couponCode: string | null = null;
      if (input.coupon) {
        const code = input.coupon.trim().toUpperCase();
        const snap = await tx.get(db.collection('coupons').doc(code));
        if (snap.exists) {
          couponDoc = snap.data() as CouponDoc;
          couponCode = code;
        }
      }

      const counterRef = db.collection('counters').doc('orders');
      const counterSnap = await tx.get(counterRef);

      /* --- 2. Processamento em memória ---------------------------------- */
      const products = new Map<string, ProductDoc>();
      snaps.forEach((snap, index) => {
        const id = uniqueIds[index];
        if (!snap.exists) {
          throw new HttpsError('not-found', `Peça ${id} não existe mais.`);
        }
        const product = snap.data() as ProductDoc;
        if (!product.active) {
          throw new HttpsError('failed-precondition', `"${product.name}" saiu do catálogo.`);
        }
        products.set(id, product);
      });

      const merged = new Map<string, CartLineInput>();
      for (const item of input.items) {
        const key = `${item.productId}|${item.size}`;
        const existing = merged.get(key);
        const quantity = (existing?.quantity ?? 0) + item.quantity;
        if (quantity > MAX_QUANTITY_PER_LINE) {
          throw new HttpsError(
            'invalid-argument',
            `Máximo de ${MAX_QUANTITY_PER_LINE} unidades por peça e tamanho.`,
          );
        }
        merged.set(key, { ...item, quantity });
      }

      const lines = [];
      const stockUpdates = new Map<string, StockBySize>();
      let subtotal = 0;

      for (const item of merged.values()) {
        const product = products.get(item.productId)!;
        if (product.fulfillment === 'sob-encomenda') {
          if (!product.madeToOrderSizes.includes(item.size)) {
            throw new HttpsError(
              'failed-precondition',
              `"${product.name}" não é fabricada no tamanho ${item.size}.`,
            );
          }
        } else {
          const pending = stockUpdates.get(item.productId) ?? { ...product.stock };
          const available = pending[item.size] ?? 0;
          if (available < item.quantity) {
            throw new HttpsError(
              'failed-precondition',
              `"${product.name}" tem só ${available} no tamanho ${item.size}.`,
            );
          }
          pending[item.size] = available - item.quantity;
          stockUpdates.set(item.productId, pending);
        }

        subtotal += product.price * item.quantity;
        lines.push({
          productId: item.productId,
          name: product.name,
          band: product.band,
          art: product.art,
          photo: product.photos?.[0] ?? null,
          size: item.size,
          quantity: item.quantity,
          unitPrice: product.price,
          fulfillment: product.fulfillment,
          productionDays: product.productionDays ?? null,
        });
      }
      subtotal = round2(subtotal);

      let discount = 0;
      if (couponDoc && couponDoc.active && subtotal >= couponDoc.minSubtotal) {
        discount = round2((subtotal * couponDoc.percent) / 100);
      } else {
        couponCode = null;
      }

      const afterDiscount = round2(subtotal - discount);
      const isOnlyTestItem = lines.length === 1 && subtotal <= 1.0;
      const shipping = isOnlyTestItem || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
      const beforePayment = round2(afterDiscount + shipping);
      const pixDiscount = isOnlyTestItem ? 0 : round2(beforePayment * PIX_DISCOUNT);
      const total = round2(beforePayment - pixDiscount);

      const next = ((counterSnap.data()?.value as number | undefined) ?? 20_000) + 1;
      const orderId = `INS-${next}`;
      const now = new Date().toISOString();
      const reservationExpiresAt = new Date(
        Date.now() + PAYMENT_RESERVATION_MINUTES * 60_000,
      ).toISOString();
      const status: OrderStatus = 'aguardando-pagamento';

      const doc = {
        id: orderId,
        createdAt: now,
        status,
        customer: input.customer,
        address: { ...input.address, complement: input.address.complement ?? null },
        lines,
        subtotal,
        discount: round2(discount + pixDiscount),
        shipping,
        total,
        payment: {
          method: 'pix' as const,
          gateway: 'infinitepay' as const,
          status: 'pendente',
          providerRef: null,
          checkoutUrl: null,
          pixCode: null,
          expiresAt: reservationExpiresAt,
        },
        coupon: couponCode,
        trackingCode: null,
        reservationExpiresAt,
        inventoryReleasedAt: null,
        customerAccessTokenHash,
        history: [{ status, at: now, by: null }],
      };

      tx.set(db.collection('orders').doc(orderId), doc);
      tx.set(counterRef, { value: next }, { merge: true });
      tx.create(attemptRef, { orderId, requestHash, createdAt: now });
      for (const [productId, stock] of stockUpdates) {
        tx.update(db.collection('products').doc(productId), { stock });
      }

      return { order: doc, reused: false };
    });

    let order = created.order as Record<string, any>;
    if (
      order.status === 'aguardando-pagamento' &&
      (!order.payment?.checkoutUrl || !order.payment?.providerRef)
    ) {
      try {
        const charge = await createPaymentCharge({
          orderId: order.id,
          amount: order.total,
          method: 'pix',
          customer: {
            name: order.customer.name,
            email: order.customer.email,
            cpf: order.customer.cpf,
            phone: order.customer.phone,
          },
        });

        order = await db.runTransaction(async (tx) => {
          const ref = db.collection('orders').doc(order.id);
          const snap = await tx.get(ref);
          if (!snap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
          const current = snap.data() as Record<string, any>;
          if (current.payment?.checkoutUrl && current.payment?.providerRef) return current;
          if (current.status !== 'aguardando-pagamento') return current;

          const paid = charge.status === 'aprovado';
          const paidHistory = paid
            ? {
                status: 'pago' as const,
                at: new Date().toISOString(),
                by: `${charge.gateway} (criação da cobrança)`,
              }
            : null;
          const patch: Record<string, unknown> = {
            'payment.gateway': charge.gateway,
            'payment.status': charge.status,
            'payment.providerRef': charge.providerRef,
            'payment.checkoutUrl': charge.checkoutUrl,
            'payment.expiresAt': charge.expiresAt ?? current.reservationExpiresAt,
            reservationExpiresAt: charge.expiresAt ?? current.reservationExpiresAt,
          };
          if (paidHistory) {
            patch.status = 'pago';
            patch.history = FieldValue.arrayUnion(paidHistory);
          }
          tx.update(ref, patch);
          return {
            ...current,
            status: paid ? 'pago' : current.status,
            history: paidHistory
              ? [...(Array.isArray(current.history) ? current.history : []), paidHistory]
              : current.history,
            payment: {
              ...current.payment,
              gateway: charge.gateway,
              status: charge.status,
              providerRef: charge.providerRef,
              checkoutUrl: charge.checkoutUrl,
              expiresAt: charge.expiresAt ?? current.reservationExpiresAt,
            },
            reservationExpiresAt: charge.expiresAt ?? current.reservationExpiresAt,
          };
        });
      } catch (cause) {
        await db.collection('orders').doc(order.id).update({
          'payment.status': 'erro',
          'payment.lastErrorAt': new Date().toISOString(),
        });
        if (cause instanceof HttpsError) throw cause;
        throw new HttpsError(
          'unavailable',
          'O pedido foi reservado, mas a cobrança de pagamento não pôde ser gerada. Tente novamente.',
        );
      }
    }

    return {
      ...orderForClient(order),
      customerAccessToken: input.idempotencyKey,
    };
  },
);

/* -------------------------------------------------------------------------- */
/* Operação                                                                   */
/* -------------------------------------------------------------------------- */

function orderForClient(order: Record<string, any>): Record<string, any> {
  const customer = order.customer ?? {};
  const address = order.address ?? {};
  const payment = order.payment ?? {};
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    customer: {
      name: customer.name,
      email: customer.email,
      cpf: customer.cpf,
      phone: customer.phone,
    },
    address: {
      cep: address.cep,
      street: address.street,
      number: address.number,
      ...(address.complement ? { complement: address.complement } : {}),
      district: address.district,
      city: address.city,
      state: address.state,
    },
    lines: (Array.isArray(order.lines) ? order.lines : []).map((line: Record<string, any>) => ({
      productId: line.productId,
      name: line.name,
      band: line.band,
      art: line.art,
      ...(line.photo ? { photo: line.photo } : {}),
      size: line.size,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      fulfillment: line.fulfillment,
      ...(line.productionDays != null ? { productionDays: line.productionDays } : {}),
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    total: order.total,
    payment: {
      method: payment.method,
      status: payment.status,
      ...(payment.gateway ? { gateway: payment.gateway } : {}),
      ...(payment.checkoutUrl ? { checkoutUrl: payment.checkoutUrl } : {}),
      ...(payment.pixCode ? { pixCode: payment.pixCode } : {}),
      ...(payment.expiresAt ? { expiresAt: payment.expiresAt } : {}),
    },
    coupon: order.coupon ?? null,
    ...(order.trackingCode ? { trackingCode: order.trackingCode } : {}),
    history: (Array.isArray(order.history) ? order.history : []).map(
      (entry: Record<string, any>) => ({
        status: entry.status,
        at: entry.at,
        ...(entry.by ? { by: entry.by } : {}),
      }),
    ),
  };
}

async function releaseInventory(
  tx: Transaction,
  db: Firestore,
  order: Record<string, any>,
): Promise<void> {
  if (order.inventoryReleasedAt) return;

  const quantities = new Map<string, Map<Size, number>>();
  for (const line of Array.isArray(order.lines) ? order.lines : []) {
    if (
      line?.fulfillment !== 'pronta-entrega' ||
      typeof line.productId !== 'string' ||
      !['P', 'M', 'G', 'GG', 'XGG'].includes(line.size) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    ) {
      continue;
    }
    const bySize = quantities.get(line.productId) ?? new Map<Size, number>();
    bySize.set(line.size, (bySize.get(line.size) ?? 0) + line.quantity);
    quantities.set(line.productId, bySize);
  }

  const productIds = [...quantities.keys()];
  if (productIds.length === 0) return;
  const refs = productIds.map((id) => db.collection('products').doc(id));
  const snaps = await tx.getAll(...refs);

  snaps.forEach((snap, index) => {
    if (!snap.exists) return;
    const product = snap.data() as ProductDoc;
    const stock = { ...product.stock };
    for (const [size, amount] of quantities.get(productIds[index]) ?? []) {
      stock[size] = Math.min(100_000, (stock[size] ?? 0) + amount);
    }
    tx.update(snap.ref, { stock });
  });
}

async function cancelPendingOrder(orderId: string, by: string): Promise<boolean> {
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const ref = db.collection('orders').doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const order = snap.data() as Record<string, any>;
    if (order.status !== 'aguardando-pagamento') return false;

    await releaseInventory(tx, db, order);
    const now = new Date().toISOString();
    tx.update(ref, {
      status: 'cancelado',
      inventoryReleasedAt: order.inventoryReleasedAt ?? now,
      history: FieldValue.arrayUnion({ status: 'cancelado', at: now, by }),
    });
    return true;
  });
}

export const updateOrderStatus = onCall(
  { region: REGION },
  async (request) => {
    const { uid, claims } = await requirePermission(request, 'orders.edit');
    const { orderId, status } = (request.data ?? {}) as {
      orderId?: string;
      status?: OrderStatus;
    };

    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'Pedido não informado.');
    }
    const allowed: OrderStatus[] = [...ORDER_STATUS_FLOW, 'cancelado'];
    if (!status || !allowed.includes(status)) {
      throw new HttpsError('invalid-argument', 'Status inválido.');
    }

    const db = getFirestore();
    const by = await actorName(uid);

    await db.runTransaction(async (tx) => {
      const ref = db.collection('orders').doc(orderId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');

      const current = snap.data()!.status as OrderStatus;
      if (current === 'entregue' || current === 'cancelado') {
        throw new HttpsError('failed-precondition', 'Este pedido já foi encerrado.');
      }

      if (current === 'aguardando-pagamento' && status === 'pago' && claims.role !== 'mestre') {
        throw new HttpsError(
          'permission-denied',
          'Somente o Mestre pode confirmar um pagamento manualmente.',
        );
      }

      // Só avança um degrau por vez. Pular de "pago" para "entregue" quase
      // sempre é engano de clique, e apagaria a rastreabilidade do caminho.
      if (status !== 'cancelado') {
        const from = ORDER_STATUS_FLOW.indexOf(current);
        const to = ORDER_STATUS_FLOW.indexOf(status);
        if (to !== from + 1) {
          throw new HttpsError('failed-precondition', 'Só é possível avançar um passo por vez.');
        }
      }

      if (status === 'cancelado') {
        if (current === 'pago') {
          throw new HttpsError(
            'failed-precondition',
            'Pedido pago exige reembolso confirmado no provedor antes do cancelamento.',
          );
        }
        if (current !== 'aguardando-pagamento') {
          throw new HttpsError(
            'failed-precondition',
            'Após iniciar a produção, use o fluxo de devolução em vez de cancelar.',
          );
        }
        await releaseInventory(tx, db, snap.data() as Record<string, any>);
      }

      const now = new Date().toISOString();
      tx.update(ref, {
        status,
        ...(current === 'aguardando-pagamento' && status === 'pago'
          ? {
              'payment.status': 'aprovado',
              'payment.confirmedManually': true,
            }
          : {}),
        ...(status === 'cancelado' ? { inventoryReleasedAt: now } : {}),
        history: FieldValue.arrayUnion({ status, at: now, by }),
      });
    });

    return { ok: true };
  },
);

/** Libera reservas PIX vencidas e devolve o estoque exatamente uma vez. */
export const expirePendingOrders = onSchedule(
  { region: REGION, schedule: 'every 5 minutes', timeZone: 'America/Sao_Paulo' },
  async () => {
    const db = getFirestore();
    const now = new Date().toISOString();
    const snap = await db
      .collection('orders')
      .where('status', '==', 'aguardando-pagamento')
      .where('reservationExpiresAt', '<=', now)
      .limit(100)
      .get();

    let expired = 0;
    for (const doc of snap.docs) {
      if (await cancelPendingOrder(doc.id, 'Sistema (reserva PIX expirada)')) expired++;
    }

    const staleLimits = await db
      .collection('rateLimits')
      .where('expiresAt', '<=', Timestamp.now())
      .limit(500)
      .get();
    if (!staleLimits.empty) {
      const batch = db.batch();
      staleLimits.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    logger.info('Limpeza de reservas e limites concluída', {
      expired,
      removedRateLimitBuckets: staleLimits.size,
    });
  },
);

export const setTrackingCode = onCall({ region: REGION }, async (request) => {
  await requirePermission(request, 'orders.edit');
  const { orderId, code } = (request.data ?? {}) as { orderId?: string; code?: string };

  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Pedido não informado.');
  }
  if (typeof code !== 'string' || code.trim().length > 40) {
    throw new HttpsError('invalid-argument', 'Código de rastreio inválido.');
  }

  await getFirestore()
    .collection('orders')
    .doc(orderId)
    .update({ trackingCode: code.trim() || null });

  return { ok: true };
});

/**
 * Consulta um único pedido. Para o cliente, o número público não basta: também
 * é exigido o token opaco criado no checkout. Isso elimina a enumeração dos IDs
 * sequenciais e substitui mascaramento por autorização de verdade.
 */
export const lookupOrders = onCall(
  { region: REGION, enforceAppCheck: APP_CHECK_ENABLED },
  async (request) => {
    await enforceRateLimit(request, 'lookup-order', 20, 60);
    const { orderId, accessToken } = (request.data ?? {}) as {
      orderId?: unknown;
      accessToken?: unknown;
    };
    if (
      typeof orderId !== 'string' ||
      orderId.trim().length < 5 ||
      orderId.trim().length > 64
    ) {
      throw new HttpsError('invalid-argument', 'Número do pedido inválido.');
    }

    const db = getFirestore();
    let isStaff = false;
    if (request.auth?.uid) {
      const staffSnap = await db.collection('adminUsers').doc(request.auth.uid).get();
      const staff = staffSnap.data() as { active?: unknown; permissions?: unknown } | undefined;
      isStaff = Boolean(
        staff?.active === true &&
          Array.isArray(staff.permissions) &&
          staff.permissions.includes('orders.view'),
      );
    }
    const snap = await db
      .collection('orders')
      .doc(orderId.trim().toUpperCase())
      .get();
    if (!snap.exists) return { orders: [] };

    const order = snap.data() as Record<string, any>;
    if (!isStaff) {
      if (
        typeof accessToken !== 'string' ||
        accessToken.length < 20 ||
        accessToken.length > 128
      ) {
        return { orders: [] };
      }
      const expected = String(order.customerAccessTokenHash ?? '');
      const received = createHash('sha256').update(accessToken, 'utf8').digest('hex');
      const expectedBuffer = Buffer.from(expected, 'hex');
      const receivedBuffer = Buffer.from(received, 'hex');
      if (
        expectedBuffer.length !== 32 ||
        receivedBuffer.length !== 32 ||
        !timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
        return { orders: [] };
      }
    }

    return { orders: [orderForClient(order)] };
  },
);
