// Shared integration icon + color helpers for trigger/action integration types.
// Used by automations list/detail pages.

const ICONS: Record<string, string> = {
  youtube: '/icons/youtube.svg',
  stickies_api: '/icons/stickies.svg',
  hue: '/icons/hue.svg',
  diagram: '/icons/diagram.svg',
  mindmap: '/icons/mindmap.svg',
  gmail: '/icons/gmail.svg',
  slack: '/icons/slack.svg',
  github: '/icons/github.svg',
  discord: '/icons/discord.svg',
  'google-calendar': '/icons/google-calendar.svg',
  'ai-processing': '/icons/ai-processing.svg',
  'local-apps': '/icons/local-apps.svg',
  'claude-dashboard': '/icons/claude-dashboard.svg',
  spotify: '/icons/spotify.svg',
};

const COLORS: Record<string, string> = {
  youtube: 'bg-red-600',
  stickies_api: 'bg-yellow-500',
  hue: 'bg-orange-500',
  diagram: 'bg-teal-500',
  mindmap: 'bg-purple-500',
  gmail: 'bg-red-500',
  slack: 'bg-purple-600',
  github: 'bg-gray-700',
  discord: 'bg-indigo-500',
  'google-calendar': 'bg-blue-500',
  'ai-processing': 'bg-violet-600',
  'local-apps': 'bg-gray-500',
  'claude-dashboard': 'bg-amber-500',
  spotify: 'bg-green-600',
};

// Tailwind bg-* class -> hex for cases where a raw color is needed (e.g. inline style).
const COLOR_HEX: Record<string, string> = {
  'bg-red-600': '#dc2626',
  'bg-red-500': '#ef4444',
  'bg-yellow-500': '#eab308',
  'bg-orange-500': '#f97316',
  'bg-teal-500': '#14b8a6',
  'bg-purple-500': '#a855f7',
  'bg-purple-600': '#9333ea',
  'bg-gray-500': '#6b7280',
  'bg-gray-600': '#4b5563',
  'bg-gray-700': '#374151',
  'bg-indigo-500': '#6366f1',
  'bg-blue-500': '#3b82f6',
  'bg-violet-600': '#7c3aed',
  'bg-amber-500': '#f59e0b',
  'bg-green-600': '#16a34a',
};

export function getIcon(type: string): string {
  return ICONS[type] || '/icons/ai-processing.svg';
}

export function getColor(type: string): string {
  return COLORS[type] || 'bg-gray-600';
}

export function getColorHex(type: string): string {
  return COLOR_HEX[getColor(type)] || '#4b5563';
}
