import { useCallback, useMemo, useState } from 'react';
import type {
  AdminUser,
  CartItem,
  Coupon,
  Order,
  OrderLine,
  OrderStatus,
  Permission,
  Product,
  Size,
} from '../types';
import { SEED_PRODUCTS } from '../data/products';
import { PIX_DISCOUNT, SEED_COUPONS, SEED_USERS, generateSeedOrders } from '../data/seed';
import { usePersistentState, wipeStorage } from '../lib/storage';
import { availableFor, computeTotals } from './cart';
import type { OrderDraft, Result, StoreValue } from './types';

/**
 * Backend local, em `localStorage`.
 *
 * Serve para a loja rodar sem infraestrutura — quem clona o repositório vê
 * tudo funcionando sem criar projeto no Firebase. Não é seguro e não pretende
 * ser: o total do pedido é calculado aqui no navegador. É demonstração.
 */
export function useLocalBackend(): StoreValue {
  const [products, setProducts] = usePersistentState<Product[]>('products', () => SEED_PRODUCTS);
  // Pedidos contêm CPF, telefone e endereço; no modo local ficam só em memória.
  const [orders, setOrders] = useState<Order[]>(() => generateSeedOrders(Date.now()));
  const [users, setUsers] = usePersistentState<AdminUser[]>('users', () => SEED_USERS);
  const [coupons] = usePersistentState<Coupon[]>('coupons', () => SEED_COUPONS);

  const [cart, setCart] = usePersistentState<CartItem[]>('cart', []);
  const [couponCode, setCouponCode] = usePersistentState<string | null>('coupon', null);
  const [sessionId, setSessionId] = usePersistentState<string | null>('session', null);

  const productById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products],
  );

  /* ---------------------------------------------------------------------- */
  /* Carrinho                                                                */
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

  const cartTotals = useMemo(
    () => computeTotals(cart, products, appliedCoupon),
    [cart, products, appliedCoupon],
  );

  const applyCoupon = useCallback(
    async (code: string): Promise<Result> => {
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
      return {
        ok: true,
        message: `Cupom ${coupon.code} aplicado: ${coupon.percent}% de desconto.`,
      };
    },
    [coupons, cartTotals.subtotal, setCouponCode],
  );

  const removeCoupon = useCallback(() => setCouponCode(null), [setCouponCode]);

  /* ---------------------------------------------------------------------- */
  /* Pedidos                                                                 */
  /* ---------------------------------------------------------------------- */

  const placeOrder = useCallback(
    async (draft: OrderDraft): Promise<Order> => {
      if (draft.payment.method !== 'pix') {
        throw new Error('No momento, o checkout aceita somente PIX.');
      }

      const orderId = `INS-${draft.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()}`;
      const existing = orders.find((order) => order.id === orderId);
      if (existing) return existing;

      const createdAt = new Date().toISOString();

      const lines: OrderLine[] = cart.flatMap((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return [];
        return [
          {
            productId: product.id,
            name: product.name,
            band: product.band,
            art: product.art,
            photo: product.photos[0],
            size: item.size,
            quantity: item.quantity,
            unitPrice: product.price,
            fulfillment: product.fulfillment,
            productionDays: product.productionDays,
          },
        ];
      });

      const pixDiscount = cartTotals.total * PIX_DISCOUNT;
      const total = cartTotals.total - pixDiscount;
      const status: OrderStatus = 'aguardando-pagamento';

      const order: Order = {
        id: orderId,
        customerAccessToken: crypto.randomUUID(),
        createdAt,
        status,
        customer: draft.customer,
        address: draft.address,
        lines,
        subtotal: cartTotals.subtotal,
        discount: cartTotals.discount + pixDiscount,
        shipping: cartTotals.shipping,
        total,
        payment: {
          method: 'pix',
          gateway: 'local',
          status: 'pendente',
          checkoutUrl: `https://checkout.infinitepay.io/mock/${orderId}`,
        },
        coupon: draft.coupon,
        history: [{ status, at: createdAt }],
      };

      setOrders((previous) => [order, ...previous]);

      // Só pronta-entrega baixa estoque; sob encomenda entra na fila de produção.
      setProducts((previous) =>
        previous.map((product) => {
          const sold = order.lines.filter(
            (line) =>
              line.productId === product.id && line.fulfillment === 'pronta-entrega',
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
    [cart, products, cartTotals, orders, setOrders, setProducts],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus): Promise<Result> => {
      setOrders((previous) =>
        previous.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                history: [
                  ...order.history,
                  { status, at: new Date().toISOString(), by: 'local' },
                ],
              }
            : order,
        ),
      );
      return { ok: true, message: 'Status atualizado.' };
    },
    [setOrders],
  );

  const setTrackingCode = useCallback(
    async (orderId: string, code: string): Promise<Result> => {
      setOrders((previous) =>
        previous.map((order) =>
          order.id === orderId ? { ...order, trackingCode: code } : order,
        ),
      );
      return { ok: true, message: 'Rastreio salvo.' };
    },
    [setOrders],
  );

  const lookupOrders = useCallback(
    async (orderId: string, accessToken?: string): Promise<Order[]> => {
      const normalizedId = orderId.trim().toLowerCase();
      const normalizedToken = accessToken?.trim();
      if (!normalizedId || !normalizedToken) return [];

      return orders.filter(
        (order) =>
          order.id.toLowerCase() === normalizedId &&
          order.customerAccessToken === normalizedToken,
      );
    },
    [orders],
  );

  /* ---------------------------------------------------------------------- */
  /* Catálogo                                                                */
  /* ---------------------------------------------------------------------- */

  const saveProduct = useCallback(
    async (product: Product): Promise<Result> => {
      setProducts((previous) => {
        const exists = previous.some((p) => p.id === product.id);
        return exists
          ? previous.map((p) => (p.id === product.id ? product : p))
          : [product, ...previous];
      });
      return { ok: true, message: 'Peça salva.' };
    },
    [setProducts],
  );

  const deleteProduct = useCallback(
    async (productId: string): Promise<Result> => {
      setProducts((previous) => previous.filter((p) => p.id !== productId));
      setCart((previous) => previous.filter((item) => item.productId !== productId));
      return { ok: true, message: 'Peça removida.' };
    },
    [setProducts, setCart],
  );

  const adjustStock = useCallback(
    async (productId: string, size: Size, delta: number) => {
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
    async (productId: string, size: Size, value: number) => {
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

  /** Sem bucket, a foto vira data URI — a mesma coisa que já era feita. */
  const uploadPhoto = useCallback(async (_productId: string, file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.readAsDataURL(file);
    });
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Sessão                                                                  */
  /* ---------------------------------------------------------------------- */

  const session = useMemo(
    () => users.find((u) => u.id === sessionId && u.active) ?? null,
    [users, sessionId],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
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

  const signOut = useCallback(async () => setSessionId(null), [setSessionId]);

  const can = useCallback(
    (permission: Permission) => session?.permissions.includes(permission) ?? false,
    [session],
  );

  const saveUser = useCallback(
    async (user: AdminUser, password?: string): Promise<Result> => {
      setUsers((previous) => {
        const exists = previous.some((u) => u.id === user.id);
        const updated = password ? { ...user, password } : user;
        return exists
          ? previous.map((u) => (u.id === user.id ? updated : u))
          : [...previous, updated];
      });
      return { ok: true, message: 'Usuário salvo.' };
    },
    [setUsers],
  );

  const deleteUser = useCallback(
    async (userId: string): Promise<Result> => {
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

  const resetEverything = useCallback(async () => {
    wipeStorage();
    window.location.reload();
  }, []);

  return {
    mode: 'local',
    loading: false,
    error: null,
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
    lookupOrders,
    saveProduct,
    deleteProduct,
    adjustStock,
    setStock,
    uploadPhoto,
    session,
    signIn,
    signOut,
    can,
    saveUser,
    deleteUser,
    // Sem backend não há instalação a fazer: o seed já vem embutido.
    needsBootstrap: false,
    bootstrap: async () => ({ ok: false, message: 'Indisponível no modo local.' }),
    resetEverything,
  };
}
