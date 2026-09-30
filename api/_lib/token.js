/**
 * Access tokens for people who have booked the free call.
 *
 * A token is `payload.signature`, where payload is base64url JSON and the
 * signature is HMAC-SHA256 over that exact payload string. Nothing in the
 * payload is secret — the signature is what makes it unforgeable, so the
 * secret must never leave the server.
 *
 * Deliberately stateless: verifying a token needs no database round-trip,
 * which is what keeps this cheap under ad traffic. The KV store is only
 * consulted for "resend my link", never on the hot path.
 */

import crypto from 'node:crypto';

const SECRET = process.env.ACCESS_TOKEN_SECRET || '';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload) {
  return b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
}

/** Mint a token for a paying customer. */
export function mintToken({ email, paymentId }) {
  if (!SECRET) throw new Error('ACCESS_TOKEN_SECRET is not set');
  const payload = b64url(JSON.stringify({
    e: String(email).trim().toLowerCase(),
    p: paymentId || null,
    t: Date.now(),
  }));
  return payload + '.' + sign(payload);
}

/**
 * Verify a token. Returns { email, paymentId, issuedAt } or null.
 * Never throws on malformed input — callers treat null as "not entitled".
 */
export function verifyToken(token) {
  if (!SECRET || typeof token !== 'string') return null;

  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;

  const payload = token.slice(0, dot);
  const given = token.slice(dot + 1);
  const expected = sign(payload);

  // Length check first: timingSafeEqual throws on a length mismatch, and the
  // length of an HMAC is not a secret.
  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  try {
    const data = JSON.parse(unb64url(payload).toString('utf8'));
    if (!data || typeof data.e !== 'string' || !data.e) return null;
    return { email: data.e, paymentId: data.p || null, issuedAt: data.t || 0 };
  } catch {
    return null;
  }
}

/** Stable, non-reversible key for storing a payer without storing the address. */
export function emailKey(email) {
  return crypto.createHash('sha256')
    .update(String(email).trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

/**
 * Razorpay signs webhooks with HMAC-SHA256 over the raw request body.
 * The raw bytes matter — re-serialising parsed JSON will not match.
 */
export function verifyRazorpaySignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret || typeof signature !== 'string' || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const COOKIE_NAME = 'td_access';

/** Two years — the report is theirs to come back to. */
export function accessCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=63072000',
  ].join('; ');
}

export function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
