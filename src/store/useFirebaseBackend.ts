import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FunctionsError } from 'firebase/functions';
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
import {
  isUsingFirebaseEmulators,
  loadFirestore,
  loadAuth,
  loadFunctions,
  loadStorage,
} from '../lib/firebase';
import { availableFor, computeTotals } from './cart';
import type { OrderDraft, Result, StoreValue } from './types';

/** Traduz o erro do Functions para algo que caiba na tela. */
function describe(cause: unknown): string {
  const error = cause as FunctionsError;
  if (error?.message) return error.message;
  return 'Não foi possível concluir. Tente de novo.';
}

async function call<TIn, TOut>(name: string, payload: TIn): Promise<TOut> {
  const { httpsCallable, fns } = await loadFunctions();
  const response = await httpsCallable<TIn, TOut>(fns, name)(payload);
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
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>(SEED_COUPONS);

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

  // O módulo de autenticação sobe por `import()`, então a assinatura só existe
  // O módulo de autenticação sobe por `import()`, então a assinatura só existe
  // depois que ele chega — daí a limpeza precisar de um sinalizador, e não só
  // do retorno de `onAuthStateChanged`.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const timer = setTimeout(() => {
      void loadAuth()
        .then(({ auth, onAuthStateChanged, signOut: authSignOut }) => {
          if (cancelled) return;

          unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
              setSession(null);
              setAuthReady(true);
              return;
            }
            try {
              const profile = await call<Record<string, never>, AdminUser & { uid: string }>(
                'registerLogin',
                {} as Record<string, never>,
              );
              await user.getIdToken(true);
              setSession({ ...profile, id: profile.uid });
            } catch (cause) {
              setSession(null);
              await authSignOut(auth);
              setError(describe(cause));
            } finally {
              setAuthReady(true);
            }
          });
        })
        .catch(() => {
          if (!cancelled) setAuthReady(true);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Assinaturas                                                             */
  /* ---------------------------------------------------------------------- */

  // Catálogo e cupons: públicos. Sem sessão só vêm as peças ativas.
  useEffect(() => {
    let cancelled = false;
    let unsubProducts: (() => void) | undefined;
    let unsubCoupons: (() => void) | undefined;

    void loadFirestore().then(({ db, collection, query, where, onSnapshot }) => {
      if (cancelled) return;
      const base = collection(db, 'products');
      const q = session ? query(base) : query(base, where('active', '==', true));

      unsubProducts = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product);
          setProducts(list);
          setProductsReady(true);
          setError(null);
        },
        (cause) => {
          setProductsReady(true);
          setError(`Catálogo indisponível: ${cause.message}`);
        },
      );

      unsubCoupons = onSnapshot(
        query(collection(db, 'coupons'), where('active', '==', true)),
        (snap) => setCoupons(snap.docs.map((doc) => ({ code: doc.id, ...doc.data() }) as Coupon)),
        () => setCoupons([]),
      );
    });

    return () => {
      cancelled = true;
      unsubProducts?.();
      unsubCoupons?.();
    };
  }, [session]);

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
    let cancelled = false;
    let unsub: (() => void) | undefined;

    void loadFirestore().then(({ db, collection, onSnapshot }) => {
      if (cancelled) return;
      unsub = onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Order);
          list.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setOrders(list);
        },
        (cause) => setError(`Pedidos indisponíveis: ${cause.message}`),
      );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [canView]);

  useEffect(() => {
    if (!canView('users.view')) {
      setUsers(session ? [session] : []);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;

    void loadFirestore().then(({ db, collection, onSnapshot }) => {
      if (cancelled) return;
      unsub = onSnapshot(
        collection(db, 'adminUsers'),
        (snap) => setUsers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AdminUser)),
        (cause) => setError(`Equipe indisponível: ${cause.message}`),
      );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [canView, session]);

  /* ---------------------------------------------------------------------- */
  /* Instalação inicial                                                      */
  /* ---------------------------------------------------------------------- */

  // Loja recém-criada não tem catálogo nem administrador. Detectamos pela
  // ausência de peças, que é o único sinal legível sem estar autenticado.
  useEffect(() => {
    if (productsReady && authReady) {
      setNeedsBootstrap(isUsingFirebaseEmulators && products.length === 0 && !session);
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
        idempotencyKey: draft.idempotencyKey,
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

  const lookupOrders = useCallback(
    async (orderId: string, accessToken?: string): Promise<Order[]> => {
      try {
        const res = (await call('lookupOrders', {
          orderId,
          ...(accessToken ? { accessToken } : {}),
        })) as { orders?: Order[] };
        return Array.isArray(res?.orders) ? res.orders : [];
      } catch {
        return [];
      }
    },
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
    const { bucket, ref, uploadBytes, getDownloadURL } = await loadStorage();
    // Nome único: subir duas fotos com o mesmo nome sobrescreveria a primeira.
    const name = `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}.webp`;
    const target = ref(bucket, `products/${productId}/${name}`);
    await uploadBytes(target, file, { contentType: file.type || 'image/webp' });
    return getDownloadURL(target);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Autenticação                                                            */
  /* ---------------------------------------------------------------------- */

  const signIn = useCallback(
    (email: string, password: string) =>
      attempt(async () => {
        const { auth, signInWithEmailAndPassword } = await loadAuth();
        return signInWithEmailAndPassword(auth, email.trim(), password);
      }, 'Bem-vindo.'),
    [],
  );

  const signOut = useCallback(async () => {
    const { auth, signOut: authSignOut } = await loadAuth();
    await authSignOut(auth);
    setSession(null);
  }, []);

  const can = useCallback(
    (permission: Permission) => session?.permissions.includes(permission) ?? false,
    [session],
  );

  const saveUser = useCallback(
    async (user: AdminUser, password?: string): Promise<Result> => {
      const isSelf = user.id === session?.id;
      const res = await attempt(
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
      );

      if (res.ok && isSelf) {
        try {
          const { auth } = await loadAuth();
          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions,
                  }
                : null,
            );
          }
        } catch {
          // ignore
        }
      }

      return res;
    },
    [session?.id],
  );

  const deleteUser = useCallback(
    (userId: string) => attempt(() => call('deleteStaff', { uid: userId }), 'Usuário removido.'),
    [],
  );

  const bootstrap = useCallback(
    async (input: { name: string; email: string; password: string }): Promise<Result> => {
      try {
        await call('bootstrap', input);
        const { auth, signInWithEmailAndPassword } = await loadAuth();
        await signInWithEmailAndPassword(auth, input.email.trim(), input.password);
        // Token novo já traz as claims de Mestre, necessárias para o seed.
        await auth.currentUser?.getIdToken(true);

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
    try {
      await call('clearTestHistory', {});
    } catch {
      // Falha não crítica se usuário não tiver permissão
    }
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
    needsBootstrap,
    bootstrap,
    resetEverything,
  };
}
