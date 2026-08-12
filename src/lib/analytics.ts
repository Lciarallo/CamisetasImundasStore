import type { Order, OrderStatus, Product } from '../types';
import { totalStock } from '../store/StoreContext';

/** Pedidos cancelados não entram em nenhum número de receita. */
const isRevenue = (order: Order) => order.status !== 'cancelado';

const dayKey = (iso: string) => iso.slice(0, 10);

export interface Metrics {
  revenue: number;
  orderCount: number;
  averageTicket: number;
  unitsSold: number;
}

function summarize(orders: Order[]): Metrics {
  const valid = orders.filter(isRevenue);
  const revenue = valid.reduce((sum, order) => sum + order.total, 0);
  const unitsSold = valid.reduce(
    (sum, order) => sum + order.lines.reduce((n, line) => n + line.quantity, 0),
    0,
  );
  return {
    revenue,
    orderCount: valid.length,
    averageTicket: valid.length ? revenue / valid.length : 0,
    unitsSold,
  };
}

/** Variação percentual; devolve 0 quando não há base de comparação. */
export function variation(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export interface DashboardData {
  current: Metrics;
  previous: Metrics;
  daily: { label: string; value: number }[];
  dailySpark: number[];
  topProducts: { label: string; sublabel: string; value: number }[];
  topBands: { label: string; value: number }[];
  paymentSplit: { label: string; value: number }[];
  fulfillmentSplit: { label: string; value: number }[];
  statusCounts: Record<OrderStatus, number>;
  pendingProduction: Order[];
  lowStock: Product[];
}

export function buildDashboard(
  orders: Order[],
  products: Product[],
  days: number,
  now = Date.now(),
): DashboardData {
  const windowMs = days * 86_400_000;
  const start = now - windowMs;
  const previousStart = start - windowMs;

  const inWindow = orders.filter((order) => new Date(order.createdAt).getTime() >= start);
  const inPrevious = orders.filter((order) => {
    const time = new Date(order.createdAt).getTime();
    return time >= previousStart && time < start;
  });

  /* Série diária ---------------------------------------------------------- */
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(dayKey(new Date(now - i * 86_400_000).toISOString()), 0);
  }
  for (const order of inWindow.filter(isRevenue)) {
    const key = dayKey(order.createdAt);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + order.total);
  }

  const daily = [...byDay.entries()].map(([key, value]) => {
    const [, month, day] = key.split('-');
    return { label: `${day}/${month}`, value };
  });

  /* Rankings -------------------------------------------------------------- */
  const productRevenue = new Map<
    string,
    { name: string; units: number; value: number }
  >();
  const bandRevenue = new Map<string, number>();
  let readyToShip = 0;
  let madeToOrder = 0;

  for (const order of inWindow.filter(isRevenue)) {
    for (const line of order.lines) {
      const gross = line.unitPrice * line.quantity;

      const entry = productRevenue.get(line.productId);
      productRevenue.set(line.productId, {
        name: line.name,
        units: (entry?.units ?? 0) + line.quantity,
        value: (entry?.value ?? 0) + gross,
      });
      bandRevenue.set(line.band, (bandRevenue.get(line.band) ?? 0) + gross);

      if (line.fulfillment === 'sob-encomenda') madeToOrder += gross;
      else readyToShip += gross;
    }
  }

  const topProducts = [...productRevenue.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((item) => ({
      label: item.name,
      // O nome já começa com a banda; o sublabel carrega o volume, não repete.
      sublabel: `${item.units} ${item.units === 1 ? 'peça vendida' : 'peças vendidas'}`,
      value: item.value,
    }));

  const topBands = [...bandRevenue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  /* Pagamentos ------------------------------------------------------------ */
  const payments = { pix: 0, cartao: 0, boleto: 0 };
  for (const order of inWindow.filter(isRevenue)) {
    payments[order.payment.method] += order.total;
  }

  /* Status ---------------------------------------------------------------- */
  const statusCounts: Record<OrderStatus, number> = {
    'aguardando-pagamento': 0,
    pago: 0,
    'em-producao': 0,
    enviado: 0,
    entregue: 0,
    cancelado: 0,
  };
  for (const order of orders) statusCounts[order.status]++;

  /* Operação -------------------------------------------------------------- */
  const pendingProduction = orders.filter(
    (order) =>
      (order.status === 'pago' || order.status === 'em-producao') &&
      order.lines.some((line) => line.fulfillment === 'sob-encomenda'),
  );

  const lowStock = products.filter(
    (product) =>
      product.active &&
      product.fulfillment === 'pronta-entrega' &&
      totalStock(product) <= product.lowStockThreshold,
  );

  return {
    current: summarize(inWindow),
    previous: summarize(inPrevious),
    daily,
    dailySpark: daily.map((point) => point.value),
    topProducts,
    topBands,
    paymentSplit: [
      { label: 'PIX', value: payments.pix },
      { label: 'Cartão de crédito', value: payments.cartao },
      { label: 'Boleto', value: payments.boleto },
    ],
    fulfillmentSplit: [
      { label: 'Pronta-entrega', value: readyToShip },
      { label: 'Sob encomenda', value: madeToOrder },
    ],
    statusCounts,
    pendingProduction,
    lowStock,
  };
}
