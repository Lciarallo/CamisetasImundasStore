import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  CATEGORIES,
  SIGILS,
  SIZES,
  type Category,
  type Product,
  type Size,
  type TeeArt,
} from '../../types';
import { money, normalize } from '../../lib/format';
import { totalStock, useStore } from '../../store/StoreContext';
import { SigilMark, SkullMark } from '../art/Sigils';
import { TeeImage } from '../art/TeeImage';
import { PhotoUploader } from './PhotoUploader';

const blankProduct = (): Product => ({
  id: `p-${Date.now().toString(36)}`,
  name: '',
  band: '',
  category: 'Camiseta',
  price: 149.9,
  art: { sigil: 'pentagram', tone: 'bone', fabric: 'preto' },
  photos: [],
  rating: 5,
  reviewsCount: 0,
  description: '',
  details: [],
  fulfillment: 'pronta-entrega',
  stock: { P: 0, M: 0, G: 0, GG: 0, XGG: 0 },
  madeToOrderSizes: [],
  lowStockThreshold: 10,
  active: true,
  createdAt: new Date().toISOString(),
});

export function ProductsAdmin() {
  const { products, saveProduct, deleteProduct, can } = useStore();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const editable = can('products.edit');

  const visible = useMemo(() => {
    const term = normalize(search);
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.band, product.category]
        .map(normalize)
        .some((field) => field.includes(term)),
    );
  }, [products, search]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-logo text-3xl text-bone">Catálogo</h1>
          <p className="mt-1 text-[0.72rem] text-grave">
            {products.length} peças cadastradas
            {!editable && ' · somente leitura'}
          </p>
        </div>
        {editable && (
          <button onClick={() => setEditing(blankProduct())} className="btn btn-blood">
            <Plus className="h-3.5 w-3.5" />
            Nova peça
          </button>
        )}
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-dust" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar peça, banda ou categoria"
          className="field pl-9 text-xs"
        />
      </div>

      {visible.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <SkullMark className="h-12 w-12 text-iron" />
          <p className="text-[0.75rem] text-grave">Nenhuma peça encontrada.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((product) => (
            <article
              key={product.id}
              className={`panel flex gap-3 p-3 ${product.active ? '' : 'opacity-50'}`}
            >
              <div className="w-16 shrink-0 bg-pitch">
                <TeeImage
                  art={product.art}
                  band={product.band}
                  photo={product.photos[0]}
                  showBandName={false}
                  className="w-full"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <p className="heading-carved text-[0.55rem] text-blood-bright">
                  {product.band}
                </p>
                <p className="truncate text-[0.72rem] text-bone">{product.name}</p>
                <p className="mt-0.5 text-[0.6rem] text-grave">
                  {product.category} ·{' '}
                  {product.fulfillment === 'sob-encomenda'
                    ? `sob encomenda (${product.productionDays}d)`
                    : `${totalStock(product)} em estoque`}
                  {!product.active && ' · inativa'}
                </p>

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <p className="font-display text-sm font-bold text-bone tabular-nums">
                    {money(product.price)}
                  </p>
                  {editable && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(product)}
                        className="p-1 text-dust hover:text-blood-bright"
                        aria-label={`Editar ${product.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(product.id)}
                        className="p-1 text-dust hover:text-ember"
                        aria-label={`Excluir ${product.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            saveProduct(next);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Excluir "${products.find((p) => p.id === confirmDelete)?.name}"? Esta ação não pode ser desfeita.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const targetId = confirmDelete;
            setConfirmDelete(null);
            const res = await deleteProduct(targetId);
            if (res && !res.ok) {
              alert(res.message || 'Não foi possível excluir a peça.');
            }
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ProductEditor({
  product,
  onClose,
  onSave,
}: {
  product: Product;
  onClose: () => void;
  onSave: (product: Product) => void;
}) {
  const [draft, setDraft] = useState<Product>(product);
  const [detailsText, setDetailsText] = useState(product.details.join('\n'));

  const update = (patch: Partial<Product>) => setDraft({ ...draft, ...patch });
  const updateArt = (patch: Partial<TeeArt>) => update({ art: { ...draft.art, ...patch } });

  const madeToOrder = draft.fulfillment === 'sob-encomenda';
  const valid = draft.name.trim() && draft.band.trim() && draft.price > 0;

  const submit = () => {
    if (!valid) return;
    onSave({
      ...draft,
      details: detailsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      // Uma peça é ou uma coisa ou outra: zera o que não se aplica ao modo.
      stock: madeToOrder ? {} : draft.stock,
      madeToOrderSizes: madeToOrder ? draft.madeToOrderSizes : [],
      productionDays: madeToOrder ? (draft.productionDays ?? 10) : undefined,
    });
  };

  /** Alterna se o tamanho existe na grade (não a quantidade). */
  const toggleSize = (size: Size) => {
    if (madeToOrder) {
      const has = draft.madeToOrderSizes.includes(size);
      update({
        madeToOrderSizes: has
          ? draft.madeToOrderSizes.filter((s) => s !== size)
          : [...draft.madeToOrderSizes, size],
      });
      return;
    }
    const stock = { ...draft.stock };
    if (size in stock) delete stock[size];
    else stock[size] = 0;
    update({ stock });
  };

  return (
    <div
      className="anim-fade fixed inset-0 z-70 flex items-end justify-center bg-void/85 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Editar peça"
    >
      <div
        className="panel-raised anim-rise flex max-h-[92vh] w-full max-w-3xl flex-col overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-smoke bg-crypt/95 px-5 py-3.5 backdrop-blur">
          <h2 className="heading-carved text-[0.62rem] text-bone">
            {product.name ? 'Editar peça' : 'Nova peça'}
          </h2>
          <button onClick={onClose} className="text-grave hover:text-bone" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-6 p-5 md:grid-cols-[220px_1fr]">
          {/* Prévia */}
          <div>
            <div className="bg-pitch p-3">
              <TeeImage
                art={draft.art}
                band={draft.band || 'BANDA'}
                photo={draft.photos[0]}
                className="w-full"
              />
            </div>

            <div className="mt-4">
              <PhotoUploader
                productId={draft.id}
                photos={draft.photos}
                onChange={(photos) => update({ photos })}
              />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="label">
                  Sigilo da estampa
                  {draft.photos.length > 0 && (
                    <span className="ml-1 normal-case text-dust">(reserva, há foto)</span>
                  )}
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {SIGILS.map((sigil) => (
                    <button
                      key={sigil}
                      onClick={() => updateArt({ sigil })}
                      title={sigil}
                      className={`aspect-square border p-1 transition-colors ${
                        draft.art.sigil === sigil
                          ? 'border-blood text-blood-bright'
                          : 'border-smoke text-grave hover:border-iron'
                      }`}
                    >
                      <SigilMark sigil={sigil} className="h-full w-full" strokeWidth={4} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="label">Tinta</span>
                  <select
                    value={draft.art.tone}
                    onChange={(event) =>
                      updateArt({ tone: event.target.value as TeeArt['tone'] })
                    }
                    className="field text-xs"
                  >
                    <option value="bone">Osso</option>
                    <option value="blood">Sangue</option>
                  </select>
                </div>
                <div>
                  <span className="label">Tecido</span>
                  <select
                    value={draft.art.fabric}
                    onChange={(event) =>
                      updateArt({ fabric: event.target.value as TeeArt['fabric'] })
                    }
                    className="field text-xs"
                  >
                    <option value="preto">Preto</option>
                    <option value="carvao">Carvão</option>
                    <option value="off-white">Off-white</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Campos */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="label">Banda</span>
                <input
                  value={draft.band}
                  onChange={(event) => update({ band: event.target.value })}
                  className="field"
                  placeholder="Nordlys Grav"
                />
              </div>
              <div>
                <span className="label">Categoria</span>
                <select
                  value={draft.category}
                  onChange={(event) =>
                    update({ category: event.target.value as Category })
                  }
                  className="field"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="label">Nome da peça</span>
              <input
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                className="field"
                placeholder="Nordlys Grav — Under Frossen Himmel"
              />
            </div>

            <div>
              <span className="label">Descrição</span>
              <textarea
                value={draft.description}
                onChange={(event) => update({ description: event.target.value })}
                rows={3}
                className="field resize-y"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="label">Preço</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={draft.price}
                  onChange={(event) => update({ price: Number(event.target.value) })}
                  className="field tabular-nums"
                />
              </div>
              <div>
                <span className="label">Preço antigo</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={draft.oldPrice ?? ''}
                  onChange={(event) =>
                    update({
                      oldPrice: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  className="field tabular-nums"
                  placeholder="opcional"
                />
              </div>
              <div>
                <span className="label">Estoque mínimo</span>
                <input
                  type="number"
                  min={0}
                  value={draft.lowStockThreshold}
                  onChange={(event) =>
                    update({ lowStockThreshold: Number(event.target.value) })
                  }
                  disabled={madeToOrder}
                  className="field tabular-nums"
                />
              </div>
            </div>

            {/* Modo de fornecimento */}
            <div>
              <span className="label">Como esta peça é fornecida</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['pronta-entrega', 'Pronta-entrega', 'Sai do estoque físico'],
                    ['sob-encomenda', 'Sob encomenda', 'Produzida após a venda'],
                  ] as const
                ).map(([mode, title, hint]) => (
                  <button
                    key={mode}
                    onClick={() => update({ fulfillment: mode })}
                    className={`border p-3 text-left transition-colors ${
                      draft.fulfillment === mode
                        ? 'border-blood bg-blood/10'
                        : 'border-iron hover:border-blood/50'
                    }`}
                  >
                    <p className="heading-carved text-[0.58rem] text-bone">{title}</p>
                    <p className="mt-0.5 text-[0.62rem] text-grave">{hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {madeToOrder && (
              <div>
                <span className="label">Dias úteis de produção</span>
                <input
                  type="number"
                  min={1}
                  value={draft.productionDays ?? 10}
                  onChange={(event) =>
                    update({ productionDays: Number(event.target.value) })
                  }
                  className="field w-32 tabular-nums"
                />
              </div>
            )}

            <div>
              <span className="label">
                {madeToOrder ? 'Tamanhos fabricáveis' : 'Tamanhos na grade'}
              </span>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((size) => {
                  const on = madeToOrder
                    ? draft.madeToOrderSizes.includes(size)
                    : size in draft.stock;
                  return (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`min-w-12 border px-3 py-2 font-display text-xs font-bold transition-colors ${
                        on
                          ? 'border-blood bg-blood text-bone'
                          : 'border-iron text-grave hover:border-blood/50'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              {!madeToOrder && (
                <p className="mt-1.5 text-[0.62rem] text-grave">
                  As quantidades são ajustadas na aba Estoque.
                </p>
              )}
            </div>

            <div>
              <span className="label">Ficha técnica — uma linha por item</span>
              <textarea
                value={detailsText}
                onChange={(event) => setDetailsText(event.target.value)}
                rows={4}
                className="field resize-y font-mono text-[0.7rem]"
                placeholder={'Algodão 100% 180g/m²\nSerigrafia manual'}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[0.7rem] text-parchment">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => update({ active: event.target.checked })}
                className="h-3.5 w-3.5 accent-[#a5121b]"
              />
              Peça visível na loja
            </label>
          </div>
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-smoke bg-crypt/95 px-5 py-3.5 backdrop-blur">
          <button onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button onClick={submit} disabled={!valid} className="btn btn-blood">
            Salvar peça
          </button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function ConfirmDialog({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="anim-fade fixed inset-0 z-80 flex items-center justify-center bg-void/85 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="panel-raised anim-rise w-full max-w-sm p-6 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <SkullMark className="mx-auto h-10 w-10 text-ember" />
        <p className="mt-4 text-[0.78rem] leading-relaxed text-parchment">{message}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="btn btn-ghost flex-1">
            Cancelar
          </button>
          <button onClick={onConfirm} className="btn btn-blood flex-1">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
