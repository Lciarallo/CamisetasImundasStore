import { useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { ROLE_LABEL } from '../../types';
import { useStore } from '../../store/StoreContext';
import { SkullMark } from '../art/Sigils';
import { BrandLogo } from '../art/BrandLogo';

export function AdminLogin({ onBack }: { onBack: () => void }) {
  const { signIn, users } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    await new Promise((resolve) => window.setTimeout(resolve, 500));
    const result = signIn(email, password);
    if (!result.ok) setError(result.message);
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <SkullMark className="h-[80vh] w-auto text-bone" />
      </div>

      <div className="relative w-full max-w-sm">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-[0.7rem] text-grave hover:text-bone"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à loja
        </button>

        <form onSubmit={submit} className="panel-raised anim-rise p-7">
          <div className="text-center">
            <span className="inline-block text-blood-bright">
              <BrandLogo height={78} />
            </span>
            <h1 className="heading-carved mt-5 text-xs text-bone">Câmara dos Mestres</h1>
            <p className="mt-1.5 text-[0.7rem] text-grave">
              Acesso restrito ao painel da Camisetas Insanas
            </p>
          </div>

          <div className="mt-7 space-y-4">
            <div>
              <span className="label">E-mail</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="field"
                placeholder="voce@camisetasinsanas.com.br"
              />
            </div>
            <div>
              <span className="label">Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="field"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 border border-ember/50 bg-ember/10 px-3 py-2 text-[0.7rem] text-ember">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-blood mt-6 w-full">
            {busy ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Invocando
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Contas de demonstração — projeto fictício, sem dados reais. */}
        <div className="panel mt-4 p-4">
          <p className="heading-carved text-[0.55rem] text-grave">
            Contas de demonstração · senha “insanas”
          </p>
          <ul className="mt-3 space-y-1.5">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  onClick={() => {
                    setEmail(user.email);
                    setPassword('insanas');
                    setError('');
                  }}
                  disabled={!user.active}
                  className="flex w-full items-center justify-between gap-3 border border-smoke px-3 py-2 text-left transition-colors hover:border-blood/60 disabled:opacity-40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[0.7rem] text-parchment">
                      {user.email}
                    </span>
                    <span className="block text-[0.6rem] text-dust">
                      {ROLE_LABEL[user.role]} · {user.permissions.length} privilégios
                      {!user.active && ' · desativado'}
                    </span>
                  </span>
                  <span className="heading-carved shrink-0 text-[0.55rem] text-blood-bright">
                    usar
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
