import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
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

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(resolveInitialJobFromUrl);
  const [receipt, setReceipt] = useState<ConfirmationReceipt | null>(null);

  const jobs = DEFAULT_JOBS;
  const settings = DEFAULT_COMPANY_SETTINGS;

  const parsed = parseAppLocation(pathname);

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

  const handleSelectJobForApplication = useCallback(
    (job: JobPosting) => {
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

  const renderPage = () => {
    const route = parsed.route;

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
            navigateRoute('/confirmacao');
          }}
          onNavigate={navigateRoute}
        />
      );
    }

    if (route === '/confirmacao') {
      return <ConfirmationPage receipt={receipt} onNavigate={navigateRoute} />;
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

    if (route === '/admin') {
      return <AdminDashboard onNavigate={navigateRoute} />;
    }

    return <NotFoundPage onNavigate={navigateRoute} />;
  };

  const isAdminRoute = parsed.route === '/admin';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-zinc-900">
      <Header
        currentRoute={parsed.route}
        channelPrefix={parsed.channelPrefix}
        brandName={settings.brandName}
        onNavigate={navigateRoute}
      />
      <main className="flex-1">{renderPage()}</main>
      {!isAdminRoute && (
        <Footer
          settings={settings}
          channelPrefix={parsed.channelPrefix}
          onNavigate={navigateRoute}
        />
      )}
    </div>
  );
}
