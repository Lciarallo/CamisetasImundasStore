import React from 'react';
import type { CartItem } from '../types/cart';
import confetti from 'canvas-confetti';
import { X, QrCode, CreditCard, FileText, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  discountPercent: number;
  onOrderCompleted: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  discountPercent,
  onOrderCompleted,
}) => {
  if (!isOpen) return null;

  const [paymentMethod, setPaymentMethod] = React.useState<'pix' | 'card' | 'boleto'>('pix');
  const [formData, setFormData] = React.useState({
    name: 'Henrique Silva',
    email: 'henrique@imundasstore.com',
    cpf: '123.456.789-00',
    cep: '01310-100',
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo/SP',
  });
  const [isSuccess, setIsSuccess] = React.useState(false);

  const subtotal = items.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  const discountAmount = (subtotal * discountPercent) / 100;
  const shipping = subtotal >= 250 ? 0 : 15.9;
  const total = Math.max(0, subtotal - discountAmount + shipping);

  const handleFinishOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
    
    // Trigger celebratory confetti
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ccff00', '#a855f7', '#ffffff', '#22c55e'],
    });
  };

  const handleCloseAll = () => {
    setIsSuccess(false);
    onOrderCompleted();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-pop-up max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-lime-400" />
            <h3 className="font-extrabold text-base text-white uppercase tracking-wide">
              {isSuccess ? 'Pedido Confirmado!' : 'Checkout Seguro 256-bit'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-6 animate-fade-in my-auto">
            <div className="w-20 h-20 rounded-full bg-lime-400/20 border-2 border-lime-400 flex items-center justify-center mx-auto text-lime-400">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">
                PEDIDO #CI-{Math.floor(100000 + Math.random() * 900000)} CONFIRMADO!
              </h2>
              <p className="text-sm text-zinc-300 max-w-md mx-auto">
                Obrigado por comprar na <strong className="text-lime-400">Camisetas Imundas Store</strong>.
                Enviamos os detalhes e o código de rastreamento para o seu e-mail (<span className="text-zinc-200">{formData.email}</span>).
              </p>
            </div>

            {paymentMethod === 'pix' && (
              <div className="p-5 bg-zinc-900 rounded-xl border border-zinc-800 max-w-sm mx-auto space-y-3">
                <p className="text-xs font-bold text-zinc-300 uppercase">QR Code PIX para Pagamento Instantâneo:</p>
                <div className="bg-white p-3 rounded-lg inline-block shadow-lg">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=CamisetasImundasStorePixMockPayment"
                    alt="QR Code PIX"
                    className="w-36 h-36 mx-auto"
                  />
                </div>
                <p className="text-[11px] text-lime-400 font-mono font-bold">Aprovação imediata após o pagamento</p>
              </div>
            )}

            <button
              onClick={handleCloseAll}
              className="btn-primary py-3.5 px-8 text-sm font-extrabold rounded-xl shadow-lg shadow-lime-400/20"
            >
              VOLTAR À LOJA
            </button>
          </div>
        ) : (
          /* Form & Summary View */
          <form onSubmit={handleFinishOrder} className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Customer & Delivery Details */}
            <div className="md:col-span-7 space-y-5">
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-lime-400 uppercase tracking-wider">1. Dados Pessoais & Entrega</h4>
                <div className="grid grid-cols-1 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Nome Completo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-dark text-xs w-full"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      required
                      placeholder="E-mail"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-dark text-xs w-full"
                    />
                    <input
                      type="text"
                      required
                      placeholder="CPF"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      className="input-dark text-xs w-full font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="CEP"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      className="input-dark text-xs font-mono"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Endereço de Entrega"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="input-dark text-xs col-span-2"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3 pt-3 border-t border-zinc-800">
                <h4 className="text-xs font-extrabold text-lime-400 uppercase tracking-wider">2. Forma de Pagamento</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      paymentMethod === 'pix'
                        ? 'bg-lime-400/10 border-lime-400 text-lime-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <span>PIX (5% OFF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-lime-400/10 border-lime-400 text-lime-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>CARTÃO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('boleto')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      paymentMethod === 'boleto'
                        ? 'bg-lime-400/10 border-lime-400 text-lime-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span>BOLETO</span>
                  </button>
                </div>

                {paymentMethod === 'card' && (
                  <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Número do Cartão"
                      className="input-dark text-xs w-full font-mono"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="MM/AA"
                        className="input-dark text-xs font-mono"
                      />
                      <input
                        type="text"
                        placeholder="CVV"
                        className="input-dark text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="md:col-span-5 bg-zinc-900/90 p-4 rounded-xl border border-zinc-800/80 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3">Resumo dos Itens</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs text-zinc-300">
                      <div className="truncate pr-2">
                        <span className="font-bold text-white">{item.quantity}x</span> {item.product.name}
                        <span className="text-[10px] text-lime-400 font-mono ml-1">({item.selectedSize})</span>
                      </div>
                      <span className="font-mono text-zinc-400 shrink-0">
                        R$ {(item.product.price * item.quantity).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-800 mt-4 pt-3 space-y-1.5 text-xs font-mono text-zinc-400">
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
                    <span>{shipping === 0 ? <strong className="text-lime-400">GRÁTIS</strong> : `R$ ${shipping.toFixed(2).replace('.', ',')}`}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-white font-sans pt-2 border-t border-zinc-800">
                    <span>TOTAL:</span>
                    <span className="text-lime-400 font-mono text-lg">
                      R$ {total.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  className="btn-primary w-full py-3.5 text-xs font-extrabold rounded-xl shadow-lg shadow-lime-400/20 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>CONFIRMAR E PAGAR</span>
                </button>
                <p className="text-[10px] text-center text-zinc-500">
                  Ambiente Seguro • Satisfação Garantida ou seu dinheiro de volta.
                </p>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
