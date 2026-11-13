-- Schema inicial do Portal de Recrutamento Multiusuário — JSL Empresa
-- Sem credenciais, senhas ou hashes de usuários neste arquivo versionado.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  tenant_id INTEGER NOT NULL CHECK (tenant_id IN (1, 2)),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL CHECK (tenant_id IN (1, 2)),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL CHECK (tenant_id IN (1, 2)),
  channel_path TEXT NOT NULL CHECK (channel_path IN ('/vagas1', '/vagas2')),
  protocol TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL,
  job_id TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_role_type TEXT NOT NULL,
  job_salary_display TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Recebida',
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  candidate_phone TEXT NOT NULL,
  candidate_whatsapp TEXT NOT NULL DEFAULT '',
  candidate_city TEXT NOT NULL,
  candidate_state TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  internal_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_applications_tenant_created ON applications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_tenant_status ON applications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_tenant_job ON applications(tenant_id, job_id);

CREATE TABLE IF NOT EXISTS application_experiences (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL CHECK (tenant_id IN (1, 2)),
  company_name TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  duration_label TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiences_app_tenant ON application_experiences(application_id, tenant_id);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL CHECK (tenant_id IN (1, 2)),
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('curriculo', 'certificado', 'curso', 'qualificacao')),
  sha256 TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_app_tenant ON attachments(application_id, tenant_id);

CREATE TABLE IF NOT EXISTS attachment_chunks (
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  PRIMARY KEY (attachment_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS status_history (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL CHECK (tenant_id IN (1, 2)),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  changed_by_username TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_status_history_app_tenant ON status_history(application_id, tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER CHECK (tenant_id IN (1, 2)),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL CHECK (tenant_id IN (1, 2)),
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
