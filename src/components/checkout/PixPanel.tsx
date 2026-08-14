import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, QrCode } from 'lucide-react';
import { money } from '../../lib/format';

/** Desconto por pagar à vista no PIX — praxe no varejo brasileiro. */
export const PIX_DISCOUNT = 0.05;

export function PixPanel({ payload, amount }: { payload: string; amount: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#050506', light: '#e8e5dd' },
    })
      .then((url) => active && setDataUrl(url))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [payload]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard bloqueado (http, permissão negada): o campo abaixo continua
      // selecionável, então o usuário ainda consegue copiar na mão.
      setFailed(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 border border-smoke bg-pitch p-6 sm:flex-row sm:items-start">
        <div className="shrink-0 bg-bone p-2">
          {dataUrl ? (
            <img src={dataUrl} alt="QR Code do PIX" className="h-40 w-40" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center text-void">
              <QrCode className="h-10 w-10 animate-pulse" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div>
            <p className="heading-carved text-[0.6rem] text-blood-bright">Pague com PIX</p>
            <p className="mt-1 font-display text-2xl font-bold text-bone tabular-nums">
              {money(amount)}
            </p>
            <p className="text-[0.68rem] text-grave">
              já com {Math.round(PIX_DISCOUNT * 100)}% de desconto à vista
            </p>
          </div>

          <ol className="space-y-1 text-[0.7rem] text-parchment">
            <li>1. Abra o app do seu banco e escolha pagar com PIX</li>
            <li>2. Aponte para o QR Code ou use o Copia e Cola</li>
            <li>3. A confirmação é imediata e o pedido entra em separação</li>
          </ol>

          <p className="border-t border-smoke/70 pt-2 text-[0.62rem] text-dust">
            Beneficiário: <strong className="text-bone">LUIZ EDUARDO CIARALLO</strong> · CNPJ: <span className="font-mono text-parchment">68.510.540/0001-59</span>
          </p>
        </div>
      </div>

      <div>
        <span className="label">PIX Copia e Cola</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={payload}
            onFocus={(event) => event.target.select()}
            className="field flex-1 font-mono text-[0.62rem]"
            aria-label="Código PIX Copia e Cola"
          />
          <button
            onClick={copy}
            className={`btn shrink-0 ${copied ? 'btn-ghost border-blood text-blood-bright' : 'btn-bone'}`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        {failed && (
          <p className="mt-1.5 text-[0.65rem] text-grave">
            Não foi possível copiar automaticamente — selecione o código acima e copie manualmente.
          </p>
        )}
      </div>
    </div>
  );
}
