-- Validate the automation_logs -> automations FK added NOT VALID in 002.
-- Postgres won't VALIDATE a constraint while orphan rows exist, so first
-- DELETE any automation_logs rows whose automation_id no longer points at
-- an automations row (they reference deleted automations and are useless).
-- Both statements are idempotent / safe to re-run: the DELETE is a no-op
-- once cleaned, and VALIDATE CONSTRAINT is a no-op once already validated.
-- The DO block stays on one logical line so the simple `;\n` splitter in
-- server/index.js migrate() doesn't split it apart.

DELETE FROM automation_logs WHERE automation_id IS NOT NULL AND automation_id NOT IN (SELECT id FROM automations);

DO $$ BEGIN ALTER TABLE automation_logs VALIDATE CONSTRAINT automation_logs_automation_id_fkey; EXCEPTION WHEN undefined_object THEN NULL; END $$;
