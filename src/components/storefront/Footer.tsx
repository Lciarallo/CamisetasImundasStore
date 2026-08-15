import { DiscAlbum, Hammer, Package, QrCode, RadioTower, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../art/BrandLogo';

const COLUMNS: { title: string; links: string[] }[] = [
  {
    title: 'O culto',
    links: ['Quem somos', 'Bandas parceiras', 'Serigrafia manual', 'Trabalhe conosco'],
  },
  {
    title: 'Ajuda',
    links: ['Rastrear pedido', 'Trocas e devoluções', 'Tabela de medidas', 'Formas de pagamento'],
  },
  {
    title: 'Legal',
    links: ['Termos de uso', 'Política de privacidade', 'Política de frete', 'Contato'],
  },
];

export function Footer({ onOpenCustomerPortal }: { onOpenCustomerPortal?: () => void }) {
  return (
    <footer className="mt-auto border-t border-smoke bg-pitch">
      {/* Garantias */}
      <div className="border-b border-smoke">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-smoke lg:grid-cols-4">
          {[
            { icon: Package, title: 'Frete grátis', text: 'Acima de R$ 299 para todo o Brasil' },
            { icon: Hammer, title: 'Sob encomenda', text: 'Peça esgotada? Produzimos para você' },
            { icon: QrCode, title: 'PIX à vista', text: '5% de desconto com código exclusivo' },
            { icon: ShieldCheck, title: 'Compra segura', text: 'Dados criptografados e nota fiscal' },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3 bg-pitch px-5 py-6">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blood-bright" />
              <div>
                <p className="heading-carved text-[0.6rem] text-bone">{title}</p>
                <p className="mt-1 text-[0.7rem] text-grave">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Sob encomenda — explicação âncora do menu */}
      <section
        id="sob-encomenda"
        className="border-b border-smoke bg-void"
        aria-labelledby="sob-encomenda-title"
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center md:px-8">
          <h2 id="sob-encomenda-title" className="font-logo text-3xl text-bone md:text-4xl">
            Sob encomenda
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-parchment">
            Tiragem curta significa que peça boa acaba. Em vez de tirar do catálogo,
            marcamos como sob encomenda: você compra, nós produzimos, e a peça chega
            no prazo indicado em cada produto — normalmente entre 8 e 20 dias úteis.
          </p>
          <ol className="mt-10 grid gap-px bg-smoke text-left sm:grid-cols-3">
            {[
              ['I', 'Você encomenda', 'Escolhe o tamanho e conclui o pagamento por PIX.'],
              ['II', 'Entramos em produção', 'A peça vai para a fila de serigrafia com seu nome.'],
              ['III', 'Despachamos', 'Você recebe o código de rastreio assim que sair da oficina.'],
            ].map(([numeral, title, text]) => (
              <li key={numeral} className="bg-crypt p-5">
                <span className="font-display text-2xl font-bold text-blood-bright">{numeral}</span>
                <p className="heading-carved mt-2 text-[0.6rem] text-bone">{title}</p>
                <p className="mt-1.5 text-[0.72rem] leading-relaxed text-grave">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Colunas */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)] md:px-8">
        <div>
          <div className="text-bone">
            <BrandLogo height={92} />
          </div>
          <p className="mt-4 max-w-xs text-[0.75rem] leading-relaxed text-grave">
            Loja independente de camisetas de black metal. Serigrafia manual em tiragem
            curta desde 2019. Nenhuma banda citada existe — todas foram inventadas para
            esta loja.
          </p>
          <div className="mt-5 flex gap-2">
            {[
              { icon: DiscAlbum, label: 'Bandcamp do selo', href: 'https://bandcamp.com', isExternal: true },
              { icon: RadioTower, label: 'Rádio Insana', href: '#catalogo', isExternal: false },
            ].map(({ icon: Icon, label, href, isExternal }) => (
              <a
                key={label}
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="border border-iron p-2 text-grave transition-colors hover:border-blood hover:text-blood-bright"
                aria-label={label}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-labelledby={`footer-${column.title}`}>
            <p
              id={`footer-${column.title}`}
              className="heading-carved text-[0.6rem] text-bone"
            >
              {column.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link}>
                  {link === 'Rastrear pedido' && onOpenCustomerPortal ? (
                    <button
                      onClick={onOpenCustomerPortal}
                      className="text-[0.75rem] text-grave transition-colors hover:text-blood-bright"
                    >
                      {link}
                    </button>
                  ) : (
                    <a
                      href="#catalogo"
                      className="text-[0.75rem] text-grave transition-colors hover:text-blood-bright"
                    >
                      {link}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-smoke">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-[0.68rem] text-grave md:flex-row md:px-8">
          <p>© 2026 Camisetas Insanas · CNPJ 68.510.540/0001-59</p>
          <p className="text-grave">Pagamento disponível: PIX</p>
        </div>
      </div>
    </footer>
  );
}
