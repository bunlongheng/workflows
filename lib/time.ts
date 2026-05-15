// Format an ISO date string as a short relative time (e.g. "5m ago", "3h ago").
// Superset of the variants in app/automations/page.tsx, app/automations/[id]/page.tsx,
// and components/AutomationsPanel.tsx — the detail page version also handles "just now".
export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
