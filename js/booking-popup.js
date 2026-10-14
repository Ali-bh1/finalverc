/**
 * booking-popup.js — the details pop-up, step 1 of both journeys
 *
 *   "Book a free call"           → popup (mode 'call') → Expansion Quotient → thank-you
 *   "Take the free Expansion Q." → popup (mode 'eq')   → Expansion Quotient → thank-you
 *
 * [data-book-call] or a #book link opens it in 'call' mode; [data-take-eq]
 * or a #eq link in 'eq' mode. The details are handed to the assessment
 * through sessionStorage (eq-flow.js), so nobody is asked twice. Nothing is
 * sent from here — the lead, the client's result email and the team
 * notification all go out together when the assessment is submitted.
 */

import { saveContact, loadContact, loadSubmitted, captureSource } from './eq-flow.js';

// ── Country list (top countries first, then alphabetical) ────
const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'United Arab Emirates', 'Singapore', 'Germany', 'Netherlands',
  '──────────',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
  'Argentina', 'Armenia', 'Austria', 'Azerbaijan', 'Bahrain',
  'Bangladesh', 'Belgium', 'Bhutan', 'Bolivia', 'Brazil',
  'Brunei', 'Bulgaria', 'Cambodia', 'Cameroon', 'Chile',
  'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cyprus',
  'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador', 'Egypt',
  'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Georgia', 'Ghana', 'Greece', 'Guatemala', 'Hong Kong',
  'Hungary', 'Iceland', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan',
  'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Latvia',
  'Lebanon', 'Lithuania', 'Luxembourg', 'Malaysia', 'Maldives',
  'Malta', 'Mauritius', 'Mexico', 'Mongolia', 'Morocco',
  'Myanmar', 'Nepal', 'New Zealand', 'Nigeria', 'Norway',
  'Oman', 'Pakistan', 'Panama', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia',
  'Saudi Arabia', 'Serbia', 'South Africa', 'South Korea', 'Spain',
  'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Tanzania',
  'Thailand', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Uganda',
  'Ukraine', 'Uruguay', 'Uzbekistan', 'Venezuela', 'Vietnam',
  'Zambia', 'Zimbabwe', 'Other',
];

const ASSESSMENT_URL = 'eq-t1uqlm.html';

// Copy for each journey. 'call' promises a call; 'eq' promises results only.
const MODES = {
  call: {
    eyebrow: 'Your free Expansion Call',
    title: "Let's start with you",
    sub: 'Before you speak with Tejal, a short, private reflection helps us understand where you are.',
    steps: ['Your details', 'Expansion Quotient <small>~4 min</small>', 'We arrange your call'],
    phoneRequired: true,
    button: 'Continue to my Expansion Quotient →',
    fine: 'Completely free. Your personalised result comes to your inbox, and our team will be in touch to arrange your call.',
    pixel: 'Free Expansion Call',
  },
  eq: {
    eyebrow: 'Welcome',
    title: 'Your free Expansion Quotient',
    sub: 'Fourteen reflective questions, about four minutes. Share a few details and your personalised results will come straight to your inbox.',
    steps: ['Your details', 'The questions <small>~4 min</small>', 'Results by email'],
    phoneRequired: false,
    button: 'Begin my Expansion Quotient →',
    fine: 'Completely free. Your details stay private, and your results come straight to your inbox.',
    pixel: 'Free Expansion Quotient',
  },
};


// ── DOM Creation ─────────────────────────────────────────────

let modalEl = null;
let lastTrigger = null;
let mode = 'call';
let onDone = null;
let autoOpened = false;   // the current pop-up opened by itself (see autoOpen)

function createModal() {
  if (modalEl) return modalEl;

  const overlay = document.createElement('div');
  overlay.className = 'bk-overlay';
  overlay.id = 'bookingOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'bk-title');

  overlay.innerHTML = `
    <div class="bk-modal">
      <button class="bk-close" aria-label="Close" type="button">&times;</button>

      <div class="bk-header">
        <span class="bk-eyebrow" id="bk-eyebrow"></span>
        <h2 class="bk-title" id="bk-title"></h2>
        <p class="bk-sub" id="bk-sub"></p>
        <ol class="bk-steps" id="bk-steps" aria-label="How it works"></ol>
      </div>

      <form class="bk-form" id="bookingForm" novalidate>
        <div class="bk-row">
          <div class="bk-field">
            <label for="bk-fn">First name *</label>
            <input id="bk-fn" name="firstName" type="text" required autocomplete="given-name" placeholder="Your name">
          </div>
          <div class="bk-field">
            <label for="bk-ln">Last name *</label>
            <input id="bk-ln" name="lastName" type="text" required autocomplete="family-name" placeholder="Your surname">
          </div>
        </div>

        <div class="bk-row">
          <div class="bk-field">
            <label for="bk-email">Email *</label>
            <input id="bk-email" name="email" type="email" required autocomplete="email" placeholder="you@email.com">
          </div>
          <div class="bk-field">
            <label for="bk-phone">Phone / WhatsApp <span id="bk-phone-req">*</span></label>
            <input id="bk-phone" name="phone" type="tel" autocomplete="tel" placeholder="+91…">
          </div>
        </div>

        <div class="bk-row">
          <div class="bk-field">
            <label for="bk-country">Country *</label>
            <select id="bk-country" name="country" required>
              <option value="">Select your country</option>
              ${COUNTRIES.map(c =>
                c.startsWith('──')
                  ? `<option disabled>───────────</option>`
                  : `<option value="${c}">${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="bk-field">
            <label for="bk-role">Role / Title *</label>
            <input id="bk-role" name="role" type="text" required autocomplete="organization-title" placeholder="e.g. Founder, Director">
          </div>
        </div>

        <div class="bk-row">
          <div class="bk-field">
            <label for="bk-company">Company <span class="bk-opt">(optional)</span></label>
            <input id="bk-company" name="company" type="text" autocomplete="organization" placeholder="Your business">
          </div>
          <div class="bk-field">
            <label for="bk-li">LinkedIn <span class="bk-opt">(optional)</span></label>
            <input id="bk-li" name="linkedin" type="text" placeholder="linkedin.com/in/you">
          </div>
        </div>

        <label class="bk-consent">
          <input type="checkbox" id="bk-consent" name="consent">
          <span>I'd also like to receive Tejal's insights on identity, wealth and living from wholeness. I can unsubscribe anytime.</span>
        </label>

        <div class="bk-err" id="bk-err" role="alert"></div>

        <button class="btn btn-em bk-submit" type="submit" id="bk-submit">
          Continue to my Expansion Quotient →
        </button>

        <p class="bk-fine" id="bk-fine"></p>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  modalEl = overlay;

  overlay.querySelector('.bk-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', handleKeydown);
  overlay.querySelector('#bookingForm').addEventListener('submit', handleSubmit);

  return overlay;
}


// ── Open / Close ─────────────────────────────────────────────

/**
 * @param {Element} [trigger]  what was clicked (focus returns here on close)
 * @param {{mode?: 'call'|'eq', onDone?: (contact) => void}} [opts]
 *   onDone: stay on this page and hand over the details instead of
 *   navigating to the assessment (used on the assessment page itself).
 */
function openModal(trigger, opts = {}) {
  const modal = createModal();
  const form = modal.querySelector('#bookingForm');
  lastTrigger = trigger || null;
  mode = opts.mode === 'eq' ? 'eq' : 'call';
  onDone = typeof opts.onDone === 'function' ? opts.onDone : null;
  applyMode(modal);

  form.reset();
  modal.querySelector('#bk-err').textContent = '';
  setBusy(false);

  // Coming back to it in the same session — don't make them type it all again.
  const saved = loadContact();
  if (saved) {
    for (const [k, v] of Object.entries(saved)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!v;
      else if (typeof v === 'string') el.value = v;
    }
  }

  requestAnimationFrame(() => {
    modal.classList.add('bk-open');
    document.body.style.overflow = 'hidden';
    // The overlay fades in through `visibility`; at the instant the class
    // lands it is still hidden and the browser refuses focus. Wait a beat.
    const first = modal.querySelector('#bk-fn');
    const focusFirst = () => { if (document.activeElement !== first) first.focus({ preventScroll: true }); };
    setTimeout(focusFirst, 60);
    setTimeout(focusFirst, 360); // after the fade, in case the first try was too early
  });

  if (typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', { content_name: MODES[mode].pixel });
  }
}

function applyMode(modal) {
  const m = MODES[mode];
  modal.querySelector('#bk-eyebrow').textContent = m.eyebrow;
  modal.querySelector('#bk-title').textContent = m.title;
  modal.querySelector('#bk-sub').textContent = m.sub;
  modal.querySelector('#bk-steps').innerHTML = m.steps
    .map((t, i) => '<li' + (i === 0 ? ' class="on"' : '') + '><b>' + (i + 1) + '</b>' + t + '</li>').join('');
  modal.querySelector('#bk-fine').textContent = m.fine;
  modal.querySelector('#bk-phone-req').innerHTML = m.phoneRequired ? '*' : '<span class="bk-opt">(optional)</span>';
  modal.querySelector('#bk-phone').required = m.phoneRequired;
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.remove('bk-open');
  document.body.style.overflow = '';
  // Closed the one that opened by itself: don't show it again this visit.
  if (autoOpened) {
    autoOpened = false;
    try { sessionStorage.setItem('tejal_autopop_dismissed', '1'); } catch { /* private mode */ }
  }
  if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
}

function handleKeydown(e) {
  if (!modalEl?.classList.contains('bk-open')) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Tab') return;
  // Keep Tab inside the dialog while it's open, rather than wandering off
  // into the page behind the overlay.
  const items = [...modalEl.querySelectorAll('button, [href], input, select, textarea')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!modalEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}


// ── Form Handling ────────────────────────────────────────────

function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('bk-err');
  const v = (name) => form.elements[name].value.trim();

  const contact = {
    firstName: v('firstName'),
    lastName:  v('lastName'),
    email:     v('email'),
    phone:     v('phone'),
    country:   form.elements.country.value,
    role:      v('role'),
    company:   v('company'),
    linkedin:  v('linkedin'),
    consent:   form.elements.consent.checked,
  };

  const problem =
    !contact.firstName ? ['firstName', 'Please enter your first name.'] :
    !contact.lastName ? ['lastName', 'Please enter your last name.'] :
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? ['email', 'Please enter a valid email address.'] :
    (MODES[mode].phoneRequired || contact.phone) && contact.phone.replace(/\D/g, '').length < 7 ? ['phone', 'Please enter a phone number we can reach you on.'] :
    !contact.country ? ['country', 'Please select your country.'] :
    !contact.role ? ['role', 'Please tell us your role or title.'] :
    null;

  if (problem) {
    errEl.textContent = problem[1];
    form.elements[problem[0]].focus();
    return;
  }
  errEl.textContent = '';

  const program = lastTrigger?.closest('[data-program]')?.dataset.program
    || document.querySelector('#book[data-program]')?.dataset.program
    || '';

  // Someone who asked for a call earlier in the visit keeps that request.
  const askedForCall = mode === 'call' || loadContact()?.origin === 'book-call';
  const saved = { ...contact, origin: askedForCall ? 'book-call' : 'assessment', program };
  saveContact(saved);

  if (onDone) {
    closeModal();
    onDone(saved);
    return;
  }
  setBusy(true);
  window.location.href = ASSESSMENT_URL;
}

function setBusy(busy) {
  const btn = document.getElementById('bk-submit');
  if (!btn) return;
  btn.disabled = busy;
  btn.setAttribute('aria-busy', String(busy));   // shows the spinner (site-premium.css)
  btn.textContent = busy ? 'One moment…' : MODES[mode].button;
}


// ── Auto-wire all booking CTAs ───────────────────────────────

function init() {
  captureSource();

  const selectors = '[data-book-call], [data-pay], a[href="#book"], a[href*="rzp.io/rzp/expansion369"]';
  document.querySelectorAll(selectors).forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(el);
    });
    if (el.tagName === 'A') {
      el.removeAttribute('target');
      el.removeAttribute('rel');
    }
  });

  document.querySelectorAll('[data-take-eq], a[href="#eq"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(el, { mode: 'eq' });
    });
  });

  // Arriving from another page's link (index.html#book or #eq) — open straight away.
  if (location.hash === '#book' || location.hash === '#eq') {
    const m = location.hash === '#eq' ? 'eq' : 'call';
    history.replaceState(null, '', location.pathname + location.search);
    openModal(null, { mode: m });
    return;
  }

  autoOpen();
}

// ── Opens by itself on pages that ask for it ─────────────────
// <body data-auto-popup="eq"> (or "call"). Waits a moment so the page is
// seen first, and stays away from anyone who has already given their
// details, already taken the assessment, or closed it once this visit.
const AUTO_DISMISSED_KEY = 'tejal_autopop_dismissed';
const AUTO_DELAY_MS = 1500;

function autoOpen() {
  const want = document.body.dataset.autoPopup;
  if (want !== 'eq' && want !== 'call') return;
  if (loadContact()?.email || loadSubmitted()) return;
  try { if (sessionStorage.getItem(AUTO_DISMISSED_KEY)) return; } catch { /* private mode */ }

  setTimeout(() => {
    if (modalEl?.classList.contains('bk-open')) return; // they already opened it themselves
    openModal(null, { mode: want });
    autoOpened = true;
  }, AUTO_DELAY_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { openModal, closeModal };
