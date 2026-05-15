-- Constraints and supporting indexes for hot paths and data integrity.
-- The migration runner in server/index.js splits on `;` + newline so each
-- statement runs separately (required: CREATE INDEX CONCURRENTLY and
-- DO blocks both cannot mix with other statements in a single query).

-- Foreign key from automation_logs -> automations. NOT VALID so existing
-- orphan rows (if any) don't block the migration; run
-- `ALTER TABLE automation_logs VALIDATE CONSTRAINT automation_logs_automation_id_fkey;`
-- manually after cleaning them up. Wrapped in DO block for idempotency.
-- NOTE: kept on one logical statement (no `;\n` inside) so the simple
-- splitter in server/index.js migrate() doesn't break the block apart.
DO $$ BEGIN ALTER TABLE automation_logs ADD CONSTRAINT automation_logs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backs the `ON CONFLICT DO NOTHING` in the gmail-watcher INSERT (currently a
-- no-op without a unique constraint). Partial unique on
-- (automation_id, messageId) for via = 'gmail-watcher' rows only.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS automation_logs_gmail_dedupe_idx
  ON automation_logs (automation_id, (trigger_payload->>'messageId'))
  WHERE via = 'gmail-watcher';

-- Supports the pipeline mindmap-config lookup that filters by active +
-- action_integration_type and orders by updated_at DESC.
CREATE INDEX CONCURRENTLY IF NOT EXISTS automations_active_action_integration_updated_idx
  ON automations (active, action_integration_type, updated_at DESC);
