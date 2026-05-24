import { describe, expect, it } from 'vitest';
import {
  AI_BAILOUT_REGEX,
  escapeHtml,
  parseTimedTextXml,
} from '../../server/pipeline-helpers.js';

describe('parseTimedTextXml', () => {
  it('joins multiple <text> entries into one string', () => {
    const xml = '<text start="0">hello</text><text start="1">world</text>';
    expect(parseTimedTextXml(xml)).toBe('hello world');
  });

  it('decodes common HTML entities', () => {
    const xml =
      '<text>Tom &amp; Jerry</text><text>&lt;hi&gt;</text><text>it&#39;s &quot;ok&quot;</text>';
    expect(parseTimedTextXml(xml)).toBe('Tom & Jerry <hi> it\'s "ok"');
  });

  it('returns null for empty / no-match input', () => {
    expect(parseTimedTextXml('')).toBeNull();
    expect(parseTimedTextXml('<root>no text tags</root>')).toBeNull();
  });

  it('collapses interior whitespace and newlines', () => {
    const xml = '<text>line one\nline   two</text><text>  extra  </text>';
    expect(parseTimedTextXml(xml)).toBe('line one line two extra');
  });

  it('returns null for null / undefined input', () => {
    expect(parseTimedTextXml(null)).toBeNull();
    expect(parseTimedTextXml(undefined)).toBeNull();
  });

  it('parses a single <text> with attributes', () => {
    expect(parseTimedTextXml('<text dur="1.2" start="0">caption line</text>')).toBe(
      'caption line'
    );
  });

  it('strips inner formatting tags inside a <text> node', () => {
    expect(parseTimedTextXml('<text><b>bold</b> plain</text>')).toBe('bold plain');
  });

  it('ignores malformed/unclosed <text> (no match -> null)', () => {
    expect(parseTimedTextXml('<text>hello')).toBeNull();
    expect(parseTimedTextXml('<text>')).toBeNull();
  });

  it('returns null when all <text> nodes are whitespace-only', () => {
    expect(parseTimedTextXml('<text>   </text><text>\n\t</text>')).toBeNull();
  });

  it('only decodes one entity layer (nested &amp;amp; -> &amp;)', () => {
    // Single-pass decode: &amp;amp; -> &amp; (not all the way to &).
    expect(parseTimedTextXml('<text>a &amp;amp; b</text>')).toBe('a &amp; b');
  });

  it('decodes a mix of entities across multiple nodes', () => {
    const xml = '<text>5 &lt; 10</text><text>10 &gt; 5</text><text>&quot;done&quot;</text>';
    expect(parseTimedTextXml(xml)).toBe('5 < 10 10 > 5 "done"');
  });
});

describe('escapeHtml', () => {
  it('escapes <, > to HTML entities', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('escapes quotes and ampersands', () => {
    expect(escapeHtml(`Tom & "Jerry's"`)).toBe(
      'Tom &amp; &quot;Jerry&#39;s&quot;'
    );
  });

  it('returns empty string for null / undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-string values to string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(true)).toBe('true');
  });

  it('escapes all five special characters in one pass', () => {
    expect(escapeHtml(`<a href="x"> & 'q' </a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt; &amp; &#39;q&#39; &lt;/a&gt;'
    );
  });

  it('escapes & first so it does not double-encode the other entities', () => {
    // If & weren't escaped first, "<" -> "&lt;" then the "&" would be re-escaped.
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves already-safe text untouched', () => {
    expect(escapeHtml('plain text 123')).toBe('plain text 123');
  });

  it('returns empty string for empty string input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('AI_BAILOUT_REGEX', () => {
  it('matches common AI-bailout phrasings', () => {
    expect(AI_BAILOUT_REGEX.test('the transcript unavailability blocks me')).toBe(true);
    expect(AI_BAILOUT_REGEX.test('i cannot summarize this video')).toBe(true);
    expect(AI_BAILOUT_REGEX.test('unable to provide a summary')).toBe(true);
    expect(AI_BAILOUT_REGEX.test('insufficient content to analyze')).toBe(true);
  });

  it('does NOT match normal summary content', () => {
    expect(AI_BAILOUT_REGEX.test('Anthropic released Claude 4')).toBe(false);
    expect(
      AI_BAILOUT_REGEX.test('The video covers TypeScript generics in depth.')
    ).toBe(false);
  });

  it('matches each bail-out trigger phrase (true matrix)', () => {
    const positives = [
      'transcript unavailable for this clip',
      'transcript not available right now',
      'transcript missing entirely',
      'I cannot summarize without more context',
      'there is no transcript to work from',
      'I am unable to provide a summary',
      'insufficient content here',
      'insufficient information given',
    ];
    for (const p of positives) {
      expect(AI_BAILOUT_REGEX.test(p)).toBe(true);
    }
  });

  it('does NOT match near-miss / unrelated phrasings (false matrix)', () => {
    const negatives = [
      'the transcript was thorough and complete',
      'I can summarize this clearly',
      'plenty of content and information',
      'a full transcript is attached',
      '',
      'summary: a great talk about databases',
    ];
    for (const n of negatives) {
      expect(AI_BAILOUT_REGEX.test(n)).toBe(false);
    }
  });

  it('is case-sensitive (uppercase phrasings do not match)', () => {
    expect(AI_BAILOUT_REGEX.test('CANNOT SUMMARIZE')).toBe(false);
    expect(AI_BAILOUT_REGEX.test('cannot summarize')).toBe(true);
  });
});
