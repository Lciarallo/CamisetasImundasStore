import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Package,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { ORDER_STATUS_LABEL } from '../../types';
import { formatDate, money } from '../../lib/format';
import {
  readCustomerOrderAccess,
  saveCustomerOrderAccess,
} from '../../lib/customerOrders';
import { useStore } from '../../store/StoreContext';
import { TeeArtwork } from '../art/TeeArtwork';
import { InfinitePayPanel } from '../checkout/InfinitePayPanel';
import { InvoiceModal } from '../fiscal/InvoiceModal';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'aguardando-pagamento', label: 'Pedido Criado' },
  { status: 'pago', label: 'Pagamento Aprovado' },
  { status: 'em-producao', label: 'Em Separação / Produção' },
  { status: 'enviado', label: 'Despachado / A Caminho' },
  { status: 'entregue', label: 'Entregue' },
];

export function CustomerPortal({ onClose }: { onClose: () => void }) {
  const { lookupOrders } = useStore();
  const [orderId, setOrderId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedPixOrder, setSelectedPixOrder] = useState<Order | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Carrega automaticamente os pedidos salvos no navegador do cliente
  useEffect(() => {
    const saved = readCustomerOrderAccess();
    if (saved.length === 0) return;

    let active = true;
    setLoading(true);
    void Promise.all(saved.map(({ id, token }) => lookupOrders(id, token)))
      .then((results) => {
        if (!active) return;
        const all = results.flat();
        const unique = Array.from(new Map(all.map((order) => [order.id, order])).values());
        unique.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setOrders(unique);
        setSearched(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lookupOrders]);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedOrderId = orderId.trim();
    const normalizedAccessToken = accessToken.trim();
    if (!normalizedOrderId || !normalizedAccessToken) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await lookupOrders(normalizedOrderId, normalizedAccessToken);
      setOrders(res);

      if (res.length > 0) {
        for (const order of res) {
          saveCustomerOrderAccess({ id: order.id, token: normalizedAccessToken });
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
          <form
            onSubmit={handleSearch}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label>
              <span className="label">Número do pedido</span>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-dust" />
                <input
                  type="text"
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  placeholder="INS-20001"
                  autoComplete="off"
                  className="field pl-9 text-xs"
                />
              </div>
            </label>
            <label>
              <span className="label">Código de acesso</span>
              <input
                type="password"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder="Código recebido ao comprar"
                autoComplete="off"
                className="field font-mono text-xs"
              />
            </label>
            <div>
              <button
                type="submit"
                disabled={loading || !orderId.trim() || !accessToken.trim()}
                className="btn btn-blood w-full text-xs sm:w-auto"
              >
                {loading ? 'Buscando...' : 'Consultar'}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de Pedidos */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {orders.length === 0 && searched && !loading && (
            <div className="py-12 text-center text-grave">
              <Package className="mx-auto h-12 w-12 text-dust opacity-40" />
              <p className="mt-3 text-sm text-bone">Nenhum pedido encontrado</p>
              <p className="mt-1 text-xs text-dust">
                Verifique o número do pedido e o código de acesso.
              </p>
            </div>
          )}

          {orders.length === 0 && !searched && !loading && (
            <div className="py-10 text-center text-grave">
              <Package className="mx-auto h-10 w-10 text-dust opacity-30" />
              <p className="mt-2 text-xs text-parchment">
                Informe o número do pedido e o código de acesso recebido na compra.
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
                    {order.payment.checkoutUrl || order.payment.pixCode ? (
                      <button
                        onClick={() => setSelectedPixOrder(order)}
                        className="btn btn-blood text-xs"
                      >
                        Pagar com PIX agora
                      </button>
                    ) : (
                      <p className="max-w-xs text-[0.65rem] text-blood-bright">
                        Link de pagamento indisponível. Não faça uma transferência avulsa;
                        procure o suporte.
                      </p>
                    )}
                  </div>
                )}

                {/* Nota Fiscal Eletrônica (DANFE) */}
                {order.status !== 'aguardando-pagamento' && order.status !== 'cancelado' && (
                  <div className="my-3 flex flex-wrap items-center justify-between gap-3 border border-emerald-500/40 bg-emerald-950/20 p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="heading-carved text-[0.58rem] text-emerald-400">Nota Fiscal Eletrônica (DANFE)</p>
                        <p className="text-[0.68rem] text-parchment">
                          NF-e emitida e associada ao pagamento · 100% Algodão
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceOrder(order)}
                      className="btn btn-ghost border-emerald-500/50 text-xs text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                    >
                      Visualizar / Imprimir NF-e
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
                    <button
                      onClick={() => copyTracking(order.trackingCode!)}
                      className="btn btn-ghost border-smoke text-xs"
                    >
                      {copiedTracking === order.trackingCode ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-blood-bright" />
                          <span className="text-blood-bright">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Itens do Pedido */}
                <div className="mt-4 space-y-2">
                  <p className="heading-carved text-[0.58rem] text-grave">Itens do Pedido</p>
                  {order.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 border border-smoke/50 bg-pitch/50 p-2"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden bg-void">
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
        {selectedPixOrder && (selectedPixOrder.payment.checkoutUrl || selectedPixOrder.payment.pixCode) && (
          <div
            className="anim-fade fixed inset-0 z-80 flex items-center justify-center bg-void/90 p-4"
            onClick={() => setSelectedPixOrder(null)}
          >
            <div
              className="panel-raised anim-rise w-full max-w-lg p-5"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pix-payment-title"
            >
              <div className="flex items-center justify-between border-b border-smoke pb-3">
                <p id="pix-payment-title" className="heading-carved text-xs text-bone">
                  Pagar Pedido {selectedPixOrder.id}
                </p>
                <button
                  onClick={() => setSelectedPixOrder(null)}
                  className="text-grave hover:text-bone"
                  aria-label="Fechar pagamento"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="pt-4">
                <InfinitePayPanel
                  checkoutUrl={selectedPixOrder.payment.checkoutUrl ?? selectedPixOrder.payment.pixCode}
                  amount={selectedPixOrder.total}
                />
              </div>
            </div>
          </div>
        )}
        {/* Modal de Nota Fiscal Eletrônica (DANFE) */}
        {selectedInvoiceOrder && (
          <InvoiceModal
            order={selectedInvoiceOrder}
            onClose={() => setSelectedInvoiceOrder(null)}
          />
        )}
      </div>
    </div>
  );
}
