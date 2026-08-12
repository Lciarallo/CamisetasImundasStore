import { useEffect, useState } from 'react';
import { Menu, Search, ShieldHalf, ShoppingBag, X } from 'lucide-react';
import { CATEGORIES, type Category } from '../../types';
import { SkullMark } from '../art/Sigils';

interface HeaderProps {
  cartCount: number;
  search: string;
  onSearch: (value: string) => void;
  category: Category | 'Todos';
  onCategory: (value: Category | 'Todos') => void;
  onOpenCart: () => void;
  onOpenAdmin: () => void;
}

export function Header({
  cartCount,
  search,
  onSearch,
  category,
  onCategory,
  onOpenCart,
  onOpenAdmin,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tabs: (Category | 'Todos')[] = ['Todos', ...CATEGORIES];

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? 'border-smoke bg-void/95 backdrop-blur-md'
          : 'border-transparent bg-gradient-to-b from-void to-void/40'
      }`}
    >
      {/* Faixa de avisos */}
      <div className="border-b border-smoke/60 bg-pitch">
        <p className="heading-carved mx-auto max-w-7xl px-4 py-1.5 text-center text-[0.6rem] text-grave md:px-8">
          Frete grátis acima de R$ 299 · Envio para todo o Brasil · Sob encomenda em até 20 dias
        </p>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 md:px-8">
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="text-parchment hover:text-blood-bright lg:hidden"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <a href="#topo" className="flex shrink-0 items-center gap-2.5">
          <SkullMark className="h-8 w-8 text-bone" />
          <span className="font-logo text-2xl leading-none text-bone md:text-[1.75rem]">
            Necroteca
          </span>
        </a>

        <div className="relative ml-auto hidden max-w-xs flex-1 items-center md:flex lg:ml-8 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-dust" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar banda ou peça..."
            className="field pl-9"
            aria-label="Buscar no catálogo"
          />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-2 px-3 py-2 text-grave transition-colors hover:text-bone"
            title="Painel administrativo"
          >
            <ShieldHalf className="h-5 w-5" />
            <span className="heading-carved hidden text-[0.6rem] xl:inline">Painel</span>
          </button>

          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2 px-3 py-2 text-parchment transition-colors hover:text-bone"
            aria-label={`Abrir sacola com ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center bg-blood px-1 font-display text-[0.6rem] font-bold text-bone tabular-nums">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Busca no mobile */}
      <div className="relative mx-4 mb-3 flex items-center md:hidden">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-dust" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar banda ou peça..."
          className="field pl-9"
          aria-label="Buscar no catálogo"
        />
      </div>

      {/* Categorias */}
      <nav
        className={`border-t border-smoke/60 bg-pitch/60 ${menuOpen ? 'block' : 'hidden'} lg:block`}
        aria-label="Categorias"
      >
        <ul className="mx-auto flex max-w-7xl flex-col gap-0 px-4 lg:flex-row lg:items-center lg:gap-1 lg:px-8">
          {tabs.map((tab) => {
            const active = category === tab;
            return (
              <li key={tab}>
                <button
                  onClick={() => {
                    onCategory(tab);
                    setMenuOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`heading-carved w-full border-b-2 px-3 py-3 text-left text-[0.62rem] transition-colors lg:w-auto lg:py-2.5 ${
                    active
                      ? 'border-blood text-bone'
                      : 'border-transparent text-grave hover:text-parchment'
                  }`}
                >
                  {tab}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
