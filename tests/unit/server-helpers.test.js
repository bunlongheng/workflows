import { describe, expect, it } from 'vitest';
import { extractVideoId, maskEmail } from '../../server/helpers.js';

describe('extractVideoId', () => {
  it('pulls the id from a standard watch URL', () => {
    expect(extractVideoId('https://youtube.com/watch?v=abc123def45')).toBe(
      'abc123def45'
    );
    expect(
      extractVideoId('https://www.youtube.com/watch?v=abc123def45&t=10s')
    ).toBe('abc123def45');
  });

  it('pulls the id from a youtu.be share URL', () => {
    expect(extractVideoId('https://youtu.be/abc123def45')).toBe('abc123def45');
    expect(extractVideoId('https://youtu.be/abc123def45?si=xyz')).toBe(
      'abc123def45'
    );
  });

  it('returns null for invalid / missing input', () => {
    expect(extractVideoId('https://example.com')).toBeNull();
    expect(extractVideoId('')).toBeNull();
    expect(extractVideoId(null)).toBeNull();
    expect(extractVideoId(undefined)).toBeNull();
  });

  it('extracts ids containing hyphens and underscores', () => {
    expect(extractVideoId('https://youtu.be/a-b_c1234XY')).toBe('a-b_c1234XY');
    expect(extractVideoId('https://www.youtube.com/watch?v=_-_-_-_-_-_')).toBe(
      '_-_-_-_-_-_'
    );
  });

  it('grabs the v= param regardless of its position in the query string', () => {
    expect(
      extractVideoId('https://www.youtube.com/watch?list=PL123&v=abc123def45')
    ).toBe('abc123def45');
  });

  it('does NOT match /shorts/ URLs (regex only knows v= and youtu.be/)', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/abc123def45')).toBeNull();
  });

  it('does NOT match /embed/ path form, but does match embed URL carrying ?v=', () => {
    expect(extractVideoId('https://www.youtube.com/embed/abc123def45')).toBeNull();
    expect(
      extractVideoId('https://www.youtube.com/embed/xxx?v=abc123def45')
    ).toBe('abc123def45');
  });

  it('returns null when the id is too short (fewer than 11 chars)', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(extractVideoId('https://youtu.be/tooShort')).toBeNull();
  });

  it('truncates to the first 11 id characters when more are present', () => {
    // 14 chars after v= -> only first 11 captured.
    expect(extractVideoId('https://www.youtube.com/watch?v=abcdefghijkLMN')).toBe(
      'abcdefghijk'
    );
  });
});

describe('maskEmail', () => {
  it('masks a plain email address', () => {
    expect(maskEmail('bunlong@gmail.com')).toBe('b***@gmail.com');
  });

  it('extracts and masks the address from a "Name <addr>" form', () => {
    expect(maskEmail('Bunlong <bunlong@gmail.com>')).toBe('b***@gmail.com');
  });

  it('returns empty string for empty / non-string input', () => {
    expect(maskEmail('')).toBe('');
    expect(maskEmail(null)).toBe('');
    expect(maskEmail(undefined)).toBe('');
    expect(maskEmail(42)).toBe('');
  });

  it('returns *** for non-email-shaped strings', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('masks a single-char local part', () => {
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
  });

  it('preserves a "+tag" address local first char only', () => {
    expect(maskEmail('plus+tag@gmail.com')).toBe('p***@gmail.com');
  });

  it('returns *** when the address starts with @ (empty local part)', () => {
    expect(maskEmail('@gmail.com')).toBe('***');
  });

  it('keeps the trailing @ when there is no domain text', () => {
    expect(maskEmail('trailing@')).toBe('t***@');
  });

  it('extracts the address from a "Name <addr>" form even with extra text', () => {
    expect(maskEmail('David Mello <davidm@biossusa.com>')).toBe('d***@biossusa.com');
  });

  it('masks the address inside angle brackets, ignoring the display name', () => {
    // The display name contains an @, but the bracketed address wins.
    expect(maskEmail('a@fake <real@host.io>')).toBe('r***@host.io');
  });
});
