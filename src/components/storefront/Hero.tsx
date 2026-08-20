import { ArrowDown } from 'lucide-react';
import { SigilMark } from '../art/Sigils';

export function Hero({ onExplore }: { onExplore: () => void }) {
  return (
    <section
      id="topo"
      className="relative overflow-hidden border-b border-smoke bg-void"
      aria-labelledby="hero-title"
    >
      {/* Sigilo ritualístico ao fundo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <SigilMark
          sigil="pentagram"
          className="h-[130%] w-auto text-bone"
          strokeWidth={0.5}
        />
      </div>

      {/* Névoa suave na base */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-void to-transparent" />

      <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-24 md:py-32 md:px-8">
        {/* Anti-UI-Slop: O H1 é o primeiro elemento textual visível, sem eyebrows decorativos ou dots pulsantes */}
        <h1
          id="hero-title"
          className="font-logo text-4xl leading-[0.95] text-bone text-engraved sm:text-6xl md:text-8xl"
        >
          Vestidos
          <br />
          <span className="text-bleed text-blood-bright">para o fim</span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-parchment sm:text-base text-balance"
        >
          Camisetas de black metal e dark underground em malha <strong className="text-bone font-medium">100% Algodão Penteado Puro (180–190g/m²)</strong>.
          Serigrafia artesanal de alta durabilidade e peças sob encomenda para o culto.
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

        <button
          onClick={onExplore}
          className="mt-14 inline-flex flex-col items-center gap-1.5 text-grave transition-colors hover:text-blood-bright"
          aria-label="Descer para o catálogo"
        >
          <span className="heading-carved text-[0.55rem]">Desça para o acervo</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </button>
      </div>
    </section>
  );
}
