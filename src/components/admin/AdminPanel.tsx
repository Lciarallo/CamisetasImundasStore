import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  Store,
  Users,
  X,
} from 'lucide-react';
import { ROLE_LABEL, type Permission } from '../../types';
import { useStore } from '../../store/StoreContext';
import { SkullMark } from '../art/Sigils';
import { BrandLogo } from '../art/BrandLogo';
import { AdminLogin } from './AdminLogin';
import { Dashboard } from './Dashboard';
import { OrdersAdmin } from './OrdersAdmin';
import { ProductsAdmin, ConfirmDialog } from './ProductsAdmin';
import { StockAdmin } from './StockAdmin';
import { UsersAdmin } from './UsersAdmin';

interface Tab {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
}

const TABS: Tab[] = [
  { key: 'painel', label: 'Painel', icon: LayoutDashboard, permission: 'dashboard.view' },
  { key: 'pedidos', label: 'Pedidos', icon: Package, permission: 'orders.view' },
  { key: 'estoque', label: 'Estoque', icon: Boxes, permission: 'products.view' },
  { key: 'catalogo', label: 'Catálogo', icon: Store, permission: 'products.view' },
  { key: 'usuarios', label: 'Usuários', icon: Users, permission: 'users.view' },
];

export function AdminPanel({ onExit }: { onExit: () => void }) {
  const { session, signOut, can, resetEverything } = useStore();

  const [tab, setTab] = useState('painel');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // As abas visíveis dependem dos privilégios da conta logada.
  const allowed = useMemo(() => TABS.filter((item) => can(item.permission)), [can]);

  // Se a aba atual sumiu (troca de conta, privilégio revogado), cai na primeira.
  useEffect(() => {
    if (allowed.length > 0 && !allowed.some((item) => item.key === tab)) {
      setTab(allowed[0].key);
    }
  }, [allowed, tab]);

  if (!session) return <AdminLogin onBack={onExit} />;

  const navigate = (next: string) => {
    setTab(next);
    setMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-void">
      {/* Barra lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-60 flex w-60 flex-col border-r border-smoke bg-pitch transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-smoke px-5 py-4">
          <div className="min-w-0 text-bone">
            <BrandLogo height={46} />
            <p className="heading-carved mt-1.5 text-center text-[0.5rem] text-grave">Painel</p>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="ml-auto text-grave lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 p-3" aria-label="Seções do painel">
          <ul className="space-y-1">
            {allowed.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => navigate(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-blood bg-blood/10 text-bone'
                        : 'border-transparent text-grave hover:text-parchment'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="heading-carved text-[0.6rem]">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-smoke p-3">
          <div className="px-2 py-2">
            <p className="truncate text-[0.7rem] text-bone">{session.name}</p>
            <p className="text-[0.58rem] text-grave">
              {ROLE_LABEL[session.role]} · {session.permissions.length} privilégios
            </p>
          </div>

          <button
            onClick={onExit}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-grave transition-colors hover:text-parchment"
          >
            <Store className="h-3.5 w-3.5" />
            <span className="text-[0.65rem]">Ver a loja</span>
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-grave transition-colors hover:text-parchment"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-[0.65rem]">Restaurar dados</span>
          </button>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-grave transition-colors hover:text-ember"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-[0.65rem]">Sair</span>
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-50 bg-void/70 lg:hidden"
          aria-label="Fechar menu"
        />
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-smoke bg-pitch px-4 py-3 lg:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="text-parchment"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-bone">
            <BrandLogo height={34} />
          </span>
        </header>

        <main className="flex-1 p-4 md:p-8">
          {allowed.length === 0 ? (
            <div className="panel mx-auto mt-20 max-w-md p-8 text-center">
              <SkullMark className="mx-auto h-12 w-12 text-iron" />
              <p className="mt-4 heading-carved text-xs text-bone">Sem acesso</p>
              <p className="mt-2 text-[0.72rem] text-grave">
                Sua conta não tem nenhum privilégio de visualização. Peça ao Mestre.
              </p>
              <button onClick={signOut} className="btn btn-ghost mt-5">
                Sair
              </button>
            </div>
          ) : (
            <>
              {tab === 'painel' && <Dashboard onNavigate={navigate} />}
              {tab === 'pedidos' && <OrdersAdmin />}
              {tab === 'estoque' && <StockAdmin />}
              {tab === 'catalogo' && <ProductsAdmin />}
              {tab === 'usuarios' && <UsersAdmin />}
            </>
          )}
        </main>
      </div>

      {confirmReset && (
        <ConfirmDialog
          message="Restaurar todos os dados de demonstração? Produtos, pedidos, usuários e carrinho voltam ao estado original."
          onCancel={() => setConfirmReset(false)}
          onConfirm={resetEverything}
        />
      )}
    </div>
  );
}
