import { useMemo, useState } from 'react';
import { Hammer, Package, TriangleAlert } from 'lucide-react';
import { ORDER_STATUS_LABEL, type OrderStatus } from '../../types';
import { money, moneyCompact, timeAgo } from '../../lib/format';
import { buildDashboard, variation } from '../../lib/analytics';
import { totalStock, useStore } from '../../store/StoreContext';
import { BarList, RevenueArea, SplitBar, StatTile } from './charts';

const RANGES = [7, 30, 90] as const;

/** Ordem da esteira, para a barra de status ler como progresso. */
const STATUS_ORDER: OrderStatus[] = [
  'aguardando-pagamento',
  'pago',
  'em-producao',
  'enviado',
  'entregue',
  'cancelado',
];

export function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { orders, products, can } = useStore();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);

  const data = useMemo(
    () => buildDashboard(orders, products, days),
    [orders, products, days],
  );

  const showFinance = can('finance.view');
  const maxStatus = Math.max(...Object.values(data.statusCounts), 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-logo text-3xl text-bone">Painel</h1>
          <p className="mt-1 text-[0.72rem] text-grave">
            Visão geral da loja nos últimos {days} dias
          </p>
        </div>

        <div
          className="flex border border-iron"
          role="group"
          aria-label="Período de análise"
        >
          {RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDays(range)}
              aria-pressed={days === range}
              className={`heading-carved px-4 py-2 text-[0.6rem] transition-colors ${
                days === range
                  ? 'bg-blood text-bone'
                  : 'text-grave hover:text-parchment'
              }`}
            >
              {range}d
            </button>
          ))}
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showFinance && (
          <StatTile
            label="Faturamento"
            value={money(data.current.revenue)}
            delta={variation(data.current.revenue, data.previous.revenue)}
            hint={`${money(data.previous.revenue)} no período anterior`}
            spark={data.dailySpark}
          />
        )}
        <StatTile
          label="Pedidos"
          value={String(data.current.orderCount)}
          delta={variation(data.current.orderCount, data.previous.orderCount)}
          hint={`${data.previous.orderCount} no período anterior`}
        />
        {showFinance && (
          <StatTile
            label="Ticket médio"
            value={money(data.current.averageTicket)}
            delta={variation(data.current.averageTicket, data.previous.averageTicket)}
          />
        )}
        <StatTile
          label="Peças vendidas"
          value={String(data.current.unitsSold)}
          delta={variation(data.current.unitsSold, data.previous.unitsSold)}
          hint={`${data.pendingProduction.length} pedidos aguardando produção`}
        />
      </div>

      {/* Alertas operacionais — o que exige ação hoje */}
      {(data.lowStock.length > 0 || data.pendingProduction.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.lowStock.length > 0 && (
            <button
              onClick={() => onNavigate('estoque')}
              className="panel flex items-start gap-3 p-4 text-left transition-colors hover:border-blood/60"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
              <div className="min-w-0">
                <p className="heading-carved text-[0.6rem] text-bone">
                  {data.lowStock.length}{' '}
                  {data.lowStock.length === 1 ? 'peça no limite' : 'peças no limite'} de estoque
                </p>
                <p className="mt-1 truncate text-[0.68rem] text-grave">
                  {data.lowStock
                    .slice(0, 3)
                    .map((product) => `${product.band} (${totalStock(product)})`)
                    .join(' · ')}
                  {data.lowStock.length > 3 && ` +${data.lowStock.length - 3}`}
                </p>
              </div>
            </button>
          )}

          {data.pendingProduction.length > 0 && (
            <button
              onClick={() => onNavigate('pedidos')}
              className="panel flex items-start gap-3 p-4 text-left transition-colors hover:border-blood/60"
            >
              <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
              <div className="min-w-0">
                <p className="heading-carved text-[0.6rem] text-bone">
                  {data.pendingProduction.length} na fila de produção
                </p>
                <p className="mt-1 truncate text-[0.68rem] text-grave">
                  Mais antigo:{' '}
                  {timeAgo(
                    data.pendingProduction[data.pendingProduction.length - 1].createdAt,
                  )}
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Série temporal */}
      {showFinance && (
        <RevenueArea data={data.daily} formatValue={(value) => moneyCompact(value)} />
      )}

      {/* Rankings e divisões */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Peças mais vendidas"
          data={data.topProducts}
          formatValue={money}
        />
        <BarList
          title="Bandas que mais faturam"
          data={data.topBands}
          formatValue={money}
        />
      </div>

      {/*
        Não há "faturamento por forma de pagamento": a loja cobra só por PIX,
        e uma barra de fatia única não informa nada.
      */}
      {showFinance && (
        <SplitBar
          title="Pronta-entrega x sob encomenda"
          data={data.fulfillmentSplit}
          formatValue={money}
        />
      )}

      {/* Status dos pedidos */}
      <figure className="panel p-4">
        <figcaption className="mb-4 flex items-baseline justify-between">
          <h3 className="heading-carved text-[0.6rem] text-bone">Pedidos por status</h3>
          <span className="text-[0.6rem] text-grave">todo o histórico</span>
        </figcaption>

        <ul className="space-y-2.5">
          {STATUS_ORDER.map((status) => {
            const count = data.statusCounts[status];
            return (
              <li key={status} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[0.68rem] text-parchment">
                  {ORDER_STATUS_LABEL[status]}
                </span>
                <span className="h-1.5 flex-1 bg-smoke">
                  <span
                    className="block h-full rounded-r-[3px]"
                    style={{
                      width: `${(count / maxStatus) * 100}%`,
                      backgroundColor: status === 'cancelado' ? '#7d7362' : '#cf1a26',
                    }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right font-display text-[0.7rem] font-bold text-bone tabular-nums">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      </figure>

      {/* Últimos pedidos */}
      <section className="panel">
        <div className="flex items-center justify-between border-b border-smoke px-4 py-3">
          <h3 className="heading-carved text-[0.6rem] text-bone">Últimos pedidos</h3>
          <button
            onClick={() => onNavigate('pedidos')}
            className="text-[0.62rem] text-grave hover:text-blood-bright"
          >
            ver todos
          </button>
        </div>
        <ul className="divide-y divide-smoke">
          {orders.slice(0, 6).map((order) => (
            <li key={order.id} className="flex items-center gap-3 px-4 py-3">
              <Package className="h-3.5 w-3.5 shrink-0 text-dust" />
              <span className="font-display text-[0.68rem] font-bold text-bone tabular-nums">
                {order.id}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.68rem] text-grave">
                {order.customer.name} · {order.lines.length}{' '}
                {order.lines.length === 1 ? 'item' : 'itens'}
              </span>
              <span className="hidden text-[0.62rem] text-dust sm:inline">
                {timeAgo(order.createdAt)}
              </span>
              <span className="shrink-0 font-display text-[0.68rem] font-bold text-parchment tabular-nums">
                {money(order.total)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
