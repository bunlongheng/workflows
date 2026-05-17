import { describe, expect, it } from 'vitest';
import { extractText } from '../../server/email-text.js';

describe('extractText', () => {
  it('returns empty for empty/non-string input', () => {
    expect(extractText('')).toBe('');
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
    expect(extractText(42)).toBe('');
  });

  it('passes plain text through unchanged (trimmed)', () => {
    const input = 'Hello there.\n\nJust checking in.';
    expect(extractText(input)).toBe('Hello there.\n\nJust checking in.');
  });

  it('converts HTML to text and preserves paragraph breaks', () => {
    const html = '<html><body><p>Hello there.</p><p>How are you?</p></body></html>';
    const out = extractText(html);
    expect(out).toContain('Hello there.');
    expect(out).toContain('How are you?');
    // Paragraphs should be separated by a blank line
    expect(out).toMatch(/Hello there\.\s*\n\s*\n?\s*How are you\?/);
  });

  it('decodes HTML entities', () => {
    const html = '<p>Tom &amp; Jerry &mdash; the &quot;best&quot;</p>';
    expect(extractText(html)).toContain('Tom & Jerry - the "best"');
  });

  it('drops <script> and <style> blocks', () => {
    const html = '<div>visible<script>alert("nope")</script><style>.x{}</style></div>';
    const out = extractText(html);
    expect(out).toBe('visible');
  });

  it('strips lines starting with ">" (quoted reply)', () => {
    const input = 'My reply here.\n\n> This is the original\n> from the other person\n> on multiple lines';
    expect(extractText(input)).toBe('My reply here.');
  });

  it('drops everything after "On <date>, <name> wrote:" intro', () => {
    const input = 'Thanks for the heads up.\n\nOn Mon, May 1, 2025 at 10:30 AM, Alice <alice@x.com> wrote:\nHey, can you review this?';
    expect(extractText(input)).toBe('Thanks for the heads up.');
  });

  it('handles Spanish "escribió:" reply intro', () => {
    const input = 'Gracias.\n\nEl lun, 1 may 2025 a las 10:30, Alice <alice@x.com> escribió:\nHola, revisa esto.';
    expect(extractText(input)).toBe('Gracias.');
  });

  it('drops "--- Original Message ---" forward block', () => {
    const input = 'FYI below.\n\n--- Original Message ---\nFrom: someone\nSubject: stuff';
    expect(extractText(input)).toBe('FYI below.');
  });

  it('strips "Sent from my iPhone" signature', () => {
    const input = 'Quick note - approved.\n\nSent from my iPhone';
    expect(extractText(input)).toBe('Quick note - approved.');
  });

  it('strips "Get Outlook for iOS" signature', () => {
    const input = 'See attached.\n\nGet Outlook for iOS';
    expect(extractText(input)).toBe('See attached.');
  });

  it('strips Usenet "\\n-- \\n<sig>" signature block', () => {
    const input = 'Body content here.\n-- \nBunlong Heng\nFull-Stack Developer\nbheng.code@gmail.com';
    expect(extractText(input)).toBe('Body content here.');
  });

  it('strips "Best,\\n<name>" sign-off', () => {
    const input = 'Here is the proposal.\n\nBest,\nBunlong';
    expect(extractText(input)).toBe('Here is the proposal.');
  });

  it('strips "Thanks,\\n<name>" sign-off', () => {
    const input = 'Let me know what you think.\n\nThanks,\nAlice Smith';
    expect(extractText(input)).toBe('Let me know what you think.');
  });

  it('keeps "Thanks," when followed by a sentence (not a name)', () => {
    const input = 'Thanks, that worked perfectly and I really appreciate the fast turnaround on this one.';
    expect(extractText(input)).toContain('Thanks, that worked');
  });

  it('collapses 3+ blank lines into 2', () => {
    const input = 'Line one.\n\n\n\n\nLine two.';
    expect(extractText(input)).toBe('Line one.\n\nLine two.');
  });

  it('handles a realistic mixed email (HTML + signature + quoted reply)', () => {
    const html = `<html><body>
      <p>Hey Bunlong,</p>
      <p>Sounds good - let&apos;s sync Thursday at 2pm.</p>
      <p>Best,<br>Alice</p>
      <blockquote>
        <p>On Mon, May 1, 2025, Bunlong wrote:</p>
        <p>Are you free this week?</p>
      </blockquote>
    </body></html>`;
    const out = extractText(html);
    expect(out).toContain('Hey Bunlong');
    expect(out).toContain("Sounds good - let's sync Thursday at 2pm.");
    expect(out).not.toContain('Are you free this week');
    expect(out).not.toMatch(/Best,\s*\nAlice/);
  });
});
