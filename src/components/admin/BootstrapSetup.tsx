import { useState } from 'react';
import { LoaderCircle, ShieldHalf } from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { BrandLogo } from '../art/BrandLogo';

/**
 * Instalação inicial.
 *
 * Aparece só enquanto o banco está vazio. Cria o primeiro Mestre e popula o
 * catálogo — a função por trás se recusa a rodar depois que existe qualquer
 * administrador, então esta tela não é uma porta aberta.
 */
export function BootstrapSetup({ onDone }: { onDone: () => void }) {
  const { bootstrap } = useStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid = name.trim().length >= 2 && email.includes('@') && password.length >= 6;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;

    setBusy(true);
    setError('');
    const result = await bootstrap({ name: name.trim(), email: email.trim(), password });
    setBusy(false);

    if (result.ok) onDone();
    else setError(result.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="panel-raised anim-rise w-full max-w-md p-7">
        <div className="text-center text-bone">
          <BrandLogo height={72} />
        </div>

        <div className="mt-6 text-center">
          <p className="heading-carved flex items-center justify-center gap-2 text-xs text-blood-bright">
            <ShieldHalf className="h-3.5 w-3.5" />
            Instalação
          </p>
          <p className="mt-2 text-[0.75rem] leading-relaxed text-parchment">
            A loja está vazia. Crie a conta do <strong className="text-bone">Mestre</strong> —
            ela terá domínio absoluto e não poderá ser rebaixada nem removida. O catálogo
            inicial é carregado junto.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="bootstrap-name">Seu nome</label>
            <input
              id="bootstrap-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="field"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="label" htmlFor="bootstrap-email">E-mail</label>
            <input
              id="bootstrap-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="field"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label" htmlFor="bootstrap-password">Senha (mínimo 6 caracteres)</label>
            <input
              id="bootstrap-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="field"
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 border border-ember/50 bg-ember/10 px-3 py-2 text-[0.7rem] text-ember">
            {error}
          </p>
        )}

        <button type="submit" disabled={!valid || busy} className="btn btn-blood mt-6 w-full">
          {busy ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Consagrando
            </>
          ) : (
            'Instalar a loja'
          )}
        </button>

        <p className="mt-4 text-[0.62rem] leading-relaxed text-dust">
          Esta tela desaparece assim que houver um administrador. A senha é guardada
          pelo Firebase Auth, com hash — nunca em texto puro.
        </p>
      </form>
    </div>
  );
}
