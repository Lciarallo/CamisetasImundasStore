import React from 'react';
import type { Product } from '../data/products';
import { ShoppingBag, Eye, Heart, Star } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, size: 'P' | 'M' | 'G' | 'GG' | 'XGG') => void;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectProduct,
  onAddToCart,
  isWishlisted,
  onToggleWishlist,
}) => {
  const [selectedSize, setSelectedSize] = React.useState<'P' | 'M' | 'G' | 'GG' | 'XGG'>(
    product.sizes[0]
  );
  const [addedToast, setAddedToast] = React.useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product, selectedSize);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 1800);
  };

  const getTagBadge = () => {
    if (!product.tag) return null;
    const badgeClasses = {
      Bestseller: 'badge-bestseller',
      Novo: 'badge-novo',
      Raro: 'badge-raro',
      Promoção: 'badge-promocao',
    };

    return (
      <span className={`badge-tag ${badgeClasses[product.tag]} shadow-md`}>
        {product.tag}
      </span>
    );
  };

  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="group relative bg-zinc-900/90 rounded-xl border border-zinc-800/80 overflow-hidden card-hover cursor-pointer flex flex-col justify-between"
    >
      {/* Top Media Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-950">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 filter brightness-95 group-hover:brightness-100"
        />

        {/* Tag Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
          {getTagBadge()}
        </div>

        {/* Wishlist Button Overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product.id);
          }}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all z-10 ${
            isWishlisted
              ? 'bg-rose-500 text-white'
              : 'bg-zinc-950/60 text-zinc-300 hover:text-rose-400 hover:bg-zinc-900'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-white' : ''}`} />
        </button>

        {/* Quick View Button on Hover */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none group-hover:pointer-events-auto z-10">
          <button
            onClick={() => onSelectProduct(product)}
            className="btn-secondary text-xs font-bold py-2 px-4 rounded-lg bg-zinc-950/90 hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-all flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            VER DETALHES
          </button>
        </div>
      </div>

      {/* Content Details */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="font-mono uppercase font-bold text-zinc-500">{product.category}</span>
            <div className="flex items-center gap-1 text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span className="font-bold text-zinc-300">{product.rating}</span>
              <span className="text-zinc-500 text-[10px]">({product.reviewsCount})</span>
            </div>
          </div>

          <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-lime-400 transition-colors uppercase tracking-tight">
            {product.name}
          </h3>
        </div>

        {/* Size Selection */}
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold">
            <span>TAMANHO:</span>
            <span className="text-lime-400 font-mono font-bold">{selectedSize}</span>
          </div>
          <div className="flex gap-1">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`flex-1 py-1 rounded text-xs font-mono font-bold border transition-colors ${
                  selectedSize === size
                    ? 'bg-lime-400 text-black border-lime-400'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Price & Action Button */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <div>
            {product.oldPrice && (
              <span className="text-xs text-zinc-500 line-through block font-mono">
                R$ {product.oldPrice.toFixed(2).replace('.', ',')}
              </span>
            )}
            <span className="text-base font-extrabold text-white font-mono text-lime-400">
              R$ {product.price.toFixed(2).replace('.', ',')}
            </span>
          </div>

          <button
            onClick={handleAddToCart}
            className={`btn-primary py-2 px-3 text-xs rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              addedToast ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30' : ''
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{addedToast ? 'ADICIONADO!' : 'COMPRAR'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
