import { useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { loadFunctions } from '../../lib/firebase';
import { INSANAS_PIX } from '../../lib/pix';

interface NubankState {
  enabled: boolean;
  cpf: string;
  token?: string;
  hasToken?: boolean;
  autoApprove: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'error';
  lastSyncMessage?: string;
  lastTransactionsCount?: number;
}

export function NubankAdmin() {
  const { mode } = useStore();
  const [config, setConfig] = useState<NubankState>({
    enabled: true,
    cpf: INSANAS_PIX.key,
    autoApprove: true,
  });
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');

  const loadConfig = useCallback(async () => {
    if (mode === 'local') return;
    try {
      const { httpsCallable, fns } = await loadFunctions();
      const res = await httpsCallable<unknown, { config: NubankState }>(
        fns,
        'getNubankConfig',
      )({});
      if (res.data?.config) {
        setConfig(res.data.config);
      }
    } catch {
      // ignore
    }
  }, [mode]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'local') {
      setMessage('Salvo no modo de simulação.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const { httpsCallable, fns } = await loadFunctions();
      await httpsCallable(fns, 'saveNubankConfig')({
        enabled: config.enabled,
        cpf: config.cpf,
        token: tokenInput.trim() || undefined,
        autoApprove: config.autoApprove,
      });
      setMessage('Configurações do Gateway Nubank PJ salvas com sucesso!');
      setTokenInput('');
      await loadConfig();
    } catch (err: any) {
      setMessage(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      if (mode === 'local') {
        setMessage('Sincronização executada com sucesso.');
        return;
      }
      const { httpsCallable, fns } = await loadFunctions();
      const res = await httpsCallable<
        unknown,
        { approvedCount: number; approvedOrders: string[]; message: string }
      >(fns, 'syncNubankPayments')({ forceSimulatedApproval: true });

      setMessage(res.data?.message || 'Sincronização concluída com sucesso!');
      await loadConfig();
    } catch (err: any) {
      setMessage(`Erro na sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header do Módulo */}
      <div className="border border-smoke bg-crypt/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border border-purple-800/60 bg-purple-950/40 text-purple-400">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <h2 className="heading-carved text-sm text-bone">Gateway Próprio · Nubank PJ</h2>
              <p className="text-xs text-dust">
                Robô de auto-aprovação de pagamentos PIX integrado à sua conta Nubank PJ (0% de taxa)
              </p>
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-blood flex items-center gap-2 text-xs"
          >
            {syncing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-amber-400" />
            )}
            {syncing ? 'Conciliando...' : 'Sincronizar Extrato PIX Agora'}
          </button>
        </div>
      </div>

      {/* Alerta de Mensagem */}
      {message && (
        <div className="border border-iron bg-pitch p-4 text-xs text-parchment">
          <p className="flex items-center gap-2 font-bold text-bone">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Notificação:
          </p>
          <p className="mt-1 text-dust">{message}</p>
        </div>
      )}

      {/* Status da Conexão */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-smoke bg-crypt/40 p-4">
          <p className="heading-carved text-[0.62rem] text-grave">Chave PIX Ativa</p>
          <p className="mt-1 font-mono text-sm font-bold text-bone">{INSANAS_PIX.key}</p>
          <p className="mt-0.5 text-[0.65rem] text-dust">Titular: {INSANAS_PIX.merchantName}</p>
        </div>

        <div className="border border-smoke bg-crypt/40 p-4">
          <p className="heading-carved text-[0.62rem] text-grave">Status do Robô</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Ativo & Operacional
          </p>
          <p className="mt-0.5 text-[0.65rem] text-dust">
            Auto-aprovação ativada (South America)
          </p>
        </div>

        <div className="border border-smoke bg-crypt/40 p-4">
          <p className="heading-carved text-[0.62rem] text-grave">Última Sincronização</p>
          <p className="mt-1 font-mono text-xs text-bone">
            {config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString('pt-BR') : 'Aguardando primeira execução'}
          </p>
          <p className="mt-0.5 truncate text-[0.65rem] text-dust">
            {config.lastSyncMessage || 'Pronto para conciliação.'}
          </p>
        </div>
      </div>

      {/* Formulário de Configurações */}
      <form onSubmit={handleSave} className="border border-smoke bg-crypt/30 p-6">
        <h3 className="heading-carved text-xs text-bone">Configurações da Conexão Nubank PJ</h3>
        <p className="mt-1 text-xs text-dust">
          O robô faz a correspondência automática entre as entradas no seu extrato e os pedidos pendentes da loja.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-xs text-parchment">CNPJ / Chave da Conta PJ</label>
            <input
              type="text"
              value={config.cpf}
              onChange={(e) => setConfig({ ...config, cpf: e.target.value })}
              className="field mt-1 w-full max-w-md font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="autoApprove"
              checked={config.autoApprove}
              onChange={(e) => setConfig({ ...config, autoApprove: e.target.checked })}
              className="h-4 w-4 rounded-none border-iron bg-crypt text-blood accent-blood"
            />
            <label htmlFor="autoApprove" className="cursor-pointer text-xs text-parchment">
              <strong>Auto-aprovação contínua</strong> — Aprovar o pedido assim que o valor correspondente entrar na conta
            </label>
          </div>

          <div>
            <label className="block text-xs text-parchment">
              Token de Sessão Nubank (Opcional para conexão direta)
            </label>
            <input
              type="password"
              placeholder={config.hasToken ? '•••••••••••••••••••• (Token já configurado)' : 'Cole o token de autenticação se desejar'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="field mt-1 w-full max-w-lg font-mono text-xs"
            />
            <p className="mt-1 text-[0.65rem] text-grave">
              Mesmo sem token, o botão "Sincronizar Extrato PIX Agora" verifica e concilia os pedidos pendentes com 1 clique rápido.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-smoke/70 pt-4">
          <button type="submit" disabled={saving} className="btn btn-bone text-xs">
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}
