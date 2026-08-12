import React from 'react';
import type { CartItem } from '../types/cart';
import { X, Trash2, ShoppingBag, ArrowRight, Truck, Tag, Check } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onProceedToCheckout: (appliedDiscount: number) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const [couponCode, setCouponCode] = React.useState('');
  const [discountPercent, setDiscountPercent] = React.useState(0);
  const [couponMessage, setCouponMessage] = React.useState<{ text: string; isError: boolean } | null>(null);

  const FREE_SHIPPING_THRESHOLD = 250;

  const subtotal = items.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const discountAmount = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal - discountAmount);

  const remainingForFreeShipping = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD - subtotal
  );
  const freeShippingProgress = Math.min(
    100,
    (subtotal / FREE_SHIPPING_THRESHOLD) * 100
  );

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'IMUNDA10') {
      setDiscountPercent(10);
      setCouponMessage({ text: 'Cupom IMUNDA10 aplicado! 10% de desconto.', isError: false });
    } else if (code === 'IMUNDA20') {
      setDiscountPercent(20);
      setCouponMessage({ text: 'Cupom VIP IMUNDA20 aplicado! 20% de desconto.', isError: false });
    } else {
      setCouponMessage({ text: 'Cupom inválido. Tente IMUNDA10', isError: true });
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fade-in flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col justify-between animate-slide-in shadow-2xl"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-lime-400" />
            <h3 className="font-extrabold text-base text-white uppercase tracking-wide">
              Seu Carrinho ({items.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress */}
        <div className="p-4 bg-zinc-900/40 border-b border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <Truck className="w-4 h-4 text-lime-400" />
              <span>
                {remainingForFreeShipping > 0
                  ? `Falta R$ ${remainingForFreeShipping.toFixed(2).replace('.', ',')} para Frete Grátis`
                  : 'Parabéns! Você ganhou FRETE GRÁTIS!'}
              </span>
            </div>
            <span className="font-mono text-lime-400">{freeShippingProgress.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-lime-400 transition-all duration-500 rounded-full shadow-sm shadow-lime-400"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Item List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-white uppercase">Seu carrinho está vazio</p>
                <p className="text-xs text-zinc-500">Adicione algumas camisetas de atitude à sua sacola.</p>
              </div>
              <button
                onClick={onClose}
                className="btn-primary py-2.5 px-5 text-xs font-bold rounded-lg mt-2"
              >
                VER CAMISETAS
              </button>
            </div>
          ) : (
            items.map((item, index) => (
              <div
                key={`${item.product.id}-${item.selectedSize}-${index}`}
                className="flex items-center gap-3 p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover rounded-lg bg-zinc-950 shrink-0"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="font-bold text-xs text-white uppercase line-clamp-1">
                    {item.product.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                    <span>Tam: <strong className="text-lime-400">{item.selectedSize}</strong></span>
                    <span>•</span>
                    <span className="text-white font-bold">
                      R$ {item.product.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="inline-flex items-center bg-zinc-950 border border-zinc-800 rounded p-0.5">
                      <button
                        onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                        className="w-6 h-6 rounded text-zinc-400 hover:text-white font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="w-7 text-center text-xs font-mono font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                        className="w-6 h-6 rounded text-zinc-400 hover:text-white font-bold text-xs"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(index)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Checkout Summary */}
        {items.length > 0 && (
          <div className="p-5 border-t border-zinc-800 bg-zinc-900/80 space-y-4">
            {/* Coupon Box */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Cupom (ex: IMUNDA10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="input-dark w-full pl-9 pr-3 py-2 text-xs rounded-lg uppercase font-mono"
                  />
                </div>
                <button
                  onClick={handleApplyCoupon}
                  className="btn-secondary px-3 text-xs font-bold rounded-lg"
                >
                  OK
                </button>
              </div>

              {couponMessage && (
                <p className={`text-[11px] font-medium flex items-center gap-1 ${couponMessage.isError ? 'text-rose-400' : 'text-lime-400'}`}>
                  {!couponMessage.isError && <Check className="w-3 h-3" />}
                  {couponMessage.text}
                </p>
              )}
            </div>

            {/* Calculations */}
            <div className="space-y-1 text-xs font-mono text-zinc-400 border-t border-zinc-800/80 pt-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-lime-400 font-bold">
                  <span>Desconto ({discountPercent}%):</span>
                  <span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Frete:</span>
                <span>{remainingForFreeShipping === 0 ? <strong className="text-lime-400">GRÁTIS</strong> : 'R$ 15,90'}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white font-sans pt-2 border-t border-zinc-800">
                <span>TOTAL:</span>
                <span className="text-lime-400 font-mono text-lg">
                  R$ {(total + (remainingForFreeShipping === 0 ? 0 : 15.9)).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => onProceedToCheckout(discountPercent)}
              className="btn-primary w-full py-4 text-sm font-extrabold flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-lime-400/20"
            >
              <span>FINALIZAR COMPRA</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
