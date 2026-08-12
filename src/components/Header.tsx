import React from 'react';
import { ShoppingBag, Search, Heart, Flame, Menu, X } from 'lucide-react';

interface HeaderProps {
  cartCount: number;
  wishlistCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCart: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  wishlistCount,
  searchQuery,
  onSearchChange,
  onOpenCart,
  selectedCategory,
  onSelectCategory,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const categories = [
    'Todos',
    'Oversized',
    'Vintage Trash',
    'Graphic Tees',
    'Edição Limitada',
  ];

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-yellow-400 via-lime-400 to-emerald-400 text-black font-extrabold text-xs py-1.5 px-4 text-center tracking-widest uppercase flex items-center justify-center gap-2">
        <Flame className="w-4 h-4 fill-black animate-pulse" />
        <span>Frete Grátis acima de R$ 250 | Parcele em até 6x sem juros no PIX/Cartão</span>
        <Flame className="w-4 h-4 fill-black animate-pulse" />
      </div>

      {/* Main Navbar */}
      <div className="glass-nav px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectCategory('Todos')}>
          <div className="bg-lime-400 text-black font-black p-2 rounded-md font-mono text-xl tracking-tighter shadow-lg shadow-lime-400/20">
            CI
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-wider leading-none text-white">
              CAMISETAS<span className="text-lime-400">IMUNDAS</span>
            </h1>
            <p className="text-[10px] text-zinc-400 tracking-widest font-mono uppercase">Streetwear Underground</p>
          </div>
        </div>

        {/* Desktop Category Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-zinc-900/60 p-1.5 rounded-lg border border-zinc-800/80">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase transition-all duration-200 ${
                selectedCategory === cat
                  ? 'bg-lime-400 text-black shadow-md shadow-lime-400/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* Right Section: Search & Actions */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative hidden sm:block w-44 md:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar estampa ou modelo..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input-dark w-full pl-9 pr-3 py-1.5 text-xs rounded-lg"
            />
          </div>

          {/* Wishlist Button */}
          <button className="relative p-2 text-zinc-300 hover:text-lime-400 transition-colors bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg">
            <Heart className="w-5 h-5" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="btn-primary relative px-4 py-2 text-xs flex items-center gap-2 rounded-lg"
          >
            <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline font-bold">CARRINHO</span>
            <span className="bg-black text-lime-400 font-extrabold text-[11px] px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {cartCount}
            </span>
          </button>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-zinc-950 border-b border-zinc-800 p-4 space-y-3 animate-fade-in">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar estampas..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input-dark w-full pl-9 pr-3 py-2 text-sm rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  onSelectCategory(cat);
                  setIsMobileMenuOpen(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold uppercase text-left transition-colors ${
                  selectedCategory === cat
                    ? 'bg-lime-400 text-black font-extrabold'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
