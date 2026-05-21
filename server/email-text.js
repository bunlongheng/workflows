// Pure helper - turn raw email body (text or HTML) into clean, meaningful text.
// No deps - regex-based stripping. Goal: "smart Cmd+A": drop signatures, quoted
// replies, formatting noise; keep the author's actual message.

const HTML_ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&hellip;': '...',
  '&mdash;': '-',
  '&ndash;': '-',
  '&rsquo;': "'",
  '&lsquo;': "'",
  '&rdquo;': '"',
  '&ldquo;': '"',
};

function decodeEntities(s) {
  let out = s.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp|hellip|mdash|ndash|rsquo|lsquo|rdquo|ldquo);/g, (m) => HTML_ENTITY_MAP[m] || m);
  // Numeric entities: &#1234; and &#x1A;
  out = out.replace(/&#(\d+);/g, (_, n) => {
    try { return String.fromCodePoint(parseInt(n, 10)); } catch { return ''; }
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
    try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; }
  });
  return out;
}

function looksLikeHtml(s) {
  return /<\s*(html|body|div|p|br|table|span|h[1-6])\b/i.test(s);
}

function htmlToText(html) {
  let s = html;
  // Drop script/style blocks entirely
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  // Block-level breaks => newlines
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n');
  s = s.replace(/<\s*li\b[^>]*>/gi, '- ');
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode entities
  s = decodeEntities(s);
  return s;
}

// Lines we never want to keep. Each is matched against a single line (trimmed).
const SIG_START_PATTERNS = [
  /^sent from my (iphone|ipad|android|phone|mobile|samsung|pixel)/i,
  /^sent from outlook/i,
  /^get outlook for (ios|android)/i,
  /^get the outlook app/i,
  /^sent via (gmail|outlook|spark|superhuman)/i,
  /^this email (was sent|is intended)/i,
];

// "Best,\n<name>" / "Thanks,\n<name>" / "Cheers,\n<name>" - signature openers.
// If we see one of these on a line by itself near the end, drop it and everything after.
const SIGN_OFF_PATTERNS = [
  /^(best|thanks|thank you|cheers|regards|kind regards|best regards|sincerely|warm regards|all the best|cordially|talk soon|take care)[,.!\s-]*$/i,
];

// Quoted-reply intros ("On <date>, <name> wrote:" and locale/client variants).
// Any line that ends in one of the reply verbs (wrote/escribió/a écrit/...) and
// looks like a date+name preamble counts as the start of a quoted thread.
const REPLY_VERBS = '(?:wrote|escribi[oó]|a [eé]crit|schrieb|napisa[lł]|scrisse|skrev)';
const REPLY_INTRO_PATTERNS = [
  // English: "On <date>, <name> wrote:"
  new RegExp(`^on\\s.+\\s${REPLY_VERBS}:?\\s*$`, 'i'),
  // Catch-all: any line ending with the reply verb + ":" (covers "El lun ... escribió:")
  new RegExp(`${REPLY_VERBS}:\\s*$`, 'i'),
  /^-{2,}\s*original message\s*-{2,}/i,
  /^_{3,}\s*$/,
  /^from:\s.+/i, // forwarded headers
];

function stripQuotedReply(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // ">" quoted block - skip this line
    if (/^>+/.test(trimmed)) continue;

    // Reply intro - drop everything from here on
    if (REPLY_INTRO_PATTERNS.some((re) => re.test(trimmed))) break;

    out.push(raw);
  }
  return out.join('\n');
}

function stripSignatures(text) {
  // Usenet "-- " sig separator: everything after gets dropped
  const sigSepIdx = text.search(/\n--\s*\n/);
  if (sigSepIdx !== -1) text = text.slice(0, sigSepIdx);

  const lines = text.split('\n');
  const out = [];
  let sigOpenedAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Hard signature markers: drop this line + everything after
    if (SIG_START_PATTERNS.some((re) => re.test(trimmed))) break;

    // Soft sign-off ("Best,") - watch the next non-empty line. If short
    // (looks like a name), drop sign-off + everything after.
    if (SIGN_OFF_PATTERNS.some((re) => re.test(trimmed))) {
      sigOpenedAt = i;
      // Peek ahead: look for a short line that looks like a name within next 3 lines
      let nameAhead = false;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const t = lines[j].trim();
        if (!t) continue;
        if (t.length <= 50 && /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '.\-]{0,49}$/.test(t)) {
          nameAhead = true;
        }
        break;
      }
      if (nameAhead) break;
      // No name follows - keep the sign-off, reset
      sigOpenedAt = -1;
    }

    out.push(line);
  }
  // If we never hit a name, but we saw a sign-off on the very last non-empty line
  if (sigOpenedAt !== -1) {
    return out.slice(0, sigOpenedAt).join('\n');
  }
  return out.join('\n');
}

function collapseWhitespace(text) {
  // Normalize CRLF -> LF
  let s = text.replace(/\r\n?/g, '\n');
  // Trim trailing spaces on each line
  s = s.replace(/[ \t]+$/gm, '');
  // Collapse 3+ newlines to 2
  s = s.replace(/\n{3,}/g, '\n\n');
  // Collapse runs of spaces/tabs (but keep newlines)
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}

// A line that opens a message in an expanded Gmail thread:
// "Bunlong Heng <bheng.code@gmail.com>    Sun, Mar 29, 2026 at 4:04 PM"
const MSG_HEADER_RE = /<[^>]+@[^>]+>.*\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mon|Tue|Wed|Thu|Fri|Sat)\b/i;
// Routing header lines
const ROUTE_HEADER_RE = /^(to|cc|bcc|from|sent|date|subject|reply-to):\s/i;
// Marketing/promo footer markers (Bioss-specific + generic)
const PROMO_RE = /(published antibodies sale|view our current promotions|free shipping on orders over|with code:\s*\w+|^\s*\d+% off\b|receive your first .* trial size)/i;
const QUOTED_HIDDEN_RE = /\[\s*quoted text hidden\s*\]/i;
const HARD_SIG_SEP_RE = /^--\s*$/;

// True when the input looks like a multi-message expanded thread (several
// "Name <email>  Date" headers).
function isThread(text) {
  const matches = text.match(new RegExp(MSG_HEADER_RE.source, 'gi'));
  return matches && matches.length >= 2;
}

// A boundary line ends a sig/promo block without being consumed by it.
function isBlockBoundary(t) {
  return (
    MSG_HEADER_RE.test(t) ||
    QUOTED_HIDDEN_RE.test(t) ||
    REPLY_INTRO_PATTERNS.some((re) => re.test(t))
  );
}

// Skip a signature block: from a "--" separator, drop following lines
// (name/email/phone/title/address) until a block boundary or a 2nd blank gap.
function skipSignatureBlock(lines, start) {
  let i = start + 1;
  let blanks = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (isBlockBoundary(t)) break; // next message / quote starts - don't consume
    if (t === '') {
      blanks++;
      if (blanks >= 2) { i++; break; }
      i++;
      continue;
    }
    blanks = 0;
    i++;
  }
  return i;
}

// Skip a promo/marketing footer until a block boundary or a 2nd blank gap.
function skipPromoBlock(lines, start) {
  let i = start + 1;
  let blanks = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (isBlockBoundary(t)) break;
    if (t === '') {
      blanks++;
      if (blanks >= 2) { i++; break; }
      i++;
      continue;
    }
    blanks = 0;
    i++;
  }
  return i;
}

// Thread-aware clean: strip headers, sig blocks, promo blocks, quoted replies,
// "[Quoted text hidden]" markers, then dedupe repeated paragraphs.
function cleanThread(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const kept = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (HARD_SIG_SEP_RE.test(t)) { i = skipSignatureBlock(lines, i); continue; }
    if (PROMO_RE.test(t)) { i = skipPromoBlock(lines, i); continue; }
    if (QUOTED_HIDDEN_RE.test(t)) { i++; continue; }
    if (/^>+/.test(t)) { i++; continue; }
    if (REPLY_INTRO_PATTERNS.some((re) => re.test(t))) { i++; continue; }
    if (MSG_HEADER_RE.test(t)) { i++; continue; }
    if (ROUTE_HEADER_RE.test(t)) { i++; continue; }

    kept.push(raw);
    i++;
  }

  // Dedupe repeated paragraph blocks (signatures/footers that slipped through,
  // repeated quoted bodies). Blocks are separated by blank lines.
  const joined = kept.join('\n');
  const blocks = joined.split(/\n\s*\n/);
  const seen = new Set();
  const uniqueBlocks = [];
  for (const b of blocks) {
    const norm = b.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!norm) continue;
    if (seen.has(norm)) continue; // exact dup block - drop
    seen.add(norm);
    uniqueBlocks.push(b.trim());
  }
  return uniqueBlocks.join('\n\n');
}

/**
 * Extract the meaningful text from an email body. Accepts plain text or HTML.
 * Single message: drops the quoted tail + the author's signature.
 * Multi-message thread: keeps every author's core message, strips all
 * signatures/promos/headers/quoted-chains, and dedupes repeated blocks.
 * @param {string} input - raw body (text or HTML)
 * @param {string} [_subject] - subject (currently unused; reserved for future heuristics)
 * @returns {string} cleaned text
 */
export function extractText(input, _subject) {
  if (!input || typeof input !== 'string') return '';

  let text = looksLikeHtml(input) ? htmlToText(input) : input;

  if (isThread(text)) {
    text = cleanThread(text);
    return collapseWhitespace(text);
  }

  text = stripQuotedReply(text);
  text = stripSignatures(text);
  text = collapseWhitespace(text);
  return text;
}
