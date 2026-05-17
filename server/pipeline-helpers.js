// Pure helpers used by server/pipeline.js. Extracted so they can be tested
// without triggering the heavy side effects (dotenv config, pg Pool) that
// firing up pipeline.js incurs.

// Parse a YouTube timed-text XML caption track into a single joined string.
// Returns null on empty input.
export function parseTimedTextXml(xml) {
  if (!xml) return null;
  const matches = xml.match(/<text[^>]*>(.*?)<\/text>/gs) || [];
  const texts = matches.map((m) => {
    return m
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n/g, ' ')
      .trim();
  });
  const joined = texts.join(' ').replace(/\s+/g, ' ').trim();
  return joined || null;
}

// Escape user/AI-supplied strings before embedding into HTML.
// Stickies renders this content as HTML, so unescaped values are an XSS vector.
export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Matches Claude responses that admit inability to summarize (used together
// with empty ideas/topics to flag AI bail-out failures in the pipeline).
export const AI_BAILOUT_REGEX =
  /transcript (unavailab|not avail|missing)|cannot summarize|no transcript|unable to provide|insufficient (content|information)/;
