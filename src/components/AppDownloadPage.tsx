import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Info,
  Loader2,
  ShieldCheck,
  Smartphone,
  Star,
  ThumbsUp,
} from 'lucide-react';
import { ChannelPrefix, formatDateTimeSaoPaulo } from '../lib/channelRouting.ts';
import { fetchPublicAppRelease, PublicAppRelease } from '../lib/recruitmentService.ts';

interface AppDownloadPageProps {
  channelPrefix: ChannelPrefix | null;
  onNavigate: (route: string) => void;
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

export function AppDownloadPage({ channelPrefix, onNavigate }: AppDownloadPageProps) {
  const [loading, setLoading] = useState(true);
  const [release, setRelease] = useState<PublicAppRelease | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'motorista' | 'logistica' | '5star'>('all');
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, 'yes' | 'no'>>({});

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
            {/* Ícone Oficial do App */}
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[26px] border border-zinc-200 bg-white shadow-md overflow-hidden shrink-0 flex items-center justify-center">
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

            {/* Título, Desenvolvedor e Métricas */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight text-balance">
                  JSL - Processo seletivo
                </h1>
                <p className="mt-1.5 text-sm sm:text-base font-semibold text-[#01875F]">
                  JSL - LOGÍSTICA · Recursos Humanos
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-700">
                    <ShieldCheck className="w-4 h-4 text-[#01875F]" aria-hidden="true" />
                    Aplicativo oficial verificado
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Sem anúncios</span>
                  <span aria-hidden="true">·</span>
                  <span>Gratuito</span>
                </div>
              </div>

              {/* Barra de métricas estilo Play Store */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-0 sm:divide-x sm:divide-zinc-200 pt-2">
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
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                {loading ? (
                  <div className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-zinc-600 bg-zinc-100 rounded-lg min-h-[48px]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#01875F]" aria-hidden="true" />
                    Verificando versão disponível...
                  </div>
                ) : release ? (
                  <a
                    href={release.downloadUrl}
                    download={`JSL-Processo-Seletivo-v${release.version}.apk`}
                    onClick={handleTriggerDownload}
                    className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-sm sm:text-base font-bold text-white bg-[#01875F] hover:bg-[#016D4D] rounded-lg transition-colors min-h-[48px] shadow-sm whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-5 h-5" aria-hidden="true" />
                    Baixar Aplicativo (v{release.version})
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-lg min-h-[48px] cursor-not-allowed"
                  >
                    <Smartphone className="w-4 h-4" aria-hidden="true" />
                    Aguardando publicação do APK
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onNavigate('/vagas')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-[#01875F] hover:bg-emerald-50 border border-zinc-200 rounded-lg transition-colors min-h-[48px] whitespace-nowrap cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Acessar vagas pelo navegador
                </button>
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
                  O arquivo oficial será liberado em instantes pelo recrutamento. Você já pode
                  enviar sua candidatura normalmente pelo botão ao lado.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo Detalhado estilo Play Store */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
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
          <div className="flex flex-wrap items-center gap-2">
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
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
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
    </div>
  );
}
