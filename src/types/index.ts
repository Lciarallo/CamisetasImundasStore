/* ==========================================================================
   Modelo de domínio — Camisetas Insanas — Black Metal Store
   ========================================================================== */

export type Size = 'P' | 'M' | 'G' | 'GG' | 'XGG';

export const SIZES: Size[] = ['P', 'M', 'G', 'GG', 'XGG'];

export type Category =
  | 'Camiseta'
  | 'Manga Longa'
  | 'Moletom'
  | 'Bootleg'
  | 'Edição de Culto';

export const CATEGORIES: Category[] = [
  'Camiseta',
  'Manga Longa',
  'Moletom',
  'Bootleg',
  'Edição de Culto',
];

/**
 * Como a peça é fornecida.
 * - `pronta-entrega`: sai do estoque físico, despacho imediato.
 * - `sob-encomenda`: produzida após a compra, respeitando `productionDays`.
 *   Não consome estoque; consome capacidade da fila de produção.
 */
export type FulfillmentMode = 'pronta-entrega' | 'sob-encomenda';

export type ProductTag = 'Lançamento' | 'Clássico' | 'Última Peça' | 'Reissue';

/**
 * A arte de cada peça é desenhada em SVG, não fotografada — o visual fica
 * consistente, carrega instantâneo e não depende de CDN externo.
 */
export type Sigil =
  | 'pentagram'
  | 'heptagram'
  | 'skull'
  | 'cross'
  | 'goat'
  | 'tree'
  | 'moon'
  | 'chalice'
  | 'raven'
  | 'sword'
  | 'eye';

export const SIGILS: Sigil[] = [
  'pentagram',
  'heptagram',
  'skull',
  'cross',
  'goat',
  'tree',
  'moon',
  'chalice',
  'raven',
  'sword',
  'eye',
];

export interface TeeArt {
  sigil: Sigil;
  tone: 'bone' | 'blood';
  /** Cor do tecido — quase todo black metal é preto, mas há exceções. */
  fabric: 'preto' | 'carvao' | 'off-white';
}

/** Estoque por tamanho. Ausência de chave = tamanho não fabricado. */
export type StockBySize = Partial<Record<Size, number>>;

export interface Product {
  id: string;
  name: string;
  band: string;
  category: Category;
  price: number;
  oldPrice?: number;
  /**
   * Arte vetorial da peça. Continua sendo usada quando não há foto — nenhuma
   * peça fica sem imagem no catálogo.
   */
  art: TeeArt;
  /**
   * Fotos reais, já redimensionadas e comprimidas, em data URI. A primeira é a
   * capa; as demais aparecem na galeria do modal. Vazio = usa `art`.
   */
  photos: string[];
  tag?: ProductTag;
  rating: number;
  reviewsCount: number;
  description: string;
  details: string[];
  fulfillment: FulfillmentMode;
  /** Preenchido para `pronta-entrega`. Para sob encomenda fica vazio. */
  stock: StockBySize;
  /** Tamanhos fabricáveis sob encomenda. */
  madeToOrderSizes: Size[];
  /** Prazo de produção em dias úteis (só para sob encomenda). */
  productionDays?: number;
  /** Alerta no admin quando a soma do estoque cai abaixo disso. */
  lowStockThreshold: number;
  active: boolean;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  size: Size;
  quantity: number;
  /** Congelado no momento em que o item entra no carrinho. */
  fulfillment: FulfillmentMode;
}

/* -------------------------------------------------------------------------- */
/* Pedidos                                                                    */
/* -------------------------------------------------------------------------- */

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

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'aguardando-pagamento',
  'pago',
  'em-producao',
  'enviado',
  'entregue',
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  'aguardando-pagamento': 'Aguardando pagamento',
  pago: 'Pago',
  'em-producao': 'Em produção',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export interface OrderLine {
  productId: string;
  /** Nome gravado no pedido — sobrevive a renomeação do produto. */
  name: string;
  band: string;
  art: TeeArt;
  /** Capa congelada no momento da compra — sobrevive à troca de foto depois. */
  photo?: string;
  size: Size;
  quantity: number;
  unitPrice: number;
  fulfillment: FulfillmentMode;
  productionDays?: number;
}

export interface ShippingAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
}

export interface Customer {
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

export interface OrderInvoice {
  number: string;
  series: string;
  accessKey: string;
  issuedAt: string;
  authorizationProtocol: string;
  documentType: 'NF-e' | 'DANFE';
  emitter: {
    name: string;
    state: string;
    tradeName: string;
  };
  buyer: {
    name: string;
    cpf: string;
  };
  totalAmount: number;
  paymentMethod: string;
  paymentRef?: string;
  ncm: string;
}

export interface Order {
  id: string;
  /** Entregue somente na criação do pedido para consultas públicas autenticadas. */
  customerAccessToken?: string;
  createdAt: string;
  status: OrderStatus;
  customer: Customer;
  address: ShippingAddress;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  payment: {
    method: PaymentMethod;
    gateway?: 'infinitepay' | 'local' | null;
    status?: 'pendente' | 'aprovado' | 'recusado' | 'erro';
    /** URL de checkout da InfinitePay gerada para o pedido. */
    checkoutUrl?: string;
    /** Código PIX caso disponível */
    pixCode?: string;
    providerRef?: string;
    expiresAt?: string;
  };
  coupon?: string;
  trackingCode?: string;
  invoice?: OrderInvoice;
  /** Histórico de mudanças de status, para a timeline do admin. */
  history: { status: OrderStatus; at: string; by?: string }[];
}

/* -------------------------------------------------------------------------- */
/* Usuários e privilégios                                                     */
/* -------------------------------------------------------------------------- */

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

export const PERMISSION_LABEL: Record<Permission, string> = {
  'dashboard.view': 'Ver painel',
  'products.view': 'Ver produtos',
  'products.edit': 'Editar produtos',
  'stock.edit': 'Gerenciar estoque',
  'orders.view': 'Ver pedidos',
  'orders.edit': 'Gerenciar pedidos',
  'finance.view': 'Ver faturamento',
  'users.view': 'Ver usuários',
  'users.edit': 'Gerenciar usuários',
};

export type Role = 'mestre' | 'necromante' | 'acolito' | 'servo';

export const ROLE_LABEL: Record<Role, string> = {
  mestre: 'Mestre',
  necromante: 'Necromante',
  acolito: 'Acólito',
  servo: 'Servo',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  mestre: 'Domínio absoluto. Não pode ser rebaixado nem removido.',
  necromante: 'Gerencia catálogo, estoque, pedidos e faturamento.',
  acolito: 'Cuida de pedidos e estoque. Sem acesso ao faturamento.',
  servo: 'Somente leitura de pedidos e produtos.',
};

/** Privilégios que cada cargo recebe por padrão ao ser atribuído. */
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
  acolito: [
    'dashboard.view',
    'products.view',
    'stock.edit',
    'orders.view',
    'orders.edit',
  ],
  servo: ['products.view', 'orders.view'],
};

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  /** Demo: senha em claro no localStorage. Em produção → gerenciada pelo Firebase Auth. */
  password?: string;
  role: Role;
  /** Privilégios efetivos. Começam no padrão do cargo e podem ser ajustados. */
  permissions: Permission[];
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Cupons                                                                     */
/* -------------------------------------------------------------------------- */

export interface Coupon {
  code: string;
  /** Percentual de desconto (0–100). */
  percent: number;
  minSubtotal: number;
  active: boolean;
}
