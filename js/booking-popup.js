/**
 * booking-popup.js — Modal form for free call booking
 *
 * Replaces the old Razorpay payment flow. When any CTA with
 * [data-book-call] or the old [data-pay] attribute is clicked,
 * this modal opens and captures client details before redirecting
 * to the calendar booking page (cb-x7r9.html).
 *
 * Depends on: lead-service.js (sendLead)
 */

import { sendLead } from './lead-service.js';

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
  'Zambia', 'Zimbabwe',
];

// ── Role/description options ─────────────────────────────────
const ROLES = [
  'I run my own business',
  'I\'m employed / in a leadership role',
  'I\'m a coach, consultant or practitioner',
  'I\'m about to start out on my own',
  'Something else',
];

// ── Booking calendar URL ─────────────────────────────────────
const CALENDAR_URL = 'cb-x7r9.html';


// ── DOM Creation ─────────────────────────────────────────────

let modalEl = null;
let isSubmitting = false;

function createModal() {
  if (modalEl) return modalEl;

  const overlay = document.createElement('div');
  overlay.className = 'bk-overlay';
  overlay.id = 'bookingOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Book your free Expansion Call');

  overlay.innerHTML = `
    <div class="bk-modal">
      <button class="bk-close" aria-label="Close booking form" type="button">&times;</button>

      <div class="bk-header">
        <span class="bk-eyebrow">Your Expansion Call</span>
        <h2 class="bk-title">Book your free call with Tejal</h2>
        <p class="bk-sub">45 minutes, one-on-one. Fill in your details and pick a time that suits you.</p>
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
            <label for="bk-phone">Phone / WhatsApp *</label>
            <input id="bk-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+91…">
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
            <label for="bk-role">What best describes you? *</label>
            <select id="bk-role" name="role" required>
              <option value="">Select one</option>
              ${ROLES.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="bk-field">
          <label for="bk-msg">What's going on for you right now? <span class="bk-opt">(optional)</span></label>
          <textarea id="bk-msg" name="message" rows="3" placeholder="A few lines is plenty."></textarea>
        </div>

        <label class="bk-consent">
          <input type="checkbox" id="bk-consent" name="consent">
          <span>I agree to receive emails and, optionally, WhatsApp messages from tejaldesae.com.</span>
        </label>

        <div class="bk-err" id="bk-err"></div>

        <button class="btn btn-em bk-submit" type="submit" id="bk-submit">
          Book my free call →
        </button>

        <p class="bk-fine">Free, always. No payment required. You'll pick your time on the next screen.</p>
      </form>

      <!-- Success state (hidden by default) -->
      <div class="bk-success" id="bk-success" hidden>
        <div class="bk-check-icon">✓</div>
        <h3>You're in — your call is being set up.</h3>
        <p>Redirecting you to pick your time slot…</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  modalEl = overlay;

  // ── Event bindings ──
  const closeBtn = overlay.querySelector('.bk-close');
  const form = overlay.querySelector('#bookingForm');

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', handleEsc);
  form.addEventListener('submit', handleSubmit);

  return overlay;
}


// ── Open / Close ─────────────────────────────────────────────

function openModal() {
  const modal = createModal();
  // Reset form state
  const form = modal.querySelector('#bookingForm');
  const success = modal.querySelector('#bk-success');
  form.reset();
  form.hidden = false;
  success.hidden = true;
  modal.querySelector('#bk-err').textContent = '';
  isSubmitting = false;
  updateSubmitButton(false);

  // Show
  requestAnimationFrame(() => {
    modal.classList.add('bk-open');
    document.body.style.overflow = 'hidden';
    // Focus first input
    modal.querySelector('#bk-fn').focus();
  });

  // Track in Meta Pixel
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', {
      content_name: 'Free Expansion Call',
    });
  }
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.remove('bk-open');
  document.body.style.overflow = '';
}

function handleEsc(e) {
  if (e.key === 'Escape' && modalEl?.classList.contains('bk-open')) {
    closeModal();
  }
}


// ── Form Handling ────────────────────────────────────────────

function handleSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const form = e.target;
  const errEl = document.getElementById('bk-err');
  errEl.textContent = '';

  // Validation
  const firstName = form.firstName.value.trim();
  const lastName = form.lastName.value.trim();
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  const country = form.country.value;
  const role = form.role.value;

  if (!firstName) { showError(errEl, 'Please enter your first name.'); return; }
  if (!lastName) { showError(errEl, 'Please enter your last name.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(errEl, 'Please enter a valid email address.'); return; }
  if (!phone) { showError(errEl, 'Please enter your phone number.'); return; }
  if (!country) { showError(errEl, 'Please select your country.'); return; }
  if (!role) { showError(errEl, 'Please tell us what describes you.'); return; }

  // Submit
  isSubmitting = true;
  updateSubmitButton(true);

  const leadData = {
    source: 'Call Booking Form',
    firstName,
    lastName,
    email,
    phone,
    program: 'expansion-call',
    message: form.message.value.trim(),
    extraFields: {
      'Country': country,
      'Role': role,
      'Marketing Consent': form.consent.checked ? 'Yes' : 'No',
    },
  };

  sendLead(leadData)
    .then(() => showSuccess())
    .catch(() => showSuccess()); // Still redirect — lead capture is fire-and-forget
}

function showError(errEl, msg) {
  errEl.textContent = msg;
  errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateSubmitButton(loading) {
  const btn = document.getElementById('bk-submit');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Sending…' : 'Book my free call →';
}

function showSuccess() {
  const form = document.getElementById('bookingForm');
  const success = document.getElementById('bk-success');
  form.hidden = true;
  success.hidden = false;

  // Redirect to calendar after short delay
  setTimeout(() => {
    window.location.href = CALENDAR_URL;
  }, 1800);
}


// ── Auto-wire all booking CTAs ───────────────────────────────

function init() {
  // Wire up all elements that should open the booking popup
  const selectors = '[data-book-call], [data-pay], a[href*="rzp.io/rzp/expansion369"]';
  document.querySelectorAll(selectors).forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });

    // Update href so it doesn't navigate away if JS fails
    if (el.tagName === 'A') {
      el.href = '#book';
      el.removeAttribute('target');
      el.removeAttribute('rel');
    }
  });

  // Also wire anchor links that scroll to the old booking section
  // (only on index.html where the booking section exists)
  const bookSection = document.getElementById('book');
  if (bookSection) {
    document.querySelectorAll('a[href="#book"]').forEach((el) => {
      // Only intercept if it's a CTA button, not a regular nav link
      if (el.classList.contains('btn') || el.classList.contains('ncta')) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          openModal();
        });
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for testing
export { openModal, closeModal };
