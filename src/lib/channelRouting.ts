export type ChannelPrefix = '/vagas1' | '/vagas2';

export interface ParsedLocation {
  channelPrefix: ChannelPrefix | null;
  tenantId: 1 | 2 | null;
  route: string;
}

export function parseAppLocation(pathname: string): ParsedLocation {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/vagas1' || clean.startsWith('/vagas1/')) {
    const rest = clean.slice('/vagas1'.length) || '/';
    return {
      channelPrefix: '/vagas1',
      tenantId: 1,
      route: rest.startsWith('/') ? rest : `/${rest}`,
    };
  }

  if (clean === '/vagas2' || clean.startsWith('/vagas2/')) {
    const rest = clean.slice('/vagas2'.length) || '/';
    return {
      channelPrefix: '/vagas2',
      tenantId: 2,
      route: rest.startsWith('/') ? rest : `/${rest}`,
    };
  }

  return {
    channelPrefix: null,
    tenantId: null,
    route: clean,
  };
}

export function buildChannelPath(
  channelPrefix: ChannelPrefix | null,
  targetRoute: string
): string {
  const normalized = targetRoute.startsWith('/') ? targetRoute : `/${targetRoute}`;
  if (normalized === '/painel' || normalized.startsWith('/painel/')) {
    return '/painel';
  }
  if (!channelPrefix) {
    return normalized;
  }
  if (normalized === '/') {
    return channelPrefix;
  }
  return `${channelPrefix}${normalized}`;
}

export function formatDateTimeSaoPaulo(isoString: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export function getSaoPauloTodayYmd(offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);
}
