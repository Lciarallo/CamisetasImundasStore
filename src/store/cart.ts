import type { CartItem, Product, Size } from '../types';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from '../data/seed';
import type { CartTotals } from './types';

/* -------------------------------------------------------------------------- */
/* Regras de disponibilidade                                                  */
/* -------------------------------------------------------------------------- */

/** Quantas unidades de um tamanho podem entrar no carrinho agora. */
export function availableFor(product: Product, size: Size): number {
  if (product.fulfillment === 'sob-encomenda') {
    // Sob encomenda não tem teto de estoque; limitamos por sanidade de pedido.
    return product.madeToOrderSizes.includes(size) ? 10 : 0;
  }
  return product.stock[size] ?? 0;
}

export const totalStock = (product: Product) =>
  Object.values(product.stock).reduce((sum, n) => sum + (n ?? 0), 0);

export function sizesFor(product: Product): Size[] {
  return product.fulfillment === 'sob-encomenda'
    ? product.madeToOrderSizes
    : (Object.keys(product.stock) as Size[]);
}

export function isSoldOut(product: Product): boolean {
  if (product.fulfillment === 'sob-encomenda') {
    return product.madeToOrderSizes.length === 0;
  }
  return totalStock(product) === 0;
}

/* -------------------------------------------------------------------------- */
/* Totais                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Totais do carrinho para exibição.
 *
 * No modo Firebase estes números são só uma prévia: o servidor recalcula tudo
 * em `placeOrder` e o valor cobrado é o dele. A conta vive aqui para a sacola
 * responder instantaneamente, não para valer como fonte da verdade.
 */
export function computeTotals(
  cart: CartItem[],
  products: Product[],
  coupon: { percent: number; minSubtotal: number } | null,
): CartTotals {
  let subtotal = 0;
  let itemCount = 0;
  let productionDays = 0;

  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    subtotal += product.price * item.quantity;
    itemCount += item.quantity;
    if (product.fulfillment === 'sob-encomenda') {
      productionDays = Math.max(productionDays, product.productionDays ?? 0);
    }
  }

  const eligible = coupon && subtotal >= coupon.minSubtotal;
  const discount = eligible ? (subtotal * coupon.percent) / 100 : 0;
  const afterDiscount = subtotal - discount;
  const isOnlyTestItem = cart.length === 1 && subtotal <= 1.0;
  const shipping =
    itemCount === 0 || isOnlyTestItem || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  return {
    subtotal,
    discount,
    shipping,
    total: afterDiscount + shipping,
    itemCount,
    missingForFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount),
    productionDays,
  };
}
