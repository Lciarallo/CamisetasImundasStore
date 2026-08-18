/**
 * Geração de dados de Nota Fiscal Eletrônica (DANFE/NF-e) para pedidos pagos.
 */
export function generateNFeData(orderId: string, order: Record<string, any>, nowIso: string) {
  const digits = orderId.replace(/\D/g, '');
  const orderNum = digits.length >= 4 ? parseInt(digits.slice(-6), 10) : 20001;
  const padded = String(orderNum).padStart(9, '0');
  const number = `${padded.slice(0, 3)}.${padded.slice(3, 6)}.${padded.slice(6, 9)}`;
  const date = new Date(nowIso);
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const uf = '35'; // SP
  const cnpjClean = '68510540000150';
  const mod = '55'; // NF-e
  const serie = '001';
  const nNF = String(orderNum).padStart(9, '0');
  const tpEmis = '1';

  let hash = 0;
  for (let i = 0; i < orderId.length; i++) hash = (hash * 31 + orderId.charCodeAt(i)) % 100000000;
  const cNF = String(Math.abs(hash)).padStart(8, '0');
  const key43 = `${uf}${yy}${mm}${cnpjClean}${mod}${serie}${nNF}${tpEmis}${cNF}`;

  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0,
    wIdx = 0;
  for (let i = key43.length - 1; i >= 0; i--) {
    sum += parseInt(key43[i], 10) * weights[wIdx];
    wIdx = (wIdx + 1) % weights.length;
  }
  const rem = sum % 11;
  const dv = rem === 0 || rem === 1 ? 0 : 11 - rem;
  const accessKey = `${key43}${dv}`;
  const protocol = `135${yy}${String(Math.abs(orderNum * 137)).padStart(10, '0').slice(-10)}`;

  return {
    number,
    series: '1',
    accessKey,
    issuedAt: nowIso,
    authorizationProtocol: protocol,
    documentType: 'DANFE',
    emitter: {
      name: 'CAMISETAS IMUNDAS VESTUARIO E ARTE LTDA',
      tradeName: 'CAMISETAS IMUNDAS',
      state: 'SP',
    },
    buyer: {
      name: order.customer?.name || '',
      cpf: order.customer?.cpf || '',
    },
    totalAmount: order.total || 0,
    paymentMethod:
      order.payment?.method === 'pix' ? 'PIX (Pagamento Instantâneo)' : 'Cartão / Eletrônico',
    paymentRef: order.payment?.providerRef || order.payment?.checkoutUrl || orderId,
    ncm: '6109.10.00',
  };
}
