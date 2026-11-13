import { buildChannelPath, ChannelPrefix } from '../lib/channelRouting.ts';
import { CompanySettings } from '../types/recruitment.ts';

interface FooterProps {
  settings: CompanySettings;
  channelPrefix: ChannelPrefix | null;
  onNavigate: (targetRoute: string) => void;
}

export function Footer({ settings, channelPrefix, onNavigate }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-zinc-900 text-zinc-300 border-t border-zinc-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-zinc-800">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-white">
              <span className="inline-flex w-7 h-7 rounded bg-[#C8102E] items-center justify-center text-white text-xs font-bold">
                JSL
              </span>
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
            <h3 className="text-sm font-semibold text-white mb-4">Navegação e Transparência</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href={buildChannelPath(channelPrefix, '/vagas')}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/vagas');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Vagas disponíveis
                </a>
              </li>
              <li>
                <a
                  href={buildChannelPath(channelPrefix, '/privacidade')}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/privacidade');
                  }}
                  className="hover:text-white transition-colors"
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
                  className="hover:text-white transition-colors"
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
                  className="hover:text-white transition-colors"
                >
                  Contato e Suporte ao Candidato
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <h3 className="text-sm font-semibold text-white mb-4">Controladora</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Controladora:</strong> {settings.legalName}
            </p>
            <p className="text-xs text-zinc-400">
              <strong className="text-zinc-200">CNPJ:</strong> {settings.cnpj}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Endereço da Matriz:</strong> {settings.address}
            </p>
            <p className="text-xs text-zinc-400">
              <strong className="text-zinc-200">E-mail:</strong> {settings.institutionalEmail}
            </p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <p>
            © {year} {settings.brandName}. Processo seletivo gratuito — nunca cobramos taxas ou
            depósitos.
          </p>
          <p>A inscrição não garante contratação.</p>
        </div>
      </div>
    </footer>
  );
}
