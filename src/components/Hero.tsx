import React from 'react';
import { ArrowRight, ShieldCheck, Zap, Truck, Sparkles } from 'lucide-react';

interface HeroProps {
  onExplore: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExplore }) => {
  return (
    <div className="relative overflow-hidden bg-zinc-950 border-b border-zinc-800/80 py-12 md:py-20 px-4 md:px-8">
      {/* Background Glow Overlay */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left Column: Text & CTA */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-400/10 border border-lime-400/30 text-lime-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Coleção Drop #04 — Caos Urbano</span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-[0.95] text-white">
            VESTINDO O <span className="text-lime-400 text-glow block mt-1">CAOS URBANO</span>
          </h2>

          <p className="text-zinc-400 text-base md:text-lg max-w-xl font-normal leading-relaxed">
            Camisetas de alta gramatura (260g/m²), modelagem oversized e estampas autorais underground. 
            Sem clichês, sem modismo passageiro — apenas streetwear de verdade.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button onClick={onExplore} className="btn-primary py-3.5 px-7 text-sm font-extrabold shadow-lg shadow-lime-400/20">
              EXPLORAR CATÁLOGO
              <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#lancamentos" className="btn-secondary py-3.5 px-6 text-sm font-bold">
              VER NOVIDADES
            </a>
          </div>

          {/* Value Props Bar */}
          <div className="pt-8 border-t border-zinc-800/80 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-900 text-lime-400 border border-zinc-800">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">100% Algodão 260g</h4>
                <p className="text-[11px] text-zinc-400">Malha pesada e macia</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-900 text-lime-400 border border-zinc-800">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Envio Expresso</h4>
                <p className="text-[11px] text-zinc-400">Despacho em 24 horas</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-900 text-lime-400 border border-zinc-800">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Troca Simplificada</h4>
                <p className="text-[11px] text-zinc-400">Até 30 dias sem custos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual Card Showcase */}
        <div className="lg:col-span-5 relative">
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900 group">
            <img
              src="https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80"
              alt="Camiseta Streetwear Imunda Banner"
              className="w-full h-[380px] sm:h-[450px] object-cover object-center group-hover:scale-105 transition-transform duration-500 filter brightness-90 contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

            <div className="absolute bottom-6 left-6 right-6 p-5 glass-panel rounded-xl border border-zinc-700/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="badge-tag badge-bestseller">DROP EXCLUSIVO</span>
                <span className="text-lime-400 font-extrabold text-lg">R$ 139,90</span>
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wide">Anarchy & Chaos Oversized</h3>
              <p className="text-xs text-zinc-400 line-clamp-1">Modelagem boxy underground com silk screen em alto relevo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
