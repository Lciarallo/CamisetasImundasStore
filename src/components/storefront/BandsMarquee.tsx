import { memo } from 'react';

interface BandsMarqueeProps {
  bands: string[];
  selectedBand: string;
  onSelectBand: (band: string) => void;
}

const DEFAULT_BANDS = [
  'Mütiilation',
  'Emperor',
  'Blasphemy',
  'Summoning',
  'Darkthrone',
  'Mayhem',
  'Bathory',
  'Burzum',
  'Gorgoroth',
  'Immortal',
  'Sargeist',
  'Behemoth',
  'Dissection',
  'Rotting Christ',
];

export const BandsMarquee = memo(function BandsMarquee({
  bands = DEFAULT_BANDS,
  selectedBand,
  onSelectBand,
}: BandsMarqueeProps) {
  const displayBands = bands.length > 0 ? bands : DEFAULT_BANDS;
  // Duplica a lista para rolagem infinita suave sem quebra visual
  const loop = [...displayBands, ...displayBands, ...displayBands];

  return (
    <div className="relative w-full overflow-hidden border-y border-smoke bg-pitch/80 py-3.5 select-none">
      {/* Gradientes de fade nas laterais (estilo skills.sh) */}
      <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-16 sm:w-32 bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute top-0 bottom-0 right-0 z-10 w-16 sm:w-32 bg-gradient-to-l from-void to-transparent" />

      <div className="flex w-max animate-marquee gap-3 sm:gap-4 hover:[animation-play-state:paused]">
        {loop.map((band, idx) => {
          const isSelected = selectedBand.toLowerCase() === band.toLowerCase();
          return (
            <button
              key={`${band}-${idx}`}
              type="button"
              onClick={() => onSelectBand(band)}
              className={`flex items-center rounded border px-3.5 py-1 font-display text-[0.68rem] tracking-wider transition-all duration-200 ${
                isSelected
                  ? 'border-blood bg-blood text-bone shadow-sm'
                  : 'border-smoke bg-crypt/60 text-grave hover:border-blood/80 hover:bg-crypt hover:text-bone'
              }`}
            >
              <span className="uppercase">{band}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
