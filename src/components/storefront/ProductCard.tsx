import { useState } from 'react';
import { Hammer, Star } from 'lucide-react';
import type { Product, Size } from '../../types';
import { money } from '../../lib/format';
import { availableFor, isSoldOut, sizesFor, totalStock } from '../../store/StoreContext';
import { TeeArtwork } from '../art/TeeArtwork';

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
  onAddToCart: (productId: string, size: Size) => void;
}

export function ProductCard({ product, onOpen, onAddToCart }: ProductCardProps) {
  const [hoveredSize, setHoveredSize] = useState<Size | null>(null);
  const sizes = sizesFor(product);
  const soldOut = isSoldOut(product);
  const madeToOrder = product.fulfillment === 'sob-encomenda';
  const stockLeft = totalStock(product);

  return (
    <article className="group panel relative flex flex-col transition-colors duration-300 hover:border-blood/60">
      {/* Etiquetas */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
        {product.tag && (
          <span
            className={`tag ${
              product.tag === 'Última Peça' ? 'text-blood-bright' : 'text-parchment'
            }`}
          >
            {product.tag}
          </span>
        )}
        {product.oldPrice && (
          <span className="tag border-blood bg-blood text-bone">
            -{Math.round((1 - product.price / product.oldPrice) * 100)}%
          </span>
        )}
      </div>

      {madeToOrder && (
        <span className="tag absolute top-3 right-3 z-10 gap-1 text-grave">
          <Hammer className="h-2.5 w-2.5" />
          Sob encomenda
        </span>
      )}

      <button
        onClick={() => onOpen(product)}
        className="relative block overflow-hidden bg-pitch"
        aria-label={`Ver detalhes de ${product.name}`}
      >
        <TeeArtwork
          art={product.art}
          band={product.band}
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
          <p className="heading-carved text-[0.58rem] text-blood-bright">{product.band}</p>
          <button
            onClick={() => onOpen(product)}
            className="mt-1 block text-left font-display text-sm leading-tight font-semibold text-bone hover:text-blood-bright"
          >
            {product.name}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[0.68rem] text-grave">
          <Star className="h-3 w-3 fill-blood-bright text-blood-bright" />
          <span className="font-semibold text-parchment tabular-nums">
            {product.rating.toFixed(1).replace('.', ',')}
          </span>
          <span>({product.reviewsCount})</span>
          <span className="ml-auto">{product.category}</span>
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
              <p className="text-[0.7rem] text-dust line-through tabular-nums">
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
