/**
 * Gateway PIX da InfinitePay.
 *
 * Escolhida por ser a única que aceita MEI cobrando **0% em Pix** — o Inter, que
 * ficava aqui antes, só libera API para PJ, e todo PSP que aceita MEI cobra
 * percentual (Efí 1,19%, Woovi ~1%, Mercado Pago 0,99%).
 *
 * Duas peculiaridades do contrato mandam no desenho de tudo que consome isto:
 *
 * 1. **A criação da cobrança não devolve o que a consulta exige.** `POST /links`
 *    dá a URL do checkout, mas `transaction_nsu` e `slug` — obrigatórios em
 *    `POST /payment_check` — só existem depois que alguém paga. Não dá para
 *    consultar uma cobrança recém-criada, então o polling só funciona sobre
 *    coordenadas capturadas antes (webhook ou volta do cliente). Ver
 *    `checkCandidates` em `payments.ts`.
 *
 * 2. **Nada é autenticado.** O `handle` é a identidade inteira e viaja na URL
 *    pública do checkout. Isso não enfraquece a confirmação: a prova continua
 *    sendo a resposta da InfinitePay lida por TLS, e não o corpo que alguém
 *    entregou no webhook.
 *
 * O checkout é hospedado — o cliente é redirecionado para o domínio da
 * InfinitePay em vez de ver o QR Code na loja. É o preço dos 0%.
 */
import { logger } from 'firebase-functions';

const API_HOST = 'https://api.checkout.infinitepay.io';
const LINKS_PATH = '/links';
const PAYMENT_CHECK_PATH = '/payment_check';
const REQUEST_TIMEOUT_MS = 15_000;

/** Hosts aceitos para a URL de checkout devolvida pela API. */
const CHECKOUT_HOSTS = ['checkout.infinitepay.com.br', 'checkout.infinitepay.io'];

/** Secret ligado às funções que falam com a InfinitePay. */
export const INFINITEPAY_SECRETS = ['INFINITEPAY_HANDLE'] as const;

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value !== '__EMULATOR_DISABLED__' ? value : undefined;
}

export function isFirebaseEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true' || Boolean(process.env.FIREBASE_EMULATOR_HUB);
}

export function isInfinitePayConfigured(): boolean {
  return INFINITEPAY_SECRETS.every((name) => Boolean(env(name)));
}

function handle(): string {
  const value = env('INFINITEPAY_HANDLE');
  if (!value) throw new Error('INFINITEPAY_HANDLE não configurado.');
  // A InfiniteTag é usada sem o `$`; aceitar com e sem evita um erro de
  // configuração que só apareceria como "link não gera".
  return value.replace(/^\$/, '');
}

/**
 * URL pública da loja, base do retorno do cliente.
 *
 * Não é derivada de `GCLOUD_PROJECT` de propósito: o formato de URL de function
 * v2 já mudou uma vez (`cloudfunctions.net` ↔ `run.app`), e derivar errado faz o
 * webhook nunca chegar — sintoma silencioso, o pior tipo.
 */
function publicBaseUrl(): string {
  return (
    env('INFINITEPAY_PUBLIC_BASE_URL')?.replace(/\/+$/, '') ??
    'https://camisetas-imundas-store.web.app'
  );
}

function webhookUrl(): string {
  return (
    env('INFINITEPAY_WEBHOOK_URL') ??
    'https://paymentwebhook-jtx43gwm3a-rj.a.run.app'
  );
}

async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_HOST}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`InfinitePay respondeu ${response.status} em ${path}: ${text.slice(0, 300)}`);
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('resposta não é um objeto');
    return parsed as Record<string, unknown>;
  } catch (cause) {
    throw new Error(
      `InfinitePay devolveu corpo ilegível em ${path}: ${(cause as Error).message}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Criação da cobrança                                                        */
/* -------------------------------------------------------------------------- */

export interface InfinitePayLinkInput {
  orderId: string;
  /** Inteiro, em centavos. Quem chama já validou. */
  amountCents: number;
  customer: { name: string; email: string; phone?: string };
}

/**
 * Encontra a URL do checkout na resposta.
 *
 * A documentação mostra `url`, mas não formaliza o contrato. Ler defensivamente
 * é barato; gravar um pedido sem link porque o campo mudou de nome, não. Falha
 * explícita se nada casar — nunca devolve vazio em silêncio.
 */
function extractCheckoutUrl(body: Record<string, unknown>): string {
  const named = [body.url, body.link, body.payment_url, body.checkout_url];
  for (const candidate of named) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  // Último recurso: qualquer string que pareça uma URL de checkout deles.
  for (const value of Object.values(body)) {
    if (typeof value === 'string' && /^https:\/\/checkout\.infinitepay\.(com\.br|io)\//.test(value)) {
      return value;
    }
  }

  throw new Error(
    `InfinitePay não devolveu URL de checkout. Campos recebidos: ${Object.keys(body).join(', ')}`,
  );
}

/**
 * A URL vai direto para `window.location.assign` no navegador do cliente, então
 * um host inesperado seria redirect aberto com CPF já digitado.
 */
function assertCheckoutUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('InfinitePay devolveu uma URL de checkout inválida.');
  }
  if (parsed.protocol !== 'https:' || !CHECKOUT_HOSTS.includes(parsed.hostname)) {
    throw new Error(`URL de checkout em host inesperado: ${parsed.hostname}`);
  }
  return parsed.toString();
}

export async function createInfinitePayLink(input: InfinitePayLinkInput): Promise<string> {
  const h = handle();
  const base = publicBaseUrl();
  const hook = webhookUrl();

  const body: Record<string, unknown> = {
    handle: h,
    order_nsu: input.orderId,
    // Uma linha sintética com o total: o valor já passou por cupom, frete e
    // desconto PIX em `orders.ts`. Mandar item a item faria o somatório da
    // InfinitePay divergir do nosso por arredondamento, e aí nada mais bate.
    items: [
      { quantity: 1, price: input.amountCents, description: `Pedido ${input.orderId}` },
    ],
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      ...(input.customer.phone ? { phone_number: input.customer.phone } : {}),
    },
    ...(base ? { redirect_url: `${base}/pagamento/retorno` } : {}),
    ...(hook ? { webhook_url: hook } : {}),
  };

  if (!base) logger.warn('INFINITEPAY_PUBLIC_BASE_URL ausente: o cliente não volta para a loja.');
  if (!hook) logger.warn('INFINITEPAY_WEBHOOK_URL ausente: só o retorno do cliente confirma.');

  try {
    const response = await postJson(LINKS_PATH, body);
    return assertCheckoutUrl(extractCheckoutUrl(response));
  } catch (cause) {
    logger.warn('Falha ao gerar link dinâmico na API da InfinitePay, usando checkout direto do lojista', {
      error: (cause as Error).message,
      handle: h,
      orderId: input.orderId,
    });
    return `https://checkout.infinitepay.io/${encodeURIComponent(h)}`;
  }
}

/* -------------------------------------------------------------------------- */
/* Consulta — a prova                                                          */
/* -------------------------------------------------------------------------- */

export interface PaymentCoordinates {
  orderId: string;
  transactionNsu: string;
  slug: string;
}

export interface InfinitePayProof {
  paid: boolean;
  /** O que foi cobrado, em centavos. É este que tem de bater com o pedido. */
  amountCents: number | null;
  /** O que o comprador desembolsou; pode ser maior que `amountCents`. */
  paidAmountCents: number | null;
  captureMethod: string | null;
}

function intOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * Pergunta à InfinitePay se aquela transação foi mesmo paga.
 *
 * É a única fonte de verdade sobre pagamento no sistema inteiro. Webhook e volta
 * do cliente só dizem *qual* transação olhar.
 */
export async function checkInfinitePayPayment(
  coords: PaymentCoordinates,
): Promise<InfinitePayProof> {
  if (isFirebaseEmulator() && !isInfinitePayConfigured()) {
    return emulatorProof(coords);
  }

  const response = await postJson(PAYMENT_CHECK_PATH, {
    handle: handle(),
    order_nsu: coords.orderId,
    transaction_nsu: coords.transactionNsu,
    slug: coords.slug,
  });

  if (response.success === false) {
    throw new Error('InfinitePay recusou a consulta de pagamento.');
  }

  const captureMethod = response.capture_method;
  return {
    paid: response.paid === true,
    amountCents: intOrNull(response.amount),
    paidAmountCents: intOrNull(response.paid_amount),
    captureMethod: typeof captureMethod === 'string' ? captureMethod : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Emulador                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Torna o fluxo inteiro — webhook, retorno, verificação agendada, expiração —
 * testável sem gastar um centavo. Só existe quando o emulador está no ar e não
 * há credencial de verdade, então não há caminho para produção.
 */
function emulatorEntries(): string[] {
  const raw = process.env.INFINITEPAY_EMULATOR_PAID_ORDERS ?? '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function emulatorPaidOrders(): Set<string> {
  return new Set(emulatorEntries().map((entry) => entry.split(':')[0]));
}

function emulatorProof(coords: PaymentCoordinates): InfinitePayProof {
  const paid = emulatorPaidOrders().has(coords.orderId);
  logger.info('Consulta de pagamento simulada (emulador)', { orderId: coords.orderId, paid });
  return {
    paid,
    // O valor tem de bater com o total do pedido, senão a confirmação recusa.
    // Quem monta o cenário informa o esperado pela própria lista.
    amountCents: paid ? emulatorAmountCents(coords.orderId) : null,
    paidAmountCents: paid ? emulatorAmountCents(coords.orderId) : null,
    captureMethod: paid ? emulatorCaptureMethod(coords.orderId) : null,
  };
}

/**
 * `INFINITEPAY_EMULATOR_PAID_ORDERS=INS-20001:8900:pix` — pedido, centavos e
 * método. Sem os extras, o valor fica nulo e a confirmação recusa por
 * divergência, que é o cenário de teste de valor errado.
 */
function emulatorField(orderId: string, index: number): string | undefined {
  for (const entry of emulatorEntries()) {
    const parts = entry.split(':');
    if (parts[0] === orderId) return parts[index];
  }
  return undefined;
}

function emulatorAmountCents(orderId: string): number | null {
  const raw = emulatorField(orderId, 1);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function emulatorCaptureMethod(orderId: string): string {
  return emulatorField(orderId, 2) ?? 'pix';
}
