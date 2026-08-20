import { useState } from 'react';
import { Pencil, Plus, Power, TicketPercent, Trash2, X } from 'lucide-react';
import type { Coupon } from '../../types';
import { money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { ConfirmDialog } from './ProductsAdmin';

const blankCoupon = (): Coupon => ({ code: '', percent: 10, minSubtotal: 0, active: false });

export function CouponsAdmin() {
  const { coupons, saveCoupon, deleteCoupon, can } = useStore();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const editable = can('products.edit');
  const sorted = [...coupons].sort((a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code));

  const toggle = async (coupon: Coupon) => {
    const result = await saveCoupon({ ...coupon, active: !coupon.active });
    setMessage({ ok: result.ok, text: result.message });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-smoke pb-4">
        <div>
          <h1 className="font-logo text-3xl text-bone">Cupons promocionais</h1>
          <p className="mt-1 max-w-xl text-[0.72rem] leading-relaxed text-grave">
            Crie campanhas para usar no carrinho. Cupons inativos ficam guardados, mas não concedem desconto.
            {!editable && ' · somente leitura'}
          </p>
        </div>
        {editable && (
          <button onClick={() => setEditing(blankCoupon())} className="btn btn-blood">
            <Plus className="h-3.5 w-3.5" />
            Novo cupom
          </button>
        )}
      </header>

      {message && (
        <div
          role="status"
          className={`border px-4 py-3 text-[0.72rem] ${
            message.ok
              ? 'border-emerald-900 bg-emerald-950/30 text-emerald-300'
              : 'border-ember/50 bg-ember/10 text-blood-bright'
          }`}
        >
          {message.text}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="panel flex flex-col items-center px-5 py-16 text-center">
          <TicketPercent className="h-11 w-11 text-iron" />
          <p className="mt-4 heading-carved text-[0.65rem] text-bone">Nenhuma campanha criada</p>
          <p className="mt-2 max-w-sm text-[0.72rem] leading-relaxed text-grave">
            A loja está sem cupons ativos. Crie um quando quiser iniciar uma promoção.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((coupon) => (
            <li
              key={coupon.code}
              className={`relative overflow-hidden border border-dashed p-5 ${
                coupon.active
                  ? 'border-blood bg-blood/8'
                  : 'border-iron bg-pitch opacity-70'
              }`}
            >
              <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-r border-smoke bg-void" />
              <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-l border-smoke bg-void" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-bold tracking-[0.14em] text-bone">{coupon.code}</p>
                  <p className={`mt-1 text-[0.62rem] font-semibold uppercase tracking-wider ${coupon.active ? 'text-emerald-400' : 'text-grave'}`}>
                    {coupon.active ? 'Ativo na loja' : 'Inativo'}
                  </p>
                </div>
                <span className="font-display text-3xl font-bold text-blood-bright tabular-nums">
                  {coupon.percent}%
                </span>
              </div>

              <div className="mt-5 border-t border-dashed border-iron pt-3 text-[0.7rem] text-grave">
                Pedido mínimo:{' '}
                <strong className="font-normal text-parchment">
                  {coupon.minSubtotal > 0 ? money(coupon.minSubtotal) : 'sem mínimo'}
                </strong>
              </div>

              {editable && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => void toggle(coupon)} className="btn btn-ghost flex-1 px-3 py-2">
                    <Power className="h-3.5 w-3.5" />
                    {coupon.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => setEditing(coupon)} className="btn btn-ghost px-3 py-2" aria-label={`Editar ${coupon.code}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setConfirmDelete(coupon.code)} className="btn btn-ghost px-3 py-2 text-ember" aria-label={`Excluir ${coupon.code}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CouponEditor
          coupon={editing}
          existing={coupons.some((coupon) => coupon.code === editing.code)}
          onClose={() => setEditing(null)}
          onSave={async (coupon) => {
            const result = await saveCoupon(coupon);
            setMessage({ ok: result.ok, text: result.message });
            if (result.ok) setEditing(null);
            return result.ok;
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Excluir o cupom ${confirmDelete}? Pedidos antigos continuam preservados, mas o código deixa de funcionar.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const code = confirmDelete;
            setConfirmDelete(null);
            const result = await deleteCoupon(code);
            setMessage({ ok: result.ok, text: result.message });
          }}
        />
      )}
    </div>
  );
}

function CouponEditor({
  coupon,
  existing,
  onClose,
  onSave,
}: {
  coupon: Coupon;
  existing: boolean;
  onClose: () => void;
  onSave: (coupon: Coupon) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(coupon);
  const [saving, setSaving] = useState(false);
  const codeValid = /^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(draft.code);
  const valid = codeValid && draft.percent > 0 && draft.percent <= 80 && draft.minSubtotal >= 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const saved = await onSave(draft);
    if (!saved) setSaving(false);
  };

  return (
    <div className="anim-fade fixed inset-0 z-70 flex items-end justify-center bg-void/85 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="coupon-editor-title">
      <form className="panel-raised anim-rise w-full max-w-lg" onSubmit={(event) => { event.preventDefault(); void submit(); }} onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-smoke px-5 py-4">
          <div>
            <h2 id="coupon-editor-title" className="heading-carved text-[0.65rem] text-bone">
              {existing ? `Editar ${coupon.code}` : 'Novo cupom'}
            </h2>
            <p className="mt-1 text-[0.62rem] text-grave">O desconto só aparece na loja depois da ativação.</p>
          </div>
          <button type="button" onClick={onClose} className="text-grave hover:text-bone" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="coupon-code" className="label">Código</label>
            <input id="coupon-code" name="coupon-code" value={draft.code} disabled={existing} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24) })} className="field font-mono tracking-wider uppercase" placeholder="BLACKFRIDAY" autoComplete="off" required />
            {!existing && draft.code && !codeValid && <p className="mt-1.5 text-[0.62rem] text-blood-bright">Use pelo menos 3 caracteres.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="coupon-percent" className="label">Desconto (%)</label>
              <input id="coupon-percent" name="coupon-percent" type="number" min="1" max="80" step="0.01" value={draft.percent} onChange={(event) => setDraft({ ...draft, percent: Number(event.target.value) })} className="field tabular-nums" required />
            </div>
            <div>
              <label htmlFor="coupon-minimum" className="label">Pedido mínimo (R$)</label>
              <input id="coupon-minimum" name="coupon-minimum" type="number" min="0" max="100000" step="0.01" value={draft.minSubtotal} onChange={(event) => setDraft({ ...draft, minSubtotal: Number(event.target.value) })} className="field tabular-nums" required />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 border border-iron bg-pitch p-3 text-[0.72rem] text-parchment">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#a5121b]" />
            <span><strong className="block text-bone">Ativar imediatamente</strong><span className="text-grave">Visitantes poderão aplicar este código no carrinho.</span></span>
          </label>
        </div>

        <footer className="flex justify-end gap-3 border-t border-smoke px-5 py-4">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={!valid || saving} className="btn btn-blood">{saving ? 'Salvando...' : 'Salvar cupom'}</button>
        </footer>
      </form>
    </div>
  );
}
