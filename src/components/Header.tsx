import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { buildChannelPath, ChannelPrefix } from '../lib/channelRouting.ts';

interface HeaderProps {
  currentRoute: string;
  channelPrefix: ChannelPrefix | null;
  brandName: string;
  onNavigate: (targetRoute: string) => void;
}

export function Header({ currentRoute, channelPrefix, brandName, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Início', route: '/' },
    { label: 'Vagas disponíveis', route: '/vagas' },
    { label: 'Como funciona', route: '/#como-funciona' },
    { label: 'Aplicativo', route: '/aplicativo' },
    { label: 'Contato', route: '/contato' },
  ];

  const handleLinkClick = (route: string) => {
    setMobileOpen(false);
    if (route === '/#como-funciona') {
      if (currentRoute !== '/') {
        onNavigate('/');
        setTimeout(() => {
          document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      } else {
        document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    onNavigate(route);
  };

  if (currentRoute === '/aplicativo') {
    return (
      <header className="sticky top-0 z-40 bg-white text-zinc-900 border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="inline-flex w-8 h-8 rounded-lg bg-[#C8102E] items-center justify-center text-white text-xs font-extrabold tracking-tighter shrink-0">
              JSL
            </span>
            <span className="font-display text-sm sm:text-lg font-extrabold tracking-tight text-zinc-950 truncate">
              JSL - Processo seletivo
            </span>
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-[#01875F] whitespace-nowrap shrink-0">
            <span className="sm:hidden">App Android</span>
            <span className="hidden sm:inline">Aplicativo Android Oficial</span>
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-[#C8102E] text-white border-b border-[#A00D24] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6 lg:gap-8">
        <a
          href={buildChannelPath(channelPrefix, '/')}
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick('/');
          }}
          className="flex items-center gap-2 sm:gap-2.5 text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="inline-flex w-8 h-8 rounded-lg bg-white items-center justify-center text-[#C8102E] text-xs font-extrabold tracking-tighter shrink-0">
            JSL
          </span>
          <span className="font-display truncate">JSL - LOGÍSTICA</span>
        </a>

        <nav
          aria-label="Navegação principal"
          className="hidden lg:flex items-center gap-6 text-sm font-semibold text-white/90"
        >
          {navItems.map((item) => {
            const isActive =
              item.route === '/'
                ? currentRoute === '/'
                : item.route !== '/#como-funciona' && currentRoute.startsWith(item.route);
            const href =
              item.route === '/#como-funciona'
                ? `${buildChannelPath(channelPrefix, '/')}#como-funciona`
                : buildChannelPath(channelPrefix, item.route);
            return (
              <a
                key={item.route}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.route);
                }}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  isActive
                    ? 'text-white border-white'
                    : 'border-transparent hover:text-white hover:border-white/50'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('/vagas')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-[#C8102E] bg-white rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Ver vagas
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-white/25 text-white hover:bg-[#A00D24] cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[#A00D24] bg-[#A00D24] px-4 py-4 space-y-1 max-h-[calc(100dvh-4rem)] overflow-y-auto">
          {navItems.map((item) => {
            const href =
              item.route === '/#como-funciona'
                ? `${buildChannelPath(channelPrefix, '/')}#como-funciona`
                : buildChannelPath(channelPrefix, item.route);
            return (
              <a
                key={item.route}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.route);
                }}
                className="flex items-center min-h-[44px] px-3 py-2.5 rounded-lg text-base font-semibold text-white hover:bg-white/10"
              >
                {item.label}
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => handleLinkClick('/vagas')}
            className="w-full mt-2 px-4 py-3 text-base font-bold text-[#C8102E] bg-white rounded-lg hover:bg-red-50 min-h-[48px] cursor-pointer"
          >
            Ver vagas disponíveis
          </button>
        </div>
      )}
    </header>
  );
}
