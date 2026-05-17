import { describe, expect, it } from 'vitest';
import { getColor, getColorHex, getIcon } from '../../lib/integration-style';

describe('getIcon', () => {
  it('returns the configured icon path for known ids', () => {
    expect(getIcon('youtube')).toBe('/icons/youtube.svg');
    expect(getIcon('slack')).toBe('/icons/slack.svg');
    expect(getIcon('hue')).toBe('/icons/hue.svg');
  });

  it('maps stickies_api -> /icons/stickies.svg (DB type vs icon filename)', () => {
    expect(getIcon('stickies_api')).toBe('/icons/stickies.svg');
  });

  it('falls back to ai-processing.svg for unknown ids', () => {
    expect(getIcon('totally-made-up')).toBe('/icons/ai-processing.svg');
    expect(getIcon('')).toBe('/icons/ai-processing.svg');
  });
});

describe('getColor', () => {
  it('returns the configured Tailwind color for known ids', () => {
    expect(getColor('youtube')).toBe('bg-red-600');
    expect(getColor('stickies_api')).toBe('bg-yellow-500');
    expect(getColor('github')).toBe('bg-gray-700');
  });

  it('falls back to bg-gray-600 for unknown ids', () => {
    expect(getColor('totally-made-up')).toBe('bg-gray-600');
  });
});

describe('getColorHex', () => {
  it('resolves known id -> hex via the color map', () => {
    expect(getColorHex('youtube')).toBe('#dc2626');
    expect(getColorHex('slack')).toBe('#9333ea');
  });

  it('falls back to the gray-600 hex for unknown ids', () => {
    expect(getColorHex('nope')).toBe('#4b5563');
  });
});
