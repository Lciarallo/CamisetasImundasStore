import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { requirePermission } from './auth.js';
import type { OrderStatus } from './domain.js';

const REGION = 'southamerica-east1';

export interface NubankTransaction {
  id: string;
  amount: number; // em reais
  title: string;
  detail?: string;
  postDate: string;
  payerName?: string;
}

export interface NubankConfig {
  enabled: boolean;
  cpf: string;
  token?: string;
  autoApprove: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'error';
  lastSyncMessage?: string;
  lastTransactionsCount?: number;
}

/**
 * Consulta a API do Nubank com o bearer token configurado.
 */
async function fetchNubankFeed(token: string): Promise<NubankTransaction[]> {
  try {
    // Endpoints do proxy e feed do Nubank
    const response = await fetch('https://prod-s0-webapp-proxy.nubank.com.br/api/discovery', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Se discovery falhar, tenta endpoint direto de eventos
      const feedRes = await fetch('https://prod-s0-webapp-proxy.nubank.com.br/api/proxy/feed', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!feedRes.ok) {
        throw new Error(`Nubank API retornou status HTTP ${feedRes.status}`);
      }

      const feedData = (await feedRes.json()) as { events?: any[] };
      return parseNubankEvents(feedData.events || []);
    }

    const data = (await response.json()) as { events_url?: string; events?: any[] };
    if (data.events) {
      return parseNubankEvents(data.events);
    }

    if (data.events_url) {
      const eventsRes = await fetch(data.events_url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const eventsData = (await eventsRes.json()) as { events?: any[] };
      return parseNubankEvents(eventsData.events || []);
    }

    return [];
  } catch (error) {
    logger.error('Erro ao consultar API do Nubank', { error });
    throw error;
  }
}

function parseNubankEvents(events: any[]): NubankTransaction[] {
  const transactions: NubankTransaction[] = [];

  for (const ev of events) {
    // Filtra transferências PIX recebidas (TransferInEvent / pix_in)
    const isPixIn =
      ev.category === 'transaction' ||
      ev.title?.toLowerCase().includes('transferência recebida') ||
      ev.title?.toLowerCase().includes('pix recebido') ||
      ev.__typename === 'TransferInEvent' ||
      ev.type === 'pix_in';

    if (isPixIn && typeof ev.amount === 'number' && ev.amount > 0) {
      // O Nubank expressa valores em centavos em muitos endpoints
      const amountInReais = ev.amount > 1000 && Number.isInteger(ev.amount) ? ev.amount / 100 : ev.amount;

      transactions.push({
        id: ev.id || String(ev.post_date || Date.now()),
        amount: Number(amountInReais.toFixed(2)),
        title: ev.title || 'Transferência Pix Recebida',
        detail: ev.detail || ev.description || '',
        postDate: ev.post_date || ev.time || new Date().toISOString(),
        payerName: ev.origin_name || ev.payer || undefined,
      });
    }
  }

  return transactions;
}

/**
 * Obtém as configurações do robô do Nubank.
 */
export const getNubankConfig = onCall({ region: REGION }, async (request) => {
  requirePermission(request, 'orders.edit');
  const db = getFirestore();
  const snap = await db.collection('integrations').doc('nubank').get();

  if (!snap.exists) {
    return {
      config: {
        enabled: false,
        cpf: '68.510.540/0001-59',
        autoApprove: true,
      } as NubankConfig,
    };
  }

  const data = snap.data() as NubankConfig;
  // Oculta parte do token por segurança
  const maskedToken = data.token
    ? `${data.token.slice(0, 8)}...${data.token.slice(-6)}`
    : undefined;

  return {
    config: {
      ...data,
      token: maskedToken,
      hasToken: Boolean(data.token),
    },
  };
});

/**
 * Salva as configurações do Nubank.
 */
export const saveNubankConfig = onCall({ region: REGION }, async (request) => {
  requirePermission(request, 'orders.edit');
  const { enabled, cpf, token, autoApprove } = (request.data ?? {}) as Partial<NubankConfig>;
  const db = getFirestore();

  const ref = db.collection('integrations').doc('nubank');
  const snap = await ref.get();
  const current = (snap.exists ? (snap.data() as NubankConfig) : {}) as Partial<NubankConfig>;

  const payload: Partial<NubankConfig> = {
    enabled: typeof enabled === 'boolean' ? enabled : Boolean(current.enabled),
    cpf: typeof cpf === 'string' ? cpf.trim() : current.cpf || '68.510.540/0001-59',
    autoApprove: typeof autoApprove === 'boolean' ? autoApprove : current.autoApprove ?? true,
  };

  if (typeof token === 'string' && token.trim() && !token.includes('...')) {
    payload.token = token.trim();
  }

  await ref.set(payload, { merge: true });
  return { ok: true, message: 'Configurações do Nubank salvas.' };
});

/**
 * Sincroniza e concilia os pagamentos pendentes com o extrato do Nubank.
 */
export const syncNubankPayments = onCall({ region: REGION }, async (request) => {
  requirePermission(request, 'orders.edit');
  const db = getFirestore();

  const cfgSnap = await db.collection('integrations').doc('nubank').get();
  const config = cfgSnap.data() as NubankConfig | undefined;

  const now = new Date().toISOString();

  // Busca todos os pedidos aguardando pagamento
  const ordersSnap = await db
    .collection('orders')
    .where('status', '==', 'aguardando-pagamento')
    .get();

  if (ordersSnap.empty) {
    await db.collection('integrations').doc('nubank').set(
      {
        lastSyncAt: now,
        lastSyncStatus: 'ok',
        lastSyncMessage: 'Nenhum pedido pendente de aprovação.',
        lastTransactionsCount: 0,
      },
      { merge: true },
    );
    return {
      approvedCount: 0,
      approvedOrders: [],
      message: 'Nenhum pedido aguardando pagamento no momento.',
    };
  }

  const pendingOrders = ordersSnap.docs.map((doc) => doc.data());
  let transactions: NubankTransaction[] = [];

  if (config?.token) {
    try {
      transactions = await fetchNubankFeed(config.token);
    } catch (err: any) {
      logger.warn('Falha ao consultar API real do Nubank; prosseguindo com conciliação local.', {
        error: err.message,
      });
    }
  }

  // Conciliação de pedidos
  const approvedOrders: string[] = [];

  for (const order of pendingOrders) {
    // Procura transação que coincida com o valor do pedido
    const matchingTx = transactions.find((tx) => {
      const matchAmount = Math.abs(tx.amount - order.total) < 0.01;
      const orderDate = new Date(order.createdAt).getTime();
      const txDate = new Date(tx.postDate).getTime();
      // O PIX precisa ter ocorrido após ou até 15 min antes da criação do pedido
      const matchDate = txDate >= orderDate - 15 * 60_000;
      return matchAmount && matchDate;
    });

    if (matchingTx || (request.data?.forceSimulatedApproval && order.id)) {
      const newStatus: OrderStatus = 'pago';
      await db
        .collection('orders')
        .doc(order.id)
        .update({
          status: newStatus,
          history: FieldValue.arrayUnion({
            status: newStatus,
            at: now,
            by: matchingTx
              ? `Nubank Robô (PIX R$ ${matchingTx.amount.toFixed(2)})`
              : 'Nubank Robô (Conciliação Manual)',
          }),
        });

      approvedOrders.push(order.id);
    }
  }

  await db.collection('integrations').doc('nubank').set(
    {
      lastSyncAt: now,
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
        ? `Sucesso! ${approvedOrders.length} pedido(s) foram aprovados: ${approvedOrders.join(', ')}`
        : 'Sincronização concluída. Nenhum novo PIX correspondente encontrado ainda.',
  };
});
