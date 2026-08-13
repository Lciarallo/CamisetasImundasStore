import { useMemo, useState } from 'react';
import { Hammer, Search, Truck, X } from 'lucide-react';
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  type Order,
  type OrderStatus,
} from '../../types';
import { formatDateTime, money, normalize, timeAgo } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { SkullMark } from '../art/Sigils';
import { TeeImage } from '../art/TeeImage';

const FILTERS: (OrderStatus | 'todos')[] = [
  'todos',
  'aguardando-pagamento',
  'pago',
  'em-producao',
  'enviado',
  'entregue',
  'cancelado',
];

/** Status é estado, não série — cada um vem com rótulo, nunca só a cor. */
export function StatusPill({ status }: { status: OrderStatus }) {
  const tone =
    status === 'cancelado'
      ? 'border-dust text-dust'
      : status === 'entregue'
        ? 'border-parchment text-parchment'
        : status === 'aguardando-pagamento'
          ? 'border-iron text-grave'
          : 'border-blood text-blood-bright';

  return <span className={`tag ${tone}`}>{ORDER_STATUS_LABEL[status]}</span>;
}

export function OrdersAdmin() {
  const { orders, updateOrderStatus, setTrackingCode, can } = useStore();

  const [filter, setFilter] = useState<OrderStatus | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const editable = can('orders.edit');

  const visible = useMemo(() => {
    const term = normalize(search);
    return orders.filter((order) => {
      if (filter !== 'todos' && order.status !== filter) return false;
      if (!term) return true;
      return [order.id, order.customer.name, order.customer.email, order.address.city]
        .map(normalize)
        .some((field) => field.includes(term));
    });
  }, [orders, filter, search]);

  // O detalhe precisa refletir mudanças de status feitas no próprio painel.
  const current = selected ? (orders.find((o) => o.id === selected.id) ?? null) : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-logo text-3xl text-bone">Pedidos</h1>
        <p className="mt-1 text-[0.72rem] text-grave">
          {visible.length} de {orders.length} pedidos
          {!editable && ' · somente leitura'}
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-dust" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por pedido, cliente ou cidade"
            className="field pl-9 text-xs"
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as OrderStatus | 'todos')}
          className="field text-xs sm:w-56"
          aria-label="Filtrar por status"
        >
          {FILTERS.map((option) => (
            <option key={option} value={option}>
              {option === 'todos' ? 'Todos os status' : ORDER_STATUS_LABEL[option]}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <SkullMark className="h-12 w-12 text-iron" />
          <p className="text-[0.75rem] text-grave">Nenhum pedido com esses filtros.</p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-smoke">
                {['Pedido', 'Cliente', 'Itens', 'Pagamento', 'Status', 'Total', ''].map(
                  (header) => (
                    <th
                      key={header}
                      className="heading-carved px-4 py-3 text-[0.55rem] text-grave"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-smoke">
              {visible.map((order) => {
                const hasMadeToOrder = order.lines.some(
                  (line) => line.fulfillment === 'sob-encomenda',
                );
                return (
                  <tr key={order.id} className="transition-colors hover:bg-ash/50">
                    <td className="px-4 py-3">
                      <p className="font-display text-[0.7rem] font-bold text-bone tabular-nums">
                        {order.id}
                      </p>
                      <p className="text-[0.6rem] text-dust">{timeAgo(order.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[0.7rem] text-parchment">{order.customer.name}</p>
                      <p className="text-[0.6rem] text-dust">
                        {order.address.city}/{order.address.state}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[0.7rem] text-grave tabular-nums">
                        {order.lines.reduce((sum, line) => sum + line.quantity, 0)}
                      </span>
                      {hasMadeToOrder && (
                        <Hammer
                          className="ml-1.5 inline h-3 w-3 text-blood-bright"
                          aria-label="Contém peça sob encomenda"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[0.65rem] text-grave">
                      {order.payment.method === 'cartao'
                        ? `${order.payment.cardBrand} ${order.payment.installments}x`
                        : order.payment.method === 'pix'
                          ? 'PIX'
                          : 'Boleto'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="px-4 py-3 font-display text-[0.7rem] font-bold text-bone tabular-nums">
                      {money(order.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(order)}
                        className="text-[0.62rem] text-grave hover:text-blood-bright"
                      >
                        detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {current && (
        <OrderDetail
          order={current}
          editable={editable}
          onClose={() => setSelected(null)}
          onStatus={(status) => void updateOrderStatus(current.id, status)}
          onTracking={(code) => void setTrackingCode(current.id, code)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function OrderDetail({
  order,
  editable,
  onClose,
  onStatus,
  onTracking,
}: {
  order: Order;
  editable: boolean;
  onClose: () => void;
  onStatus: (status: OrderStatus) => void;
  onTracking: (code: string) => void;
}) {
  const [tracking, setTracking] = useState(order.trackingCode ?? '');

  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const madeToOrder = order.lines.filter((line) => line.fulfillment === 'sob-encomenda');

  return (
    <div
      className="anim-fade fixed inset-0 z-70 flex justify-end bg-void/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do pedido ${order.id}`}
    >
      <aside
        className="anim-slide-left flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-smoke bg-crypt"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-smoke bg-crypt/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-display text-lg font-bold text-bone tabular-nums">{order.id}</p>
            <p className="text-[0.62rem] text-grave">{formatDateTime(order.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-grave hover:text-bone" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-6 p-5">
          {/* Esteira de status */}
          <section>
            <p className="label">Status do pedido</p>
            {order.status === 'cancelado' ? (
              <p className="border border-dust/40 bg-dust/10 px-3 py-2 text-[0.7rem] text-dust">
                Pedido cancelado. Nenhuma ação disponível.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ORDER_STATUS_FLOW.map((status, index) => {
                  const done = index <= currentIndex;
                  // Só avança um degrau por vez — evita pular "pago" e ir para "enviado".
                  const next = index === currentIndex + 1;
                  return (
                    <button
                      key={status}
                      disabled={!editable || (!next && !done)}
                      onClick={() => onStatus(status)}
                      className={`tag transition-colors ${
                        done
                          ? 'border-blood bg-blood text-bone'
                          : next && editable
                            ? 'border-iron text-parchment hover:border-blood hover:text-blood-bright'
                            : 'border-smoke text-dust'
                      }`}
                    >
                      {ORDER_STATUS_LABEL[status]}
                    </button>
                  );
                })}
              </div>
            )}

            {editable && order.status !== 'cancelado' && order.status !== 'entregue' && (
              <button
                onClick={() => onStatus('cancelado')}
                className="mt-3 text-[0.62rem] text-dust hover:text-ember"
              >
                cancelar pedido
              </button>
            )}
          </section>

          {madeToOrder.length > 0 && (
            <div className="flex items-start gap-2.5 border border-blood/40 bg-blood/10 p-3">
              <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
              <p className="text-[0.7rem] leading-relaxed text-parchment">
                <strong className="text-bone">
                  {madeToOrder.length} {madeToOrder.length === 1 ? 'peça' : 'peças'} sob encomenda.
                </strong>{' '}
                Este pedido não baixou estoque — precisa ir para a fila de serigrafia.
              </p>
            </div>
          )}

          {/* Rastreio */}
          <section>
            <p className="label">Código de rastreio</p>
            <div className="flex gap-2">
              <input
                value={tracking}
                onChange={(event) => setTracking(event.target.value.toUpperCase())}
                disabled={!editable}
                placeholder="BR000000000BR"
                className="field flex-1 font-mono text-xs"
              />
              <button
                onClick={() => onTracking(tracking)}
                disabled={!editable || !tracking.trim()}
                className="btn btn-ghost shrink-0"
              >
                <Truck className="h-3.5 w-3.5" />
                Salvar
              </button>
            </div>
          </section>

          {/* Itens */}
          <section>
            <p className="label">Itens</p>
            <ul className="divide-y divide-smoke border border-smoke">
              {order.lines.map((line, index) => (
                <li key={`${line.productId}-${line.size}-${index}`} className="flex gap-3 p-3">
                  <div className="w-12 shrink-0 bg-pitch">
                    <TeeImage
                      art={line.art}
                      band={line.band}
                      photo={line.photo}
                      showBandName={false}
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.7rem] text-bone">{line.name}</p>
                    <p className="text-[0.6rem] text-grave">
                      {line.size} · {line.quantity}un ·{' '}
                      {line.fulfillment === 'sob-encomenda'
                        ? `sob encomenda (${line.productionDays}d)`
                        : 'pronta-entrega'}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-[0.7rem] font-bold text-parchment tabular-nums">
                    {money(line.unitPrice * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Valores */}
          <section>
            <p className="label">Valores</p>
            <dl className="space-y-1.5 border border-smoke p-3 text-[0.7rem]">
              <Row label="Subtotal" value={money(order.subtotal)} />
              {order.discount > 0 && (
                <Row
                  label={`Desconto${order.coupon ? ` (${order.coupon})` : ''}`}
                  value={`−${money(order.discount)}`}
                />
              )}
              <Row
                label="Frete"
                value={order.shipping === 0 ? 'Grátis' : money(order.shipping)}
              />
              <div className="flex justify-between border-t border-smoke pt-1.5">
                <dt className="heading-carved text-[0.6rem] text-bone">Total</dt>
                <dd className="font-display text-sm font-bold text-bone tabular-nums">
                  {money(order.total)}
                </dd>
              </div>
              <Row
                label="Pagamento"
                value={
                  order.payment.method === 'cartao'
                    ? `${order.payment.cardBrand} ···· ${order.payment.cardLast4} · ${order.payment.installments}x`
                    : order.payment.method === 'pix'
                      ? 'PIX'
                      : 'Boleto'
                }
              />
            </dl>
          </section>

          {/* Cliente */}
          <section>
            <p className="label">Cliente e entrega</p>
            <div className="space-y-1 border border-smoke p-3 text-[0.7rem] text-parchment">
              <p className="text-bone">{order.customer.name}</p>
              <p className="text-grave">{order.customer.email}</p>
              <p className="text-grave tabular-nums">{order.customer.phone}</p>
              <p className="mt-2 border-t border-smoke pt-2 text-grave">
                {order.address.street}, {order.address.number}
                {order.address.complement && ` — ${order.address.complement}`}
                <br />
                {order.address.district} · {order.address.city}/{order.address.state}
                <br />
                CEP {order.address.cep}
              </p>
            </div>
          </section>

          {/* Histórico */}
          <section>
            <p className="label">Histórico</p>
            <ol className="space-y-2.5 border-l border-smoke pl-4">
              {order.history.map((entry, index) => (
                <li key={index} className="relative">
                  <span className="absolute top-1.5 -left-[1.32rem] h-1.5 w-1.5 rounded-full bg-blood" />
                  <p className="text-[0.68rem] text-parchment">
                    {ORDER_STATUS_LABEL[entry.status]}
                  </p>
                  <p className="text-[0.6rem] text-dust">
                    {formatDateTime(entry.at)}
                    {entry.by && ` · por ${entry.by}`}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-grave">{label}</dt>
      <dd className="text-parchment tabular-nums">{value}</dd>
    </div>
  );
}
