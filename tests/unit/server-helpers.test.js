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
});
