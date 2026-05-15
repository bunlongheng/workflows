-- Indexes that back hot paths in the VPS server.
-- Use CONCURRENTLY so the migration does not block writes during deploy.
-- IF NOT EXISTS makes the migration idempotent / safe to re-run.

-- /api/automations/list aggregate joins on automation_id + sorts by triggered_at desc.
CREATE INDEX CONCURRENTLY IF NOT EXISTS automation_logs_automation_triggered_at_idx
  ON automation_logs (automation_id, triggered_at DESC);

-- Watcher queries: active automations filtered by trigger integration type.
CREATE INDEX CONCURRENTLY IF NOT EXISTS automations_active_trigger_integration_idx
  ON automations (active, trigger_integration_type);

-- Watcher / log routes: matching active automations by trigger_type.
CREATE INDEX CONCURRENTLY IF NOT EXISTS automations_trigger_type_active_idx
  ON automations (trigger_type, active);

-- Lookups by integration `type` (used when creating automations, refreshing UI).
CREATE INDEX CONCURRENTLY IF NOT EXISTS integrations_type_idx
  ON integrations (type);
