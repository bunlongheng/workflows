import { describe, expect, it } from 'vitest';
import { getColor, getColorHex, getIcon } from '../../lib/integration-style';

// The complete icon lookup table mirrored from lib/integration-style.ts.
// Keeping this in the test asserts every key resolves to its expected path.
const EXPECTED_ICONS: Record<string, string> = {
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

const EXPECTED_COLORS: Record<string, string> = {
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

const EXPECTED_HEX: Record<string, string> = {
  youtube: '#dc2626',
  gmail: '#ef4444',
  stickies_api: '#eab308',
  hue: '#f97316',
  diagram: '#14b8a6',
  mindmap: '#a855f7',
  slack: '#9333ea',
  github: '#374151',
  discord: '#6366f1',
  'google-calendar': '#3b82f6',
  'ai-processing': '#7c3aed',
  'local-apps': '#6b7280',
  'claude-dashboard': '#f59e0b',
  spotify: '#16a34a',
};

describe('getIcon', () => {
  it('returns the configured icon path for known ids', () => {
    expect(getIcon('youtube')).toBe('/icons/youtube.svg');
    expect(getIcon('slack')).toBe('/icons/slack.svg');
    expect(getIcon('hue')).toBe('/icons/hue.svg');
  });

  it('resolves every entry in the icon table', () => {
    for (const [type, expected] of Object.entries(EXPECTED_ICONS)) {
      expect(getIcon(type)).toBe(expected);
    }
  });

  it('maps stickies_api -> /icons/stickies.svg (DB type vs icon filename)', () => {
    expect(getIcon('stickies_api')).toBe('/icons/stickies.svg');
  });

  it('falls back to ai-processing.svg for unknown ids', () => {
    expect(getIcon('totally-made-up')).toBe('/icons/ai-processing.svg');
    expect(getIcon('')).toBe('/icons/ai-processing.svg');
  });

  it('is case-sensitive: uppercase keys miss and fall back', () => {
    expect(getIcon('YouTube')).toBe('/icons/ai-processing.svg');
    expect(getIcon('GMAIL')).toBe('/icons/ai-processing.svg');
  });
});

describe('getColor', () => {
  it('returns the configured Tailwind color for known ids', () => {
    expect(getColor('youtube')).toBe('bg-red-600');
    expect(getColor('stickies_api')).toBe('bg-yellow-500');
    expect(getColor('github')).toBe('bg-gray-700');
  });

  it('resolves every entry in the color table', () => {
    for (const [type, expected] of Object.entries(EXPECTED_COLORS)) {
      expect(getColor(type)).toBe(expected);
    }
  });

  it('falls back to bg-gray-600 for unknown ids', () => {
    expect(getColor('totally-made-up')).toBe('bg-gray-600');
    expect(getColor('')).toBe('bg-gray-600');
  });
});

describe('getColorHex', () => {
  it('resolves known id -> hex via the color map', () => {
    expect(getColorHex('youtube')).toBe('#dc2626');
    expect(getColorHex('slack')).toBe('#9333ea');
  });

  it('resolves every known id through color -> hex', () => {
    for (const [type, expected] of Object.entries(EXPECTED_HEX)) {
      expect(getColorHex(type)).toBe(expected);
    }
  });

  it('falls back to the gray-600 hex for unknown ids', () => {
    expect(getColorHex('nope')).toBe('#4b5563');
    expect(getColorHex('')).toBe('#4b5563');
  });

  it('fallback color bg-gray-600 maps to its hex (chained fallback resolves)', () => {
    // Unknown type -> getColor returns bg-gray-600 -> COLOR_HEX has that key.
    expect(getColorHex('unknown-type')).toBe('#4b5563');
  });
});
