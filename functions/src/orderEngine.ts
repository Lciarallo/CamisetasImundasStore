/**
 * OrderEngine — Módulo Profundo (Deep Module) para cálculo e validação de pedidos.
 *
 * Encapsula aritmética financeira de centavos, aplicação de regras de cupons,
 * cálculo de frete, conferência de estoque por tamanho e montagem da estrutura
 * invariante de pedidos.
 */
import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_QUANTITY_PER_LINE,
  PIX_DISCOUNT,
  SHIPPING_COST,
  round2,
  type CouponDoc,
  type FulfillmentMode,
  type ProductDoc,
  type Size,
  type StockBySize,
} from './domain.js';

export interface OrderItemInput {
  productId: string;
  size: Size;
  quantity: number;
}

export interface OrderLineItem {
  productId: string;
  name: string;
  band: string;
  art: { sigil: string; tone: string; fabric: string };
  photo: string | null;
  size: Size;
  quantity: number;
  unitPrice: number;
  fulfillment: FulfillmentMode;
  productionDays: number | null;
}

export interface OrderCalculationResult {
  lines: OrderLineItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  stockUpdates: Map<string, StockBySize>;
}

/**
 * Calcula os itens, valida estoque, aplica cupons e determina os totais financeiros.
 *
 * Lança `HttpsError` com mensagem amigável caso haja inconsistência de estoque ou catálogo.
 */
export function calculateOrderMetrics(
  items: OrderItemInput[],
  products: Map<string, ProductDoc>,
  couponDoc?: CouponDoc | null,
  requestedCouponCode?: string | null,
): OrderCalculationResult {
  const merged = new Map<string, OrderItemInput>();
  for (const item of items) {
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

  const lines: OrderLineItem[] = [];
  const stockUpdates = new Map<string, StockBySize>();
  let subtotal = 0;

  for (const item of merged.values()) {
    const product = products.get(item.productId);
    if (!product) {
      throw new HttpsError('not-found', `Peça ${item.productId} não encontrada.`);
    }
    if (!product.active) {
      throw new HttpsError('failed-precondition', `"${product.name}" saiu do catálogo.`);
    }

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
  let activeCouponCode: string | null = null;
  if (couponDoc && couponDoc.active && subtotal >= couponDoc.minSubtotal) {
    discount = round2((subtotal * couponDoc.percent) / 100);
    activeCouponCode = requestedCouponCode ? requestedCouponCode.trim().toUpperCase() : null;
  }

  const afterDiscount = round2(subtotal - discount);
  const isOnlyTestItem = lines.length === 1 && subtotal <= 1.0;
  const shipping = isOnlyTestItem || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const beforePayment = round2(afterDiscount + shipping);
  const pixDiscount = isOnlyTestItem ? 0 : round2(beforePayment * PIX_DISCOUNT);
  const total = round2(beforePayment - pixDiscount);

  return {
    lines,
    subtotal,
    discount: round2(discount + pixDiscount),
    shipping,
    total,
    couponCode: activeCouponCode,
    stockUpdates,
  };
}

/**
 * Gera o hash criptográfico do token de acesso do cliente.
 */
export function hashCustomerToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
