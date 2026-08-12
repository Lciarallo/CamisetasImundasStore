import logoUrl from '../../assets/logo-marca.png';

/** Proporção real do arquivo, medida no recorte do traço. */
const ASPECT = 1.306;

/**
 * A marca: "CAMISETAS INSANAS" com o pentagrama atravessando o texto.
 *
 * O arquivo original é preto sobre branco. Aqui ele entra como `mask-image`,
 * com o alfa vindo do próprio traço — assim a cor sai do `background-color` e
 * o mesmo arquivo serve de osso no cabeçalho e de sangue quando precisa
 * destacar, sem manter duas versões da imagem.
 */
export function BrandLogo({
  className = '',
  /**
   * Altura em px. Omitir e passar a altura por `className` (`h-14 md:h-20`)
   * quando ela precisar mudar com o breakpoint — a largura sempre acompanha,
   * porque vem de `aspect-ratio`, não de um cálculo fixo.
   */
  height,
  title = 'Camisetas Insanas',
}: {
  className?: string;
  height?: number;
  title?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{
        ...(height === undefined ? null : { height }),
        aspectRatio: String(ASPECT),
        backgroundColor: 'currentColor',
        maskImage: `url(${logoUrl})`,
        WebkitMaskImage: `url(${logoUrl})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
      role="img"
      aria-label={title}
    />
  );
}

/** Versão em uma linha, para barras estreitas onde o logo em bloco não cabe. */
export function BrandWordmark({
  className = '',
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={`font-display font-black tracking-[0.06em] whitespace-nowrap ${className}`}
      style={{ fontSize: size }}
      role="img"
      aria-label="Camisetas Insanas"
    >
      CAMISETAS INSANAS
    </span>
  );
}
