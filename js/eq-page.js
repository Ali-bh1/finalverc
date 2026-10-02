/**
 * eq-page.js — the Expansion Quotient assessment (eq-t1uqlm.html)
 *
 * Steps: intro (details pop-up opens on arrival) → Q1–Q11 → Q12 desires → Q13 intent → Q14 six-month
 * vision → contact (skipped when the booking popup already has it) →
 * confirmation.
 *
 * Each step is a history entry, so the phone's back button steps back a
 * question instead of leaving the page, and progress survives a reload.
 */

import {
  QUESTIONS, DESIRE_OPTIONS, INTENT_OPTIONS, VISION_QUESTION, TERRITORY_NAMES, scoreAnswers,
} from './eq-core.js';
import { loadContact, captureSource, loadSource, markSubmitted } from './eq-flow.js';
import { sendLead } from './lead-service.js';
import { openModal } from './booking-popup.js';

const INTRO = -1;
const Q_DESIRES = 11;
const Q_INTENT = 12;
const Q_VISION = 13;
const CONTACT = 14;
const CONFIRM = 15;
const TOTAL_QUESTIONS = 14;

const PROGRESS_KEY = 'tejal_eq_progress';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const $ = (id) => document.getElementById(id);

let state = {
  step: INTRO,
  answers: new Array(QUESTIONS.length).fill(null), // option index 0–3
  desires: [],
  intent: null,
  vision: '',
};
let advancing = false;   // blocks double-taps during the auto-advance pause
let submitted = false;


// ── Persistence ──────────────────────────────────────────────

function saveProgress() {
  try { sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function restoreProgress() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROGRESS_KEY));
    if (saved && Array.isArray(saved.answers) && saved.answers.length === QUESTIONS.length) {
      state = { ...state, ...saved, step: Math.min(saved.step, CONTACT) };
    }
  } catch { /* ignore */ }
}
function clearProgress() {
  try { sessionStorage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
}


// ── Navigation ───────────────────────────────────────────────

function go(step) {
  const depth = (history.state?.depth || 0) + 1;
  state.step = step;
  saveProgress();
  history.pushState({ eq: step, depth }, '');
  render();
}

// Our own Back buttons. Use real history when there is some to go back
// through; after a reload there isn't, so step back in place instead of
// letting history.back() leave the page.
function back() {
  if (history.state?.depth > 0) return history.back();
  state.step = Math.max(INTRO, state.step - 1);
  saveProgress();
  history.replaceState({ eq: state.step, depth: 0 }, '');
  render();
}

window.addEventListener('popstate', (e) => {
  if (submitted) {
    // Nothing to go back to once it's sent — stay on the thank-you.
    history.pushState({ eq: CONFIRM, depth: 0 }, '');
    return;
  }
  state.step = typeof e.state?.eq === 'number' ? e.state.eq : INTRO;
  saveProgress();
  render();
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}

function render() {
  advancing = false;
  const { step } = state;
  if (step === INTRO) return showScreen('s-intro');
  if (step === CONTACT) { prefillContact(); return showScreen('s-contact'); }
  if (step === CONFIRM) return showScreen('s-confirm');
  showScreen('s-quiz');
  renderQuestion();
}


// ── Questions ────────────────────────────────────────────────

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderQuestion() {
  const { step } = state;
  $('bar').style.width = (step / TOTAL_QUESTIONS * 100) + '%';
  $('backBtn').hidden = false;
  $('qcount').textContent = `Question ${step + 1} of ${TOTAL_QUESTIONS}`;

  const box = el('div', 'qbox');
  const mount = $('qmount');

  if (step < Q_DESIRES) {
    const q = QUESTIONS[step];
    box.append(el('h2', null, q.q));
    q.o.forEach((text, idx) => {
      const b = el('button', 'opt' + (state.answers[step] === idx ? ' sel' : ''), text);
      b.type = 'button';
      b.addEventListener('click', () => choose(b, () => { state.answers[step] = idx; }));
      box.append(b);
    });

  } else if (step === Q_DESIRES) {
    // The turn from "what's in the way" to "what you want": marked by the
    // heading colour only, so the screen stays in the same family as the rest.
    box.classList.add('qbox-desire');
    box.append(el('h2', null, 'If nothing had to be wrong with your current life for you to desire more from it… what would you want MORE of?'));
    const hint = el('p', null, 'Select all that apply');
    hint.style.cssText = 'font-size:13px;opacity:.6;margin:-18px 0 20px;font-style:italic';
    box.append(hint);
    const wrap = el('div', 'multi-wrap');
    DESIRE_OPTIONS.forEach((opt) => {
      const b = el('button', 'multi-opt' + (state.desires.includes(opt) ? ' sel' : ''), opt);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.desires.includes(opt)));
      b.addEventListener('click', () => {
        const i = state.desires.indexOf(opt);
        if (i > -1) state.desires.splice(i, 1); else state.desires.push(opt);
        b.classList.toggle('sel', i === -1);
        b.setAttribute('aria-pressed', String(i === -1));
        saveProgress();
      });
      wrap.append(b);
    });
    box.append(wrap, continueBtn(() => go(Q_INTENT)));

  } else if (step === Q_INTENT) {
    box.append(el('h2', null, 'If your results show an area of your life that is ready for deeper expansion, what would you most want next?'));
    INTENT_OPTIONS.forEach(([key, text]) => {
      const b = el('button', 'opt' + (state.intent === key ? ' sel' : ''), text);
      b.type = 'button';
      b.addEventListener('click', () => choose(b, () => { state.intent = key; }));
      box.append(b);
    });

  } else if (step === Q_VISION) {
    const kicker = el('span', 'eyebrow', 'One last question');
    kicker.style.cssText = 'display:block;margin-bottom:10px';
    box.append(kicker, el('h2', null, VISION_QUESTION));
    const ta = el('textarea', 'open-text');
    ta.id = 'q14text';
    ta.placeholder = 'Take your time with this one…';
    ta.maxLength = 3000;
    ta.value = state.vision;
    ta.addEventListener('input', () => { state.vision = ta.value; saveProgress(); });
    const btn = continueBtn(finishQuestions);
    btn.style.marginTop = '20px';
    box.append(ta, btn);
  }

  mount.replaceChildren(box);
}

function continueBtn(onClick) {
  const b = el('button', 'btn btn-em', 'Continue →');
  b.type = 'button';
  b.style.marginTop = '10px';
  b.addEventListener('click', onClick);
  return b;
}

// Single-select: show the choice, pause briefly, move on. One tap only.
function choose(button, record) {
  if (advancing) return;
  advancing = true;
  record();
  saveProgress();
  button.parentElement.querySelectorAll('.opt').forEach((o) => o.classList.toggle('sel', o === button));
  setTimeout(() => go(state.step + 1), 380);
}

function finishQuestions() {
  const missing = state.answers.findIndex((a) => a === null);
  if (missing > -1) return go(missing);
  if (!state.intent) return go(Q_INTENT);

  $('bar').style.width = '100%';
  const known = loadContact();
  if (known && known.firstName && EMAIL_RE.test(known.email || '')) {
    submit(known);
  } else {
    go(CONTACT);
  }
}


// ── Contact (only when they didn't come through the popup) ───

function prefillContact() {
  const c = loadContact();
  if (!c) return;
  const map = { fn: 'firstName', ln: 'lastName', em: 'email', ph: 'phone', co: 'country', rl: 'role', bz: 'company', li: 'linkedin' };
  for (const [id, key] of Object.entries(map)) if (c[key] && !$(id).value) $(id).value = c[key];
}

function readContactForm() {
  const v = (id) => $(id).value.trim();
  const c = {
    firstName: v('fn'), lastName: v('ln'), email: v('em'), phone: v('ph'),
    country: $('co').value, role: v('rl'), company: v('bz'), linkedin: v('li'),
    consent: $('mc').checked,
  };
  const problem =
    !c.firstName ? ['fn', 'Please enter your first name.'] :
    !c.lastName ? ['ln', 'Please enter your last name.'] :
    !EMAIL_RE.test(c.email) ? ['em', 'Please enter a valid email address.'] :
    !c.country ? ['co', 'Please select your country.'] :
    !c.role ? ['rl', 'Please tell us your role or title.'] :
    null;
  if (problem) {
    $('capErr').textContent = problem[1];
    $(problem[0]).focus();
    return null;
  }
  $('capErr').textContent = '';
  return c;
}


// ── Submit ───────────────────────────────────────────────────

function submit(contact) {
  if (submitted) return;
  submitted = true;
  $('submitBtn').disabled = true;

  const origin = contact.origin === 'book-call' ? 'book-call' : 'direct';
  const meta = { ...loadSource(), program: contact.program || sessionStorage.getItem('tejal_program') || '' };
  const payload = {
    contact: {
      firstName: contact.firstName, lastName: contact.lastName || '', email: contact.email,
      phone: contact.phone || '', country: contact.country || '', role: contact.role || '',
      company: contact.company || '', linkedin: contact.linkedin || '', consent: !!contact.consent,
    },
    answers: state.answers,
    desires: state.desires,
    intent: state.intent,
    vision: state.vision.trim(),
    origin,
    meta,
    website: $('hp').value,
  };

  const result = scoreAnswers(state.answers);
  const letters = state.answers.map((a) => 'ABCD'[a] || '-').join(', ');
  // fallback=false: sheet + marketing only. fallback=true: team email only.
  const lead = (fallback) => sendLead({
    notify: fallback,
    emailOnly: fallback,
    source: origin === 'book-call' ? 'Expansion Quotient (Call Request)' : 'Expansion Quotient',
    firstName: payload.contact.firstName,
    lastName: payload.contact.lastName,
    email: payload.contact.email,
    phone: payload.contact.phone,
    program: 'expansion-quotient',
    archetype: TERRITORY_NAMES[result.dominant],
    scores: Object.fromEntries(Object.entries(result.averages).map(([k, v]) => [TERRITORY_NAMES[k], +v.toFixed(2)])),
    quizAnswers: letters,
    message: payload.vision,
    extraFields: {
      'Country': payload.contact.country,
      'Role': payload.contact.role,
      'Company': payload.contact.company,
      'LinkedIn': payload.contact.linkedin,
      'Marketing Consent': payload.contact.consent ? 'Yes' : 'No',
      'Expansion Edge': TERRITORY_NAMES[result.dominant] + (result.secondary ? ' + ' + TERRITORY_NAMES[result.secondary] : ''),
      'Wants More Of (Q12)': payload.desires.join(', ') || 'None selected',
      'Conversation Intent (Q13)': payload.intent || 'Not answered',
      'Six-Month Vision (Q14)': payload.vision || 'Not answered',
      'Arrived Via': origin === 'book-call' ? 'Book-a-call popup' : 'Assessment directly',
    },
  }).catch(() => {});

  // Sheet + marketing platform straight away; the email to the team comes
  // from /api/eq-submit. Only if that fails does Web3Forms notify instead.
  lead(false);
  fetch('/api/eq-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((res) => { if (!res.owner) lead(true); })
    .catch(() => lead(true));

  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', { content_name: 'Expansion Quotient' });
  }

  markSubmitted(payload.contact.email);
  clearProgress();

  // Thank-you copy
  $('cfEmail').textContent = payload.contact.email;
  if (origin === 'book-call') {
    const phone = payload.contact.phone ? ` on ${payload.contact.phone}` : '';
    $('cfNext').textContent = `Our team will be in touch within two working days to arrange your free Expansion Call with Tejal. We'll either call you${phone} or email you a link to choose a time that suits you.`;
  }

  state.step = CONFIRM;
  history.replaceState({ eq: CONFIRM, depth: 0 }, '');
  render();
}


// ── Init ─────────────────────────────────────────────────────

captureSource();
const pp = new URLSearchParams(location.search).get('program');
if (pp) sessionStorage.setItem('tejal_program', pp);

const known = loadContact();
if (known?.firstName) $('introEyebrow').textContent = `Welcome, ${known.firstName}`;

const hasContact = () => {
  const c = loadContact();
  return !!(c?.firstName && EMAIL_RE.test(c.email || ''));
};

// No details yet (came here directly): ask for them first, in the same pop-up
// the homepage uses, then start. Arriving from the pop-up skips straight in.
function askForDetails() {
  openModal($('beginBtn'), {
    mode: 'eq',
    onDone: (saved) => {
      $('introEyebrow').textContent = 'Welcome, ' + saved.firstName;
      go(0);
    },
  });
}

$('beginBtn').addEventListener('click', () => (hasContact() ? go(0) : askForDetails()));
$('backBtn').addEventListener('click', back);
$('capBack').addEventListener('click', back);
$('submitBtn').addEventListener('click', () => {
  const c = readContactForm();
  if (c) submit(c);
});

restoreProgress();
history.replaceState({ eq: state.step, depth: 0 }, '');
render();

// Ad traffic lands here: put the details pop-up up straight away rather than
// waiting for them to find "Begin". Closing it leaves the intro and Begin.
if (state.step === INTRO && !hasContact()) askForDetails();
