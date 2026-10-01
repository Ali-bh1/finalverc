/**
 * Transactional email over SMTP.
 *
 * SMTP rather than a specific provider's REST API so the same code works
 * with Zoho, Google Workspace, Brevo, Resend or anything else the domain
 * ends up sending from — only the env vars change.
 */

import nodemailer from 'nodemailer';
import { MAIL_DEFAULTS } from './mail-config.js';

let cached = null;

// Env vars win when set (local .env, or a host's settings); otherwise the
// built-in mailbox in mail-config.js is used, so a deploy needs no setup.
const useEnv = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

function transport() {
  if (cached) return cached;

  const host = useEnv ? process.env.SMTP_HOST : MAIL_DEFAULTS.host;
  const port = Number(useEnv ? (process.env.SMTP_PORT || 587) : MAIL_DEFAULTS.port);
  const user = useEnv ? process.env.SMTP_USER : MAIL_DEFAULTS.user;
  const pass = useEnv ? process.env.SMTP_PASS : MAIL_DEFAULTS.pass;

  if (!host || !user || !pass) throw new Error('SMTP is not configured');

  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cached;
}

const FROM = (useEnv && process.env.MAIL_FROM) || MAIL_DEFAULTS.from;

export async function sendAccessLink({ to, link, isResend = false }) {
  const heading = isResend ? 'Here’s your link again' : 'Your assessment is ready';

  const text = [
    `${heading}`,
    '',
    'This link opens your assessment and your results. It is private to you —',
    'please don’t forward it.',
    '',
    link,
    '',
    'It keeps working, so you can come back to your results whenever you like.',
    '',
    '— Tejal',
    'hello@tejaldesae.com',
  ].join('\n');

  const html = `
<div style="margin:0;padding:32px 16px;background:#0B2A1D;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:520px;margin:0 auto;background:#0E3122;border:1px solid rgba(199,172,109,.42);padding:36px 32px">
    <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C7AC6D">Tejal Desae</p>
    <h1 style="margin:0 0 18px;font-size:27px;line-height:1.2;color:#e6d3a3;font-weight:600">${heading}</h1>
    <p style="margin:0 0 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:rgba(255,255,255,.9)">
      This link opens your assessment and your results. It’s private to you — please don’t forward it.
    </p>
    <p style="margin:0 0 26px">
      <a href="${link}" style="display:inline-block;background:#e6d3a3;color:#0B2A1D;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;padding:16px 28px">Open my assessment</a>
    </p>
    <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:rgba(255,255,255,.62)">
      It keeps working, so you can come back to your results whenever you like.
    </p>
    <p style="margin:22px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,.62)">
      — Tejal · <a href="mailto:hello@tejaldesae.com" style="color:#C7AC6D">hello@tejaldesae.com</a>
    </p>
  </div>
</div>`.trim();

  await transport().sendMail({
    from: FROM,
    to,
    subject: isResend ? 'Your assessment link' : 'Your assessment link — Tejal Desae',
    text,
    html,
  });
}

/**
 * Generic send. `from` falls back to MAIL_FROM; with Gmail SMTP that must
 * be the authenticated account (or a verified alias) or Gmail rewrites it.
 */
export async function sendMail({ to, subject, html, text, replyTo }) {
  await transport().sendMail({ from: FROM, to, subject, html, text, replyTo });
}
