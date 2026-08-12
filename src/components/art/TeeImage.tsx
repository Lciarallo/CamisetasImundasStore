import type { TeeArt } from '../../types';
import { TeeArtwork } from './TeeArtwork';

/**
 * A imagem da peça: foto real quando existe, arte vetorial quando não.
 *
 * Foto e desenho ocupam a mesma caixa (a proporção do SVG da camiseta), então
 * a grade do catálogo não desalinha quando só algumas peças têm foto.
 */
export function TeeImage({
  art,
  band,
  photo,
  className = '',
  showBandName = true,
  alt,
}: {
  art: TeeArt;
  band: string;
  /** Primeira foto da peça. Ausente = cai na arte vetorial. */
  photo?: string;
  className?: string;
  showBandName?: boolean;
  alt?: string;
}) {
  if (!photo) {
    return (
      <TeeArtwork art={art} band={band} className={className} showBandName={showBandName} />
    );
  }

  return (
    <img
      src={photo}
      alt={alt ?? `Camiseta ${band}`}
      loading="lazy"
      decoding="async"
      className={`aspect-[300/340] w-full bg-pitch object-cover ${className}`}
    />
  );
}
