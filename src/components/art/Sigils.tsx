import type { Sigil } from '../../types';

/**
 * Sigilos desenhados em SVG puro, num viewBox 0 0 100 100 comum a todos.
 * Usam `currentColor` para herdar a cor de quem os renderiza — assim o mesmo
 * traço serve de estampa branca na camiseta e de ícone vermelho no admin.
 */

/**
 * Aceita props de SVG (x/y/width/height) porque o sigilo também é embutido
 * dentro de outro SVG — a estampa da camiseta —, onde herdar tamanho não serve.
 */
type SigilProps = Omit<React.SVGProps<SVGSVGElement>, 'viewBox' | 'strokeWidth'> & {
  strokeWidth?: number;
};

const base = (strokeWidth = 2) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

function Pentagram({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <circle cx="50" cy="50" r="38" {...base(strokeWidth)} />
      <circle cx="50" cy="50" r="33" {...base(strokeWidth)} opacity="0.45" />
      {/* Estrela invertida: ponta única voltada para baixo. */}
      <path d="M50 88 L27.7 19.4 L86.1 61.8 L13.9 61.8 L72.3 19.4 Z" {...base(strokeWidth)} />
    </svg>
  );
}

function Skull({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <path
        d="M50 12c-19 0-33 13.8-33 32.5 0 9.9 3.9 16.8 9.3 21.4 2.1 1.8 3 3 3.3 5.1l.8 6c.3 2.6 2.4 4.5 5 4.5h29.2c2.6 0 4.7-1.9 5-4.5l.8-6c.3-2.1 1.2-3.3 3.3-5.1C78.1 61.3 82 54.4 82 44.5 82 25.8 68 12 50 12Z"
        {...base(strokeWidth)}
      />
      <ellipse cx="36" cy="45" rx="9" ry="10.5" fill="currentColor" />
      <ellipse cx="64" cy="45" rx="9" ry="10.5" fill="currentColor" />
      <path d="M50 56c2.6 0 5 3.7 5 6.6S52.6 66 50 66s-5-1.3-5-3.4S47.4 56 50 56Z" fill="currentColor" />
      <path d="M40 71v10M50 71v10M60 71v10" {...base(strokeWidth)} />
    </svg>
  );
}

function Cross({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      {/* Cruz invertida: travessa no terço inferior. */}
      <path d="M50 8v84M28 68h44" {...base((strokeWidth ?? 2) * 2)} />
      <circle cx="50" cy="50" r="40" {...base(strokeWidth)} opacity="0.3" />
    </svg>
  );
}

function Goat({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <circle cx="50" cy="52" r="38" {...base(strokeWidth)} opacity="0.4" />
      {/* Baphomet estilizado: chifres + focinho triangular. */}
      <path d="M22 28c-4 12 2 24 12 30" {...base(strokeWidth)} />
      <path d="M78 28c4 12-2 24-12 30" {...base(strokeWidth)} />
      <path d="M22 28c6-4 12-3 15 2M78 28c-6-4-12-3-15 2" {...base(strokeWidth)} />
      <path d="M34 44 L50 84 L66 44 Z" {...base(strokeWidth)} />
      <path d="M42 54h5M53 54h5" {...base(strokeWidth)} />
      <path d="M50 30v10" {...base(strokeWidth)} />
    </svg>
  );
}

function Tree({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <path d="M50 92V38" {...base(strokeWidth)} />
      <path
        d="M50 38 32 20M50 38l18-18M50 52 30 38M50 52l20-14M50 66 34 56M50 66l16-10"
        {...base(strokeWidth)}
      />
      {/* Raízes espelhando os galhos. */}
      <path d="M50 92c-8 0-14-4-20-10M50 92c8 0 14-4 20-10" {...base(strokeWidth)} opacity="0.6" />
      <circle cx="50" cy="26" r="7" {...base(strokeWidth)} />
    </svg>
  );
}

function Moon({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <path d="M62 12a40 40 0 1 0 0 76 44 44 0 0 1 0-76Z" {...base(strokeWidth)} />
      <path d="M28 34c4 0 7 3 7 7M30 62c5 0 9 4 9 9" {...base(strokeWidth)} opacity="0.55" />
      <circle cx="76" cy="26" r="2.5" fill="currentColor" />
      <circle cx="84" cy="46" r="1.8" fill="currentColor" />
      <circle cx="72" cy="72" r="2" fill="currentColor" />
    </svg>
  );
}

function Chalice({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <path d="M28 22h44c0 20-8 32-22 34-14-2-22-14-22-34Z" {...base(strokeWidth)} />
      <path d="M50 56v20M34 84h32M50 76c-8 0-16 3-16 8M50 76c8 0 16 3 16 8" {...base(strokeWidth)} />
      <path d="M36 30h28" {...base(strokeWidth)} opacity="0.5" />
      {/* Gotas transbordando. */}
      <path d="M42 62c0 3-2 4-2 6M58 62c0 3 2 4 2 6" {...base(strokeWidth)} opacity="0.6" />
    </svg>
  );
}

function Raven({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <path d="M18 44c14-10 26-8 34 2 8-10 20-12 34-2-8 2-12 6-14 12 6 2 9 6 10 12-10-4-18-2-24 4-4 4-6 10-8 18-2-8-4-14-8-18-6-6-14-8-24-4 1-6 4-10 10-12-2-6-6-10-14-12Z" {...base(strokeWidth)} />
      <circle cx="50" cy="54" r="2.5" fill="currentColor" />
      <path d="M50 20v14" {...base(strokeWidth)} opacity="0.5" />
    </svg>
  );
}

function Sword({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <path d="M50 6 58 26v40l-8 12-8-12V26Z" {...base(strokeWidth)} />
      <path d="M30 78h40M50 78v16M40 94h20" {...base(strokeWidth)} />
      <path d="M50 26v46" {...base(strokeWidth)} opacity="0.45" />
    </svg>
  );
}

function Eye({ strokeWidth, ...rest }: SigilProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...rest}>
      <path d="M8 50c14-20 28-30 42-30s28 10 42 30c-14 20-28 30-42 30S22 70 8 50Z" {...base(strokeWidth)} />
      <circle cx="50" cy="50" r="14" {...base(strokeWidth)} />
      <circle cx="50" cy="50" r="6" fill="currentColor" />
      {/* Raios saindo da íris. */}
      <path d="M50 8v8M50 84v8M14 26l6 5M86 26l-6 5M14 74l6-5M86 74l-6-5" {...base(strokeWidth)} opacity="0.5" />
    </svg>
  );
}

const REGISTRY: Record<Sigil, (p: SigilProps) => React.ReactElement> = {
  pentagram: Pentagram,
  skull: Skull,
  cross: Cross,
  goat: Goat,
  tree: Tree,
  moon: Moon,
  chalice: Chalice,
  raven: Raven,
  sword: Sword,
  eye: Eye,
};

export function SigilMark({ sigil, ...rest }: { sigil: Sigil } & SigilProps) {
  const Component = REGISTRY[sigil];
  return <Component {...rest} />;
}

/** Caveira sólida usada como marca da loja (logo, estados vazios, carregamento). */
export function SkullMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M32 4C18.7 4 8.5 13.9 8.5 27.2c0 7 2.8 12 6.6 15.3 1.5 1.3 2.2 2.2 2.4 3.7l.6 4.4c.3 2.2 2.1 3.8 4.3 3.8h20.2c2.2 0 4-1.6 4.3-3.8l.6-4.4c.2-1.5.9-2.4 2.4-3.7 3.8-3.3 6.6-8.3 6.6-15.3C55.5 13.9 45.3 4 32 4Z"
      />
      <ellipse cx="22.5" cy="28" rx="6.6" ry="7.8" className="fill-void" />
      <ellipse cx="41.5" cy="28" rx="6.6" ry="7.8" className="fill-void" />
      <path
        d="M32 35c1.9 0 3.6 2.7 3.6 4.8S34.1 42.4 32 42.4s-3.6-.9-3.6-2.6S30.1 35 32 35Z"
        className="fill-void"
      />
      <path d="M24 47h2.6v7.4H24zm5.7 0h2.6v7.4h-2.6zm5.7 0H38v7.4h-2.6z" className="fill-void" />
    </svg>
  );
}
