/**
 * Gera um BR Code (PIX copia e cola) no servidor.
 *
 * O payload direto e o txid nunca dependem de valores calculados no browser.
 */

function emv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Campo PIX ${id} excede o limite do BR Code.`);
  return id + String(value.length).padStart(2, '0') + value;
}

/** CRC16/CCITT-FALSE exigido pelo campo 63 do BR Code. */
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

function sanitize(value: string, maxLength: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, '')
    .trim()
    .slice(0, maxLength)
    .toUpperCase();
}

export interface PixPayloadInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId: string;
  description?: string;
}

export function buildPixPayload(input: PixPayloadInput): string {
  const key = input.key.trim();
  const merchantName = sanitize(input.merchantName, 25);
  const merchantCity = sanitize(input.merchantCity, 15);
  const txId = input.txId.replace(/[^A-Za-z0-9]/g, '').slice(0, 25).toUpperCase();
  const amountInCents = Math.round(input.amount * 100);

  if (!key || key.length > 77 || !/^[\x20-\x7E]+$/.test(key)) {
    throw new Error('Chave PIX direta inválida.');
  }
  if (!merchantName || !merchantCity) throw new Error('Dados do recebedor PIX incompletos.');
  if (!txId) throw new Error('txid PIX inválido.');
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw new Error('Valor da cobrança PIX inválido.');
  }

  // Chave e texto livre dividem os 99 caracteres do Merchant Account.
  const descriptionLimit = Math.max(0, Math.min(40, 73 - key.length));
  const description = input.description ? sanitize(input.description, descriptionLimit) : '';
  const merchantAccount = emv(
    '26',
    emv('00', 'br.gov.bcb.pix') +
      emv('01', key) +
      (description ? emv('02', description) : ''),
  );

  const partial =
    emv('00', '01') +
    merchantAccount +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', (amountInCents / 100).toFixed(2)) +
    emv('58', 'BR') +
    emv('59', merchantName) +
    emv('60', merchantCity) +
    emv('62', emv('05', txId)) +
    '6304';

  return partial + crc16(partial);
}
