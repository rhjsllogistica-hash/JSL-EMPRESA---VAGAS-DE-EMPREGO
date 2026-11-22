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

export async function fetchMyApplicationStatus(channelPrefix: ChannelPrefix | null): Promise<{
  submitted: boolean;
  receipt?: {
    applicationId: string;
    protocol: string;
    submittedAt: string;
    candidateName: string;
    jobTitle: string;
    status?: string;
  };
}> {
  const effectiveChannel: ChannelPrefix = channelPrefix ?? '/vagas2';
  const res = await fetch(
    `/api/applications/status?channel=${encodeURIComponent(effectiveChannel)}`,
    {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    return { submitted: false };
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

export interface PublicAppRelease {
  id: string;
  version: string;
  fileName: string;
  sizeBytes: number;
  releaseNotes: string;
  sha256: string;
  downloadCount: number;
  publishedAt: string;
  downloadUrl: string;
}

export interface PublicAppReleaseResponse {
  available: boolean;
  release?: PublicAppRelease;
}

export interface AdminAppReleaseItem {
  id: string;
  version: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  releaseNotes: string;
  status: 'active' | 'archived';
  downloadCount: number;
  uploadedBy: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface AdminAppReleaseListResponse {
  active: AdminAppReleaseItem | null;
  history: AdminAppReleaseItem[];
}

export interface ApkUploadProgress {
  phase: 'hashing' | 'uploading' | 'committing';
  currentChunk: number;
  totalChunks: number;
  percent: number;
}

export async function fetchPublicAppRelease(): Promise<PublicAppReleaseResponse> {
  const res = await fetch('/api/app-release', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!res.ok) {
    return { available: false };
  }
  return res.json();
}

export async function fetchAdminAppReleases(): Promise<AdminAppReleaseListResponse> {
  const res = await fetch('/api/admin/app-release', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Erro ao carregar versões do aplicativo.'));
  }
  return res.json();
}

export async function deleteAdminAppRelease(releaseId: string): Promise<void> {
  const res = await fetch(`/api/admin/app-release/${encodeURIComponent(releaseId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, 'Erro ao excluir versão do aplicativo.'));
  }
}

const APK_UPLOAD_CHUNK_BYTES = 384 * 1024; // 384 KB por bloco (~512 KB base64)

async function computeFileSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export async function uploadAndPublishApk(params: {
  file: File;
  version: string;
  releaseNotes?: string;
  onProgress?: (progress: ApkUploadProgress) => void;
}): Promise<AdminAppReleaseItem> {
  const { file, version, releaseNotes = '', onProgress } = params;

  if (!file.name.toLowerCase().endsWith('.apk')) {
    throw new Error('Selecione um arquivo válido com extensão .apk.');
  }
  if (file.size <= 0) {
    throw new Error('O arquivo selecionado está vazio.');
  }
  if (file.size > 80 * 1024 * 1024) {
    throw new Error('O arquivo APK excede o limite máximo de 80 MB.');
  }

  const totalChunks = Math.max(1, Math.ceil(file.size / APK_UPLOAD_CHUNK_BYTES));
  onProgress?.({ phase: 'hashing', currentChunk: 0, totalChunks, percent: 2 });

  const fullBuffer = await file.arrayBuffer();
  const header = new Uint8Array(fullBuffer.slice(0, 4));
  if (
    header.length < 4 ||
    header[0] !== 0x50 ||
    header[1] !== 0x4b ||
    header[2] !== 0x03 ||
    header[3] !== 0x04
  ) {
    throw new Error('Arquivo inválido. O arquivo selecionado não possui assinatura Android (.apk).');
  }

  const sha256 = await computeFileSha256Hex(fullBuffer);

  const initRes = await fetch('/api/admin/app-release/init', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      version: version.trim(),
      releaseNotes: releaseNotes.trim(),
      totalChunks,
      sha256,
    }),
  });

  if (!initRes.ok) {
    throw new Error(await parseErrorResponse(initRes, 'Não foi possível iniciar o envio do APK.'));
  }

  const { releaseId } = (await initRes.json()) as { releaseId: string };

  for (let i = 0; i < totalChunks; i++) {
    const start = i * APK_UPLOAD_CHUNK_BYTES;
    const end = Math.min(file.size, start + APK_UPLOAD_CHUNK_BYTES);
    const slice = fullBuffer.slice(start, end);

    const chunkRes = await fetch(
      `/api/admin/app-release/chunk?releaseId=${encodeURIComponent(releaseId)}&index=${i}`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: slice,
      }
    );

    if (!chunkRes.ok) {
      throw new Error(
        await parseErrorResponse(
          chunkRes,
          `Falha ao enviar a parte ${i + 1} de ${totalChunks} do APK.`
        )
      );
    }

    const percent = Math.min(95, Math.round(((i + 1) / totalChunks) * 90) + 5);
    onProgress?.({ phase: 'uploading', currentChunk: i + 1, totalChunks, percent });
  }

  onProgress?.({ phase: 'committing', currentChunk: totalChunks, totalChunks, percent: 97 });

  const commitRes = await fetch('/api/admin/app-release/commit', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ releaseId }),
  });

  if (!commitRes.ok) {
    throw new Error(
      await parseErrorResponse(commitRes, 'Falha ao publicar a nova versão do aplicativo.')
    );
  }

  const data = (await commitRes.json()) as { release: AdminAppReleaseItem };
  onProgress?.({ phase: 'committing', currentChunk: totalChunks, totalChunks, percent: 100 });
  return data.release;
}

