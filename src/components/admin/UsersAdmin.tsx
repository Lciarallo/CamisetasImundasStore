import { useState } from 'react';
import { Plus, ShieldHalf, Trash2, X } from 'lucide-react';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABEL,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  type AdminUser,
  type Permission,
  type Role,
} from '../../types';
import { formatDate, timeAgo } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { ConfirmDialog } from './ProductsAdmin';

const ROLES: Role[] = ['mestre', 'necromante', 'acolito', 'servo'];

/**
 * Privilégios de edição exigem o de visualização correspondente.
 *
 * As abas do painel (Catálogo, Estoque, Pedidos, Usuários) são gateadas pelo
 * privilégio de visualização — sem ele, a aba nem aparece, e o privilégio de
 * edição fica concedido mas inacessível.
 */
const PERMISSION_REQUIRES: Partial<Record<Permission, Permission>> = {
  'products.edit': 'products.view',
  'stock.edit': 'products.view',
  'orders.edit': 'orders.view',
  'users.edit': 'users.view',
};

const blankUser = (): AdminUser => ({
  id: `u-${Date.now().toString(36)}`,
  name: '',
  email: '',
  password: 'insanas',
  role: 'servo',
  permissions: [...ROLE_PERMISSIONS.servo],
  active: true,
  createdAt: new Date().toISOString(),
});

export function UsersAdmin() {
  const { users, saveUser, deleteUser, session, can } = useStore();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState('');

  const editable = can('users.edit');

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-logo text-3xl text-bone">Usuários e privilégios</h1>
          <p className="mt-1 text-[0.72rem] text-grave">
            {users.length} contas no culto
            {!editable && ' · somente leitura'}
          </p>
        </div>
        {editable && (
          <button onClick={() => setEditing(blankUser())} className="btn btn-blood">
            <Plus className="h-3.5 w-3.5" />
            Novo usuário
          </button>
        )}
      </header>

      {notice && (
        <p className="border border-blood/50 bg-blood/10 px-3 py-2 text-[0.7rem] text-parchment">
          {notice}
        </p>
      )}

      {/* Referência dos cargos */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((role) => (
          <div key={role} className="panel p-3">
            <p className="heading-carved flex items-center gap-1.5 text-[0.58rem] text-bone">
              <ShieldHalf className="h-3 w-3 text-blood-bright" />
              {ROLE_LABEL[role]}
            </p>
            <p className="mt-1.5 text-[0.62rem] leading-relaxed text-grave">
              {ROLE_DESCRIPTION[role]}
            </p>
            <p className="mt-2 text-[0.58rem] text-dust tabular-nums">
              {ROLE_PERMISSIONS[role].length} de {ALL_PERMISSIONS.length} privilégios
            </p>
          </div>
        ))}
      </section>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-smoke">
              {['Nome', 'Cargo', 'Privilégios', 'Situação', 'Último acesso', ''].map(
                (header) => (
                  <th
                    key={header}
                    className="heading-carved px-4 py-3 text-[0.55rem] text-grave"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-smoke">
            {users.map((user) => {
              const isMe = user.id === session?.id;
              return (
                <tr key={user.id} className="transition-colors hover:bg-ash/50">
                  <td className="px-4 py-3">
                    <p className="text-[0.72rem] text-bone">
                      {user.name}
                      {isMe && <span className="ml-1.5 text-[0.6rem] text-blood-bright">você</span>}
                    </p>
                    <p className="text-[0.6rem] text-dust">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="tag border-iron text-parchment">
                      {ROLE_LABEL[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[0.68rem] text-grave tabular-nums">
                    {user.permissions.length}/{ALL_PERMISSIONS.length}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[0.65rem] ${user.active ? 'text-parchment' : 'text-dust'}`}
                    >
                      {user.active ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[0.62rem] text-dust">
                    {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'nunca'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editable ? (
                      <>
                        <button
                          onClick={() => setEditing(user)}
                          className="text-[0.62rem] text-grave hover:text-blood-bright"
                        >
                          editar
                        </button>
                        {user.role !== 'mestre' && !isMe && (
                          <button
                            onClick={() => setConfirmDelete(user)}
                            className="ml-3 text-dust hover:text-ember"
                            aria-label={`Remover ${user.name}`}
                          >
                            <Trash2 className="inline h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[0.6rem] text-dust">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <UserEditor
          user={editing}
          isSelf={editing.id === session?.id}
          onClose={() => setEditing(null)}
          onSave={async (next, newPassword) => {
            const res = await saveUser(next, newPassword);
            setEditing(null);
            setNotice(res.message || `${next.name} salvo com ${next.permissions.length} privilégios.`);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Banir ${confirmDelete.name} do culto? A conta some do painel.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const result = await deleteUser(confirmDelete.id);
            setNotice(result.message);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function UserEditor({
  user,
  isSelf,
  onClose,
  onSave,
}: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
  onSave: (user: AdminUser, newPassword?: string) => void;
}) {
  const isNew = Boolean(!user.id || user.id.startsWith('u-'));
  const [draft, setDraft] = useState<AdminUser>({
    ...user,
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'servo',
    permissions: Array.isArray(user.permissions)
      ? [...user.permissions]
      : [...(ROLE_PERMISSIONS[user.role || 'servo'] || [])],
    active: user.active !== false,
  });
  const [password, setPassword] = useState('');
  const update = (patch: Partial<AdminUser>) => setDraft((prev) => ({ ...prev, ...patch }));

  const isMaster = user.role === 'mestre';
  const validPassword = isNew ? password.length >= 6 : (password.length === 0 || password.length >= 6);
  const valid = draft.name.trim().length >= 2 && draft.email.includes('@') && validPassword;

  /** Trocar o cargo redefine os privilégios para o padrão dele. */
  const changeRole = (role: Role) =>
    update({ role, permissions: [...ROLE_PERMISSIONS[role]] });

  const togglePermission = (permission: Permission) => {
    const has = draft.permissions.includes(permission);
    if (has) {
      // Desligar uma visão desliga junto quem depende dela — senão sobra um
      // privilégio de edição sem aba pra usá-lo.
      const dependents = ALL_PERMISSIONS.filter((p) => PERMISSION_REQUIRES[p] === permission);
      update({
        permissions: draft.permissions.filter(
          (p) => p !== permission && !dependents.includes(p),
        ),
      });
    } else {
      const required = PERMISSION_REQUIRES[permission];
      const next = new Set(draft.permissions);
      next.add(permission);
      if (required) next.add(required);
      update({ permissions: [...next] });
    }
  };

  const roleDefaults = ROLE_PERMISSIONS[draft.role] || [];
  const isCustomized =
    draft.permissions.length !== roleDefaults.length ||
    draft.permissions.some((p) => !roleDefaults.includes(p));

  return (
    <div
      className="anim-fade fixed inset-0 z-70 flex items-end justify-center bg-void/85 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Editar usuário"
    >
      <div
        className="panel-raised anim-rise flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-smoke bg-crypt/95 px-5 py-3.5 backdrop-blur">
          <h2 className="heading-carved text-[0.62rem] text-bone">
            {isNew ? 'Novo usuário' : `Editar ${user.name || 'usuário'}`}
            {isSelf && <span className="ml-2 text-[0.6rem] text-blood-bright">(sua conta)</span>}
          </h2>
          <button onClick={onClose} className="text-grave hover:text-bone" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">Nome</span>
              <input
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                className="field"
                placeholder="Nome do integrante"
              />
            </div>
            <div>
              <span className="label">E-mail</span>
              <input
                type="email"
                value={draft.email}
                onChange={(event) => update({ email: event.target.value })}
                className="field"
                placeholder="email@dominio.com"
              />
            </div>
          </div>

          <div>
            <span className="label">
              {isNew ? 'Senha (mínimo 6 caracteres)' : 'Nova senha (opcional)'}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isNew ? 'Digite uma senha segura' : 'Deixe em branco para manter a senha atual'}
              className="field font-mono text-xs"
            />
            <p className="mt-1 text-[0.6rem] text-dust">
              {isNew
                ? 'A senha será vinculada à autenticação do Firebase Auth.'
                : 'Preencha apenas caso deseje redefinir a senha deste usuário.'}
            </p>
          </div>

          {/* Cargo */}
          <div>
            <span className="label">Cargo</span>
            {isMaster ? (
              <p className="border border-smoke bg-pitch px-3 py-2.5 text-[0.7rem] text-grave">
                <strong className="text-bone">Mestre.</strong> O cargo não pode ser
                alterado — a loja precisa de pelo menos um dono absoluto.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.filter((role) => role !== 'mestre').map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => changeRole(role)}
                    className={`border p-3 text-left transition-colors ${
                      draft.role === role
                        ? 'border-blood bg-blood/10'
                        : 'border-iron hover:border-blood/50'
                    }`}
                  >
                    <p className="heading-carved text-[0.58rem] text-bone">
                      {ROLE_LABEL[role]}
                    </p>
                    <p className="mt-0.5 text-[0.6rem] leading-snug text-grave">
                      {ROLE_DESCRIPTION[role]}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Privilégios */}
          <div>
            <span className="label flex items-baseline justify-between gap-2">
              Privilégios
              {isCustomized && !isMaster && (
                <button
                  type="button"
                  onClick={() => changeRole(draft.role)}
                  className="text-[0.6rem] normal-case text-blood-bright hover:underline"
                >
                  restaurar padrão do cargo
                </button>
              )}
            </span>

            <div className="grid gap-1.5 sm:grid-cols-2">
              {ALL_PERMISSIONS.map((permission) => {
                const on = draft.permissions.includes(permission);
                return (
                  <label
                    key={permission}
                    className={`flex cursor-pointer items-center gap-2.5 border px-3 py-2 text-[0.68rem] transition-colors ${
                      on
                        ? 'border-blood/50 bg-blood/5 text-bone'
                        : 'border-smoke text-grave hover:border-iron'
                    } ${isMaster ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={isMaster}
                      onChange={() => togglePermission(permission)}
                      className="h-3.5 w-3.5 accent-[#a5121b]"
                    />
                    {PERMISSION_LABEL[permission]}
                  </label>
                );
              })}
            </div>
            {isMaster && (
              <p className="mt-1.5 text-[0.6rem] text-dust">
                O Mestre tem todos os privilégios por definição.
              </p>
            )}
          </div>

          <label
            className={`flex items-center gap-2 text-[0.7rem] ${
              isMaster || isSelf ? 'cursor-not-allowed text-dust' : 'cursor-pointer text-parchment'
            }`}
          >
            <input
              type="checkbox"
              checked={draft.active}
              disabled={isMaster || isSelf}
              onChange={(event) => update({ active: event.target.checked })}
              className="h-3.5 w-3.5 accent-[#a5121b]"
            />
            Conta ativa
            {isSelf && <span className="text-[0.6rem]">(não dá para se desativar)</span>}
          </label>

          <p className="border-t border-smoke pt-3 text-[0.6rem] text-dust">
            {draft.createdAt && `Criado em ${formatDate(draft.createdAt)}`}
            {draft.lastLoginAt && ` · último acesso ${timeAgo(draft.lastLoginAt)}`}
          </p>
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-smoke bg-crypt/95 px-5 py-3.5 backdrop-blur">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(draft, password.trim() || undefined)}
            disabled={!valid}
            className="btn btn-blood"
          >
            Salvar usuário
          </button>
        </footer>
      </div>
    </div>
  );
}
