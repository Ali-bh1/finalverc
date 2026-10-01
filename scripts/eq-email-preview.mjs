/**
 * Renders both Expansion Quotient emails from a sample submission.
 *
 *   node scripts/eq-email-preview.mjs                 → writes HTML to scripts/out/
 *   node scripts/eq-email-preview.mjs --send you@x.com → also sends both for real
 *
 * Sending needs SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM in the
 * environment (a Gmail address + App Password works for testing). The owner
 * copy goes to EQ_NOTIFY_TO, default hello@tejaldesae.com.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
import { normalise } from '../api/eq-submit.js';
import { scoreAnswers } from '../js/eq-core.js';
import { clientEmail, ownerEmail } from '../api/_lib/eq-email.js';

const sendIdx = process.argv.indexOf('--send');
const clientTo = sendIdx > -1 ? process.argv[sendIdx + 1] : 'alibhatkar.ab@gmail.com';

const sample = normalise({
  contact: {
    firstName: 'Ali', lastName: 'Bhatkar', email: clientTo, phone: '+91 98200 12345',
    country: 'India', role: 'Founder & CEO', company: 'Bhatkar Ventures',
    linkedin: 'linkedin.com/in/alibhatkar', consent: true,
  },
  // Receiving and Wealth lean hardest → a dual-edge result.
  answers: [2, 1, 1, 3, 3, 2, 1, 1, 2, 1, 2],
  desires: ['Peace', 'Time', 'Freedom', 'Joy'],
  intent: 'conversation',
  vision: "I'd be taking real weekends without checking my phone, and I'd have stopped feeling guilty every time money comes in without me grinding for it.",
  origin: 'book-call',
  meta: { utm_source: 'instagram', utm_medium: 'paid', utm_campaign: 'eq-launch', landing: '/index.html', referrer: 'https://l.instagram.com/' },
});

const result = scoreAnswers(sample.answers);
const client = clientEmail(sample, result);
const owner = ownerEmail(sample, result);

const out = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'client.html'), client.html);
writeFileSync(join(out, 'owner.html'), owner.html);
console.log('Result:', result);
console.log('Client subject:', client.subject);
console.log('Owner subject: ', owner.subject);
console.log('Wrote', join(out, 'client.html'), 'and owner.html');

if (sendIdx > -1) {
  if (!process.env.SMTP_PASS) {
    console.error('\nSMTP_PASS is empty — paste your App Password into .env first.');
    process.exit(1);
  }
  // Check the login before sending, so a bad password gives a clear message.
  const nodemailer = (await import('nodemailer')).default;
  try {
    await nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    }).verify();
    console.log('\nSMTP login OK as', process.env.SMTP_USER);
  } catch (e) {
    console.error('\nSMTP login failed:', e.message);
    console.error('Check SMTP_USER / SMTP_PASS in .env (Gmail needs an App Password, not your normal password).');
    process.exit(1);
  }
  const { sendMail } = await import('../api/_lib/mail.js');
  const notifyTo = process.env.EQ_NOTIFY_TO || 'hello@tejaldesae.com';
  await sendMail({ to: sample.contact.email, replyTo: notifyTo, ...client });
  console.log('Sent client email →', sample.contact.email);
  await sendMail({ to: notifyTo, replyTo: sample.contact.email, ...owner });
  console.log('Sent owner email  →', notifyTo);
}
