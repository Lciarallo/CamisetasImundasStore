/**
 * Gateway PIX do Banco Inter (API Pix do Banco Central).
 *
 * O Inter implementa a especificação `cob` do BACEN, então o formato de
 * requisição e resposta aqui é o mesmo de Efí, Sicoob ou BB — trocar de PSP
 * depois é mudar URL, credencial e escopo, não reescrever a lógica.
 *
 * Duas decisões que valem explicação:
 *
 * 1. **mTLS pelo módulo `https` nativo**, não por `fetch`. O Inter exige
 *    certificado de cliente, e o `fetch` global do Node não aceita `cert`/`key`
 *    sem um dispatcher do undici. O módulo nativo resolve sem dependência nova.
 *
 * 2. **A cobrança tem expiração de verdade, imposta pelo PSP.** É o que separa
 *    isto de um BR Code estático para chave própria: depois de `expiracao` o
 *    banco recusa o pagamento, então a reserva de estoque que vence não deixa
 *    para trás um QR Code que continua cobrando.
 */
import { createHash } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { logger } from 'firebase-functions';

const PRODUCTION_HOST = 'https://cdpj.partners.bancointer.com.br';
const SANDBOX_HOST = 'https://cdpj-sandbox.partners.uatinter.co';
const TOKEN_PATH = '/oauth/v2/token';
const COB_PATH = '/pix/v2/cob';
const REQUEST_TIMEOUT_MS = 15_000;
const SCOPES = 'cob.write cob.read pix.read webhook.write webhook.read';

/** Secrets ligados às funções que falam com o Inter. */
export const INTER_SECRETS = [
  'INTER_CLIENT_ID',
  'INTER_CLIENT_SECRET',
  'INTER_CERTIFICATE',
  'INTER_PRIVATE_KEY',
  'INTER_PIX_KEY',
] as const;

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value !== '__EMULATOR_DISABLED__' ? value : undefined;
}

/** Sandbox por variável explícita; nunca por acidente de ambiente. */
function host(): string {
  return env('INTER_USE_SANDBOX') === 'true' ? SANDBOX_HOST : PRODUCTION_HOST;
}

export function isInterConfigured(): boolean {
  return INTER_SECRETS.every((name) => Boolean(env(name)));
}

interface Credentials {
  clientId: string;
  clientSecret: string;
  certificate: string;
  privateKey: string;
  pixKey: string;
}

function credentials(): Credentials {
  const missing = INTER_SECRETS.filter((name) => !env(name));
  if (missing.length > 0) {
    throw new Error(`Credenciais do Inter ausentes: ${missing.join(', ')}.`);
  }
  return {
    clientId: env('INTER_CLIENT_ID')!,
    clientSecret: env('INTER_CLIENT_SECRET')!,
    certificate: normalizePem(env('INTER_CERTIFICATE')!),
    privateKey: normalizePem(env('INTER_PRIVATE_KEY')!),
    pixKey: env('INTER_PIX_KEY')!,
  };
}

/**
 * O Secret Manager guarda o PEM inteiro, mas colar em terminal costuma achatar
 * as quebras de linha em `\n` literais. Sem isso o handshake falha com um erro
 * de parse que não diz nada sobre a causa.
 */
function normalizePem(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

interface HttpResponse {
  status: number;
  body: string;
}

function mtlsRequest(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  creds: Credentials,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: init.method,
        cert: creds.certificate,
        key: creds.privateKey,
        headers: init.headers,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );

    request.on('timeout', () => request.destroy(new Error('Tempo esgotado ao falar com o Inter.')));
    request.on('error', reject);
    if (init.body) request.write(init.body);
    request.end();
  });
}

/* -------------------------------------------------------------------------- */
/* Token                                                                      */
/* -------------------------------------------------------------------------- */

let cachedToken: { value: string; expiresAtMs: number } | null = null;

/**
 * O token vale 60 minutos e o Inter limita chamadas por minuto, então pedir um
 * novo a cada cobrança desperdiça cota. A instância quente reaproveita, com
 * margem de 5 minutos para não usar um token que vence no meio da requisição.
 */
async function accessToken(creds: Credentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) return cachedToken.value;

  const form = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'client_credentials',
    scope: SCOPES,
  }).toString();

  const response = await mtlsRequest(
    `${host()}${TOKEN_PATH}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(form)),
      },
      body: form,
    },
    creds,
  );

  if (response.status !== 200) {
    logger.error('Inter recusou a emissão do token', { httpStatus: response.status });
    throw new Error('Não foi possível autenticar no Banco Inter.');
  }

  let parsed: { access_token?: unknown; expires_in?: unknown };
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new Error('O Banco Inter devolveu um token ilegível.');
  }

  if (typeof parsed.access_token !== 'string' || !parsed.access_token) {
    throw new Error('O Banco Inter devolveu um token vazio.');
  }

  const lifetimeSeconds =
    typeof parsed.expires_in === 'number' && parsed.expires_in > 0 ? parsed.expires_in : 3600;
  cachedToken = {
    value: parsed.access_token,
    expiresAtMs: Date.now() + Math.max(0, lifetimeSeconds - 300) * 1000,
  };
  return cachedToken.value;
}

/** Um token recusado não pode ficar em cache envenenando as próximas chamadas. */
function invalidateToken(): void {
  cachedToken = null;
}

async function interFetch(
  path: string,
  init: { method: string; body?: unknown },
  creds: Credentials,
): Promise<HttpResponse> {
  const send = async (): Promise<HttpResponse> => {
    const token = await accessToken(creds);
    const body = init.body === undefined ? undefined : JSON.stringify(init.body);
    return mtlsRequest(
      `${host()}${path}`,
      {
        method: init.method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': String(Buffer.byteLength(body)),
              }
            : {}),
        },
        ...(body ? { body } : {}),
      },
      creds,
    );
  };

  const first = await send();
  // 401 depois de um token cacheado costuma ser revogação no meio do caminho.
  if (first.status !== 401) return first;
  invalidateToken();
  return send();
}

/* -------------------------------------------------------------------------- */
/* Cobrança                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * O BACEN exige txid `[a-zA-Z0-9]{26,35}`, e `INS-20001` não serve: tem hífen e
 * é curto demais. Derivar do pedido de forma determinística mantém o `PUT`
 * idempotente — repetir a mesma cobrança devolve a mesma, nunca uma segunda.
 */
export function interTxId(orderId: string): string {
  const base = orderId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const hash = createHash('sha256')
    .update(`camisetas-insanas:inter:${orderId}`)
    .digest('hex')
    .toUpperCase();
  return `${base}${hash}`.slice(0, 32);
}

/**
 * Caminho inverso: do txid de volta ao número do pedido.
 *
 * O txid começa com o pedido sem os caracteres não alfanuméricos, então
 * `INS20001…` reconstrói `INS-20001`. A volta só é aceita se `interTxId` do
 * candidato reproduzir exatamente o txid recebido — o trecho de hash funciona
 * como assinatura, e um txid inventado não sobrevive à conferência.
 */
export function orderIdFromTxId(txid: string): string | null {
  const match = /^([A-Z]+)(\d+)/.exec(txid);
  if (!match) return null;
  const [, prefix, digits] = match;

  // O hash é hexadecimal em caixa alta, então começa com dígito na maioria das
  // vezes — e o `\d+` acima o engole junto com o número do pedido. Testar cada
  // corte possível resolve sem ambiguidade: só o verdadeiro reproduz o txid.
  for (let length = digits.length; length >= 1; length--) {
    const candidate = `${prefix}-${digits.slice(0, length)}`;
    if (interTxId(candidate) === txid) return candidate;
  }
  return null;
}

export interface InterCharge {
  txid: string;
  payload: string;
  status: 'aprovado' | 'pendente' | 'recusado';
  expiresAt: string;
  amount: number;
}

function chargeStatus(status: unknown): InterCharge['status'] {
  if (status === 'CONCLUIDA') return 'aprovado';
  if (typeof status === 'string' && status.startsWith('REMOVIDA')) return 'recusado';
  return 'pendente';
}

/** `valor.original` vem como string ("123.45"); centavos evitam ponto flutuante. */
function amountFromCob(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+\.\d{2}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

interface CobResponse {
  txid?: unknown;
  status?: unknown;
  pixCopiaECola?: unknown;
  calendario?: { criacao?: unknown; expiracao?: unknown };
  valor?: { original?: unknown };
  pix?: { endToEndId?: unknown; valor?: unknown }[];
}

function parseCob(body: string): CobResponse {
  try {
    return JSON.parse(body) as CobResponse;
  } catch {
    throw new Error('O Banco Inter devolveu uma cobrança ilegível.');
  }
}

function expiryIso(cob: CobResponse, fallbackSeconds: number): string {
  const created =
    typeof cob.calendario?.criacao === 'string' ? new Date(cob.calendario.criacao) : new Date();
  const base = Number.isNaN(created.getTime()) ? new Date() : created;
  const seconds =
    typeof cob.calendario?.expiracao === 'number' && cob.calendario.expiracao > 0
      ? cob.calendario.expiracao
      : fallbackSeconds;
  // Sempre em UTC: `reservationExpiresAt` é comparado como string pelo agendador.
  return new Date(base.getTime() + seconds * 1000).toISOString();
}

export async function createInterCharge(input: {
  orderId: string;
  amount: number;
  expirationSeconds: number;
  customer: { name: string; cpf: string };
}): Promise<InterCharge> {
  const creds = credentials();
  const txid = interTxId(input.orderId);

  const response = await interFetch(
    `${COB_PATH}/${txid}`,
    {
      method: 'PUT',
      body: {
        calendario: { expiracao: input.expirationSeconds },
        devedor: { cpf: input.customer.cpf.replace(/\D/g, ''), nome: input.customer.name.trim() },
        valor: { original: input.amount.toFixed(2) },
        chave: creds.pixKey,
        solicitacaoPagador: `Pedido ${input.orderId} - Camisetas Insanas`,
      },
    },
    creds,
  );

  if (response.status !== 200 && response.status !== 201) {
    logger.error('Inter recusou a criação da cobrança PIX', {
      orderId: input.orderId,
      httpStatus: response.status,
    });
    throw new Error('Não foi possível criar a cobrança PIX no Banco Inter.');
  }

  const cob = parseCob(response.body);
  const payload = typeof cob.pixCopiaECola === 'string' ? cob.pixCopiaECola.trim() : '';
  const amount = amountFromCob(cob.valor?.original);

  if (!payload || !amount) {
    logger.error('Inter devolveu cobrança sem BR Code ou sem valor', { orderId: input.orderId });
    throw new Error('O Banco Inter devolveu uma cobrança incompleta.');
  }
  // Se o valor cobrado não é o que pedimos, abortar é o único caminho seguro.
  if (Math.round(amount * 100) !== Math.round(input.amount * 100)) {
    logger.error('Inter devolveu cobrança com valor divergente', {
      orderId: input.orderId,
      pedido: input.amount,
      cobranca: amount,
    });
    throw new Error('O Banco Inter devolveu uma cobrança com valor divergente.');
  }

  return {
    txid,
    payload,
    status: chargeStatus(cob.status),
    expiresAt: expiryIso(cob, input.expirationSeconds),
    amount,
  };
}

export interface InterPaymentProof {
  txid: string;
  paid: boolean;
  amount: number | null;
  endToEndId: string | null;
}

/**
 * Lê a cobrança direto do Inter, com as nossas credenciais.
 *
 * O webhook é tratado como aviso, nunca como prova: qualquer um pode fazer um
 * POST na URL. O que confirma o pagamento é esta leitura.
 */
export async function fetchInterCharge(txid: string): Promise<InterPaymentProof> {
  if (!/^[a-zA-Z0-9]{26,35}$/.test(txid)) {
    throw new Error('txid fora do formato exigido pelo BACEN.');
  }

  const creds = credentials();
  const response = await interFetch(`${COB_PATH}/${txid}`, { method: 'GET' }, creds);

  if (response.status === 404) return { txid, paid: false, amount: null, endToEndId: null };
  if (response.status !== 200) {
    logger.error('Inter recusou a consulta da cobrança', { txid, httpStatus: response.status });
    throw new Error('Não foi possível consultar a cobrança no Banco Inter.');
  }

  const cob = parseCob(response.body);
  const settlement = Array.isArray(cob.pix) ? cob.pix[0] : undefined;

  return {
    txid,
    paid: cob.status === 'CONCLUIDA',
    // O valor liquidado manda; `valor.original` é só o que foi pedido.
    amount: amountFromCob(settlement?.valor) ?? amountFromCob(cob.valor?.original),
    endToEndId:
      typeof settlement?.endToEndId === 'string' && settlement.endToEndId.trim()
        ? settlement.endToEndId.trim()
        : null,
  };
}
