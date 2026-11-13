-- Migration incremental: integridade atômica para vínculo de anexos em concorrência.
-- Evita corrida TOCTOU garantindo rollback completo do batch quando um anexo
-- já estiver vinculado ou pertencer a outro tenant.

CREATE TRIGGER IF NOT EXISTS trg_attachments_lock_once
BEFORE UPDATE OF application_id ON attachments
FOR EACH ROW
WHEN NEW.application_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN OLD.application_id IS NOT NULL THEN
      RAISE(ABORT, 'ATTACHMENT_ALREADY_BOUND')
    WHEN NOT EXISTS (
      SELECT 1 FROM applications
      WHERE id = NEW.application_id AND tenant_id = OLD.tenant_id
    ) THEN
      RAISE(ABORT, 'ATTACHMENT_TENANT_MISMATCH')
  END;
END;
