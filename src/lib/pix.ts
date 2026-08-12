/**
 * Gerador de PIX Copia e Cola (BR Code / EMV MPM), conforme o manual
 * de padrões do Banco Central. O payload gerado aqui é estruturalmente
 * válido — muda apenas a chave, que num ambiente real viria do PSP.
 */

/** Um campo EMV: `ID + tamanho (2 dígitos) + valor`. */
function emv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

/**
 * CRC16/CCITT-FALSE — polinômio 0x1021, seed 0xFFFF.
 * É o que o campo 63 exige; sem ele o app do banco recusa o código.
 */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Remove acentos e caracteres fora do ASCII imprimível aceito pelo BR Code. */
function sanitize(value: string, maxLength: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .slice(0, maxLength)
    .toUpperCase();
}

export interface PixPayloadInput {
  /** Chave PIX do recebedor (e-mail, CPF/CNPJ, telefone ou aleatória). */
  key: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  /** Identificador do pedido — volta no extrato do lojista. */
  txId: string;
  description?: string;
}

export function buildPixPayload({
  key,
  merchantName,
  merchantCity,
  amount,
  txId,
  description,
}: PixPayloadInput): string {
  // O txId aceita apenas alfanumérico, até 25 caracteres.
  const safeTxId = txId.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  const merchantAccount = emv(
    '26',
    emv('00', 'br.gov.bcb.pix') +
      emv('01', key) +
      (description ? emv('02', sanitize(description, 72)) : ''),
  );

  const payload =
    emv('00', '01') + // Payload Format Indicator
    emv('01', '12') + // Point of Initiation: 12 = dinâmico, um pagamento só
    merchantAccount +
    emv('52', '0000') + // Merchant Category Code — 0000 = não informado
    emv('53', '986') + // Moeda: 986 = BRL
    emv('54', amount.toFixed(2)) +
    emv('58', 'BR') +
    emv('59', sanitize(merchantName, 25)) +
    emv('60', sanitize(merchantCity, 15)) +
    emv('62', emv('05', safeTxId)) +
    '6304'; // CRC: ID + tamanho, com o valor calculado sobre tudo acima

  return payload + crc16(payload);
}

/** Dados do recebedor da loja. Trocar pela chave real do lojista. */
export const INSANAS_PIX = {
  key: 'pagamentos@camisetasinsanas.com.br',
  merchantName: 'CAMISETAS INSANAS',
  merchantCity: 'SAO PAULO',
} as const;
