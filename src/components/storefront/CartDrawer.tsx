import { useEffect, useState } from 'react';
import { Hammer, Minus, Plus, Tag, Trash2, X } from 'lucide-react';
import { money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { FREE_SHIPPING_THRESHOLD } from '../../data/seed';
import { SkullMark } from '../art/Sigils';
import { TeeArtwork } from '../art/TeeArtwork';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const {
    cart,
    cartTotals,
    productById,
    setCartQuantity,
    removeFromCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useStore();

  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const progress = Math.min(
    100,
    ((cartTotals.subtotal - cartTotals.discount) / FREE_SHIPPING_THRESHOLD) * 100,
  );

  const handleCoupon = () => {
    const result = applyCoupon(code);
    setFeedback(result);
    if (result.ok) setCode('');
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-70 flex justify-end bg-void/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-title"
    >
      <aside
        className="anim-slide-left flex h-full w-full max-w-md flex-col border-l border-smoke bg-crypt"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-smoke px-5 py-4">
          <h2 id="cart-title" className="heading-carved text-xs text-bone">
            Sua sacola
            {cartTotals.itemCount > 0 && (
              <span className="ml-2 text-grave tabular-nums">({cartTotals.itemCount})</span>
            )}
          </h2>
          <button onClick={onClose} className="text-grave hover:text-bone" aria-label="Fechar sacola">
            <X className="h-5 w-5" />
          </button>
        </header>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <SkullMark className="h-16 w-16 text-iron" />
            <p className="heading-carved text-xs text-grave">A sacola está vazia</p>
            <p className="text-[0.75rem] text-dust">
              Nenhuma peça foi escolhida ainda. O culto espera.
            </p>
            <button onClick={onClose} className="btn btn-ghost mt-2">
              Voltar ao catálogo
            </button>
          </div>
        ) : (
          <>
            {/* Barra de frete grátis */}
            <div className="border-b border-smoke bg-pitch px-5 py-3">
              {cartTotals.missingForFreeShipping > 0 ? (
                <p className="text-[0.7rem] text-parchment">
                  Faltam{' '}
                  <strong className="text-blood-bright tabular-nums">
                    {money(cartTotals.missingForFreeShipping)}
                  </strong>{' '}
                  para o frete grátis
                </p>
              ) : (
                <p className="text-[0.7rem] font-semibold text-blood-bright">
                  Frete grátis liberado
                </p>
              )}
              <div className="mt-2 h-1 w-full bg-smoke">
                <div
                  className="h-full bg-blood transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Itens */}
            <ul className="flex-1 divide-y divide-smoke overflow-y-auto">
              {cart.map((item, index) => {
                const product = productById(item.productId);
                if (!product) return null;
                return (
                  <li key={`${item.productId}-${item.size}`} className="flex gap-3 p-4">
                    <div className="w-16 shrink-0 bg-pitch">
                      <TeeArtwork
                        art={product.art}
                        band={product.band}
                        showBandName={false}
                        className="w-full"
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="heading-carved text-[0.55rem] text-blood-bright">
                            {product.band}
                          </p>
                          <p className="truncate text-xs font-semibold text-bone">
                            {product.name}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="shrink-0 text-dust hover:text-blood-bright"
                          aria-label={`Remover ${product.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <p className="text-[0.65rem] text-grave">
                        Tamanho {item.size}
                        {item.fulfillment === 'sob-encomenda' && (
                          <span className="ml-2 inline-flex items-center gap-1 text-blood-bright">
                            <Hammer className="h-2.5 w-2.5" />
                            {product.productionDays} dias
                          </span>
                        )}
                      </p>

                      <div className="mt-auto flex items-center justify-between">
                        <div className="inline-flex items-center border border-iron">
                          <button
                            onClick={() => setCartQuantity(index, item.quantity - 1)}
                            className="px-2 py-1 text-parchment hover:text-blood-bright"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-7 text-center font-display text-[0.7rem] font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => setCartQuantity(index, item.quantity + 1)}
                            className="px-2 py-1 text-parchment hover:text-blood-bright"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="font-display text-sm font-bold text-bone tabular-nums">
                          {money(product.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Cupom + totais */}
            <footer className="border-t border-smoke bg-pitch">
              <div className="border-b border-smoke p-4">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-2 border border-blood/50 bg-blood/10 px-3 py-2">
                    <span className="flex items-center gap-2 text-[0.7rem] text-bone">
                      <Tag className="h-3 w-3 text-blood-bright" />
                      <strong className="font-display">{appliedCoupon.code}</strong>
                      <span className="text-grave">−{appliedCoupon.percent}%</span>
                    </span>
                    <button
                      onClick={() => {
                        removeCoupon();
                        setFeedback(null);
                      }}
                      className="text-[0.65rem] text-grave hover:text-blood-bright"
                    >
                      remover
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value.toUpperCase())}
                        onKeyDown={(event) => event.key === 'Enter' && handleCoupon()}
                        placeholder="Cupom de desconto"
                        className="field flex-1 text-xs"
                        aria-label="Código do cupom"
                      />
                      <button onClick={handleCoupon} className="btn btn-ghost px-4 py-2">
                        Aplicar
                      </button>
                    </div>
                    {feedback && (
                      <p
                        className={`mt-2 text-[0.65rem] ${
                          feedback.ok ? 'text-blood-bright' : 'text-ember'
                        }`}
                      >
                        {feedback.message}
                      </p>
                    )}
                  </>
                )}
              </div>

              <dl className="space-y-1.5 p-4 text-xs">
                <div className="flex justify-between text-grave">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{money(cartTotals.subtotal)}</dd>
                </div>
                {cartTotals.discount > 0 && (
                  <div className="flex justify-between text-blood-bright">
                    <dt>Desconto</dt>
                    <dd className="tabular-nums">−{money(cartTotals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-grave">
                  <dt>Frete</dt>
                  <dd className="tabular-nums">
                    {cartTotals.shipping === 0 ? 'Grátis' : money(cartTotals.shipping)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-smoke pt-2.5 text-bone">
                  <dt className="heading-carved text-[0.65rem]">Total</dt>
                  <dd className="font-display text-xl font-bold tabular-nums">
                    {money(cartTotals.total)}
                  </dd>
                </div>
              </dl>

              {cartTotals.productionDays > 0 && (
                <p className="border-t border-smoke px-4 py-2 text-[0.65rem] text-grave">
                  Há peças sob encomenda: o pedido inteiro sai em até{' '}
                  {cartTotals.productionDays} dias úteis.
                </p>
              )}

              <div className="p-4 pt-2">
                <button onClick={onCheckout} className="btn btn-blood w-full">
                  Finalizar compra
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
