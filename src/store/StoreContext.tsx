import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
import { ROLE_PERMISSIONS } from '../types';
import { SEED_PRODUCTS } from '../data/products';
import {
  FREE_SHIPPING_THRESHOLD,
  SEED_COUPONS,
  SEED_USERS,
  SHIPPING_COST,
  generateSeedOrders,
} from '../data/seed';
import { usePersistentState, wipeStorage } from '../lib/storage';

/* -------------------------------------------------------------------------- */
/* Regras de estoque                                                          */
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
/* Contexto                                                                   */
/* -------------------------------------------------------------------------- */

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

interface StoreValue {
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
  applyCoupon: (code: string) => { ok: boolean; message: string };
  removeCoupon: () => void;

  placeOrder: (order: Omit<Order, 'id' | 'createdAt' | 'history'>) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus, by?: string) => void;
  setTrackingCode: (orderId: string, code: string) => void;

  saveProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  adjustStock: (productId: string, size: Size, delta: number) => void;
  setStock: (productId: string, size: Size, value: number) => void;

  session: AdminUser | null;
  signIn: (email: string, password: string) => { ok: boolean; message: string };
  signOut: () => void;
  can: (permission: Permission) => boolean;
  saveUser: (user: AdminUser) => void;
  deleteUser: (userId: string) => { ok: boolean; message: string };

  resetEverything: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = usePersistentState<Product[]>(
    'products',
    () => SEED_PRODUCTS,
  );
  const [orders, setOrders] = usePersistentState<Order[]>('orders', () =>
    generateSeedOrders(Date.now()),
  );
  const [users, setUsers] = usePersistentState<AdminUser[]>('users', () => SEED_USERS);
  const [coupons] = usePersistentState<Coupon[]>('coupons', () => SEED_COUPONS);

  const [cart, setCart] = usePersistentState<CartItem[]>('cart', []);
  const [couponCode, setCouponCode] = usePersistentState<string | null>('coupon', null);
  const [sessionId, setSessionId] = usePersistentState<string | null>('session', null);

  // Contador para IDs de pedido dentro da sessão, evita colisão em compras seguidas.
  const [orderSeq, setOrderSeq] = useState(0);

  const productById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products],
  );

  /* ---------------------------------------------------------------------- */
  /* Carrinho                                                               */
  /* ---------------------------------------------------------------------- */

  const addToCart = useCallback(
    (productId: string, size: Size, quantity = 1) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const available = availableFor(product, size);
      if (available <= 0) return;

      setCart((previous) => {
        const index = previous.findIndex(
          (item) => item.productId === productId && item.size === size,
        );
        if (index > -1) {
          const next = [...previous];
          // Nunca deixa passar do disponível, mesmo clicando várias vezes.
          next[index] = {
            ...next[index],
            quantity: Math.min(next[index].quantity + quantity, available),
          };
          return next;
        }
        return [
          ...previous,
          {
            productId,
            size,
            quantity: Math.min(quantity, available),
            fulfillment: product.fulfillment,
          },
        ];
      });
    },
    [products, setCart],
  );

  const setCartQuantity = useCallback(
    (index: number, quantity: number) => {
      setCart((previous) => {
        if (quantity <= 0) return previous.filter((_, i) => i !== index);
        const item = previous[index];
        if (!item) return previous;

        const product = products.find((p) => p.id === item.productId);
        const available = product ? availableFor(product, item.size) : quantity;

        const next = [...previous];
        next[index] = { ...item, quantity: Math.min(quantity, available) };
        return next;
      });
    },
    [products, setCart],
  );

  const removeFromCart = useCallback(
    (index: number) => setCart((previous) => previous.filter((_, i) => i !== index)),
    [setCart],
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setCouponCode(null);
  }, [setCart, setCouponCode]);

  const appliedCoupon = useMemo(
    () => coupons.find((c) => c.code === couponCode && c.active) ?? null,
    [coupons, couponCode],
  );

  const cartTotals = useMemo<CartTotals>(() => {
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

    // O cupom só vale se o subtotal alcançar o mínimo dele.
    const eligible = appliedCoupon && subtotal >= appliedCoupon.minSubtotal;
    const discount = eligible ? (subtotal * appliedCoupon.percent) / 100 : 0;
    const afterDiscount = subtotal - discount;
    const shipping =
      itemCount === 0 || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

    return {
      subtotal,
      discount,
      shipping,
      total: afterDiscount + shipping,
      itemCount,
      missingForFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount),
      productionDays,
    };
  }, [cart, products, appliedCoupon]);

  const applyCoupon = useCallback(
    (code: string) => {
      const normalized = code.trim().toUpperCase();
      const coupon = coupons.find((c) => c.code === normalized);

      if (!coupon || !coupon.active) {
        return { ok: false, message: 'Cupom inválido ou expirado.' };
      }
      if (cartTotals.subtotal < coupon.minSubtotal) {
        return {
          ok: false,
          message: `Este cupom exige pedido mínimo de R$ ${coupon.minSubtotal.toFixed(2).replace('.', ',')}.`,
        };
      }
      setCouponCode(coupon.code);
      return { ok: true, message: `Cupom ${coupon.code} aplicado: ${coupon.percent}% de desconto.` };
    },
    [coupons, cartTotals.subtotal, setCouponCode],
  );

  const removeCoupon = useCallback(() => setCouponCode(null), [setCouponCode]);

  /* ---------------------------------------------------------------------- */
  /* Pedidos                                                                */
  /* ---------------------------------------------------------------------- */

  const placeOrder = useCallback(
    (draft: Omit<Order, 'id' | 'createdAt' | 'history'>) => {
      const createdAt = new Date().toISOString();
      const order: Order = {
        ...draft,
        id: `NEC-${20_000 + orderSeq + Math.floor(Date.now() / 1000) % 10_000}`,
        createdAt,
        history: [{ status: draft.status, at: createdAt }],
      };

      setOrderSeq((n) => n + 1);
      setOrders((previous) => [order, ...previous]);

      // Só pronta-entrega baixa estoque; sob encomenda entra na fila de produção.
      setProducts((previous) =>
        previous.map((product) => {
          const sold = order.lines.filter(
            (line) => line.productId === product.id && line.fulfillment === 'pronta-entrega',
          );
          if (sold.length === 0) return product;

          const stock = { ...product.stock };
          for (const line of sold) {
            stock[line.size] = Math.max(0, (stock[line.size] ?? 0) - line.quantity);
          }
          return { ...product, stock };
        }),
      );

      return order;
    },
    [orderSeq, setOrders, setProducts],
  );

  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderStatus, by?: string) => {
      setOrders((previous) =>
        previous.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                history: [...order.history, { status, at: new Date().toISOString(), by }],
              }
            : order,
        ),
      );
    },
    [setOrders],
  );

  const setTrackingCode = useCallback(
    (orderId: string, code: string) => {
      setOrders((previous) =>
        previous.map((order) =>
          order.id === orderId ? { ...order, trackingCode: code } : order,
        ),
      );
    },
    [setOrders],
  );

  /* ---------------------------------------------------------------------- */
  /* Catálogo e estoque                                                     */
  /* ---------------------------------------------------------------------- */

  const saveProduct = useCallback(
    (product: Product) => {
      setProducts((previous) => {
        const exists = previous.some((p) => p.id === product.id);
        return exists
          ? previous.map((p) => (p.id === product.id ? product : p))
          : [product, ...previous];
      });
    },
    [setProducts],
  );

  const deleteProduct = useCallback(
    (productId: string) => {
      setProducts((previous) => previous.filter((p) => p.id !== productId));
      setCart((previous) => previous.filter((item) => item.productId !== productId));
    },
    [setProducts, setCart],
  );

  const adjustStock = useCallback(
    (productId: string, size: Size, delta: number) => {
      setProducts((previous) =>
        previous.map((product) =>
          product.id === productId
            ? {
                ...product,
                stock: {
                  ...product.stock,
                  [size]: Math.max(0, (product.stock[size] ?? 0) + delta),
                },
              }
            : product,
        ),
      );
    },
    [setProducts],
  );

  const setStock = useCallback(
    (productId: string, size: Size, value: number) => {
      setProducts((previous) =>
        previous.map((product) =>
          product.id === productId
            ? { ...product, stock: { ...product.stock, [size]: Math.max(0, value) } }
            : product,
        ),
      );
    },
    [setProducts],
  );

  /* ---------------------------------------------------------------------- */
  /* Sessão e privilégios                                                   */
  /* ---------------------------------------------------------------------- */

  const session = useMemo(
    () => users.find((u) => u.id === sessionId && u.active) ?? null,
    [users, sessionId],
  );

  const signIn = useCallback(
    (email: string, password: string) => {
      const user = users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!user || user.password !== password) {
        return { ok: false, message: 'Credenciais inválidas.' };
      }
      if (!user.active) {
        return { ok: false, message: 'Esta conta foi desativada pelo Mestre.' };
      }

      setUsers((previous) =>
        previous.map((u) =>
          u.id === user.id ? { ...u, lastLoginAt: new Date().toISOString() } : u,
        ),
      );
      setSessionId(user.id);
      return { ok: true, message: `Bem-vindo, ${user.name}.` };
    },
    [users, setUsers, setSessionId],
  );

  const signOut = useCallback(() => setSessionId(null), [setSessionId]);

  const can = useCallback(
    (permission: Permission) => session?.permissions.includes(permission) ?? false,
    [session],
  );

  const saveUser = useCallback(
    (user: AdminUser) => {
      setUsers((previous) => {
        const exists = previous.some((u) => u.id === user.id);
        return exists
          ? previous.map((u) => (u.id === user.id ? user : u))
          : [...previous, user];
      });
    },
    [setUsers],
  );

  const deleteUser = useCallback(
    (userId: string) => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { ok: false, message: 'Usuário não encontrado.' };
      if (target.role === 'mestre') {
        return { ok: false, message: 'O Mestre não pode ser removido.' };
      }
      if (target.id === sessionId) {
        return { ok: false, message: 'Você não pode remover a própria conta.' };
      }
      setUsers((previous) => previous.filter((u) => u.id !== userId));
      return { ok: true, message: `${target.name} foi banido do culto.` };
    },
    [users, sessionId, setUsers],
  );

  const resetEverything = useCallback(() => {
    wipeStorage();
    window.location.reload();
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      products,
      orders,
      users,
      coupons,
      cart,
      appliedCoupon,
      cartTotals,
      productById,
      addToCart,
      setCartQuantity,
      removeFromCart,
      clearCart,
      applyCoupon,
      removeCoupon,
      placeOrder,
      updateOrderStatus,
      setTrackingCode,
      saveProduct,
      deleteProduct,
      adjustStock,
      setStock,
      session,
      signIn,
      signOut,
      can,
      saveUser,
      deleteUser,
      resetEverything,
    }),
    [
      products, orders, users, coupons, cart, appliedCoupon, cartTotals, productById,
      addToCart, setCartQuantity, removeFromCart, clearCart, applyCoupon, removeCoupon,
      placeOrder, updateOrderStatus, setTrackingCode, saveProduct, deleteProduct,
      adjustStock, setStock, session, signIn, signOut, can, saveUser, deleteUser,
      resetEverything,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore precisa estar dentro de <StoreProvider>.');
  return context;
}

/** Privilégios padrão de um cargo — usado ao trocar o cargo de um usuário. */
export const defaultPermissionsFor = (role: AdminUser['role']) => ROLE_PERMISSIONS[role];
