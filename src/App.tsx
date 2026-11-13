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
import { verifyFirestoreConnection } from './lib/firebase.ts';
import { fetchCompanySettings, fetchPublicJobs } from './lib/recruitmentService.ts';
import { CompanySettings, JobPosting } from './types/recruitment.ts';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [jobs, setJobs] = useState<JobPosting[]>(DEFAULT_JOBS);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [receipt, setReceipt] = useState<ConfirmationReceipt | null>(null);

  const loadPublicData = useCallback(async () => {
    const [{ jobs: loadedJobs }, loadedSettings] = await Promise.all([
      fetchPublicJobs(),
      fetchCompanySettings(),
    ]);
    setJobs(loadedJobs);
    setSettings(loadedSettings);
  }, []);

  useEffect(() => {
    verifyFirestoreConnection();
    loadPublicData();
  }, [loadPublicData]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectJobForApplication = useCallback(
    (job: JobPosting) => {
      setSelectedJob(job);
      navigate('/candidatura');
    },
    [navigate]
  );

  const handleViewJobDetails = useCallback(
    (job: JobPosting) => {
      navigate(`/vagas/${job.slug}`);
    },
    [navigate]
  );

  const renderPage = () => {
    if (currentPath === '/' || currentPath === '') {
      return (
        <HomePage
          jobs={jobs}
          brandSubtitle={settings.brandSubtitle}
          onSelectJobForApplication={handleSelectJobForApplication}
          onViewJobDetails={handleViewJobDetails}
          onNavigate={navigate}
        />
      );
    }

    if (currentPath === '/vagas') {
      return (
        <JobsListPage
          jobs={jobs}
          onSelectJobForApplication={handleSelectJobForApplication}
          onViewJobDetails={handleViewJobDetails}
        />
      );
    }

    if (currentPath.startsWith('/vagas/')) {
      const slug = currentPath.replace('/vagas/', '').trim();
      const job = jobs.find((j) => j.slug === slug || j.id === slug);
      if (!job) {
        return <NotFoundPage onNavigate={navigate} />;
      }
      return (
        <JobDetailsPage
          job={job}
          onSelectJobForApplication={handleSelectJobForApplication}
          onBack={() => navigate('/vagas')}
        />
      );
    }

    if (currentPath === '/candidatura') {
      return (
        <ApplicationWizard
          selectedJob={selectedJob}
          availableJobs={jobs}
          settings={settings}
          onSelectJob={(job) => setSelectedJob(job)}
          onSuccess={(conf) => {
            setReceipt(conf);
            navigate('/confirmacao');
          }}
          onNavigate={navigate}
        />
      );
    }

    if (currentPath === '/confirmacao') {
      return <ConfirmationPage receipt={receipt} onNavigate={navigate} />;
    }

    if (currentPath === '/privacidade') {
      return <PrivacyPolicyPage settings={settings} />;
    }

    if (currentPath === '/termos') {
      return <TermsOfUsePage settings={settings} />;
    }

    if (currentPath === '/contato') {
      return <ContactPage settings={settings} />;
    }

    if (currentPath === '/admin') {
      return (
        <AdminDashboard
          companySettings={settings}
          onSettingsUpdated={(next) => setSettings(next)}
          onJobsUpdated={loadPublicData}
          onNavigate={navigate}
        />
      );
    }

    return <NotFoundPage onNavigate={navigate} />;
  };

  const isAdminRoute = currentPath === '/admin';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-zinc-900">
      <Header
        currentPath={currentPath}
        brandName={settings.brandName}
        onNavigate={navigate}
      />
      <main className="flex-1">{renderPage()}</main>
      {!isAdminRoute && <Footer settings={settings} onNavigate={navigate} />}
    </div>
  );
}
