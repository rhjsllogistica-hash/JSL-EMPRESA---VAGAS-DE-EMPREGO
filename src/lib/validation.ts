import { z } from 'zod';

export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCepBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatCurrencyInputBR(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function calculateWorkDuration(
  startDateStr: string,
  endDateStr: string,
  isCurrent: boolean
): { years: number; months: number; label: string; valid: boolean } {
  if (!startDateStr) {
    return { years: 0, months: 0, label: 'Informe a data de admissão', valid: false };
  }

  const start = new Date(`${startDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { years: 0, months: 0, label: 'Data de admissão inválida', valid: false };
  }

  const today = new Date();
  const end = isCurrent
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
    : endDateStr
      ? new Date(`${endDateStr}T00:00:00`)
      : null;

  if (!end || Number.isNaN(end.getTime())) {
    return { years: 0, months: 0, label: 'Informe a data de desligamento', valid: false };
  }

  if (end < start) {
    return {
      years: 0,
      months: 0,
      label: 'A data de desligamento não pode ser anterior à admissão',
      valid: false,
    };
  }

  let totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    totalMonths = Math.max(0, totalMonths - 1);
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  if (parts.length === 0) parts.push('Menos de 1 mês');

  return {
    years,
    months,
    label: parts.join(' e '),
    valid: true,
  };
}

export const personalSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe seu nome completo (mínimo 3 caracteres).').max(140),
  email: z.string().trim().email('Informe um e-mail válido.').max(160),
  phone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, '').length >= 10, 'Informe telefone celular com DDD válido.'),
  whatsapp: z.string().trim().max(30).optional().default(''),
  cep: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || v.replace(/\D/g, '').length === 8,
      'CEP deve conter 8 dígitos ou ficar em branco.'
    ),
  state: z.string().trim().min(2, 'Selecione o Estado (UF).').max(2),
  city: z.string().trim().min(2, 'Informe sua cidade.').max(100),
  neighborhood: z.string().trim().max(100).optional().default(''),
  street: z.string().trim().max(160).optional().default(''),
  number: z.string().trim().max(20).optional().default(''),
  complement: z.string().trim().max(80).optional().default(''),
  reference: z.string().trim().max(160).optional().default(''),
  deferFullAddress: z.boolean().default(true),
});

export const educationSchema = z.object({
  educationLevel: z.string().trim().min(1, 'Selecione seu nível de escolaridade.'),
  hasVocationalCourse: z.enum(['Sim', 'Não'], {
    message: 'Informe se possui curso profissionalizante.',
  }),
  vocationalCourseName: z.string().trim().max(160).optional().default(''),
  hasCourseCertificate: z.enum(['Sim', 'Não', 'Em andamento', '']).optional().default(''),
  hasLogisticsExperience: z.enum(['Sim', 'Não'], {
    message: 'Informe se possui experiência em transporte ou logística.',
  }),
  performedActivitiesText: z.string().trim().max(1000).optional().default(''),
  skills: z.array(z.string().max(80)).max(20).default([]),
});

export const workExperienceSchema = z.object({
  id: z.string().min(1).max(128),
  companyName: z.string().trim().min(2, 'Informe o nome da empresa.').max(160),
  role: z.string().trim().min(2, 'Informe o cargo ocupado.').max(140),
  area: z.string().trim().max(120).optional().default(''),
  startDate: z.string().trim().min(4, 'Informe a data de admissão.').max(20),
  endDate: z.string().trim().max(20).optional().default(''),
  isCurrent: z.boolean(),
  signedCard: z.enum(['Sim', 'Não', '']).optional().default(''),
  lastSalary: z.string().trim().max(60).optional().default(''),
  benefits: z.string().trim().max(300).optional().default(''),
  dailyActivities: z.string().trim().max(1000).optional().default(''),
  responsibilities: z.string().trim().max(1000).optional().default(''),
  equipmentUsed: z.string().trim().max(400).optional().default(''),
  leaveReason: z.string().trim().max(400).optional().default(''),
  notes: z.string().trim().max(600).optional().default(''),
  calculatedYears: z.number().min(0).max(80),
  calculatedMonths: z.number().min(0).max(11),
  durationLabel: z.string().max(100),
});

export const availabilitySchema = z.object({
  flexibleHours: z.enum(['Sim', 'Não', 'A combinar'], { message: 'Campo obrigatório.' }),
  shiftWork: z.enum(['Sim', 'Não', 'A combinar'], { message: 'Campo obrigatório.' }),
  weekendsPerSchedule: z.enum(['Sim', 'Não', 'A combinar'], { message: 'Campo obrigatório.' }),
  jobScheduleFit: z.enum(['Sim', 'Não', 'A combinar'], { message: 'Campo obrigatório.' }),
  travelAvailability: z.enum(['Sim', 'Não', 'A combinar'], { message: 'Campo obrigatório.' }),
  overnightStayAvailability: z.enum(['Sim', 'Não', 'A combinar'], { message: 'Campo obrigatório.' }),
  trainingAvailability: z.enum(['Sim', 'Não', 'A combinar'], { message: 'Campo obrigatório.' }),
  startTimeline: z.string().trim().min(1, 'Informe sua disponibilidade para início.').max(120),
  hasOwnTransport: z
    .enum(['Sim', 'Não', 'Prefiro não informar', ''])
    .optional()
    .default(''),
  scheduleLimitations: z.string().trim().max(500).optional().default(''),
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(140),
  email: z.string().trim().email('Informe um e-mail válido.').max(160),
  phone: z.string().trim().max(40).optional().default(''),
  subject: z.string().trim().min(3, 'Informe o assunto.').max(160),
  message: z.string().trim().min(10, 'Escreva sua mensagem (mínimo 10 caracteres).').max(2000),
});

export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const EDUCATION_LEVELS = [
  'Ensino fundamental incompleto',
  'Ensino fundamental completo',
  'Ensino médio incompleto',
  'Ensino médio completo',
  'Ensino técnico',
  'Ensino superior incompleto',
  'Ensino superior completo',
  'Pós-graduação',
];

export const LOGISTICS_SKILLS = [
  'Separação de pedidos',
  'Conferência de mercadorias',
  'Organização de estoque',
  'Carga e descarga',
  'Entregas',
  'Transporte rodoviário',
  'Operação de empilhadeira',
  'Sistemas de estoque',
  'Outras atividades',
];
