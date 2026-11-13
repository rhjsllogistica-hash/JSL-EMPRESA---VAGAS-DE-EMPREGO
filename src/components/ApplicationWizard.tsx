import { useEffect, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit3,
  FileText,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { submitFullApplication } from '../lib/recruitmentService.ts';
import {
  availabilitySchema,
  BR_STATES,
  calculateWorkDuration,
  EDUCATION_LEVELS,
  educationSchema,
  formatCepBR,
  formatCurrencyInputBR,
  formatPhoneBR,
  LOGISTICS_SKILLS,
  personalSchema,
  workExperienceSchema,
} from '../lib/validation.ts';
import {
  ApplicationFormState,
  CompanySettings,
  JobPosting,
  UploadedAttachment,
  WorkExperienceInput,
} from '../types/recruitment.ts';
import { ConfirmationReceipt } from './ConfirmationPage.tsx';

interface ApplicationWizardProps {
  selectedJob: JobPosting | null;
  availableJobs: JobPosting[];
  settings: CompanySettings;
  onSelectJob: (job: JobPosting) => void;
  onSuccess: (receipt: ConfirmationReceipt) => void;
  onNavigate: (path: string) => void;
}

const STEP_TITLES = [
  'Dados Pessoais e Contato',
  'Escolaridade e Qualificações',
  'Histórico Profissional',
  'Disponibilidade Profissional',
  'Perguntas da Vaga',
  'Condições e Segurança',
  'Currículo e Anexos',
  'Conferência e Envio',
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
      deferFullAddress: true,
    },
    education: {
      educationLevel: '',
      hasVocationalCourse: '',
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
      trainingAvailability: '',
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
  settings,
  onSelectJob,
  onSuccess,
  onNavigate,
}: ApplicationWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApplicationFormState>(createInitialFormState);
  const [stepError, setStepError] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<UploadedAttachment['category']>('curriculo');
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const draftKey = selectedJob ? `jsl_draft_${selectedJob.id}` : null;

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

  if (!selectedJob) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10">
          <p className="text-xs font-semibold text-[#C8102E] mb-2">SELEÇÃO OBRIGATÓRIA DA VAGA</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-zinc-950">
            Escolha a vaga antes de iniciar sua inscrição
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Para adaptar as perguntas específicas da função e registrar corretamente sua candidatura,
            selecione uma das oportunidades abaixo:
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

  const validateCurrentStep = (): string => {
    if (step === 0) {
      const parsed = personalSchema.safeParse(form.personal);
      if (!parsed.success) return parsed.error.issues[0]?.message || 'Verifique os dados pessoais.';
      return '';
    }
    if (step === 1) {
      const parsed = educationSchema.safeParse(form.education);
      if (!parsed.success) return parsed.error.issues[0]?.message || 'Verifique sua escolaridade.';
      if (
        form.education.hasVocationalCourse === 'Sim' &&
        !form.education.vocationalCourseName.trim()
      ) {
        return 'Informe qual curso profissionalizante realizou.';
      }
      return '';
    }
    if (step === 2) {
      if (!form.professionalSummary.hasWorkedBefore) {
        return 'Informe se já trabalhou anteriormente.';
      }
      if (form.professionalSummary.hasWorkedBefore === 'Sim') {
        if (form.experiences.length === 0) {
          return 'Cadastre ao menos uma experiência profissional.';
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
        return 'Informe quando teria disponibilidade para iniciar.';
      }
      return '';
    }
    if (step === 3) {
      const parsed = availabilitySchema.safeParse(form.availability);
      if (!parsed.success) {
        return parsed.error.issues[0]?.message || 'Responda todas as perguntas de disponibilidade.';
      }
      return '';
    }
    if (step === 4) {
      const r = form.roleSpecific;
      if (selectedJob.roleType === 'motorista_caminhao') {
        if (!r.cnhCategory || !r.hasValidCnh || !r.truckExperience || !r.truckTravelAvailability || !r.truckOvernightAvailability) {
          return 'Responda os requisitos obrigatórios para Motorista de Caminhão.';
        }
      } else if (selectedJob.roleType === 'motorista_fiorino') {
        if (!r.hasValidCnhBPlus || !r.utilityVehicleExperience || !r.deliveryExperience || !r.fiorinoTravelAvailability) {
          return 'Responda os requisitos obrigatórios para Motorista de Fiorino.';
        }
      } else if (selectedJob.roleType === 'operador_empilhadeira') {
        if (!r.forkliftTraining || !r.forkliftCertificate || !r.forkliftWorkExperience || !r.forkliftUpdatedLegalTraining) {
          return 'Responda os requisitos obrigatórios para Operador de Empilhadeira.';
        }
      } else if (selectedJob.roleType === 'auxiliar_logistica') {
        if (!r.orderPickingExp || !r.stockOrganizationExp || !r.auxSchedule6x1 || !r.manualHandlingSafeLimits) {
          return 'Responda as perguntas específicas para Auxiliar de Logística.';
        }
      } else if (selectedJob.roleType === 'conferente_pacotes') {
        if (!r.productInspectionExp || !r.parcelIdentificationExp || !r.barcodeScannerExp || !r.conferenteSchedule6x1) {
          return 'Responda as perguntas específicas para Conferente de Pacotes.';
        }
      }
      return '';
    }
    if (step === 5) {
      if (
        !form.safetyAndAccessibility.confirmedEssentialTasks ||
        !form.safetyAndAccessibility.awareSafetyAndTraining
      ) {
        return 'Confirme ciência das atividades essenciais e dos procedimentos de segurança.';
      }
      return '';
    }
    if (step === 6) {
      return '';
    }
    if (step === 7) {
      if (!form.lgpdConsent) {
        return 'Marque a ciência da Política de Privacidade para finalizar sua candidatura.';
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

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError('');
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('O arquivo excede o limite máximo de 5 MB.');
      return;
    }
    if (form.attachments.length >= 6) {
      setUploadError('Limite máximo de 6 arquivos por candidatura atingido.');
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('category', uploadCategory);

      const res = await fetch('/api/uploads', {
        method: 'POST',
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar arquivo.');
      }

      const uploaded: UploadedAttachment = {
        id: crypto.randomUUID(),
        fileId: data.fileId,
        originalName: data.originalName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        category: data.category,
        sha256: data.sha256,
        uploadedAt: data.uploadedAt,
      };

      setForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, uploaded],
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro no envio do arquivo.');
    } finally {
      setUploading(false);
    }
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
      const receipt = await submitFullApplication(
        selectedJob,
        { ...form, experiences: cleanExperiences },
        honeypot
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

  const toggleSkill = (skill: string) => {
    setForm((prev) => {
      const exists = prev.education.skills.includes(skill);
      const skills = exists
        ? prev.education.skills.filter((s) => s !== skill)
        : [...prev.education.skills, skill];
      return { ...prev, education: { ...prev.education, skills } };
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Banner da Vaga Selecionada + Progresso */}
      <div className="bg-zinc-900 text-white rounded-2xl p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-zinc-400">Vaga selecionada para inscrição</p>
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
              Etapa {step + 1} de {STEP_TITLES.length} · {STEP_TITLES[step]}
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

      {/* Erro da etapa */}
      {stepError && (
        <div
          role="alert"
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-900"
        >
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">Atenção antes de avançar</p>
            <p className="mt-0.5">{stepError}</p>
          </div>
        </div>
      )}

      {/* Conteúdo das Etapas */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-8 space-y-6">
        {/* ETAPA 1 — DADOS PESSOAIS E CONTATO */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                Etapa 1 — Dados Pessoais e Contato
              </h2>
              <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">
                <strong>Finalidade da coleta:</strong> utilizaremos estes dados apenas para
                identificação e contato caso sua candidatura avance no processo seletivo. Não
                solicitamos CPF, RG, dados bancários ou data de nascimento completa nesta etapa.
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
                  E-mail <span className="text-[#C8102E]">*</span>
                </label>
                <input
                  type="email"
                  value={form.personal.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, personal: { ...p.personal, email: e.target.value } }))
                  }
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                  Telefone celular com DDD <span className="text-[#C8102E]">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.personal.phone}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      personal: { ...p.personal, phone: formatPhoneBR(e.target.value) },
                    }))
                  }
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                  Número de WhatsApp (caso diferente)
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.personal.whatsapp}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      personal: { ...p.personal, whatsapp: formatPhoneBR(e.target.value) },
                    }))
                  }
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">CEP</label>
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
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                  Estado (UF) <span className="text-[#C8102E]">*</span>
                </label>
                <select
                  value={form.personal.state}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, personal: { ...p.personal, state: e.target.value } }))
                  }
                  className="w-full px-4 py-3.5 text-base bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                >
                  <option value="">Selecione o estado</option>
                  {BR_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                  Cidade <span className="text-[#C8102E]">*</span>
                </label>
                <input
                  type="text"
                  value={form.personal.city}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, personal: { ...p.personal, city: e.target.value } }))
                  }
                  placeholder="Ex.: Guarulhos"
                  className="w-full px-4 py-3.5 text-base border border-zinc-300 rounded-xl focus:outline-none focus:border-[#C8102E]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 space-y-4">
              <div className="flex items-start gap-3 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <input
                  id="deferAddress"
                  type="checkbox"
                  checked={form.personal.deferFullAddress}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      personal: { ...p.personal, deferFullAddress: e.target.checked },
                    }))
                  }
                  className="w-5 h-5 mt-0.5 accent-[#C8102E]"
                />
                <label htmlFor="deferAddress" className="text-sm text-zinc-700 leading-relaxed">
                  <strong>Informar apenas Cidade/Estado agora</strong> e completar endereço
                  detalhado apenas em etapa posterior, caso avance na seleção (recomendado para
                  privacidade).
                </label>
              </div>

              {!form.personal.deferFullAddress && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
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
                      className="w-full px-4 py-3 text-base border border-zinc-300 rounded-xl"
                    />
                  </div>
                  <div>
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
                      className="w-full px-4 py-3 text-base border border-zinc-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      Número da residência
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
                      className="w-full px-4 py-3 text-base border border-zinc-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={form.personal.complement}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          personal: { ...p.personal, complement: e.target.value },
                        }))
                      }
                      className="w-full px-4 py-3 text-base border border-zinc-300 rounded-xl"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                      Referência do endereço (opcional)
                    </label>
                    <input
                      type="text"
                      value={form.personal.reference}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          personal: { ...p.personal, reference: e.target.value },
                        }))
                      }
                      className="w-full px-4 py-3 text-base border border-zinc-300 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 2 — ESCOLARIDADE E QUALIFICAÇÕES */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                Etapa 2 — Escolaridade e Qualificações
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Informe sua formação e os conhecimentos operacionais que já possui.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                1. Qual seu nível de escolaridade? <span className="text-[#C8102E]">*</span>
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

            <OptionCards
              label="2. Possui algum curso profissionalizante?"
              required
              value={form.education.hasVocationalCourse}
              options={['Sim', 'Não']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  education: {
                    ...p.education,
                    hasVocationalCourse: val as 'Sim' | 'Não',
                  },
                }))
              }
            />

            {form.education.hasVocationalCourse === 'Sim' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                    3. Qual curso realizou? <span className="text-[#C8102E]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.education.vocationalCourseName}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        education: { ...p.education, vocationalCourseName: e.target.value },
                      }))
                    }
                    placeholder="Ex.: Operação de Empilhadeira / Logística / MOPP"
                    className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                  />
                </div>
                <OptionCards
                  label="4. Possui certificado de conclusão?"
                  value={form.education.hasCourseCertificate}
                  options={['Sim', 'Não', 'Em andamento']}
                  onChange={(val) =>
                    setForm((p) => ({
                      ...p,
                      education: {
                        ...p.education,
                        hasCourseCertificate: val as 'Sim' | 'Não' | 'Em andamento',
                      },
                    }))
                  }
                />
              </div>
            )}

            <OptionCards
              label="5. Possui experiência em transporte ou logística?"
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

            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                6. Quais atividades profissionais já realizou?
              </label>
              <textarea
                rows={3}
                value={form.education.performedActivitiesText}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    education: { ...p.education, performedActivitiesText: e.target.value },
                  }))
                }
                placeholder="Descreva resumidamente suas principais atividades em empregos ou tarefas anteriores..."
                className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-zinc-900 mb-2">
                7. Possui conhecimentos em: (múltiplas escolhas)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {LOGISTICS_SKILLS.map((skill) => {
                  const selected = form.education.skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={selected}
                      className={`px-4 py-3 text-sm font-medium rounded-xl border text-left transition-colors min-h-[46px] cursor-pointer ${
                        selected
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-400'
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 3 — HISTÓRICO PROFISSIONAL COMPLETO */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                SUAS EXPERIÊNCIAS PROFISSIONAIS
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Informe seus vínculos anteriores ou atuais para analisarmos sua trajetória.
              </p>
            </div>

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
              <div className="space-y-6">
                {form.experiences.map((exp, idx) => {
                  const duration = calculateWorkDuration(
                    exp.startDate,
                    exp.endDate,
                    exp.isCurrent
                  );
                  return (
                    <div
                      key={exp.id}
                      className="border border-zinc-300 rounded-2xl p-5 sm:p-6 space-y-5 bg-zinc-50/60"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                        <h3 className="font-display text-lg font-bold text-zinc-950">
                          Experiência Profissional {idx + 1}
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            1. Nome da empresa <span className="text-[#C8102E]">*</span>
                          </label>
                          <input
                            type="text"
                            value={exp.companyName}
                            onChange={(e) =>
                              updateExperience(idx, { companyName: e.target.value })
                            }
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            2. Cargo ocupado <span className="text-[#C8102E]">*</span>
                          </label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => updateExperience(idx, { role: e.target.value })}
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            3. Área de atuação
                          </label>
                          <input
                            type="text"
                            value={exp.area}
                            onChange={(e) => updateExperience(idx, { area: e.target.value })}
                            placeholder="Ex.: Transporte, Armazém, Varejo"
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div className="flex items-center pt-6">
                          <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-zinc-900 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exp.isCurrent}
                              onChange={(e) =>
                                updateExperience(idx, { isCurrent: e.target.checked })
                              }
                              className="w-5 h-5 accent-[#C8102E]"
                            />
                            6. Ainda trabalha nessa empresa?
                          </label>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            4. Data de admissão <span className="text-[#C8102E]">*</span>
                          </label>
                          <input
                            type="date"
                            value={exp.startDate}
                            onChange={(e) => updateExperience(idx, { startDate: e.target.value })}
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            5. Data de desligamento
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

                      {/* TEMPO DE TRABALHO CALCULADO AUTOMATICAMENTE */}
                      <div className="bg-white border border-zinc-200 rounded-xl p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          TEMPO DE TRABALHO (cálculo automático)
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-xs text-zinc-500 block">Anos completos</span>
                            <span className="font-mono-tabular text-base font-bold text-zinc-950">
                              {duration.valid ? duration.years : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500 block">Meses completos</span>
                            <span className="font-mono-tabular text-base font-bold text-zinc-950">
                              {duration.valid ? duration.months : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500 block">
                              Tempo total na empresa
                            </span>
                            <span className="font-semibold text-[#C8102E]">
                              {duration.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <OptionCards
                          label="7. Trabalhou com carteira assinada?"
                          value={exp.signedCard}
                          options={['Sim', 'Não']}
                          onChange={(val) =>
                            updateExperience(idx, { signedCard: val as 'Sim' | 'Não' })
                          }
                        />
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            8. Último salário mensal bruto (opcional)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={exp.lastSalary}
                            onChange={(e) =>
                              updateExperience(idx, {
                                lastSalary: formatCurrencyInputBR(e.target.value),
                              })
                            }
                            placeholder="R$ 0,00"
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            9. Recebia benefícios? Quais?
                          </label>
                          <input
                            type="text"
                            value={exp.benefits}
                            onChange={(e) => updateExperience(idx, { benefits: e.target.value })}
                            placeholder="Ex.: Vale-refeição, Vale-transporte, Plano de saúde"
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            10. Quais eram suas atividades diárias?
                          </label>
                          <textarea
                            rows={2}
                            value={exp.dailyActivities}
                            onChange={(e) =>
                              updateExperience(idx, { dailyActivities: e.target.value })
                            }
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            11. Quais responsabilidades possuía?
                          </label>
                          <textarea
                            rows={2}
                            value={exp.responsibilities}
                            onChange={(e) =>
                              updateExperience(idx, { responsibilities: e.target.value })
                            }
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            12. Trabalhou com veículos ou equipamentos?
                          </label>
                          <input
                            type="text"
                            value={exp.equipmentUsed}
                            onChange={(e) =>
                              updateExperience(idx, { equipmentUsed: e.target.value })
                            }
                            placeholder="Ex.: Caminhão Truck, Fiorino, Empilhadeira a gás, Coletor RF"
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            13. Motivo da saída (opcional)
                          </label>
                          <input
                            type="text"
                            value={exp.leaveReason}
                            onChange={(e) =>
                              updateExperience(idx, { leaveReason: e.target.value })
                            }
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                            14. Deseja acrescentar alguma informação profissional?
                          </label>
                          <input
                            type="text"
                            value={exp.notes}
                            onChange={(e) => updateExperience(idx, { notes: e.target.value })}
                            className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                          />
                        </div>
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
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3.5 text-sm font-bold text-[#C8102E] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />+ ADICIONAR OUTRA EXPERIÊNCIA
                </button>
              </div>
            )}

            <div className="pt-6 border-t border-zinc-200 space-y-5">
              <OptionCards
                label="Está empregado atualmente?"
                value={form.professionalSummary.currentlyEmployed}
                options={['Sim', 'Não']}
                onChange={(val) =>
                  setForm((p) => ({
                    ...p,
                    professionalSummary: {
                      ...p.professionalSummary,
                      currentlyEmployed: val as 'Sim' | 'Não',
                    },
                  }))
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    Tempo total de experiência em logística
                  </label>
                  <input
                    type="text"
                    value={form.professionalSummary.totalLogisticsExperience}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        professionalSummary: {
                          ...p.professionalSummary,
                          totalLogisticsExperience: e.target.value,
                        },
                      }))
                    }
                    placeholder="Ex.: 2 anos e 6 meses / Sem experiência"
                    className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    Pretensão salarial (opcional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.professionalSummary.salaryExpectation}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        professionalSummary: {
                          ...p.professionalSummary,
                          salaryExpectation: formatCurrencyInputBR(e.target.value),
                        },
                      }))
                    }
                    placeholder="R$ 0,00"
                    className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-800 mb-1.5">
                    Disponibilidade para iniciar <span className="text-[#C8102E]">*</span>
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
                      }))
                    }
                    className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                  >
                    <option value="">Selecione...</option>
                    <option value="Imediata">Imediata</option>
                    <option value="Em até 7 dias">Em até 7 dias</option>
                    <option value="Em até 15 dias">Em até 15 dias</option>
                    <option value="Aviso prévio (30 dias)">Aviso prévio (30 dias)</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-zinc-500">
                Nota de transparência: as informações de salário anterior e pretensão salarial não
                são utilizadas como único critério de remuneração ou eliminação.
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 4 — DISPONIBILIDADE PROFISSIONAL */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                Etapa 4 — Disponibilidade Profissional
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Informe sua disponibilidade operacional para horários, turnos e rotina da vaga.
              </p>
            </div>

            <OptionCards
              label="1. Possui disponibilidade para trabalhar em horários diferentes?"
              required
              value={form.availability.flexibleHours}
              options={['Sim', 'Não', 'A combinar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: { ...p.availability, flexibleHours: val as 'Sim' | 'Não' | 'A combinar' },
                }))
              }
            />

            <OptionCards
              label="2. Possui disponibilidade para trabalhar em turnos?"
              required
              value={form.availability.shiftWork}
              options={['Sim', 'Não', 'A combinar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: { ...p.availability, shiftWork: val as 'Sim' | 'Não' | 'A combinar' },
                }))
              }
            />

            <OptionCards
              label="3. Possui disponibilidade para trabalhar aos finais de semana, conforme a escala?"
              required
              value={form.availability.weekendsPerSchedule}
              options={['Sim', 'Não', 'A combinar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: {
                    ...p.availability,
                    weekendsPerSchedule: val as 'Sim' | 'Não' | 'A combinar',
                  },
                }))
              }
            />

            <OptionCards
              label="4. Possui disponibilidade para trabalhar na escala da vaga?"
              required
              value={form.availability.jobScheduleFit}
              options={['Sim', 'Não', 'A combinar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: { ...p.availability, jobScheduleFit: val as 'Sim' | 'Não' | 'A combinar' },
                }))
              }
            />

            <OptionCards
              label="5. Possui disponibilidade para realizar viagens?"
              required
              value={form.availability.travelAvailability}
              options={['Sim', 'Não', 'A combinar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: {
                    ...p.availability,
                    travelAvailability: val as 'Sim' | 'Não' | 'A combinar',
                  },
                }))
              }
            />

            <OptionCards
              label="6. Possui disponibilidade para eventuais pernoites fora da cidade?"
              required
              value={form.availability.overnightStayAvailability}
              options={['Sim', 'Não', 'A combinar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: {
                    ...p.availability,
                    overnightStayAvailability: val as 'Sim' | 'Não' | 'A combinar',
                  },
                }))
              }
            />

            <OptionCards
              label="7. Possui disponibilidade para participar de treinamentos?"
              required
              value={form.availability.trainingAvailability}
              options={['Sim', 'Não', 'A combinar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: {
                    ...p.availability,
                    trainingAvailability: val as 'Sim' | 'Não' | 'A combinar',
                  },
                }))
              }
            />

            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                8. Qual sua disponibilidade para início das atividades?{' '}
                <span className="text-[#C8102E]">*</span>
              </label>
              <input
                type="text"
                value={form.availability.startTimeline}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    availability: { ...p.availability, startTimeline: e.target.value },
                  }))
                }
                placeholder="Ex.: Imediata / A partir de segunda-feira"
                className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
              />
            </div>

            <OptionCards
              label="9. Possui meio de transporte próprio? (opcional)"
              value={form.availability.hasOwnTransport}
              options={['Sim', 'Não', 'Prefiro não informar']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  availability: {
                    ...p.availability,
                    hasOwnTransport: val as 'Sim' | 'Não' | 'Prefiro não informar',
                  },
                }))
              }
            />

            <div>
              <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                10. Deseja informar alguma limitação de disponibilidade de horários? (opcional)
              </label>
              <textarea
                rows={2}
                value={form.availability.scheduleLimitations}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    availability: { ...p.availability, scheduleLimitations: e.target.value },
                  }))
                }
                placeholder="Campo opcional para explicar restrições de horário (ex.: horário de curso)."
                className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
              />
            </div>
          </div>
        )}

        {/* ETAPA 5 — PERGUNTAS ESPECÍFICAS DA VAGA */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                Etapa 5 — Perguntas Específicas: {selectedJob.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Questões adaptadas exclusivamente aos requisitos desta função.
              </p>
            </div>

            {selectedJob.roleType === 'motorista_caminhao' && (
              <div className="space-y-5">
                <OptionCards
                  label="Qual categoria da sua CNH? (deverá ser compatível com o veículo utilizado e requisitos legais)"
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
                  label="Possui CNH válida?"
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
                  label="Possui experiência dirigindo caminhões?"
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
                      <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                        Se sim, por quanto tempo?
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
                        placeholder="Ex.: 4 anos"
                        className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                        Que tipos de caminhões já dirigiu?
                      </label>
                      <input
                        type="text"
                        value={form.roleSpecific.truckTypesDriven || ''}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            roleSpecific: { ...p.roleSpecific, truckTypesDriven: e.target.value },
                          }))
                        }
                        placeholder="Ex.: Toco, Truck, Carreta, Bitrem"
                        className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                      />
                    </div>
                  </div>
                )}
                <OptionCards
                  label="Possui experiência com viagens intermunicipais ou interestaduais?"
                  value={form.roleSpecific.intercityInterstateTravel || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        intercityInterstateTravel: v as 'Sim' | 'Não',
                      },
                    }))
                  }
                />
                <OptionCards
                  label="Tem disponibilidade para viagens?"
                  required
                  value={form.roleSpecific.truckTravelAvailability || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        truckTravelAvailability: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
                <OptionCards
                  label="Tem disponibilidade para pernoitar fora de casa quando a atividade exigir?"
                  required
                  value={form.roleSpecific.truckOvernightAvailability || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        truckOvernightAvailability: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
                <OptionCards
                  label="Tem disponibilidade para horários variáveis?"
                  value={form.roleSpecific.truckFlexibleHours || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        truckFlexibleHours: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                    Possui cursos de transporte relevantes à função? Quais?
                  </label>
                  <input
                    type="text"
                    value={form.roleSpecific.transportCourses || ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: { ...p.roleSpecific, transportCourses: e.target.value },
                      }))
                    }
                    placeholder="Ex.: MOPP, Direção Defensiva, Cargas Indivisíveis"
                    className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
              </div>
            )}

            {selectedJob.roleType === 'motorista_fiorino' && (
              <div className="space-y-5">
                <OptionCards
                  label="Possui CNH categoria B ou superior, válida?"
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
                  label="Já dirigiu veículos utilitários?"
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
                <OptionCards
                  label="Possui experiência com entregas?"
                  required
                  value={form.roleSpecific.deliveryExperience || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: { ...p.roleSpecific, deliveryExperience: v as 'Sim' | 'Não' },
                    }))
                  }
                />
                <OptionCards
                  label="Já trabalhou com rotas?"
                  value={form.roleSpecific.routeExperience || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: { ...p.roleSpecific, routeExperience: v as 'Sim' | 'Não' },
                    }))
                  }
                />
                <OptionCards
                  label="Possui disponibilidade para viagens?"
                  required
                  value={form.roleSpecific.fiorinoTravelAvailability || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        fiorinoTravelAvailability: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
                <OptionCards
                  label="Possui disponibilidade para eventuais pernoites?"
                  value={form.roleSpecific.fiorinoOvernightAvailability || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        fiorinoOvernightAvailability: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
                <OptionCards
                  label="Possui disponibilidade de horários?"
                  value={form.roleSpecific.fiorinoHoursAvailability || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        fiorinoHoursAvailability: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
              </div>
            )}

            {selectedJob.roleType === 'operador_empilhadeira' && (
              <div className="space-y-5">
                <OptionCards
                  label="Possui treinamento ou qualificação para operar empilhadeira?"
                  required
                  value={form.roleSpecific.forkliftTraining || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: { ...p.roleSpecific, forkliftTraining: v as 'Sim' | 'Não' },
                    }))
                  }
                />
                <OptionCards
                  label="Possui certificado?"
                  required
                  value={form.roleSpecific.forkliftCertificate || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: { ...p.roleSpecific, forkliftCertificate: v as 'Sim' | 'Não' },
                    }))
                  }
                />
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                    Qual tipo de equipamento já operou?
                  </label>
                  <input
                    type="text"
                    value={form.roleSpecific.forkliftEquipmentTypes || ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: { ...p.roleSpecific, forkliftEquipmentTypes: e.target.value },
                      }))
                    }
                    placeholder="Ex.: Empilhadeira elétrica retrátil, contrabalançada a gás"
                    className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <OptionCards
                  label="Possui experiência profissional nessa atividade?"
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
                <div>
                  <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                    Qual o tempo de experiência?
                  </label>
                  <input
                    type="text"
                    value={form.roleSpecific.forkliftExperienceDuration || ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        roleSpecific: {
                          ...p.roleSpecific,
                          forkliftExperienceDuration: e.target.value,
                        },
                      }))
                    }
                    placeholder="Ex.: 2 anos"
                    className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                  />
                </div>
                <OptionCards
                  label="Possui treinamento atualizado exigido pela legislação aplicável (ex.: NR-11)?"
                  required
                  value={form.roleSpecific.forkliftUpdatedLegalTraining || ''}
                  options={['Sim', 'Não', 'Em renovação']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        forkliftUpdatedLegalTraining: v as 'Sim' | 'Não' | 'Em renovação',
                      },
                    }))
                  }
                />
              </div>
            )}

            {selectedJob.roleType === 'auxiliar_logistica' && (
              <div className="space-y-5">
                <OptionCards
                  label="Possui experiência com separação de pedidos?"
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
                  label="Possui experiência com organização de estoque?"
                  required
                  value={form.roleSpecific.stockOrganizationExp || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        stockOrganizationExp: v as 'Sim' | 'Não',
                      },
                    }))
                  }
                />
                <OptionCards
                  label="Já trabalhou em galpões ou centros de distribuição?"
                  value={form.roleSpecific.warehouseExp || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: { ...p.roleSpecific, warehouseExp: v as 'Sim' | 'Não' },
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
                <OptionCards
                  label="Tem disponibilidade para atividades operacionais com movimentação manual de mercadorias, respeitados os limites legais e procedimentos de segurança?"
                  required
                  value={form.roleSpecific.manualHandlingSafeLimits || ''}
                  options={['Sim', 'Não', 'Com orientação/adaptação']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        manualHandlingSafeLimits: v as 'Sim' | 'Não' | 'Com orientação/adaptação',
                      },
                    }))
                  }
                />
              </div>
            )}

            {selectedJob.roleType === 'conferente_pacotes' && (
              <div className="space-y-5">
                <OptionCards
                  label="Já trabalhou com conferência de produtos?"
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
                  label="Tem experiência com identificação de encomendas?"
                  required
                  value={form.roleSpecific.parcelIdentificationExp || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        parcelIdentificationExp: v as 'Sim' | 'Não',
                      },
                    }))
                  }
                />
                <OptionCards
                  label="Já utilizou leitor de código de barras?"
                  required
                  value={form.roleSpecific.barcodeScannerExp || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: { ...p.roleSpecific, barcodeScannerExp: v as 'Sim' | 'Não' },
                    }))
                  }
                />
                <OptionCards
                  label="Tem experiência com controle de estoque?"
                  value={form.roleSpecific.inventoryControlExp || ''}
                  options={['Sim', 'Não']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: { ...p.roleSpecific, inventoryControlExp: v as 'Sim' | 'Não' },
                    }))
                  }
                />
                <OptionCards
                  label="Possui disponibilidade para escala 6x1?"
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
                <OptionCards
                  label="Tem disponibilidade para atividades operacionais relacionadas à vaga?"
                  value={form.roleSpecific.operationalTasksFit || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        operationalTasksFit: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
              </div>
            )}

            {selectedJob.roleType === 'outro' && (
              <div className="space-y-4">
                <OptionCards
                  label="Possui experiência prévia nas atividades descritas para esta vaga?"
                  value={form.roleSpecific.operationalTasksFit || ''}
                  options={['Sim', 'Não', 'A combinar']}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      roleSpecific: {
                        ...p.roleSpecific,
                        operationalTasksFit: v as 'Sim' | 'Não' | 'A combinar',
                      },
                    }))
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* ETAPA 6 — CONDIÇÕES E SEGURANÇA DO TRABALHO */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                Etapa 6 — Condições e Segurança do Trabalho
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Apresentamos as atividades essenciais da função considerando treinamento, limites
                legais, ergonomia e recursos de acessibilidade.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Atividades essenciais previstas para {selectedJob.title}
              </h3>
              <ul className="space-y-1.5 text-sm text-zinc-700">
                {selectedJob.activities.map((act, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#C8102E] font-bold">•</span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-200">
                Caso haja convocação para admissão, qualquer exame de aptidão ocupacional exigido
                por lei será realizado apenas na etapa apropriada por profissional médico habilitado.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={form.safetyAndAccessibility.confirmedEssentialTasks}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      safetyAndAccessibility: {
                        ...p.safetyAndAccessibility,
                        confirmedEssentialTasks: e.target.checked,
                      },
                    }))
                  }
                  className="w-5 h-5 mt-0.5 accent-[#C8102E]"
                />
                <span className="text-sm text-zinc-800">
                  Estou ciente das atividades essenciais da vaga e tenho disponibilidade para
                  realizá-las após receber treinamento e orientações operacionais.{' '}
                  <span className="text-[#C8102E]">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 p-4 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={form.safetyAndAccessibility.awareSafetyAndTraining}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      safetyAndAccessibility: {
                        ...p.safetyAndAccessibility,
                        awareSafetyAndTraining: e.target.checked,
                      },
                    }))
                  }
                  className="w-5 h-5 mt-0.5 accent-[#C8102E]"
                />
                <span className="text-sm text-zinc-800">
                  Comprometo-me a seguir normas de segurança do trabalho, trânsito, ergonomia e
                  uso de equipamentos de proteção aplicáveis à função.{' '}
                  <span className="text-[#C8102E]">*</span>
                </span>
              </label>
            </div>

            <OptionCards
              label="Deseja solicitar alguma adaptação ou recurso de acessibilidade para participar das etapas do processo seletivo? (Não é necessário informar diagnósticos)"
              value={form.safetyAndAccessibility.needsProcessAccommodation}
              options={['Não', 'Sim']}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  safetyAndAccessibility: {
                    ...p.safetyAndAccessibility,
                    needsProcessAccommodation: val as 'Não' | 'Sim',
                  },
                }))
              }
            />

            {form.safetyAndAccessibility.needsProcessAccommodation === 'Sim' && (
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                  Descreva qual adaptação ajudaria na sua participação (ex.: intérprete de Libras,
                  local acessível, horário específico):
                </label>
                <textarea
                  rows={2}
                  value={form.safetyAndAccessibility.accommodationDetails}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      safetyAndAccessibility: {
                        ...p.safetyAndAccessibility,
                        accommodationDetails: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-4 py-3 text-sm border border-zinc-300 rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        {/* ETAPA 7 — CURRÍCULO, FOTOS E ANEXOS */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                Etapa 7 — Currículo e Anexos de Qualificação
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Envie seu currículo ou comprovantes de cursos e treinamentos relacionados à vaga
                (opcional, limite de 5 MB por arquivo, até 6 arquivos).
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-600 leading-relaxed">
              <strong>Armazenamento privado e minimização:</strong> Não é necessário enviar
              fotografia do rosto, RG ou CPF nesta etapa. Documentos pessoais para contratação
              serão solicitados apenas em fase posterior de admissão.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-1.5">
                  Tipo de documento para envio
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(e.target.value as UploadedAttachment['category'])
                  }
                  className="w-full px-4 py-3 text-sm bg-white border border-zinc-300 rounded-xl"
                >
                  <option value="curriculo">Currículo (PDF, DOCX, JPG ou PNG)</option>
                  <option value="certificado">Certificado profissional (PDF, JPG ou PNG)</option>
                  <option value="curso">Comprovante de curso/treinamento (PDF, JPG ou PNG)</option>
                  <option value="qualificacao">
                    Documento de qualificação da vaga (PDF, JPG ou PNG)
                  </option>
                </select>
              </div>

              <div>
                <label className="flex items-center justify-center gap-2 w-full px-5 py-3 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors min-h-[46px]">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  {uploading ? 'Validando e enviando...' : 'Selecionar arquivo'}
                  <input
                    type="file"
                    className="sr-only"
                    disabled={uploading}
                    accept={
                      uploadCategory === 'curriculo'
                        ? '.pdf,.docx,.jpg,.jpeg,.png'
                        : '.pdf,.jpg,.jpeg,.png'
                    }
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            {uploadError && (
              <p role="alert" className="text-sm text-red-700 font-medium">
                {uploadError}
              </p>
            )}

            {form.attachments.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-zinc-900">Arquivos anexados</h3>
                {form.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-[#C8102E] shrink-0" aria-hidden="true" />
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
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          attachments: p.attachments.filter((a) => a.id !== att.id),
                        }))
                      }
                      className="text-xs font-semibold text-red-700 hover:text-red-900 px-2 py-1 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ETAPA 8 — CONFERÊNCIA DOS DADOS */}
        {step === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-950">
                Etapa 8 — Conferência dos Dados e Privacidade
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Revise todas as informações antes de finalizar. Você pode voltar e editar qualquer
                seção.
              </p>
            </div>

            {/* Resumo */}
            <div className="space-y-4 text-sm">
              <div className="border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">Vaga escolhida e benefícios</p>
                  <p className="font-bold text-zinc-950">
                    {selectedJob.title} — {selectedJob.salaryDisplay}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {selectedJob.benefits.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-zinc-900">Dados de contato</p>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </div>
                <p className="text-zinc-700">
                  {form.personal.fullName} · {form.personal.email} · {form.personal.phone}
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  {form.personal.city}/{form.personal.state}{' '}
                  {form.personal.cep ? `· CEP ${form.personal.cep}` : ''}
                </p>
              </div>

              <div className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-zinc-900">Escolaridade e qualificações</p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </div>
                <p className="text-zinc-700">{form.education.educationLevel}</p>
                {form.education.skills.length > 0 && (
                  <p className="text-xs text-zinc-600 mt-1">
                    Conhecimentos: {form.education.skills.join(', ')}
                  </p>
                )}
              </div>

              <div className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-zinc-900">Histórico profissional</p>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </div>
                {form.professionalSummary.hasWorkedBefore === 'Sim' ? (
                  <ul className="space-y-1.5 text-zinc-700">
                    {form.experiences.map((exp) => (
                      <li key={exp.id}>
                        <strong>{exp.role}</strong> em {exp.companyName} — {exp.durationLabel}
                        {exp.lastSalary ? ` (último salário: ${exp.lastSalary})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-700">Buscando primeiro emprego.</p>
                )}
              </div>

              <div className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-zinc-900">Disponibilidade e anexos</p>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </div>
                <p className="text-zinc-700">
                  Início: {form.availability.startTimeline} · Viagens:{' '}
                  {form.availability.travelAvailability} · Pernoite:{' '}
                  {form.availability.overnightStayAvailability}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Anexos enviados: {form.attachments.length} arquivo(s)
                </p>
              </div>
            </div>

            {/* Bloco LGPD */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-3 text-xs text-zinc-700 leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm">
                <ShieldCheck className="w-4 h-4 text-[#C8102E]" aria-hidden="true" />
                Aviso de Privacidade (LGPD)
              </div>
              <p>
                <strong>Controlador:</strong> {settings.legalName} ({settings.cnpj}).{' '}
                <strong>Finalidade:</strong> análise e condução do processo seletivo para a vaga
                selecionada. <strong>Retenção:</strong> até {settings.retentionDays} dias após o
                término do processo. <strong>Direitos e contato:</strong> solicite acesso, correção
                ou exclusão pelo canal {settings.dpoEmail}.{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/privacidade')}
                  className="underline font-semibold text-zinc-950 cursor-pointer"
                >
                  Ler Política de Privacidade completa
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
                  onChange={(e) =>
                    setForm((p) => ({ ...p, lgpdConsent: e.target.checked }))
                  }
                  className="w-5 h-5 mt-0.5 accent-[#C8102E]"
                />
                <span className="text-sm text-zinc-900">
                  Declaro ciência das informações da Política de Privacidade e do tratamento dos
                  meus dados para este processo seletivo. <span className="text-[#C8102E]">*</span>
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
                  (Opcional) Autorizo a manutenção do meu cadastro para futuras vagas compatíveis
                  com meu perfil durante o prazo de retenção informado.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navegação Inferior do Formulário */}
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
              Próximo
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
              {submitting ? 'Registrando candidatura...' : 'FINALIZAR MINHA CANDIDATURA'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
