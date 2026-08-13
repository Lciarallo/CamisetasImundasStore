import { HttpsError } from 'firebase-functions/v2/https';
import { SIZES, type ProductDoc, type Size } from './domain.js';

/**
 * Sanitização das peças, separada dos handlers porque o seed também precisa
 * dela — e porque validação é a parte que merece ser lida isolada.
 */

const CATEGORIES = ['Camiseta', 'Manga Longa', 'Moletom', 'Bootleg', 'Edição de Culto'];
const SIGILS = [
  'pentagram', 'heptagram', 'skull', 'cross', 'goat',
  'tree', 'moon', 'chalice', 'raven', 'sword', 'eye',
];

/**
 * Só as fotos que já estão no nosso bucket entram — senão o catálogo viraria
 * vetor para embutir imagem de terceiro, ou pior, um rastreador.
 *
 * O emulador serve as fotos em `127.0.0.1:9199`, endereço que a regra de
 * produção recusa. Sem a exceção abaixo, o caminho foto→peça simplesmente não
 * era testável fora da nuvem — a foto subia e sumia na hora de salvar. A
 * variável `FUNCTIONS_EMULATOR` é posta pelo próprio emulador e nunca existe
 * numa função publicada, então a brecha não viaja junto no deploy.
 */
function isOurBucket(url: string): boolean {
  const allowedProjectBuckets = [
    'https://firebasestorage.googleapis.com/v0/b/camisetas-imundas-store.firebasestorage.app/',
    'https://firebasestorage.googleapis.com/v0/b/camisetas-imundas-store.appspot.com/',
    'https://firebasestorage.googleapis.com/v0/b/camisetas-imundas-store/',
  ];

  if (allowedProjectBuckets.some((prefix) => url.startsWith(prefix))) {
    return true;
  }

  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return /^http:\/\/(127\.0\.0\.1|localhost):\d+\/v0\/b\//.test(url);
  }
  return false;
}

/**
 * Normaliza e valida a peça antes de gravar.
 *
 * Aceitar o objeto do jeito que veio deixaria o cliente inventar campo, mandar
 * preço negativo ou gravar estoque numa peça sob encomenda. Só o que está
 * descrito aqui chega ao banco.
 */
export function sanitizeProduct(raw: unknown): ProductDoc {
  const data = raw as Partial<ProductDoc> | undefined;
  // Anotação explícita no const: sem ela o TypeScript não usa o retorno
  // `never` para estreitar tipos depois da chamada.
  const fail: (message: string) => never = (message) => {
    throw new HttpsError('invalid-argument', message);
  };

  const text = (value: unknown, min: number, max: number, field: string): string => {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
      fail(`Campo "${field}" inválido.`);
    }
    return (value as string).trim();
  };

  const price = Number(data?.price);
  if (!Number.isFinite(price) || price <= 0 || price > 100_000) fail('Preço inválido.');

  const oldPrice = data?.oldPrice == null ? undefined : Number(data.oldPrice);
  if (oldPrice !== undefined && (!Number.isFinite(oldPrice) || oldPrice <= 0)) {
    fail('Preço antigo inválido.');
  }

  if (!CATEGORIES.includes(data?.category as string)) fail('Categoria inválida.');
  if (!SIGILS.includes(data?.art?.sigil as string)) fail('Sigilo inválido.');

  const fulfillment = data?.fulfillment;
  if (fulfillment !== 'pronta-entrega' && fulfillment !== 'sob-encomenda') {
    fail('Modo de fornecimento inválido.');
  }

  // Uma peça é pronta-entrega ou sob encomenda; o lado que não se aplica é
  // zerado aqui para os dois nunca coexistirem no banco.
  const stock: Record<string, number> = {};
  if (fulfillment === 'pronta-entrega') {
    for (const size of SIZES) {
      const value = (data?.stock as Record<string, unknown> | undefined)?.[size];
      if (value === undefined) continue;
      const amount = Number(value);
      if (!Number.isInteger(amount) || amount < 0 || amount > 100_000) {
        fail(`Estoque inválido no tamanho ${size}.`);
      }
      stock[size] = amount;
    }
  }

  const madeToOrderSizes =
    fulfillment === 'sob-encomenda'
      ? (Array.isArray(data?.madeToOrderSizes) ? data.madeToOrderSizes : []).filter(
          (size): size is Size => SIZES.includes(size as Size),
        )
      : [];

  const productionDays =
    fulfillment === 'sob-encomenda' ? Math.min(180, Math.max(1, Number(data?.productionDays) || 10)) : null;

  const photos = (Array.isArray(data?.photos) ? data.photos : [])
    .filter((url): url is string => typeof url === 'string')
    .filter(isOurBucket)
    .slice(0, 4);

  return {
    name: text(data?.name, 2, 160, 'nome'),
    band: text(data?.band, 1, 80, 'banda'),
    category: data!.category as string,
    price: Math.round(price * 100) / 100,
    ...(oldPrice === undefined ? {} : { oldPrice: Math.round(oldPrice * 100) / 100 }),
    art: {
      sigil: data!.art!.sigil,
      tone: data?.art?.tone === 'blood' ? 'blood' : 'bone',
      fabric: ['preto', 'carvao', 'off-white'].includes(data?.art?.fabric as string)
        ? (data!.art!.fabric as string)
        : 'preto',
    },
    photos,
    ...(typeof data?.tag === 'string' && data.tag ? { tag: data.tag } : {}),
    rating: Math.min(5, Math.max(0, Number(data?.rating) || 5)),
    reviewsCount: Math.max(0, Math.trunc(Number(data?.reviewsCount) || 0)),
    description: typeof data?.description === 'string' ? data.description.slice(0, 2000) : '',
    details: (Array.isArray(data?.details) ? data.details : [])
      .filter((line): line is string => typeof line === 'string')
      .map((line) => line.slice(0, 300))
      .slice(0, 20),
    fulfillment,
    stock,
    madeToOrderSizes,
    ...(productionDays === null ? {} : { productionDays }),
    lowStockThreshold: Math.max(0, Math.trunc(Number(data?.lowStockThreshold) || 0)),
    active: data?.active !== false,
    createdAt:
      typeof data?.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
  };
}

/** Nome usado pelo seed, para deixar explícito que é a mesma validação. */
export const sanitizeForSeed = sanitizeProduct;
