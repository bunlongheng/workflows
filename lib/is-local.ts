/**
 * Returns true only for non-production environments.
 *
 * The previous implementation matched on the `Host` header, which is
 * client-controlled and trivially spoofable in production (e.g. via
 * `curl -H "Host: localhost" https://prod-host/...`). That would let an
 * attacker bypass middleware-level auth entirely.
 *
 * The dev-bypass is now gated strictly on `NODE_ENV`, which is baked in
 * at build time and cannot be set by an inbound request.
 *
 * The `request` argument is kept so existing callers (middleware) don't
 * need to change signatures; it is intentionally unused.
 */
export function isLocal(_request?: Request): boolean {
  return process.env.NODE_ENV !== "production";
}
