import type {
  AdminUser,
  CartItem,
  Coupon,
  Order,
  OrderStatus,
  Permission,
  Product,
  Size,
} from '../types';

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
  /** Quanto falta para o frete grátis; 0 quando já atingido. */
  missingForFreeShipping: number;
  /** Maior prazo de produção entre os itens sob encomenda. */
  productionDays: number;
}

export interface Result {
  ok: boolean;
  message: string;
}

/** Dados que o checkout envia. Preço e total ficam de fora de propósito. */
export interface OrderDraft {
  /** Estável durante uma tentativa de checkout; impede pedidos duplicados em retries. */
  idempotencyKey: string;
  customer: Order['customer'];
  address: Order['address'];
  payment: { method: 'pix' };
  coupon?: string;
}

/**
 * Contrato que a loja enxerga, independente de onde os dados moram.
 *
 * Duas implementações o cumprem: `localBackend` (localStorage, para demonstrar
 * sem infraestrutura) e `firebaseBackend` (Firestore, Auth, Storage e Cloud
 * Functions). Os componentes não sabem qual está no ar.
 *
 * As mutações são assíncronas mesmo na versão local — se fossem síncronas ali
 * e assíncronas aqui, cada tela precisaria de dois caminhos.
 */
export interface StoreValue {
  /** Qual implementação está ativa, para a interface poder avisar. */
  mode: 'local' | 'firebase';
  /** Primeira carga ainda em andamento. */
  loading: boolean;
  /** Falha de conexão ou permissão, para exibir em vez de tela vazia. */
  error: string | null;

  products: Product[];
  orders: Order[];
  users: AdminUser[];
  coupons: Coupon[];

  cart: CartItem[];
  appliedCoupon: Coupon | null;
  cartTotals: CartTotals;
  productById: (id: string) => Product | undefined;

  addToCart: (productId: string, size: Size, quantity?: number) => void;
  setCartQuantity: (index: number, quantity: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<Result>;
  removeCoupon: () => void;
  saveCoupon: (coupon: Coupon) => Promise<Result>;
  deleteCoupon: (code: string) => Promise<Result>;

  /** Fecha o pedido. No modo Firebase o total vem recalculado do servidor. */
  placeOrder: (draft: OrderDraft) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<Result>;
  setTrackingCode: (orderId: string, code: string) => Promise<Result>;
  lookupOrders: (orderId: string, accessToken?: string) => Promise<Order[]>;

  saveProduct: (product: Product) => Promise<Result>;
  deleteProduct: (productId: string) => Promise<Result>;
  adjustStock: (productId: string, size: Size, delta: number) => Promise<void>;
  setStock: (productId: string, size: Size, value: number) => Promise<void>;
  /** Sobe uma foto e devolve a URL para gravar na peça. */
  uploadPhoto: (productId: string, file: Blob) => Promise<string>;

  session: AdminUser | null;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  can: (permission: Permission) => boolean;
  saveUser: (user: AdminUser, password?: string) => Promise<Result>;
  deleteUser: (userId: string) => Promise<Result>;

  /** Instalação inicial: cria o primeiro Mestre e popula o catálogo. */
  needsBootstrap: boolean;
  bootstrap: (input: { name: string; email: string; password: string }) => Promise<Result>;

  resetEverything: () => Promise<void>;
}
