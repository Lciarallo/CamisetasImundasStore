import { useMemo, useState } from 'react';
import { Hammer, Minus, Package, Plus, Search, TriangleAlert } from 'lucide-react';
import { SIZES, type Size } from '../../types';
import { money, normalize } from '../../lib/format';
import { totalStock, useStore } from '../../store/StoreContext';
import { SkullMark } from '../art/Sigils';
import { TeeImage } from '../art/TeeImage';

type View = 'todos' | 'pronta-entrega' | 'sob-encomenda' | 'alerta';

export function StockAdmin() {
  const { products, adjustStock, setStock, can } = useStore();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('todos');

  const editable = can('stock.edit');

  const visible = useMemo(() => {
    const term = normalize(search);
    return products.filter((product) => {
      if (view === 'pronta-entrega' && product.fulfillment !== 'pronta-entrega') return false;
      if (view === 'sob-encomenda' && product.fulfillment !== 'sob-encomenda') return false;
      if (view === 'alerta') {
        if (product.fulfillment !== 'pronta-entrega') return false;
        if (totalStock(product) > product.lowStockThreshold) return false;
      }
      if (!term) return true;
      return [product.name, product.band].map(normalize).some((f) => f.includes(term));
    });
  }, [products, search, view]);

  const readyCount = products.filter((p) => p.fulfillment === 'pronta-entrega').length;
  const madeToOrderCount = products.length - readyCount;
  const alertCount = products.filter(
    (p) => p.fulfillment === 'pronta-entrega' && totalStock(p) <= p.lowStockThreshold,
  ).length;

  const inventoryValue = products.reduce(
    (sum, product) => sum + totalStock(product) * product.price,
    0,
  );

  const TABS: { key: View; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: products.length },
    { key: 'pronta-entrega', label: 'Pronta-entrega', count: readyCount },
    { key: 'sob-encomenda', label: 'Sob encomenda', count: madeToOrderCount },
    { key: 'alerta', label: 'Em alerta', count: alertCount },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-logo text-3xl text-bone">Estoque</h1>
          <p className="mt-1 text-[0.72rem] text-grave">
            {money(inventoryValue)} parados em prateleira
            {!editable && ' · somente leitura'}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap border border-iron">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              aria-pressed={view === tab.key}
              className={`heading-carved flex items-center gap-1.5 px-3 py-2 text-[0.58rem] transition-colors ${
                view === tab.key ? 'bg-blood text-bone' : 'text-grave hover:text-parchment'
              }`}
            >
              {tab.key === 'alerta' && tab.count > 0 && (
                <TriangleAlert className="h-3 w-3 text-ember" />
              )}
              {tab.label}
              <span className="tabular-nums opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-dust" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar peça ou banda"
            className="field pl-9 text-xs"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <SkullMark className="h-12 w-12 text-iron" />
          <p className="text-[0.75rem] text-grave">Nenhuma peça neste recorte.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((product) => {
            const madeToOrder = product.fulfillment === 'sob-encomenda';
            const total = totalStock(product);
            const alert = !madeToOrder && total <= product.lowStockThreshold;

            return (
              <li
                key={product.id}
                className={`panel flex flex-col gap-4 p-4 sm:flex-row ${
                  alert ? 'border-ember/40' : ''
                }`}
              >
                <div className="flex gap-3 sm:w-64 sm:shrink-0">
                  <div className="w-14 shrink-0 bg-pitch">
                    <TeeImage
                      art={product.art}
                      band={product.band}
                      photo={product.photos[0]}
                      showBandName={false}
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="heading-carved text-[0.55rem] text-blood-bright">
                      {product.band}
                    </p>
                    <p className="truncate text-[0.72rem] text-bone">{product.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-[0.6rem] text-grave">
                      {madeToOrder ? (
                        <>
                          <Hammer className="h-2.5 w-2.5" />
                          {product.productionDays} dias de produção
                        </>
                      ) : (
                        <>
                          <Package className="h-2.5 w-2.5" />
                          {total} em estoque
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex-1">
                  {madeToOrder ? (
                    <div className="flex h-full flex-col justify-center gap-1.5">
                      <p className="text-[0.7rem] text-parchment">
                        Produzida sob demanda — não consome estoque.
                      </p>
                      <p className="text-[0.62rem] text-grave">
                        Tamanhos fabricáveis:{' '}
                        <span className="text-parchment">
                          {product.madeToOrderSizes.join(' · ') || 'nenhum'}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {SIZES.map((size) => (
                        <StockCell
                          key={size}
                          size={size}
                          value={product.stock[size]}
                          editable={editable}
                          onAdjust={(delta) => adjustStock(product.id, size, delta)}
                          onSet={(value) => setStock(product.id, size, value)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {alert && (
                  <p className="flex items-center gap-1.5 self-center text-[0.62rem] text-ember sm:w-32">
                    <TriangleAlert className="h-3 w-3 shrink-0" />
                    Abaixo do mínimo ({product.lowStockThreshold})
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StockCell({
  size,
  value,
  editable,
  onAdjust,
  onSet,
}: {
  size: Size;
  /** `undefined` = tamanho não fabricado nesta peça. */
  value: number | undefined;
  editable: boolean;
  onAdjust: (delta: number) => void;
  onSet: (value: number) => void;
}) {
  const exists = value !== undefined;

  return (
    <div
      className={`border p-1.5 text-center ${
        exists ? 'border-smoke' : 'border-smoke/40 opacity-40'
      }`}
    >
      <p className="heading-carved text-[0.55rem] text-grave">{size}</p>

      {exists ? (
        <>
          <input
            type="number"
            min={0}
            value={value}
            disabled={!editable}
            onChange={(event) => onSet(Number(event.target.value))}
            className="w-full bg-transparent text-center font-display text-sm font-bold text-bone tabular-nums outline-none disabled:text-parchment"
            aria-label={`Estoque do tamanho ${size}`}
          />
          {editable && (
            <div className="mt-1 flex justify-center gap-0.5">
              <button
                onClick={() => onAdjust(-1)}
                className="p-0.5 text-dust hover:text-ember"
                aria-label={`Remover uma unidade do ${size}`}
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={() => onAdjust(1)}
                className="p-0.5 text-dust hover:text-blood-bright"
                aria-label={`Adicionar uma unidade ao ${size}`}
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="py-1.5 font-display text-sm text-dust">—</p>
      )}
    </div>
  );
}
