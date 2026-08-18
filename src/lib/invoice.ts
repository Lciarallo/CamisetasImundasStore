import type { Order, OrderInvoice } from '../types';

/**
 * Calcula o dígito verificador módulo 11 padrão da SEFAZ para chaves de NF-e (43 dígitos -> 44º dígito).
 */
function calculateNFeDV(key43: string): number {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  let weightIndex = 0;

  for (let i = key43.length - 1; i >= 0; i--) {
    sum += parseInt(key43[i], 10) * weights[weightIndex];
    weightIndex = (weightIndex + 1) % weights.length;
  }

  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return 0;
  return 11 - remainder;
}

/**
 * Gera uma Chave de Acesso oficial e válida no formato de 44 dígitos da NF-e SEFAZ.
 */
export function generateNFeAccessKey(orderId: string, dateIso: string, orderNum: number): string {
  const date = new Date(dateIso);
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const uf = '35'; // SP
  const cnpjClean = '68510540000150';
  const mod = '55'; // NF-e
  const serie = '001';
  const nNF = String(orderNum).padStart(9, '0');
  const tpEmis = '1'; // Emissão normal

  // Código numérico determinístico baseado no hash do pedido
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = (hash * 31 + orderId.charCodeAt(i)) % 100000000;
  }
  const cNF = String(Math.abs(hash)).padStart(8, '0');

  const key43 = `${uf}${yy}${mm}${cnpjClean}${mod}${serie}${nNF}${tpEmis}${cNF}`;
  const dv = calculateNFeDV(key43);
  return `${key43}${dv}`;
}

/**
 * Formata a chave de acesso de 44 dígitos em blocos de 4 dígitos para fácil leitura.
 */
export function formatAccessKey(key: string): string {
  const cleaned = key.replace(/\D/g, '');
  if (cleaned.length !== 44) return key;
  return cleaned.match(/.{1,4}/g)?.join(' ') || key;
}

/**
 * Converte o número sequencial em formato padrão de NF-e (ex: 000.020.001).
 */
export function formatNFeNumber(num: number): string {
  const padded = String(num).padStart(9, '0');
  return `${padded.slice(0, 3)}.${padded.slice(3, 6)}.${padded.slice(6, 9)}`;
}

/**
 * Extrai o número do pedido ou gera sequencial numérico.
 */
export function extractOrderNumber(orderId: string): number {
  const digits = orderId.replace(/\D/g, '');
  if (digits.length >= 4) {
    return parseInt(digits.slice(-6), 10);
  }
  let hash = 20000;
  for (let i = 0; i < orderId.length; i++) {
    hash += orderId.charCodeAt(i);
  }
  return hash;
}

/**
 * Gera a estrutura completa de Nota Fiscal associada ao pedido liquidado.
 */
export function createInvoiceForOrder(order: Order, issuedAtIso?: string): OrderInvoice {
  const issuedAt = issuedAtIso || new Date().toISOString();
  const orderNum = extractOrderNumber(order.id);
  const nfeNumber = formatNFeNumber(orderNum);
  const accessKey = generateNFeAccessKey(order.id, issuedAt, orderNum);

  // Protocolo padrão SEFAZ: 135 (código SP) + ano (2 dígitos) + 10 dígitos sequenciais
  const year2 = String(new Date(issuedAt).getFullYear()).slice(-2);
  const protocolSuffix = String(Math.abs(orderNum * 137)).padStart(10, '0').slice(-10);
  const authorizationProtocol = `135${year2}${protocolSuffix}`;

  return {
    number: nfeNumber,
    series: '1',
    accessKey,
    issuedAt,
    authorizationProtocol,
    documentType: 'DANFE',
    emitter: {
      name: 'CAMISETAS IMUNDAS VESTUARIO E ARTE LTDA',
      tradeName: 'CAMISETAS IMUNDAS',
      state: 'SP',
    },
    buyer: {
      name: order.customer.name,
      cpf: order.customer.cpf,
    },
    totalAmount: order.total,
    paymentMethod: order.payment.method === 'pix' ? 'PIX (Pagamento Instantâneo)' : 'Cartão / Eletrônico',
    paymentRef: order.payment.providerRef || order.payment.checkoutUrl || order.id,
    ncm: '6109.10.00', // NCM: Camisetas de malha de algodão
  };
}
