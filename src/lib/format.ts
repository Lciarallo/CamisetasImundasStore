const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const money = (value: number) => BRL.format(value);
export const moneyCompact = (value: number) => BRL_COMPACT.format(value);

export const percent = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;

const DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (iso: string) => DATE.format(new Date(iso));
export const formatDateTime = (iso: string) => DATE_TIME.format(new Date(iso));

/** "há 3 dias", "há 2 h" — usado nas timelines do admin. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  const months = Math.floor(days / 30);
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

/* -------------------------------------------------------------------------- */
/* Máscaras brasileiras                                                       */
/* -------------------------------------------------------------------------- */

const digits = (value: string) => value.replace(/\D/g, '');

export function maskCPF(value: string): string {
  const d = digits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskCEP(value: string): string {
  const d = digits(value).slice(0, 8);
  return d.replace(/(\d{5})(\d)/, '$1-$2');
}

export function maskPhone(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

/** Validação real de CPF (dígitos verificadores), não só contagem de dígitos. */
export function isValidCPF(value: string): boolean {
  const cpf = digits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  for (const [length, position] of [
    [9, 10],
    [10, 11],
  ]) {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (position - i);
    }
    const check = (sum * 10) % 11 % 10;
    if (check !== Number(cpf[length])) return false;
  }
  return true;
}

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export const isValidCEP = (value: string) => {
  const d = digits(value);
  return d.length === 8 && !/^0{8}$/.test(d);
};

export const BRAZIL_UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

export const isValidUF = (value: string) =>
  BRAZIL_UFS.includes(value.trim().toUpperCase() as (typeof BRAZIL_UFS)[number]);

export const isValidPhone = (value: string) => {
  const d = digits(value);
  return d.length === 10 || d.length === 11;
};

export const onlyDigits = digits;

/** Remove acentos e caixa alta — usado na busca do catálogo. */
export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
