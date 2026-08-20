/**
 * Tipos e regras de negócio compartilhados pelas funções.
 *
 * Duplicam de propósito o que existe em `src/types` no front: as funções são
 * um pacote npm separado, com seu próprio tsconfig e deploy. Importar de fora
 * do `rootDir` quebraria a compilação, e o valor de ter a checagem no servidor
 * está justamente em ela não depender do que o cliente mandou.
 */

export type Size = 'P' | 'M' | 'G' | 'GG' | 'XGG';
export const SIZES: Size[] = ['P', 'M', 'G', 'GG', 'XGG'];

export type FulfillmentMode = 'pronta-entrega' | 'sob-encomenda';

/**
 * A loja cobra exclusivamente por PIX à vista. Cartão e boleto exigiriam
 * guardar dado de portador ou conciliar registro bancário — responsabilidades
 * que só se justificam com um PSP dedicado, e que não existem aqui.
 */
export type PaymentMethod = 'pix';

export type OrderStatus =
  | 'aguardando-pagamento'
  | 'pago'
  | 'em-producao'
  | 'enviado'
  | 'entregue'
  | 'cancelado';

/** Ordem da esteira. O status só avança um degrau por vez. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'aguardando-pagamento',
  'pago',
  'em-producao',
  'enviado',
  'entregue',
];

export type Permission =
  | 'dashboard.view'
  | 'products.view'
  | 'products.edit'
  | 'stock.edit'
  | 'orders.view'
  | 'orders.edit'
  | 'finance.view'
  | 'users.view'
  | 'users.edit';

export const ALL_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'products.view',
  'products.edit',
  'stock.edit',
  'orders.view',
  'orders.edit',
  'finance.view',
  'users.view',
  'users.edit',
];

export type Role = 'mestre' | 'necromante' | 'acolito' | 'servo';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  mestre: ALL_PERMISSIONS,
  necromante: [
    'dashboard.view',
    'products.view',
    'products.edit',
    'stock.edit',
    'orders.view',
    'orders.edit',
    'finance.view',
    'users.view',
  ],
  acolito: ['dashboard.view', 'products.view', 'stock.edit', 'orders.view', 'orders.edit'],
  servo: ['products.view', 'orders.view'],
};

/* -------------------------------------------------------------------------- */
/* Regras comerciais                                                          */
/* -------------------------------------------------------------------------- */

export const FREE_SHIPPING_THRESHOLD = 299;
export const SHIPPING_COST = 24.9;

/** Teto por linha, para um pedido forjado não zerar o estoque de uma vez. */
export const MAX_QUANTITY_PER_LINE = 10;
export const MAX_LINES_PER_ORDER = 20;

/** Dinheiro sempre com 2 casas; evita 0.1 + 0.2 vazando para o total. */
export const round2 = (value: number) => Math.round(value * 100) / 100;

export interface StockBySize {
  [size: string]: number | undefined;
}

export interface ProductDoc {
  name: string;
  band: string;
  category: string;
  price: number;
  oldPrice?: number;
  art: { sigil: string; tone: string; fabric: string };
  photos: string[];
  tag?: string;
  rating: number;
  reviewsCount: number;
  description: string;
  details: string[];
  fulfillment: FulfillmentMode;
  stock: StockBySize;
  madeToOrderSizes: Size[];
  productionDays?: number;
  lowStockThreshold: number;
  active: boolean;
  createdAt: string;
}

export interface CouponDoc {
  percent: number;
  minSubtotal: number;
  active: boolean;
}

export interface AdminUserDoc {
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}
