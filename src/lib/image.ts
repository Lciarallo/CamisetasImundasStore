/**
 * Preparo das fotos de produto antes de subir.
 *
 * Uma foto de celular crua tem 3–8 MB. Subir assim desperdiça banda de quem
 * compra pelo 4G e, no modo local, estoura a cota do navegador na segunda
 * foto. Nada é guardado como veio: redimensiona, recomprime e mede antes de
 * aceitar. O destino final decide os limites (ver `STORAGE_LIMITS`).
 */

const QUALITY = 0.82;

/**
 * Os limites dependem de onde a foto vai parar.
 *
 * No Cloud Storage cabe bem mais: o teto é a regra do bucket (2 MB) e vale a
 * pena guardar em resolução maior, porque a imagem é servida por CDN e não
 * pesa em nenhuma leitura de documento. No modo local a foto vira data URI
 * dentro do localStorage, onde a cota é de poucos megabytes para tudo.
 */
export const STORAGE_LIMITS = {
  firebase: { maxSide: 1600, maxBytes: 1_800_000 },
  local: { maxSide: 1000, maxBytes: 600_000 },
} as const;

export type StorageTarget = keyof typeof STORAGE_LIMITS;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export interface PreparedImage {
  /** Para prévia imediata e para o modo local, onde a foto é o próprio URI. */
  dataUrl: string;
  /** Binário para subir ao Cloud Storage sem passar por base64. */
  blob: Blob;
  width: number;
  height: number;
  /** Tamanho aproximado do data URI em bytes. */
  bytes: number;
  format: string;
}

export class ImageError extends Error {}

/** WebP comprime bem melhor que JPEG e mantém transparência. Nem todo navegador exporta. */
let webpSupported: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupported === null) {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    webpSupported = probe.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupported;
}

/**
 * `createImageBitmap` respeita a orientação EXIF, então foto tirada com o
 * celular deitado não chega girada. Onde ele não existe, cai no `Image`, que
 * ignora EXIF — pior, mas melhor do que recusar o upload.
 */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Alguns navegadores não aceitam a opção; segue para o caminho antigo.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImageError('Não foi possível ler esta imagem.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Bytes reais por trás de um data URI base64, sem materializar o binário. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function prepareImage(
  file: File,
  target: StorageTarget = 'local',
): Promise<PreparedImage> {
  const { maxSide: MAX_SIDE, maxBytes: MAX_STORED_BYTES } = STORAGE_LIMITS[target];
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Esse arquivo não é uma imagem.');
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageError(`Formato ${file.type.replace('image/', '')} não suportado.`);
  }

  const source = await decode(file);
  const sourceWidth = 'width' in source ? source.width : 0;
  const sourceHeight = 'height' in source ? source.height : 0;
  if (!sourceWidth || !sourceHeight) {
    throw new ImageError('Imagem vazia ou corrompida.');
  }

  // Só reduz; ampliar foto pequena não acrescenta detalhe e só pesa mais.
  const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('O navegador não permitiu processar a imagem.');

  context.imageSmoothingQuality = 'high';
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ('close' in source) source.close();

  const format = supportsWebp() ? 'image/webp' : 'image/jpeg';
  let dataUrl = canvas.toDataURL(format, QUALITY);
  let bytes = dataUrlBytes(dataUrl);

  // Se ainda estiver pesada, cai a qualidade em degraus antes de desistir.
  for (const retry of [0.7, 0.58, 0.45]) {
    if (bytes <= MAX_STORED_BYTES) break;
    dataUrl = canvas.toDataURL(format, retry);
    bytes = dataUrlBytes(dataUrl);
  }

  if (bytes > MAX_STORED_BYTES) {
    throw new ImageError(
      `A foto ficou com ${formatBytes(bytes)} mesmo comprimida. Use uma imagem menor.`,
    );
  }

  return { dataUrl, blob: dataUrlToBlob(dataUrl), width, height, bytes, format };
}

/** Converte o data URI já comprimido em binário, sem recomprimir de novo. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/webp';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Extrai imagens de um Ctrl+V ou de um arrastar-e-soltar. */
export function imagesFromTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith('image/'));
}
