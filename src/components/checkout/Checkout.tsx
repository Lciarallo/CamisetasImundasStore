import { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Barcode,
  Check,
  CreditCard,
  Hammer,
  LoaderCircle,
  Lock,
  QrCode,
  Truck,
} from 'lucide-react';
import type { Customer, Order, OrderLine, PaymentMethod, ShippingAddress } from '../../types';
import {
  isValidCEP,
  isValidCPF,
  isValidEmail,
  isValidPhone,
  maskCEP,
  maskCPF,
  maskPhone,
  money,
  onlyDigits,
} from '../../lib/format';
import { BRAND_LABEL, buildInstallments, cardLast4, detectBrand } from '../../lib/card';
import { INSANAS_PIX, buildPixPayload } from '../../lib/pix';
import { useStore } from '../../store/StoreContext';
import { SkullMark } from '../art/Sigils';
import { BrandLogo } from '../art/BrandLogo';
import { TeeImage } from '../art/TeeImage';
import { CardForm, EMPTY_CARD, validateCard, type CardState } from './CardForm';
import { PIX_DISCOUNT, PixPanel } from './PixPanel';

type Step = 'identificacao' | 'entrega' | 'pagamento' | 'confirmado';

const STEPS: { key: Step; label: string }[] = [
  { key: 'identificacao', label: 'Identificação' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'pagamento', label: 'Pagamento' },
];

const EMPTY_CUSTOMER: Customer = { name: '', email: '', cpf: '', phone: '' };
const EMPTY_ADDRESS: ShippingAddress = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
};

export function Checkout({ onBack }: { onBack: () => void }) {
  const { cart, cartTotals, productById, placeOrder, clearCart, appliedCoupon } = useStore();

  const [step, setStep] = useState<Step>('identificacao');
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [card, setCard] = useState<CardState>(EMPTY_CARD);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepLoading, setCepLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Corpo de bloco de propósito: com corpo de expressão o efeito devolveria o
  // retorno de scrollTo, e o React tentaria chamá-lo como função de limpeza.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // PIX à vista sai mais barato; cartão e boleto pagam o total cheio.
  const pixTotal = cartTotals.total * (1 - PIX_DISCOUNT);
  const payableTotal = method === 'pix' ? pixTotal : cartTotals.total;

  const installmentOptions = useMemo(
    () => buildInstallments(cartTotals.total),
    [cartTotals.total],
  );
  const chosenInstallment =
    installmentOptions.find((option) => option.count === card.installments) ??
    installmentOptions[0];

  const chargedTotal =
    method === 'cartao' ? (chosenInstallment?.total ?? cartTotals.total) : payableTotal;

  const pixPayload = useMemo(
    () =>
      buildPixPayload({
        ...INSANAS_PIX,
        amount: Number(pixTotal.toFixed(2)),
        txId: `INSANA${Math.floor(cartTotals.total * 100)}`,
        description: 'Pedido Camisetas Insanas',
      }),
    [pixTotal, cartTotals.total],
  );

  /* ---------------------------------------------------------------------- */
  /* Validação por etapa                                                    */
  /* ---------------------------------------------------------------------- */

  const validateIdentificacao = () => {
    const found: Record<string, string> = {};
    if (customer.name.trim().split(' ').filter(Boolean).length < 2) {
      found.name = 'Informe nome e sobrenome.';
    }
    if (!isValidEmail(customer.email)) found.email = 'E-mail inválido.';
    if (!isValidCPF(customer.cpf)) found.cpf = 'CPF inválido.';
    if (!isValidPhone(customer.phone)) found.phone = 'Telefone inválido com DDD.';
    return found;
  };

  const validateEntrega = () => {
    const found: Record<string, string> = {};
    if (!isValidCEP(address.cep)) found.cep = 'CEP deve ter 8 dígitos.';
    if (address.street.trim().length < 3) found.street = 'Informe a rua.';
    if (!address.number.trim()) found.number = 'Informe o número.';
    if (address.district.trim().length < 2) found.district = 'Informe o bairro.';
    if (address.city.trim().length < 2) found.city = 'Informe a cidade.';
    if (address.state.trim().length !== 2) found.state = 'UF com 2 letras.';
    return found;
  };

  const advance = () => {
    const found =
      step === 'identificacao'
        ? validateIdentificacao()
        : step === 'entrega'
          ? validateEntrega()
          : {};

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStep(step === 'identificacao' ? 'entrega' : 'pagamento');
  };

  /* ---------------------------------------------------------------------- */
  /* Busca de CEP                                                           */
  /* ---------------------------------------------------------------------- */

  const lookupCep = useCallback(async (cep: string) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) return;

      setAddress((previous) => ({
        ...previous,
        street: data.logradouro || previous.street,
        district: data.bairro || previous.district,
        city: data.localidade || previous.city,
        state: data.uf || previous.state,
      }));
    } catch {
      // Offline ou ViaCEP fora do ar: o usuário preenche à mão, sem travar.
    } finally {
      setCepLoading(false);
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Fechamento do pedido                                                   */
  /* ---------------------------------------------------------------------- */

  const finish = async () => {
    if (method === 'cartao') {
      const cardErrors = validateCard(card);
      if (Object.keys(cardErrors).length > 0) {
        setErrors(cardErrors as Record<string, string>);
        return;
      }
    }
    setErrors({});
    setProcessing(true);

    // Latência simulada — o gateway real levaria mais ou menos isso.
    await new Promise((resolve) => window.setTimeout(resolve, 1400));

    const lines: OrderLine[] = cart.flatMap((item) => {
      const product = productById(item.productId);
      if (!product) return [];
      return [
        {
          productId: product.id,
          name: product.name,
          band: product.band,
          art: product.art,
          photo: product.photos[0],
          size: item.size,
          quantity: item.quantity,
          unitPrice: product.price,
          fulfillment: product.fulfillment,
          productionDays: product.productionDays,
        },
      ];
    });

    const order = placeOrder({
      // PIX e boleto só viram "pago" quando compensam; cartão aprova na hora.
      status: method === 'cartao' ? 'pago' : 'aguardando-pagamento',
      customer,
      address,
      lines,
      subtotal: cartTotals.subtotal,
      discount:
        cartTotals.discount + (method === 'pix' ? cartTotals.total * PIX_DISCOUNT : 0),
      shipping: cartTotals.shipping,
      total: chargedTotal,
      payment: {
        method,
        installments: method === 'cartao' ? card.installments : 1,
        cardLast4: method === 'cartao' ? cardLast4(card.number) : undefined,
        cardBrand: method === 'cartao' ? BRAND_LABEL[detectBrand(card.number)] : undefined,
        pixCode: method === 'pix' ? pixPayload : undefined,
      },
      coupon: appliedCoupon?.code,
    });

    setPlacedOrder(order);
    setProcessing(false);
    setStep('confirmado');
    clearCart();

    // Cinzas caindo, não confete colorido — o tom da loja não comporta festa.
    confetti({
      particleCount: 90,
      spread: 120,
      startVelocity: 18,
      gravity: 0.7,
      ticks: 260,
      scalar: 0.75,
      origin: { y: 0 },
      colors: ['#a5121b', '#4a4a52', '#8b8578', '#1f1f26'],
      shapes: ['square'],
      disableForReducedMotion: true,
    });
  };

  /* ---------------------------------------------------------------------- */

  if (step === 'confirmado' && placedOrder) {
    return <OrderConfirmation order={placedOrder} onBack={onBack} />;
  }

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <SkullMark className="h-20 w-20 text-iron" />
        <h1 className="font-logo text-3xl text-bone">Sacola vazia</h1>
        <p className="max-w-sm text-sm text-grave">
          Não há nada para finalizar. Volte ao acervo e escolha sua peça.
        </p>
        <button onClick={onBack} className="btn btn-blood">
          Voltar ao catálogo
        </button>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-smoke bg-pitch">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 md:px-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[0.7rem] text-grave hover:text-bone"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <div className="mx-auto text-bone">
            <BrandLogo height={58} />
          </div>
          <span className="flex items-center gap-1.5 text-[0.65rem] text-grave">
            <Lock className="h-3 w-3 text-blood-bright" />
            <span className="hidden sm:inline">Ambiente seguro</span>
          </span>
        </div>
      </header>

      {/* Trilha de etapas */}
      <nav aria-label="Etapas do checkout" className="border-b border-smoke bg-crypt">
        <ol className="mx-auto flex max-w-6xl px-4 md:px-8">
          {STEPS.map((item, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <li key={item.key} className="flex flex-1 items-center gap-2 py-4">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border font-display text-[0.65rem] font-bold ${
                    done
                      ? 'border-blood bg-blood text-bone'
                      : active
                        ? 'border-blood text-blood-bright'
                        : 'border-iron text-dust'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={`heading-carved text-[0.58rem] ${
                    active ? 'text-bone' : done ? 'text-parchment' : 'text-dust'
                  }`}
                >
                  {item.label}
                </span>
                {index < STEPS.length - 1 && (
                  <span
                    className={`ml-2 hidden h-px flex-1 sm:block ${done ? 'bg-blood' : 'bg-smoke'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:px-8 lg:grid-cols-[1fr_360px]">
        {/* Coluna do formulário */}
        <div className="space-y-6">
          {step === 'identificacao' && (
            <Section title="Quem está comprando" step="01">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label text="Nome completo" error={errors.name} />
                  <input
                    autoComplete="name"
                    value={customer.name}
                    onChange={(event) =>
                      setCustomer({ ...customer, name: event.target.value })
                    }
                    aria-invalid={Boolean(errors.name)}
                    className="field"
                    placeholder="Como no documento"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label text="E-mail" error={errors.email} />
                  <input
                    type="email"
                    autoComplete="email"
                    value={customer.email}
                    onChange={(event) =>
                      setCustomer({ ...customer, email: event.target.value })
                    }
                    aria-invalid={Boolean(errors.email)}
                    className="field"
                    placeholder="voce@email.com"
                  />
                  <p className="mt-1 text-[0.65rem] text-grave">
                    É para lá que vai o código de rastreio.
                  </p>
                </div>
                <div>
                  <Label text="CPF" error={errors.cpf} />
                  <input
                    inputMode="numeric"
                    value={maskCPF(customer.cpf)}
                    onChange={(event) =>
                      setCustomer({ ...customer, cpf: event.target.value })
                    }
                    aria-invalid={Boolean(errors.cpf)}
                    className="field tabular-nums"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label text="Celular" error={errors.phone} />
                  <input
                    inputMode="tel"
                    autoComplete="tel"
                    value={maskPhone(customer.phone)}
                    onChange={(event) =>
                      setCustomer({ ...customer, phone: event.target.value })
                    }
                    aria-invalid={Boolean(errors.phone)}
                    className="field tabular-nums"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <button onClick={advance} className="btn btn-blood mt-6 w-full sm:w-auto">
                Continuar para entrega
              </button>
            </Section>
          )}

          {step === 'entrega' && (
            <Section title="Para onde enviamos" step="02">
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Label text="CEP" error={errors.cep} />
                  <div className="relative">
                    <input
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={maskCEP(address.cep)}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAddress({ ...address, cep: value });
                        if (onlyDigits(value).length === 8) void lookupCep(value);
                      }}
                      aria-invalid={Boolean(errors.cep)}
                      className="field tabular-nums"
                      placeholder="00000-000"
                    />
                    {cepLoading && (
                      <LoaderCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-blood-bright" />
                    )}
                  </div>
                  <p className="mt-1 text-[0.65rem] text-grave">Preenchemos o resto sozinhos.</p>
                </div>

                <div className="sm:col-span-4">
                  <Label text="Rua" error={errors.street} />
                  <input
                    autoComplete="address-line1"
                    value={address.street}
                    onChange={(event) => setAddress({ ...address, street: event.target.value })}
                    aria-invalid={Boolean(errors.street)}
                    className="field"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label text="Número" error={errors.number} />
                  <input
                    value={address.number}
                    onChange={(event) => setAddress({ ...address, number: event.target.value })}
                    aria-invalid={Boolean(errors.number)}
                    className="field"
                  />
                </div>
                <div className="sm:col-span-4">
                  <Label text="Complemento (opcional)" />
                  <input
                    value={address.complement}
                    onChange={(event) =>
                      setAddress({ ...address, complement: event.target.value })
                    }
                    className="field"
                    placeholder="Apto, bloco, referência"
                  />
                </div>

                <div className="sm:col-span-3">
                  <Label text="Bairro" error={errors.district} />
                  <input
                    value={address.district}
                    onChange={(event) =>
                      setAddress({ ...address, district: event.target.value })
                    }
                    aria-invalid={Boolean(errors.district)}
                    className="field"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label text="Cidade" error={errors.city} />
                  <input
                    value={address.city}
                    onChange={(event) => setAddress({ ...address, city: event.target.value })}
                    aria-invalid={Boolean(errors.city)}
                    className="field"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Label text="UF" error={errors.state} />
                  <input
                    maxLength={2}
                    value={address.state}
                    onChange={(event) =>
                      setAddress({ ...address, state: event.target.value.toUpperCase() })
                    }
                    aria-invalid={Boolean(errors.state)}
                    className="field uppercase"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-start gap-3 border border-smoke bg-pitch p-4">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
                <div className="text-[0.72rem] text-parchment">
                  <p className="font-semibold text-bone">
                    {cartTotals.shipping === 0 ? 'Frete grátis' : `Frete ${money(cartTotals.shipping)}`}
                  </p>
                  <p className="mt-0.5 text-grave">
                    {cartTotals.productionDays > 0
                      ? `Entrega em até ${cartTotals.productionDays + 7} dias úteis (inclui produção das peças sob encomenda).`
                      : 'Entrega em 3 a 9 dias úteis após a confirmação do pagamento.'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setStep('identificacao')}
                  className="btn btn-ghost order-2 sm:order-1"
                >
                  Voltar
                </button>
                <button onClick={advance} className="btn btn-blood order-1 flex-1 sm:order-2">
                  Continuar para pagamento
                </button>
              </div>
            </Section>
          )}

          {step === 'pagamento' && (
            <Section title="Como você prefere pagar" step="03">
              {/* Escolha do método */}
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { key: 'pix', icon: QrCode, label: 'PIX', hint: '5% de desconto' },
                    { key: 'cartao', icon: CreditCard, label: 'Cartão', hint: 'até 12x' },
                    { key: 'boleto', icon: Barcode, label: 'Boleto', hint: '2 dias úteis' },
                  ] as const
                ).map(({ key, icon: Icon, label, hint }) => {
                  const active = method === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setMethod(key);
                        setErrors({});
                      }}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 border p-4 transition-colors ${
                        active
                          ? 'border-blood bg-blood/10 text-bone'
                          : 'border-iron text-grave hover:border-blood/50 hover:text-parchment'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${active ? 'text-blood-bright' : ''}`} />
                      <span className="heading-carved text-[0.6rem]">{label}</span>
                      <span className="text-[0.6rem] text-grave">{hint}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                {method === 'pix' && <PixPanel payload={pixPayload} amount={pixTotal} />}

                {method === 'cartao' && (
                  <CardForm
                    card={card}
                    onChange={setCard}
                    errors={errors}
                    total={cartTotals.total}
                  />
                )}

                {method === 'boleto' && (
                  <div className="space-y-3 border border-smoke bg-pitch p-5">
                    <Barcode className="h-8 w-8 text-blood-bright" />
                    <p className="font-display text-lg font-bold text-bone tabular-nums">
                      {money(cartTotals.total)}
                    </p>
                    <p className="text-[0.72rem] leading-relaxed text-parchment">
                      O boleto é gerado ao confirmar o pedido e vence em 2 dias úteis.
                      A compensação bancária leva até 3 dias úteis — só depois disso a
                      peça entra em separação ou produção.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setStep('entrega')}
                  disabled={processing}
                  className="btn btn-ghost order-2 sm:order-1"
                >
                  Voltar
                </button>
                <button
                  onClick={finish}
                  disabled={processing}
                  className="btn btn-blood order-1 flex-1 sm:order-2"
                >
                  {processing ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Processando
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Confirmar pedido · {money(chargedTotal)}
                    </>
                  )}
                </button>
              </div>
            </Section>
          )}
        </div>

        {/* Resumo fixo */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="panel">
            <h2 className="heading-carved border-b border-smoke px-5 py-3.5 text-[0.62rem] text-bone">
              Resumo do pedido
            </h2>

            <ul className="max-h-64 divide-y divide-smoke overflow-y-auto">
              {cart.map((item) => {
                const product = productById(item.productId);
                if (!product) return null;
                return (
                  <li key={`${item.productId}-${item.size}`} className="flex gap-3 p-4">
                    <div className="w-12 shrink-0 bg-pitch">
                      <TeeImage
                        art={product.art}
                        band={product.band}
                        photo={product.photos[0]}
                        showBandName={false}
                        className="w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.72rem] font-semibold text-bone">
                        {product.name}
                      </p>
                      <p className="text-[0.62rem] text-grave">
                        {item.size} · {item.quantity}un
                      </p>
                      {item.fulfillment === 'sob-encomenda' && (
                        <p className="mt-0.5 flex items-center gap-1 text-[0.6rem] text-blood-bright">
                          <Hammer className="h-2.5 w-2.5" />
                          {product.productionDays} dias de produção
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-display text-[0.72rem] font-bold text-parchment tabular-nums">
                      {money(product.price * item.quantity)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <dl className="space-y-1.5 border-t border-smoke p-5 text-[0.72rem]">
              <div className="flex justify-between text-grave">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{money(cartTotals.subtotal)}</dd>
              </div>
              {cartTotals.discount > 0 && (
                <div className="flex justify-between text-blood-bright">
                  <dt>Cupom {appliedCoupon?.code}</dt>
                  <dd className="tabular-nums">−{money(cartTotals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-grave">
                <dt>Frete</dt>
                <dd className="tabular-nums">
                  {cartTotals.shipping === 0 ? 'Grátis' : money(cartTotals.shipping)}
                </dd>
              </div>
              {method === 'pix' && (
                <div className="flex justify-between text-blood-bright">
                  <dt>Desconto PIX</dt>
                  <dd className="tabular-nums">
                    −{money(cartTotals.total * PIX_DISCOUNT)}
                  </dd>
                </div>
              )}
              {method === 'cartao' && chosenInstallment && !chosenInstallment.interestFree && (
                <div className="flex justify-between text-grave">
                  <dt>Juros do parcelamento</dt>
                  <dd className="tabular-nums">
                    +{money(chosenInstallment.total - cartTotals.total)}
                  </dd>
                </div>
              )}

              <div className="flex items-baseline justify-between border-t border-smoke pt-3 text-bone">
                <dt className="heading-carved text-[0.62rem]">Total</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">
                  {money(chargedTotal)}
                </dd>
              </div>
              {method === 'cartao' && chosenInstallment && (
                <p className="text-right text-[0.65rem] text-grave tabular-nums">
                  {chosenInstallment.count}x de {money(chosenInstallment.installmentValue)}
                  {chosenInstallment.interestFree ? ' sem juros' : ''}
                </p>
              )}
            </dl>
          </div>

          <p className="mt-3 flex items-start gap-2 text-[0.62rem] leading-relaxed text-dust">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            Loja fictícia para demonstração. Nenhuma cobrança real é feita e nenhum
            dado sai do seu navegador.
          </p>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Section({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel anim-rise p-5 sm:p-7">
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-display text-2xl font-bold text-iron tabular-nums">{step}</span>
        <h2 className="font-display text-lg font-bold text-bone">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Label({ text, error }: { text: string; error?: string }) {
  return (
    <span className="label flex items-baseline justify-between gap-2">
      {text}
      {error && <span className="text-[0.6rem] normal-case text-ember">{error}</span>}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

function OrderConfirmation({ order, onBack }: { order: Order; onBack: () => void }) {
  const madeToOrder = order.lines.filter((line) => line.fulfillment === 'sob-encomenda');
  const maxProduction = madeToOrder.reduce(
    (max, line) => Math.max(max, line.productionDays ?? 0),
    0,
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="panel-raised anim-rise p-8 text-center">
          <SkullMark className="mx-auto h-16 w-16 text-blood-bright" />

          <h1 className="mt-5 font-logo text-3xl text-bone">Pedido selado</h1>
          <p className="mt-2 text-sm text-parchment">
            {order.payment.method === 'pix'
              ? 'Assim que o PIX compensar, sua peça entra em separação.'
              : order.payment.method === 'boleto'
                ? 'Enviamos o boleto para o seu e-mail. Vence em 2 dias úteis.'
                : 'Pagamento aprovado. Sua peça já entrou na fila.'}
          </p>

          <div className="mt-6 border border-smoke bg-pitch p-4">
            <p className="heading-carved text-[0.58rem] text-grave">Número do pedido</p>
            <p className="font-display text-2xl font-bold text-bone tabular-nums">{order.id}</p>
          </div>

          <dl className="mt-5 space-y-2 border-t border-smoke pt-5 text-left text-[0.72rem]">
            <Row label="Total pago" value={money(order.total)} strong />
            <Row
              label="Pagamento"
              value={
                order.payment.method === 'cartao'
                  ? `${order.payment.cardBrand} ···· ${order.payment.cardLast4} · ${order.payment.installments}x`
                  : order.payment.method === 'pix'
                    ? 'PIX à vista'
                    : 'Boleto bancário'
              }
            />
            <Row
              label="Entrega"
              value={`${order.address.city}/${order.address.state} · CEP ${order.address.cep}`}
            />
            <Row label="Confirmação" value={order.customer.email} />
          </dl>

          {maxProduction > 0 && (
            <div className="mt-5 flex items-start gap-2.5 border border-blood/40 bg-blood/10 p-3.5 text-left">
              <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
              <p className="text-[0.7rem] leading-relaxed text-parchment">
                <strong className="text-bone">
                  {madeToOrder.length} {madeToOrder.length === 1 ? 'peça' : 'peças'} sob encomenda.
                </strong>{' '}
                A produção leva até {maxProduction} dias úteis. O pedido inteiro é despachado
                junto, quando a última peça ficar pronta.
              </p>
            </div>
          )}

          <button onClick={onBack} className="btn btn-blood mt-7 w-full">
            Voltar ao acervo
          </button>
        </div>

        <p className="mt-4 text-center text-[0.65rem] text-dust">
          Acompanhe o pedido no painel administrativo, em Pedidos → {order.id}.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-grave">{label}</dt>
      <dd
        className={`text-right tabular-nums ${strong ? 'font-display font-bold text-bone' : 'text-parchment'}`}
      >
        {value}
      </dd>
    </div>
  );
}
