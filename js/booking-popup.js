/**
 * booking-popup.js — the "book a free call" form, on every page
 *
 *   Any booking button → this pop-up → details sent → thank-you, right here.
 *
 * [data-book-call], [data-pay], a #book link (and any old [data-take-eq] /
 * #eq link) opens it. The request goes out through lead-service.js: an email
 * to hello@tejaldesae.com, the Google Sheet and the marketing platform —
 * the same route as the "Have a question?" form. The team then contacts the
 * visitor to arrange a time.
 */

import { saveContact, loadContact, captureSource, loadSource } from './eq-flow.js?v=20261014c';
import { sendLead } from './lead-service.js?v=20261014c';

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

const COPY = {
  eyebrow: 'Free · 45 minutes · one-on-one on Zoom',
  title: 'Book your free call',
  sub: 'Share a few details and our team will be in touch within two working days to find a time that suits you.',
  button: 'Request my free call →',
  fine: 'No payment, no obligation. Your details stay private.',
  pixel: 'Free Expansion Call',   // unchanged so ad reporting stays continuous
};


// ── DOM Creation ─────────────────────────────────────────────

let modalEl = null;
let lastTrigger = null;
let autoOpened = false;   // the current pop-up opened by itself (see autoOpen)

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

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

      <div class="bk-view" id="bk-form-view">
        <div class="bk-header">
          <span class="bk-eyebrow">${COPY.eyebrow}</span>
          <h2 class="bk-title" id="bk-title">${COPY.title}</h2>
          <p class="bk-sub">${COPY.sub}</p>
        </div>

        <form class="bk-form" id="bookingForm" novalidate>
          <div class="bk-row">
            <div class="bk-field">
              <label for="bk-fn">First name *</label>
              <input id="bk-fn" name="firstName" type="text" required autocomplete="given-name" placeholder="Your name">
            </div>
            <div class="bk-field">
              <label for="bk-ln">Last name</label>
              <input id="bk-ln" name="lastName" type="text" autocomplete="family-name" placeholder="Your surname">
            </div>
          </div>

          <div class="bk-row">
            <div class="bk-field">
              <label for="bk-email">Email *</label>
              <input id="bk-email" name="email" type="email" required autocomplete="email" placeholder="you@email.com">
            </div>
            <div class="bk-field">
              <label for="bk-phone">Phone / WhatsApp *</label>
              <input id="bk-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+91…">
            </div>
          </div>

          <div class="bk-field">
            <label for="bk-country">Country *</label>
            <select id="bk-country" name="country" required>
              <option value="">Select your country</option>
              ${COUNTRIES.map((c) =>
                c.startsWith('──')
                  ? '<option disabled>───────────</option>'
                  : `<option value="${c}">${c}</option>`
              ).join('')}
            </select>
          </div>

          <div class="bk-field">
            <label for="bk-msg">What would you like to talk about? <span class="bk-opt">(optional)</span></label>
            <textarea id="bk-msg" name="message" rows="3" placeholder="A line or two is plenty."></textarea>
          </div>

          <!-- spam trap: people never see or fill this -->
          <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"
                 style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">

          <label class="bk-consent">
            <input type="checkbox" id="bk-consent" name="consent">
            <span>I’d also like to receive Tejal’s insights on identity, wealth and living from wholeness. I can unsubscribe anytime.</span>
          </label>

          <div class="bk-err" id="bk-err" role="alert"></div>

          <button class="btn btn-em bk-submit" type="submit" id="bk-submit">${COPY.button}</button>

          <p class="bk-fine">${COPY.fine}</p>
        </form>
      </div>

      <div class="bk-view bk-success" id="bk-done-view" hidden>
        <div class="bk-check-icon" aria-hidden="true">✓</div>
        <h3 id="bk-done-title" tabindex="-1">Thank you</h3>
        <p id="bk-done-text"></p>
        <button class="btn btn-em" type="button" id="bk-done-close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  modalEl = overlay;

  overlay.querySelector('.bk-close').addEventListener('click', closeModal);
  overlay.querySelector('#bk-done-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', handleKeydown);
  overlay.querySelector('#bookingForm').addEventListener('submit', handleSubmit);

  return overlay;
}


// ── Open / Close ─────────────────────────────────────────────

/** @param {Element} [trigger]  what was clicked (focus returns here on close) */
function openModal(trigger) {
  const modal = createModal();
  const form = modal.querySelector('#bookingForm');
  lastTrigger = trigger || null;

  showView('form');
  form.reset();
  modal.querySelector('#bk-err').textContent = '';
  setBusy(false);

  // Coming back to it in the same visit — don't make them type it all again.
  const saved = loadContact();
  if (saved) {
    for (const [k, v] of Object.entries(saved)) {
      const el = form.elements[k];
      if (!el || k === 'message') continue;
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
    window.fbq('track', 'InitiateCheckout', { content_name: COPY.pixel });
  }
}

function showView(which) {
  modalEl.querySelector('#bk-form-view').hidden = which !== 'form';
  modalEl.querySelector('#bk-done-view').hidden = which !== 'done';
  modalEl.setAttribute('aria-labelledby', which === 'done' ? 'bk-done-title' : 'bk-title');
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
  const items = [...modalEl.querySelectorAll('button, [href], input:not([tabindex="-1"]), select, textarea')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!modalEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}


// ── Form Handling ────────────────────────────────────────────

async function handleSubmit(e) {
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
    message:   v('message'),
    consent:   form.elements.consent.checked,
  };

  const problem =
    !contact.firstName ? ['firstName', 'Please enter your first name.'] :
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? ['email', 'Please enter a valid email address.'] :
    contact.phone.replace(/\D/g, '').length < 7 ? ['phone', 'Please enter a phone or WhatsApp number we can reach you on.'] :
    !contact.country ? ['country', 'Please select your country.'] :
    null;

  if (problem) {
    errEl.textContent = problem[1];
    form.elements[problem[0]].focus();
    return;
  }
  errEl.textContent = '';

  // A bot filled the hidden field: pretend it worked, send nothing.
  if (form.elements.website.value) { showDone(contact); return; }

  const program = lastTrigger?.closest('[data-program]')?.dataset.program
    || document.querySelector('#book[data-program]')?.dataset.program
    || '';
  saveContact({ ...contact, program });

  const src = loadSource();
  setBusy(true);
  let result = null;
  try {
    result = await sendLead({
      source: 'Free Call Request',
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      program: program || 'Free call',
      message: contact.message,
      extraFields: {
        'Country': contact.country,
        'Marketing Consent': contact.consent ? 'Yes' : 'No',
        'Page': location.pathname,
        'First Landing': src.landing || '',
        'Campaign': [src.utm_source, src.utm_medium, src.utm_campaign].filter(Boolean).join(' / '),
      },
    });
  } catch { /* handled below */ }
  setBusy(false);

  // Sent if the email or the sheet took it (a repeat click counts as sent).
  if (result && (result.email || result.sheet || result.reason === 'duplicate')) {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: COPY.pixel });
    }
    showDone(contact);
  } else {
    errEl.textContent = 'Sorry, that didn’t go through. Please try again, or email hello@tejaldesae.com.';
  }
}

function showDone(contact) {
  const reach = contact.phone ? `on <b class="bk-nowrap">${esc(contact.phone)}</b> or ` : '';
  modalEl.querySelector('#bk-done-title').textContent = `Thank you, ${contact.firstName}.`;
  modalEl.querySelector('#bk-done-text').innerHTML =
    `We’ve got your request. Our team will be in touch within two working days ${reach}at <b class="bk-nowrap">${esc(contact.email)}</b> to arrange a time that suits you.`;
  showView('done');
  modalEl.querySelector('#bk-done-title').focus({ preventScroll: true });
}

function setBusy(busy) {
  const btn = document.getElementById('bk-submit');
  if (!btn) return;
  btn.disabled = busy;
  btn.setAttribute('aria-busy', String(busy));   // shows the spinner (site-premium.css)
  btn.textContent = busy ? 'Sending…' : COPY.button;
}


// ── Auto-wire all booking buttons ────────────────────────────

function init() {
  captureSource();

  const selectors = '[data-book-call], [data-pay], [data-take-eq], a[href="#book"], a[href="#eq"], a[href*="rzp.io/rzp/expansion369"]';
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

  // Arriving from another page's link (index.html#book) — open straight away.
  if (location.hash === '#book' || location.hash === '#eq') {
    history.replaceState(null, '', location.pathname + location.search);
    openModal(null);
    return;
  }

  autoOpen();
}

// ── Opens by itself on pages that ask for it ─────────────────
// <body data-auto-popup="call">. Waits a moment so the page is seen first,
// and stays away from anyone who closed it once this visit.
const AUTO_DISMISSED_KEY = 'tejal_autopop_dismissed';
const AUTO_DELAY_MS = 1500;

function autoOpen() {
  if (!document.body.dataset.autoPopup) return;
  try { if (sessionStorage.getItem(AUTO_DISMISSED_KEY)) return; } catch { /* private mode */ }

  setTimeout(() => {
    if (modalEl?.classList.contains('bk-open')) return; // they already opened it themselves
    openModal(null);
    autoOpened = true;
  }, AUTO_DELAY_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { openModal, closeModal };
