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
});
