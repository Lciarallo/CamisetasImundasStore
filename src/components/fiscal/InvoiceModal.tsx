import { useState } from 'react';
import { Check, Copy, FileText, Printer, ShieldCheck, X } from 'lucide-react';
import type { Order } from '../../types';
import { money, maskCPF, maskCEP } from '../../lib/format';
import { formatAccessKey, createInvoiceForOrder } from '../../lib/invoice';

interface InvoiceModalProps {
  order: Order;
  onClose: () => void;
}

export function InvoiceModal({ order, onClose }: InvoiceModalProps) {
  const invoice = order.invoice || createInvoiceForOrder(order);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(invoice.accessKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(invoice.issuedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className="anim-fade fixed inset-0 z-80 flex items-center justify-center bg-void/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="danfe-title"
    >
      <div
        className="panel-raised anim-rise flex max-h-[96vh] w-full max-w-4xl flex-col overflow-y-auto bg-pitch text-bone print:max-h-none print:w-full print:border-none print:shadow-none print:bg-white print:text-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Ações Superior (Oculta na Impressão) */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-smoke bg-crypt/95 px-4 py-3 backdrop-blur print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blood-bright" />
            <span className="heading-carved text-xs text-bone">
              Nota Fiscal Eletrônica (DANFE) · {invoice.number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyKey}
              className="inline-flex items-center gap-1.5 border border-iron bg-pitch px-2.5 py-1.5 text-xs text-parchment hover:border-blood hover:text-bone active:scale-95 transition-all"
              title="Copiar Chave de Acesso"
            >
              {copiedKey ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Chave Copiada</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-dust" />
                  <span className="hidden sm:inline">Copiar Chave</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-blood inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded border border-iron bg-pitch text-bone hover:border-blood hover:bg-blood hover:text-white transition-colors ml-1"
              aria-label="Fechar Nota Fiscal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Corpo Oficial da DANFE */}
        <div className="p-4 sm:p-8 space-y-4 text-xs font-sans print:p-0 print:text-black">
          {/* Cabeçalho DANFE */}
          <div className="grid grid-cols-1 md:grid-cols-12 border-2 border-iron print:border-black divide-y-2 md:divide-y-0 md:divide-x-2 divide-iron print:divide-black">
            {/* Dados do Emitente */}
            <div className="md:col-span-5 p-3 flex flex-col justify-between">
              <div>
                <p className="font-display font-black text-sm uppercase tracking-wider text-bone print:text-black">
                  {invoice.emitter.name}
                </p>
                <p className="text-[0.65rem] text-parchment print:text-neutral-700 mt-1">
                  COMÉRCIO VAREJISTA DE ARTIGOS DO VESTUÁRIO TÊXTIL
                </p>
                <p className="text-[0.65rem] text-grave print:text-neutral-600 mt-0.5">
                  São Paulo — SP · Brasil
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-smoke print:border-neutral-300 text-[0.68rem] text-parchment print:text-black">
                <p><strong>Composição Têxtil:</strong> 100% Algodão Penteado Puro</p>
              </div>
            </div>

            {/* Identificação DANFE */}
            <div className="md:col-span-3 p-3 text-center flex flex-col justify-center items-center bg-pitch/50 print:bg-transparent">
              <h1 id="danfe-title" className="font-display font-bold text-base text-bone print:text-black">
                DANFE
              </h1>
              <p className="text-[0.6rem] leading-tight text-grave print:text-neutral-700 uppercase">
                Documento Auxiliar da Nota Fiscal Eletrônica
              </p>
              <div className="mt-2 text-left border border-iron print:border-black px-2 py-1 text-[0.65rem]">
                <p>0 - Entrada</p>
                <p><strong>1 - Saída: [ 1 ]</strong></p>
              </div>
              <div className="mt-2 text-[0.7rem] font-bold tabular-nums text-bone print:text-black">
                <p>Nº {invoice.number}</p>
                <p>SÉRIE {invoice.series}</p>
              </div>
            </div>

            {/* Chave de Acesso & Código de Barras */}
            <div className="md:col-span-4 p-3 flex flex-col justify-between">
              <div>
                <p className="text-[0.58rem] font-bold text-grave print:text-neutral-700 uppercase">
                  Chave de Acesso
                </p>
                <p className="font-mono text-[0.65rem] font-bold text-blood-bright print:text-black break-all tracking-wider tabular-nums mt-0.5">
                  {formatAccessKey(invoice.accessKey)}
                </p>

                {/* Representação visual de código de barras */}
                <div className="mt-2 flex h-8 w-full items-center justify-center bg-white p-1">
                  <div className="flex h-full w-full justify-between items-stretch">
                    {invoice.accessKey.split('').map((char, i) => (
                      <div
                        key={i}
                        className={`w-0.5 ${parseInt(char, 10) % 2 === 0 ? 'bg-black' : 'bg-neutral-800'}`}
                        style={{ height: `${60 + (parseInt(char, 10) % 5) * 8}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-smoke print:border-neutral-300 text-[0.62rem] text-grave print:text-neutral-700">
                <p>Consulta de autenticidade no portal nacional da NF-e</p>
                <p><strong>Protocolo de Autorização:</strong> {invoice.authorizationProtocol} — {formattedDate}</p>
              </div>
            </div>
          </div>

          {/* Natureza da Operação */}
          <div className="border border-iron print:border-black p-2 bg-pitch/40 print:bg-transparent">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[0.65rem]">
              <div>
                <span className="text-grave print:text-neutral-600 block">Natureza da Operação</span>
                <span className="font-bold text-bone print:text-black">VENDA DE MERCADORIA AO CONSUMIDOR</span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block">Protocolo SEFAZ</span>
                <span className="font-mono font-bold text-bone print:text-black">{invoice.authorizationProtocol}</span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block">Data de Emissão</span>
                <span className="font-bold tabular-nums text-bone print:text-black">{formattedDate}</span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block">Data / Hora de Saída</span>
                <span className="font-bold tabular-nums text-bone print:text-black">{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Destinatário / Remetente */}
          <div className="border border-iron print:border-black">
            <div className="bg-smoke/40 print:bg-neutral-100 px-3 py-1 border-b border-iron print:border-black font-display text-[0.65rem] font-bold uppercase text-parchment print:text-black">
              Destinatário / Remetente
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[0.68rem]">
              <div className="sm:col-span-2">
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">Nome / Razão Social</span>
                <span className="font-bold text-bone print:text-black">{invoice.buyer.name}</span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">CPF / CNPJ</span>
                <span className="font-mono font-bold text-bone print:text-black">{maskCPF(invoice.buyer.cpf)}</span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">Endereço</span>
                <span className="text-bone print:text-black">
                  {order.address.street}, {order.address.number} {order.address.complement && `(${order.address.complement})`}
                </span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">Bairro / Distrito</span>
                <span className="text-bone print:text-black">{order.address.district || 'Centro'}</span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">CEP / Município / UF</span>
                <span className="text-bone print:text-black">
                  {maskCEP(order.address.cep)} · {order.address.city}/{order.address.state}
                </span>
              </div>
            </div>
          </div>

          {/* Fatura / Forma de Pagamento */}
          <div className="border border-iron print:border-black">
            <div className="bg-smoke/40 print:bg-neutral-100 px-3 py-1 border-b border-iron print:border-black font-display text-[0.65rem] font-bold uppercase text-parchment print:text-black">
              Dados da Fatura & Pagamento Liquidado
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[0.68rem]">
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">Forma de Pagamento</span>
                <span className="font-bold text-emerald-400 print:text-black flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 inline" />
                  {invoice.paymentMethod}
                </span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">Subtotal dos Produtos</span>
                <span className="font-mono text-bone print:text-black">{money(order.subtotal)}</span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">Descontos Concedidos</span>
                <span className="font-mono text-blood-bright print:text-black">
                  {order.discount > 0 ? `-${money(order.discount)}` : 'R$ 0,00'}
                </span>
              </div>
              <div>
                <span className="text-grave print:text-neutral-600 block text-[0.6rem]">Valor Líquido Pago</span>
                <span className="font-mono font-bold text-sm text-bone print:text-black">{money(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Tabela de Produtos / Serviços */}
          <div className="border border-iron print:border-black">
            <div className="bg-smoke/40 print:bg-neutral-100 px-3 py-1 border-b border-iron print:border-black font-display text-[0.65rem] font-bold uppercase text-parchment print:text-black">
              Dados dos Produtos / Serviços (Malha 100% Algodão)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.65rem] text-left">
                <thead>
                  <tr className="border-b border-iron print:border-black text-grave print:text-neutral-700">
                    <th className="p-2">Cód.</th>
                    <th className="p-2">Descrição do Produto (100% Algodão)</th>
                    <th className="p-2">NCM</th>
                    <th className="p-2 text-center">Tam.</th>
                    <th className="p-2 text-center">Qtd.</th>
                    <th className="p-2 text-right">Vlr. Unit.</th>
                    <th className="p-2 text-right">Vlr. Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-smoke print:divide-neutral-300 font-mono">
                  {order.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-smoke/20 print:hover:bg-transparent">
                      <td className="p-2 text-dust print:text-neutral-700">{line.productId}</td>
                      <td className="p-2 font-sans font-medium text-bone print:text-black">
                        {line.name} — Camiseta 100% Algodão Penteado
                      </td>
                      <td className="p-2 text-dust print:text-neutral-700">{invoice.ncm}</td>
                      <td className="p-2 text-center font-bold text-bone print:text-black">{line.size}</td>
                      <td className="p-2 text-center text-bone print:text-black">{line.quantity}</td>
                      <td className="p-2 text-right text-parchment print:text-black">{money(line.unitPrice)}</td>
                      <td className="p-2 text-right font-bold text-bone print:text-black">
                        {money(line.unitPrice * line.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dados Adicionais / Fisco */}
          <div className="border border-iron print:border-black p-3 bg-pitch/30 print:bg-transparent text-[0.62rem] text-grave print:text-neutral-700 space-y-1">
            <p className="font-bold text-parchment print:text-black uppercase text-[0.65rem]">
              Informações Complementares / Fisco
            </p>
            <p>
              • Documento auxiliar emitido por empresa optante pelo Simples Nacional.
            </p>
            <p>
              • Todas as peças deste documento são confeccionadas em malha <strong>100% Algodão Penteado Premium</strong> com serigrafia artesanal de alta durabilidade.
            </p>
            <p>
              • Pedido de Venda associado: <strong>#{order.id}</strong>. Pagamento conciliado e validado em {formattedDate}.
            </p>
            <p>
              • Tributos Totais Incidentes (Lei Federal 12.741/2012): Aprox. R$ {(invoice.totalAmount * 0.12).toFixed(2).replace('.', ',')} (12,00%).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
