import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { DEFAULT_JOBS, STANDARD_BENEFITS } from '../data/defaultJobs.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  checkIsAdminRecord,
  deleteApplicationLgpdAdmin,
  deleteJobAdmin,
  fetchAdminUsers,
  fetchAllJobsAdmin,
  fetchApplicationDetailsAdmin,
  fetchApplicationsAdmin,
  fetchAuditLogsAdmin,
  fetchContactMessagesAdmin,
  formatTimestampBR,
  recordAuditLog,
  saveCompanySettings,
  saveJobAdmin,
  seedDefaultJobsIfEmpty,
  updateApplicationStatusAdmin,
  upsertAdminUser,
} from '../lib/recruitmentService.ts';
import {
  APPLICATION_STATUSES,
  ApplicationRecord,
  ApplicationStatus,
  AuditLogEntry,
  CompanySettings,
  ContactMessageInput,
  JobPosting,
  JobRoleType,
  JobStatus,
  StatusHistoryEntry,
  UploadedAttachment,
  WorkExperienceInput,
} from '../types/recruitment.ts';

interface AdminDashboardProps {
  companySettings: CompanySettings;
  onSettingsUpdated: (next: CompanySettings) => void;
  onJobsUpdated: () => void;
  onNavigate: (path: string) => void;
}

type AdminTab =
  | 'dashboard'
  | 'candidates'
  | 'jobs'
  | 'messages'
  | 'settings'
  | 'audit';

export function AdminDashboard({
  companySettings,
  onSettingsUpdated,
  onJobsUpdated,
  onNavigate,
}: AdminDashboardProps) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');

  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [loadingData, setLoadingData] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');

  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [messages, setMessages] = useState<Array<ContactMessageInput & { id: string; createdAt?: unknown }>>([]);
  const [adminUsers, setAdminUsers] = useState<
    Array<{ uid: string; email: string; name: string; role: string; active: boolean }>
  >([]);

  // Filtros de candidatos
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJobId, setFilterJobId] = useState('all');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAvailability, setFilterAvailability] = useState('all');
  const [filterSkill, setFilterSkill] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');

  // Modal de detalhes da candidatura
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<{
    experiences: WorkExperienceInput[];
    attachments: UploadedAttachment[];
    history: StatusHistoryEntry[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>('Recebida');
  const [statusComment, setStatusComment] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [confirmDeleteApp, setConfirmDeleteApp] = useState(false);

  // Modal de edição/criação de vaga
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);

  // Form de configurações institucionais
  const [settingsForm, setSettingsForm] = useState<CompanySettings>(companySettings);

  // Form de novo administrador
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'recruiter' | 'super_admin'>('recruiter');

  useEffect(() => {
    setSettingsForm(companySettings);
  }, [companySettings]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthError('');
      if (!user) {
        setIsAuthorized(false);
        setAuthReady(true);
        return;
      }
      const email = (user.email || '').toLowerCase();
      const verified = Boolean(user.emailVerified);
      if (!verified) {
        setIsAuthorized(false);
        setAuthReady(true);
        return;
      }
      if (email === 'rh.jsl.logistica@gmail.com') {
        setIsAuthorized(true);
        setAuthReady(true);
        return;
      }
      const inDb = await checkIsAdminRecord(user.uid);
      setIsAuthorized(inDb);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const loadAllAdminData = useCallback(async () => {
    if (!isAuthorized || !authUser) return;
    setLoadingData(true);
    try {
      const [appsData, jobsData, logsData, msgsData, adminsData] = await Promise.all([
        fetchApplicationsAdmin(),
        fetchAllJobsAdmin(),
        fetchAuditLogsAdmin(),
        fetchContactMessagesAdmin(),
        fetchAdminUsers(),
      ]);
      setApplications(appsData);
      setJobs(jobsData);
      setAuditLogs(logsData);
      setMessages(msgsData);
      setAdminUsers(adminsData);
    } catch (err) {
      console.error('Erro ao carregar painel administrativo:', err);
      setBannerMsg('Falha ao carregar alguns registros do banco de dados.');
    } finally {
      setLoadingData(false);
    }
  }, [isAuthorized, authUser]);

  useEffect(() => {
    if (isAuthorized) {
      loadAllAdminData();
    }
  }, [isAuthorized, loadAllAdminData]);

  const handleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Não foi possível concluir o login com Google.'
      );
    }
  };

  const handleSeedJobs = async () => {
    if (!authUser?.email) return;
    const seeded = await seedDefaultJobsIfEmpty(authUser.email, authUser.uid);
    if (seeded) {
      setBannerMsg('As 5 vagas iniciais foram gravadas no banco de dados para gestão.');
      await loadAllAdminData();
      onJobsUpdated();
    }
  };

  const openCandidateModal = async (app: ApplicationRecord) => {
    setSelectedApp(app);
    setNextStatus(app.status);
    setStatusComment('');
    setInternalNotes(app.internalNotes || '');
    setConfirmDeleteApp(false);
    setLoadingDetails(true);
    try {
      const details = await fetchApplicationDetailsAdmin(app.id);
      setSelectedDetails(details);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateCandidateStatus = async () => {
    if (!selectedApp || !authUser?.email) return;
    await updateApplicationStatusAdmin({
      applicationId: selectedApp.id,
      protocol: selectedApp.protocol,
      fromStatus: selectedApp.status,
      toStatus: nextStatus,
      comment: statusComment,
      internalNotes,
      actorEmail: authUser.email,
      actorUid: authUser.uid,
    });
    setBannerMsg(`Status do protocolo ${selectedApp.protocol} atualizado para "${nextStatus}".`);
    setSelectedApp({ ...selectedApp, status: nextStatus, internalNotes });
    setStatusComment('');
    const details = await fetchApplicationDetailsAdmin(selectedApp.id);
    setSelectedDetails(details);
    await loadAllAdminData();
  };

  const handleDownloadAttachment = async (att: UploadedAttachment) => {
    if (!authUser || !selectedApp) return;
    const idToken = await authUser.getIdToken();
    const res = await fetch(`/api/admin/attachments/${encodeURIComponent(att.fileId)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      setBannerMsg('Falha ao baixar o arquivo privado.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    await recordAuditLog({
      action: 'DOWNLOAD_ATTACHMENT',
      targetType: 'attachment',
      targetId: att.fileId,
      details: `Download do anexo "${att.originalName}" do protocolo ${selectedApp.protocol}.`,
      actorEmail: authUser.email || '',
      actorUid: authUser.uid,
    });
  };

  const handleDeleteCandidateLgpd = async () => {
    if (!selectedApp || !authUser?.email) return;
    const idToken = await authUser.getIdToken();
    await deleteApplicationLgpdAdmin({
      applicationId: selectedApp.id,
      protocol: selectedApp.protocol,
      attachments: selectedDetails?.attachments || [],
      idToken,
      actorEmail: authUser.email,
      actorUid: authUser.uid,
    });
    setSelectedApp(null);
    setSelectedDetails(null);
    setConfirmDeleteApp(false);
    setBannerMsg(`Candidatura ${selectedApp.protocol} excluída definitivamente (LGPD).`);
    await loadAllAdminData();
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (filterJobId !== 'all' && app.jobId !== filterJobId) return false;
      if (filterStatus !== 'all' && app.status !== filterStatus) return false;
      if (
        filterCity.trim() &&
        !app.personal.city.toLowerCase().includes(filterCity.toLowerCase())
      ) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !app.personal.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !app.protocol.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (filterAvailability === 'viagens' && app.availability.travelAvailability !== 'Sim') {
        return false;
      }
      if (
        filterAvailability === 'pernoite' &&
        app.availability.overnightStayAvailability !== 'Sim'
      ) {
        return false;
      }
      if (filterAvailability === 'imediato' && !app.availability.startTimeline.toLowerCase().includes('imed')) {
        return false;
      }
      if (filterSkill !== 'all' && !(app.education.skills || []).includes(filterSkill)) {
        return false;
      }
      if (filterDateFrom && app.createdAt) {
        const d =
          typeof app.createdAt === 'object' &&
          app.createdAt !== null &&
          'toDate' in app.createdAt
            ? (app.createdAt as { toDate: () => Date }).toDate()
            : new Date(String(app.createdAt));
        if (!Number.isNaN(d.getTime()) && d < new Date(`${filterDateFrom}T00:00:00`)) {
          return false;
        }
      }
      return true;
    });
  }, [
    applications,
    filterJobId,
    filterStatus,
    filterCity,
    searchQuery,
    filterAvailability,
    filterSkill,
    filterDateFrom,
  ]);

  const handleExportCsv = async () => {
    if (!authUser?.email) return;
    const headers = [
      'Protocolo',
      'Nome',
      'Email',
      'Telefone',
      'Cidade',
      'UF',
      'Vaga',
      'Status',
      'Escolaridade',
      'Viagens',
      'Pernoite',
      'Inicio',
      'Data Inscricao',
    ];
    const escapeCell = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = filteredApplications.map((a) => [
      a.protocol,
      a.personal.fullName,
      a.personal.email,
      a.personal.phone,
      a.personal.city,
      a.personal.state,
      a.jobTitle,
      a.status,
      a.education.educationLevel,
      a.availability.travelAvailability,
      a.availability.overnightStayAvailability,
      a.availability.startTimeline,
      formatTimestampBR(a.createdAt),
    ]);
    const csvContent =
      '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `candidaturas-jsl-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    await recordAuditLog({
      action: 'EXPORT_CSV',
      targetType: 'applications',
      targetId: 'filtered',
      details: `Exportação CSV de ${filteredApplications.length} candidatura(s).`,
      actorEmail: authUser.email,
      actorUid: authUser.uid,
    });
    await loadAllAdminData();
  };

  const handleExportPdf = async () => {
    if (!authUser?.email) return;
    const docPdf = new jsPDF({ orientation: 'landscape' });
    docPdf.setFontSize(14);
    docPdf.text(`${companySettings.brandName} — Relatório de Candidaturas`, 14, 16);
    docPdf.setFontSize(9);
    docPdf.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} por ${authUser.email} · Total: ${filteredApplications.length} registros`,
      14,
      22
    );

    autoTable(docPdf, {
      startY: 28,
      head: [['Protocolo', 'Candidato', 'Vaga', 'Cidade/UF', 'Telefone', 'Status', 'Data']],
      body: filteredApplications.map((a) => [
        a.protocol,
        a.personal.fullName,
        a.jobTitle,
        `${a.personal.city}/${a.personal.state}`,
        a.personal.phone,
        a.status,
        formatTimestampBR(a.createdAt),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 16, 46] },
    });

    docPdf.save(`relatorio-candidaturas-${new Date().toISOString().slice(0, 10)}.pdf`);
    await recordAuditLog({
      action: 'EXPORT_PDF',
      targetType: 'applications',
      targetId: 'filtered',
      details: `Exportação PDF de ${filteredApplications.length} candidatura(s).`,
      actorEmail: authUser.email,
      actorUid: authUser.uid,
    });
    await loadAllAdminData();
  };

  const handleSaveJobForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingJob || !authUser?.email) return;
    await saveJobAdmin(editingJob, authUser.email, authUser.uid);
    setEditingJob(null);
    setBannerMsg(`Vaga "${editingJob.title}" salva com sucesso.`);
    await loadAllAdminData();
    onJobsUpdated();
  };

  const handleQuickJobStatus = async (job: JobPosting, status: JobStatus) => {
    if (!authUser?.email) return;
    await saveJobAdmin({ ...job, status }, authUser.email, authUser.uid);
    setBannerMsg(`Status da vaga "${job.title}" alterado para "${status}".`);
    await loadAllAdminData();
    onJobsUpdated();
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser?.email) return;
    await saveCompanySettings(settingsForm, authUser.email, authUser.uid);
    onSettingsUpdated(settingsForm);
    setBannerMsg('Dados institucionais e política de retenção atualizados.');
    await loadAllAdminData();
  };

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser?.email) return;
    const idToken = await authUser.getIdToken();
    await upsertAdminUser({
      uid: newAdminUid.trim(),
      email: newAdminEmail.trim().toLowerCase(),
      name: newAdminName.trim(),
      role: newAdminRole,
      active: true,
      actorEmail: authUser.email,
      actorUid: authUser.uid,
      idToken,
    });
    setNewAdminUid('');
    setNewAdminEmail('');
    setNewAdminName('');
    setBannerMsg('Administrador autorizado atualizado.');
    await loadAllAdminData();
  };

  // Métricas do Dashboard
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let todayCount = 0;
    let inAnalysis = 0;
    let interviewing = 0;
    let finished = 0;

    const byJob: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const app of applications) {
      byJob[app.jobTitle] = (byJob[app.jobTitle] || 0) + 1;
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;

      if (app.status === 'Em análise' || app.status === 'Contato realizado') inAnalysis++;
      if (app.status === 'Entrevista agendada' || app.status === 'Entrevista concluída') {
        interviewing++;
      }
      if (app.status === 'Processo finalizado') finished++;

      if (
        app.createdAt &&
        typeof app.createdAt === 'object' &&
        'toDate' in app.createdAt &&
        (app.createdAt as { toDate: () => Date }).toDate().toISOString().slice(0, 10) === todayStr
      ) {
        todayCount++;
      }
    }

    return {
      total: applications.length,
      todayCount,
      inAnalysis,
      interviewing,
      finished,
      byJob: Object.entries(byJob).sort((a, b) => b[1] - a[1]),
      byStatus,
    };
  }, [applications]);

  if (!authReady) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-sm text-zinc-600">
        Verificando autenticação administrativa...
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-[#C8102E] text-white flex items-center justify-center mx-auto font-display font-bold">
            RH
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-zinc-950">
              Painel Administrativo — JSL Empresa
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Acesso restrito a recrutadores e administradores autorizados. Faça login com sua conta
              Google verificada.
            </p>
          </div>
          {authError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {authError}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogin}
            className="w-full py-3.5 px-6 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
          >
            Entrar com Google
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer"
          >
            Voltar para o portal público
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-[#C8102E] mx-auto" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-zinc-950">
            Acesso não autorizado
          </h1>
          <p className="text-sm text-zinc-600">
            A conta <strong>{authUser.email}</strong> (UID:{' '}
            <code className="font-mono-tabular text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
              {authUser.uid}
            </code>
            ) não possui permissão ativa de administração. Solicite ao responsável que habilite seu
            UID na equipe de RH.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 rounded-xl cursor-pointer"
            >
              Sair desta conta
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-5 py-2.5 text-sm font-semibold text-zinc-700 bg-zinc-100 rounded-xl cursor-pointer"
            >
              Portal público
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarItems: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'candidates', label: 'Candidatos', icon: Users },
    { id: 'jobs', label: 'Vagas', icon: Briefcase },
    { id: 'messages', label: 'Mensagens', icon: Mail },
    { id: 'settings', label: 'Empresa e Equipe', icon: Settings },
    { id: 'audit', label: 'Auditoria e Produção', icon: History },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-zinc-50">
      {/* Menu Lateral Administrativo */}
      <aside className="lg:w-64 bg-zinc-900 text-zinc-200 shrink-0 flex flex-col justify-between border-r border-zinc-800">
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Painel Administrativo
          </p>
          <p className="mt-1 font-display text-base font-bold text-white truncate">
            {authUser.email}
          </p>

          <nav aria-label="Menu administrativo" className="mt-6 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#C8102E] text-white'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-zinc-800 hidden lg:block">
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-700 rounded-xl cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Encerrar sessão
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal do Painel */}
      <div className="flex-1 p-4 sm:p-8 max-w-[1300px] w-full space-y-6">
        {bannerMsg && (
          <div className="flex items-center justify-between gap-3 bg-white border border-zinc-300 rounded-xl px-4 py-3 text-sm text-zinc-900">
            <span>{bannerMsg}</span>
            <button
              type="button"
              onClick={() => setBannerMsg('')}
              aria-label="Fechar aviso"
              className="text-zinc-500 hover:text-zinc-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB: DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-zinc-950">
                  Dashboard de Recrutamento
                </h1>
                <p className="text-sm text-zinc-600">
                  Acompanhamento em tempo real das candidaturas registradas no Firestore.
                </p>
              </div>
              {jobs.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedJobs}
                  className="px-4 py-2.5 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer"
                >
                  Inicializar 5 vagas padrão no banco
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-medium text-zinc-500">Total de candidaturas</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-zinc-950 tabular-nums">
                  {metrics.total}
                </p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-medium text-zinc-500">Recebidas hoje</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-[#C8102E] tabular-nums">
                  {metrics.todayCount}
                </p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-medium text-zinc-500">Em análise / contato</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-zinc-950 tabular-nums">
                  {metrics.inAnalysis}
                </p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-medium text-zinc-500">Em fase de entrevista</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-zinc-950 tabular-nums">
                  {metrics.interviewing}
                </p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-medium text-zinc-500">Processos finalizados</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-zinc-950 tabular-nums">
                  {metrics.finished}
                </p>
              </div>
            </div>

            {/* Gráficos simples e funcionais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                <h2 className="font-display text-base font-bold text-zinc-950 mb-4">
                  Candidaturas por vaga
                </h2>
                {metrics.byJob.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Nenhuma candidatura recebida até o momento.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {metrics.byJob.map(([jobTitle, count]) => {
                      const pct = Math.round((count / Math.max(1, metrics.total)) * 100);
                      return (
                        <div key={jobTitle} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium text-zinc-700">
                            <span>{jobTitle}</span>
                            <span className="font-mono-tabular font-bold">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#C8102E]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                <h2 className="font-display text-base font-bold text-zinc-950 mb-4">
                  Funil por etapa do processo
                </h2>
                <div className="space-y-3">
                  {APPLICATION_STATUSES.map((st) => {
                    const count = metrics.byStatus[st] || 0;
                    const pct =
                      metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                    return (
                      <div key={st} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium text-zinc-700">
                          <span>{st}</span>
                          <span className="font-mono-tabular font-bold">{count}</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-800" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CANDIDATOS */}
        {tab === 'candidates' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-zinc-950">
                  Gestão de Candidatos
                </h1>
                <p className="text-sm text-zinc-600 tabular-nums">
                  {filteredApplications.length} candidatura(s) exibida(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-800 bg-white border border-zinc-300 hover:border-zinc-400 rounded-xl cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  Exportar PDF
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nome ou protocolo..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded-xl"
                />
              </div>
              <select
                value={filterJobId}
                onChange={(e) => setFilterJobId(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-zinc-300 rounded-xl"
              >
                <option value="all">Todas as vagas</option>
                {(jobs.length ? jobs : DEFAULT_JOBS).map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                placeholder="Filtrar por cidade..."
                className="px-3 py-2 text-sm border border-zinc-300 rounded-xl"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-zinc-300 rounded-xl"
              >
                <option value="all">Todos os status</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={filterAvailability}
                onChange={(e) => setFilterAvailability(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-zinc-300 rounded-xl"
              >
                <option value="all">Qualquer disponibilidade</option>
                <option value="viagens">Disponível para viagens</option>
                <option value="pernoite">Disponível para pernoite</option>
                <option value="imediato">Início imediato</option>
              </select>
              <select
                value={filterSkill}
                onChange={(e) => setFilterSkill(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-zinc-300 rounded-xl"
              >
                <option value="all">Qualquer qualificação</option>
                <option value="Separação de pedidos">Separação de pedidos</option>
                <option value="Conferência de mercadorias">Conferência de mercadorias</option>
                <option value="Transporte rodoviário">Transporte rodoviário</option>
                <option value="Operação de empilhadeira">Operação de empilhadeira</option>
                <option value="Entregas">Entregas</option>
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                aria-label="Filtrar a partir da data"
                className="px-3 py-2 text-sm border border-zinc-300 rounded-xl"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterJobId('all');
                  setFilterCity('');
                  setFilterStatus('all');
                  setFilterAvailability('all');
                  setFilterSkill('all');
                  setFilterDateFrom('');
                }}
                className="px-3 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>

            {/* Tabela */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-600">
                    <th className="py-3 px-4">Protocolo</th>
                    <th className="py-3 px-4">Candidato</th>
                    <th className="py-3 px-4">Vaga</th>
                    <th className="py-3 px-4">Cidade/UF</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {loadingData ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500">
                        Carregando candidaturas...
                      </td>
                    </tr>
                  ) : filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500">
                        Nenhuma candidatura encontrada para os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-zinc-50">
                        <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#C8102E]">
                          {app.protocol}
                        </td>
                        <td className="py-3 px-4 font-semibold text-zinc-900">
                          {app.personal.fullName}
                        </td>
                        <td className="py-3 px-4 text-zinc-700">{app.jobTitle}</td>
                        <td className="py-3 px-4 text-zinc-600">
                          {app.personal.city}/{app.personal.state}
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-500 tabular-nums">
                          {formatTimestampBR(app.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-zinc-900">
                          {app.status}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openCandidateModal(app)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            Abrir ficha
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: GERENCIAMENTO DE VAGAS */}
        {tab === 'jobs' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-zinc-950">
                  Gerenciamento de Vagas
                </h1>
                <p className="text-sm text-zinc-600">
                  Edite salários, benefícios, requisitos, escalas e controle publicação/encerramento.
                </p>
              </div>
              <div className="flex gap-2">
                {jobs.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedJobs}
                    className="px-4 py-2.5 text-xs font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl cursor-pointer"
                  >
                    Carregar 5 vagas padrão
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setEditingJob({
                      id: `vaga-${Date.now().toString(36)}`,
                      slug: `nova-vaga-${Date.now().toString(36)}`,
                      title: '',
                      roleType: 'outro',
                      department: 'Logística',
                      location: 'Centro de Distribuição',
                      salaryMonthly: 2000,
                      salaryDisplay: 'R$ 2.000,00 mensais',
                      salaryConfirmed: false,
                      collectiveAgreementNote:
                        'Confirmar piso salarial e convenção coletiva antes da publicação.',
                      schedule: 'A definir conforme legislação',
                      contractType: 'CLT — Carteira assinada',
                      experienceRequired: false,
                      experienceNote: 'Conforme condições da vaga.',
                      summary: '',
                      requirements: [],
                      conditions: [],
                      activities: [],
                      benefits: [...STANDARD_BENEFITS],
                      imageUrl: '/src/assets/images/warehouse_parcel_check_1794554551055.jpg',
                      status: 'inactive',
                      sortOrder: jobs.length + 1,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Nova vaga
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display text-lg font-bold text-zinc-950">
                        {job.title}
                      </h2>
                      <span className="text-xs font-semibold text-zinc-500">
                        · Status: {job.status === 'active' ? 'Ativa' : job.status === 'closed' ? 'Encerrada' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#C8102E] tabular-nums">
                      {job.salaryDisplay}{' '}
                      <span className="font-normal text-xs text-zinc-500">
                        ({job.salaryConfirmed ? 'Salário confirmado pelo RH' : 'Aguardando confirmação administrativa'})
                      </span>
                    </p>
                    <p className="text-xs text-zinc-600">{job.schedule}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingJob(job)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      Editar
                    </button>
                    {job.status !== 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleQuickJobStatus(job, 'active')}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                      >
                        Ativar / Reabrir
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickJobStatus(job, 'inactive')}
                          className="px-3.5 py-2 text-xs font-semibold text-zinc-700 border border-zinc-300 rounded-xl cursor-pointer"
                        >
                          Desativar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickJobStatus(job, 'closed')}
                          className="px-3.5 py-2 text-xs font-semibold text-red-700 border border-red-200 rounded-xl cursor-pointer"
                        >
                          Encerrar vaga
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!authUser?.email) return;
                        await deleteJobAdmin(job.id, job.title, authUser.email, authUser.uid);
                        await loadAllAdminData();
                        onJobsUpdated();
                      }}
                      className="p-2 text-zinc-400 hover:text-red-700 cursor-pointer"
                      aria-label={`Excluir vaga ${job.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: MENSAGENS DE CONTATO */}
        {tab === 'messages' && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-extrabold text-zinc-950">
              Mensagens Recebidas
            </h1>
            {messages.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-sm text-zinc-500">
                Nenhuma mensagem enviada pela página de Contato até o momento.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-bold text-zinc-950">{m.subject}</h2>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {formatTimestampBR(m.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600">
                      {m.name} · {m.email} {m.phone ? `· ${m.phone}` : ''}
                    </p>
                    <p className="text-sm text-zinc-800 whitespace-pre-line pt-1">{m.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: CONFIGURAÇÕES INSTITUCIONAIS E EQUIPE */}
        {tab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveSettings}
              className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4"
            >
              <h1 className="font-display text-xl font-extrabold text-zinc-950">
                Dados Institucionais e Privacidade (LGPD)
              </h1>
              <p className="text-xs text-zinc-600">
                Configure os dados reais da empresa controladora antes da veiculação de campanhas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nome de exibição (Marca)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.brandName}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, brandName: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Subtítulo institucional
                  </label>
                  <input
                    type="text"
                    value={settingsForm.brandSubtitle}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, brandSubtitle: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Razão Social do Controlador
                  </label>
                  <input
                    type="text"
                    value={settingsForm.legalName}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, legalName: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={settingsForm.cnpj}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, cnpj: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Retenção LGPD (dias)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={3650}
                    value={settingsForm.retentionDays}
                    onChange={(e) =>
                      setSettingsForm((s) => ({
                        ...s,
                        retentionDays: parseInt(e.target.value || '180', 10),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Endereço completo da empresa
                  </label>
                  <input
                    type="text"
                    value={settingsForm.address}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, address: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    E-mail institucional
                  </label>
                  <input
                    type="email"
                    value={settingsForm.institutionalEmail}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, institutionalEmail: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Telefone institucional
                  </label>
                  <input
                    type="text"
                    value={settingsForm.institutionalPhone}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, institutionalPhone: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nome do Encarregado (DPO)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.dpoName}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, dpoName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    E-mail do DPO (Privacidade)
                  </label>
                  <input
                    type="email"
                    value={settingsForm.dpoEmail}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, dpoEmail: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Aviso institucional de uso da marca
                  </label>
                  <textarea
                    rows={2}
                    value={settingsForm.brandDisclaimer}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, brandDisclaimer: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-6 py-3 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer"
              >
                Salvar configurações
              </button>
            </form>

            <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-zinc-950">
                Administradores Autorizados
              </h2>
              <p className="text-xs text-zinc-600">
                Conceda acesso a outros recrutadores informando o UID do Firebase Auth e e-mail
                Google verificado.
              </p>

              <form onSubmit={handleAddAdmin} className="space-y-3">
                <input
                  type="text"
                  required
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="UID do usuário no Firebase Auth"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                />
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="E-mail Google verificado"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                />
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Nome completo do recrutador"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-xl"
                />
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as 'recruiter' | 'super_admin')}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
                >
                  <option value="recruiter">Recrutador (RH)</option>
                  <option value="super_admin">Super Administrador</option>
                </select>
                <button
                  type="submit"
                  className="w-full py-2.5 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  Autorizar administrador
                </button>
              </form>

              <div className="pt-4 border-t border-zinc-200 space-y-2">
                {adminUsers.map((adm) => (
                  <div
                    key={adm.uid}
                    className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                  >
                    <p className="font-bold text-zinc-900">{adm.name}</p>
                    <p className="text-zinc-600">{adm.email}</p>
                    <p className="text-zinc-500 mt-0.5">
                      Perfil: {adm.role} · {adm.active ? 'Ativo' : 'Inativo'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: AUDITORIA & CHECKLIST DE PRODUÇÃO */}
        {tab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-zinc-950">
                <ClipboardCheck className="w-5 h-5 text-[#C8102E]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold">
                  Checklist Obrigatório Antes de Produção e Meta Ads
                </h2>
              </div>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>
                    <strong>Autorização de marca:</strong> confirmar direito de uso do nome
                    comercial ou ajustar na aba &quot;Empresa e Equipe&quot; para sua razão social.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>
                    <strong>Pisos salariais e convenções coletivas:</strong> validar juridicamente os
                    salários anunciados (especialmente os cargos de R$ 1.800,00 — Auxiliar e
                    Conferente) e marcar confirmação em cada vaga.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>
                    <strong>Dados do Controlador LGPD:</strong> preencher CNPJ, razão social,
                    endereço, telefone e e-mail do DPO reais.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                  <span>
                    <strong>Meta Ads (Categoria Especial de Emprego):</strong> veicular anúncios
                    enquadrados na Categoria Especial de Emprego, sem segmentação discriminatória e
                    sem envio de dados pessoais via Pixel.
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl overflow-x-auto">
              <div className="p-5 border-b border-zinc-200">
                <h2 className="font-display text-lg font-bold text-zinc-950">
                  Registro de Auditoria Administrativa
                </h2>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-600">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-4 text-zinc-500 tabular-nums whitespace-nowrap">
                        {formatTimestampBR(log.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular font-semibold text-zinc-900">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-zinc-700">{log.actorEmail}</td>
                      <td className="py-3 px-4 text-zinc-600">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALHES DO CANDIDATO */}
      {selectedApp && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha do candidato ${selectedApp.personal.fullName}`}
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
              <div>
                <p className="font-mono-tabular text-xs font-bold text-[#C8102E]">
                  {selectedApp.protocol}
                </p>
                <h2 className="font-display text-2xl font-extrabold text-zinc-950">
                  {selectedApp.personal.fullName}
                </h2>
                <p className="text-sm text-zinc-600">
                  Vaga: <strong>{selectedApp.jobTitle}</strong> ({selectedApp.jobSalaryDisplay})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                aria-label="Fechar ficha"
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controle de Status e Comentários Internos */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-zinc-950">
                Movimentação no Processo Seletivo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Status atual
                  </label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
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
                    Comentário da movimentação (histórico)
                  </label>
                  <input
                    type="text"
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    placeholder="Ex.: Entrevista agendada para terça-feira 10h"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Anotações internas restritas ao RH
                  </label>
                  <textarea
                    rows={2}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleUpdateCandidateStatus}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer"
                >
                  Salvar atualização de status
                </button>

                {!confirmDeleteApp ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteApp(true)}
                    className="px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-xl cursor-pointer"
                  >
                    Excluir dados (LGPD)
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-800">Confirmar exclusão definitiva?</span>
                    <button
                      type="button"
                      onClick={handleDeleteCandidateLgpd}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-red-700 rounded-lg cursor-pointer"
                    >
                      Sim, excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteApp(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-200 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Dados Completos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-2">
                <h3 className="font-bold text-zinc-950 border-b border-zinc-200 pb-1">
                  Contato e Localização
                </h3>
                <p>
                  <strong>E-mail:</strong> {selectedApp.personal.email}
                </p>
                <p>
                  <strong>Celular:</strong> {selectedApp.personal.phone}
                </p>
                {selectedApp.personal.whatsapp && (
                  <p>
                    <strong>WhatsApp:</strong> {selectedApp.personal.whatsapp}
                  </p>
                )}
                <p>
                  <strong>Cidade/UF:</strong> {selectedApp.personal.city}/
                  {selectedApp.personal.state}{' '}
                  {selectedApp.personal.cep ? `· CEP ${selectedApp.personal.cep}` : ''}
                </p>
                {!selectedApp.personal.deferFullAddress && (
                  <p className="text-xs text-zinc-600">
                    {selectedApp.personal.street}, {selectedApp.personal.number}{' '}
                    {selectedApp.personal.neighborhood}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-zinc-950 border-b border-zinc-200 pb-1">
                  Escolaridade e Disponibilidade
                </h3>
                <p>
                  <strong>Escolaridade:</strong> {selectedApp.education.educationLevel}
                </p>
                <p>
                  <strong>Curso profissionalizante:</strong>{' '}
                  {selectedApp.education.hasVocationalCourse}{' '}
                  {selectedApp.education.vocationalCourseName
                    ? `(${selectedApp.education.vocationalCourseName})`
                    : ''}
                </p>
                <p>
                  <strong>Conhecimentos:</strong>{' '}
                  {(selectedApp.education.skills || []).join(', ') || 'Não informado'}
                </p>
                <p>
                  <strong>Início:</strong> {selectedApp.availability.startTimeline} ·{' '}
                  <strong>Viagens:</strong> {selectedApp.availability.travelAvailability} ·{' '}
                  <strong>Pernoite:</strong> {selectedApp.availability.overnightStayAvailability}
                </p>
                <p>
                  <strong>Pretensão salarial:</strong>{' '}
                  {selectedApp.professionalSummary.salaryExpectation || 'Não informada'}
                </p>
              </div>
            </div>

            {/* Respostas Específicas da Vaga */}
            <div className="space-y-2 text-sm">
              <h3 className="font-bold text-zinc-950 border-b border-zinc-200 pb-1">
                Respostas Específicas da Vaga
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(selectedApp.roleSpecific || {}).map(([k, v]) =>
                  v ? (
                    <div key={k} className="bg-zinc-50 border border-zinc-200 rounded-lg p-2.5">
                      <span className="font-semibold text-zinc-500 block">{k}</span>
                      <span className="text-zinc-900 font-medium">{String(v)}</span>
                    </div>
                  ) : null
                )}
              </div>
              {selectedApp.safetyAndAccessibility?.needsProcessAccommodation === 'Sim' && (
                <p className="text-xs text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                  <strong>Adaptação solicitada para seleção:</strong>{' '}
                  {selectedApp.safetyAndAccessibility.accommodationDetails}
                </p>
              )}
            </div>

            {/* Experiências e Anexos */}
            {loadingDetails ? (
              <p className="text-sm text-zinc-500">Carregando histórico e anexos...</p>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h3 className="font-bold text-zinc-950 border-b border-zinc-200 pb-1 text-sm">
                    Experiências Profissionais ({selectedDetails?.experiences.length || 0})
                  </h3>
                  {selectedDetails?.experiences.length ? (
                    <div className="space-y-3">
                      {selectedDetails.experiences.map((exp) => (
                        <div
                          key={exp.id}
                          className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-1"
                        >
                          <p className="text-sm font-bold text-zinc-950">
                            {exp.role} — {exp.companyName}
                          </p>
                          <p className="text-zinc-600">
                            Período: {exp.startDate} até{' '}
                            {exp.isCurrent ? 'Atual' : exp.endDate} ·{' '}
                            <strong>{exp.durationLabel}</strong>
                          </p>
                          {exp.lastSalary && (
                            <p className="text-zinc-700">
                              <strong>Último salário informado:</strong> {exp.lastSalary}
                            </p>
                          )}
                          {exp.dailyActivities && (
                            <p className="text-zinc-700">
                              <strong>Atividades:</strong> {exp.dailyActivities}
                            </p>
                          )}
                          {exp.equipmentUsed && (
                            <p className="text-zinc-700">
                              <strong>Veículos/Equipamentos:</strong> {exp.equipmentUsed}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Sem experiências cadastradas.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-zinc-950 border-b border-zinc-200 pb-1 text-sm">
                    Anexos Privados ({selectedDetails?.attachments.length || 0})
                  </h3>
                  {selectedDetails?.attachments.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedDetails.attachments.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => handleDownloadAttachment(att)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#C8102E]" aria-hidden="true" />
                          {att.originalName} ({att.category})
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Nenhum anexo enviado.</p>
                  )}
                </div>

                {selectedDetails?.history && selectedDetails.history.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-zinc-950 border-b border-zinc-200 pb-1 text-sm">
                      Histórico de Alterações
                    </h3>
                    <ul className="space-y-1.5 text-xs text-zinc-600">
                      {selectedDetails.history.map((h) => (
                        <li key={h.id}>
                          <strong>{formatTimestampBR(h.createdAt)}</strong> · {h.fromStatus} →{' '}
                          <strong>{h.toStatus}</strong> ({h.changedByEmail}): {h.comment}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO / CRIAÇÃO DE VAGA */}
      {editingJob && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Editar vaga"
        >
          <form
            onSubmit={handleSaveJobForm}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 className="font-display text-xl font-bold text-zinc-950">
                Configurar Vaga
              </h2>
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Título da vaga
                </label>
                <input
                  type="text"
                  required
                  value={editingJob.title}
                  onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Tipo de questionário específico
                </label>
                <select
                  value={editingJob.roleType}
                  onChange={(e) =>
                    setEditingJob({ ...editingJob, roleType: e.target.value as JobRoleType })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl"
                >
                  <option value="motorista_caminhao">Motorista de Caminhão</option>
                  <option value="motorista_fiorino">Motorista de Fiorino</option>
                  <option value="operador_empilhadeira">Operador de Empilhadeira</option>
                  <option value="auxiliar_logistica">Auxiliar de Logística</option>
                  <option value="conferente_pacotes">Conferente de Pacotes</option>
                  <option value="outro">Outro cargo operacional</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Salário mensal (número)
                </label>
                <input
                  type="number"
                  required
                  value={editingJob.salaryMonthly}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value || '0');
                    setEditingJob({
                      ...editingJob,
                      salaryMonthly: num,
                      salaryDisplay: `${num.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })} mensais`,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Texto de exibição do salário
                </label>
                <input
                  type="text"
                  required
                  value={editingJob.salaryDisplay}
                  onChange={(e) =>
                    setEditingJob({ ...editingJob, salaryDisplay: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingJob.salaryConfirmed}
                    onChange={(e) =>
                      setEditingJob({ ...editingJob, salaryConfirmed: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#C8102E]"
                  />
                  Salário e piso da convenção coletiva conferidos e confirmados pelo RH
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Escala / Jornada
                </label>
                <input
                  type="text"
                  value={editingJob.schedule}
                  onChange={(e) => setEditingJob({ ...editingJob, schedule: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Resumo da vaga
                </label>
                <textarea
                  rows={2}
                  value={editingJob.summary}
                  onChange={(e) => setEditingJob({ ...editingJob, summary: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Requisitos (um por linha)
                </label>
                <textarea
                  rows={3}
                  value={editingJob.requirements.join('\n')}
                  onChange={(e) =>
                    setEditingJob({
                      ...editingJob,
                      requirements: e.target.value.split('\n').filter((x) => x.trim()),
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Benefícios (um por linha)
                </label>
                <textarea
                  rows={3}
                  value={editingJob.benefits.join('\n')}
                  onChange={(e) =>
                    setEditingJob({
                      ...editingJob,
                      benefits: e.target.value.split('\n').filter((x) => x.trim()),
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Status de publicação
                </label>
                <select
                  value={editingJob.status}
                  onChange={(e) =>
                    setEditingJob({ ...editingJob, status: e.target.value as JobStatus })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl"
                >
                  <option value="active">Ativa (visível no portal)</option>
                  <option value="inactive">Inativa (rascunho)</option>
                  <option value="closed">Encerrada</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="px-5 py-2.5 text-sm font-semibold text-zinc-700 bg-zinc-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer"
              >
                Salvar vaga
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
