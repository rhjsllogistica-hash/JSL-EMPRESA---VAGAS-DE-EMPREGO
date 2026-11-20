import { ChannelPrefix } from './channelRouting.ts';
import { ApplicationFormState } from '../types/recruitment.ts';

export interface SavedApplicationDraft {
  jobId: string;
  step: number;
  idempotencyKey: string;
  form: ApplicationFormState;
  updatedAt: string;
}

function getDraftStorageKey(channelPrefix: ChannelPrefix | null): string {
  const channelSegment = channelPrefix ? channelPrefix.slice(1) : 'principal';
  return `jsl_draft_v3_${channelSegment}`;
}

export function hasDraftMeaningfulProgress(draft: SavedApplicationDraft | null): boolean {
  if (!draft) return false;
  if (draft.step > 0) return true;
  const p = draft.form?.personal;
  if (!p) return false;
  return Boolean(
    p.fullName?.trim() ||
      p.email?.trim() ||
      p.phone?.trim() ||
      p.cep?.trim() ||
      p.city?.trim() ||
      p.gender ||
      p.hasChildren
  );
}

export function loadApplicationDraft(
  channelPrefix: ChannelPrefix | null
): SavedApplicationDraft | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(channelPrefix));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedApplicationDraft>;
    if (!parsed || typeof parsed.jobId !== 'string' || !parsed.form) return null;
    return {
      jobId: parsed.jobId,
      step: typeof parsed.step === 'number' && parsed.step >= 0 ? parsed.step : 0,
      idempotencyKey:
        typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey
          ? parsed.idempotencyKey
          : crypto.randomUUID().replace(/-/g, ''),
      form: parsed.form,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveApplicationDraft(
  channelPrefix: ChannelPrefix | null,
  draft: SavedApplicationDraft
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(getDraftStorageKey(channelPrefix), JSON.stringify(draft));
  } catch {
    // ignora erro de quota no navegador
  }
}

export function clearApplicationDraft(channelPrefix: ChannelPrefix | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(channelPrefix));
  } catch {
    // ignora falha de limpeza
  }
}
