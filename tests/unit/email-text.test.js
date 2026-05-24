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

  it('strips "Regards,\\n<name>" sign-off', () => {
    expect(extractText('Here is the file.\n\nRegards,\nBob')).toBe('Here is the file.');
  });

  it('strips "Cheers\\n<name>" sign-off (no comma)', () => {
    expect(extractText('Done.\n\nCheers\nSam')).toBe('Done.');
  });

  it('strips "Sincerely,\\n<full name>" sign-off', () => {
    expect(extractText('Letter body.\n\nSincerely,\nJane Doe')).toBe('Letter body.');
  });

  it('strips "Best regards,\\n<name>" sign-off', () => {
    expect(extractText('Proposal attached.\n\nBest regards,\nAlice')).toBe(
      'Proposal attached.'
    );
  });

  it('strips "Kind regards,\\n<name>" sign-off', () => {
    expect(extractText('See you then.\n\nKind regards,\nTom')).toBe('See you then.');
  });

  it('keeps a "Best, <sentence>" line when no name follows', () => {
    const input = 'Best, I think we should ship the feature this week regardless.';
    expect(extractText(input)).toBe(input);
  });

  it('strips "Sent from my Android" signature', () => {
    expect(extractText('ok\n\nSent from my Android')).toBe('ok');
  });

  it('strips "Sent from my iPad" signature', () => {
    expect(extractText('Reviewed.\n\nSent from my iPad')).toBe('Reviewed.');
  });

  it('strips "Get the Outlook app" signature', () => {
    expect(extractText('Confirmed.\n\nGet the Outlook app')).toBe('Confirmed.');
  });

  it('strips an "___" (underscore rule) forwarded divider and below', () => {
    expect(extractText('Reply text.\n\n___\nquoted below')).toBe('Reply text.');
  });

  it('drops a "From:" forwarded header and everything after', () => {
    expect(extractText('See below.\n\nFrom: a@b.com\nstuff here')).toBe('See below.');
  });

  it('keeps non-quoted lines interleaved with ">" quoted lines', () => {
    const input = 'Mine.\n> quoted 1\nstill mine\n> quoted 2';
    expect(extractText(input)).toBe('Mine.\nstill mine');
  });

  it('strips multiple levels of ">>" nested quoting', () => {
    const input = 'My note.\n\n>> deep quote\n> shallow quote';
    expect(extractText(input)).toBe('My note.');
  });

  it('normalizes CRLF line endings to LF', () => {
    expect(extractText('Line A\r\nLine B')).toBe('Line A\nLine B');
  });

  it('collapses runs of 2+ internal spaces/tabs to a single space', () => {
    expect(extractText('word     spaced')).toBe('word spaced');
    expect(extractText('word\t\tspaced')).toBe('word spaced');
    expect(extractText('word \t spaced')).toBe('word spaced');
  });

  it('trims trailing whitespace on each line', () => {
    expect(extractText('Line A   \nLine B\t\t')).toBe('Line A\nLine B');
  });

  it('decodes &nbsp; entities from HTML to spaces', () => {
    expect(extractText('<p>a&nbsp;&nbsp;b</p>')).toBe('a b');
  });

  it('decodes numeric HTML entities (&#39; and &#x27;)', () => {
    expect(extractText('<p>it&#39;s &#x41;OK</p>')).toBe("it's AOK");
  });

  it('renders <li> items with a leading dash (when wrapped in a recognized block)', () => {
    // looksLikeHtml triggers on the <div>; htmlToText then maps <li> -> "- ".
    const out = extractText('<div><ul><li>first</li><li>second</li></ul></div>');
    expect(out).toContain('- first');
    expect(out).toContain('- second');
  });

  it('does not treat short tagless plain text as HTML', () => {
    expect(extractText('Just a normal sentence about spans and divs.')).toBe(
      'Just a normal sentence about spans and divs.'
    );
  });

  it('keeps the author message when "[Quoted text hidden]" follows (single-message path)', () => {
    // Single-message path does not strip the marker (that is thread-only),
    // but the real reply text is always preserved.
    const out = extractText('Here is my reply.\n[Quoted text hidden]');
    expect(out).toContain('Here is my reply.');
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

  it('cleans a multi-message Gmail thread (headers, repeated sigs, promo, quotes, dupes)', () => {
    const thread = [
      'Bunlong Heng <bheng.code@gmail.com>    Sun, Mar 29, 2026 at 4:04 PM',
      'To: Kevin Dong <ydong@biossusa.com>',
      'Hi Kevin,',
      '',
      'I wanted to flag some security concerns.',
      '',
      '--',
      'Best regard,',
      '',
      'Bunlong Heng',
      'bheng.code@gmail.com',
      '9786770861',
      '',
      'Kevin Dong <ydong@biossusa.com>    Sun, Mar 29, 2026 at 4:06 PM',
      'To: Bunlong Heng <bheng.code@gmail.com>',
      'Agreed!',
      '[Quoted text hidden]',
      'David Mello <davidm@biossusa.com>    Mon, Mar 30, 2026 at 10:52 AM',
      'Hi Bunlong,',
      '',
      'Can you confirm Laravel versions?',
      '',
      'Best regards,',
      'David',
      '--',
      'David Mello',
      'Director of Sales & Marketing | Bioss Antibodies',
      '300 Trade Center Drive, Suite 4610, Woburn, MA 01801',
      'Published Antibodies Sale',
      '',
      '25% off Published Antibodies with code: PUB25',
      'Free Shipping on Orders Over $1,000',
      '',
      'On Mon, Mar 30, 2026 at 10:04 AM Kevin Dong <ydong@biossusa.com> wrote:',
      'Any thoughts?',
      '[Quoted text hidden]',
      '--',
      'Best regard,',
      '',
      'Bunlong Heng',
      'bheng.code@gmail.com',
      '9786770861',
    ].join('\n');

    const out = extractText(thread);
    // Core messages preserved
    expect(out).toContain('Hi Kevin,');
    expect(out).toContain('I wanted to flag some security concerns.');
    expect(out).toContain('Agreed!');
    expect(out).toContain('Can you confirm Laravel versions?');
    expect(out).toContain('Any thoughts?');
    // Signatures stripped (phone appears twice in source - gone entirely)
    expect(out).not.toContain('9786770861');
    // Promo footer stripped
    expect(out).not.toContain('PUB25');
    expect(out).not.toMatch(/Free Shipping on Orders/);
    // Headers + quote markers stripped
    expect(out).not.toContain('<bheng.code@gmail.com>');
    expect(out).not.toMatch(/quoted text hidden/i);
    expect(out).not.toMatch(/^To:/m);
  });

  it('dedupes identical paragraph blocks across a thread', () => {
    // Blocks are delimited by blank lines; an identical block in two messages
    // should survive only once after dedupe.
    const thread = [
      'Alice Example <alice@x.com>    Mon, Jan 5, 2026 at 9:00 AM',
      'The deploy is scheduled for Friday.',
      '',
      'Bob Example <bob@y.com>    Mon, Jan 5, 2026 at 9:05 AM',
      'The deploy is scheduled for Friday.',
      '',
      'Sounds good to me.',
    ].join('\n');
    const out = extractText(thread);
    const occurrences = out.split('The deploy is scheduled for Friday.').length - 1;
    expect(occurrences).toBe(1);
    expect(out).toContain('Sounds good to me.');
  });

  it('treats a single message-header line as a non-thread (needs 2+ headers)', () => {
    // Exactly one header -> isThread is false -> single-message path runs.
    const input = [
      'Alice <alice@x.com>    Tue, Feb 3, 2026 at 8:00 AM',
      'Just one message here.',
    ].join('\n');
    const out = extractText(input);
    expect(out).toContain('Just one message here.');
  });

  it('strips routing headers (To/Cc/Subject) inside a detected thread', () => {
    const thread = [
      'Alice <alice@x.com>    Mon, Jan 5, 2026 at 9:00 AM',
      'Cc: team@x.com',
      'Subject: Re: status',
      'First message body.',
      '',
      'Bob <bob@y.com>    Mon, Jan 5, 2026 at 9:30 AM',
      'Second message body.',
    ].join('\n');
    const out = extractText(thread);
    expect(out).toContain('First message body.');
    expect(out).toContain('Second message body.');
    expect(out).not.toMatch(/^Cc:/m);
    expect(out).not.toMatch(/^Subject:/m);
  });
});
