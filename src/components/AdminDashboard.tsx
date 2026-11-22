import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { DEFAULT_JOBS } from '../data/defaultJobs.ts';
import { formatDateTimeSaoPaulo, getSaoPauloTodayYmd } from '../lib/channelRouting.ts';
import {
  AdminApplicationDetailResponse,
  AdminApplicationListResponse,
  AdminAppReleaseListResponse,
  AdminFilterParams,
  adminLogin,
  adminLogout,
  AdminUserSession,
  ApkUploadProgress,
  buildAdminExportUrl,
  deleteAdminApplication,
  deleteAdminAppRelease,
  downloadAdminAttachment,
  fetchAdminApplicationDetail,
  fetchAdminApplications,
  fetchAdminAppReleases,
  fetchAdminSession,
  updateAdminApplication,
  uploadAndPublishApk,
} from '../lib/recruitmentService.ts';
import { APPLICATION_STATUSES, ApplicationStatus } from '../types/recruitment.ts';

interface AdminDashboardProps {
  onNavigate: (route: string) => void;
}

const ROLE_SPECIFIC_LABELS: Record<string, string> = {
  cnhCategory: 'Categoria da CNH',
  hasValidCnh: 'CNH válida',
  truckExperience: 'Experiência dirigindo caminhões',
  truckExperienceDuration: 'Tempo de experiência com caminhões',
  truckTypesDriven: 'Tipos de caminhões já dirigidos',
  intercityInterstateTravel: 'Experiência em viagens intermunicipais/interestaduais',
  truckTravelAvailability: 'Disponibilidade para viagens',
  truckOvernightAvailability: 'Disponibilidade para pernoite',
  truckFlexibleHours: 'Disponibilidade para horários variáveis',
  transportCourses: 'Cursos de transporte relevantes',
  hasValidCnhBPlus: 'CNH B ou superior válida',
  utilityVehicleExperience: 'Experiência com veículos utilitários',
  deliveryExperience: 'Experiência com entregas',
  routeExperience: 'Experiência com rotas',
  fiorinoTravelAvailability: 'Disponibilidade para viagens',
  fiorinoOvernightAvailability: 'Disponibilidade para pernoites',
  fiorinoHoursAvailability: 'Disponibilidade de horários',
  forkliftTraining: 'Treinamento para operar empilhadeira',
  forkliftCertificate: 'Possui certificado',
  forkliftEquipmentTypes: 'Equipamentos operados',
  forkliftWorkExperience: 'Experiência profissional como operador',
  forkliftExperienceDuration: 'Tempo de experiência',
  forkliftUpdatedLegalTraining: 'Treinamento atualizado (NR-11)',
  orderPickingExp: 'Experiência com separação de pedidos',
  stockOrganizationExp: 'Experiência com organização de estoque',
  warehouseExp: 'Experiência em galpões/CDs',
  auxSchedule6x1: 'Disponibilidade escala 6x1',
  manualHandlingSafeLimits: 'Movimentação manual dentro dos limites legais',
  productInspectionExp: 'Experiência com conferência de produtos',
  parcelIdentificationExp: 'Experiência com identificação de encomendas',
  barcodeScannerExp: 'Uso de leitor de código de barras',
  inventoryControlExp: 'Controle de estoque',
  conferenteSchedule6x1: 'Disponibilidade escala 6x1',
  operationalTasksFit: 'Disponibilidade para tarefas operacionais',
};

function getStatusTextClass(status: string): string {
  if (status === 'Recebida') return 'text-[#C8102E]';
  if (status === 'Processo finalizado') return 'text-emerald-700';
  if (status === 'Entrevista agendada' || status === 'Entrevista concluída') return 'text-amber-700';
  return 'text-zinc-800';
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [session, setSession] = useState<AdminUserSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Copy channel link feedback
  const [copiedChannel, setCopiedChannel] = useState(false);

  // List & Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [listData, setListData] = useState<AdminApplicationListResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState('');

  // Drawer details
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<AdminApplicationDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [nextStatus, setNextStatus] = useState<ApplicationStatus>('Recebida');
  const [statusComment, setStatusComment] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    candidateName: string;
    protocol: string;
  } | null>(null);
  const [deletingApplication, setDeletingApplication] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState('');

  // Tab & APK management (exclusivo tenant 2)
  const [activeTab, setActiveTab] = useState<'applications' | 'app-release'>('applications');
  const [appReleasesData, setAppReleasesData] = useState<AdminAppReleaseListResponse | null>(null);
  const [loadingAppReleases, setLoadingAppReleases] = useState(false);
  const [appReleaseError, setAppReleaseError] = useState('');
  const [appReleaseSuccess, setAppReleaseSuccess] = useState('');
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [apkVersion, setApkVersion] = useState('1.0.0');
  const [apkNotes, setApkNotes] = useState('');
  const [uploadingApk, setUploadingApk] = useState(false);
  const [apkProgress, setApkProgress] = useState<ApkUploadProgress | null>(null);
  const [copiedAppLink, setCopiedAppLink] = useState(false);
  const [deletingReleaseId, setDeletingReleaseId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdminSession()
      .then((user) => {
        if (active) setSession(user);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearchApplied(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const currentFilterParams: AdminFilterParams = {
    search: searchApplied,
    status: statusFilter,
    jobId: jobFilter,
    dateFrom,
    dateTo,
    page,
    pageSize,
  };

  const loadApplications = useCallback(async () => {
    if (!session) return;
    setLoadingList(true);
    setListError('');
    try {
      const data = await fetchAdminApplications({
        search: searchApplied,
        status: statusFilter,
        jobId: jobFilter,
        dateFrom,
        dateTo,
        page,
        pageSize,
      });
      setListData(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar candidaturas.';
      setListError(msg);
      if (msg.toLowerCase().includes('não autenticada') || msg.toLowerCase().includes('expirada')) {
        setSession(null);
      }
    } finally {
      setLoadingList(false);
    }
  }, [session, searchApplied, statusFilter, jobFilter, dateFrom, dateTo, page, pageSize]);

  const loadAppReleases = useCallback(async () => {
    if (!session || session.tenantId !== 2) return;
    setLoadingAppReleases(true);
    setAppReleaseError('');
    try {
      const data = await fetchAdminAppReleases();
      setAppReleasesData(data);
      if (data.active?.version) {
        const match = data.active.version.match(/^(\d+)\.(\d+)\.(\d+)$/);
        if (match) {
          setApkVersion(`${match[1]}.${match[2]}.${Number(match[3]) + 1}`);
        }
      }
    } catch (err) {
      setAppReleaseError(
        err instanceof Error ? err.message : 'Erro ao carregar versões do aplicativo.'
      );
    } finally {
      setLoadingAppReleases(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      loadApplications();
      if (session.tenantId === 2) {
        loadAppReleases();
      } else {
        setActiveTab('applications');
      }
    }
  }, [session, loadApplications, loadAppReleases]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const user = await adminLogin(username.trim(), password);
      setSession(user);
      setActiveTab('applications');
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Usuário ou senha inválidos.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setSession(null);
    setActiveTab('applications');
    setListData(null);
    setAppReleasesData(null);
    setSelectedId(null);
    setDetailData(null);
  };

  const handleCopyChannelLink = async () => {
    if (!session) return;
    const fullUrl = `${window.location.origin}${session.channelPath}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedChannel(true);
      setTimeout(() => setCopiedChannel(false), 2500);
    } catch {
      setCopiedChannel(false);
    }
  };

  const handleCopyAppDownloadLink = async () => {
    const fullUrl = `${window.location.origin}/aplicativo`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedAppLink(true);
      setTimeout(() => setCopiedAppLink(false), 2500);
    } catch {
      setCopiedAppLink(false);
    }
  };

  const handleUploadApkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!apkFile) {
      setAppReleaseError('Selecione o arquivo .apk do aplicativo antes de salvar.');
      return;
    }
    if (!apkVersion.trim()) {
      setAppReleaseError('Informe o número da versão (ex: 1.0.1).');
      return;
    }

    setUploadingApk(true);
    setAppReleaseError('');
    setAppReleaseSuccess('');
    setApkProgress(null);

    try {
      const published = await uploadAndPublishApk({
        file: apkFile,
        version: apkVersion.trim(),
        releaseNotes: apkNotes.trim(),
        onProgress: setApkProgress,
      });
      setApkFile(null);
      setApkNotes('');
      setAppReleaseSuccess(
        `Versão v${published.version} (${published.fileName}) salva e publicada! Quem abrir /aplicativo já baixa este novo APK.`
      );
      await loadAppReleases();
    } catch (err) {
      setAppReleaseError(
        err instanceof Error ? err.message : 'Não foi possível enviar o arquivo APK.'
      );
    } finally {
      setUploadingApk(false);
      setApkProgress(null);
    }
  };

  const handleDeleteAppRelease = async (releaseId: string) => {
    setDeletingReleaseId(releaseId);
    setAppReleaseError('');
    setAppReleaseSuccess('');
    try {
      await deleteAdminAppRelease(releaseId);
      setAppReleaseSuccess('Versão removida do histórico.');
      await loadAppReleases();
    } catch (err) {
      setAppReleaseError(
        err instanceof Error ? err.message : 'Erro ao remover versão do aplicativo.'
      );
    } finally {
      setDeletingReleaseId(null);
    }
  };

  const applyDateShortcut = (daysAgo: number) => {
    const today = getSaoPauloTodayYmd(0);
    const start = daysAgo === 0 ? today : getSaoPauloTodayYmd(-(daysAgo - 1));
    setDateFrom(start);
    setDateTo(today);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchApplied('');
    setStatusFilter('all');
    setJobFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const openDetailDrawer = async (id: string) => {
    setSelectedId(id);
    setDetailData(null);
    setDetailError('');
    setUpdateFeedback('');
    setStatusComment('');
    setLoadingDetail(true);
    try {
      const detail = await fetchAdminApplicationDetail(id);
      setDetailData(detail);
      setNextStatus(detail.application.status);
      setInternalNotes(detail.application.internalNotes || '');
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : 'Não foi possível carregar os detalhes da candidatura.'
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveStatusAndNotes = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId || !detailData) return;
    setSavingUpdate(true);
    setUpdateFeedback('');
    setDetailError('');
    try {
      await updateAdminApplication(selectedId, {
        status: nextStatus,
        comment: statusComment,
        internalNotes,
      });
      setStatusComment('');
      setUpdateFeedback('Alterações salvas e registradas no histórico.');
      const refreshed = await fetchAdminApplicationDetail(selectedId);
      setDetailData(refreshed);
      await loadApplications();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Erro ao salvar alteração.');
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleDownloadAttachment = async (fileId: string, originalName: string) => {
    setDownloadingFileId(fileId);
    setDetailError('');
    try {
      await downloadAdminAttachment(fileId, originalName);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Erro ao baixar anexo.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleExportCsv = (scope: 'page' | 'filtered') => {
    const url = buildAdminExportUrl(currentFilterParams, scope);
    window.location.href = url;
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingApplication(true);
    setListError('');
    setDetailError('');
    try {
      await deleteAdminApplication(deleteTarget.id);
      const removedProtocol = deleteTarget.protocol;
      const removedName = deleteTarget.candidateName;
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setDetailData(null);
      }
      setDeleteTarget(null);
      setDeleteFeedback(`Ficha de ${removedName} (${removedProtocol}) excluída com sucesso.`);
      if (listData && listData.items.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        await loadApplications();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir candidatura.';
      setListError(msg);
      if (selectedId === deleteTarget.id) {
        setDetailError(msg);
      }
      setDeleteTarget(null);
    } finally {
      setDeletingApplication(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center text-sm text-zinc-600">
        Verificando sessão administrativa...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 sm:py-20">
        <form
          onSubmit={handleLogin}
          className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[#C8102E]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold text-zinc-950">
                Painel Administrativo
              </h1>
              <p className="text-xs text-zinc-500">Acesso restrito ao recrutamento · JSL - LOGÍSTICA</p>
            </div>
          </div>

          {loginError && (
            <div
              role="alert"
              className="p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl"
            >
              {loginError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="admin-username"
                className="block text-sm font-semibold text-zinc-800 mb-1.5"
              >
                Usuário
              </label>
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-semibold text-zinc-800 mb-1.5"
              >
                Senha
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-3.5 px-6 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl disabled:opacity-60 cursor-pointer transition-colors"
          >
            {loggingIn ? 'Autenticando...' : 'Entrar no painel'}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer"
            >
              Voltar ao portal público
            </button>
          </div>
        </form>
      </div>
    );
  }

  const channelUrl = `${window.location.origin}${session.channelPath}`;
  const stats = listData?.stats || { total: 0, novas: 0, emAcompanhamento: 0, finalizadas: 0 };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-neutral-50">
      {/* Menu lateral grafite, branco e vermelho */}
      <aside className="lg:w-72 bg-zinc-900 text-zinc-100 shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-zinc-800">
        <div className="p-5 sm:p-6 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400">Recrutador autenticado</p>
            <p className="font-display text-lg font-extrabold text-white truncate">
              {session.displayName}
            </p>
            <p className="font-mono-tabular text-xs text-zinc-400">
              @{session.username} · Canal {session.channelPath}
            </p>
          </div>

          {/* Link exclusivo do canal */}
          <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-zinc-300">Link exclusivo do seu canal</p>
              <p className="mt-1 font-mono-tabular text-xs text-zinc-400 break-all">{channelUrl}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyChannelLink}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-lg cursor-pointer transition-colors"
              >
                {copiedChannel ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    Copiar link
                  </>
                )}
              </button>
              <a
                href={session.channelPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-zinc-200 bg-zinc-700 hover:bg-zinc-600 rounded-lg"
                title="Abrir canal em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Abrir
              </a>
            </div>
          </div>

          <nav aria-label="Navegação administrativa" className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('applications')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl border transition-colors cursor-pointer ${
                activeTab === 'applications'
                  ? 'text-white bg-zinc-800 border-zinc-700'
                  : 'text-zinc-300 border-transparent hover:bg-zinc-800/60 hover:text-white'
              }`}
            >
              <LayoutDashboard
                className={`w-4 h-4 ${
                  activeTab === 'applications' ? 'text-[#C8102E]' : 'text-zinc-400'
                }`}
                aria-hidden="true"
              />
              <span>Candidaturas do Canal</span>
            </button>

            {session.tenantId === 2 && (
              <button
                type="button"
                onClick={() => setActiveTab('app-release')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl border transition-colors cursor-pointer ${
                  activeTab === 'app-release'
                    ? 'text-white bg-zinc-800 border-zinc-700'
                    : 'text-zinc-300 border-transparent hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                <Smartphone
                  className={`w-4 h-4 ${
                    activeTab === 'app-release' ? 'text-[#C8102E]' : 'text-zinc-400'
                  }`}
                  aria-hidden="true"
                />
                <span>Aplicativo (APK)</span>
              </button>
            )}
          </nav>
        </div>

        <div className="p-5 sm:p-6 border-t border-zinc-800 flex items-center justify-between lg:block space-y-0 lg:space-y-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sair do painel
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full space-y-6">
        {session.tenantId === 2 && activeTab === 'app-release' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
                  Aplicativo Android — JSL - Processo seletivo
                </h1>
                <p className="text-sm text-zinc-600">
                  Suba uma nova versão do arquivo .apk e atualize automaticamente o link público de
                  download para os candidatos.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAppDownloadLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  {copiedAppLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      Link /aplicativo copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      Copiar link /aplicativo
                    </>
                  )}
                </button>
                <a
                  href="/aplicativo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-zinc-800 bg-white border border-zinc-300 hover:border-zinc-400 rounded-xl"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Abrir página do app
                </a>
              </div>
            </div>

            {appReleaseError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-900"
              >
                {appReleaseError}
              </div>
            )}

            {appReleaseSuccess && (
              <div
                role="status"
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-950 font-medium"
              >
                {appReleaseSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Versão ativa no momento */}
              <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <img
                    src="/assets/aistudio/Emblema_JSL_Log_stica__Processo_Seletivo_d80f5c2b.png"
                    alt="Ícone JSL - Processo seletivo"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-2xl border border-zinc-200 object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-500">Versão ativa no site</p>
                    <h2 className="font-display text-lg font-extrabold text-zinc-950 truncate">
                      JSL - Processo seletivo
                    </h2>
                    <p className="text-xs text-zinc-500 truncate">
                      {window.location.origin}/aplicativo
                    </p>
                  </div>
                </div>

                {loadingAppReleases ? (
                  <p className="text-sm text-zinc-500 py-4">Verificando versão publicada...</p>
                ) : appReleasesData?.active ? (
                  <dl className="space-y-2.5 text-sm border-t border-zinc-100 pt-4">
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">Versão publicada</dt>
                      <dd className="font-bold text-[#01875F] tabular-nums">
                        v{appReleasesData.active.version}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">Arquivo</dt>
                      <dd className="font-medium text-zinc-900 truncate max-w-[200px]">
                        {appReleasesData.active.fileName}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">Tamanho</dt>
                      <dd className="font-medium text-zinc-900 tabular-nums">
                        {(appReleasesData.active.sizeBytes / (1024 * 1024))
                          .toFixed(2)
                          .replace('.', ',')}{' '}
                        MB
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">Downloads realizados</dt>
                      <dd className="font-bold text-zinc-950 tabular-nums">
                        {appReleasesData.active.downloadCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-500">Atualizado em (SP)</dt>
                      <dd className="font-medium text-zinc-900 tabular-nums">
                        {formatDateTimeSaoPaulo(
                          appReleasesData.active.publishedAt || appReleasesData.active.createdAt
                        )}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <div className="border border-dashed border-zinc-300 rounded-xl p-4 text-xs text-zinc-600">
                    Nenhum arquivo APK foi publicado ainda. Suba o primeiro APK no formulário ao
                    lado para ativar o botão de download em <strong>/aplicativo</strong>.
                  </div>
                )}

                {appReleasesData?.active && (
                  <a
                    href="/api/app-release/download"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Testar download do APK ativo
                  </a>
                )}
              </div>

              {/* Formulário de Upload de Novo APK */}
              <form
                onSubmit={handleUploadApkSubmit}
                className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 space-y-5"
              >
                <div>
                  <h2 className="font-display text-lg font-extrabold text-zinc-950">
                    Subir nova versão do aplicativo (.apk)
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Ao clicar em &ldquo;Salvar novo APK&rdquo;, a versão anterior é arquivada e os
                    clientes baixam a nova versão automaticamente.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-800 mb-2">
                    Arquivo Android (.apk) — até 80 MB
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-300 hover:border-[#C8102E] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-neutral-50">
                    <UploadCloud className="w-8 h-8 text-[#C8102E]" aria-hidden="true" />
                    {apkFile ? (
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-zinc-950 break-all">
                          {apkFile.name}
                        </p>
                        <p className="text-xs text-zinc-500 tabular-nums">
                          {(apkFile.size / (1024 * 1024)).toFixed(2).replace('.', ',')} MB · Clique
                          para trocar
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-zinc-800">
                          Toque para escolher o arquivo .apk no seu celular ou computador
                        </p>
                        <p className="text-xs text-zinc-500">Somente pacotes Android (.apk)</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".apk,application/vnd.android.package-archive"
                      disabled={uploadingApk}
                      onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        setApkFile(selected);
                        setAppReleaseError('');
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="apk-version-input"
                      className="block text-sm font-semibold text-zinc-800 mb-1.5"
                    >
                      Versão do aplicativo
                    </label>
                    <input
                      id="apk-version-input"
                      type="text"
                      required
                      disabled={uploadingApk}
                      value={apkVersion}
                      onChange={(e) => setApkVersion(e.target.value)}
                      placeholder="Ex: 1.0.1"
                      className="w-full px-4 py-2.5 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="apk-notes-input"
                      className="block text-sm font-semibold text-zinc-800 mb-1.5"
                    >
                      Notas da atualização (opcional)
                    </label>
                    <input
                      id="apk-notes-input"
                      type="text"
                      disabled={uploadingApk}
                      value={apkNotes}
                      onChange={(e) => setApkNotes(e.target.value)}
                      placeholder="Ex: Melhorias no envio da ficha"
                      className="w-full px-4 py-2.5 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                </div>

                {uploadingApk && apkProgress && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                      <span>
                        {apkProgress.phase === 'hashing'
                          ? 'Validando pacote APK...'
                          : apkProgress.phase === 'committing'
                          ? 'Finalizando e ativando nova versão...'
                          : `Enviando parte ${apkProgress.currentChunk} de ${apkProgress.totalChunks}...`}
                      </span>
                      <span className="tabular-nums">{apkProgress.percent}%</span>
                    </div>
                    <div className="h-2.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#C8102E] transition-all duration-150"
                        style={{ width: `${apkProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploadingApk || !apkFile}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-4 h-4" aria-hidden="true" />
                  {uploadingApk ? 'Enviando e salvando...' : 'Salvar novo APK'}
                </button>
              </form>
            </div>

            {/* Histórico de versões enviadas */}
            {appReleasesData && appReleasesData.history.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="font-display text-base font-extrabold text-zinc-950">
                    Histórico de versões publicadas
                  </h3>
                  <button
                    type="button"
                    onClick={loadAppReleases}
                    disabled={loadingAppReleases}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-950 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loadingAppReleases ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    Atualizar
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-600">
                        <th className="py-3 px-4">Versão</th>
                        <th className="py-3 px-4">Arquivo</th>
                        <th className="py-3 px-4">Tamanho</th>
                        <th className="py-3 px-4">Downloads</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Publicado em</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {appReleasesData.history.map((rel) => (
                        <tr key={rel.id} className="hover:bg-zinc-50">
                          <td className="py-3 px-4 font-bold text-zinc-950 tabular-nums">
                            v{rel.version}
                          </td>
                          <td className="py-3 px-4 text-zinc-700">{rel.fileName}</td>
                          <td className="py-3 px-4 text-zinc-600 tabular-nums">
                            {(rel.sizeBytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB
                          </td>
                          <td className="py-3 px-4 text-zinc-700 tabular-nums">
                            {rel.downloadCount}
                          </td>
                          <td className="py-3 px-4 text-xs font-bold">
                            {rel.status === 'active' ? (
                              <span className="text-[#01875F]">Ativo no site</span>
                            ) : (
                              <span className="text-zinc-500">Arquivado</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-zinc-600 tabular-nums">
                            {formatDateTimeSaoPaulo(rel.publishedAt || rel.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              disabled={deletingReleaseId === rel.id}
                              onClick={() => handleDeleteAppRelease(rel.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
                  Candidaturas recebidas ({session.channelPath})
                </h1>
            <p className="text-sm text-zinc-600">
              {session.channelPath === '/vagas2'
                ? 'Inscrições recebidas pelo link /vagas2 e pelo site principal (destacadas em cor).'
                : 'Visualização exclusiva das inscrições enviadas pelo seu link de divulgação.'}
            </p>
          </div>
          <button
            type="button"
            onClick={loadApplications}
            disabled={loadingList}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-800 bg-white border border-zinc-300 hover:border-zinc-400 rounded-xl cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} aria-hidden="true" />
            Atualizar lista
          </button>
        </div>

        {/* 4 Cards KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-zinc-500">Total</p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-zinc-950 tabular-nums">
              {stats.total}
            </p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-zinc-500">Novas (Recebida)</p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#C8102E] tabular-nums">
              {stats.novas}
            </p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-zinc-500">Em acompanhamento</p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-zinc-950 tabular-nums">
              {stats.emAcompanhamento}
            </p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-zinc-500">Finalizadas</p>
            <p className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-emerald-700 tabular-nums">
              {stats.finalizadas}
            </p>
          </div>
        </div>

        {/* Barra de Filtros, Datas America/Sao_Paulo e Exportação CSV */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search
                className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar nome, e-mail, telefone, cidade ou protocolo..."
                aria-label="Buscar candidaturas"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
              />
            </div>

            <select
              value={jobFilter}
              onChange={(e) => {
                setJobFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por cargo"
              className="px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
            >
              <option value="all">Todos os cargos</option>
              {DEFAULT_JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por status"
              className="px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
            >
              <option value="all">Todos os status</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Itens por página"
              className="px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
            >
              <option value={15}>15 por página</option>
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
            </select>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-3 border-t border-zinc-100">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Data inicial (São Paulo)
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm border border-zinc-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Data final (São Paulo)
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm border border-zinc-300 rounded-xl"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDateShortcut(0)}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => applyDateShortcut(7)}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                >
                  7 dias
                </button>
                <button
                  type="button"
                  onClick={() => applyDateShortcut(30)}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                >
                  30 dias
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 rounded-xl cursor-pointer"
                >
                  Limpar filtros
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportCsv('page')}
                disabled={!listData || listData.items.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-700" aria-hidden="true" />
                Exportar CSV (página atual)
              </button>
              <button
                type="button"
                onClick={() => handleExportCsv('filtered')}
                disabled={!listData || listData.total === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                Exportar CSV (todo o filtro)
              </button>
            </div>
          </div>
        </div>

        {/* Confirmação de exclusão */}
        {deleteFeedback && (
          <div
            role="status"
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm text-emerald-900"
          >
            <span>{deleteFeedback}</span>
            <button
              type="button"
              onClick={() => setDeleteFeedback('')}
              className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Estado de erro */}
        {listError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-sm text-red-900"
          >
            <span>{listError}</span>
            <button
              type="button"
              onClick={loadApplications}
              className="px-3 py-1.5 text-xs font-bold bg-white border border-red-300 rounded-lg cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Tabela de Candidaturas */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-600">
                  <th className="py-3.5 px-4">Candidato</th>
                  <th className="py-3.5 px-4">Origem</th>
                  <th className="py-3.5 px-4">Vaga</th>
                  <th className="py-3.5 px-4">Cidade/UF</th>
                  <th className="py-3.5 px-4">Recebimento (SP)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {loadingList ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-4 w-40 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-24 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-32 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-24 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-28 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-20 bg-zinc-200 rounded" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-7 w-20 bg-zinc-200 rounded ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : !listData || listData.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 px-4 text-center">
                      <Inbox className="w-8 h-8 text-zinc-400 mx-auto mb-2" aria-hidden="true" />
                      <p className="font-display font-bold text-zinc-900">
                        Nenhuma candidatura encontrada
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Quando candidatos se inscreverem pelo link {session.channelPath}, eles
                        aparecerão aqui automaticamente.
                      </p>
                    </td>
                  </tr>
                ) : (
                  listData.items.map((item) => {
                    const isMainSite = item.entrySource === 'site_principal';
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isMainSite
                            ? 'bg-amber-50 hover:bg-amber-100/80'
                            : 'hover:bg-zinc-50'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-zinc-950">{item.candidateName}</p>
                          <p className="font-mono-tabular text-xs text-zinc-500">{item.protocol}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                          {isMainSite ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-amber-900">
                              <Globe className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                              Site principal
                            </span>
                          ) : (
                            <span className="text-zinc-500">Link {session.channelPath}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-800">{item.jobTitle}</td>
                        <td className="py-3.5 px-4 text-zinc-600">
                          {item.candidateCity}/{item.candidateState}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-zinc-600 tabular-nums whitespace-nowrap">
                          <p>{formatDateTimeSaoPaulo(item.createdAt)}</p>
                          {item.submittedIp && (
                            <p className="font-mono-tabular text-[11px] text-zinc-500 mt-0.5">
                              IP: {item.submittedIp}
                            </p>
                          )}
                        </td>
                        <td className={`py-3.5 px-4 text-xs font-bold ${getStatusTextClass(item.status)}`}>
                          {item.status}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetailDrawer(item.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-[#C8102E] rounded-lg cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              Ver ficha
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  id: item.id,
                                  candidateName: item.candidateName,
                                  protocol: item.protocol,
                                })
                              }
                              aria-label={`Excluir ficha de ${item.candidateName}`}
                              title="Excluir formulário preenchido"
                              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação Real */}
          {listData && (
            <div className="px-4 py-3.5 border-t border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600">
              <p className="tabular-nums">
                Exibindo página <strong>{listData.page}</strong> de{' '}
                <strong>{listData.totalPages}</strong> · <strong>{listData.total}</strong>{' '}
                resultado(s) no filtro
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={listData.page <= 1 || loadingList}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold bg-white border border-zinc-300 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={listData.page >= listData.totalPages || loadingList}
                  onClick={() => setPage((p) => Math.min(listData.totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold bg-white border border-zinc-300 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* FICHA LATERAL COMPLETA (DRAWER) */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Ficha completa do candidato"
        >
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl border-l border-zinc-200 flex flex-col">
            <div className="sticky top-0 z-10 bg-zinc-900 text-white px-6 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                {detailData ? (
                  <>
                    <p className="font-mono-tabular text-xs font-bold text-red-400">
                      {detailData.application.protocol} ·{' '}
                      {detailData.application.entrySource === 'site_principal'
                        ? 'Site principal (painel /vagas2)'
                        : `Canal ${detailData.application.channelPath}`}
                    </p>
                    <h2 className="font-display text-xl font-extrabold truncate">
                      {detailData.application.personal.fullName}
                    </h2>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      {detailData.application.jobTitle} · {detailData.application.jobSalaryDisplay}
                    </p>
                  </>
                ) : (
                  <p className="font-display font-bold">Ficha do Candidato</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Fechar ficha lateral"
                className="p-2 text-zinc-300 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {loadingDetail && (
                <p className="text-sm text-zinc-500 py-8 text-center">
                  Carregando dados completos da candidatura...
                </p>
              )}

              {detailError && (
                <div
                  role="alert"
                  className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl"
                >
                  {detailError}
                </div>
              )}

              {detailData && (
                <>
                  {detailData.application.entrySource === 'site_principal' && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-center gap-2.5 text-xs font-semibold text-amber-950">
                      <Globe className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                      <span>
                        Origem: <strong>Site principal</strong> — candidatura preenchida pela
                        página principal e direcionada ao painel /vagas2.
                      </span>
                    </div>
                  )}
                  {/* Contatos rápidos + Excluir */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`mailto:${detailData.application.personal.email}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
                      >
                        <Mail className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
                        E-mail
                      </a>
                      <a
                        href={`https://wa.me/55${(
                          detailData.application.personal.whatsapp ||
                          detailData.application.personal.phone
                        ).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl"
                      >
                        <MessageCircle className="w-4 h-4" aria-hidden="true" />
                        WhatsApp
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          id: detailData.application.id,
                          candidateName: detailData.application.personal.fullName,
                          protocol: detailData.application.protocol,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      Excluir candidatura
                    </button>
                  </div>

                  {/* Alteração de Status e Notas Internas */}
                  <form
                    onSubmit={handleSaveStatusAndNotes}
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4"
                  >
                    <h3 className="font-display text-sm font-bold text-zinc-950">
                      Gerenciar Status e Anotações Internas
                    </h3>

                    {updateFeedback && (
                      <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        {updateFeedback}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Status do processo
                        </label>
                        <select
                          value={nextStatus}
                          onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
                        >
                          {APPLICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Comentário no histórico
                        </label>
                        <input
                          type="text"
                          value={statusComment}
                          onChange={(e) => setStatusComment(e.target.value)}
                          placeholder="Ex.: Contato realizado via WhatsApp"
                          className="w-full px-3 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Notas internas do recrutador
                      </label>
                      <textarea
                        rows={3}
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="Observações privadas sobre entrevistas ou perfil..."
                        className="w-full px-3 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingUpdate}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer disabled:opacity-60"
                    >
                      {savingUpdate ? 'Salvando...' : 'Salvar atualização'}
                    </button>
                  </form>

                  {/* 1. Dados Pessoais e Endereço */}
                  <section className="space-y-2 text-sm">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Dados Pessoais e Contato
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700">
                      <p>
                        <strong>Recebido em:</strong>{' '}
                        {formatDateTimeSaoPaulo(detailData.application.createdAt)}
                      </p>
                      <p>
                        <strong>IP do envio:</strong>{' '}
                        <span className="font-mono-tabular">
                          {detailData.application.submittedIp || 'Não registrado'}
                        </span>
                      </p>
                      <p>
                        <strong>Sexo:</strong>{' '}
                        {detailData.application.personal.gender || 'Não informado'}
                      </p>
                      <p>
                        <strong>Filhos:</strong>{' '}
                        {detailData.application.personal.hasChildren === 'Sim'
                          ? `Sim (${detailData.application.personal.childrenCount || '?'} filho(s))`
                          : detailData.application.personal.hasChildren || 'Não informado'}
                      </p>
                      <p>
                        <strong>E-mail:</strong> {detailData.application.personal.email}
                      </p>
                      <p>
                        <strong>Telefone:</strong> {detailData.application.personal.phone}
                      </p>
                      <p>
                        <strong>WhatsApp:</strong>{' '}
                        {detailData.application.personal.whatsapp || 'Mesmo do celular'}
                      </p>
                      <p>
                        <strong>Cidade/UF:</strong> {detailData.application.personal.city}/
                        {detailData.application.personal.state}
                      </p>
                      <p>
                        <strong>CEP:</strong> {detailData.application.personal.cep || 'Não informado'}
                      </p>
                      {!detailData.application.personal.deferFullAddress && (
                        <p className="sm:col-span-2">
                          <strong>Endereço:</strong> {detailData.application.personal.street},{' '}
                          {detailData.application.personal.number}{' '}
                          {detailData.application.personal.complement} —{' '}
                          {detailData.application.personal.neighborhood}{' '}
                          {detailData.application.personal.reference
                            ? `(Ref.: ${detailData.application.personal.reference})`
                            : ''}
                        </p>
                      )}
                    </div>
                  </section>

                  {/* 2. Escolaridade e Qualificações */}
                  <section className="space-y-2 text-xs text-zinc-700">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Escolaridade e Qualificações
                    </h3>
                    <p>
                      <strong>Escolaridade:</strong>{' '}
                      {detailData.application.education.educationLevel}
                    </p>
                    <p>
                      <strong>Curso profissionalizante:</strong>{' '}
                      {detailData.application.education.hasVocationalCourse}
                      {detailData.application.education.vocationalCourseName
                        ? ` — ${detailData.application.education.vocationalCourseName} (Certificado: ${
                            detailData.application.education.hasCourseCertificate || 'Não informado'
                          })`
                        : ''}
                    </p>
                    <p>
                      <strong>Experiência em transporte/logística:</strong>{' '}
                      {detailData.application.education.hasLogisticsExperience}
                    </p>
                    {detailData.application.education.performedActivitiesText && (
                      <p>
                        <strong>Atividades realizadas:</strong>{' '}
                        {detailData.application.education.performedActivitiesText}
                      </p>
                    )}
                    <p>
                      <strong>Conhecimentos:</strong>{' '}
                      {(detailData.application.education.skills || []).join(', ') || 'Nenhum marcado'}
                    </p>
                  </section>

                  {/* 3. Resumo e Experiências Profissionais */}
                  <section className="space-y-3 text-xs text-zinc-700">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Histórico Profissional ({detailData.experiences.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <p>
                        <strong>Já trabalhou antes:</strong>{' '}
                        {detailData.application.professionalSummary.hasWorkedBefore}
                      </p>
                      <p>
                        <strong>Empregado atualmente:</strong>{' '}
                        {detailData.application.professionalSummary.currentlyEmployed || '—'}
                      </p>
                      <p>
                        <strong>Tempo total em logística:</strong>{' '}
                        {detailData.application.professionalSummary.totalLogisticsExperience || '—'}
                      </p>
                      <p>
                        <strong>Pretensão salarial:</strong>{' '}
                        {detailData.application.professionalSummary.salaryExpectation || 'Não informada'}
                      </p>
                      <p>
                        <strong>Início disponível:</strong>{' '}
                        {detailData.application.professionalSummary.startAvailability}
                      </p>
                    </div>

                    {detailData.experiences.map((exp, idx) => (
                      <div
                        key={exp.id || idx}
                        className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1"
                      >
                        <p className="text-sm font-bold text-zinc-950">
                          {exp.role || 'Cargo não informado'} —{' '}
                          {exp.companyName || 'Empresa não informada'}
                        </p>
                        <p className="text-zinc-600">
                          Área: {exp.area || '—'} ·{' '}
                          {exp.startDate ? (
                            <>
                              Período: {exp.startDate} até{' '}
                              {exp.isCurrent ? 'Atual' : exp.endDate || '—'} ·{' '}
                              <strong>{exp.durationLabel}</strong>
                            </>
                          ) : (
                            <span>Período não informado</span>
                          )}
                        </p>
                        <p>
                          Carteira assinada: {exp.signedCard || '—'} · Último salário:{' '}
                          {exp.lastSalary || 'Não informado'}
                        </p>
                        {exp.benefits && <p>Benefícios: {exp.benefits}</p>}
                        {exp.dailyActivities && <p>Atividades: {exp.dailyActivities}</p>}
                        {exp.responsibilities && <p>Responsabilidades: {exp.responsibilities}</p>}
                        {exp.equipmentUsed && <p>Veículos/Equipamentos: {exp.equipmentUsed}</p>}
                        {exp.leaveReason && <p>Motivo da saída: {exp.leaveReason}</p>}
                        {exp.notes && <p>Observações: {exp.notes}</p>}
                      </div>
                    ))}
                  </section>

                  {/* 4. Disponibilidade Profissional */}
                  <section className="space-y-2 text-xs text-zinc-700">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Disponibilidade Profissional
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <p>Horários diferentes: {detailData.application.availability.flexibleHours}</p>
                      <p>Turnos: {detailData.application.availability.shiftWork}</p>
                      <p>
                        Finais de semana (escala):{' '}
                        {detailData.application.availability.weekendsPerSchedule}
                      </p>
                      <p>Escala da vaga: {detailData.application.availability.jobScheduleFit}</p>
                      <p>Viagens: {detailData.application.availability.travelAvailability}</p>
                      <p>
                        Pernoites fora da cidade:{' '}
                        {detailData.application.availability.overnightStayAvailability}
                      </p>
                      <p>Treinamentos: {detailData.application.availability.trainingAvailability}</p>
                      <p>Início atividades: {detailData.application.availability.startTimeline}</p>
                      <p>
                        Transporte próprio:{' '}
                        {detailData.application.availability.hasOwnTransport || 'Não informado'}
                      </p>
                    </div>
                    {detailData.application.availability.scheduleLimitations && (
                      <p>
                        <strong>Limitações informadas:</strong>{' '}
                        {detailData.application.availability.scheduleLimitations}
                      </p>
                    )}
                  </section>

                  {/* 5. Respostas Específicas da Vaga */}
                  <section className="space-y-2 text-xs text-zinc-700">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Respostas Específicas da Vaga
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(detailData.application.roleSpecific || {}).map(([k, v]) =>
                        v ? (
                          <div
                            key={k}
                            className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg"
                          >
                            <span className="text-zinc-500 block">
                              {ROLE_SPECIFIC_LABELS[k] || k}
                            </span>
                            <span className="font-semibold text-zinc-950">{String(v)}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  </section>

                  {/* 6. Segurança e Acessibilidade + Privacidade */}
                  <section className="space-y-1.5 text-xs text-zinc-700">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Segurança, Acessibilidade e LGPD
                    </h3>
                    <p>
                      Ciência atividades essenciais:{' '}
                      {detailData.application.safetyAndAccessibility.confirmedEssentialTasks
                        ? 'Sim'
                        : 'Não'}
                    </p>
                    <p>
                      Ciência normas de segurança:{' '}
                      {detailData.application.safetyAndAccessibility.awareSafetyAndTraining
                        ? 'Sim'
                        : 'Não'}
                    </p>
                    <p>
                      Adaptação no processo seletivo:{' '}
                      {detailData.application.safetyAndAccessibility.needsProcessAccommodation}
                      {detailData.application.safetyAndAccessibility.accommodationDetails
                        ? ` — ${detailData.application.safetyAndAccessibility.accommodationDetails}`
                        : ''}
                    </p>
                    <p>
                      Ciência LGPD: {detailData.application.lgpdConsent ? 'Confirmada' : 'Não'} ·
                      Banco de talentos:{' '}
                      {detailData.application.talentPoolConsent ? 'Autorizado' : 'Não autorizado'}
                    </p>
                  </section>

                  {/* 7. Anexos Privados */}
                  <section className="space-y-2 text-xs">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Anexos Privados ({detailData.attachments.length})
                    </h3>
                    {detailData.attachments.length === 0 ? (
                      <p className="text-zinc-500">Nenhum anexo enviado pelo candidato.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {detailData.attachments.map((att) => {
                          const isIdentityDoc =
                            detailData.application.identityDocumentIds?.includes(att.fileId);
                          const catLabel = isIdentityDoc
                            ? 'Documento com foto (frente e verso)'
                            : att.category === 'curriculo'
                              ? 'Currículo'
                              : att.category === 'certificado'
                                ? 'Certificado'
                                : att.category === 'curso'
                                  ? 'Curso'
                                  : 'Qualificação';
                          return (
                            <button
                              key={att.fileId}
                              type="button"
                              disabled={downloadingFileId === att.fileId}
                              onClick={() => handleDownloadAttachment(att.fileId, att.originalName)}
                              className="inline-flex items-center gap-2 px-3.5 py-2 font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer disabled:opacity-60"
                            >
                              <Download className="w-3.5 h-3.5 text-[#C8102E]" aria-hidden="true" />
                              <span>
                                {att.originalName} ({catLabel} ·{' '}
                                {Math.max(1, Math.round(att.sizeBytes / 1024))} KB)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* 8. Histórico de Alterações */}
                  <section className="space-y-2 text-xs">
                    <h3 className="font-display text-sm font-bold text-zinc-950 border-b border-zinc-200 pb-1.5">
                      Histórico de Status
                    </h3>
                    <ul className="space-y-2 text-zinc-600">
                      {detailData.history.map((h) => (
                        <li
                          key={h.id}
                          className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg"
                        >
                          <span className="font-mono-tabular text-[11px] text-zinc-500">
                            {formatDateTimeSaoPaulo(h.createdAt)}
                          </span>{' '}
                          · {h.fromStatus ? `${h.fromStatus} → ` : ''}
                          <strong className="text-zinc-950">{h.toStatus}</strong> por{' '}
                          <strong>{h.changedBy}</strong>
                          {h.comment ? <p className="mt-0.5 text-zinc-700">{h.comment}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-[#C8102E] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="delete-dialog-title"
                  className="font-display text-lg font-extrabold text-zinc-950"
                >
                  Excluir candidatura?
                </h2>
                <p id="delete-dialog-desc" className="mt-1 text-sm text-zinc-600 leading-relaxed">
                  Você está prestes a excluir permanentemente a ficha de{' '}
                  <strong className="text-zinc-950">{deleteTarget.candidateName}</strong> (protocolo{' '}
                  <span className="font-mono-tabular">{deleteTarget.protocol}</span>), incluindo
                  experiências e documentos anexados. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingApplication}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingApplication}
                onClick={handleConfirmDelete}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {deletingApplication ? 'Excluindo...' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
