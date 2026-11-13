import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type AppRoute =
  | '/'
  | '/vagas'
  | `/vagas/${string}`
  | '/candidatura'
  | '/confirmacao'
  | '/privacidade'
  | '/termos'
  | '/contato'
  | '/admin';

interface HeaderProps {
  currentPath: string;
  brandName: string;
  onNavigate: (path: string) => void;
}

export function Header({ currentPath, brandName, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Início', path: '/' },
    { label: 'Vagas disponíveis', path: '/vagas' },
    { label: 'Como funciona', path: '/#como-funciona' },
    { label: 'Contato', path: '/contato' },
  ];

  const handleLinkClick = (path: string) => {
    setMobileOpen(false);
    if (path === '/#como-funciona') {
      if (currentPath !== '/') {
        onNavigate('/');
        setTimeout(() => {
          document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      } else {
        document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick('/');
          }}
          className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C8102E]"
        >
          <span className="inline-flex w-7 h-7 rounded bg-[#C8102E] items-center justify-center text-white text-xs font-bold tracking-tighter">
            JSL
          </span>
          <span className="font-display">{brandName}</span>
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600"
        >
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? currentPath === '/'
                : item.path !== '/#como-funciona' && currentPath.startsWith(item.path);
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.path);
                }}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  isActive
                    ? 'text-zinc-950 border-[#C8102E]'
                    : 'border-transparent hover:text-zinc-950 hover:border-zinc-300'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA + Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('/vagas')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#C8102E] rounded-lg hover:bg-[#A00D24] transition-colors whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
          >
            Ver vagas
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick(item.path);
              }}
              className="block px-3 py-3 rounded-lg text-base font-medium text-zinc-800 hover:bg-zinc-100"
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => handleLinkClick('/vagas')}
            className="w-full mt-2 px-4 py-3 text-base font-semibold text-white bg-[#C8102E] rounded-lg hover:bg-[#A00D24]"
          >
            Ver vagas disponíveis
          </button>
        </div>
      )}
    </header>
  );
}
