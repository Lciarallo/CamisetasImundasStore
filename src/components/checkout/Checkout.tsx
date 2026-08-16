import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Check,
  Hammer,
  LoaderCircle,
  Lock,
  MapPin,
  Pencil,
  QrCode,
  SearchX,
  Truck,
  WifiOff,
} from 'lucide-react';
import type { Customer, Order, ShippingAddress } from '../../types';
import {
  isValidCEP,
  isValidCPF,
  isValidEmail,
  isValidPhone,
  isValidUF,
  maskCEP,
  maskCPF,
  maskPhone,
  money,
  onlyDigits,
} from '../../lib/format';
import {
  checkoutIdempotencyKey,
  clearCheckoutAttempt,
  saveCustomerOrderAccess,
} from '../../lib/customerOrders';
import { fetchCep } from '../../lib/cep';
import { useStore } from '../../store/StoreContext';
import { SkullMark } from '../art/Sigils';
import { BrandLogo } from '../art/BrandLogo';
import { TeeImage } from '../art/TeeImage';
import { PIX_DISCOUNT, InfinitePayPanel } from './InfinitePayPanel';

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
  const { cart, cartTotals, productById, placeOrder, clearCart, appliedCoupon, mode } =
    useStore();

  const [step, setStep] = useState<Step>('identificacao');
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [idempotencyKey] = useState(() => {
    const fingerprint = JSON.stringify({
      coupon: appliedCoupon?.code ?? null,
      items: cart
        .map(({ productId, size, quantity }) => ({ productId, size, quantity }))
        .sort((a, b) => `${a.productId}|${a.size}`.localeCompare(`${b.productId}|${b.size}`)),
    });
    return checkoutIdempotencyKey(fingerprint);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  /*
    A entrega é dirigida pelo CEP: enquanto ele não resolve, não há endereço
    para mostrar nem para corrigir. `cepState` é o que decide a tela inteira.
    - buscando  → só o campo de CEP, com carregando
    - resolvido → resumo do que os Correios sabem + número e complemento
    - sem-rua   → CEP único de cidade pequena; rua e bairro entram na mão
    - inexistente / indisponível → dois problemas diferentes, duas mensagens
  */
  type CepState = 'vazio' | 'buscando' | 'resolvido' | 'sem-rua' | 'inexistente' | 'indisponivel';
  const [cepState, setCepState] = useState<CepState>('vazio');
  /** Aberto quando o visitante quer corrigir o que veio dos Correios. */
  const [editingAddress, setEditingAddress] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const streetInputRef = useRef<HTMLInputElement>(null);
  /** Cancela a consulta anterior quando o CEP muda no meio do caminho. */
  const cepRequestRef = useRef<AbortController | null>(null);

  // Corpo de bloco de propósito: com corpo de expressão o efeito devolveria o
  // retorno de scrollTo, e o React tentaria chamá-lo como função de limpeza.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Estimativa para o resumo. O valor definitivo sempre volta do servidor.
  const pixTotal =
    cartTotals.total <= 1.0
      ? cartTotals.total
      : cartTotals.total * (1 - PIX_DISCOUNT);

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
    if (!isValidUF(address.state)) found.state = 'UF inválida (ex: SP, RJ, MG).';
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
    if (Object.keys(found).length > 0) {
      // Erro em campo que o cartão do CEP mantém recolhido só é corrigível se
      // a edição abrir junto — senão a mensagem aponta para algo invisível.
      if (['street', 'district', 'city', 'state'].some((field) => field in found)) {
        setEditingAddress(true);
      }
      return;
    }

    setStep(step === 'identificacao' ? 'entrega' : 'pagamento');
  };

  /* ---------------------------------------------------------------------- */
  /* Busca de CEP (ViaCEP / Correios)                                       */
  /* ---------------------------------------------------------------------- */

  const clearCepError = () =>
    setErrors((previous) => {
      const next = { ...previous };
      delete next.cep;
      return next;
    });

  const lookupCep = useCallback(async (cep: string) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;

    // Digitar um CEP novo antes de o anterior responder é comum. Sem abortar,
    // a resposta atrasada sobrescreveria o endereço certo pelo antigo.
    cepRequestRef.current?.abort();
    const controller = new AbortController();
    cepRequestRef.current = controller;

    setCepState('buscando');
    setEditingAddress(false);
    clearCepError();
    // Limpa o que veio do CEP anterior. Sem isso, trocar um CEP válido por
    // outro que falhe deixaria o endereço antigo na tela — e ele seguiria
    // para o pedido travestido de endereço novo.
    setAddress((previous) => ({ ...previous, street: '', district: '', city: '', state: '' }));

    let result;
    try {
      result = await fetchCep(digits, controller.signal);
    } catch {
      return; // Abortada por um CEP mais novo: quem venceu cuida da tela.
    }
    if (controller.signal.aborted) return;

    if (result.status === 'not-found') {
      setCepState('inexistente');
      return;
    }
    if (result.status === 'unavailable') {
      setCepState('indisponivel');
      return;
    }

    const { street, district, city, state, generic } = result.address;
    setAddress((previous) => ({ ...previous, street, district, city, state }));
    setCepState(generic ? 'sem-rua' : 'resolvido');
  }, []);

  /** Troca de CEP invalida tudo que veio dele — nada de endereço meio antigo. */
  const changeCep = (value: string) => {
    const digits = onlyDigits(value);
    setAddress((previous) => ({
      ...previous,
      cep: value,
      ...(digits.length < 8
        ? { street: '', district: '', city: '', state: '' }
        : {}),
    }));
    if (digits.length === 8) {
      void lookupCep(value);
      return;
    }
    cepRequestRef.current?.abort();
    setCepState('vazio');
    setEditingAddress(false);
    clearCepError();
  };

  /** Correios fora do ar ou CEP fora da base: o endereço vai todo na mão. */
  const fillByHand = () => {
    setCepState('sem-rua');
    setEditingAddress(true);
    clearCepError();
  };

  // O único campo que sobra depois de o CEP resolver é o número — então é
  // nele que o cursor deve cair, sem o visitante ter que procurar.
  useEffect(() => {
    if (cepState === 'resolvido') numberInputRef.current?.focus();
    if (cepState === 'sem-rua') streetInputRef.current?.focus();
  }, [cepState]);

  // Uma consulta em voo não pode chamar setState depois de a tela sair.
  useEffect(() => () => cepRequestRef.current?.abort(), []);

  /* ---------------------------------------------------------------------- */
  /* Fechamento do pedido                                                   */
  /* ---------------------------------------------------------------------- */

  const finish = async () => {
    setErrors({});
    setProcessing(true);

    // O cliente manda só o que quer comprar e para onde enviar. Preço,
    // desconto, frete, juros e total voltam recalculados do servidor — é o
    // que impede um pedido forjado com total zerado.
    let order: Order;
    try {
      order = await placeOrder({
        idempotencyKey,
        customer,
        address,
        payment: { method: 'pix' },
        coupon: appliedCoupon?.code,
      });
    } catch (cause) {
      // Cenário real agora: entre escolher e pagar, a última peça pode ter
      // sido vendida. O servidor recusa e a mensagem dele é a que importa.
      setProcessing(false);
      setErrors({
        pagamento:
          cause instanceof Error ? cause.message : 'Não foi possível fechar o pedido.',
      });
      return;
    }

    setPlacedOrder(order);
    if (order.customerAccessToken) {
      saveCustomerOrderAccess({ id: order.id, token: order.customerAccessToken });
    }
    clearCheckoutAttempt(idempotencyKey);
    setStep('confirmado');
    clearCart();

    if (order.payment?.checkoutUrl) {
      window.location.assign(order.payment.checkoutUrl);
      return;
    }

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
    return <OrderConfirmation order={placedOrder} mode={mode} onBack={onBack} />;
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
              {/*
                O CEP vem sozinho e primeiro. Mostrar sete campos vazios de
                uma vez faz o visitante digitar o que os Correios já sabem —
                e cada campo a mais é uma chance a mais de errar o endereço.
              */}
              <div className="max-w-[13rem]">
                <Label text="CEP" error={errors.cep} />
                <div className="relative">
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={maskCEP(address.cep)}
                    onChange={(event) => changeCep(event.target.value)}
                    aria-invalid={Boolean(errors.cep)}
                    aria-describedby="cep-ajuda"
                    className="field text-lg tabular-nums tracking-wider"
                    placeholder="00000-000"
                  />
                  {cepState === 'buscando' && (
                    <LoaderCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-blood-bright" />
                  )}
                  {(cepState === 'resolvido' || cepState === 'sem-rua') && !editingAddress && (
                    <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-blood-bright" />
                  )}
                </div>
                <p id="cep-ajuda" className="mt-1.5 text-[0.65rem] leading-relaxed text-grave">
                  {cepState === 'buscando' ? (
                    'Consultando os Correios...'
                  ) : (
                    <>
                      Buscamos o endereço para você.{' '}
                      <a
                        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blood-bright underline underline-offset-2 hover:text-bone"
                      >
                        Não sei meu CEP
                      </a>
                    </>
                  )}
                </p>
              </div>

              {/*
                CEP inexistente e Correios fora do ar são problemas diferentes:
                num o número está errado, no outro está certo e a culpa é nossa.
                Tratar os dois com a mesma frase manda o visitante corrigir algo
                que não tem defeito. Os dois, porém, têm a mesma saída.
              */}
              {(cepState === 'inexistente' || cepState === 'indisponivel') && (
                <div className="mt-4 flex flex-col gap-3 border border-blood/50 bg-blood/10 p-4 sm:flex-row sm:items-center">
                  {cepState === 'inexistente' ? (
                    <SearchX className="h-5 w-5 shrink-0 text-blood-bright" />
                  ) : (
                    <WifiOff className="h-5 w-5 shrink-0 text-blood-bright" />
                  )}
                  <p className="flex-1 text-[0.72rem] leading-relaxed text-parchment">
                    {cepState === 'inexistente'
                      ? 'Não achamos esse CEP na base dos Correios. Confira os oito dígitos — ou escreva o endereço você mesmo.'
                      : 'A consulta de CEP não respondeu agora. Seu CEP pode estar certo: escreva o endereço e siga em frente.'}
                  </p>
                  <button
                    type="button"
                    onClick={fillByHand}
                    className="btn btn-ghost shrink-0 text-[0.65rem]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Preencher à mão
                  </button>
                </div>
              )}

              {/* Endereço resolvido: confirmação legível, não seis caixas de texto. */}
              {cepState === 'resolvido' && !editingAddress && (
                <div className="mt-4 flex items-start gap-3 border border-smoke bg-pitch p-4">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
                  <div className="min-w-0 flex-1 text-[0.75rem] leading-relaxed">
                    <p className="font-semibold text-bone">{address.street}</p>
                    <p className="text-grave">
                      {address.district && `${address.district} · `}
                      {address.city}/{address.state} · CEP {maskCEP(address.cep)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingAddress(true)}
                    className="flex shrink-0 items-center gap-1 text-[0.65rem] text-grave hover:text-blood-bright"
                  >
                    <Pencil className="h-3 w-3" />
                    Corrigir
                  </button>
                </div>
              )}

              {/*
                Aberto quando o CEP é o único da cidade (os Correios não têm rua
                para ele), quando o visitante pediu para corrigir, ou quando a
                consulta falhou. Nos três casos ele digita o que faltou.
              */}
              {(cepState === 'sem-rua' || editingAddress) && (
                <div className="mt-4 grid gap-4 sm:grid-cols-6">
                  {cepState === 'sem-rua' && !editingAddress && (
                    <p className="sm:col-span-6 text-[0.7rem] leading-relaxed text-grave">
                      Este CEP atende a cidade inteira, então os Correios não
                      devolvem a rua. Complete abaixo.
                    </p>
                  )}
                  <div className="sm:col-span-6">
                    <Label text="Rua" error={errors.street} />
                    <input
                      ref={streetInputRef}
                      autoComplete="address-line1"
                      value={address.street}
                      onChange={(event) => setAddress({ ...address, street: event.target.value })}
                      aria-invalid={Boolean(errors.street)}
                      className="field"
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
              )}

              {/* Número e complemento: o que nenhum CEP sabe. */}
              {cepState !== 'vazio' && cepState !== 'buscando' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <Label text="Número" error={errors.number} />
                    <input
                      ref={numberInputRef}
                      inputMode="numeric"
                      autoComplete="address-line2"
                      value={address.number}
                      onChange={(event) => setAddress({ ...address, number: event.target.value })}
                      aria-invalid={Boolean(errors.number)}
                      className="field"
                      placeholder="123"
                    />
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-[0.65rem] text-grave">
                      <input
                        type="checkbox"
                        checked={address.number.trim().toUpperCase() === 'S/N'}
                        onChange={(event) =>
                          setAddress({ ...address, number: event.target.checked ? 'S/N' : '' })
                        }
                        className="h-3 w-3 accent-[var(--color-blood)]"
                      />
                      Sem número
                    </label>
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
                </div>
              )}

              <div className="mt-5 flex items-start gap-3 border border-smoke bg-pitch p-4">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-blood-bright" />
                <div className="text-[0.72rem] text-parchment">
                  <p className="font-semibold text-bone">
                    {cartTotals.shipping === 0 ? 'Frete grátis' : `Frete ${money(cartTotals.shipping)}`}
                    {address.city && address.state && ` · Correios para ${address.city}/${address.state}`}
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
                {/* Sem CEP resolvido não há endereço nenhum para validar. */}
                <button
                  onClick={advance}
                  disabled={cepState === 'vazio' || cepState === 'buscando'}
                  className="btn btn-blood order-1 flex-1 sm:order-2"
                >
                  Continuar para pagamento
                </button>
              </div>
            </Section>
          )}

          {step === 'pagamento' && (
            <Section title="Pagamento por PIX" step="03">
              {/*
                Método único: a loja cobra só por PIX. Uma grade de opções com
                dois cartões desabilitados anunciaria uma escolha que não existe.
              */}
              <div className="flex items-center justify-between gap-4 border border-blood bg-blood/10 p-4 text-bone">
                <span className="flex items-center gap-2.5">
                  <QrCode className="h-5 w-5 shrink-0 text-blood-bright" />
                  <span className="heading-carved text-[0.62rem]">PIX à vista</span>
                </span>
                <span className="text-[0.65rem] text-parchment">5% de desconto já aplicado</span>
              </div>

              <div className="mt-6">
                <div className="flex items-start gap-4 border border-smoke bg-pitch p-5">
                  <QrCode className="h-8 w-8 shrink-0 text-blood-bright" />
                  <div>
                    <p className="font-display text-lg font-bold text-bone">
                      O PIX será gerado depois da criação do pedido
                    </p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-parchment">
                      Ao continuar, o servidor reserva um identificador exclusivo e devolve o
                      QR Code vinculado ao valor definitivo do seu pedido.
                    </p>
                  </div>
                </div>

                {errors.pagamento && (
                  <div className="mt-4 border border-blood bg-blood/10 p-4 text-xs text-blood-bright">
                    <p className="font-bold">Aviso:</p>
                    <p className="mt-0.5">{errors.pagamento}</p>
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
                      Criando pedido...
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Criar pedido e gerar PIX · {money(pixTotal)}
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
              <div className="flex justify-between text-blood-bright">
                <dt>Desconto PIX</dt>
                <dd className="tabular-nums">
                  −{money(cartTotals.total - pixTotal)}
                </dd>
              </div>

              <div className="flex items-baseline justify-between border-t border-smoke pt-3 text-bone">
                <dt className="heading-carved text-[0.62rem]">Total</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">
                  {money(pixTotal)}
                </dd>
              </div>
            </dl>
          </div>

          {/*
            Com backend, os dados saem mesmo do navegador — dizer o contrário
            aqui seria falso justamente na tela em que o visitante digita CPF e
            endereço.
          */}
          <p className="mt-3 flex items-start gap-2 text-[0.62rem] leading-relaxed text-dust">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            {mode === 'firebase'
              ? 'Seus dados são enviados ao servidor para registrar o pedido. A cobrança PIX só é exibida depois que o pedido existe.'
              : 'Modo de demonstração: nenhum dado sai do navegador e nenhuma cobrança PIX é gerada.'}
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

function OrderConfirmation({
  order,
  mode,
  onBack,
}: {
  order: Order;
  mode: 'local' | 'firebase';
  onBack: () => void;
}) {
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

          <h1 className="mt-5 font-logo text-3xl text-bone">Pedido criado</h1>
          <p className="mt-2 text-sm text-parchment">
            {order.payment.checkoutUrl || order.payment.pixCode
              ? 'Finalize o pagamento seguro via InfinitePay. Assim que o PIX compensar, sua peça entra em separação.'
              : 'Seu pedido foi registrado, mas nenhuma cobrança foi gerada.'}
          </p>

          <div className="mt-6 border border-smoke bg-pitch p-4">
            <p className="heading-carved text-[0.58rem] text-grave">Número do pedido</p>
            <p className="font-display text-2xl font-bold text-bone tabular-nums">{order.id}</p>
          </div>

          {order.payment.checkoutUrl || order.payment.pixCode ? (
            <div className="mt-6 text-left">
              <InfinitePayPanel
                checkoutUrl={order.payment.checkoutUrl ?? order.payment.pixCode}
                amount={order.total}
              />
            </div>
          ) : (
            <div className="mt-6 border border-blood bg-blood/10 p-4 text-left text-xs text-blood-bright">
              {mode === 'local'
                ? 'Este pedido é apenas uma demonstração local e não gera cobrança real.'
                : 'O pedido foi criado, mas o servidor não devolveu o link de pagamento. Não faça uma transferência avulsa; consulte o pedido novamente ou fale com o suporte.'}
            </div>
          )}

          {order.customerAccessToken && (
            <div className="mt-5 border border-smoke bg-pitch p-4 text-left">
              <label
                className="heading-carved text-[0.58rem] text-grave"
                htmlFor="order-access-token"
              >
                Código de acesso ao pedido
              </label>
              <input
                id="order-access-token"
                readOnly
                value={order.customerAccessToken}
                onFocus={(event) => event.target.select()}
                className="field mt-2 font-mono text-xs"
              />
              <p className="mt-2 text-[0.65rem] leading-relaxed text-grave">
                Guarde este código. Ele será exigido junto com o número do pedido para
                consultar status e rastreamento em outro dispositivo.
              </p>
            </div>
          )}

          <dl className="mt-5 space-y-2 border-t border-smoke pt-5 text-left text-[0.72rem]">
            <Row label="Total do pedido" value={money(order.total)} strong />
            <Row label="Pagamento" value="PIX à vista" />
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
          {order.customerAccessToken
            ? `Acompanhe o pedido na Área do Cliente usando ${order.id} e seu código de acesso.`
            : `Guarde o número ${order.id} e procure o suporte para acompanhar o pedido.`}
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
