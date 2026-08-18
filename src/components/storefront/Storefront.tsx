import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Tag, X } from 'lucide-react';
import type { Category, Product, Size } from '../../types';
import { normalize } from '../../lib/format';
import { isSoldOut, useStore } from '../../store/StoreContext';
import { SkullMark } from '../art/Sigils';
import { Header } from './Header';
import { Hero } from './Hero';
import { ProductCard } from './ProductCard';
import { Footer } from './Footer';

const ProductModal = lazy(() =>
  import('./ProductModal').then((m) => ({ default: m.ProductModal })),
);
const CartDrawer = lazy(() =>
  import('./CartDrawer').then((m) => ({ default: m.CartDrawer })),
);
const CustomerPortal = lazy(() =>
  import('./CustomerPortal').then((m) => ({ default: m.CustomerPortal })),
);

type SortKey = 'destaques' | 'preco-asc' | 'preco-desc' | 'nota' | 'novidades';

const SORT_LABEL: Record<SortKey, string> = {
  destaques: 'Destaques',
  novidades: 'Novidades',
  'preco-asc': 'Menor preço',
  'preco-desc': 'Maior preço',
  nota: 'Melhor avaliadas',
};

export function Storefront({
  onOpenAdmin,
  onCheckout,
}: {
  onOpenAdmin: () => void;
  onCheckout: () => void;
}) {
  const { products, loading, cartTotals, addToCart } = useStore();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'Todos'>('Todos');
  const [selectedBand, setSelectedBand] = useState<string | 'Todas'>('Todas');
  const [sort, setSort] = useState<SortKey>('destaques');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  // Computa contagem de peças por banda
  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (!p.active || !p.band) continue;
      counts[p.band] = (counts[p.band] || 0) + 1;
    }
    return counts;
  }, [products]);

  const uniqueBands = useMemo(() => {
    return Object.keys(bandCounts).sort((a, b) => a.localeCompare(b));
  }, [bandCounts]);

  // Deep-link: abre automaticamente a peça ou filtra a banda informada na URL
  useEffect(() => {
    if (!products.length) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('p') || params.get('produto');
    if (targetId) {
      const match = products.find((p) => p.id === targetId && p.active);
      if (match) {
        setSelected(match);
      }
    }

    const bandParam = params.get('banda') || params.get('band');
    if (bandParam) {
      const exists = products.some((p) => p.active && p.band.toLowerCase() === bandParam.toLowerCase());
      if (exists) {
        const found = products.find((p) => p.band.toLowerCase() === bandParam.toLowerCase());
        if (found) setSelectedBand(found.band);
      }
    }
  }, [products]);

  // Sincroniza a URL com a peça atualmente aberta no modal e com o filtro de banda
  useEffect(() => {
    const url = new URL(window.location.href);

    if (selected) {
      if (url.searchParams.get('p') !== selected.id) {
        url.searchParams.set('p', selected.id);
        // Permite que o gesto ou botão "Voltar" do celular feche o modal naturalmente
        window.history.pushState({ modal: selected.id }, '', url.toString());
      }
    } else {
      if (url.searchParams.has('p') || url.searchParams.has('produto')) {
        url.searchParams.delete('p');
        url.searchParams.delete('produto');
        window.history.replaceState(null, '', url.toString());
      }
    }

    if (selectedBand !== 'Todas') {
      if (url.searchParams.get('banda') !== selectedBand) {
        url.searchParams.set('banda', selectedBand);
        window.history.replaceState(null, '', url.toString());
      }
    } else {
      if (url.searchParams.has('banda') || url.searchParams.has('band')) {
        url.searchParams.delete('banda');
        url.searchParams.delete('band');
        window.history.replaceState(null, '', url.toString());
      }
    }
  }, [selected, selectedBand]);

  // Trata navegação de voltar/avançar no navegador
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('p') || params.get('produto');
      if (targetId) {
        const match = products.find((p) => p.id === targetId && p.active);
        setSelected(match || null);
      } else {
        setSelected(null);
      }

      const bandParam = params.get('banda') || params.get('band');
      if (bandParam) {
        setSelectedBand(bandParam);
      } else {
        setSelectedBand('Todas');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [products]);

  const visible = useMemo(() => {
    const term = normalize(search);

    const filtered = products.filter((product) => {
      if (!product.active) return false;
      if (category !== 'Todos' && product.category !== category) return false;
      if (selectedBand !== 'Todas' && product.band !== selectedBand) return false;
      if (onlyAvailable && isSoldOut(product)) return false;
      if (!term) return true;

      return [product.name, product.band, product.category, product.description]
        .map(normalize)
        .some((field) => field.includes(term));
    });

    const sorted = [...filtered];
    switch (sort) {
      case 'preco-asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'preco-desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'nota':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'novidades':
        sorted.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      default:
        // Destaques: esgotado sempre por último, depois os mais avaliados.
        sorted.sort((a, b) => {
          const soldOut = Number(isSoldOut(a)) - Number(isSoldOut(b));
          return soldOut !== 0 ? soldOut : b.reviewsCount - a.reviewsCount;
        });
    }
    return sorted;
  }, [products, search, category, selectedBand, sort, onlyAvailable]);

  const scrollToCatalog = () =>
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });

  const handleCategory = (value: Category | 'Todos') => {
    setCategory(value);
    scrollToCatalog();
  };

  const handleBandSelect = (band: string) => {
    setSelectedBand(band);
    scrollToCatalog();
  };

  const handleAdd = (productId: string, size: Size, quantity = 1) => {
    addToCart(productId, size, quantity);
    setCartOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        cartCount={cartTotals.itemCount}
        search={search}
        onSearch={setSearch}
        category={category}
        onCategory={handleCategory}
        onOpenCart={() => setCartOpen(true)}
        onOpenAdmin={onOpenAdmin}
        onOpenCustomerPortal={() => setPortalOpen(true)}
      />

      <Hero onExplore={scrollToCatalog} />

      {/* scroll-mt compensa o header fixo — senão o título some atrás dele. */}
      <main
        id="catalogo"
        className="mx-auto w-full max-w-7xl flex-1 scroll-mt-44 px-3 sm:px-4 py-8 sm:py-14 md:px-8"
      >
        <div className="rule-sigil mb-6 sm:mb-10">
          <SkullMark className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-iron" />
        </div>

        <div className="mb-5 flex flex-col gap-3 border-b border-smoke pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-logo text-2xl sm:text-3xl md:text-4xl text-bone">
              {selectedBand !== 'Todas' ? selectedBand : category === 'Todos' ? 'O acervo' : category}
            </h2>
            <p className="mt-1 font-mono text-[0.7rem] sm:text-[0.72rem] text-grave tabular-nums">
              <span className="text-bone font-semibold">{visible.length}</span> {visible.length === 1 ? 'peça encontrada' : 'peças encontradas'}
              {selectedBand !== 'Todas' && ` · Banda: ${selectedBand}`}
              {search && ` para “${search}”`}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 font-mono text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-[0.68rem] text-grave hover:text-parchment">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) => setOnlyAvailable(event.target.checked)}
                className="h-3.5 w-3.5 accent-[#a5121b]"
              />
              Só disponíveis
            </label>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-dust" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="field py-1.5 text-xs font-mono"
                aria-label="Ordenar catálogo"
              >
                {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tags de Bandas */}
        {uniqueBands.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="heading-carved text-[0.55rem] sm:text-[0.58rem] text-grave flex items-center gap-1.5 uppercase tracking-wider">
                <Tag className="h-3 w-3 text-blood-bright" />
                Filtrar por Banda
              </span>
              {selectedBand !== 'Todas' && (
                <button
                  type="button"
                  onClick={() => handleBandSelect('Todas')}
                  className="flex items-center gap-1 font-mono text-[0.65rem] text-blood-bright hover:text-bone transition-colors"
                >
                  <X className="h-3 w-3" />
                  Limpar filtro
                </button>
              )}
            </div>
            <div className="flex overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap items-center gap-1.5 sm:gap-2 scrollbar-none">
              <button
                type="button"
                onClick={() => handleBandSelect('Todas')}
                className={`shrink-0 border px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                  selectedBand === 'Todas'
                    ? 'border-blood bg-blood text-bone shadow-[0_0_12px_rgba(165,18,27,0.35)]'
                    : 'border-iron/80 bg-pitch/80 text-parchment hover:border-blood hover:text-bone'
                }`}
              >
                Todas ({products.filter((p) => p.active).length})
              </button>
              {uniqueBands.map((band) => {
                const count = bandCounts[band] || 0;
                const active = selectedBand === band;
                return (
                  <button
                    key={band}
                    type="button"
                    onClick={() => handleBandSelect(band)}
                    className={`shrink-0 border px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                      active
                        ? 'border-blood bg-blood text-bone shadow-[0_0_12px_rgba(165,18,27,0.35)]'
                        : 'border-iron/80 bg-pitch/80 text-parchment hover:border-blood hover:text-bone'
                    }`}
                  >
                    {band} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Grade */}
        {loading ? (
          <div className="py-20 text-center text-grave">
            <SkullMark className="mx-auto h-12 w-12 animate-pulse text-dust opacity-30" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-grave">
            <SkullMark className="mx-auto h-12 w-12 text-dust opacity-30" />
            <p className="heading-carved mt-4 text-xs text-bone">Nenhuma peça encontrada</p>
            <p className="mt-1 text-xs text-dust">
              {selectedBand !== 'Todas'
                ? `Nenhuma peça ativa encontrada para ${selectedBand}.`
                : 'Tente outro termo ou limpe os filtros.'}
            </p>
            {selectedBand !== 'Todas' && (
              <button
                type="button"
                onClick={() => handleBandSelect('Todas')}
                className="mt-4 inline-block border border-blood px-4 py-2 text-xs font-bold text-bone hover:bg-blood transition-colors"
              >
                Ver todas as bandas
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={setSelected}
                onAddToCart={handleAdd}
                onSelectBand={handleBandSelect}
              />
            ))}
          </div>
        )}
      </main>

      <Footer onOpenCustomerPortal={() => setPortalOpen(true)} />

      <Suspense fallback={null}>
        {selected && (
          <ProductModal
            product={selected}
            onClose={() => setSelected(null)}
            onAddToCart={handleAdd}
            onSelectBand={handleBandSelect}
          />
        )}

        {cartOpen && (
          <CartDrawer
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            onCheckout={() => {
              setCartOpen(false);
              onCheckout();
            }}
          />
        )}

        {portalOpen && <CustomerPortal onClose={() => setPortalOpen(false)} />}
      </Suspense>
    </div>
  );
}
