import { useState } from 'react';
import jslNavLogo from '../assets/images/jsl_nav_logo_1795310897830.jpg';
import { buildChannelPath, ChannelPrefix } from '../lib/channelRouting.ts';
import { CompanySettings } from '../types/recruitment.ts';

interface FooterProps {
  settings: CompanySettings;
  channelPrefix: ChannelPrefix | null;
  currentRoute?: string;
  onNavigate: (targetRoute: string) => void;
}

export function Footer({ settings, channelPrefix, currentRoute, onNavigate }: FooterProps) {
  const [logoError, setLogoError] = useState(false);
  const year = new Date().getFullYear();

  if (currentRoute === '/aplicativo') {
    return (
      <footer className="bg-zinc-50 text-zinc-500 border-t border-zinc-200 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-700 font-semibold">
            {!logoError ? (
              <img
                src={jslNavLogo}
                alt={`Logo ${settings.brandName}`}
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-6 h-6 rounded-md object-cover border border-zinc-200 shrink-0"
              />
            ) : (
              <span className="inline-flex w-6 h-6 rounded-md bg-[#C8102E] items-center justify-center text-white text-[10px] font-bold shrink-0">
                JSL
              </span>
            )}
            <span>JSL - Processo seletivo · Aplicativo Oficial</span>
          </div>
          <p>© {year} {settings.brandName}. Processo seletivo gratuito — sem taxas.</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-zinc-900 text-zinc-300 border-t border-zinc-800 mt-10 sm:mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 pb-8 sm:pb-10 border-b border-zinc-800">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-white">
              {!logoError ? (
                <img
                  src={jslNavLogo}
                  alt={`Logo ${settings.brandName}`}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-8 h-8 rounded-[9px] object-cover ring-1 ring-white/25 bg-white shadow-sm shrink-0"
                />
              ) : (
                <span className="inline-flex w-8 h-8 rounded-[9px] bg-[#C8102E] items-center justify-center text-white text-xs font-bold shrink-0">
                  JSL
                </span>
              )}
              <span className="font-display font-bold tracking-tight text-lg">
                {settings.brandName}
              </span>
            </div>
            <p className="text-sm text-zinc-400">{settings.brandSubtitle}</p>
            <p className="text-xs leading-relaxed text-zinc-400 max-w-sm">
              {settings.brandDisclaimer}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3.5 sm:mb-4">
              Navegação e Transparência
            </h3>
            <ul className="space-y-2.5 text-sm">
              {currentRoute !== '/aplicativo' && (
                <li>
                  <a
                    href={buildChannelPath(channelPrefix, '/vagas')}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/vagas');
                    }}
                    className="inline-block py-0.5 hover:text-white transition-colors"
                  >
                    Vagas disponíveis
                  </a>
                </li>
              )}
              <li>
                <a
                  href={buildChannelPath(channelPrefix, '/aplicativo')}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/aplicativo');
                  }}
                  className="inline-block py-0.5 hover:text-white transition-colors"
                >
                  Baixar Aplicativo (Android)
                </a>
              </li>
              <li>
                <a
                  href={buildChannelPath(channelPrefix, '/privacidade')}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/privacidade');
                  }}
                  className="inline-block py-0.5 hover:text-white transition-colors"
                >
                  Política de Privacidade (LGPD)
                </a>
              </li>
              <li>
                <a
                  href={buildChannelPath(channelPrefix, '/termos')}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/termos');
                  }}
                  className="inline-block py-0.5 hover:text-white transition-colors"
                >
                  Termos de Uso
                </a>
              </li>
              <li>
                <a
                  href={buildChannelPath(channelPrefix, '/contato')}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/contato');
                  }}
                  className="inline-block py-0.5 hover:text-white transition-colors"
                >
                  Contato e Suporte ao Candidato
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm min-w-0">
            <h3 className="text-sm font-semibold text-white mb-3.5 sm:mb-4">Controladora</h3>
            <p className="text-xs text-zinc-400 leading-relaxed break-words">
              <strong className="text-zinc-200">Controladora:</strong> {settings.legalName}
            </p>
            <p className="text-xs text-zinc-400">
              <strong className="text-zinc-200">CNPJ:</strong> {settings.cnpj}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed break-words">
              <strong className="text-zinc-200">Endereço da Matriz:</strong> {settings.address}
            </p>
            <p className="text-xs text-zinc-400 break-all">
              <strong className="text-zinc-200">E-mail:</strong> {settings.institutionalEmail}
            </p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 text-xs text-zinc-500">
          <p>
            © {year} {settings.brandName}. Processo seletivo gratuito — nunca cobramos taxas ou
            depósitos.
          </p>
          <p className="shrink-0">A inscrição não garante contratação.</p>
        </div>
      </div>
    </footer>
  );
}
