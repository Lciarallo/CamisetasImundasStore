import { useState } from 'react';
import { Check, Hammer, Share2 } from 'lucide-react';
import type { Product, Size } from '../../types';
import { money } from '../../lib/format';
import { shareProduct } from '../../lib/share';
import { availableFor, isSoldOut, sizesFor, totalStock } from '../../store/StoreContext';
import { TeeImage } from '../art/TeeImage';

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
  onAddToCart: (productId: string, size: Size) => void;
  onSelectBand?: (band: string) => void;
}

export function ProductCard({ product, onOpen, onAddToCart, onSelectBand }: ProductCardProps) {
  const [hoveredSize, setHoveredSize] = useState<Size | null>(null);
  const [copied, setCopied] = useState(false);
  const sizes = sizesFor(product);
  const soldOut = isSoldOut(product);
  const madeToOrder = product.fulfillment === 'sob-encomenda';
  const stockLeft = totalStock(product);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await shareProduct(product);
    if (res === 'clipboard') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <article className="group panel relative flex flex-col transition-colors duration-300 hover:border-blood/60">
      {/*
        Etiquetas no topo da imagem.
        Lado Esquerdo: Tag de Promoção e Tag de Destaque (empilhadas verticalmente)
        Lado Direito: Botão de Compartilhar
      */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-3.5rem)]">
        {product.oldPrice && product.oldPrice > product.price && (
          <span className="tag border-blood bg-blood text-bone shadow-md">
            -{Math.round((1 - product.price / product.oldPrice) * 100)}%
          </span>
        )}
        {product.tag && (
          <span
            className={`tag bg-void/90 backdrop-blur-sm border border-smoke/70 ${
              product.tag === 'Última Peça' ? 'text-blood-bright border-blood/60' : 'text-parchment'
            }`}
          >
            {product.tag}
          </span>
        )}
      </div>

      {/* Botão de Compartilhar no Topo Direito */}
      <div className="absolute top-3 right-3 z-10">
        <button
          type="button"
          onClick={handleShare}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-smoke/80 bg-void/90 text-grave backdrop-blur-sm transition-all hover:border-blood hover:text-bone active:scale-95 shadow-sm"
          title={copied ? 'Link copiado!' : 'Compartilhar peça'}
          aria-label={`Compartilhar link de ${product.name}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Tag de Produção no Canto Inferior Esquerdo da Foto */}
      {madeToOrder && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10">
          <span className="tag gap-1 bg-void/90 text-parchment backdrop-blur-sm border border-smoke/70 text-[0.56rem]">
            <Hammer className="h-2.5 w-2.5 text-blood-bright" />
            Sob encomenda
          </span>
        </div>
      )}

      <button
        onClick={() => onOpen(product)}
        className="relative block overflow-hidden bg-pitch"
        aria-label={`Ver detalhes de ${product.name}`}
      >
        <TeeImage
          art={product.art}
          band={product.band}
          photo={product.photos[0]}
          className="w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-void/80">
            <span className="heading-carved border border-blood px-4 py-2 text-xs text-blood-bright">
              Esgotado
            </span>
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 border-t border-smoke p-4">
        <div>
          {onSelectBand ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectBand(product.band);
              }}
              className="heading-carved text-[0.58rem] text-blood-bright transition-colors hover:text-bone hover:underline"
              title={`Ver todas as peças de ${product.band}`}
            >
              {product.band}
            </button>
          ) : (
            <p className="heading-carved text-[0.58rem] text-blood-bright">{product.band}</p>
          )}
          <button
            onClick={() => onOpen(product)}
            className="mt-1 block text-left font-display text-sm leading-tight font-semibold text-bone hover:text-blood-bright"
          >
            {product.name}
          </button>
        </div>

        <div className="flex items-center justify-between font-mono text-[0.65rem] text-grave">
          <span className="rounded bg-void px-1.5 py-0.5 border border-smoke">{product.category}</span>
          <span className="text-parchment font-medium">100% Algodão</span>
        </div>

        {/* Seletor rápido de tamanho */}
        {!soldOut && (
          <div className="flex flex-wrap gap-1">
            {sizes.map((size) => {
              const available = availableFor(product, size);
              const disabled = available <= 0;
              return (
                <button
                  key={size}
                  disabled={disabled}
                  onMouseEnter={() => setHoveredSize(size)}
                  onMouseLeave={() => setHoveredSize(null)}
                  onClick={() => onAddToCart(product.id, size)}
                  aria-label={
                    disabled
                      ? `Tamanho ${size} de ${product.name} esgotado`
                      : `Adicionar tamanho ${size} de ${product.name} ao carrinho`
                  }
                  title={
                    disabled
                      ? `Tamanho ${size} esgotado`
                      : madeToOrder
                        ? `Encomendar tamanho ${size}`
                        : `${available} em estoque — adicionar ${size}`
                  }
                  className={`min-w-8 border px-2 py-1 font-display text-[0.65rem] font-bold transition-colors ${
                    disabled
                      ? 'cursor-not-allowed border-smoke text-dust line-through'
                      : 'border-iron text-parchment hover:border-blood hover:bg-blood hover:text-bone'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {product.oldPrice && (
              <p className="text-[0.7rem] text-grave line-through tabular-nums">
                {money(product.oldPrice)}
              </p>
            )}
            <p className="font-display text-lg leading-none font-bold text-bone tabular-nums">
              {money(product.price)}
            </p>
            <p className="mt-1 text-[0.62rem] text-grave tabular-nums">
              ou 6x de {money(product.price / 6)} sem juros
            </p>
          </div>
        </div>

        {/* Alerta de escassez / prazo — o que muda a decisão de compra */}
        {madeToOrder ? (
          <p className="border-t border-smoke pt-2 text-[0.62rem] text-grave">
            Produzida após a compra · pronta em {product.productionDays} dias úteis
          </p>
        ) : (
          stockLeft > 0 &&
          stockLeft <= 8 && (
            <p className="border-t border-smoke pt-2 text-[0.62rem] text-blood-bright">
              Restam apenas {stockLeft} {stockLeft === 1 ? 'peça' : 'peças'}
              {hoveredSize && ` · ${availableFor(product, hoveredSize)} no ${hoveredSize}`}
            </p>
          )
        )}
      </div>
    </article>
  );
}
