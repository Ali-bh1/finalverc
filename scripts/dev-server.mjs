/**
 * Local server: the static site plus /api/eq-submit.
 *
 *   node scripts/dev-server.mjs          → http://localhost:3000
 *
 * Reads SMTP settings from .env in the project root. Without them, nothing
 * is sent — each email is saved to scripts/out/ instead so you can open it.
 */

import http from 'node:http';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);

if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const smtpReady = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
if (!smtpReady) {
  // No SMTP yet: swap the mail transport for one that writes HTML files.
  const out = join(ROOT, 'scripts/out');
  mkdirSync(out, { recursive: true });
  const nodemailer = (await import('nodemailer')).default;
  nodemailer.createTransport = () => ({
    sendMail: async (m) => {
      const file = join(out, `sent-${Date.now()}-${m.to.replace(/[^a-z0-9]/gi, '_')}.html`);
      writeFileSync(file, m.html);
      console.log(`[mail] (not sent — no SMTP) to ${m.to}: "${m.subject}" → ${file}`);
    },
  });
  Object.assign(process.env, { SMTP_HOST: 'local', SMTP_USER: 'local', SMTP_PASS: 'local' });
}

const vercelConfig = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
const eqSubmit = (await import(pathToFileURL(join(ROOT, 'api/eq-submit.js')).href)).default;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.json': 'application/json',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/eq-submit') {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    try { return await eqSubmit(req, res); } catch (e) { console.error(e); res.statusCode = 500; return res.end(); }
  }

  // Same redirects and rewrites as production (vercel.json).
  const redirect = vercelConfig.redirects?.find((r) => r.source === url.pathname);
  if (redirect) {
    res.statusCode = 307;
    res.setHeader('Location', redirect.destination);
    return res.end();
  }
  const rewrite = vercelConfig.rewrites?.find((r) => r.source === url.pathname);
  if (rewrite) url.pathname = rewrite.destination;

  // Never serve what production doesn't deploy.
  if (/^\/(archive|scripts|server|node_modules|api|text|docs)\/|^\/\.env|^\/\.git/.test(url.pathname)) {
    res.statusCode = 404;
    return res.end('Not found');
  }

  const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Site running at http://localhost:${PORT}`);
  console.log(smtpReady
    ? `Emails: sending for real via ${process.env.SMTP_HOST} (team copy → ${process.env.EQ_NOTIFY_TO || 'hello@tejaldesae.com'})`
    : 'Emails: no SMTP in .env — saving them to scripts/out/ instead of sending');
});
