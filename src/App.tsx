import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AppDownloadPage } from './components/AppDownloadPage.tsx';
import { ApplicationWizard } from './components/ApplicationWizard.tsx';
import { ConfirmationPage, ConfirmationReceipt } from './components/ConfirmationPage.tsx';
import { Footer } from './components/Footer.tsx';
import { Header } from './components/Header.tsx';
import { HomePage } from './components/HomePage.tsx';
import {
  ContactPage,
  NotFoundPage,
  PrivacyPolicyPage,
  TermsOfUsePage,
} from './components/InstitutionalPages.tsx';
import { JobDetailsPage } from './components/JobDetailsPage.tsx';
import { JobsListPage } from './components/JobsListPage.tsx';
import { DEFAULT_COMPANY_SETTINGS, DEFAULT_JOBS } from './data/defaultJobs.ts';
import { buildChannelPath, parseAppLocation } from './lib/channelRouting.ts';
import {
  clearApplicationDraft,
  hasDraftMeaningfulProgress,
  loadApplicationDraft,
  SavedApplicationDraft,
} from './lib/draftStorage.ts';
import { fetchMyApplicationStatus } from './lib/recruitmentService.ts';
import { JobPosting } from './types/recruitment.ts';

function resolveInitialJobFromUrl(): JobPosting | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('vaga');
    if (!slug) return null;
    return DEFAULT_JOBS.find((j) => j.slug === slug || j.id === slug) || null;
  } catch {
    return null;
  }
}

function isMainEntryRoute(route: string): boolean {
  return route === '/' || route === '';
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(resolveInitialJobFromUrl);
  const [receipt, setReceipt] = useState<ConfirmationReceipt | null>(null);
  const [lockedByIp, setLockedByIp] = useState(false);

  const jobs = DEFAULT_JOBS;
  const settings = DEFAULT_COMPANY_SETTINGS;
  const parsed = parseAppLocation(pathname);

  const [checkingIpStatus, setCheckingIpStatus] = useState<boolean>(
    () => isMainEntryRoute(parsed.route) || parsed.route === '/confirmacao'
  );
  const [savedDraft, setSavedDraft] = useState<SavedApplicationDraft | null>(() =>
    loadApplicationDraft(parsed.channelPrefix)
  );
  const hasAutoResumedRef = useRef(false);
  const checkedChannelRef = useRef<string | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname || '/');
      const fromUrl = resolveInitialJobFromUrl();
      if (fromUrl) setSelectedJob(fromUrl);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateRoute = useCallback(
    (targetRoute: string, queryString = '') => {
      const targetFull = buildChannelPath(parsed.channelPrefix, targetRoute) + queryString;
      const currentFull = window.location.pathname + window.location.search;
      if (targetFull !== currentFull) {
        window.history.pushState({}, '', targetFull);
      }
      setPathname(buildChannelPath(parsed.channelPrefix, targetRoute));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [parsed.channelPrefix]
  );

  const replaceRoute = useCallback(
    (targetRoute: string, queryString = '') => {
      const targetFull = buildChannelPath(parsed.channelPrefix, targetRoute) + queryString;
      const currentFull = window.location.pathname + window.location.search;
      if (targetFull !== currentFull) {
        window.history.replaceState({}, '', targetFull);
      }
      setPathname(buildChannelPath(parsed.channelPrefix, targetRoute));
    },
    [parsed.channelPrefix]
  );

  // Ao entrar na URL principal (/, /vagas1, /vagas2) ou recarregar /confirmacao, verifica se este IP já enviou candidatura
  useEffect(() => {
    const shouldCheckIp = isMainEntryRoute(parsed.route) || parsed.route === '/confirmacao';
    if (!shouldCheckIp) {
      setCheckingIpStatus(false);
      return;
    }

    const channelKey = parsed.channelPrefix ?? '__main__';
    if (checkedChannelRef.current === channelKey && (lockedByIp || receipt)) {
      setCheckingIpStatus(false);
      return;
    }

    let cancelled = false;
    setCheckingIpStatus(true);

    fetchMyApplicationStatus(parsed.channelPrefix)
      .then((res) => {
        if (cancelled) return;
        checkedChannelRef.current = channelKey;
        const latestRoute = parseAppLocation(window.location.pathname || '/').route;

        if (res.submitted && res.receipt) {
          clearApplicationDraft(parsed.channelPrefix);
          setSavedDraft(null);
          setReceipt(res.receipt);
          setLockedByIp(true);
          if (isMainEntryRoute(latestRoute)) {
            replaceRoute('/confirmacao');
          }
          return;
        }

        setLockedByIp(false);
        const draft = loadApplicationDraft(parsed.channelPrefix);
        setSavedDraft(hasDraftMeaningfulProgress(draft) ? draft : null);

        if (draft && hasDraftMeaningfulProgress(draft) && !hasAutoResumedRef.current) {
          hasAutoResumedRef.current = true;
          const draftJob = jobs.find((j) => j.id === draft.jobId);
          if (draftJob) {
            setSelectedJob(draftJob);
            if (isMainEntryRoute(latestRoute)) {
              replaceRoute('/candidatura', `?vaga=${encodeURIComponent(draftJob.slug)}`);
            }
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        const draft = loadApplicationDraft(parsed.channelPrefix);
        setSavedDraft(hasDraftMeaningfulProgress(draft) ? draft : null);
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingIpStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.channelPrefix, parsed.route]);

  // Se o candidato já tem candidatura registrada por este IP, redireciona para /confirmacao apenas quando entrar na URL principal
  useEffect(() => {
    if (!lockedByIp) return;
    if (isMainEntryRoute(parsed.route)) {
      replaceRoute('/confirmacao');
    }
  }, [lockedByIp, parsed.route, replaceRoute]);

  // Mantém estado do rascunho atualizado ao navegar entre rotas
  useEffect(() => {
    if (lockedByIp || parsed.route === '/painel') return;
    const draft = loadApplicationDraft(parsed.channelPrefix);
    setSavedDraft(hasDraftMeaningfulProgress(draft) ? draft : null);
  }, [lockedByIp, parsed.channelPrefix, parsed.route]);

  const handleSelectJobForApplication = useCallback(
    (job: JobPosting) => {
      hasAutoResumedRef.current = true;
      setSelectedJob(job);
      navigateRoute('/candidatura', `?vaga=${encodeURIComponent(job.slug)}`);
    },
    [navigateRoute]
  );

  const handleViewJobDetails = useCallback(
    (job: JobPosting) => {
      navigateRoute(`/vagas/${job.slug}`);
    },
    [navigateRoute]
  );

  const handleResumeDraft = () => {
    if (!savedDraft) return;
    const draftJob = jobs.find((j) => j.id === savedDraft.jobId);
    if (draftJob) {
      setSelectedJob(draftJob);
      navigateRoute('/candidatura', `?vaga=${encodeURIComponent(draftJob.slug)}`);
    } else {
      navigateRoute('/candidatura');
    }
  };

  const handleDiscardDraft = () => {
    clearApplicationDraft(parsed.channelPrefix);
    setSavedDraft(null);
    setSelectedJob(null);
  };

  const renderPage = () => {
    const route = parsed.route;

    if (route === '/painel') {
      return <AdminDashboard onNavigate={navigateRoute} />;
    }

    if (route === '/aplicativo') {
      return <AppDownloadPage channelPrefix={parsed.channelPrefix} />;
    }

    if (
      checkingIpStatus &&
      (isMainEntryRoute(route) || route === '/confirmacao')
    ) {
      return (
        <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-[#C8102E] animate-spin mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-600">Carregando seu acesso...</p>
        </div>
      );
    }

    if (route === '/' || route === '') {
      return (
        <HomePage
          jobs={jobs}
          brandSubtitle={settings.brandSubtitle}
          onSelectJobForApplication={handleSelectJobForApplication}
          onViewJobDetails={handleViewJobDetails}
          onNavigate={navigateRoute}
        />
      );
    }

    if (route === '/vagas') {
      return (
        <JobsListPage
          jobs={jobs}
          onSelectJobForApplication={handleSelectJobForApplication}
          onViewJobDetails={handleViewJobDetails}
        />
      );
    }

    if (route.startsWith('/vagas/')) {
      const slug = route.replace('/vagas/', '').trim();
      const job = jobs.find((j) => j.slug === slug || j.id === slug);
      if (!job) {
        return <NotFoundPage onNavigate={navigateRoute} />;
      }
      return (
        <JobDetailsPage
          job={job}
          onSelectJobForApplication={handleSelectJobForApplication}
          onBack={() => navigateRoute('/vagas')}
        />
      );
    }

    if (route === '/candidatura') {
      return (
        <ApplicationWizard
          selectedJob={selectedJob}
          availableJobs={jobs}
          channelPrefix={parsed.channelPrefix}
          settings={settings}
          onSelectJob={(job) => {
            setSelectedJob(job);
            navigateRoute('/candidatura', `?vaga=${encodeURIComponent(job.slug)}`);
          }}
          onSuccess={(conf) => {
            setReceipt(conf);
            setSavedDraft(null);
            setLockedByIp(true);
            navigateRoute('/confirmacao');
          }}
          onNavigate={navigateRoute}
        />
      );
    }

    if (route === '/confirmacao') {
      return (
        <ConfirmationPage
          receipt={receipt}
          lockedByIp={lockedByIp}
          onNavigate={navigateRoute}
        />
      );
    }

    if (route === '/privacidade') {
      return <PrivacyPolicyPage settings={settings} />;
    }

    if (route === '/termos') {
      return <TermsOfUsePage settings={settings} />;
    }

    if (route === '/contato') {
      return <ContactPage settings={settings} channelPrefix={parsed.channelPrefix} />;
    }

    return <NotFoundPage onNavigate={navigateRoute} />;
  };

  const isAdminRoute = parsed.route === '/painel';
  const draftJob = savedDraft ? jobs.find((j) => j.id === savedDraft.jobId) : null;
  const showDraftBanner =
    !isAdminRoute &&
    !lockedByIp &&
    !checkingIpStatus &&
    Boolean(savedDraft && draftJob) &&
    parsed.route !== '/candidatura' &&
    parsed.route !== '/confirmacao' &&
    parsed.route !== '/aplicativo';

  return (
    <div className="min-h-dvh flex flex-col bg-neutral-50 text-zinc-900 overflow-x-clip">
      <Header
        currentRoute={parsed.route}
        channelPrefix={parsed.channelPrefix}
        brandName={settings.brandName}
        onNavigate={navigateRoute}
      />
      {showDraftBanner && draftJob && savedDraft && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-amber-950 leading-snug">
              <strong>Inscrição em andamento:</strong> {draftJob.title} (Etapa {savedDraft.step + 1}{' '}
              de 3). Seus dados preenchidos estão salvos.
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-3 py-2 text-xs font-semibold text-amber-900 hover:underline cursor-pointer min-h-[38px]"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleResumeDraft}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-lg cursor-pointer min-h-[40px]"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Continuar de onde parei
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="flex-1 min-w-0">{renderPage()}</main>
      {!isAdminRoute && (
        <Footer
          settings={settings}
          channelPrefix={parsed.channelPrefix}
          currentRoute={parsed.route}
          onNavigate={navigateRoute}
        />
      )}
    </div>
  );
}
