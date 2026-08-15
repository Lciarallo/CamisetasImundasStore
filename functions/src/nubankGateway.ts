import { createHash } from 'node:crypto';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { requirePermission } from './auth.js';

const REGION = 'southamerica-east1';
const NUBANK_ACCESS_TOKEN = defineSecret('NUBANK_ACCESS_TOKEN');
const DEFAULT_CPF = '68.510.540/0001-59';
const MAX_PAYMENT_DELAY_MS = 24 * 60 * 60_000;
const MAX_PAYMENT_ANTICIPATION_MS = 15 * 60_000;

export interface NubankTransaction {
  id: string;
  amount: number; // em reais
  title: string;
  detail?: string;
  reference?: string;
  postDate: string;
  payerName?: string;
}

export interface NubankConfig {
  enabled: boolean;
  cpf: string;
  autoApprove: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'error';
  lastSyncMessage?: string;
  lastTransactionsCount?: number;
}

interface PendingOrder {
  id: string;
  total: number;
  createdAt: unknown;
  status: unknown;
  payment?: { method?: unknown; gateway?: unknown; providerRef?: unknown };
}

interface ReconciliationCandidate {
  order: PendingOrder;
  transaction: NubankTransaction;
}

async function requireMaster(
  request: Parameters<typeof requirePermission>[0],
): Promise<string> {
  const { uid, claims } = await requirePermission(request, 'orders.edit');
  if (claims.role !== 'mestre') {
    throw new HttpsError(
      'permission-denied',
      'Apenas o Mestre pode acessar a integração bancária.',
    );
  }
  return uid;
}

function accessToken(): string | undefined {
  const value = NUBANK_ACCESS_TOKEN.value().trim();
  return value && value !== '__EMULATOR_DISABLED__' ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function eventReference(event: any): string | undefined {
  const parts = [
    event.reference,
    event.detail,
    event.description,
    event.message,
    event.pix?.description,
    event.pix?.payer_message,
    event.pix?.payerMessage,
  ]
    .map(nonEmptyString)
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join('\n') : undefined;
}

function eventId(event: any): string | undefined {
  const value =
    event.id ??
    event.transaction_id ??
    event.transactionId ??
    event.end_to_end_id ??
    event.endToEndId ??
    event.pix?.endToEndId;

  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return nonEmptyString(String(value));
}

function eventAmountInReais(event: any): number | undefined {
  const cents = event.amount_in_cents ?? event.amountInCents;
  if (typeof cents === 'number' && Number.isFinite(cents) && cents > 0) {
    return Number((cents / 100).toFixed(2));
  }

  const reais = event.amount_in_reais ?? event.amountInReais;
  if (typeof reais === 'number' && Number.isFinite(reais) && reais > 0) {
    return Number(reais.toFixed(2));
  }

  const rawAmount = event.amount;
  const unit = nonEmptyString(event.amount_unit ?? event.amountUnit)?.toLowerCase();
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount <= 0) {
    return undefined;
  }
  if (unit === 'cent' || unit === 'cents' || unit === 'centavo' || unit === 'centavos') {
    return Number((rawAmount / 100).toFixed(2));
  }
  if (unit === 'brl' || unit === 'real' || unit === 'reais') {
    return Number(rawAmount.toFixed(2));
  }

  // Os endpoints privados já alternaram a unidade do campo `amount`. Sem uma
  // unidade explícita, inferir entre reais e centavos poderia aprovar valor errado.
  return undefined;
}

/**
 * Consulta a API do Nubank com o segredo injetado no ambiente da Function.
 * Nenhuma credencial é lida do Firestore ou devolvida ao cliente.
 */
async function fetchNubankFeed(token: string): Promise<NubankTransaction[]> {
  const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const commonHeaders = {
    Authorization: bearer,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:153.0) Gecko/20100101 Firefox/153.0',
    Origin: 'https://app.nubank.com.br',
    Referer: 'https://app.nubank.com.br/',
  };

  try {
    const pjRes = await fetch(
      'https://prod-global-web-savings-accounts.prod-waf.nubank.com.br/api/feed',
      { headers: commonHeaders, redirect: 'error', signal: AbortSignal.timeout(10_000) },
    );

    if (pjRes.ok) {
      const pjData = (await pjRes.json()) as { events?: any[]; items?: any[] };
      return parseNubankEvents(pjData.events || pjData.items || []);
    }

    const discoveryUrl = 'https://prod-s0-webapp-proxy.nubank.com.br/api/discovery';
    const response = await fetch(discoveryUrl, {
      headers: commonHeaders,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = (await response.json()) as { events_url?: string; events?: any[] };
      if (data.events) return parseNubankEvents(data.events);

      if (data.events_url) {
        const eventsUrl = new URL(data.events_url, discoveryUrl);
        if (
          eventsUrl.protocol === 'https:' &&
          (eventsUrl.hostname === 'nubank.com.br' || eventsUrl.hostname.endsWith('.nubank.com.br'))
        ) {
          const eventsRes = await fetch(eventsUrl, {
            headers: commonHeaders,
            redirect: 'error',
            signal: AbortSignal.timeout(10_000),
          });
          if (eventsRes.ok) {
            const eventsData = (await eventsRes.json()) as { events?: any[] };
            return parseNubankEvents(eventsData.events || []);
          }
        }
      }
    }

    const feedRes = await fetch('https://prod-s0-webapp-proxy.nubank.com.br/api/proxy/feed', {
      headers: commonHeaders,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });

    if (feedRes.ok) {
      const feedData = (await feedRes.json()) as { events?: any[] };
      return parseNubankEvents(feedData.events || []);
    }

    throw new Error(
      `Nenhum endpoint Nubank respondeu com sucesso (${pjRes.status}/${response.status}/${feedRes.status}).`,
    );
  } catch (error) {
    logger.error('Erro ao consultar API do Nubank', { error });
    throw error;
  }
}

function parseNubankEvents(events: any[]): NubankTransaction[] {
  const transactions: NubankTransaction[] = [];

  for (const event of events) {
    const title = nonEmptyString(event.title) ?? '';
    const isPixIn =
      event.__typename === 'TransferInEvent' ||
      event.type === 'pix_in' ||
      event.category === 'pix_in';

    const id = eventId(event);
    const amountInReais = eventAmountInReais(event);
    const postDate = nonEmptyString(event.post_date ?? event.time ?? event.createdAt);

    // Sem ID estável, valor, data ou referência não é possível garantir uma
    // conciliação idempotente e vinculada ao pedido; portanto o evento é ignorado.
    if (
      !isPixIn ||
      !id ||
      amountInReais === undefined ||
      !postDate
    ) {
      continue;
    }

    transactions.push({
      id,
      amount: Number(amountInReais.toFixed(2)),
      title: title || 'Transferência Pix Recebida',
      detail: nonEmptyString(event.detail ?? event.description),
      reference: eventReference(event),
      postDate,
      payerName: nonEmptyString(event.origin_name ?? event.payer),
    });
  }

  return transactions;
}

function timestampMillis(value: unknown): number | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return undefined;
  }
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : undefined;
}

function containsExactOrderId(reference: string | undefined, orderId: string): boolean {
  if (!reference) return false;
  const escaped = orderId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`, 'i').test(reference);
}

function hasReconcilableProviderRef(payment: PendingOrder['payment']): boolean {
  if (payment?.providerRef === null || payment?.providerRef === undefined) {
    const gateway = payment?.gateway;
    return gateway === null || gateway === undefined || gateway === 'pix-direto';
  }
  return (
    payment.gateway === 'pix-direto' &&
    typeof payment.providerRef === 'string' &&
    /^PIX-DIRECT-CI[A-F0-9]{23}$/.test(payment.providerRef)
  );
}

function matchesOrder(
  transaction: NubankTransaction,
  order: PendingOrder,
  comparisonTime: number,
): boolean {
  if (
    order.status !== 'aguardando-pagamento' ||
    order.payment?.method !== 'pix' ||
    !hasReconcilableProviderRef(order.payment)
  ) {
    return false;
  }

  const total = order.total;
  const orderDate = timestampMillis(order.createdAt);
  const transactionDate = timestampMillis(transaction.postDate);
  if (
    typeof total !== 'number' ||
    !Number.isFinite(total) ||
    total <= 0 ||
    orderDate === undefined ||
    transactionDate === undefined
  ) {
    return false;
  }

  const sameAmountInCents = Math.round(transaction.amount * 100) === Math.round(total * 100);
  const insideOrderWindow =
    transactionDate >= orderDate - MAX_PAYMENT_ANTICIPATION_MS &&
    transactionDate <= orderDate + MAX_PAYMENT_DELAY_MS;
  const notFromFuture = transactionDate <= comparisonTime + 5 * 60_000;

  return (
    sameAmountInCents &&
    insideOrderWindow &&
    notFromFuture &&
    containsExactOrderId(transaction.reference, order.id)
  );
}

function unambiguousCandidates(
  orders: PendingOrder[],
  transactions: NubankTransaction[],
  comparisonTime: number,
): ReconciliationCandidate[] {
  const transactionsById = new Map<string, NubankTransaction[]>();
  for (const transaction of transactions) {
    const group = transactionsById.get(transaction.id) ?? [];
    group.push(transaction);
    transactionsById.set(transaction.id, group);
  }

  // IDs repetidos ou divergentes no feed não são confiáveis para consumo único.
  const uniqueTransactions = [...transactionsById.values()]
    .filter((group) => group.length === 1)
    .map(([transaction]) => transaction);

  const candidates: ReconciliationCandidate[] = [];
  for (const order of orders) {
    for (const transaction of uniqueTransactions) {
      if (matchesOrder(transaction, order, comparisonTime)) {
        candidates.push({ order, transaction });
      }
    }
  }

  const orderMatches = new Map<string, number>();
  const transactionMatches = new Map<string, number>();
  for (const candidate of candidates) {
    orderMatches.set(candidate.order.id, (orderMatches.get(candidate.order.id) ?? 0) + 1);
    transactionMatches.set(
      candidate.transaction.id,
      (transactionMatches.get(candidate.transaction.id) ?? 0) + 1,
    );
  }

  return candidates.filter(
    ({ order, transaction }) =>
      orderMatches.get(order.id) === 1 && transactionMatches.get(transaction.id) === 1,
  );
}

function processedTransactionDocumentId(providerRef: string): string {
  return createHash('sha256').update(providerRef).digest('hex');
}

/** Obtém somente configurações não sigilosas do robô do Nubank. */
export const getNubankConfig = onCall(
  { region: REGION, secrets: [NUBANK_ACCESS_TOKEN] },
  async (request) => {
    await requireMaster(request);
    const snap = await getFirestore().collection('integrations').doc('nubank').get();
    const data = snap.data() as Partial<NubankConfig> | undefined;

    return {
      config: {
        enabled: data?.enabled === true,
        cpf: typeof data?.cpf === 'string' ? data.cpf : DEFAULT_CPF,
        autoApprove: data?.autoApprove === true,
        ...(typeof data?.lastSyncAt === 'string' ? { lastSyncAt: data.lastSyncAt } : {}),
        ...(data?.lastSyncStatus === 'ok' || data?.lastSyncStatus === 'error'
          ? { lastSyncStatus: data.lastSyncStatus }
          : {}),
        ...(typeof data?.lastSyncMessage === 'string'
          ? { lastSyncMessage: data.lastSyncMessage }
          : {}),
        ...(typeof data?.lastTransactionsCount === 'number'
          ? { lastTransactionsCount: data.lastTransactionsCount }
          : {}),
        hasToken: Boolean(accessToken()),
      },
    };
  },
);

/** Salva apenas configurações não sigilosas e apaga qualquer token legado. */
export const saveNubankConfig = onCall({ region: REGION }, async (request) => {
  await requireMaster(request);
  const input = (request.data ?? {}) as Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(input, 'token')) {
    throw new HttpsError(
      'invalid-argument',
      'O token não pode ser enviado pela aplicação. Configure NUBANK_ACCESS_TOKEN no Secret Manager.',
    );
  }
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A opção de integração é inválida.');
  }
  if (input.autoApprove !== undefined && typeof input.autoApprove !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A opção de aprovação automática é inválida.');
  }
  if (input.cpf !== undefined && (typeof input.cpf !== 'string' || !input.cpf.trim())) {
    throw new HttpsError('invalid-argument', 'CPF/CNPJ inválido.');
  }

  const db = getFirestore();
  const ref = db.collection('integrations').doc('nubank');
  const snap = await ref.get();
  const current = snap.data() as Partial<NubankConfig> | undefined;
  const payload: NubankConfig = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current?.enabled === true,
    cpf: typeof input.cpf === 'string' ? input.cpf.trim() : current?.cpf || DEFAULT_CPF,
    autoApprove:
      typeof input.autoApprove === 'boolean'
        ? input.autoApprove
        : current?.autoApprove === true,
  };

  await ref.set({ ...payload, token: FieldValue.delete() }, { merge: true });
  return { ok: true, message: 'Configurações do Nubank salvas.' };
});

/** Sincroniza e concilia PIX de forma inequívoca, atômica e idempotente. */
export const syncNubankPayments = onCall(
  { region: REGION, secrets: [NUBANK_ACCESS_TOKEN] },
  async (request) => {
    const actorUid = await requireMaster(request);
    const db = getFirestore();
    const integrationRef = db.collection('integrations').doc('nubank');
    const cfgSnap = await integrationRef.get();
    const config = cfgSnap.data() as Partial<NubankConfig> | undefined;
    const now = new Date();
    const nowIso = now.toISOString();

    if (config?.enabled !== true) {
      await integrationRef.set(
        {
          lastSyncAt: nowIso,
          lastSyncStatus: 'ok',
          lastSyncMessage: 'Integração Nubank desativada; nenhuma conciliação executada.',
          lastTransactionsCount: 0,
        },
        { merge: true },
      );
      return {
        approvedCount: 0,
        approvedOrders: [],
        transactionsCount: 0,
        message: 'A integração Nubank está desativada.',
      };
    }

    if (config.autoApprove !== true) {
      await integrationRef.set(
        {
          lastSyncAt: nowIso,
          lastSyncStatus: 'ok',
          lastSyncMessage: 'Aprovação automática desativada; nenhuma conciliação executada.',
          lastTransactionsCount: 0,
        },
        { merge: true },
      );
      return {
        approvedCount: 0,
        approvedOrders: [],
        transactionsCount: 0,
        message: 'A aprovação automática está desativada.',
      };
    }

    const ordersSnap = await db
      .collection('orders')
      .where('status', '==', 'aguardando-pagamento')
      .get();
    const pendingOrders = ordersSnap.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }) as PendingOrder)
      .filter((order) => order.payment?.method === 'pix');

    if (pendingOrders.length === 0) {
      await integrationRef.set(
        {
          lastSyncAt: nowIso,
          lastSyncStatus: 'ok',
          lastSyncMessage: 'Nenhum pedido PIX pendente de aprovação.',
          lastTransactionsCount: 0,
        },
        { merge: true },
      );
      return {
        approvedCount: 0,
        approvedOrders: [],
        transactionsCount: 0,
        message: 'Nenhum pedido PIX aguardando pagamento no momento.',
      };
    }

    const token = accessToken();
    if (!token) {
      await integrationRef.set(
        {
          lastSyncAt: nowIso,
          lastSyncStatus: 'error',
          lastSyncMessage: 'NUBANK_ACCESS_TOKEN não está configurado no Secret Manager.',
          lastTransactionsCount: 0,
        },
        { merge: true },
      );
      throw new HttpsError(
        'failed-precondition',
        'A credencial Nubank não está configurada no Secret Manager.',
      );
    }

    let transactions: NubankTransaction[];
    try {
      transactions = await fetchNubankFeed(token);
    } catch {
      await integrationRef.set(
        {
          lastSyncAt: nowIso,
          lastSyncStatus: 'error',
          lastSyncMessage: 'Falha ao consultar o extrato Nubank; nenhum pedido foi aprovado.',
          lastTransactionsCount: 0,
        },
        { merge: true },
      );
      throw new HttpsError(
        'unavailable',
        'Não foi possível consultar o Nubank. Nenhum pedido foi aprovado.',
      );
    }

    const candidates = unambiguousCandidates(pendingOrders, transactions, now.getTime());
    const approvedOrders: string[] = [];

    for (const candidate of candidates) {
      const orderRef = db.collection('orders').doc(candidate.order.id);
      const processedRef = integrationRef
        .collection('processedTransactions')
        .doc(processedTransactionDocumentId(candidate.transaction.id));
      const existingProviderRefQuery = db
        .collection('orders')
        .where('payment.providerRef', '==', candidate.transaction.id)
        .limit(1);

      const approved = await db.runTransaction(async (firestoreTransaction) => {
        const processedSnap = await firestoreTransaction.get(processedRef);
        if (processedSnap.exists) return false;

        // Também reconhece conciliações anteriores à coleção de marcadores.
        const existingProviderRefSnap = await firestoreTransaction.get(existingProviderRefQuery);
        if (!existingProviderRefSnap.empty) return false;

        const orderSnap = await firestoreTransaction.get(orderRef);
        if (!orderSnap.exists) return false;

        const currentOrder = {
          ...orderSnap.data(),
          id: orderSnap.id,
        } as PendingOrder;
        if (!matchesOrder(candidate.transaction, currentOrder, now.getTime())) return false;

        firestoreTransaction.update(orderRef, {
          status: 'pago',
          'payment.status': 'aprovado',
          'payment.providerRef': candidate.transaction.id,
          'payment.reconciliationProvider': 'nubank',
          'payment.reconciledAt': nowIso,
          history: FieldValue.arrayUnion({
            status: 'pago',
            at: nowIso,
            by: `Nubank Robô (PIX R$ ${candidate.transaction.amount.toFixed(2)})`,
          }),
        });
        firestoreTransaction.create(processedRef, {
          providerRef: candidate.transaction.id,
          orderId: candidate.order.id,
          amount: candidate.transaction.amount,
          transactionDate: candidate.transaction.postDate,
          processedAt: nowIso,
          processedBy: actorUid,
        });
        return true;
      });

      if (approved) approvedOrders.push(candidate.order.id);
    }

    await integrationRef.set(
      {
        lastSyncAt: nowIso,
        lastSyncStatus: 'ok',
        lastSyncMessage: `${approvedOrders.length} pedido(s) aprovado(s) automaticamente.`,
        lastTransactionsCount: transactions.length,
      },
      { merge: true },
    );

    return {
      approvedCount: approvedOrders.length,
      approvedOrders,
      transactionsCount: transactions.length,
      message:
        approvedOrders.length > 0
          ? `${approvedOrders.length} pedido(s) aprovado(s): ${approvedOrders.join(', ')}`
          : 'Sincronização concluída sem correspondência inequívoca.',
    };
  },
);
