/**
 * eq-flow.js — state that carries a visitor through
 *   Book button → details popup → Expansion Quotient → thank-you
 *
 * Contact details live in sessionStorage so the assessment never asks for
 * them a second time. Ad/UTM source is captured on whatever page they
 * land on first, so it survives the hop to the assessment page.
 */

const CONTACT_KEY = 'tejal_eq_contact';
const SOURCE_KEY = 'tejal_eq_source';
const DONE_KEY = 'tejal_eq_submitted';

function read(store, key) {
  try { return JSON.parse(store.getItem(key)) || null; } catch { return null; }
}
function write(store, key, value) {
  try { store.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export const saveContact = (c) => write(sessionStorage, CONTACT_KEY, c);
export const loadContact = () => read(sessionStorage, CONTACT_KEY);

/** Record where this visitor came from — first landing wins. */
export function captureSource() {
  if (read(sessionStorage, SOURCE_KEY)) return;
  const q = new URLSearchParams(location.search);
  const src = { landing: location.pathname, referrer: document.referrer || '' };
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (q.get(k)) src[k] = q.get(k);
  }
  write(sessionStorage, SOURCE_KEY, src);
}
export const loadSource = () => read(sessionStorage, SOURCE_KEY) || {};

/** Remembered across visits so a returning visitor isn't sent round again. */
export const markSubmitted = (email) => write(localStorage, DONE_KEY, { email, at: Date.now() });
export const loadSubmitted = () => read(localStorage, DONE_KEY);
export function clearSubmitted() {
  try { localStorage.removeItem(DONE_KEY); } catch { /* ignore */ }
}
