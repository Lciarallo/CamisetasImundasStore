import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as authSignOut,
} from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable, type FunctionsError } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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
import { SEED_COUPONS } from '../data/seed';
import { SEED_PRODUCTS } from '../data/products';
import { usePersistentState } from '../lib/storage';
import { firebaseAuth, firestore, functions, storage } from '../lib/firebase';
import { availableFor, computeTotals } from './cart';
import type { OrderDraft, Result, StoreValue } from './types';

/** Traduz o erro do Functions para algo que caiba na tela. */
function describe(cause: unknown): string {
  const error = cause as FunctionsError;
  if (error?.message) return error.message;
  return 'Não foi possível concluir. Tente de novo.';
}

async function call<TIn, TOut>(name: string, payload: TIn): Promise<TOut> {
  const fn = httpsCallable<TIn, TOut>(functions(), name);
  const response = await fn(payload);
  return response.data;
}

/** Envolve uma chamada num `Result`, para a tela não precisar de try/catch. */
async function attempt(action: () => Promise<unknown>, success: string): Promise<Result> {
  try {
    await action();
    return { ok: true, message: success };
  } catch (cause) {
    return { ok: false, message: describe(cause) };
  }
}

export function useFirebaseBackend(): StoreValue {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [session, setSession] = useState<AdminUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [productsReady, setProductsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  // O carrinho continua no navegador: é rascunho do visitante, não dado da
  // loja. Guardar no servidor exigiria identificar quem não fez login.
  const [cart, setCart] = usePersistentState<CartItem[]>('cart', []);
  const [couponCode, setCouponCode] = usePersistentState<string | null>('coupon', null);

  /* ---------------------------------------------------------------------- */
  /* Sessão                                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), async (user) => {
      if (!user) {
        setSession(null);
        setAuthReady(true);
        return;
      }
      try {
        // `registerLogin` reaplica as claims: se a conta foi editada com a
        // sessão aberta, é aqui que o token se acerta.
        const profile = await call<Record<string, never>, AdminUser & { uid: string }>(
          'registerLogin',
          {} as Record<string, never>,
        );
        await user.getIdToken(true);
        setSession({ ...profile, id: profile.uid });
      } catch (cause) {
        // Conta sem perfil ou desativada: derruba a sessão em vez de deixar
        // um usuário logado que nenhuma regra vai autorizar.
        setSession(null);
        await authSignOut(firebaseAuth());
        setError(describe(cause));
      } finally {
        setAuthReady(true);
      }
    });
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Assinaturas                                                             */
  /* ---------------------------------------------------------------------- */

  // Catálogo: público. Sem sessão só vêm as peças ativas, que é o que as
  // regras permitem — pedir todas resultaria em erro de permissão.
  useEffect(() => {
    const base = collection(firestore(), 'products');
    const q = session ? query(base) : query(base, where('active', '==', true));

    return onSnapshot(
      q,
      (snap) => {
        setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product));
        setProductsReady(true);
        setError(null);
      },
      (cause) => {
        setProductsReady(true);
        setError(`Catálogo indisponível: ${cause.message}`);
      },
    );
  }, [session]);

  useEffect(() => {
    return onSnapshot(
      query(collection(firestore(), 'coupons'), where('active', '==', true)),
      (snap) => setCoupons(snap.docs.map((doc) => ({ code: doc.id, ...doc.data() }) as Coupon)),
      () => setCoupons([]),
    );
  }, []);

  // Pedidos e equipe só existem para quem tem privilégio; assinar sem ele
  // devolveria erro de permissão a cada render.
  const canView = useCallback(
    (permission: Permission) => session?.permissions.includes(permission) ?? false,
    [session],
  );

  useEffect(() => {
    if (!canView('orders.view')) {
      setOrders([]);
      return;
    }
    return onSnapshot(
      collection(firestore(), 'orders'),
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Order);
        list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setOrders(list);
      },
      (cause) => setError(`Pedidos indisponíveis: ${cause.message}`),
    );
  }, [canView]);

  useEffect(() => {
    if (!canView('users.view')) {
      setUsers(session ? [session] : []);
      return;
    }
    return onSnapshot(
      collection(firestore(), 'adminUsers'),
      (snap) => setUsers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AdminUser)),
      (cause) => setError(`Equipe indisponível: ${cause.message}`),
    );
  }, [canView, session]);

  /* ---------------------------------------------------------------------- */
  /* Instalação inicial                                                      */
  /* ---------------------------------------------------------------------- */

  // Loja recém-criada não tem catálogo nem administrador. Detectamos pela
  // ausência de peças, que é o único sinal legível sem estar autenticado.
  useEffect(() => {
    if (productsReady && authReady) {
      setNeedsBootstrap(products.length === 0 && !session);
    }
  }, [productsReady, authReady, products.length, session]);

  /* ---------------------------------------------------------------------- */
  /* Carrinho                                                                */
  /* ---------------------------------------------------------------------- */

  const productById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products],
  );

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
      if (!coupon) return { ok: false, message: 'Cupom inválido ou expirado.' };
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
  /* Mutações                                                                */
  /* ---------------------------------------------------------------------- */

  const placeOrder = useCallback(
    async (draft: OrderDraft): Promise<Order> => {
      // Só o que comprar; preço, frete e total voltam calculados pelo servidor.
      return call<Record<string, unknown>, Order>('placeOrder', {
        items: cart.map((item) => ({
          productId: item.productId,
          size: item.size,
          quantity: item.quantity,
        })),
        customer: draft.customer,
        address: draft.address,
        payment: draft.payment,
        coupon: draft.coupon ?? null,
      });
    },
    [cart],
  );

  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) =>
      attempt(() => call('updateOrderStatus', { orderId, status }), 'Status atualizado.'),
    [],
  );

  const setTrackingCode = useCallback(
    (orderId: string, code: string) =>
      attempt(() => call('setTrackingCode', { orderId, code }), 'Rastreio salvo.'),
    [],
  );

  const saveProduct = useCallback(
    (product: Product) =>
      attempt(() => {
        const { id, ...rest } = product;
        return call('saveProduct', { id, product: rest });
      }, 'Peça salva.'),
    [],
  );

  const deleteProduct = useCallback(
    (productId: string) =>
      attempt(async () => {
        await call('deleteProduct', { id: productId });
        setCart((previous) => previous.filter((item) => item.productId !== productId));
      }, 'Peça removida.'),
    [setCart],
  );

  const adjustStock = useCallback(async (productId: string, size: Size, delta: number) => {
    await call('setStock', { productId, size, delta });
  }, []);

  const setStock = useCallback(async (productId: string, size: Size, value: number) => {
    await call('setStock', { productId, size, value });
  }, []);

  const uploadPhoto = useCallback(async (productId: string, file: Blob): Promise<string> => {
    // Nome único: subir duas fotos com o mesmo nome sobrescreveria a primeira.
    const name = `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}.webp`;
    const target = ref(storage(), `products/${productId}/${name}`);
    await uploadBytes(target, file, { contentType: file.type || 'image/webp' });
    return getDownloadURL(target);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Autenticação                                                            */
  /* ---------------------------------------------------------------------- */

  const signIn = useCallback(
    (email: string, password: string) =>
      attempt(
        () => signInWithEmailAndPassword(firebaseAuth(), email.trim(), password),
        'Bem-vindo.',
      ),
    [],
  );

  const signOut = useCallback(async () => {
    await authSignOut(firebaseAuth());
    setSession(null);
  }, []);

  const can = useCallback(
    (permission: Permission) => session?.permissions.includes(permission) ?? false,
    [session],
  );

  const saveUser = useCallback(
    (user: AdminUser, password?: string) =>
      attempt(
        () =>
          call('saveStaff', {
            // Conta nova ainda não tem uid; o servidor cria no Auth.
            uid: user.id.startsWith('u-') ? null : user.id,
            name: user.name,
            email: user.email,
            password: password || user.password || undefined,
            role: user.role,
            permissions: user.permissions,
            active: user.active,
          }),
        'Usuário salvo.',
      ),
    [],
  );

  const deleteUser = useCallback(
    (userId: string) => attempt(() => call('deleteStaff', { uid: userId }), 'Usuário removido.'),
    [],
  );

  const bootstrap = useCallback(
    async (input: { name: string; email: string; password: string }): Promise<Result> => {
      try {
        await call('bootstrap', input);
        await signInWithEmailAndPassword(firebaseAuth(), input.email.trim(), input.password);
        // Token novo já traz as claims de Mestre, necessárias para o seed.
        await firebaseAuth().currentUser?.getIdToken(true);

        await call('seedCatalog', {
          products: SEED_PRODUCTS.map(({ id, ...rest }) => ({ id, product: rest })),
          coupons: SEED_COUPONS.map(({ code, ...rest }) => ({ code, coupon: rest })),
          replace: true,
        });

        setNeedsBootstrap(false);
        return { ok: true, message: 'Loja instalada.' };
      } catch (cause) {
        return { ok: false, message: describe(cause) };
      }
    },
    [],
  );

  const resetEverything = useCallback(async () => {
    await call('seedCatalog', {
      products: SEED_PRODUCTS.map(({ id, ...rest }) => ({ id, product: rest })),
      coupons: SEED_COUPONS.map(({ code, ...rest }) => ({ code, coupon: rest })),
      replace: true,
    });
    clearCart();
  }, [clearCart]);

  return {
    mode: 'firebase',
    loading: !authReady || !productsReady,
    error,
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
    uploadPhoto,
    session,
    signIn,
    signOut,
    can,
    saveUser,
    deleteUser,
    needsBootstrap,
    bootstrap,
    resetEverything,
  };
}
