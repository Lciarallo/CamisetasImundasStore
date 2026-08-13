import { useMemo, useState } from 'react';
import {
  Hammer,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Search,
  TriangleAlert,
  Zap,
} from 'lucide-react';
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

  const handleBatchAdjust = (productId: string, amount: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product || product.fulfillment === 'sob-encomenda') return;
    SIZES.forEach((size) => {
      if (product.stock[size] !== undefined) {
        adjustStock(productId, size, amount);
      }
    });
  };

  const handleZeroStock = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product || product.fulfillment === 'sob-encomenda') return;
    SIZES.forEach((size) => {
      if (product.stock[size] !== undefined) {
        setStock(productId, size, 0);
      }
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-smoke pb-4">
        <div>
          <h1 className="font-logo text-3xl text-bone">Gestão de Estoque</h1>
          <p className="mt-1 text-[0.72rem] text-grave">
            <span className="font-semibold text-parchment">{money(inventoryValue)}</span> em mercadorias paradas
            {!editable && ' · somente leitura'}
          </p>
        </div>
      </header>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap border border-iron bg-pitch">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              aria-pressed={view === tab.key}
              className={`heading-carved flex items-center gap-1.5 px-3.5 py-2.5 text-[0.6rem] transition-colors ${
                view === tab.key ? 'bg-blood text-bone font-bold' : 'text-grave hover:text-parchment'
              }`}
            >
              {tab.key === 'alerta' && tab.count > 0 && (
                <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />
              )}
              {tab.label}
              <span className="ml-1 rounded-full bg-void px-1.5 py-0.5 text-[0.55rem] tabular-nums text-parchment">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-dust" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome da peça ou banda..."
            className="field pl-9 text-xs"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <SkullMark className="h-12 w-12 text-iron" />
          <p className="text-[0.75rem] text-grave">Nenhuma peça encontrada neste filtro.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((product) => {
            const madeToOrder = product.fulfillment === 'sob-encomenda';
            const total = totalStock(product);
            const alert = !madeToOrder && total <= product.lowStockThreshold;
            const isOut = !madeToOrder && total === 0;

            return (
              <li
                key={product.id}
                className={`panel flex flex-col gap-5 p-5 lg:flex-row lg:items-center ${
                  isOut
                    ? 'border-blood/80 bg-blood/5'
                    : alert
                      ? 'border-amber-500/60 bg-amber-500/5'
                      : ''
                }`}
              >
                {/* Informações da Peça */}
                <div className="flex gap-4 lg:w-72 lg:shrink-0">
                  <div className="h-16 w-16 shrink-0 rounded bg-pitch p-1">
                    <TeeImage
                      art={product.art}
                      band={product.band}
                      photo={product.photos[0]}
                      showBandName={false}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-center min-w-0">
                    <span className="heading-carved text-[0.6rem] font-bold text-blood-bright">
                      {product.band}
                    </span>
                    <h3 className="truncate font-display text-sm font-bold text-bone">
                      {product.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {madeToOrder ? (
                        <span className="inline-flex items-center gap-1 rounded bg-smoke px-2 py-0.5 text-[0.6rem] font-semibold text-parchment">
                          <Hammer className="h-3 w-3 text-grave" />
                          Sob encomenda ({product.productionDays}d)
                        </span>
                      ) : isOut ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blood px-2 py-0.5 text-[0.6rem] font-bold text-bone">
                          🔴 Esgotado
                        </span>
                      ) : alert ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[0.6rem] font-bold">
                          <TriangleAlert className="h-3 w-3 text-amber-400" />
                          Alerta: {total} em estoque (min: {product.lowStockThreshold})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[0.65rem] text-grave">
                          <Package className="h-3 w-3 text-dust" />
                          <strong className="text-bone tabular-nums">{total}</strong> unidades no total
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grade de Estoque Compacta & Prática */}
                <div className="flex-1">
                  {madeToOrder ? (
                    <div className="rounded border border-smoke/60 bg-pitch/60 p-3">
                      <p className="text-[0.7rem] font-semibold text-parchment">
                        Peça produzida sob demanda — não consome estoque físico.
                      </p>
                      <p className="mt-1 text-[0.62rem] text-grave">
                        Tamanhos fabricáveis:{' '}
                        <span className="font-semibold text-bone">
                          {product.madeToOrderSizes.join(' · ') || 'Nenhum'}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 max-w-2xl">
                        {SIZES.map((size) => (
                          <StockStepperCell
                            key={size}
                            size={size}
                            value={product.stock[size]}
                            threshold={product.lowStockThreshold}
                            editable={editable}
                            onAdjust={(delta) => adjustStock(product.id, size, delta)}
                            onSet={(value) => setStock(product.id, size, value)}
                          />
                        ))}
                      </div>

                      {/* Botões de Ação em Lote */}
                      {editable && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-dust">
                            Ações em lote:
                          </span>
                          <button
                            onClick={() => handleBatchAdjust(product.id, 5)}
                            className="inline-flex items-center gap-1 rounded border border-iron bg-pitch px-2 py-1 text-[0.6rem] text-parchment transition-colors hover:border-blood hover:text-bone"
                            title="Adicionar +5 unidades a todos os tamanhos desta peça"
                          >
                            <Zap className="h-2.5 w-2.5 text-blood-bright" />
                            +5 todos
                          </button>
                          <button
                            onClick={() => handleBatchAdjust(product.id, 10)}
                            className="inline-flex items-center gap-1 rounded border border-iron bg-pitch px-2 py-1 text-[0.6rem] text-parchment transition-colors hover:border-blood hover:text-bone"
                            title="Adicionar +10 unidades a todos os tamanhos desta peça"
                          >
                            <Zap className="h-2.5 w-2.5 text-blood-bright" />
                            +10 todos
                          </button>
                          <button
                            onClick={() => handleZeroStock(product.id)}
                            className="inline-flex items-center gap-1 rounded border border-iron bg-pitch px-2 py-1 text-[0.6rem] text-grave transition-colors hover:border-ember hover:text-ember"
                            title="Zerar estoque de todos os tamanhos desta peça"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            Zerar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Componente Stepper Integrado de Alto Contraste */
function StockStepperCell({
  size,
  value,
  threshold,
  editable,
  onAdjust,
  onSet,
}: {
  size: Size;
  value: number | undefined;
  threshold: number;
  editable: boolean;
  onAdjust: (delta: number) => void;
  onSet: (value: number) => void;
}) {
  const exists = value !== undefined;
  const isZero = exists && value === 0;
  const isLow = exists && !isZero && value <= threshold;

  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center rounded border border-dashed border-smoke/40 bg-pitch/30 p-2 text-center opacity-40">
        <span className="text-[0.65rem] font-bold text-dust">{size}</span>
        <span className="mt-1 text-xs font-semibold text-dust/60">—</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col rounded border p-1.5 transition-colors ${
        isZero
          ? 'border-blood/80 bg-blood/15'
          : isLow
            ? 'border-amber-500/70 bg-amber-500/10'
            : 'border-smoke bg-pitch hover:border-iron'
      }`}
    >
      {/* Rótulo do Tamanho com Alto Contraste */}
      <div className="flex items-center justify-between border-b border-smoke/60 px-1 pb-1">
        <span
          className={`text-[0.65rem] font-bold tracking-wider ${
            isZero
              ? 'text-blood-bright'
              : isLow
                ? 'text-amber-300'
                : 'text-parchment'
          }`}
        >
          {size}
        </span>
        {isZero ? (
          <span className="text-[0.55rem] font-extrabold text-blood-bright uppercase">Falta</span>
        ) : isLow ? (
          <span className="text-[0.55rem] font-extrabold text-amber-300 uppercase">Baixo</span>
        ) : null}
      </div>

      {/* Controle Numérico Integrado (Stepper [- | 12 | +]) */}
      <div className="mt-1.5 flex items-center justify-between gap-1">
        {editable ? (
          <button
            onClick={() => onAdjust(-1)}
            disabled={value <= 0}
            className="flex h-7 w-7 items-center justify-center rounded bg-smoke/80 text-parchment transition-colors hover:bg-blood hover:text-bone disabled:opacity-30"
            aria-label={`Remover 1 do tamanho ${size}`}
          >
            <Minus className="h-3 w-3" />
          </button>
        ) : null}

        <input
          type="number"
          min={0}
          value={value}
          disabled={!editable}
          onChange={(event) => onSet(Math.max(0, Number(event.target.value)))}
          className={`w-full bg-transparent text-center font-display text-base font-bold tabular-nums outline-none disabled:opacity-90 ${
            isZero
              ? 'text-blood-bright'
              : isLow
                ? 'text-amber-300'
                : 'text-bone'
          }`}
          aria-label={`Quantidade em estoque para o tamanho ${size}`}
        />

        {editable ? (
          <button
            onClick={() => onAdjust(1)}
            className="flex h-7 w-7 items-center justify-center rounded bg-smoke/80 text-parchment transition-colors hover:bg-blood hover:text-bone"
            aria-label={`Adicionar 1 ao tamanho ${size}`}
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
