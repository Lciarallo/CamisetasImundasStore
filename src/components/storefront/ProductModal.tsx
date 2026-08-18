import { useEffect, useState } from 'react';
import { Check, Hammer, Minus, Plus, Share2, Truck, X } from 'lucide-react';
import type { Product, Size } from '../../types';
import { money } from '../../lib/format';
import { shareProduct } from '../../lib/share';
import { availableFor, sizesFor } from '../../store/StoreContext';
import { TeeImage } from '../art/TeeImage';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (productId: string, size: Size, quantity: number) => void;
  onSelectBand?: (band: string) => void;
}

/** Medidas reais de camiseta — evita a devolução mais comum de e-commerce. */
const SIZE_CHART: Record<Size, { chest: number; length: number }> = {
  P: { chest: 50, length: 70 },
  M: { chest: 53, length: 72 },
  G: { chest: 56, length: 74 },
  GG: { chest: 59, length: 76 },
  XGG: { chest: 62, length: 78 },
};

export function ProductModal({
  product,
  onClose,
  onAddToCart,
  onSelectBand,
}: ProductModalProps) {
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [copied, setCopied] = useState(false);

  // Reinicia a escolha ao trocar de peça, senão o tamanho anterior vaza.
  useEffect(() => {
    setSize(null);
    setQuantity(1);
    setAdded(false);
    setActivePhoto(0);
    setCopied(false);
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

  const handleShare = async () => {
    const res = await shareProduct(product);
    if (res === 'clipboard') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
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
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-smoke bg-crypt/95 px-4 sm:px-5 py-3 backdrop-blur shadow-md">
          {onSelectBand ? (
            <button
              type="button"
              onClick={() => {
                onSelectBand(product.band);
                onClose();
              }}
              className="heading-carved text-[0.65rem] sm:text-[0.6rem] text-blood-bright transition-colors hover:text-bone hover:underline"
              title={`Filtrar catálogo por ${product.band}`}
            >
              {product.band}
            </button>
          ) : (
            <p className="heading-carved text-[0.65rem] sm:text-[0.6rem] text-blood-bright">{product.band}</p>
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 border border-iron/80 bg-pitch/60 px-2.5 py-1.5 text-xs text-parchment transition-colors hover:border-blood hover:text-bone active:scale-95"
              title={copied ? 'Link copiado!' : 'Compartilhar link desta peça'}
              aria-label="Compartilhar link da camiseta"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-blood-bright" />
                  <span className="hidden xs:inline">Compartilhar</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded border border-iron bg-pitch text-bone transition-all hover:border-blood hover:bg-blood hover:text-white active:scale-90"
              aria-label="Fechar detalhes da camiseta"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-smoke bg-pitch p-6 md:border-r md:border-b-0">
            <TeeImage
              art={product.art}
              band={product.band}
              photo={product.photos[activePhoto]}
              className="mx-auto w-full max-w-sm"
            />

            {/* Galeria — só aparece quando há mais de uma foto */}
            {product.photos.length > 1 && (
              <div className="mx-auto mt-4 flex max-w-sm overflow-x-auto pb-1 gap-2 scrollbar-none">
                {product.photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setActivePhoto(index)}
                    aria-label={`Ver foto ${index + 1} de ${product.photos.length}`}
                    aria-current={index === activePhoto}
                    className={`w-16 shrink-0 border transition-all active:scale-95 ${
                      index === activePhoto
                        ? 'border-blood ring-1 ring-blood'
                        : 'border-smoke hover:border-iron opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photo}
                      alt=""
                      loading="lazy"
                      className="aspect-[300/340] w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:gap-5 p-5 sm:p-6">
            <div>
              <h2
                id="product-modal-title"
                className="font-display text-lg sm:text-xl leading-tight font-bold text-bone"
              >
                {product.name}
              </h2>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-parchment">{product.description}</p>

            <div className="border-y border-smoke py-3 sm:py-4">
              <div className="flex items-baseline gap-3">
                {product.oldPrice && (
                  <span className="text-xs sm:text-sm text-dust line-through tabular-nums">
                    {money(product.oldPrice)}
                  </span>
                )}
                <span className="font-display text-2xl sm:text-3xl font-bold text-bone tabular-nums">
                  {money(product.price)}
                </span>
              </div>
              <p className="mt-1 text-[0.68rem] text-grave tabular-nums">
                {money(product.price * 0.95)} no PIX à vista
              </p>
            </div>

            {/* Tamanhos */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">Tamanho</span>
                {size && (
                  <span className="text-[0.65rem] text-grave tabular-nums">
                    {SIZE_CHART[size].chest}cm largura × {SIZE_CHART[size].length}cm altura
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
                      className={`min-w-11 min-h-[42px] border px-3 py-2 font-display text-xs font-bold transition-all active:scale-95 ${
                        selected
                          ? 'border-blood bg-blood text-bone shadow-[0_0_10px_rgba(165,18,27,0.4)]'
                          : disabled
                            ? 'cursor-not-allowed border-smoke text-dust line-through'
                            : 'border-iron text-parchment hover:border-blood-bright hover:text-bone'
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
                  className="px-3.5 py-2.5 sm:px-3 sm:py-2 text-parchment transition-colors hover:text-blood-bright disabled:text-dust active:scale-95"
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
                  className="px-3.5 py-2.5 sm:px-3 sm:py-2 text-parchment transition-colors hover:text-blood-bright disabled:text-dust active:scale-95"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!size}
              className={`btn w-full py-3.5 sm:py-3 text-sm font-semibold transition-all active:scale-[0.99] ${added ? 'btn-ghost border-blood text-blood-bright' : 'btn-blood'}`}
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

            {/* Especificação do Tecido */}
            <div className="border border-iron/80 bg-pitch p-3">
              <div className="flex items-center justify-between">
                <span className="heading-carved text-[0.6rem] text-blood-bright uppercase tracking-wider">
                  Composição Têxtil
                </span>
                <span className="tag border-blood bg-blood/20 text-bone text-[0.62rem]">
                  100% Algodão Puro
                </span>
              </div>
              <p className="mt-1.5 text-[0.72rem] leading-relaxed text-parchment">
                Malha penteada premium fio 30.1 (180–190g/m²). Toque macio, máxima respirabilidade, costuras reforçadas e serigrafia de alto contraste resistente a lavagens.
              </p>
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

            {/* Botão de Fechar no final */}
            <div className="pt-2 border-t border-smoke/40 sm:hidden">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost w-full py-3 text-xs text-parchment hover:text-bone hover:border-iron active:scale-95"
              >
                ← Voltar para o catálogo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
