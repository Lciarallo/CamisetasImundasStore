import { useEffect, useState } from 'react';
import { StoreProvider } from './store/StoreContext';
import { NecroCursor } from './components/NecroCursor';
import { Storefront } from './components/storefront/Storefront';
import { Checkout } from './components/checkout/Checkout';
import { AdminPanel } from './components/admin/AdminPanel';

type Route = 'loja' | 'checkout' | 'admin';

/** Rota pelo hash: sem dependência de router, e o link do admin fica copiável. */
function routeFromHash(): Route {
  const hash = window.location.hash.replace('#/', '');
  return hash === 'admin' || hash === 'checkout' ? hash : 'loja';
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);

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

  return (
    <StoreProvider>
      <NecroCursor />
      <div className="grain-overlay" aria-hidden="true" />
      <div className="vignette-overlay" aria-hidden="true" />

      {route === 'loja' && (
        <Storefront onOpenAdmin={() => go('admin')} onCheckout={() => go('checkout')} />
      )}
      {route === 'checkout' && <Checkout onBack={() => go('loja')} />}
      {route === 'admin' && <AdminPanel onExit={() => go('loja')} />}
    </StoreProvider>
  );
}

export default App;
