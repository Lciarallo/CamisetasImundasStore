import React from 'react';
import { Send, Share2, Globe, Shield, Heart, Zap } from 'lucide-react';

export const Footer: React.FC = () => {
  const [email, setEmail] = React.useState('');
  const [subscribed, setSubscribed] = React.useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 3000);
      setEmail('');
    }
  };

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 text-zinc-400 text-xs">
      {/* Upper Newsletter Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 border-b border-zinc-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-lime-400 font-extrabold text-xs uppercase">
              <Zap className="w-4 h-4" />
              <span>JUNTE-SE AO CLUBE IMUNDO</span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">
              RECEBA DROPS EXCLUSIVOS & DESCONTOS SECRETOS
            </h3>
            <p className="text-zinc-400 text-sm max-w-lg">
              Cadastre seu e-mail e seja avisado 1 hora antes de cada lançamento de edição limitada.
            </p>
          </div>

          <div className="lg:col-span-5">
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                required
                placeholder="Seu melhor e-mail..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark flex-1 text-xs rounded-xl py-3"
              />
              <button
                type="submit"
                className="btn-primary py-3 px-5 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0"
              >
                <span>{subscribed ? 'CADASTRADO!' : 'INSCREVER'}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            {subscribed && (
              <p className="text-lime-400 text-[11px] font-bold mt-2">
                ⚡ Bem-vindo à família! Use o cupom <strong>IMUNDA10</strong> para 10% OFF.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Brand Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="bg-lime-400 text-black font-black p-1.5 rounded font-mono text-lg">
              CI
            </div>
            <span className="text-lg font-black text-white tracking-wider">
              CAMISETAS<span className="text-lime-400">IMUNDAS</span>
            </span>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Nossa sujeira é a nossa arte. Camisetas streetwear autênticas produzidas no Brasil com algodão de alta gramatura e atitude underground.
          </p>
          <div className="flex items-center gap-3 text-zinc-300">
            <a href="#rede-social" className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:text-lime-400 hover:border-lime-400 transition-all">
              <Globe className="w-4 h-4" />
            </a>
            <a href="#compartilhar" className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:text-lime-400 hover:border-lime-400 transition-all">
              <Share2 className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-3">
          <h4 className="font-extrabold text-white uppercase text-xs tracking-wider">Navegação</h4>
          <ul className="space-y-2 text-xs">
            <li><a href="#oversized" className="hover:text-lime-400 transition-colors">Coleção Oversized</a></li>
            <li><a href="#vintage" className="hover:text-lime-400 transition-colors">Vintage Acid Wash</a></li>
            <li><a href="#graphic" className="hover:text-lime-400 transition-colors">Graphic Tees Góticas</a></li>
            <li><a href="#limitada" className="hover:text-lime-400 transition-colors">Edições Limitadas</a></li>
          </ul>
        </div>

        {/* Support Links */}
        <div className="space-y-3">
          <h4 className="font-extrabold text-white uppercase text-xs tracking-wider">Suporte ao Cliente</h4>
          <ul className="space-y-2 text-xs">
            <li><a href="#medidas" className="hover:text-lime-400 transition-colors">Tabela de Medidas</a></li>
            <li><a href="#trocas" className="hover:text-lime-400 transition-colors">Política de Troca & Devolução</a></li>
            <li><a href="#rastreio" className="hover:text-lime-400 transition-colors">Rastrear meu Pedido</a></li>
            <li><a href="#faq" className="hover:text-lime-400 transition-colors">Perguntas Frequentes (FAQ)</a></li>
          </ul>
        </div>

        {/* Security & Payment */}
        <div className="space-y-3">
          <h4 className="font-extrabold text-white uppercase text-xs tracking-wider">Pagamento & Segurança</h4>
          <p className="text-xs text-zinc-400">
            Aceitamos PIX com desconto instantâneo e parcelamos em até 6x nos cartões.
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] font-mono font-bold pt-1">
            <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-lime-400">PIX (5% OFF)</span>
            <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">VISA</span>
            <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">MASTERCARD</span>
            <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">BOLETO</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold pt-2">
            <Shield className="w-4 h-4" />
            <span>Site Protegido por SSL Certificado</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-zinc-900 py-6 px-4 text-center text-zinc-600 text-[11px]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Camisetas Imundas Store. Todos os direitos reservados.</p>
          <p className="flex items-center gap-1">
            Desenvolvido com <Heart className="w-3.5 h-3.5 text-lime-400 fill-lime-400" /> para amantes do streetwear autêntico.
          </p>
        </div>
      </div>
    </footer>
  );
};
