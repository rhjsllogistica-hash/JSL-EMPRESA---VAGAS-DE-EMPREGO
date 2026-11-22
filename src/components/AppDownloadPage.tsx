import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Info,
  Loader2,
  ShieldCheck,
  Smartphone,
  Star,
  ThumbsUp,
  X,
} from 'lucide-react';
import { ChannelPrefix, formatDateTimeSaoPaulo } from '../lib/channelRouting.ts';
import { fetchPublicAppRelease, PublicAppRelease } from '../lib/recruitmentService.ts';

interface AppDownloadPageProps {
  channelPrefix: ChannelPrefix | null;
}

interface CandidateReview {
  id: string;
  author: string;
  initials: string;
  avatarColor: string;
  roleLabel: string;
  category: 'motorista' | 'logistica';
  rating: number;
  dateLabel: string;
  text: string;
  helpfulBase: number;
}

const CANDIDATE_REVIEWS: CandidateReview[] = [
  {
    id: 'rev-1',
    author: 'Marcos Vinícius Oliveira',
    initials: 'MV',
    avatarColor: 'bg-[#01875F]',
    roleLabel: 'Motorista de Caminhão',
    category: 'motorista',
    rating: 5,
    dateLabel: 'Há 2 dias',
    text: 'Muito bom e fácil! Preenchi minha ficha direto pelo aplicativo no celular, o RH me chamou rapidinho para a entrevista e eu fui contratado no mesmo dia. Nota 10!',
    helpfulBase: 148,
  },
  {
    id: 'rev-2',
    author: 'Fernanda Costa Ribeiro',
    initials: 'FC',
    avatarColor: 'bg-[#C8102E]',
    roleLabel: 'Conferente de Logística',
    category: 'logistica',
    rating: 5,
    dateLabel: 'Há 4 dias',
    text: 'Fiz entrevista com o RH hoje de manhã, já levei os documentos e gostei muito do atendimento. Pelo aplicativo dá para acompanhar tudo sem ficar perdido.',
    helpfulBase: 112,
  },
  {
    id: 'rev-3',
    author: 'Rafael Henrique Santos',
    initials: 'RH',
    avatarColor: 'bg-zinc-800',
    roleLabel: 'Operador de Empilhadeira',
    category: 'logistica',
    rating: 5,
    dateLabel: 'Há 1 semana',
    text: 'Aplicativo leve, abre rápido mesmo no 4G. Consegui enviar minha candidatura e ver a confirmação da 1ª etapa direto na tela.',
    helpfulBase: 89,
  },
  {
    id: 'rev-4',
    author: 'Anderson Carlos Silva',
    initials: 'AC',
    avatarColor: 'bg-emerald-700',
    roleLabel: 'Motorista Utilitário (Fiorino)',
    category: 'motorista',
    rating: 5,
    dateLabel: 'Há 1 semana',
    text: 'Muito prático para quem está na rua trabalhando. Não precisa mandar PDF nem nada complicado, preenchi em 5 minutos e já agendaram minha entrevista no RH.',
    helpfulBase: 76,
  },
  {
    id: 'rev-5',
    author: 'Juliana Almeida Pereira',
    initials: 'JA',
    avatarColor: 'bg-amber-700',
    roleLabel: 'Auxiliar de Logística',
    category: 'logistica',
    rating: 5,
    dateLabel: 'Há 2 semanas',
    text: 'Gostei muito! A equipe do RH entrou em contato pelo WhatsApp logo após a aprovação da 1ª etapa. Processo transparente e sem nenhuma taxa.',
    helpfulBase: 64,
  },
  {
    id: 'rev-6',
    author: 'Camila Rodrigues Souza',
    initials: 'CR',
    avatarColor: 'bg-slate-700',
    roleLabel: 'Auxiliar de Estoque',
    category: 'logistica',
    rating: 4,
    dateLabel: 'Há 2 semanas',
    text: 'Baixei o aplicativo no meu Android e instalou certinho em segundos. Mesmo quando minha internet oscilou, meus dados continuaram salvos.',
    helpfulBase: 41,
  },
];

const RATING_BREAKDOWN = [
  { stars: 5, percent: 89 },
  { stars: 4, percent: 8 },
  { stars: 3, percent: 2 },
  { stars: 2, percent: 1 },
  { stars: 1, percent: 0 },
];

function formatBytesMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1).replace('.', ',')} MB`;
  }
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} KB`;
}

function StarRow({ count, sizeClass = 'w-3.5 h-3.5' }: { count: number; sizeClass?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${sizeClass} ${
            n <= count ? 'fill-[#01875F] text-[#01875F]' : 'fill-zinc-200 text-zinc-200'
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

type ScreenshotId = 'home' | 'jobs' | 'form' | 'confirmation';

interface AppScreenshotItem {
  id: ScreenshotId;
  title: string;
  caption: string;
}

const APP_SCREENSHOTS: AppScreenshotItem[] = [
  {
    id: 'home',
    title: 'Tela inicial do processo seletivo',
    caption: 'Acesso direto às vagas operacionais JSL',
  },
  {
    id: 'jobs',
    title: 'Escolha da vaga e salário',
    caption: 'Motoristas, empilhadeira, conferente e auxiliar',
  },
  {
    id: 'form',
    title: 'Ficha rápida pelo celular',
    caption: 'Salva sozinho mesmo se a internet cair',
  },
  {
    id: 'confirmation',
    title: 'Acompanhamento da 1ª etapa',
    caption: 'Protocolo salvo e retorno do RH para entrevista',
  },
];

function AppScreenPreview({ id, compact = false }: { id: ScreenshotId; compact?: boolean }) {
  const pad = compact ? 'p-2.5' : 'p-4';
  const textXs = compact ? 'text-[9px]' : 'text-xs';
  const textSm = compact ? 'text-[10px]' : 'text-sm';
  const titleSize = compact ? 'text-xs' : 'text-base';

  return (
    <div className="w-full h-full bg-neutral-50 flex flex-col select-none text-left">
      {/* Mini barra vermelha igual ao site principal */}
      <div className="bg-[#C8102E] text-white px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-4 h-4 rounded bg-white text-[#C8102E] font-extrabold text-[8px] items-center justify-center">
            JSL
          </span>
          <span className="font-display font-bold text-[10px] tracking-tight">
            JSL - LOGÍSTICA
          </span>
        </div>
        <span className="px-2 py-0.5 bg-white text-[#C8102E] rounded text-[8px] font-bold">
          Vagas
        </span>
      </div>

      {id === 'home' && (
        <div className={`${pad} space-y-2.5 flex-1 overflow-hidden`}>
          <div className="rounded-xl overflow-hidden border border-zinc-200 bg-white">
            <img
              src="/assets/aistudio/Venha_Trabalhar_Conosco_na_Log_stica_61ae1d22.png"
              alt="Prévia da tela inicial JSL"
              referrerPolicy="no-referrer"
              className="w-full h-24 sm:h-28 object-cover"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-[#C8102E] uppercase tracking-wide">
              Recrutamento Oficial
            </p>
            <p className={`font-display font-extrabold text-zinc-950 leading-tight ${titleSize}`}>
              Construa sua carreira na logística
            </p>
            <p className={`text-zinc-600 leading-snug ${textXs}`}>
              Vagas para motoristas, operação de armazém e distribuição sem cobrança de taxas.
            </p>
          </div>
          <div className="w-full py-1.5 px-3 bg-[#C8102E] text-white rounded-lg text-center font-bold text-[10px]">
            Ver vagas disponíveis
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <div className="bg-white border border-zinc-200 rounded-lg p-2">
              <p className="font-bold text-[9px] text-zinc-900 truncate">Motorista Caminhão</p>
              <p className="text-[8px] text-[#C8102E] font-bold mt-0.5">R$ 8.280,00</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-2">
              <p className="font-bold text-[9px] text-zinc-900 truncate">Empilhadeira</p>
              <p className="text-[8px] text-[#C8102E] font-bold mt-0.5">R$ 3.450,00</p>
            </div>
          </div>
        </div>
      )}

      {id === 'jobs' && (
        <div className={`${pad} space-y-2 flex-1 overflow-hidden`}>
          <div>
            <p className={`font-display font-extrabold text-zinc-950 ${titleSize}`}>
              Vagas abertas
            </p>
            <p className={`text-zinc-500 ${textXs}`}>Toque na vaga para se candidatar</p>
          </div>
          <div className="space-y-1.5">
            {[
              { title: 'Motorista de Caminhão', salary: 'R$ 8.280,00 mensais' },
              { title: 'Motorista Utilitário (Fiorino)', salary: 'R$ 4.100,00 mensais' },
              { title: 'Operador de Empilhadeira', salary: 'R$ 3.450,00 mensais' },
              { title: 'Conferente de Logística', salary: 'R$ 2.890,00 mensais' },
            ].map((job) => (
              <div
                key={job.title}
                className="bg-white border border-zinc-200 rounded-xl p-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[10px] text-zinc-950 truncate">{job.title}</p>
                  <p className="text-[9px] font-semibold text-[#C8102E] tabular-nums">
                    {job.salary}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-1 bg-[#C8102E] text-white rounded-md text-[8px] font-bold">
                  Aplicar
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {id === 'form' && (
        <div className={`${pad} space-y-2 flex-1 overflow-hidden`}>
          <div className="flex items-center justify-between text-[9px] font-bold text-zinc-700">
            <span>Etapa 1 de 3 · Seus Dados</span>
            <span className="text-[#01875F]">Salvo automático</span>
          </div>
          <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-[#C8102E] rounded-full" />
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-2.5 space-y-2">
            <div>
              <p className="text-[8px] font-semibold text-zinc-500">Nome completo</p>
              <div className="mt-0.5 px-2 py-1 rounded border border-zinc-200 bg-neutral-50 text-[9px] font-medium text-zinc-900">
                Marcos Oliveira
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="text-[8px] font-semibold text-zinc-500">Sexo</p>
                <div className="mt-0.5 grid grid-cols-2 gap-1 text-[8px] font-bold">
                  <span className="py-1 text-center rounded bg-[#C8102E] text-white">Homem</span>
                  <span className="py-1 text-center rounded border border-zinc-200 text-zinc-600">
                    Mulher
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[8px] font-semibold text-zinc-500">Tem filhos?</p>
                <div className="mt-0.5 grid grid-cols-2 gap-1 text-[8px] font-bold">
                  <span className="py-1 text-center rounded bg-[#C8102E] text-white">Sim (2)</span>
                  <span className="py-1 text-center rounded border border-zinc-200 text-zinc-600">
                    Não
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[8px] text-[#01875F] font-semibold">
              Não precisa enviar currículo PDF nem RG.
            </p>
          </div>
          <div className="w-full py-1.5 px-3 bg-[#C8102E] text-white rounded-lg text-center font-bold text-[10px]">
            Continuar inscrição
          </div>
        </div>
      )}

      {id === 'confirmation' && (
        <div className={`${pad} space-y-2 flex-1 overflow-hidden`}>
          <div className="bg-white border border-zinc-200 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[#01875F]">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="text-[8px] font-extrabold uppercase tracking-wide">
                Protocolo registrado
              </span>
            </div>
            <p className={`font-display font-extrabold text-zinc-950 ${titleSize}`}>
              ENVIADO COM SUCESSO!
            </p>
            <p className={`text-zinc-700 leading-snug ${textXs}`}>
              Aguarde o processo seletivo. Caso seja aprovado na 1ª etapa, o RH irá entrar em
              contato para entrevista.
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 space-y-1">
              <p className="text-[8px] text-zinc-500">Protocolo</p>
              <p className="font-mono-tabular text-[10px] font-bold text-[#C8102E]">
                JSL-2026-8F4A21C9
              </p>
              <p className="text-[8px] font-semibold text-zinc-800">
                Status: Enviado — Aguardando 1ª etapa
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[8px] text-emerald-950">
              Seu cadastro fica salvo automaticamente neste celular para acompanhar o retorno do RH.
            </div>
          </div>
          <p className={`${textSm} hidden`} />
        </div>
      )}
    </div>
  );
}

export function AppDownloadPage({ channelPrefix }: AppDownloadPageProps) {
  const [loading, setLoading] = useState(true);
  const [release, setRelease] = useState<PublicAppRelease | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'motorista' | 'logistica' | '5star'>('all');
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, 'yes' | 'no'>>({});
  const [activeScreenshot, setActiveScreenshot] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPublicAppRelease()
      .then((res) => {
        if (!active) return;
        setRelease(res.available && res.release ? res.release : null);
      })
      .catch(() => {
        if (active) setRelease(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleTriggerDownload = () => {
    setDownloadStarted(true);
    setShowInstallGuide(true);
    setRelease((prev) =>
      prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : prev
    );
  };

  const filteredReviews = CANDIDATE_REVIEWS.filter((rev) => {
    if (reviewFilter === 'motorista') return rev.category === 'motorista';
    if (reviewFilter === 'logistica') return rev.category === 'logistica';
    if (reviewFilter === '5star') return rev.rating === 5;
    return true;
  });

  const displayDownloadCount = release
    ? Math.max(50000, 50000 + release.downloadCount).toLocaleString('pt-BR')
    : '50.000+';

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Cabeçalho estilo Google Play Store */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
          <div className="grid grid-cols-[84px_1fr] sm:grid-cols-[128px_1fr] gap-x-4 gap-y-5 sm:gap-x-8 sm:gap-y-5 items-center sm:items-start">
            {/* Ícone Oficial do App */}
            <div className="w-[84px] h-[84px] sm:w-32 sm:h-32 sm:row-span-2 rounded-[20px] sm:rounded-[26px] border border-zinc-200 bg-white shadow-md overflow-hidden shrink-0 flex items-center justify-center">
              {!iconError ? (
                <img
                  src="/assets/aistudio/Emblema_JSL_Log_stica__Processo_Seletivo_d80f5c2b.png"
                  alt="Ícone oficial do aplicativo JSL - Processo seletivo"
                  referrerPolicy="no-referrer"
                  onError={() => setIconError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#C8102E] text-white flex flex-col items-center justify-center p-3 text-center">
                  <Smartphone className="w-8 h-8 mb-1" aria-hidden="true" />
                  <span className="font-display font-extrabold text-sm">JSL</span>
                </div>
              )}
            </div>

            {/* Título e Desenvolvedor */}
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight text-balance">
                JSL - Processo seletivo
              </h1>
              <p className="mt-1 sm:mt-1.5 text-xs sm:text-base font-semibold text-[#01875F]">
                JSL - LOGÍSTICA · Vagas de Emprego
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-zinc-600">
                <span className="inline-flex items-center gap-1 font-medium text-zinc-700">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#01875F] shrink-0" aria-hidden="true" />
                  Aplicativo oficial verificado
                </span>
                <span aria-hidden="true">·</span>
                <span>Sem anúncios</span>
                <span aria-hidden="true">·</span>
                <span>Gratuito</span>
              </div>
            </div>

            {/* Métricas e Botão de Download */}
            <div className="col-span-2 sm:col-span-1 sm:col-start-2 min-w-0 space-y-4">
              {/* Barra de métricas estilo Play Store */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-0 sm:divide-x sm:divide-zinc-200 pt-1">
                <div className="sm:pr-5">
                  <p className="text-sm sm:text-base font-extrabold text-zinc-950 tabular-nums flex items-center gap-1">
                    4,9
                    <Star className="w-3.5 h-3.5 fill-zinc-950 text-zinc-950" aria-hidden="true" />
                  </p>
                  <p className="text-xs text-zinc-500 tabular-nums">2,4 mil avaliações</p>
                </div>

                <div className="sm:px-5">
                  <p className="text-sm sm:text-base font-extrabold text-zinc-950 tabular-nums">
                    {release ? formatBytesMb(release.sizeBytes) : 'Android'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {release ? 'Tamanho do APK' : 'Pacote oficial'}
                  </p>
                </div>

                <div className="sm:px-5">
                  <p className="text-sm sm:text-base font-extrabold text-zinc-950 tabular-nums">
                    {displayDownloadCount}+
                  </p>
                  <p className="text-xs text-zinc-500">Downloads</p>
                </div>

                <div className="sm:pl-5">
                  <p className="text-sm sm:text-base font-extrabold text-zinc-950 tabular-nums">
                    {release ? `v${release.version}` : 'Em preparo'}
                  </p>
                  <p className="text-xs text-zinc-500">Versão atual</p>
                </div>
              </div>

              {/* Ações Principais de Download */}
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
                {loading ? (
                  <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-zinc-600 bg-zinc-100 rounded-lg min-h-[48px]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#01875F]" aria-hidden="true" />
                    Verificando versão disponível...
                  </div>
                ) : release ? (
                  <a
                    href={release.downloadUrl}
                    download={`JSL-Processo-Seletivo-v${release.version}.apk`}
                    onClick={handleTriggerDownload}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 text-sm sm:text-base font-bold text-white bg-[#01875F] hover:bg-[#016D4D] rounded-lg transition-colors min-h-[48px] shadow-sm text-center cursor-pointer"
                  >
                    <Download className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>Baixar Aplicativo (v{release.version})</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-lg min-h-[48px] cursor-not-allowed"
                  >
                    <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Aguardando publicação do APK
                  </button>
                )}
              </div>

              {/* Feedback imediato ao clicar em baixar */}
              {downloadStarted && release && (
                <div
                  role="status"
                  className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-950 space-y-2"
                >
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="w-5 h-5 text-[#01875F] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-bold">
                        Download iniciado: JSL - Processo seletivo (v{release.version})
                      </p>
                      <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                        Assim que terminar de baixar, toque no arquivo <strong>.apk</strong> na
                        barra de notificações do seu celular Android para concluir a instalação.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!loading && !release && (
                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
                  O arquivo oficial do aplicativo (.apk) está sendo liberado pelo recrutamento.
                  Atualize esta página em instantes para fazer o download.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo Detalhado estilo Play Store */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        {/* Capturas de tela estilo Play Store — mostrando o processo seletivo por dentro */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-extrabold text-zinc-950">
                Por dentro do aplicativo
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                Veja como funciona o processo seletivo no celular antes mesmo de baixar
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                aria-label="Rolar prévias para a esquerda"
                onClick={() => galleryRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                className="w-9 h-9 rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Rolar prévias para a direita"
                onClick={() => galleryRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                className="w-9 h-9 rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            ref={galleryRef}
            className="flex gap-3.5 sm:gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth no-scrollbar"
          >
            {APP_SCREENSHOTS.map((screen, idx) => (
              <button
                key={screen.id}
                type="button"
                onClick={() => setActiveScreenshot(idx)}
                className="snap-start shrink-0 w-[188px] sm:w-[225px] text-left group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#01875F] rounded-2xl"
              >
                <div className="h-[305px] sm:h-[340px] rounded-[22px] sm:rounded-[24px] border-[3px] border-zinc-900 bg-white shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
                  <div className="h-3 bg-zinc-900 flex items-center justify-center shrink-0">
                    <span className="w-10 h-1 rounded-full bg-zinc-700" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <AppScreenPreview id={screen.id} compact />
                  </div>
                </div>
                <p className="mt-2.5 text-xs font-bold text-zinc-900 group-hover:text-[#01875F]">
                  {idx + 1}. {screen.title}
                </p>
                <p className="text-[11px] text-zinc-500 leading-snug">{screen.caption}</p>
              </button>
            ))}
          </div>
          <p className="sm:hidden text-[11px] font-medium text-zinc-400">
            Deslize para o lado ou toque em qualquer tela para ampliar.
          </p>
        </section>

        {/* Segurança e compatibilidade */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-zinc-200 rounded-2xl p-5 bg-neutral-50">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#01875F] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-zinc-900">Verificado e seguro</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Arquivo original assinado e publicado diretamente pelo painel administrativo.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-[#01875F] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-zinc-900">Compatível com Android</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Funciona em celulares Android 8.0 ou superior, leve e rápido mesmo em 4G.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#01875F] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-zinc-900">100% gratuito</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Nunca cobramos taxas, cursos obrigatórios ou depósitos no processo seletivo.
              </p>
            </div>
          </div>
        </section>

        {/* Sobre este app + Novidades desta versão */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8 border-b border-zinc-200">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-display text-xl font-extrabold text-zinc-950">Sobre este app</h2>
            <p className="text-sm sm:text-base text-zinc-700 leading-relaxed">
              O aplicativo <strong>JSL - Processo seletivo</strong> foi criado para facilitar a
              inscrição e o acompanhamento de candidatos nas vagas operacionais de transporte,
              distribuição e logística em todo o Brasil.
            </p>
            <p className="text-sm sm:text-base text-zinc-700 leading-relaxed">
              Com ele você escolhe a vaga ideal para o seu perfil, preenche seus dados sem
              precisar anexar currículo em PDF ou documentos pesados, salva seu progresso
              automaticamente caso a internet caia e acompanha o resultado da 1ª etapa para
              entrevista com o RH.
            </p>

            {/* Passo a passo para instalar APK */}
            <div className="border border-zinc-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowInstallGuide((v) => !v)}
                aria-expanded={showInstallGuide}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left bg-white hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="text-sm font-bold text-zinc-950">
                  Como instalar no seu celular Android (passo a passo)
                </span>
                {showInstallGuide ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" aria-hidden="true" />
                )}
              </button>
              {showInstallGuide && (
                <div className="px-5 pb-5 pt-2 border-t border-zinc-100 bg-neutral-50 space-y-3 text-xs sm:text-sm text-zinc-700">
                  <p>
                    <strong>1. Baixe o aplicativo:</strong> Toque no botão verde{' '}
                    <strong>Baixar Aplicativo</strong> acima e aguarde o término do download.
                  </p>
                  <p>
                    <strong>2. Abra o arquivo .apk:</strong> Toque em{' '}
                    <strong>Abrir</strong> na barra inferior do navegador ou na notificação do
                    Android.
                  </p>
                  <p>
                    <strong>3. Autorize e instale:</strong> Caso o Android pergunte se permite
                    instalar apps pelo navegador, toque em{' '}
                    <strong>Configurações → Permitir desta fonte</strong>, volte e toque em{' '}
                    <strong>Instalar</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ficha técnica e novidades da versão */}
          <div className="bg-neutral-50 border border-zinc-200 rounded-2xl p-5 space-y-4 self-start">
            <h3 className="font-display text-base font-extrabold text-zinc-950">
              Informações da versão
            </h3>
            <dl className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Versão</dt>
                <dd className="font-semibold text-zinc-950 tabular-nums">
                  {release ? `v${release.version}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Tamanho</dt>
                <dd className="font-semibold text-zinc-950 tabular-nums">
                  {release ? formatBytesMb(release.sizeBytes) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Atualizado em</dt>
                <dd className="font-semibold text-zinc-950 tabular-nums">
                  {release?.publishedAt ? formatDateTimeSaoPaulo(release.publishedAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Canal</dt>
                <dd className="font-semibold text-zinc-950">
                  {channelPrefix || 'Site Oficial'}
                </dd>
              </div>
            </dl>
            {release?.releaseNotes && (
              <div className="pt-3 border-t border-zinc-200">
                <p className="text-xs font-bold text-zinc-800 mb-1">Novidades desta versão</p>
                <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">
                  {release.releaseNotes}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Avaliações e Comentários estilo Google Play */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-zinc-950">
                Classificações e resenhas
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Opiniões de candidatos que usaram o aplicativo no processo seletivo
              </p>
            </div>
          </div>

          {/* Nota geral + barras de distribuição */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border border-zinc-200 rounded-2xl p-6 bg-white">
            <div className="md:col-span-4 space-y-2">
              <p className="font-display text-5xl font-extrabold text-zinc-950 tabular-nums">
                4,9
              </p>
              <StarRow count={5} sizeClass="w-4 h-4" />
              <p className="text-xs text-zinc-500 tabular-nums">2.418 avaliações verificadas</p>
            </div>
            <div className="md:col-span-8 space-y-2">
              {RATING_BREAKDOWN.map((row) => (
                <div key={row.stars} className="flex items-center gap-3 text-xs text-zinc-600">
                  <span className="w-3 font-semibold tabular-nums">{row.stars}</span>
                  <div className="flex-1 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#01875F] rounded-full"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-zinc-500 tabular-nums">{row.percent}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filtros funcionais */}
          <div className="w-full overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 min-w-max">
              {(
                [
                  { id: 'all', label: 'Mais relevantes' },
                  { id: 'motorista', label: 'Motoristas' },
                  { id: 'logistica', label: 'Logística e Estoque' },
                  { id: '5star', label: '5 estrelas' },
                ] as const
              ).map((tab) => {
                const active = reviewFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReviewFilter(tab.id)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer ${
                      active
                        ? 'bg-[#01875F] text-white border-[#01875F]'
                        : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de avaliações */}
          <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-2xl bg-white">
            {filteredReviews.map((rev) => {
              const vote = helpfulVotes[rev.id];
              const helpfulCount = rev.helpfulBase + (vote === 'yes' ? 1 : 0);
              return (
                <article key={rev.id} className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-full ${rev.avatarColor} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                        aria-hidden="true"
                      >
                        {rev.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-950 truncate">{rev.author}</p>
                        <p className="text-xs text-zinc-500 truncate">{rev.roleLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-zinc-500">
                    <StarRow count={rev.rating} />
                    <span>{rev.dateLabel}</span>
                  </div>

                  <p className="text-sm text-zinc-800 leading-relaxed">{rev.text}</p>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                    <span className="tabular-nums">
                      {helpfulCount} pessoas acharam esta avaliação útil
                    </span>
                    <div className="flex items-center gap-2">
                      <span>Isso foi útil?</span>
                      <button
                        type="button"
                        onClick={() =>
                          setHelpfulVotes((prev) => ({
                            ...prev,
                            [rev.id]: prev[rev.id] === 'yes' ? 'no' : 'yes',
                          }))
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                          vote === 'yes'
                            ? 'bg-emerald-50 border-[#01875F] text-[#01875F]'
                            : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHelpfulVotes((prev) => ({ ...prev, [rev.id]: 'no' }))
                        }
                        className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                          vote === 'no'
                            ? 'bg-zinc-100 border-zinc-400 text-zinc-900'
                            : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modal de ampliação das telas do app */}
      {activeScreenshot !== null && APP_SCREENSHOTS[activeScreenshot] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={APP_SCREENSHOTS[activeScreenshot].title}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-4"
          onClick={() => setActiveScreenshot(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#01875F]">
                  Tela {activeScreenshot + 1} de {APP_SCREENSHOTS.length}
                </p>
                <h3 className="font-display text-base font-extrabold text-zinc-950">
                  {APP_SCREENSHOTS[activeScreenshot].title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreenshot(null)}
                aria-label="Fechar prévia"
                className="p-2 text-zinc-500 hover:text-zinc-900 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-[24px] border-[4px] border-zinc-900 bg-white overflow-hidden h-[360px] sm:h-[420px] flex flex-col">
              <div className="h-3.5 bg-zinc-900 flex items-center justify-center shrink-0">
                <span className="w-12 h-1 rounded-full bg-zinc-700" />
              </div>
              <div className="flex-1 overflow-hidden">
                <AppScreenPreview id={APP_SCREENSHOTS[activeScreenshot].id} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setActiveScreenshot((i) =>
                    i === null ? 0 : (i - 1 + APP_SCREENSHOTS.length) % APP_SCREENSHOTS.length
                  )
                }
                className="inline-flex items-center gap-1 px-4 py-2.5 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl min-h-[42px] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveScreenshot((i) =>
                    i === null ? 0 : (i + 1) % APP_SCREENSHOTS.length
                  )
                }
                className="inline-flex items-center gap-1 px-4 py-2.5 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl min-h-[42px] cursor-pointer"
              >
                Próxima
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
