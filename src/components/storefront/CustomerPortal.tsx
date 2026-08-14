import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Package,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { ORDER_STATUS_LABEL } from '../../types';
import { formatDate, money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { TeeArtwork } from '../art/TeeArtwork';
import { PixPanel } from '../checkout/PixPanel';
import { buildPixPayload, INSANAS_PIX } from '../../lib/pix';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'aguardando-pagamento', label: 'Pedido Criado' },
  { status: 'pago', label: 'Pagamento Aprovado' },
  { status: 'em-producao', label: 'Em Separação / Produção' },
  { status: 'enviado', label: 'Despachado / A Caminho' },
  { status: 'entregue', label: 'Entregue' },
];

export function CustomerPortal({ onClose }: { onClose: () => void }) {
  const { lookupOrders } = useStore();
  const [query, setQuery] = useState(() => {
    try {
      return localStorage.getItem('insanas_customer_email') || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedPixOrder, setSelectedPixOrder] = useState<Order | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Carrega automaticamente os pedidos salvos no navegador do cliente
  useEffect(() => {
    try {
      const stored = localStorage.getItem('insanas_customer_orders');
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        if (Array.isArray(ids) && ids.length > 0) {
          setLoading(true);
          Promise.all(ids.map((id) => lookupOrders(id)))
            .then((results) => {
              const all = results.flat();
              // Remove duplicados
              const unique = Array.from(new Map(all.map((o) => [o.id, o])).values());
              unique.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              setOrders(unique);
              setSearched(true);
            })
            .finally(() => setLoading(false));
        }
      }
    } catch {
      // ignore
    }
  }, [lookupOrders]);

  const handleSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await lookupOrders(query.trim());
      setOrders(res);

      // Salva os IDs encontrados no histórico local
      if (res.length > 0) {
        try {
          const stored = localStorage.getItem('insanas_customer_orders');
          const current = stored ? (JSON.parse(stored) as string[]) : [];
          const merged = Array.from(new Set([...current, ...res.map((o) => o.id)]));
          localStorage.setItem('insanas_customer_orders', JSON.stringify(merged));
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const copyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTracking(code);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-70 flex items-end justify-center bg-void/85 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Área do Cliente e Rastreamento"
    >
      <div
        className="panel-raised anim-rise flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-smoke bg-crypt/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Package className="h-5 w-5 text-blood-bright" />
            <div>
              <h2 className="heading-carved text-xs text-bone">Área do Cliente · Meus Pedidos</h2>
              <p className="text-[0.65rem] text-grave">
                Consulte o status e rastreamento de suas encomendas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-grave transition-colors hover:text-bone"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Barra de Busca */}
        <div className="border-b border-smoke/70 bg-pitch/60 p-5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-dust" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por E-mail, CPF ou Número do Pedido (ex: INS-20001)..."
                className="field pl-9 text-xs"
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-blood shrink-0 text-xs">
              {loading ? 'Buscando...' : 'Consultar'}
            </button>
          </form>
        </div>

        {/* Lista de Pedidos */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {orders.length === 0 && searched && !loading && (
            <div className="py-12 text-center text-grave">
              <Package className="mx-auto h-12 w-12 text-dust opacity-40" />
              <p className="mt-3 text-sm text-bone">Nenhum pedido encontrado</p>
              <p className="mt-1 text-xs text-dust">
                Verifique se o e-mail, CPF ou número do pedido foram digitados corretamente.
              </p>
            </div>
          )}

          {orders.length === 0 && !searched && !loading && (
            <div className="py-10 text-center text-grave">
              <Package className="mx-auto h-10 w-10 text-dust opacity-30" />
              <p className="mt-2 text-xs text-parchment">
                Digite seu e-mail ou CPF acima para acompanhar seus pedidos em tempo real.
              </p>
            </div>
          )}

          {orders.map((order) => {
            const isCancelled = order.status === 'cancelado';
            const stepIndex = STEPS.findIndex((s) => s.status === order.status);

            return (
              <article
                key={order.id}
                className="border border-smoke bg-crypt/50 p-5 transition-colors hover:border-iron"
              >
                {/* Topo do Card */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-smoke/70 pb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-bone">{order.id}</span>
                    <span className="ml-2 text-[0.65rem] text-dust">
                      realizado em {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`tag ${
                      order.status === 'pago' || order.status === 'entregue'
                        ? 'border-emerald-900 bg-emerald-950/40 text-emerald-300'
                        : order.status === 'cancelado'
                          ? 'border-red-950 bg-red-950/40 text-red-400'
                          : 'border-blood/50 bg-blood/10 text-blood-bright'
                    }`}
                  >
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>

                {/* Linha do Tempo Visual */}
                {!isCancelled && (
                  <div className="my-5">
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {STEPS.map((step, idx) => {
                        const done = idx <= stepIndex;
                        const isCurrent = idx === stepIndex;

                        return (
                          <div key={step.status} className="flex flex-col items-center">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-colors ${
                                isCurrent
                                  ? 'border-blood-bright bg-blood text-bone ring-2 ring-blood/50 ring-offset-2 ring-offset-void'
                                  : done
                                    ? 'border-emerald-600/70 bg-emerald-950/80 text-emerald-400'
                                    : 'border-smoke bg-pitch text-dust'
                              }`}
                            >
                              {done && !isCurrent ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : isCurrent ? (
                                <Clock className="h-3.5 w-3.5 animate-pulse" />
                              ) : (
                                <span className="font-mono text-[0.65rem]">{idx + 1}</span>
                              )}
                            </div>
                            <span
                              className={`mt-1.5 text-[0.55rem] leading-tight sm:text-[0.62rem] ${
                                isCurrent
                                  ? 'font-bold text-blood-bright'
                                  : done
                                    ? 'text-parchment'
                                    : 'text-dust'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Alerta de PIX Pendente */}
                {order.status === 'aguardando-pagamento' && order.payment.method === 'pix' && (
                  <div className="my-3 flex flex-wrap items-center justify-between gap-3 border border-blood/50 bg-blood/10 p-3">
                    <div className="text-[0.7rem] text-parchment">
                      <p className="font-bold text-blood-bright">Pagamento PIX Pendente</p>
                      <p className="text-[0.65rem] text-grave">
                        Total a pagar: <strong className="text-bone">{money(order.total)}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedPixOrder(order)}
                      className="btn btn-blood text-xs"
                    >
                      Pagar com PIX agora
                    </button>
                  </div>
                )}

                {/* Código de Rastreio */}
                {order.trackingCode && (
                  <div className="my-3 flex flex-wrap items-center justify-between gap-3 border border-smoke bg-pitch p-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blood-bright" />
                      <div>
                        <p className="heading-carved text-[0.58rem] text-grave">Código de Rastreamento</p>
                        <p className="font-mono text-xs font-bold text-bone">{order.trackingCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyTracking(order.trackingCode!)}
                        className="btn btn-ghost text-xs"
                        title="Copiar código de rastreamento"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedTracking === order.trackingCode ? 'Copiado!' : 'Copiar'}
                      </button>
                      <a
                        href={`https://rastreamento.correios.com.br/app/index.php?codigo=${order.trackingCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-bone flex items-center gap-1 text-xs"
                      >
                        Rastrear nos Correios
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Itens do Pedido */}
                <div className="mt-4 divide-y divide-smoke/60 border-t border-smoke/70 pt-3">
                  {order.lines.map((line, lineIndex) => (
                    <div key={lineIndex} className="flex items-center gap-3 py-2">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-smoke bg-pitch">
                        {line.photo ? (
                          <img
                            src={line.photo}
                            alt={line.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <TeeArtwork
                            art={line.art}
                            band={line.band}
                            showBandName={false}
                            className="h-full w-full p-0.5"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs text-bone">{line.name}</p>
                        <p className="text-[0.62rem] text-dust">
                          Tamanho: <strong className="text-parchment">{line.size}</strong> · Qtd:{' '}
                          <strong className="text-parchment">{line.quantity}</strong>
                        </p>
                      </div>
                      <span className="font-mono text-xs text-parchment">
                        {money(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total e Endereço */}
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-smoke/70 pt-3 text-[0.65rem] text-dust">
                  <div>
                    <p className="text-grave">
                      Entrega:{' '}
                      <span className="text-parchment">
                        {order.address.street}, {order.address.number}
                        {order.address.complement ? ` (${order.address.complement})` : ''} -{' '}
                        {order.address.city}/{order.address.state} (CEP: {order.address.cep})
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-bone">
                      Total: {money(order.total)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Modal Secundário de PIX */}
        {selectedPixOrder && (
          <div
            className="anim-fade fixed inset-0 z-80 flex items-center justify-center bg-void/90 p-4"
            onClick={() => setSelectedPixOrder(null)}
          >
            <div
              className="panel-raised anim-rise w-full max-w-lg p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-smoke pb-3">
                <p className="heading-carved text-xs text-bone">
                  Pagar Pedido {selectedPixOrder.id}
                </p>
                <button
                  onClick={() => setSelectedPixOrder(null)}
                  className="text-grave hover:text-bone"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="pt-4">
                <PixPanel
                  payload={buildPixPayload({
                    ...INSANAS_PIX,
                    amount: selectedPixOrder.total,
                    txId: selectedPixOrder.id.replace(/\D/g, '') || 'INSANAS',
                    description: `Pedido ${selectedPixOrder.id}`,
                  })}
                  amount={selectedPixOrder.total}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
