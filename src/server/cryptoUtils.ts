const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_PREFIX = 'pbkdf2_sha256';

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPasswordPBKDF2(
  password: string,
  providedSalt?: Uint8Array
): Promise<string> {
  const salt = providedSalt ? new Uint8Array(providedSalt) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashBytes = new Uint8Array(derivedBits);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hashBytes)}`;
}

export async function verifyPasswordPBKDF2(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const [algo, iterStr, saltHex, expectedHex] = parts;
  if (algo !== PBKDF2_PREFIX) return false;
  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) {
    return false;
  }
  const salt = hexToBytes(saltHex);
  const expectedBytes = hexToBytes(expectedHex);
  if (!salt || !expectedBytes) return false;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    expectedBytes.length * 8
  );
  return constantTimeEqual(new Uint8Array(derivedBits), expectedBytes);
}

export function generateRandomTokenHex(byteLength = 32): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function escapeCsvCell(raw: unknown): string {
  const str = String(raw ?? '');
  const normalized = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmedStart = normalized.replace(/^[\s\uFEFF\xA0]+/, '');
  const needsFormulaGuard =
    /^[=+\-@\t\r]/.test(normalized) || /^[=+\-@\t\r]/.test(trimmedStart);
  const safe = needsFormulaGuard ? `'${normalized}` : normalized;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Converte uma data YYYY-MM-DD do fuso America/Sao_Paulo (UTC-03:00 fixo)
 * em limites UTC ISO-8601 inclusivos para filtro em coluna created_at.
 */
export function saoPauloDateToUtcBounds(dateStr: string): { startUtc: string; endUtc: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const start = new Date(`${dateStr}T00:00:00.000-03:00`);
  const end = new Date(`${dateStr}T23:59:59.999-03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
  };
}

export function getTodaySaoPauloDateStr(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
