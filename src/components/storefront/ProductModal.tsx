import { useEffect, useState } from 'react';
import { Check, Hammer, Minus, Plus, Star, Truck, X } from 'lucide-react';
import type { Product, Size } from '../../types';
import { money } from '../../lib/format';
import { availableFor, sizesFor } from '../../store/StoreContext';
import { TeeArtwork } from '../art/TeeArtwork';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (productId: string, size: Size, quantity: number) => void;
}

/** Medidas reais de camiseta — evita a devolução mais comum de e-commerce. */
const SIZE_CHART: Record<Size, { chest: number; length: number }> = {
  P: { chest: 50, length: 70 },
  M: { chest: 53, length: 72 },
  G: { chest: 56, length: 74 },
  GG: { chest: 59, length: 76 },
  XGG: { chest: 62, length: 78 },
};

export function ProductModal({ product, onClose, onAddToCart }: ProductModalProps) {
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Reinicia a escolha ao trocar de peça, senão o tamanho anterior vaza.
  useEffect(() => {
    setSize(null);
    setQuantity(1);
    setAdded(false);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [product, onClose]);

  if (!product) return null;

  const sizes = sizesFor(product);
  const madeToOrder = product.fulfillment === 'sob-encomenda';
  const available = size ? availableFor(product, size) : 0;

  const handleAdd = () => {
    if (!size) return;
    onAddToCart(product.id, size, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-70 flex items-end justify-center bg-void/85 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        className="panel-raised anim-rise flex max-h-[92vh] w-full max-w-4xl flex-col overflow-y-auto sm:max-h-[88vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-smoke bg-crypt/95 px-5 py-3 backdrop-blur">
          <p className="heading-carved text-[0.6rem] text-blood-bright">{product.band}</p>
          <button
            onClick={onClose}
            className="text-grave hover:text-bone"
            aria-label="Fechar detalhes"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-smoke bg-pitch p-6 md:border-r md:border-b-0">
            <TeeArtwork art={product.art} band={product.band} className="mx-auto w-full max-w-sm" />
          </div>

          <div className="flex flex-col gap-5 p-6">
            <div>
              <h2
                id="product-modal-title"
                className="font-display text-xl leading-tight font-bold text-bone"
              >
                {product.name}
              </h2>
              <div className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-grave">
                <Star className="h-3 w-3 fill-blood-bright text-blood-bright" />
                <span className="font-semibold text-parchment tabular-nums">
                  {product.rating.toFixed(1).replace('.', ',')}
                </span>
                <span>· {product.reviewsCount} avaliações</span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-parchment">{product.description}</p>

            <div className="border-y border-smoke py-4">
              <div className="flex items-baseline gap-3">
                {product.oldPrice && (
                  <span className="text-sm text-dust line-through tabular-nums">
                    {money(product.oldPrice)}
                  </span>
                )}
                <span className="font-display text-3xl font-bold text-bone tabular-nums">
                  {money(product.price)}
                </span>
              </div>
              <p className="mt-1 text-xs text-grave tabular-nums">
                em até 6x de {money(product.price / 6)} sem juros · {money(product.price * 0.95)} no PIX
              </p>
            </div>

            {/* Tamanhos */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">Tamanho</span>
                {size && (
                  <span className="text-[0.65rem] text-grave tabular-nums">
                    {SIZE_CHART[size].chest}cm de largura · {SIZE_CHART[size].length}cm de altura
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((option) => {
                  const stock = availableFor(product, option);
                  const disabled = stock <= 0;
                  const selected = size === option;
                  return (
                    <button
                      key={option}
                      disabled={disabled}
                      onClick={() => {
                        setSize(option);
                        setQuantity(1);
                      }}
                      className={`min-w-12 border px-3 py-2 font-display text-xs font-bold transition-colors ${
                        selected
                          ? 'border-blood bg-blood text-bone'
                          : disabled
                            ? 'cursor-not-allowed border-smoke text-dust line-through'
                            : 'border-iron text-parchment hover:border-blood-bright'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {size && !madeToOrder && (
                <p className="mt-2 text-[0.65rem] text-grave">
                  {available} {available === 1 ? 'unidade disponível' : 'unidades disponíveis'}
                </p>
              )}
            </div>

            {/* Quantidade */}
            <div>
              <span className="label">Quantidade</span>
              <div className="inline-flex items-center border border-iron">
                <button
                  onClick={() => setQuantity((n) => Math.max(1, n - 1))}
                  disabled={quantity <= 1}
                  className="px-3 py-2 text-parchment transition-colors hover:text-blood-bright disabled:text-dust"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-10 text-center font-display text-sm font-bold tabular-nums">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((n) => Math.min(available || 10, n + 1))}
                  disabled={!size || quantity >= available}
                  className="px-3 py-2 text-parchment transition-colors hover:text-blood-bright disabled:text-dust"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!size}
              className={`btn w-full ${added ? 'btn-ghost border-blood text-blood-bright' : 'btn-blood'}`}
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Adicionado à sacola
                </>
              ) : !size ? (
                'Escolha um tamanho'
              ) : madeToOrder ? (
                'Encomendar peça'
              ) : (
                'Adicionar à sacola'
              )}
            </button>

            {/* Entrega */}
            <div className="flex items-start gap-2.5 border border-smoke bg-pitch p-3">
              {madeToOrder ? (
                <>
                  <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
                  <p className="text-[0.7rem] leading-relaxed text-parchment">
                    <strong className="text-bone">Sob encomenda.</strong> Esta peça é produzida
                    depois que você compra: {product.productionDays} dias úteis de produção,
                    mais o prazo do frete. Não há estoque parado — por isso a tiragem nunca acaba.
                  </p>
                </>
              ) : (
                <>
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
                  <p className="text-[0.7rem] leading-relaxed text-parchment">
                    <strong className="text-bone">Pronta-entrega.</strong> Sai do nosso estoque em
                    até 2 dias úteis. Frete grátis para pedidos acima de R$ 299.
                  </p>
                </>
              )}
            </div>

            {/* Ficha técnica */}
            <div>
              <span className="label">Ficha da peça</span>
              <ul className="space-y-1.5">
                {product.details.map((detail) => (
                  <li key={detail} className="flex gap-2 text-[0.72rem] text-parchment">
                    <span className="text-blood-bright">†</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tabela de medidas */}
            <details className="border border-smoke">
              <summary className="heading-carved cursor-pointer px-3 py-2.5 text-[0.6rem] text-grave hover:text-bone">
                Tabela de medidas
              </summary>
              <table className="w-full border-t border-smoke text-[0.7rem]">
                <thead>
                  <tr className="text-grave">
                    <th className="px-3 py-1.5 text-left font-medium">Tam.</th>
                    <th className="px-3 py-1.5 text-right font-medium">Largura</th>
                    <th className="px-3 py-1.5 text-right font-medium">Altura</th>
                  </tr>
                </thead>
                <tbody className="text-parchment tabular-nums">
                  {sizes.map((option) => (
                    <tr key={option} className="border-t border-smoke/60">
                      <td className="px-3 py-1.5 font-display font-bold">{option}</td>
                      <td className="px-3 py-1.5 text-right">{SIZE_CHART[option].chest} cm</td>
                      <td className="px-3 py-1.5 text-right">{SIZE_CHART[option].length} cm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
