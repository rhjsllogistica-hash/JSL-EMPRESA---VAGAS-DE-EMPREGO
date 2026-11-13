export type JobRoleType =
  | 'motorista_caminhao'
  | 'motorista_fiorino'
  | 'operador_empilhadeira'
  | 'auxiliar_logistica'
  | 'conferente_pacotes'
  | 'outro';

export type JobStatus = 'active' | 'inactive' | 'closed';

export type ApplicationStatus =
  | 'Recebida'
  | 'Em análise'
  | 'Contato realizado'
  | 'Entrevista agendada'
  | 'Entrevista concluída'
  | 'Aguardando documentação'
  | 'Processo finalizado';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Recebida',
  'Em análise',
  'Contato realizado',
  'Entrevista agendada',
  'Entrevista concluída',
  'Aguardando documentação',
  'Processo finalizado',
];

export interface JobPosting {
  id: string;
  slug: string;
  title: string;
  roleType: JobRoleType;
  department: string;
  location: string;
  salaryMonthly: number;
  salaryDisplay: string;
  salaryConfirmed: boolean;
  collectiveAgreementNote: string;
  schedule: string;
  contractType: string;
  experienceRequired: boolean;
  experienceNote: string;
  summary: string;
  requirements: string[];
  conditions: string[];
  activities: string[];
  benefits: string[];
  imageUrl: string;
  status: JobStatus;
  sortOrder: number;
  updatedAt?: unknown;
}

export interface PersonalContactData {
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  complement: string;
  reference: string;
  deferFullAddress: boolean;
}

export interface EducationQualificationsData {
  educationLevel: string;
  hasVocationalCourse: 'Sim' | 'Não' | '';
  vocationalCourseName: string;
  hasCourseCertificate: 'Sim' | 'Não' | 'Em andamento' | '';
  hasLogisticsExperience: 'Sim' | 'Não' | '';
  performedActivitiesText: string;
  skills: string[];
}

export interface WorkExperienceInput {
  id: string;
  companyName: string;
  role: string;
  area: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or ''
  isCurrent: boolean;
  signedCard: 'Sim' | 'Não' | '';
  lastSalary: string;
  benefits: string;
  dailyActivities: string;
  responsibilities: string;
  equipmentUsed: string;
  leaveReason: string;
  notes: string;
  calculatedYears: number;
  calculatedMonths: number;
  durationLabel: string;
}

export interface ProfessionalSummaryData {
  hasWorkedBefore: 'Sim' | 'Não, estou buscando meu primeiro emprego' | '';
  currentlyEmployed: 'Sim' | 'Não' | '';
  totalLogisticsExperience: string;
  salaryExpectation: string;
  startAvailability: string;
}

export interface AvailabilityData {
  flexibleHours: 'Sim' | 'Não' | 'A combinar' | '';
  shiftWork: 'Sim' | 'Não' | 'A combinar' | '';
  weekendsPerSchedule: 'Sim' | 'Não' | 'A combinar' | '';
  jobScheduleFit: 'Sim' | 'Não' | 'A combinar' | '';
  travelAvailability: 'Sim' | 'Não' | 'A combinar' | '';
  overnightStayAvailability: 'Sim' | 'Não' | 'A combinar' | '';
  trainingAvailability: 'Sim' | 'Não' | 'A combinar' | '';
  startTimeline: string;
  hasOwnTransport: 'Sim' | 'Não' | 'Prefiro não informar' | '';
  scheduleLimitations: string;
}

export interface RoleSpecificAnswers {
  // Motorista de Caminhão
  cnhCategory?: 'C' | 'E' | '';
  hasValidCnh?: 'Sim' | 'Não' | '';
  truckExperience?: 'Sim' | 'Não' | '';
  truckExperienceDuration?: string;
  truckTypesDriven?: string;
  intercityInterstateTravel?: 'Sim' | 'Não' | '';
  truckTravelAvailability?: 'Sim' | 'Não' | 'A combinar' | '';
  truckOvernightAvailability?: 'Sim' | 'Não' | 'A combinar' | '';
  truckFlexibleHours?: 'Sim' | 'Não' | 'A combinar' | '';
  transportCourses?: string;

  // Motorista de Fiorino
  hasValidCnhBPlus?: 'Sim' | 'Não' | '';
  utilityVehicleExperience?: 'Sim' | 'Não' | '';
  deliveryExperience?: 'Sim' | 'Não' | '';
  routeExperience?: 'Sim' | 'Não' | '';
  fiorinoTravelAvailability?: 'Sim' | 'Não' | 'A combinar' | '';
  fiorinoOvernightAvailability?: 'Sim' | 'Não' | 'A combinar' | '';
  fiorinoHoursAvailability?: 'Sim' | 'Não' | 'A combinar' | '';

  // Operador de Empilhadeira
  forkliftTraining?: 'Sim' | 'Não' | '';
  forkliftCertificate?: 'Sim' | 'Não' | '';
  forkliftEquipmentTypes?: string;
  forkliftWorkExperience?: 'Sim' | 'Não' | '';
  forkliftExperienceDuration?: string;
  forkliftUpdatedLegalTraining?: 'Sim' | 'Não' | 'Em renovação' | '';

  // Auxiliar de Logística
  orderPickingExp?: 'Sim' | 'Não' | '';
  stockOrganizationExp?: 'Sim' | 'Não' | '';
  warehouseExp?: 'Sim' | 'Não' | '';
  auxSchedule6x1?: 'Sim' | 'Não' | 'A combinar' | '';
  manualHandlingSafeLimits?: 'Sim' | 'Não' | 'Com orientação/adaptação' | '';

  // Conferente de Pacotes
  productInspectionExp?: 'Sim' | 'Não' | '';
  parcelIdentificationExp?: 'Sim' | 'Não' | '';
  barcodeScannerExp?: 'Sim' | 'Não' | '';
  inventoryControlExp?: 'Sim' | 'Não' | '';
  conferenteSchedule6x1?: 'Sim' | 'Não' | 'A combinar' | '';
  operationalTasksFit?: 'Sim' | 'Não' | 'A combinar' | '';
}

export interface SafetyAndAccessibilityData {
  confirmedEssentialTasks: boolean;
  awareSafetyAndTraining: boolean;
  needsProcessAccommodation: 'Não' | 'Sim' | '';
  accommodationDetails: string;
}

export interface UploadedAttachment {
  id: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: 'curriculo' | 'certificado' | 'curso' | 'qualificacao';
  sha256: string;
  uploadedAt: string;
}

export type EntrySource = 'vagas1' | 'vagas2' | 'site_principal';

export interface ApplicationFormState {
  personal: PersonalContactData;
  education: EducationQualificationsData;
  professionalSummary: ProfessionalSummaryData;
  experiences: WorkExperienceInput[];
  availability: AvailabilityData;
  roleSpecific: RoleSpecificAnswers;
  safetyAndAccessibility: SafetyAndAccessibilityData;
  attachments: UploadedAttachment[];
  identityDocumentIds?: string[];
  lgpdConsent: boolean;
  talentPoolConsent: boolean;
}

export interface ApplicationRecord {
  id: string;
  protocol: string;
  jobId: string;
  jobTitle: string;
  jobRoleType: JobRoleType;
  jobSalaryDisplay: string;
  status: ApplicationStatus;
  personal: PersonalContactData;
  education: EducationQualificationsData;
  professionalSummary: ProfessionalSummaryData;
  availability: AvailabilityData;
  roleSpecific: RoleSpecificAnswers;
  safetyAndAccessibility: SafetyAndAccessibilityData;
  lgpdConsent: boolean;
  talentPoolConsent: boolean;
  experienceCount: number;
  attachmentCount: number;
  internalNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  comment: string;
  changedByEmail: string;
  changedByUid: string;
  createdAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: string;
  actorEmail: string;
  actorUid: string;
  createdAt?: unknown;
}

export interface CompanySettings {
  brandName: string;
  brandSubtitle: string;
  legalName: string;
  cnpj: string;
  address: string;
  institutionalEmail: string;
  institutionalPhone: string;
  dpoName: string;
  dpoEmail: string;
  retentionDays: number;
  brandDisclaimer: string;
  updatedAt?: unknown;
}

export interface ContactMessageInput {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}
