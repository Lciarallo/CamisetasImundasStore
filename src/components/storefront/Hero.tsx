import { ArrowDown } from 'lucide-react';
import { SigilMark } from '../art/Sigils';

export function Hero({ onExplore }: { onExplore: () => void }) {
  return (
    <section
      id="topo"
      className="relative overflow-hidden border-b border-smoke bg-void"
      aria-labelledby="hero-title"
    >
      {/* Sigilo gigante ao fundo, girando devagar */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.055]">
        <SigilMark
          sigil="pentagram"
          className="h-[130%] w-auto text-bone"
          strokeWidth={0.6}
        />
      </div>

      {/* Névoa subindo do rodapé da seção */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent" />

      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center md:px-8 md:py-36">
        <p className="heading-carved anim-fade mb-6 text-[0.62rem] text-blood-bright">
          Est. MMXIX · Culto ao vinil e ao algodão preto
        </p>

        <h1
          id="hero-title"
          className="font-logo text-5xl leading-[0.95] text-bone text-engraved sm:text-6xl md:text-8xl"
        >
          Vestidos
          <br />
          <span className="text-bleed text-blood-bright">para o fim</span>
        </h1>

        <p
          className="mx-auto mt-8 max-w-xl text-[0.95rem] leading-relaxed text-parchment"
        >
          Camisetas, manga longa e moletons de black metal. Serigrafia manual,
          tiragem curta e peças sob encomenda para quem chegou tarde ao culto.
        </p>

        <div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <button onClick={onExplore} className="btn btn-bone w-full sm:w-auto">
            Ver o catálogo
          </button>
          <a href="#sob-encomenda" className="btn btn-ghost w-full sm:w-auto">
            Como funciona a encomenda
          </a>
        </div>

        {/* Números da loja */}
        <dl className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-px border border-smoke bg-smoke">
          {[
            ['66', 'bandas no acervo'],
            ['12k', 'peças despachadas'],
            ['4,8', 'nota dos clientes'],
          ].map(([value, label]) => (
            <div key={label} className="bg-crypt px-3 py-5">
              <dt className="font-display text-2xl font-bold text-bone tabular-nums">{value}</dt>
              <dd className="heading-carved mt-1 text-[0.55rem] text-grave">{label}</dd>
            </div>
          ))}
        </dl>

        <button
          onClick={onExplore}
          className="mt-14 inline-flex flex-col items-center gap-2 text-grave transition-colors hover:text-blood-bright"
          aria-label="Desça para o catálogo"
        >
          <span className="heading-carved text-[0.55rem]">Desça</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </button>
      </div>
    </section>
  );
}
