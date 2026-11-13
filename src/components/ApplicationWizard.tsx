import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { lookupCep } from '../lib/cepLookup.ts';
import { ChannelPrefix } from '../lib/channelRouting.ts';
import { submitFullApplication, uploadAttachment } from '../lib/recruitmentService.ts';
import {
  availabilitySchema,
  BR_STATES,
  calculateWorkDuration,
  EDUCATION_LEVELS,
  formatCepBR,
  formatPhoneBR,
  personalSchema,
  workExperienceSchema,
} from '../lib/validation.ts';
import {
  ApplicationFormState,
  CompanySettings,
  EntrySource,
  JobPosting,
  UploadedAttachment,
  WorkExperienceInput,
} from '../types/recruitment.ts';
import { ConfirmationReceipt } from './ConfirmationPage.tsx';

interface ApplicationWizardProps {
  selectedJob: JobPosting | null;
  availableJobs: JobPosting[];
  channelPrefix: ChannelPrefix | null;
  settings: CompanySettings;
  onSelectJob: (job: JobPosting) => void;
  onSuccess: (receipt: ConfirmationReceipt) => void;
  onNavigate: (path: string) => void;
}

const STEP_TITLES = [
  'Seus Dados e Endereço',
  'Experiência e Vaga',
  'Documento com Foto e Anexos',
  'Revisar e Enviar',
];

function createEmptyExperience(): WorkExperienceInput {
  return {
    id: crypto.randomUUID(),
    companyName: '',
    role: '',
    area: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    signedCard: '',
    lastSalary: '',
    benefits: '',
    dailyActivities: '',
    responsibilities: '',
    equipmentUsed: '',
    leaveReason: '',
    notes: '',
    calculatedYears: 0,
    calculatedMonths: 0,
    durationLabel: 'Informe a data de admissão',
  };
}

function createInitialFormState(): ApplicationFormState {
  return {
    personal: {
      fullName: '',
      email: '',
      phone: '',
      whatsapp: '',
      cep: '',
      state: '',
      city: '',
      neighborhood: '',
      street: '',
      number: '',
      complement: '',
      reference: '',
      deferFullAddress: false,
    },
    education: {
      educationLevel: '',
      hasVocationalCourse: 'Não',
      vocationalCourseName: '',
      hasCourseCertificate: '',
      hasLogisticsExperience: '',
      performedActivitiesText: '',
      skills: [],
    },
    professionalSummary: {
      hasWorkedBefore: '',
      currentlyEmployed: '',
      totalLogisticsExperience: '',
      salaryExpectation: '',
      startAvailability: '',
    },
    experiences: [createEmptyExperience()],
    availability: {
      flexibleHours: '',
      shiftWork: '',
      weekendsPerSchedule: '',
      jobScheduleFit: '',
      travelAvailability: '',
      overnightStayAvailability: '',
      trainingAvailability: 'Sim',
      startTimeline: '',
      hasOwnTransport: '',
      scheduleLimitations: '',
    },
    roleSpecific: {},
    safetyAndAccessibility: {
      confirmedEssentialTasks: false,
      awareSafetyAndTraining: false,
      needsProcessAccommodation: 'Não',
      accommodationDetails: '',
    },
    attachments: [],
    identityDocumentIds: [],
    lgpdConsent: false,
    talentPoolConsent: false,
  };
}

function OptionCards({
  label,
  required,
  value,
  options,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-zinc-900">
        {label} {required && <span className="text-[#C8102E]">*</span>}
      </legend>
      <div
        className={`grid grid-cols-1 ${
          options.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
        } gap-2.5`}
      >
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={active}
              className={`px-4 py-3 text-sm font-semibold rounded-xl border text-left transition-colors min-h-[46px] cursor-pointer ${
                active
                  ? 'bg-[#C8102E] text-white border-[#C8102E]'
                  : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-400'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ApplicationWizard({
  selectedJob,
  availableJobs,
  channelPrefix,
  settings,
  onSelectJob,
  onSuccess,
  onNavigate,
}: ApplicationWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApplicationFormState>(createInitialFormState);
  const [stepError, setStepError] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID().replace(/-/g, ''));

  // CEP lookup state
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');
  const lastFetchedCepRef = useRef<string>('');
  const cepAbortRef = useRef<AbortController | null>(null);

  // Upload states
  const [uploadingIdDoc, setUploadingIdDoc] = useState(false);
  const [idDocError, setIdDocError] = useState('');
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [extraCategory, setExtraCategory] =
    useState<UploadedAttachment['category']>('curriculo');
  const [extraError, setExtraError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const effectiveChannel: ChannelPrefix = channelPrefix ?? '/vagas2';
  const entrySource: EntrySource =
    channelPrefix === '/vagas1'
      ? 'vagas1'
      : channelPrefix === '/vagas2'
        ? 'vagas2'
        : 'site_principal';

  const draftKey = selectedJob
    ? `jsl_draft_v2_${channelPrefix ? channelPrefix.slice(1) : 'principal'}_${selectedJob.id}`
    : null;

  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ApplicationFormState>;
        setForm((prev) => ({
          ...prev,
          ...parsed,
          attachments: parsed.attachments || [],
          identityDocumentIds: parsed.identityDocumentIds || [],
        }));
      }
    } catch {
      // ignora rascunho corrompido
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(form));
    } catch {
      // ignora erro de quota
    }
  }, [draftKey, form]);

  const triggerCepLookup = async (rawCep: string, force = false) => {
    const digits = rawCep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepStatus('idle');
      return;
    }
    if (!force && lastFetchedCepRef.current === digits) {
      return;
    }

    lastFetchedCepRef.current = digits;
    cepAbortRef.current?.abort();
    const controller = new AbortController();
    cepAbortRef.current = controller;

    setCepStatus('loading');
    try {
      const result = await lookupCep(digits, controller.signal);
      if (controller.signal.aborted) return;

      if (!result) {
        setCepStatus('not_found');
        return;
      }

      setForm((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          cep: formatCepBR(result.cep),
          city: result.city,
          state: result.state,
          neighborhood: result.neighborhood || prev.personal.neighborhood,
          street: result.street || prev.personal.street,
          deferFullAddress: false,
        },
      }));
      setCepStatus('found');
    } catch {
      if (!controller.signal.aborted) {
        setCepStatus('not_found');
      }
    }
  };

  useEffect(() => {
    const digits = form.personal.cep.replace(/\D/g, '');
    if (digits.length === 8 && lastFetchedCepRef.current !== digits) {
      void triggerCepLookup(digits);
    } else if (digits.length < 8 && cepStatus !== 'idle') {
      setCepStatus('idle');
      lastFetchedCepRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.personal.cep]);

  if (!selectedJob) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10">
          <p className="text-xs font-semibold text-[#C8102E] mb-2">SELEÇÃO DA VAGA</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-zinc-950">
            Escolha a vaga para começar
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Leva poucos minutos. Selecione abaixo a vaga desejada:
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelectJob(job)}
                className="p-5 text-left bg-zinc-50 hover:bg-white border border-zinc-200 hover:border-[#C8102E] rounded-xl transition-colors cursor-pointer"
              >
                <p className="font-display text-lg font-bold text-zinc-950">{job.title}</p>
                <p className="mt-1 text-sm font-bold text-[#C8102E] tabular-nums">
                  {job.salaryDisplay}
                </p>
                <p className="mt-1.5 text-xs text-zinc-600">{job.schedule}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((step + 1) / STEP_TITLES.length) * 100);
  const identityDocIds = form.identityDocumentIds || [];
  const identityAttachments = form.attachments.filter((a) => identityDocIds.includes(a.fileId));
  const extraAttachments = form.attachments.filter((a) => !identityDocIds.includes(a.fileId));

  const validateCurrentStep = (): string => {
    if (step === 0) {
      const parsed = personalSchema.safeParse(form.personal);
      if (!parsed.success) return parsed.error.issues[0]?.message || 'Verifique seus dados pessoais.';
      if (!form.personal.cep || form.personal.cep.replace(/\D/g, '').length !== 8) {
        return 'Informe seu CEP completo (8 dígitos) para localizarmos seu endereço.';
      }
      return '';
    }

    if (step === 1) {
      if (!form.education.educationLevel) {
        return 'Selecione sua escolaridade.';
      }
      if (!form.education.hasLogisticsExperience) {
        return 'Informe se já possui experiência na área de logística ou transporte.';
      }
      if (!form.professionalSummary.hasWorkedBefore) {
        return 'Informe se já trabalhou antes ou se é seu primeiro emprego.';
      }
      if (form.professionalSummary.hasWorkedBefore === 'Sim') {
        if (form.experiences.length === 0) {
          return 'Informe ao menos uma experiência profissional.';
        }
        for (let i = 0; i < form.experiences.length; i++) {
          const exp = form.experiences[i];
          const duration = calculateWorkDuration(exp.startDate, exp.endDate, exp.isCurrent);
          if (!duration.valid) {
            return `Experiência ${i + 1}: ${duration.label}`;
          }
          const parsed = workExperienceSchema.safeParse({
            ...exp,
            calculatedYears: duration.years,
            calculatedMonths: duration.months,
            durationLabel: duration.label,
          });
          if (!parsed.success) {
            return `Experiência ${i + 1}: ${parsed.error.issues[0]?.message}`;
          }
        }
      }
      if (!form.professionalSummary.startAvailability.trim()) {
        return 'Informe quando pode começar a trabalhar.';
      }

      const avParsed = availabilitySchema.safeParse(form.availability);
      if (!avParsed.success) {
        return 'Responda todas as perguntas de disponibilidade (horários e viagens).';
      }

      const r = form.roleSpecific;
      if (selectedJob.roleType === 'motorista_caminhao') {
        if (!r.cnhCategory || !r.hasValidCnh || !r.truckExperience) {
          return 'Responda as perguntas da CNH e experiência com caminhões.';
        }
      } else if (selectedJob.roleType === 'motorista_fiorino') {
        if (!r.hasValidCnhBPlus || !r.utilityVehicleExperience) {
          return 'Responda as perguntas da CNH e experiência com utilitários.';
        }
      } else if (selectedJob.roleType === 'operador_empilhadeira') {
        if (!r.forkliftUpdatedLegalTraining || !r.forkliftCertificate || !r.forkliftWorkExperience) {
          return 'Responda as perguntas sobre curso, certificado e experiência com empilhadeira.';
        }
      } else if (selectedJob.roleType === 'auxiliar_logistica') {
        if (!r.orderPickingExp || !r.auxSchedule6x1) {
          return 'Responda as perguntas específicas para Auxiliar de Logística.';
        }
      } else if (selectedJob.roleType === 'conferente_pacotes') {
        if (!r.productInspectionExp || !r.conferenteSchedule6x1) {
          return 'Responda as perguntas específicas para Conferente de Pacotes.';
        }
      }
      return '';
    }

    if (step === 2) {
      if (identityAttachments.length === 0) {
        return 'Envie uma foto ou PDF do seu documento com foto aberto (frente e verso) para continuar.';
      }
      return '';
    }

    if (step === 3) {
      if (!form.lgpdConsent) {
        return 'Marque a confirmação de ciência e autorização para finalizar sua candidatura.';
      }
      return '';
    }

    return '';
  };

  const goNext = () => {
    const err = validateCurrentStep();
    if (err) {
      setStepError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setStepError('');
    setStep((s) => Math.min(STEP_TITLES.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPrev = () => {
    setStepError('');
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateExperience = (index: number, patch: Partial<WorkExperienceInput>) => {
    setForm((prev) => {
      const next = [...prev.experiences];
      const merged = { ...next[index], ...patch };
      const calc = calculateWorkDuration(merged.startDate, merged.endDate, merged.isCurrent);
      merged.calculatedYears = calc.years;
      merged.calculatedMonths = calc.months;
      merged.durationLabel = calc.label;
      next[index] = merged;
      return { ...prev, experiences: next };
    });
  };

  const handleIdentityDocUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setIdDocError('');
    if (form.attachments.length + files.length > 6) {
      setIdDocError('Limite máximo de 6 arquivos por candidatura atingido.');
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setIdDocError(`O arquivo "${file.name}" excede o limite máximo de 5 MB.`);
        return;
      }
    }

    setUploadingIdDoc(true);
    try {
      const uploadedList: UploadedAttachment[] = [];
      for (const file of files) {
        const uploaded = await uploadAttachment(file, 'qualificacao', effectiveChannel);
        uploadedList.push(uploaded);
      }
      setForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedList],
        identityDocumentIds: [
          ...(prev.identityDocumentIds || []),
          ...uploadedList.map((u) => u.fileId),
        ],
      }));
    } catch (err) {
      setIdDocError(err instanceof Error ? err.message : 'Erro no envio do documento.');
    } finally {
      setUploadingIdDoc(false);
    }
  };

  const handleExtraFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setExtraError('');
    if (file.size > 5 * 1024 * 1024) {
      setExtraError('O arquivo excede o limite máximo de 5 MB.');
      return;
    }
    if (form.attachments.length >= 6) {
      setExtraError('Limite máximo de 6 arquivos por candidatura atingido.');
      return;
    }

    setUploadingExtra(true);
    try {
      const uploaded = await uploadAttachment(file, extraCategory, effectiveChannel);
      setForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, uploaded],
      }));
    } catch (err) {
      setExtraError(err instanceof Error ? err.message : 'Erro no envio do arquivo.');
    } finally {
      setUploadingExtra(false);
    }
  };

  const removeAttachment = (fileId: string) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.fileId !== fileId),
      identityDocumentIds: (prev.identityDocumentIds || []).filter((id) => id !== fileId),
    }));
  };

  const handleFinalSubmit = async () => {
    const err = validateCurrentStep();
    if (err) {
      setStepError(err);
      return;
    }

    setStepError('');
    setSubmitting(true);
    try {
      const cleanExperiences =
        form.professionalSummary.hasWorkedBefore === 'Sim' ? form.experiences : [];
      const payloadToSend: ApplicationFormState = {
        ...form,
        experiences: cleanExperiences,
        personal: {
          ...form.personal,
          whatsapp: form.personal.whatsapp || form.personal.phone,
          deferFullAddress: !form.personal.street && !form.personal.neighborhood,
        },
        roleSpecific: {
          ...form.roleSpecific,
          ...(selectedJob.roleType === 'motorista_caminhao'
            ? {
                truckTravelAvailability:
                  form.roleSpecific.truckTravelAvailability ||
                  form.availability.travelAvailability ||
                  'Sim',
                truckOvernightAvailability:
                  form.roleSpecific.truckOvernightAvailability ||
                  form.availability.overnightStayAvailability ||
                  'Sim',
              }
            : {}),
          ...(selectedJob.roleType === 'motorista_fiorino'
            ? {
                deliveryExperience: form.roleSpecific.deliveryExperience || form.roleSpecific.utilityVehicleExperience || 'Sim',
                fiorinoTravelAvailability:
                  form.roleSpecific.fiorinoTravelAvailability ||
                  form.availability.travelAvailability ||
                  'Sim',
              }
            : {}),
          ...(selectedJob.roleType === 'auxiliar_logistica'
            ? {
                stockOrganizationExp: form.roleSpecific.stockOrganizationExp || form.roleSpecific.orderPickingExp || 'Sim',
                manualHandlingSafeLimits: form.roleSpecific.manualHandlingSafeLimits || 'Sim',
              }
            : {}),
          ...(selectedJob.roleType === 'conferente_pacotes'
            ? {
                parcelIdentificationExp: form.roleSpecific.parcelIdentificationExp || form.roleSpecific.productInspectionExp || 'Sim',
                barcodeScannerExp: form.roleSpecific.barcodeScannerExp || form.roleSpecific.productInspectionExp || 'Sim',
              }
            : {}),
        },
      };

      const receipt = await submitFullApplication(
        selectedJob,
        payloadToSend,
        effectiveChannel,
        idempotencyKey,
        honeypot,
        entrySource
      );

      if (draftKey) sessionStorage.removeItem(draftKey);
      onSuccess(receipt);
    } catch (submitErr) {
      setStepError(
        submitErr instanceof Error
          ? submitErr.message
          : 'Erro ao finalizar candidatura. Seus dados foram preservados; tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Banner da Vaga + Barra de Progresso simples (4 etapas) */}
      <div className="bg-zinc-900 text-white rounded-2xl p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-zinc-400">Candidatura rápida · Vaga selecionada</p>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold">{selectedJob.title}</h1>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-zinc-400">Salário inicial</p>
            <p className="font-display text-lg font-bold text-red-400 tabular-nums">
              {selectedJob.salaryDisplay}
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-2">
            <span>
              Passo {step + 1} de {STEP_TITLES.length} · {STEP_TITLES[step]}
            </span>
            <span className="tabular-nums">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C8102E] transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {stepError && (
        <div
          role="alert"
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-900"
        >
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">Confira antes de continuar</p>
            <p className="mt-0.5">{stepError}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-8 space-y-6">
        {/* PASSO 1 — DADOS PESSOAIS + CEP AUTOMÁTICO */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                1. Seus dados e endereço
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Preencha seus dados para contato. Ao digitar o CEP, o endereço completa sozinho.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                  Nome completo <span className="text-[#C8102E]">*</span>
                </label>
                <input
                  type="text"
                  value={form.personal.fullName}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      personal: { ...p.personal, fullName: e.target.value },
                    }))
                  }
                  placeholder="Digite seu nome completo"
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                  Celular / WhatsApp com DDD <span className="text-[#C8102E]">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.personal.phone}
                  onChange={(e) => {
                    const formatted = formatPhoneBR(e.target.value);
                    setForm((p) => ({
                      ...p,
                      personal: {
                        ...p.personal,
                        phone: formatted,
                        whatsapp: formatted,
                      },
                    }));
                  }}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                  E-mail <span className="text-[#C8102E]">*</span>
                </label>
                <input
                  type="email"
                  value={form.personal.email}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      personal: { ...p.personal, email: e.target.value },
                    }))
                  }
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            {/* Buscador automático de CEP */}
            <div className="pt-4 border-t border-zinc-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    CEP <span className="text-[#C8102E]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.personal.cep}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          personal: { ...p.personal, cep: formatCepBR(e.target.value) },
                        }))
                      }
                      placeholder="00000-000"
                      className="flex-1 px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                    <button
                      type="button"
                      onClick={() => void triggerCepLookup(form.personal.cep, true)}
                      disabled={cepStatus === 'loading' || form.personal.cep.replace(/\D/g, '').length !== 8}
                      className="px-4 py-3.5 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                    >
                      {cepStatus === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                      )}
                      Buscar
                    </button>
                  </div>
                  {cepStatus === 'loading' && (
                    <p className="mt-1.5 text-xs text-zinc-600">Buscando endereço pelo CEP...</p>
                  )}
                  {cepStatus === 'found' && (
                    <p className="mt-1.5 text-xs font-medium text-emerald-700">
                      Endereço encontrado automaticamente. Confira e informe o número abaixo.
                    </p>
                  )}
                  {cepStatus === 'not_found' && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      CEP não encontrado automaticamente. Preencha Cidade e Estado manualmente abaixo.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      Cidade <span className="text-[#C8102E]">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.personal.city}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          personal: { ...p.personal, city: e.target.value },
                        }))
                      }
                      placeholder="Ex.: São Paulo"
                      className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      UF <span className="text-[#C8102E]">*</span>
                    </label>
                    <select
                      value={form.personal.state}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          personal: { ...p.personal, state: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-3.5 text-base bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                    >
                      <option value="">UF</option>
                      {BR_STATES.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    Rua / Avenida
                  </label>
                  <input
                    type="text"
                    value={form.personal.street}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        personal: { ...p.personal, street: e.target.value },
                      }))
                    }
                    placeholder="Preenchida pelo CEP"
                    className="w-full px-4 py-3 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={form.personal.neighborhood}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        personal: { ...p.personal, neighborhood: e.target.value },
                      }))
                    }
                    placeholder="Preenchido pelo CEP"
                    className="w-full px-4 py-3 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    Número
                  </label>
                  <input
                    type="text"
                    value={form.personal.number}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        personal: { ...p.personal, number: e.target.value },
                      }))
                    }
                    placeholder="Nº"
                    className="w-full px-3 py-3 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASSO 2 — EXPERIÊNCIA + DISPONIBILIDADE + PERGUNTAS DA VAGA */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                2. Experiência e perfil para a vaga
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Responda de forma simples sobre seus estudos, empregos anteriores e requisitos de{' '}
                <strong>{selectedJob.title}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                  Escolaridade <span className="text-[#C8102E]">*</span>
                </label>
                <select
                  value={form.education.educationLevel}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      education: { ...p.education, educationLevel: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-3.5 text-base bg-white border border-zinc-300 rounded-xl"
                >
                  <option value="">Selecione...</option>
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                  Quando pode começar? <span className="text-[#C8102E]">*</span>
                </label>
                <select
                  value={form.professionalSummary.startAvailability}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      professionalSummary: {
                        ...p.professionalSummary,
                        startAvailability: e.target.value,
                      },
                      availability: {
                        ...p.availability,
                        startTimeline: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-4 py-3.5 text-base bg-white border border-zinc-300 rounded-xl"
                >
                  <option value="">Selecione...</option>
                  <option value="Imediata">Imediata</option>
                  <option value="Em até 7 dias">Em até 7 dias</option>
                  <option value="Em até 15 dias">Em até 15 dias</option>
                  <option value="Aviso prévio (30 dias)">Aviso prévio (30 dias)</option>
                </select>
              </div>
            </div>

            <OptionCards
              label="Já trabalhou com transporte ou logística?"
              required
              value={form.education.hasLogisticsExperience}
              options={['Sim', 'Não']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  education: {
                    ...p.education,
                    hasLogisticsExperience: val as 'Sim' | 'Não',
                  },
                }))
              }
            />

            <OptionCards
              label="Já trabalhou anteriormente?"
              required
              value={form.professionalSummary.hasWorkedBefore}
              options={['Sim', 'Não, estou buscando meu primeiro emprego']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  professionalSummary: {
                    ...p.professionalSummary,
                    hasWorkedBefore: val as 'Sim' | 'Não, estou buscando meu primeiro emprego',
                  },
                }))
              }
            />

            {form.professionalSummary.hasWorkedBefore === 'Sim' && (
              <div className="space-y-4">
                {form.experiences.map((exp, idx) => {
                  const duration = calculateWorkDuration(exp.startDate, exp.endDate, exp.isCurrent);
                  return (
                    <div
                      key={exp.id}
                      className="border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4 bg-zinc-50/70"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-base font-bold text-zinc-950">
                          Última experiência {form.experiences.length > 1 ? `#${idx + 1}` : ''}
                        </h3>
                        {form.experiences.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                experiences: p.experiences.filter((_, i) => i !== idx),
                              }))
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1">
                            Nome da empresa <span className="text-[#C8102E]">*</span>
                          </label>
                          <input
                            type="text"
                            value={exp.companyName}
                            onChange={(e) =>
                              updateExperience(idx, { companyName: e.target.value })
                            }
                            placeholder="Ex.: Transportadora ABC"
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1">
                            Cargo <span className="text-[#C8102E]">*</span>
                          </label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => updateExperience(idx, { role: e.target.value })}
                            placeholder="Ex.: Motorista / Conferente"
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1">
                            Data de entrada <span className="text-[#C8102E]">*</span>
                          </label>
                          <input
                            type="date"
                            value={exp.startDate}
                            onChange={(e) => updateExperience(idx, { startDate: e.target.value })}
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1">
                            Data de saída
                          </label>
                          <input
                            type="date"
                            disabled={exp.isCurrent}
                            value={exp.isCurrent ? '' : exp.endDate}
                            onChange={(e) => updateExperience(idx, { endDate: e.target.value })}
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl disabled:bg-zinc-100 disabled:text-zinc-400"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={exp.isCurrent}
                            onChange={(e) =>
                              updateExperience(idx, { isCurrent: e.target.checked })
                            }
                            className="w-4 h-4 accent-[#C8102E]"
                          />
                          Ainda trabalho nessa empresa
                        </label>
                        {duration.valid && (
                          <span className="text-xs font-semibold text-[#C8102E]">
                            Tempo calculado: {duration.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      experiences: [...p.experiences, createEmptyExperience()],
                    }))
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-[#C8102E] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Adicionar outra experiência (opcional)
                </button>
              </div>
            )}

            {/* Disponibilidade resumida */}
            <div className="pt-4 border-t border-zinc-200 space-y-5">
              <OptionCards
                label="Tem disponibilidade para horários variados, turnos e escala da vaga?"
                required
                value={form.availability.jobScheduleFit}
                options={['Sim', 'Não', 'A combinar']}
                onChange={(val) => {
                  const v = val as 'Sim' | 'Não' | 'A combinar';
                  setForm((p) => ({
                    ...p,
                    availability: {
                      ...p.availability,
                      flexibleHours: v,
                      shiftWork: v,
                      weekendsPerSchedule: v,
                      jobScheduleFit: v,
                      trainingAvailability: 'Sim',
                    },
                  }));
                }}
              />

              <OptionCards
                label="Tem disponibilidade para viagens e eventuais pernoites quando a operação exigir?"
                required
                value={form.availability.travelAvailability}
                options={['Sim', 'Não', 'A combinar']}
                onChange={(val) => {
                  const v = val as 'Sim' | 'Não' | 'A combinar';
                  setForm((p) => ({
                    ...p,
                    availability: {
                      ...p.availability,
                      travelAvailability: v,
                      overnightStayAvailability: v,
                    },
                  }));
                }}
              />
            </div>

            {/* Perguntas essenciais da vaga selecionada */}
            <div className="pt-4 border-t border-zinc-200 space-y-5">
              <h3 className="font-display text-base font-bold text-zinc-950">
                Requisitos para {selectedJob.title}
              </h3>

              {selectedJob.roleType === 'motorista_caminhao' && (
                <div className="space-y-4">
                  <OptionCards
                    label="Categoria da sua CNH"
                    required
                    value={form.roleSpecific.cnhCategory || ''}
                    options={['C', 'E']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: { ...p.roleSpecific, cnhCategory: v as 'C' | 'E' },
                      }))
                    }
                  />
                  <OptionCards
                    label="Sua CNH está válida e em dia?"
                    required
                    value={form.roleSpecific.hasValidCnh || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: { ...p.roleSpecific, hasValidCnh: v as 'Sim' | 'Não' },
                      }))
                    }
                  />
                  <OptionCards
                    label="Já tem experiência dirigindo caminhões?"
                    required
                    value={form.roleSpecific.truckExperience || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: { ...p.roleSpecific, truckExperience: v as 'Sim' | 'Não' },
                      }))
                    }
                  />
                  {form.roleSpecific.truckExperience === 'Sim' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-zinc-900 mb-1">
                          Quanto tempo de experiência? (opcional)
                        </label>
                        <input
                          type="text"
                          value={form.roleSpecific.truckExperienceDuration || ''}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              roleSpecific: {
                                ...p.roleSpecific,
                                truckExperienceDuration: e.target.value,
                              },
                            }))
                          }
                          placeholder="Ex.: 3 anos"
                          className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-zinc-900 mb-1">
                          Tipos de caminhões que já dirigiu (opcional)
                        </label>
                        <input
                          type="text"
                          value={form.roleSpecific.truckTypesDriven || ''}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              roleSpecific: {
                                ...p.roleSpecific,
                                truckTypesDriven: e.target.value,
                              },
                            }))
                          }
                          placeholder="Ex.: Truck, Carreta"
                          className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedJob.roleType === 'motorista_fiorino' && (
                <div className="space-y-4">
                  <OptionCards
                    label="Possui CNH categoria B ou superior válida?"
                    required
                    value={form.roleSpecific.hasValidCnhBPlus || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: { ...p.roleSpecific, hasValidCnhBPlus: v as 'Sim' | 'Não' },
                      }))
                    }
                  />
                  <OptionCards
                    label="Já dirigiu veículo utilitário (Fiorino, Kangoo, Van) ou trabalhou com entregas?"
                    required
                    value={form.roleSpecific.utilityVehicleExperience || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          utilityVehicleExperience: v as 'Sim' | 'Não',
                        },
                      }))
                    }
                  />
                </div>
              )}

              {selectedJob.roleType === 'operador_empilhadeira' && (
                <div className="space-y-4">
                  <OptionCards
                    label="Possui treinamento NR-11 atualizado?"
                    required
                    value={form.roleSpecific.forkliftUpdatedLegalTraining || ''}
                    options={['Sim', 'Não', 'Em renovação']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          forkliftTraining: v === 'Não' ? 'Não' : 'Sim',
                          forkliftUpdatedLegalTraining: v as 'Sim' | 'Não' | 'Em renovação',
                        },
                      }))
                    }
                  />
                  <OptionCards
                    label="Possui certificado de operador de empilhadeira?"
                    required
                    value={form.roleSpecific.forkliftCertificate || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          forkliftCertificate: v as 'Sim' | 'Não',
                        },
                      }))
                    }
                  />
                  <OptionCards
                    label="Possui experiência profissional operando empilhadeira?"
                    required
                    value={form.roleSpecific.forkliftWorkExperience || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          forkliftWorkExperience: v as 'Sim' | 'Não',
                        },
                      }))
                    }
                  />
                </div>
              )}

              {selectedJob.roleType === 'auxiliar_logistica' && (
                <div className="space-y-4">
                  <OptionCards
                    label="Possui experiência com separação de pedidos ou organização de estoque?"
                    required
                    value={form.roleSpecific.orderPickingExp || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: { ...p.roleSpecific, orderPickingExp: v as 'Sim' | 'Não' },
                      }))
                    }
                  />
                  <OptionCards
                    label="Tem disponibilidade para escala 6x1?"
                    required
                    value={form.roleSpecific.auxSchedule6x1 || ''}
                    options={['Sim', 'Não', 'A combinar']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          auxSchedule6x1: v as 'Sim' | 'Não' | 'A combinar',
                        },
                      }))
                    }
                  />
                </div>
              )}

              {selectedJob.roleType === 'conferente_pacotes' && (
                <div className="space-y-4">
                  <OptionCards
                    label="Já trabalhou com conferência de mercadorias ou leitor de código de barras?"
                    required
                    value={form.roleSpecific.productInspectionExp || ''}
                    options={['Sim', 'Não']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          productInspectionExp: v as 'Sim' | 'Não',
                        },
                      }))
                    }
                  />
                  <OptionCards
                    label="Tem disponibilidade para escala 6x1?"
                    required
                    value={form.roleSpecific.conferenteSchedule6x1 || ''}
                    options={['Sim', 'Não', 'A combinar']}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          conferenteSchedule6x1: v as 'Sim' | 'Não' | 'A combinar',
                        },
                      }))
                    }
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1">
                  Cursos ou observações extras (opcional)
                </label>
                <input
                  type="text"
                  value={form.education.vocationalCourseName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((p) => ({
                      ...p,
                      education: {
                        ...p.education,
                        vocationalCourseName: val,
                        hasVocationalCourse: val.trim() ? 'Sim' : 'Não',
                      },
                    }));
                  }}
                  placeholder="Ex.: MOPP, NR-11, Direção Defensiva..."
                  className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* PASSO 3 — DOCUMENTO COM FOTO (FRENTE E VERSO ABERTO) + CURRÍCULO OPCIONAL */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                3. Documento com Foto (Frente e Verso)
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Último passo antes de enviar: suba uma foto nítida ou PDF do seu documento com foto
                aberto mostrando <strong>frente e verso</strong> (RG ou CNH).
              </p>
            </div>

            {/* Aviso transparente de finalidade: verificação de antecedentes e identidade */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-2 text-xs sm:text-sm text-zinc-700 leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-zinc-950">
                <ShieldCheck className="w-4 h-4 text-[#C8102E] shrink-0" aria-hidden="true" />
                <span>Como usaremos seu documento</span>
              </div>
              <p>
                Usaremos essas informações e o documento enviado <strong>apenas</strong> para
                confirmação da sua identidade, análise cadastral e{' '}
                <strong>verificação de antecedentes criminais</strong> exigida para atuação no
                transporte e logística, conforme a LGPD. Os arquivos ficam em ambiente privado e
                restrito ao RH.
              </p>
            </div>

            {/* Caixa principal: Documento com foto frente e verso aberto */}
            <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-5 sm:p-6 space-y-4 bg-white">
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-950">
                  Foto do documento aberto (Frente e Verso — RG ou CNH){' '}
                  <span className="text-[#C8102E]">*</span>
                </p>
                <p className="text-xs text-zinc-600">
                  Aceitamos JPG, PNG ou PDF (até 5 MB cada). Se o documento for frente e verso
                  separados, você pode enviar as 2 fotos aqui.
                </p>
              </div>

              <label className="flex items-center justify-center gap-2.5 w-full px-5 py-4 text-sm font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl cursor-pointer transition-colors min-h-[52px]">
                {uploadingIdDoc ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="w-5 h-5" aria-hidden="true" />
                )}
                <span>
                  {uploadingIdDoc
                    ? 'Enviando documento...'
                    : identityAttachments.length > 0
                      ? 'Adicionar outra foto do documento (verso ou complemento)'
                      : 'Tirar foto ou enviar documento (Frente e Verso)'}
                </span>
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  disabled={uploadingIdDoc}
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={handleIdentityDocUpload}
                />
              </label>

              {idDocError && (
                <p role="alert" className="text-sm text-red-700 font-medium">
                  {idDocError}
                </p>
              )}

              {identityAttachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  {identityAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2
                          className="w-5 h-5 text-emerald-700 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">
                            {att.originalName}
                          </p>
                          <p className="text-xs text-zinc-600 tabular-nums">
                            Documento com foto · {(att.sizeBytes / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.fileId)}
                        className="text-xs font-semibold text-red-700 hover:text-red-900 px-2 py-1 cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção Opcional: Currículo ou Certificados */}
            <div className="pt-4 border-t border-zinc-200 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Currículo ou certificados (opcional)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Se desejar, anexe também seu currículo ou certificado de curso (NR-11, MOPP, etc.).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <select
                  value={extraCategory}
                  onChange={(e) =>
                    setExtraCategory(e.target.value as UploadedAttachment['category'])
                  }
                  aria-label="Tipo de anexo opcional"
                  className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                >
                  <option value="curriculo">Currículo (PDF, DOCX, JPG ou PNG)</option>
                  <option value="certificado">Certificado (PDF, JPG ou PNG)</option>
                  <option value="curso">Comprovante de curso (PDF, JPG ou PNG)</option>
                </select>

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer transition-colors min-h-[46px]">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  {uploadingExtra ? 'Enviando...' : 'Anexar arquivo opcional'}
                  <input
                    type="file"
                    className="sr-only"
                    disabled={uploadingExtra}
                    accept={
                      extraCategory === 'curriculo'
                        ? '.pdf,.docx,.jpg,.jpeg,.png'
                        : '.pdf,.jpg,.jpeg,.png'
                    }
                    onChange={handleExtraFileUpload}
                  />
                </label>
              </div>

              {extraError && (
                <p role="alert" className="text-sm text-red-700 font-medium">
                  {extraError}
                </p>
              )}

              {extraAttachments.length > 0 && (
                <div className="space-y-2">
                  {extraAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-[#C8102E] shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">
                            {att.originalName}
                          </p>
                          <p className="text-xs text-zinc-500 tabular-nums">
                            {att.category} · {(att.sizeBytes / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.fileId)}
                        className="text-xs font-semibold text-red-700 hover:text-red-900 px-2 py-1 cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASSO 4 — REVISAR E ENVIAR */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                4. Revise e finalize sua candidatura
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Confira seus dados antes de enviar. Se precisar ajustar algo, clique em Editar.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-zinc-900">Dados e endereço</p>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </div>
                <p className="text-zinc-800 font-medium">
                  {form.personal.fullName} · {form.personal.phone}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {form.personal.email} · {form.personal.street ? `${form.personal.street}, ` : ''}
                  {form.personal.number ? `${form.personal.number} · ` : ''}
                  {form.personal.neighborhood ? `${form.personal.neighborhood} · ` : ''}
                  {form.personal.city}/{form.personal.state} (CEP {form.personal.cep})
                </p>
              </div>

              <div className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-zinc-900">Experiência e disponibilidade</p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </div>
                <p className="text-xs text-zinc-700">
                  Escolaridade: {form.education.educationLevel} · Início:{' '}
                  {form.professionalSummary.startAvailability}
                </p>
                {form.professionalSummary.hasWorkedBefore === 'Sim' ? (
                  <ul className="mt-1.5 space-y-1 text-xs text-zinc-700">
                    {form.experiences.map((exp) => (
                      <li key={exp.id}>
                        <strong>{exp.role}</strong> em {exp.companyName} ({exp.durationLabel})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-600 mt-1">Buscando primeiro emprego.</p>
                )}
              </div>

              <div className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-zinc-900">Documentos anexados</p>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </div>
                <p className="text-xs text-zinc-700">
                  Documento com foto (frente e verso): {identityAttachments.length} arquivo(s) ·
                  Outros anexos: {extraAttachments.length} arquivo(s)
                </p>
              </div>
            </div>

            {/* Resumo das atividades + ciência LGPD e verificação de antecedentes */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2 text-xs text-zinc-700 leading-relaxed">
              <p className="font-bold text-zinc-900">
                Privacidade e uso das informações ({settings.cnpj})
              </p>
              <p>
                Os dados preenchidos e o documento com foto enviado serão usados exclusivamente para
                análise do processo seletivo, confirmação de identidade e{' '}
                <strong>verificação de antecedentes criminais</strong> aplicável à função.{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/privacidade')}
                  className="underline font-semibold text-zinc-950 cursor-pointer"
                >
                  Ler Política de Privacidade
                </button>
                .
              </p>
            </div>

            {/* Campo anti-spam oculto (honeypot) */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="company_website_hp">Não preencha este campo</label>
              <input
                id="company_website_hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border border-zinc-300 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.lgpdConsent}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((p) => ({
                      ...p,
                      lgpdConsent: checked,
                      safetyAndAccessibility: {
                        ...p.safetyAndAccessibility,
                        confirmedEssentialTasks: checked,
                        awareSafetyAndTraining: checked,
                      },
                    }));
                  }}
                  className="w-5 h-5 mt-0.5 accent-[#C8102E]"
                />
                <span className="text-sm text-zinc-900 leading-relaxed">
                  Confirmo que as informações são verdadeiras, estou ciente das atividades e
                  normas de segurança da vaga e autorizo o uso dos meus dados e documento com foto
                  para análise cadastral e verificação de antecedentes no processo seletivo (LGPD).{' '}
                  <span className="text-[#C8102E]">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 p-4 border border-zinc-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.talentPoolConsent}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, talentPoolConsent: e.target.checked }))
                  }
                  className="w-5 h-5 mt-0.5 accent-[#C8102E]"
                />
                <span className="text-sm text-zinc-700">
                  (Opcional) Autorizo manter meu cadastro para futuras vagas compatíveis.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navegação Inferior */}
        <div className="pt-6 border-t border-zinc-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={goPrev}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl min-h-[48px] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('/vagas')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-zinc-600 hover:text-zinc-950 rounded-xl min-h-[48px] cursor-pointer"
            >
              Trocar vaga
            </button>
          )}

          {step < STEP_TITLES.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl min-h-[50px] cursor-pointer"
            >
              Continuar
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white bg-[#C8102E] hover:bg-[#A00D24] rounded-xl min-h-[52px] disabled:opacity-60 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              {submitting ? 'Enviando candidatura...' : 'ENVIAR CANDIDATURA'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
