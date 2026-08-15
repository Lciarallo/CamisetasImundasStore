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
  autoApprove: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'error';
  lastSyncMessage?: string;
  lastTransactionsCount?: number;
}

export function NubankAdmin() {
  const { mode } = useStore();
  const [config, setConfig] = useState<NubankState>({
    enabled: false,
    cpf: INSANAS_PIX.key,
    autoApprove: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        autoApprove: config.autoApprove,
      });
      setMessage('Configurações do Gateway Nubank PJ salvas com sucesso!');
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
        setMessage('A conciliação bancária não é executada no modo local.');
        return;
      }
      const { httpsCallable, fns } = await loadFunctions();
      const res = await httpsCallable<
        unknown,
        { approvedCount: number; approvedOrders: string[]; message: string }
      >(fns, 'syncNubankPayments')({});

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
                Conciliação manual de pedidos PIX direto legados, executada no servidor
              </p>
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing || mode === 'local' || !config.enabled}
            className="btn btn-blood flex items-center gap-2 text-xs"
          >
            {syncing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-amber-400" />
            )}
            {syncing ? 'Conciliando...' : 'Sincronizar extrato manualmente'}
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
            {config.enabled ? 'Conciliação habilitada' : 'Conciliação desabilitada'}
          </p>
          <p className="mt-0.5 text-[0.65rem] text-dust">
            {config.autoApprove
              ? 'Aprovação durante a sincronização habilitada'
              : 'Somente revisão, sem aprovação'}
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
          O robô só verifica o extrato quando o Mestre aciona a sincronização e recusa
          correspondências ambíguas. Pedidos Mercado Pago são confirmados pelo webhook oficial.
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
              <strong>Aprovar durante a sincronização</strong> — confirmar apenas correspondências
              inequívocas encontradas nesta execução manual
            </label>
          </div>

          <div className="flex max-w-2xl items-start gap-3 border border-smoke bg-pitch p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-xs font-semibold text-bone">Credencial protegida no servidor</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-grave">
                A credencial bancária vem do Secret Manager ou do ambiente seguro da função.
                Ela não é exibida, digitada nem enviada por este painel.
              </p>
            </div>
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
