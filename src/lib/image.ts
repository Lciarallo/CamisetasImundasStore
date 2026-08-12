/**
 * Preparo das fotos de produto antes de guardar.
 *
 * Sem backend, as fotos vivem em `localStorage` como data URI — e a cota é de
 * poucos megabytes para o domínio inteiro. Uma foto de celular crua tem 3–8 MB
 * e, em base64, engorda mais 33%: duas fotos já estourariam tudo. Por isso
 * nada é guardado como veio: redimensiona, recomprime e mede antes de aceitar.
 */

/** Maior lado da imagem guardada. Suficiente para o modal em tela cheia. */
const MAX_SIDE = 1000;
const QUALITY = 0.82;

/** Acima disso a foto é recusada: uma só já comprometeria a cota. */
export const MAX_STORED_BYTES = 600_000;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export interface PreparedImage {
  dataUrl: string;
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

export async function prepareImage(file: File): Promise<PreparedImage> {
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

  return { dataUrl, width, height, bytes, format };
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
