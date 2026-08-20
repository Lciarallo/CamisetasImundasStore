import { useState } from 'react';
import { Check, Copy, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { money } from '../../lib/format';

export function InfinitePayPanel({
  checkoutUrl,
  amount,
}: {
  checkoutUrl?: string;
  amount: number;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    if (!checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 border border-smoke bg-pitch p-6 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center border border-smoke bg-void text-blood-bright">
          <Zap className="h-10 w-10 animate-pulse" />
        </div>

        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div>
            <p className="heading-carved text-[0.6rem] text-blood-bright">Pague com PIX via InfinitePay</p>
            <p className="mt-1 font-display text-2xl font-bold text-bone tabular-nums">
              {money(amount)}
            </p>
            <p className="text-[0.68rem] text-grave">valor total do pedido</p>
          </div>

          <ol className="space-y-1 text-[0.7rem] text-parchment">
            <li>1. Clique no botão abaixo para abrir a página de pagamento seguro da InfinitePay</li>
            <li>2. Escolha PIX e escaneie o QR Code ou use o Copia e Cola no app do seu banco</li>
            <li>3. A confirmação é imediata e o pedido entra em separação automaticamente</li>
          </ol>

          {checkoutUrl ? (
            <div className="pt-2">
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-blood flex w-full items-center justify-center gap-2 py-3 text-xs font-semibold sm:inline-flex sm:w-auto"
              >
                <span>Pagar com PIX na InfinitePay</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <p className="text-xs text-blood-bright">
              Link de checkout não disponível no momento.
            </p>
          )}

          <div className="flex items-center gap-1.5 border-t border-smoke/70 pt-2 text-[0.62rem] text-dust">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>
              Pagamento seguro intermediado pela InfinitePay. Reserva garantida por 30 minutos.
            </span>
          </div>
        </div>
      </div>

      {checkoutUrl && (
        <div>
          <span className="label">Link de Pagamento</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={checkoutUrl}
              onFocus={(event) => event.target.select()}
              className="field flex-1 font-mono text-[0.62rem]"
              aria-label="Link de Pagamento InfinitePay"
            />
            <button
              onClick={copy}
              type="button"
              className={`btn shrink-0 w-full sm:w-auto ${copied ? 'btn-ghost border-blood text-blood-bright' : 'btn-bone'}`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar Link'}
            </button>
          </div>
          {failed && (
            <p className="mt-1.5 text-[0.65rem] text-grave">
              Não foi possível copiar automaticamente — selecione o link acima e copie manualmente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
