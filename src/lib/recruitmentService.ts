import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_COMPANY_SETTINGS, DEFAULT_JOBS } from '../data/defaultJobs.ts';
import { db } from './firebase.ts';
import { handleFirestoreError, OperationType } from './firestore-errors.ts';
import {
  ApplicationFormState,
  ApplicationRecord,
  ApplicationStatus,
  AuditLogEntry,
  CompanySettings,
  ContactMessageInput,
  JobPosting,
  StatusHistoryEntry,
  UploadedAttachment,
  WorkExperienceInput,
} from '../types/recruitment.ts';

function sanitizeId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${prefix}_${rand}`;
}

export async function fetchPublicJobs(): Promise<{ jobs: JobPosting[]; fromDatabase: boolean }> {
  try {
    const q = query(collection(db, 'jobs'), where('status', '==', 'active'));
    const snap = await getDocs(q);
    if (snap.empty) {
      return { jobs: DEFAULT_JOBS, fromDatabase: false };
    }
    const jobs = snap.docs
      .map((d) => d.data() as JobPosting)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    return { jobs, fromDatabase: true };
  } catch (err) {
    console.warn('Carregando catálogo inicial de vagas:', err);
    return { jobs: DEFAULT_JOBS, fromDatabase: false };
  }
}

export async function fetchAllJobsAdmin(): Promise<JobPosting[]> {
  try {
    const snap = await getDocs(collection(db, 'jobs'));
    return snap.docs
      .map((d) => d.data() as JobPosting)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'jobs');
  }
}

export async function seedDefaultJobsIfEmpty(actorEmail: string, actorUid: string): Promise<boolean> {
  const existing = await getDocs(collection(db, 'jobs'));
  if (!existing.empty) return false;

  const batch = writeBatch(db);
  for (const job of DEFAULT_JOBS) {
    batch.set(doc(db, 'jobs', job.id), {
      ...job,
      updatedAt: serverTimestamp(),
    });
  }
  const logId = sanitizeId('log');
  batch.set(doc(db, 'auditLogs', logId), {
    action: 'SEED_DEFAULT_JOBS',
    targetType: 'jobs',
    targetId: 'all',
    details: 'Inicialização das 5 vagas padrão no banco de dados.',
    actorEmail,
    actorUid,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return true;
}

export async function saveJobAdmin(
  job: JobPosting,
  actorEmail: string,
  actorUid: string
): Promise<void> {
  const path = `jobs/${job.id}`;
  try {
    await setDoc(doc(db, 'jobs', job.id), {
      ...job,
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      action: 'SAVE_JOB',
      targetType: 'job',
      targetId: job.id,
      details: `Vaga "${job.title}" salva (status: ${job.status}, salário: ${job.salaryDisplay}, confirmada: ${job.salaryConfirmed ? 'Sim' : 'Pendente'}).`,
      actorEmail,
      actorUid,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchCompanySettings(): Promise<CompanySettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'company'));
    if (!snap.exists()) return DEFAULT_COMPANY_SETTINGS;
    return snap.data() as CompanySettings;
  } catch {
    return DEFAULT_COMPANY_SETTINGS;
  }
}

export async function saveCompanySettings(
  settings: CompanySettings,
  actorEmail: string,
  actorUid: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'company'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      action: 'UPDATE_COMPANY_SETTINGS',
      targetType: 'settings',
      targetId: 'company',
      details: 'Dados institucionais e informações de privacidade atualizados.',
      actorEmail,
      actorUid,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/company');
  }
}

export async function submitFullApplication(
  selectedJob: JobPosting,
  form: ApplicationFormState,
  honeypot = ''
): Promise<{
  applicationId: string;
  protocol: string;
  submittedAt: string;
  candidateName: string;
  jobTitle: string;
}> {
  // 1. Validação rigorosa no servidor + recálculo de tempo trabalhado + geração de protocolo único
  const prepareRes = await fetch('/api/applications/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      honeypot,
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
      lgpdConsent: form.lgpdConsent,
      talentPoolConsent: form.talentPoolConsent,
    }),
  });

  if (!prepareRes.ok) {
    const body = await prepareRes.json().catch(() => ({}));
    throw new Error(body.error || 'Falha na validação dos dados da candidatura.');
  }

  const prepared: {
    protocol: string;
    normalizedExperiences: WorkExperienceInput[];
    validatedAt: string;
  } = await prepareRes.json();

  // 2. Persistência atômica no Firestore (candidatura + experiências + metadados dos anexos)
  const applicationId = sanitizeId('cand');
  const batch = writeBatch(db);
  const appRef = doc(db, 'applications', applicationId);

  batch.set(appRef, {
    protocol: prepared.protocol,
    jobId: selectedJob.id,
    jobTitle: selectedJob.title,
    jobRoleType: selectedJob.roleType,
    jobSalaryDisplay: selectedJob.salaryDisplay,
    status: 'Recebida',
    personal: form.personal,
    education: form.education,
    professionalSummary: form.professionalSummary,
    availability: form.availability,
    roleSpecific: form.roleSpecific,
    safetyAndAccessibility: form.safetyAndAccessibility,
    lgpdConsent: true,
    talentPoolConsent: Boolean(form.talentPoolConsent),
    experienceCount: prepared.normalizedExperiences.length,
    attachmentCount: form.attachments.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const exp of prepared.normalizedExperiences) {
    const expId = sanitizeId('exp');
    const expRef = doc(db, 'applications', applicationId, 'experiences', expId);
    batch.set(expRef, {
      companyName: exp.companyName,
      role: exp.role,
      area: exp.area || '',
      startDate: exp.startDate,
      endDate: exp.endDate || '',
      isCurrent: Boolean(exp.isCurrent),
      signedCard: exp.signedCard || '',
      lastSalary: exp.lastSalary || '',
      benefits: exp.benefits || '',
      dailyActivities: exp.dailyActivities || '',
      responsibilities: exp.responsibilities || '',
      equipmentUsed: exp.equipmentUsed || '',
      leaveReason: exp.leaveReason || '',
      notes: exp.notes || '',
      calculatedYears: exp.calculatedYears,
      calculatedMonths: exp.calculatedMonths,
      durationLabel: exp.durationLabel,
      createdAt: serverTimestamp(),
    });
  }

  for (const att of form.attachments) {
    const attId = sanitizeId('att');
    const attRef = doc(db, 'applications', applicationId, 'attachments', attId);
    batch.set(attRef, {
      fileId: att.fileId,
      originalName: att.originalName,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      category: att.category,
      sha256: att.sha256,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `applications/${applicationId}`);
  }

  return {
    applicationId,
    protocol: prepared.protocol,
    submittedAt: prepared.validatedAt,
    candidateName: form.personal.fullName,
    jobTitle: selectedJob.title,
  };
}

export async function fetchApplicationsAdmin(): Promise<ApplicationRecord[]> {
  try {
    const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ApplicationRecord, 'id'>),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'applications');
  }
}

export async function fetchApplicationDetailsAdmin(applicationId: string): Promise<{
  experiences: WorkExperienceInput[];
  attachments: UploadedAttachment[];
  history: StatusHistoryEntry[];
}> {
  try {
    const [expSnap, attSnap, histSnap] = await Promise.all([
      getDocs(collection(db, 'applications', applicationId, 'experiences')),
      getDocs(collection(db, 'applications', applicationId, 'attachments')),
      getDocs(
        query(
          collection(db, 'applications', applicationId, 'statusHistory'),
          orderBy('createdAt', 'desc')
        )
      ),
    ]);

    return {
      experiences: expSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WorkExperienceInput, 'id'>),
      })),
      attachments: attSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UploadedAttachment, 'id'>),
      })),
      history: histSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StatusHistoryEntry, 'id'>),
      })),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `applications/${applicationId}`);
  }
}

export async function updateApplicationStatusAdmin(params: {
  applicationId: string;
  protocol: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  comment: string;
  internalNotes: string;
  actorEmail: string;
  actorUid: string;
}): Promise<void> {
  const appRef = doc(db, 'applications', params.applicationId);
  const histId = sanitizeId('hist');
  const histRef = doc(db, 'applications', params.applicationId, 'statusHistory', histId);

  try {
    const batch = writeBatch(db);
    batch.update(appRef, {
      status: params.toStatus,
      internalNotes: params.internalNotes,
      updatedAt: serverTimestamp(),
    });
    batch.set(histRef, {
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      comment: params.comment || 'Atualização de status no painel administrativo.',
      changedByEmail: params.actorEmail,
      changedByUid: params.actorUid,
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    await recordAuditLog({
      action: 'UPDATE_APPLICATION_STATUS',
      targetType: 'application',
      targetId: params.applicationId,
      details: `Protocolo ${params.protocol}: ${params.fromStatus} -> ${params.toStatus}.`,
      actorEmail: params.actorEmail,
      actorUid: params.actorUid,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `applications/${params.applicationId}`);
  }
}

export async function deleteApplicationLgpdAdmin(params: {
  applicationId: string;
  protocol: string;
  attachments: UploadedAttachment[];
  idToken: string;
  actorEmail: string;
  actorUid: string;
}): Promise<void> {
  try {
    for (const att of params.attachments) {
      await fetch(`/api/admin/attachments/${encodeURIComponent(att.fileId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${params.idToken}` },
      });
    }

    const [expSnap, attSnap] = await Promise.all([
      getDocs(collection(db, 'applications', params.applicationId, 'experiences')),
      getDocs(collection(db, 'applications', params.applicationId, 'attachments')),
    ]);

    const batch = writeBatch(db);
    expSnap.docs.forEach((d) => batch.delete(d.ref));
    attSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'applications', params.applicationId));
    await batch.commit();

    await recordAuditLog({
      action: 'LGPD_ERASURE_APPLICATION',
      targetType: 'application',
      targetId: params.applicationId,
      details: `Exclusão definitiva dos dados da candidatura protocolo ${params.protocol} (LGPD).`,
      actorEmail: params.actorEmail,
      actorUid: params.actorUid,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `applications/${params.applicationId}`);
  }
}

export async function recordAuditLog(params: {
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  actorEmail: string;
  actorUid: string;
}): Promise<void> {
  const logId = sanitizeId('log');
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      ...params,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Erro ao registrar log de auditoria:', err);
  }
}

export async function fetchAuditLogsAdmin(): Promise<AuditLogEntry[]> {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.slice(0, 100).map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AuditLogEntry, 'id'>),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'auditLogs');
  }
}

export async function submitContactMessage(msg: ContactMessageInput): Promise<void> {
  const id = sanitizeId('msg');
  try {
    await setDoc(doc(db, 'contactMessages', id), {
      ...msg,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `contactMessages/${id}`);
  }
}

export async function fetchContactMessagesAdmin(): Promise<
  Array<ContactMessageInput & { id: string; createdAt?: unknown }>
> {
  try {
    const q = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as ContactMessageInput & { createdAt?: unknown }),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'contactMessages');
  }
}

export async function checkIsAdminRecord(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists() && snap.data()?.active === true;
  } catch {
    return false;
  }
}

export async function fetchAdminUsers(): Promise<
  Array<{ uid: string; email: string; name: string; role: string; active: boolean }>
> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => d.data() as {
      uid: string;
      email: string;
      name: string;
      role: string;
      active: boolean;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admins');
  }
}

export async function upsertAdminUser(params: {
  uid: string;
  email: string;
  name: string;
  role: 'super_admin' | 'recruiter';
  active: boolean;
  actorEmail: string;
  actorUid: string;
  idToken: string;
}): Promise<void> {
  try {
    const existing = await getDoc(doc(db, 'admins', params.uid));
    if (existing.exists()) {
      await updateDoc(doc(db, 'admins', params.uid), {
        email: params.email,
        name: params.name,
        role: params.role,
        active: params.active,
      });
    } else {
      await setDoc(doc(db, 'admins', params.uid), {
        uid: params.uid,
        email: params.email,
        name: params.name,
        role: params.role,
        active: params.active,
        createdAt: serverTimestamp(),
      });
    }

    await fetch('/api/admin/allowlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.idToken}`,
      },
      body: JSON.stringify({ email: params.email }),
    });

    await recordAuditLog({
      action: 'MANAGE_ADMIN_USER',
      targetType: 'admin',
      targetId: params.uid,
      details: `Administrador ${params.email} (${params.role}, ativo: ${params.active}).`,
      actorEmail: params.actorEmail,
      actorUid: params.actorUid,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${params.uid}`);
  }
}

export async function deleteJobAdmin(
  jobId: string,
  title: string,
  actorEmail: string,
  actorUid: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'jobs', jobId));
    await recordAuditLog({
      action: 'DELETE_JOB',
      targetType: 'job',
      targetId: jobId,
      details: `Vaga "${title}" removida pelo administrador.`,
      actorEmail,
      actorUid,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `jobs/${jobId}`);
  }
}

export function formatTimestampBR(ts: unknown): string {
  if (!ts) return '—';
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? ts : d.toLocaleString('pt-BR');
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString('pt-BR');
  }
  return '—';
}
