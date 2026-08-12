import type { TeeArt } from '../../types';
import { SigilMark } from './Sigils';

const FABRIC: Record<TeeArt['fabric'], { body: string; shade: string; seam: string }> = {
  preto: { body: '#101013', shade: '#08080a', seam: '#26262e' },
  carvao: { body: '#1d1d22', shade: '#131317', seam: '#33333d' },
  'off-white': { body: '#d8d4c8', shade: '#c0bcb0', seam: '#a8a496' },
};

/**
 * Desenha a camiseta com a estampa aplicada. O recorte do tecido é um único
 * path; a estampa entra por cima como um `foreignObject`-livre — só um <g>
 * escalado, para manter tudo em SVG e nítido em qualquer tamanho.
 */
export function TeeArtwork({
  art,
  band,
  className,
  showBandName = true,
}: {
  art: TeeArt;
  band: string;
  className?: string;
  showBandName?: boolean;
}) {
  const fabric = FABRIC[art.fabric];
  const ink = art.tone === 'blood' ? '#b3151f' : '#e8e5dd';
  // Em tecido claro a estampa clara sumiria — invertemos para tinta preta.
  const printColor = art.fabric === 'off-white' && art.tone === 'bone' ? '#15151a' : ink;

  return (
    <svg viewBox="0 0 300 340" className={className} role="img" aria-label={`Camiseta ${band}`}>
      <defs>
        <linearGradient id={`fold-${art.sigil}-${art.fabric}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={fabric.shade} />
          <stop offset="22%" stopColor={fabric.body} />
          <stop offset="78%" stopColor={fabric.body} />
          <stop offset="100%" stopColor={fabric.shade} />
        </linearGradient>
      </defs>

      {/* Corpo da peça: ombros, mangas e barra num contorno só. */}
      <path
        d="M110 26 L74 40 L26 74 L54 118 L78 104 L78 314 Q150 322 222 314 L222 104 L246 118 L274 74 L226 40 L190 26 Q150 52 110 26 Z"
        fill={`url(#fold-${art.sigil}-${art.fabric})`}
        stroke={fabric.seam}
        strokeWidth="1.5"
      />
      {/* Gola */}
      <path
        d="M110 26 Q150 52 190 26"
        fill="none"
        stroke={fabric.seam}
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Vincos verticais, sutis, para não parecer um recorte chapado. */}
      <path
        d="M104 120v180M196 120v180"
        stroke={fabric.shade}
        strokeWidth="1"
        opacity="0.5"
        fill="none"
      />

      {/* Estampa — SVG aninhado com medidas explícitas, senão ocuparia o pai inteiro. */}
      <SigilMark
        sigil={art.sigil}
        x={95}
        y={98}
        width={110}
        height={110}
        color={printColor}
        opacity={0.92}
        strokeWidth={2.4}
      />

      {showBandName && (
        <text
          x="150"
          y="252"
          textAnchor="middle"
          fill={printColor}
          opacity="0.9"
          style={{
            fontFamily: "'UnifrakturMaguntia', serif",
            // O corpo da peça tem ~140 unidades úteis. Um caractere blackletter
            // ocupa cerca de 0,58 do corpo da fonte, então derivamos o tamanho
            // do comprimento do nome em vez de chutar um limite fixo.
            fontSize: Math.min(26, 140 / (0.58 * Math.max(band.length, 1))),
            letterSpacing: '0.02em',
          }}
        >
          {band}
        </text>
      )}
    </svg>
  );
}
