-- Armazenamento versionado em chunks do aplicativo Android (APK) no D1
-- Sem credenciais, senhas ou hashes neste arquivo versionado.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_releases (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/vnd.android.package-archive',
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  release_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'archived')),
  download_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by_username TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_releases_status_published
  ON app_releases(status, published_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS app_release_chunks (
  release_id TEXT NOT NULL REFERENCES app_releases(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  PRIMARY KEY (release_id, chunk_index)
);
