import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_LINES_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  MAX_INSTALLMENTS,
  ORDER_STATUS_FLOW,
  PIX_DISCOUNT,
  SHIPPING_COST,
  installmentTotal,
  round2,
  type CouponDoc,
  type OrderStatus,
  type PaymentMethod,
  type ProductDoc,
  type Size,
  type StockBySize,
} from './domain.js';
import { actorName, requirePermission } from './auth.js';

/* -------------------------------------------------------------------------- */
/* Validação da entrada                                                       */
/* -------------------------------------------------------------------------- */

interface CartLineInput {
  productId: string;
  size: Size;
  quantity: number;
}

interface PlaceOrderInput {
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
  payment: { method: PaymentMethod; installments?: number; cardLast4?: string; cardBrand?: string };
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
  const items = data!.items!;
  if (items.length > MAX_LINES_PER_ORDER) fail('Pedido com itens demais.');

  for (const item of items) {
    if (!isText(item?.productId, 1, 120)) fail('Item sem produto.');
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
  if (!isValidCPF(customer?.cpf ?? '')) fail('CPF inválido.');
  if ((customer?.phone ?? '').replace(/\D/g, '').length < 10) fail('Telefone inválido.');

  const address = data!.address;
  if ((address?.cep ?? '').replace(/\D/g, '').length !== 8) fail('CEP inválido.');
  for (const field of ['street', 'number', 'district', 'city'] as const) {
    if (!isText(address?.[field], 1)) fail(`Endereço incompleto: ${field}.`);
  }
  if (!isText(address?.state, 2, 2)) fail('UF inválida.');

  const method = data!.payment?.method as PaymentMethod | undefined;
  if (!method || !['pix', 'cartao', 'boleto'].includes(method)) {
    fail('Forma de pagamento inválida.');
  }

  const installments = data!.payment?.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > MAX_INSTALLMENTS) {
    fail('Parcelamento inválido.');
  }
  if (method !== 'cartao' && installments !== 1) fail('Só cartão pode ser parcelado.');

  return data as PlaceOrderInput;
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
export const placeOrder = onCall({ region: 'southamerica-east1' }, async (request) => {
  const input = parseInput(request.data);
  const db = getFirestore();

  const order = await db.runTransaction(async (tx) => {
    /* --- Leitura: produtos e cupom, sempre da fonte da verdade ---------- */
    const uniqueIds = [...new Set(input.items.map((item) => item.productId))];
    const refs = uniqueIds.map((id) => db.collection('products').doc(id));
    const snaps = await tx.getAll(...refs);

    const products = new Map<string, ProductDoc>();
    snaps.forEach((snap, index) => {
      if (!snap.exists) {
        throw new HttpsError('not-found', `Peça ${uniqueIds[index]} não existe mais.`);
      }
      const product = snap.data() as ProductDoc;
      if (!product.active) {
        throw new HttpsError('failed-precondition', `"${product.name}" saiu do catálogo.`);
      }
      products.set(uniqueIds[index], product);
    });

    /* --- Consolida linhas repetidas antes de conferir estoque ----------- */
    const merged = new Map<string, CartLineInput>();
    for (const item of input.items) {
      const key = `${item.productId}|${item.size}`;
      const existing = merged.get(key);
      // Sem isso, mandar o mesmo par duas vezes driblaria o teto por linha.
      merged.set(key, {
        ...item,
        quantity: Math.min(
          (existing?.quantity ?? 0) + item.quantity,
          MAX_QUANTITY_PER_LINE,
        ),
      });
    }

    /* --- Estoque e preço ------------------------------------------------ */
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
        const available = product.stock?.[item.size] ?? 0;
        if (available < item.quantity) {
          throw new HttpsError(
            'failed-precondition',
            `"${product.name}" tem só ${available} no tamanho ${item.size}.`,
          );
        }
        const pending = stockUpdates.get(item.productId) ?? { ...product.stock };
        pending[item.size] = available - item.quantity;
        stockUpdates.set(item.productId, pending);
      }

      // O preço vem do documento, nunca do que o cliente enviou.
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

    /* --- Cupom ---------------------------------------------------------- */
    let discount = 0;
    let couponCode: string | null = null;
    if (input.coupon) {
      const code = input.coupon.trim().toUpperCase();
      const snap = await tx.get(db.collection('coupons').doc(code));
      const coupon = snap.data() as CouponDoc | undefined;
      // Cupom inválido não derruba a compra — só não é aplicado.
      if (snap.exists && coupon?.active && subtotal >= coupon.minSubtotal) {
        discount = round2((subtotal * coupon.percent) / 100);
        couponCode = code;
      }
    }

    /* --- Frete, pagamento e total --------------------------------------- */
    const afterDiscount = round2(subtotal - discount);
    const shipping = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const beforePayment = round2(afterDiscount + shipping);

    const method = input.payment.method;
    const installments = method === 'cartao' ? (input.payment.installments ?? 1) : 1;

    let total: number;
    let pixDiscount = 0;
    if (method === 'pix') {
      pixDiscount = round2(beforePayment * PIX_DISCOUNT);
      total = round2(beforePayment - pixDiscount);
    } else if (method === 'cartao') {
      total = round2(installmentTotal(beforePayment, installments));
    } else {
      total = beforePayment;
    }

    /* --- Número do pedido ----------------------------------------------- */
    const counterRef = db.collection('counters').doc('orders');
    const counterSnap = await tx.get(counterRef);
    const next = ((counterSnap.data()?.value as number | undefined) ?? 20_000) + 1;
    const orderId = `INS-${next}`;

    /* --- Grava ----------------------------------------------------------- */
    const now = new Date().toISOString();
    // Cartão aprova na hora; PIX e boleto só depois que compensarem — a
    // confirmação viria do webhook do provedor (ver `payments.ts`).
    const status: OrderStatus = method === 'cartao' ? 'pago' : 'aguardando-pagamento';

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
        method,
        installments,
        cardLast4: input.payment.cardLast4 ?? null,
        cardBrand: input.payment.cardBrand ?? null,
        // Referência do provedor entra aqui quando houver cobrança real.
        providerRef: null,
      },
      coupon: couponCode,
      trackingCode: null,
      history: [{ status, at: now, by: null }],
    };

    tx.set(db.collection('orders').doc(orderId), doc);
    tx.set(counterRef, { value: next }, { merge: true });

    for (const [productId, stock] of stockUpdates) {
      tx.update(db.collection('products').doc(productId), { stock });
    }

    return doc;
  });

  return order;
});

/* -------------------------------------------------------------------------- */
/* Operação                                                                   */
/* -------------------------------------------------------------------------- */

export const updateOrderStatus = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    const { uid } = requirePermission(request, 'orders.edit');
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

      // Só avança um degrau por vez. Pular de "pago" para "entregue" quase
      // sempre é engano de clique, e apagaria a rastreabilidade do caminho.
      if (status !== 'cancelado') {
        const from = ORDER_STATUS_FLOW.indexOf(current);
        const to = ORDER_STATUS_FLOW.indexOf(status);
        if (to !== from + 1) {
          throw new HttpsError('failed-precondition', 'Só é possível avançar um passo por vez.');
        }
      }

      tx.update(ref, {
        status,
        history: FieldValue.arrayUnion({ status, at: new Date().toISOString(), by }),
      });
    });

    return { ok: true };
  },
);

export const setTrackingCode = onCall({ region: 'southamerica-east1' }, async (request) => {
  requirePermission(request, 'orders.edit');
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
