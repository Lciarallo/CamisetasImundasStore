import { Suspense, lazy, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
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
  const { products, cartTotals, addToCart } = useStore();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'Todos'>('Todos');
  const [sort, setSort] = useState<SortKey>('destaques');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  const visible = useMemo(() => {
    const term = normalize(search);

    const filtered = products.filter((product) => {
      if (!product.active) return false;
      if (category !== 'Todos' && product.category !== category) return false;
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
  }, [products, search, category, sort, onlyAvailable]);

  const scrollToCatalog = () =>
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });

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
        onCategory={setCategory}
        onOpenCart={() => setCartOpen(true)}
        onOpenAdmin={onOpenAdmin}
        onOpenCustomerPortal={() => setPortalOpen(true)}
      />

      <Hero onExplore={scrollToCatalog} />

      {/* scroll-mt compensa o header fixo — senão o título some atrás dele. */}
      <main
        id="catalogo"
        className="mx-auto w-full max-w-7xl flex-1 scroll-mt-44 px-4 py-14 md:px-8"
      >
        <div className="rule-sigil mb-10">
          <SkullMark className="h-6 w-6 shrink-0 text-iron" />
        </div>

        <div className="mb-8 flex flex-col gap-4 border-b border-smoke pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-logo text-3xl text-bone md:text-4xl">
              {category === 'Todos' ? 'O acervo' : category}
            </h2>
            <p className="mt-1.5 text-[0.72rem] text-grave tabular-nums">
              {visible.length} {visible.length === 1 ? 'peça encontrada' : 'peças encontradas'}
              {search && ` para “${search}”`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                className="field py-1.5 text-xs"
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

        {/* Grade */}
        {visible.length === 0 ? (
          <div className="py-20 text-center text-grave">
            <SkullMark className="mx-auto h-12 w-12 text-dust opacity-30" />
            <p className="heading-carved mt-4 text-xs text-bone">Nenhuma peça encontrada</p>
            <p className="mt-1 text-xs text-dust">Tente outro termo ou limpe os filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={setSelected}
                onAddToCart={handleAdd}
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
