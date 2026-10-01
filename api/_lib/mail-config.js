/**
 * The mailbox the site sends from — built in, so the site works on any host
 * without setting environment variables. SMTP_* env vars, if present, win.
 *
 * ⚠ CONTAINS A PASSWORD. Only ever push this to a PRIVATE repository.
 *   A local git pre-push hook (.git/hooks/pre-push) blocks pushing it to
 *   public repos. If the mailbox password changes, update it here.
 */
export const MAIL_DEFAULTS = {
  host: 'smtpout.secureserver.net',
  port: 465,
  user: 'hello@tejaldesae.com',
  pass: 'Shreem@369',
  from: 'Tejal Desae <hello@tejaldesae.com>',
};
