import { Suspense, lazy, useEffect, useState } from 'react';
import { StoreProvider } from './store/StoreContext';
import { Storefront } from './components/storefront/Storefront';
import { SkullMark } from './components/art/Sigils';
import { clearLegacyCustomerData } from './lib/customerOrders';

const NecroCursor = lazy(() =>
  import('./components/NecroCursor').then((m) => ({ default: m.NecroCursor })),
);
const Checkout = lazy(() =>
  import('./components/checkout/Checkout').then((m) => ({ default: m.Checkout })),
);
const AdminPanel = lazy(() =>
  import('./components/admin/AdminPanel').then((m) => ({ default: m.AdminPanel })),
);

type Route = 'loja' | 'checkout' | 'admin';

/** Rota pelo hash: sem dependência de router, e o link do admin fica copiável. */
function routeFromHash(): Route {
  const hash = window.location.hash.replace('#/', '');
  return hash === 'admin' || hash === 'checkout' ? hash : 'loja';
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SkullMark className="h-12 w-12 animate-pulse text-iron" />
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  // Migração de privacidade: apaga PII salva por versões antigas assim que a loja abre.
  useEffect(() => {
    clearLegacyCustomerData();
  }, []);

  // Sincroniza com voltar/avançar do navegador.
  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const go = (next: Route) => {
    window.location.hash = next === 'loja' ? '/' : `/${next}`;
    setRoute(next);
    window.scrollTo({ top: 0 });
  };

  const isFinePointer =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: fine)').matches;

  return (
    <StoreProvider>
      {isFinePointer && (
        <Suspense fallback={null}>
          <NecroCursor />
        </Suspense>
      )}
      <div className="grain-overlay" aria-hidden="true" />
      <div className="vignette-overlay" aria-hidden="true" />

      {route === 'loja' && (
        <Storefront onOpenAdmin={() => go('admin')} onCheckout={() => go('checkout')} />
      )}

      {route !== 'loja' && (
        <Suspense fallback={<RouteFallback />}>
          {route === 'checkout' && <Checkout onBack={() => go('loja')} />}
          {route === 'admin' && <AdminPanel onExit={() => go('loja')} />}
        </Suspense>
      )}
    </StoreProvider>
  );
}

export default App;
