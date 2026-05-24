import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeAgo } from '../../lib/time';

const FIXED_NOW = new Date('2026-05-17T12:00:00.000Z').getTime();

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function isoMinusMs(ms: number): string {
    return new Date(FIXED_NOW - ms).toISOString();
  }

  it('returns "just now" for differences under 1 minute', () => {
    expect(timeAgo(isoMinusMs(30 * 1000))).toBe('just now');
  });

  it('returns "just now" for a 0s difference (now === date)', () => {
    expect(timeAgo(isoMinusMs(0))).toBe('just now');
  });

  it('returns "just now" at 59 seconds (still under a minute)', () => {
    expect(timeAgo(isoMinusMs(59 * 1000))).toBe('just now');
  });

  it('flips to "1m ago" at exactly 60 seconds', () => {
    expect(timeAgo(isoMinusMs(60 * 1000))).toBe('1m ago');
  });

  it('returns "1m ago" at 90 seconds (floors to 1 minute)', () => {
    expect(timeAgo(isoMinusMs(90 * 1000))).toBe('1m ago');
  });

  it('returns minutes ago at 5 minutes', () => {
    expect(timeAgo(isoMinusMs(5 * 60 * 1000))).toBe('5m ago');
  });

  it('returns minutes ago at 59 minutes', () => {
    expect(timeAgo(isoMinusMs(59 * 60 * 1000))).toBe('59m ago');
  });

  it('returns 1h ago at exactly 60 minutes', () => {
    expect(timeAgo(isoMinusMs(60 * 60 * 1000))).toBe('1h ago');
  });

  it('returns 23h ago at 23 hours', () => {
    expect(timeAgo(isoMinusMs(23 * 60 * 60 * 1000))).toBe('23h ago');
  });

  it('returns 1d ago at exactly 24 hours', () => {
    expect(timeAgo(isoMinusMs(24 * 60 * 60 * 1000))).toBe('1d ago');
  });

  it('returns 30d ago at 30 days', () => {
    expect(timeAgo(isoMinusMs(30 * 24 * 60 * 60 * 1000))).toBe('30d ago');
  });

  it('returns 365d ago at exactly one year', () => {
    expect(timeAgo(isoMinusMs(365 * 24 * 60 * 60 * 1000))).toBe('365d ago');
  });

  it('returns "1h ago" at 119 minutes (just under 2 hours)', () => {
    expect(timeAgo(isoMinusMs(119 * 60 * 1000))).toBe('1h ago');
  });

  it('treats a future date as "just now" (negative diff floors below 1)', () => {
    // date 5 minutes in the future -> diff is negative -> mins < 1 -> just now.
    expect(timeAgo(isoMinusMs(-5 * 60 * 1000))).toBe('just now');
  });
});
