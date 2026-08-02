import { createHmac, timingSafeEqual } from "node:crypto";

// Single-owner admin auth. The session cookie holds a bearer token that is just
// HMAC(ADMIN_PASSWORD, <fixed string>) — it can't be forged without the
// password, and the password itself never leaves the server. If ADMIN_PASSWORD
// is unset, everything returns "not admin" so the site stays a read-only public
// page (no crash) — the same graceful-degradation style as the DB proxy.
export const ADMIN_COOKIE = "gifra_admin";

const adminPassword = (): string | null => process.env.ADMIN_PASSWORD || null;

/** The session token for the configured password, or null if none is set. */
export function signToken(): string | null {
  const pw = adminPassword();
  return pw
    ? createHmac("sha256", pw).update("gifra-admin-v1").digest("hex")
    : null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** True if the cookie value is a valid session token. */
export function verifyToken(token: string | undefined | null): boolean {
  const expected = signToken();
  return !!token && !!expected && safeEqual(token, expected);
}

/** Constant-time check of a submitted password against ADMIN_PASSWORD. */
export function checkPassword(pw: string): boolean {
  const real = adminPassword();
  return !!real && safeEqual(pw, real);
}

/** Read the request cookie and report whether the caller is the admin. */
export async function isAdmin(): Promise<boolean> {
  // Imported lazily so this module stays plain-Node importable (e.g. from tests)
  // without pulling in the Next request-scope `cookies()`.
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return verifyToken(store.get(ADMIN_COOKIE)?.value);
}

/** Guard for mutating server actions — throws unless the caller is the admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}
