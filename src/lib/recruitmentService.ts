import {
  ApplicationFormState,
  ApplicationStatus,
  ContactMessageInput,
  EntrySource,
  JobPosting,
  UploadedAttachment,
  WorkExperienceInput,
} from '../types/recruitment.ts';
import { ChannelPrefix } from './channelRouting.ts';

export interface AdminUserSession {
  username: string;
  displayName: string;
  tenantId: 1 | 2;
  channelPath: '/vagas1' | '/vagas2';
}

export interface AdminApplicationListItem {
  id: string;
  protocol: string;
  jobId: string;
  jobTitle: string;
  jobSalaryDisplay: string;
  status: ApplicationStatus;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  candidateWhatsapp: string;
  candidateCity: string;
  candidateState: string;
  entrySource: EntrySource;
  submittedIp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminApplicationListResponse {
  items: AdminApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    novas: number;
    emAcompanhamento: number;
    finalizadas: number;
  };
}

export interface AdminApplicationDetailResponse {
  application: {
    id: string;
    protocol: string;
    channelPath: '/vagas1' | '/vagas2';
    entrySource?: EntrySource;
    submittedIp?: string;
    jobId: string;
    jobTitle: string;
    jobRoleType: string;
    jobSalaryDisplay: string;
    status: ApplicationStatus;
    internalNotes: string;
    createdAt: string;
    updatedAt: string;
    personal: ApplicationFormState['personal'];
    education: ApplicationFormState['education'];
    professionalSummary: ApplicationFormState['professionalSummary'];
    availability: ApplicationFormState['availability'];
    roleSpecific: ApplicationFormState['roleSpecific'];
    safetyAndAccessibility: ApplicationFormState['safetyAndAccessibility'];
    identityDocumentIds?: string[];
    lgpdConsent: boolean;
    talentPoolConsent: boolean;
  };
  experiences: WorkExperienceInput[];
  attachments: Array<{
    fileId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    category: UploadedAttachment['category'];
    sha256: string;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    comment: string;
    changedBy: string;
    createdAt: string;
  }>;
}

async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string' && body.error) {
      return body.error;
    }
  } catch {
    // ignore parse error
  }
  return fallback;
}

export async function uploadAttachment(
  file: File,
  category: UploadedAttachment['category'],
  channelPrefix: ChannelPrefix
): Promise<UploadedAttachment> {
  const body = new FormData();
  body.append('file', file);
  body.append('category', category);
  body.append('channel', channelPrefix);

  const res = await fetch('/api/uploads', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-Recruitment-Channel': channelPrefix,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Falha ao enviar arquivo.'));
  }

  const data = await res.json();
  return {
    id: data.fileId,
    fileId: data.fileId,
    originalName: data.originalName,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes,
    category: data.category,
    sha256: data.sha256,
    uploadedAt: data.uploadedAt,
  };
}

export async function submitFullApplication(
  selectedJob: JobPosting,
  form: ApplicationFormState,
  channelPrefix: ChannelPrefix,
  idempotencyKey: string,
  honeypot = '',
  entrySource?: EntrySource
): Promise<{
  applicationId: string;
  protocol: string;
  submittedAt: string;
  candidateName: string;
  jobTitle: string;
  channelPath: ChannelPrefix;
  entrySource: EntrySource;
}> {
  const resolvedSource: EntrySource =
    entrySource || (channelPrefix === '/vagas1' ? 'vagas1' : 'vagas2');
  const res = await fetch('/api/applications', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Recruitment-Channel': channelPrefix,
    },
    body: JSON.stringify({
      honeypot,
      channel: channelPrefix,
      entrySource: resolvedSource,
      idempotencyKey,
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      jobRoleType: selectedJob.roleType,
      jobSalaryDisplay: selectedJob.salaryDisplay,
      personal: form.personal,
      education: form.education,
      professionalSummary: form.professionalSummary,
      experiences: form.experiences,
      availability: form.availability,
      roleSpecific: form.roleSpecific,
      safetyAndAccessibility: form.safetyAndAccessibility,
      attachments: form.attachments.map((a) => ({
        fileId: a.fileId,
        originalName: a.originalName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        category: a.category,
        sha256: a.sha256,
      })),
      identityDocumentIds: form.identityDocumentIds || [],
      lgpdConsent: form.lgpdConsent,
      talentPoolConsent: form.talentPoolConsent,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Não foi possível registrar sua candidatura.'));
  }

  return res.json();
}

export async function submitContactMessage(
  msg: ContactMessageInput,
  channelPrefix: ChannelPrefix | null
): Promise<void> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...msg,
      ...(channelPrefix ? { channel: channelPrefix } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Falha ao enviar mensagem.'));
  }
}

export async function adminLogin(
  username: string,
  password: string
): Promise<AdminUserSession> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Usuário ou senha inválidos.'));
  }

  const data = await res.json();
  return data.user as AdminUserSession;
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function fetchAdminSession(): Promise<AdminUserSession | null> {
  const res = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.user as AdminUserSession) || null;
}

export interface AdminFilterParams {
  search?: string;
  status?: string;
  jobId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

function buildFilterSearchParams(params: AdminFilterParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.search?.trim()) sp.set('search', params.search.trim());
  if (params.status && params.status !== 'all') sp.set('status', params.status);
  if (params.jobId && params.jobId !== 'all') sp.set('jobId', params.jobId);
  if (params.dateFrom) sp.set('dateFrom', params.dateFrom);
  if (params.dateTo) sp.set('dateTo', params.dateTo);
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  return sp;
}

export async function fetchAdminApplications(
  params: AdminFilterParams
): Promise<AdminApplicationListResponse> {
  const sp = buildFilterSearchParams(params);
  const res = await fetch(`/api/admin/applications?${sp.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Erro ao carregar candidaturas.'));
  }
  return res.json();
}

export async function fetchAdminApplicationDetail(
  id: string
): Promise<AdminApplicationDetailResponse> {
  const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Candidatura não encontrada.'));
  }
  return res.json();
}

export async function updateAdminApplication(
  id: string,
  payload: { status: ApplicationStatus; comment: string; internalNotes: string }
): Promise<void> {
  const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Erro ao atualizar status.'));
  }
}

export async function deleteAdminApplication(id: string): Promise<void> {
  const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Erro ao excluir candidatura.'));
  }
}

export async function downloadAdminAttachment(
  fileId: string,
  originalName: string
): Promise<void> {
  const res = await fetch(`/api/admin/attachments/${encodeURIComponent(fileId)}`, {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Não foi possível baixar o anexo.'));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = originalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildAdminExportUrl(
  params: AdminFilterParams,
  scope: 'page' | 'filtered'
): string {
  const sp = buildFilterSearchParams(params);
  sp.set('scope', scope);
  return `/api/admin/export?${sp.toString()}`;
}
