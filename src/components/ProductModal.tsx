import React from 'react';
import type { Product } from '../data/products';
import { X, ShoppingBag, Star, Check, Shield, Truck, RotateCcw, Ruler } from 'lucide-react';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, size: 'P' | 'M' | 'G' | 'GG' | 'XGG', quantity: number) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  if (!product) return null;

  const [selectedSize, setSelectedSize] = React.useState<'P' | 'M' | 'G' | 'GG' | 'XGG'>(
    product.sizes[0]
  );
  const [quantity, setQuantity] = React.useState(1);
  const [showSizeGuide, setShowSizeGuide] = React.useState(false);
  const [addedSuccess, setAddedSuccess] = React.useState(false);

  // Close modal on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAdd = () => {
    onAddToCart(product, selectedSize, quantity);
    setAddedSuccess(true);
    setTimeout(() => {
      setAddedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-pop-up max-h-[90vh] flex flex-col md:flex-row"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-zinc-950/80 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Product Image */}
        <div className="md:w-1/2 relative bg-zinc-950 flex items-center justify-center min-h-[300px] md:min-h-[500px]">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center filter brightness-95"
          />
          {product.tag && (
            <div className="absolute top-4 left-4">
              <span className="badge-tag badge-bestseller">{product.tag}</span>
            </div>
          )}
        </div>

        {/* Right: Product Specs & Options */}
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-lime-400 font-mono uppercase font-bold mb-1">
                <span>{product.category}</span>
                <span>•</span>
                <div className="flex items-center text-amber-400 gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{product.rating}</span>
                  <span className="text-zinc-500">({product.reviewsCount} avaliações)</span>
                </div>
              </div>

              <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-tight">
                {product.name}
              </h2>
            </div>

            {/* Price Header */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-lime-400 font-mono">
                R$ {product.price.toFixed(2).replace('.', ',')}
              </span>
              {product.oldPrice && (
                <span className="text-sm text-zinc-500 line-through font-mono">
                  R$ {product.oldPrice.toFixed(2).replace('.', ',')}
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">{product.description}</p>

            {/* Details Bullet Points */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Especificações do Produto:</h4>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                {product.details.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-lime-400 shrink-0" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Size Selector */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 uppercase">Selecione o Tamanho:</label>
                <button
                  onClick={() => setShowSizeGuide(!showSizeGuide)}
                  className="text-xs text-lime-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Tabela de Medidas</span>
                </button>
              </div>

              <div className="flex gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`flex-1 py-2 rounded-lg font-mono font-bold text-sm border transition-all ${
                      selectedSize === size
                        ? 'bg-lime-400 text-black border-lime-400 shadow-md shadow-lime-400/20'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {showSizeGuide && (
                <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs space-y-1 animate-fade-in font-mono text-zinc-400">
                  <p><strong className="text-white">P:</strong> 72cm alt x 54cm larg</p>
                  <p><strong className="text-white">M:</strong> 75cm alt x 57cm larg</p>
                  <p><strong className="text-white">G:</strong> 78cm alt x 60cm larg</p>
                  <p><strong className="text-white">GG:</strong> 81cm alt x 63cm larg</p>
                  <p><strong className="text-white">XGG:</strong> 84cm alt x 66cm larg</p>
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase">Quantidade:</label>
              <div className="inline-flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold transition-colors"
                >
                  -
                </button>
                <span className="w-10 text-center font-mono font-bold text-sm text-white">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Modal Action CTA */}
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <button
              onClick={handleAdd}
              disabled={addedSuccess}
              className={`btn-primary w-full py-4 text-sm font-extrabold flex items-center justify-center gap-2 rounded-xl transition-all ${
                addedSuccess ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30' : ''
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{addedSuccess ? 'ADICIONADO AO CARRINHO!' : `ADICIONAR R$ ${(product.price * quantity).toFixed(2).replace('.', ',')}`}</span>
            </button>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-400 pt-1 text-center font-medium">
              <div className="flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5 text-lime-400" />
                <span>Compra Segura</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <Truck className="w-3.5 h-3.5 text-lime-400" />
                <span>Frete Rápido</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-lime-400" />
                <span>Troca Grátis</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
