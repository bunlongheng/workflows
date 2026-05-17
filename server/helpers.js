// Pure helpers from server/index.js. Extracted so they can be tested without
// importing index.js (which kicks off Express, the watcher, dotenv, etc).

// Mask an email for log output: "bheng.code@gmail.com" -> "b***@gmail.com".
// Falls back gracefully if input isn't an email string.
export function maskEmail(e) {
  if (!e || typeof e !== 'string') return '';
  // Handle "Name <addr@host>" form by extracting the address.
  const addrMatch = e.match(/<([^>]+)>/);
  const addr = addrMatch ? addrMatch[1] : e;
  const at = addr.indexOf('@');
  if (at <= 0) return '***';
  const local = addr.slice(0, at);
  const domain = addr.slice(at);
  return `${local[0]}***${domain}`;
}

// Pull an 11-char YouTube video ID out of a watch / share URL.
export function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
