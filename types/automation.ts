// Superset Automation row shape used across the automations UI.
// Pages may use a subset of these fields — the detail page adds `condition`/`updated_at`,
// while the list view + panel add run-stat columns.
export interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  active: boolean;
  action_config: Record<string, string>;
  condition?: Record<string, string>;
  created_at: string;
  updated_at?: string;
  trigger_integration_name: string;
  trigger_integration_type: string;
  action_integration_name: string;
  action_integration_type: string;
  total_runs?: string;
  success_runs?: string;
  last_run?: string | null;
}
