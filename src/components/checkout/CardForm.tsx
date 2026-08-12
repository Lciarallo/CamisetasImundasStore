import { Lock } from 'lucide-react';
import {
  BRAND_LABEL,
  buildInstallments,
  cvvLength,
  detectBrand,
  isValidCVV,
  isValidCardNumber,
  isValidExpiry,
  maskCardNumber,
  maskExpiry,
} from '../../lib/card';
import { money } from '../../lib/format';

export interface CardState {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
  installments: number;
}

export const EMPTY_CARD: CardState = {
  number: '',
  holder: '',
  expiry: '',
  cvv: '',
  installments: 1,
};

export function validateCard(card: CardState): Partial<Record<keyof CardState, string>> {
  const brand = detectBrand(card.number);
  const errors: Partial<Record<keyof CardState, string>> = {};

  if (!isValidCardNumber(card.number)) errors.number = 'Número de cartão inválido.';
  if (card.holder.trim().length < 3) errors.holder = 'Informe o nome impresso no cartão.';
  if (!isValidExpiry(card.expiry)) errors.expiry = 'Validade inválida ou vencida.';
  if (!isValidCVV(card.cvv, brand)) {
    errors.cvv = `O código de segurança tem ${cvvLength(brand)} dígitos.`;
  }
  return errors;
}

interface CardFormProps {
  card: CardState;
  onChange: (card: CardState) => void;
  errors: Partial<Record<keyof CardState, string>>;
  total: number;
}

export function CardForm({ card, onChange, errors, total }: CardFormProps) {
  const brand = detectBrand(card.number);
  const options = buildInstallments(total);
  const update = (patch: Partial<CardState>) => onChange({ ...card, ...patch });

  return (
    <div className="space-y-5">
      {/* Prévia do cartão */}
      <div className="relative overflow-hidden border border-iron bg-gradient-to-br from-ash to-void p-5">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-blood/10 blur-2xl" />
        <div className="flex items-start justify-between">
          <div className="h-7 w-10 bg-gradient-to-br from-[#c9a227] to-[#8a6f14]" />
          <span className="heading-carved text-[0.6rem] text-parchment">
            {BRAND_LABEL[brand]}
          </span>
        </div>
        <p className="mt-6 font-mono text-lg tracking-widest text-bone tabular-nums">
          {card.number ? maskCardNumber(card.number) : '•••• •••• •••• ••••'}
        </p>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.5rem] tracking-[0.2em] text-dust uppercase">Titular</p>
            <p className="truncate font-display text-xs text-parchment uppercase">
              {card.holder || 'NOME COMO NO CARTÃO'}
            </p>
          </div>
          <div>
            <p className="text-[0.5rem] tracking-[0.2em] text-dust uppercase">Validade</p>
            <p className="font-mono text-xs text-parchment tabular-nums">
              {card.expiry || 'MM/AA'}
            </p>
          </div>
        </div>
      </div>

      <Field label="Número do cartão" error={errors.number}>
        <input
          inputMode="numeric"
          autoComplete="cc-number"
          value={maskCardNumber(card.number)}
          onChange={(event) => update({ number: event.target.value })}
          placeholder="0000 0000 0000 0000"
          aria-invalid={Boolean(errors.number)}
          className="field font-mono tabular-nums"
        />
      </Field>

      <Field label="Nome impresso no cartão" error={errors.holder}>
        <input
          autoComplete="cc-name"
          value={card.holder}
          onChange={(event) => update({ holder: event.target.value.toUpperCase() })}
          placeholder="COMO ESTÁ NO CARTÃO"
          aria-invalid={Boolean(errors.holder)}
          className="field uppercase"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Validade" error={errors.expiry}>
          <input
            inputMode="numeric"
            autoComplete="cc-exp"
            value={maskExpiry(card.expiry)}
            onChange={(event) => update({ expiry: event.target.value })}
            placeholder="MM/AA"
            aria-invalid={Boolean(errors.expiry)}
            className="field font-mono tabular-nums"
          />
        </Field>
        <Field label={`CVV (${cvvLength(brand)} dígitos)`} error={errors.cvv}>
          <input
            inputMode="numeric"
            autoComplete="cc-csc"
            value={card.cvv.replace(/\D/g, '').slice(0, cvvLength(brand))}
            onChange={(event) => update({ cvv: event.target.value })}
            placeholder={'0'.repeat(cvvLength(brand))}
            aria-invalid={Boolean(errors.cvv)}
            className="field font-mono tabular-nums"
          />
        </Field>
      </div>

      <Field label="Parcelamento">
        <select
          value={card.installments}
          onChange={(event) => update({ installments: Number(event.target.value) })}
          className="field"
        >
          {options.map((option) => (
            <option key={option.count} value={option.count}>
              {option.count}x de {money(option.installmentValue)}
              {option.interestFree
                ? ' sem juros'
                : ` com juros — total ${money(option.total)}`}
            </option>
          ))}
        </select>
      </Field>

      <p className="flex items-center gap-2 text-[0.65rem] text-grave">
        <Lock className="h-3 w-3 shrink-0 text-blood-bright" />
        Simulação: nenhum dado de cartão é enviado ou armazenado. Apenas os quatro
        últimos dígitos ficam gravados no pedido.
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {error && <p className="mt-1 text-[0.65rem] text-ember">{error}</p>}
    </div>
  );
}
