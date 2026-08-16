import type {
  AdminUser,
  Coupon,
  Order,
  OrderLine,
  OrderStatus,
  Product,
  Size,
} from '../types';
import { ROLE_PERMISSIONS } from '../types';
import { SEED_PRODUCTS } from './products';

export const SEED_USERS: AdminUser[] = [
  {
    id: 'u-001',
    name: 'Lucia Vahl',
    email: 'mestre@camisetasinsanas.com.br',
    password: 'insanas',
    role: 'mestre',
    permissions: ROLE_PERMISSIONS.mestre,
    active: true,
    createdAt: '2024-11-01T09:00:00.000Z',
    lastLoginAt: '2026-08-10T21:14:00.000Z',
  },
  {
    id: 'u-002',
    name: 'Corvo Andrade',
    email: 'necromante@camisetasinsanas.com.br',
    password: 'insanas',
    role: 'necromante',
    permissions: ROLE_PERMISSIONS.necromante,
    active: true,
    createdAt: '2025-02-17T09:00:00.000Z',
    lastLoginAt: '2026-08-09T18:02:00.000Z',
  },
  {
    id: 'u-003',
    name: 'Ingrid Nyström',
    email: 'acolito@camisetasinsanas.com.br',
    password: 'insanas',
    role: 'acolito',
    permissions: ROLE_PERMISSIONS.acolito,
    active: true,
    createdAt: '2025-06-03T09:00:00.000Z',
    lastLoginAt: '2026-08-11T08:30:00.000Z',
  },
  {
    id: 'u-004',
    name: 'Tobias Rehn',
    email: 'servo@camisetasinsanas.com.br',
    password: 'insanas',
    role: 'servo',
    permissions: ROLE_PERMISSIONS.servo,
    active: false,
    createdAt: '2025-09-28T09:00:00.000Z',
  },
];

export const SEED_COUPONS: Coupon[] = [
  { code: 'CULTO10', percent: 10, minSubtotal: 150, active: true },
  { code: 'INSANA20', percent: 20, minSubtotal: 400, active: true },
  { code: 'INVERNO15', percent: 15, minSubtotal: 250, active: false },
];

/* -------------------------------------------------------------------------- */
/* Geração do histórico de pedidos                                            */
/* -------------------------------------------------------------------------- */

const FIRST_NAMES = [
  'Rafael', 'Marina', 'Diogo', 'Helena', 'Caio', 'Bruna', 'Vinícius', 'Larissa',
  'Otávio', 'Nathalia', 'Gustavo', 'Renata', 'Thiago', 'Camila', 'Leandro',
  'Priscila', 'Fabrício', 'Aline', 'Mateus', 'Débora',
];

const LAST_NAMES = [
  'Moreira', 'Antunes', 'Bittencourt', 'Vasques', 'D’Ávila', 'Kaminski',
  'Rezende', 'Fontoura', 'Barcellos', 'Queiroz', 'Sampaio', 'Nogueira',
  'Trindade', 'Escobar', 'Peixoto',
];

const CITIES: [string, string][] = [
  ['São Paulo', 'SP'], ['Porto Alegre', 'RS'], ['Curitiba', 'PR'],
  ['Belo Horizonte', 'MG'], ['Rio de Janeiro', 'RJ'], ['Florianópolis', 'SC'],
  ['Recife', 'PE'], ['Goiânia', 'GO'], ['Brasília', 'DF'], ['Salvador', 'BA'],
];

const STREETS = [
  'Rua das Acácias', 'Avenida Ipiranga', 'Rua Marechal Floriano',
  'Travessa do Ouvidor', 'Rua Padre Chagas', 'Avenida Nossa Senhora de Copacabana',
  'Rua Augusta', 'Rua XV de Novembro',
];

/**
 * Gerador congruente linear com semente fixa. Usar `Math.random` faria os
 * gráficos do painel mudarem a cada reload — com semente, o histórico é estável.
 */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const pick = <T,>(random: () => number, list: T[]): T =>
  list[Math.floor(random() * list.length)];

const randomInt = (random: () => number, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

function buildLine(random: () => number, product: Product): OrderLine {
  const sizes: Size[] =
    product.fulfillment === 'sob-encomenda'
      ? product.madeToOrderSizes
      : (Object.keys(product.stock) as Size[]);

  return {
    productId: product.id,
    name: product.name,
    band: product.band,
    art: product.art,
    photo: product.photos[0],
    size: pick(random, sizes.length ? sizes : (['G'] as Size[])),
    quantity: random() > 0.82 ? 2 : 1,
    unitPrice: product.price,
    fulfillment: product.fulfillment,
    productionDays: product.productionDays,
  };
}

/** Status coerente com a idade do pedido: os antigos já foram entregues. */
function statusForAge(random: () => number, daysAgo: number): OrderStatus {
  const roll = random();
  if (daysAgo > 25) return roll > 0.06 ? 'entregue' : 'cancelado';
  if (daysAgo > 14) return roll > 0.2 ? 'entregue' : 'enviado';
  if (daysAgo > 7) return roll > 0.45 ? 'enviado' : 'em-producao';
  if (daysAgo > 2) return roll > 0.5 ? 'em-producao' : 'pago';
  return roll > 0.35 ? 'pago' : 'aguardando-pagamento';
}

export const FREE_SHIPPING_THRESHOLD = 299;
export const SHIPPING_COST = 24.9;
/** Desconto por pagar à vista no PIX — praxe no varejo brasileiro. */
export const PIX_DISCOUNT = 0.05;

/**
 * Monta 90 dias de histórico. `now` é injetado para o resultado ser
 * determinístico em teste e coerente com a data de abertura da loja.
 */
export function generateSeedOrders(now: number, count = 78): Order[] {
  const random = makeRandom(20260211);
  const products = SEED_PRODUCTS.filter((p) => p.active);
  const orders: Order[] = [];

  for (let i = 0; i < count; i++) {
    // Concentra pedidos nos dias recentes: a loja vem crescendo.
    const daysAgo = Math.floor(Math.pow(random(), 1.6) * 90);
    const createdAt = new Date(
      now - daysAgo * 86_400_000 - randomInt(random, 0, 23) * 3_600_000,
    );

    const lineCount = random() > 0.72 ? 2 : 1;
    const chosen = new Set<string>();
    const lines: OrderLine[] = [];
    for (let l = 0; l < lineCount; l++) {
      const product = pick(random, products);
      if (chosen.has(product.id)) continue;
      chosen.add(product.id);
      lines.push(buildLine(random, product));
    }

    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const coupon = random() > 0.85 ? 'CULTO10' : undefined;
    const discount = coupon ? subtotal * 0.1 : 0;
    const shipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const status = statusForAge(random, daysAgo);
    const [city, state] = pick(random, CITIES);
    const name = `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`;

    const history: Order['history'] = [
      { status: 'aguardando-pagamento', at: createdAt.toISOString() },
    ];
    if (status !== 'aguardando-pagamento' && status !== 'cancelado') {
      history.push({
        status: 'pago',
        at: new Date(createdAt.getTime() + 3_600_000).toISOString(),
      });
    }
    if (status !== 'aguardando-pagamento' && status !== 'pago' && status !== 'cancelado') {
      history.push({ status, at: new Date(createdAt.getTime() + 86_400_000).toISOString() });
    }
    if (status === 'cancelado') {
      history.push({
        status: 'cancelado',
        at: new Date(createdAt.getTime() + 172_800_000).toISOString(),
      });
    }

    orders.push({
      id: `NEC-${String(10_000 + i)}`,
      createdAt: createdAt.toISOString(),
      status,
      customer: {
        name,
        email: `${name.split(' ')[0].toLowerCase()}@exemplo.com.br`,
        cpf: '000.000.000-00',
        phone: `(${randomInt(random, 11, 89)}) 9${randomInt(random, 1000, 9999)}-${randomInt(random, 1000, 9999)}`,
      },
      address: {
        cep: `${randomInt(random, 10_000, 99_999)}-${randomInt(random, 100, 999)}`,
        street: pick(random, STREETS),
        number: String(randomInt(random, 10, 2400)),
        district: 'Centro',
        city,
        state,
      },
      lines,
      subtotal,
      discount,
      shipping,
      total: subtotal - discount + shipping,
      payment: { method: 'pix' },
      coupon,
      trackingCode:
        status === 'enviado' || status === 'entregue'
          ? `BR${randomInt(random, 100_000_000, 999_999_999)}BR`
          : undefined,
      history,
    });
  }

  return orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
