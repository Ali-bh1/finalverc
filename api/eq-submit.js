/**
 * POST /api/eq-submit
 *
 * Receives a finished Expansion Quotient, scores it here (never trusting a
 * territory computed in the browser), and sends two emails:
 *   - the personalised result to the respondent
 *   - the full response set to EQ_NOTIFY_TO for the team to review
 *
 * Responds { ok, client, owner } so the page knows whether it still has
 * to notify the owner some other way.
 */

import { scoreAnswers, QUESTIONS, DESIRE_OPTIONS, INTENT_OPTIONS } from '../js/eq-core.js';
import { clientEmail, ownerEmail } from './_lib/eq-email.js';
import { sendMail } from './_lib/mail.js';

// Every submission's full details go to the business inbox. Override with EQ_NOTIFY_TO.
const NOTIFY_TO = process.env.EQ_NOTIFY_TO || 'hello@tejaldesae.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

/** Returns a clean submission, or a string describing what's wrong. */
export function normalise(body) {
  const c = body.contact || {};
  const contact = {
    firstName: str(c.firstName, 60),
    lastName:  str(c.lastName, 60),
    email:     str(c.email, 160),
    phone:     str(c.phone, 30),
    country:   str(c.country, 60),
    role:      str(c.role, 100),
    company:   str(c.company, 120),
    linkedin:  str(c.linkedin, 200),
    consent:   c.consent === true,
  };
  if (!contact.firstName) return 'first_name';
  if (!EMAIL_RE.test(contact.email)) return 'email';
  // A name is echoed into an email we send to an address we don't control.
  // Links in it would make this endpoint useful for spam.
  if (/https?:|www\.|[<>]/i.test(contact.firstName + contact.lastName)) return 'name';

  const answers = Array.isArray(body.answers) ? body.answers.slice(0, QUESTIONS.length).map(Number) : [];
  if (answers.length !== QUESTIONS.length || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
    return 'answers';
  }

  const meta = {};
  const m = body.meta || {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landing', 'program']) {
    meta[k] = str(m[k], 300);
  }

  return {
    contact,
    answers,
    desires: Array.isArray(body.desires) ? body.desires.filter((d) => DESIRE_OPTIONS.includes(d)) : [],
    intent: INTENT_OPTIONS.some(([k]) => k === body.intent) ? body.intent : '',
    vision: str(body.vision, 3000),
    origin: body.origin === 'book-call' ? 'book-call' : 'direct',
    meta,
    submittedAt: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  const body = await readJson(req);

  // Honeypot: real visitors never see or fill this field.
  if (body.website) return res.status(200).json({ ok: true, client: true, owner: true });

  const sub = normalise(body);
  if (typeof sub === 'string') return res.status(400).json({ error: 'invalid', field: sub });

  const result = scoreAnswers(sub.answers);
  const toClient = clientEmail(sub, result);
  const toOwner = ownerEmail(sub, result);

  const [client, owner] = await Promise.allSettled([
    sendMail({ to: sub.contact.email, replyTo: NOTIFY_TO, ...toClient }),
    sendMail({ to: NOTIFY_TO, replyTo: sub.contact.email, ...toOwner }),
  ]);

  for (const [who, r] of [['client', client], ['owner', owner]]) {
    if (r.status === 'rejected') console.error(`[eq-submit] ${who} email failed:`, r.reason?.message);
  }

  return res.status(200).json({
    ok: true,
    client: client.status === 'fulfilled',
    owner: owner.status === 'fulfilled',
    territory: result.dominant,
  });
}
