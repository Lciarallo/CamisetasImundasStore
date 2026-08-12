/** Validação e formatação de cartão de crédito — tudo client-side, sem PSP. */

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'elo'
  | 'hipercard'
  | 'diners'
  | 'desconhecida';

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  elo: 'Elo',
  hipercard: 'Hipercard',
  diners: 'Diners Club',
  desconhecida: 'Cartão',
};

const BRAND_RULES: { brand: CardBrand; pattern: RegExp }[] = [
  { brand: 'visa', pattern: /^4/ },
  { brand: 'mastercard', pattern: /^(5[1-5]|2[2-7])/ },
  { brand: 'amex', pattern: /^3[47]/ },
  { brand: 'diners', pattern: /^3(0[0-5]|[68])/ },
  {
    brand: 'elo',
    pattern:
      /^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|651|655)/,
  },
  { brand: 'hipercard', pattern: /^(606282|3841)/ },
];

const digits = (value: string) => value.replace(/\D/g, '');

export function detectBrand(cardNumber: string): CardBrand {
  const d = digits(cardNumber);
  if (!d) return 'desconhecida';
  // Elo e Hipercard têm prefixos que colidem com Visa/Master — checamos antes.
  const priority: CardBrand[] = ['elo', 'hipercard'];
  for (const brand of priority) {
    const rule = BRAND_RULES.find((r) => r.brand === brand)!;
    if (rule.pattern.test(d)) return brand;
  }
  return BRAND_RULES.find((r) => r.pattern.test(d))?.brand ?? 'desconhecida';
}

/** Amex usa 15 dígitos em blocos 4-6-5; Diners, 14. O resto, 16 em blocos de 4. */
export function cardMaxLength(brand: CardBrand): number {
  if (brand === 'amex') return 15;
  if (brand === 'diners') return 14;
  return 16;
}

export function cvvLength(brand: CardBrand): number {
  return brand === 'amex' ? 4 : 3;
}

export function maskCardNumber(value: string): string {
  const brand = detectBrand(value);
  const d = digits(value).slice(0, cardMaxLength(brand));

  if (brand === 'amex') {
    return d.replace(/(\d{4})(\d{1,6})?(\d{1,5})?/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' '),
    );
  }
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function maskExpiry(value: string): string {
  const d = digits(value).slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Algoritmo de Luhn — pega erro de digitação, não valida se o cartão existe. */
export function isValidCardNumber(value: string): boolean {
  const d = digits(value);
  const brand = detectBrand(d);
  if (d.length !== cardMaxLength(brand)) return false;

  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function isValidExpiry(value: string, now = new Date()): boolean {
  const d = digits(value);
  if (d.length !== 4) return false;

  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return false;

  // Vale até o último instante do mês informado.
  const expiry = new Date(year, month, 1).getTime();
  return expiry > now.getTime();
}

export function isValidCVV(value: string, brand: CardBrand): boolean {
  return digits(value).length === cvvLength(brand);
}

export const cardLast4 = (value: string) => digits(value).slice(-4);

/* -------------------------------------------------------------------------- */
/* Parcelamento                                                               */
/* -------------------------------------------------------------------------- */

export const MAX_INSTALLMENTS = 12;
/** Acima disso o parcelamento passa a ter juros. */
export const INTEREST_FREE_INSTALLMENTS = 6;
/** Juros mensais aplicados a partir da 7ª parcela. */
export const MONTHLY_INTEREST = 0.0199;

export interface InstallmentOption {
  count: number;
  installmentValue: number;
  total: number;
  interestFree: boolean;
}

/**
 * Tabela Price para as parcelas com juros; divisão simples para as sem juros.
 * Parcela mínima de R$ 20 — regra comum no varejo brasileiro.
 */
export function buildInstallments(
  total: number,
  minInstallment = 20,
): InstallmentOption[] {
  const options: InstallmentOption[] = [];

  for (let count = 1; count <= MAX_INSTALLMENTS; count++) {
    const interestFree = count <= INTEREST_FREE_INSTALLMENTS;

    let installmentValue: number;
    if (interestFree) {
      installmentValue = total / count;
    } else {
      const i = MONTHLY_INTEREST;
      installmentValue = (total * i) / (1 - Math.pow(1 + i, -count));
    }

    if (count > 1 && installmentValue < minInstallment) break;

    options.push({
      count,
      installmentValue,
      total: installmentValue * count,
      interestFree,
    });
  }

  return options;
}
