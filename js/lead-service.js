/**
 * lead-service.js — Shared lead capture (Web3Forms email + Google Sheets)
 *
 * Every form on the site calls sendLead() to:
 *   1. Email the lead to hello@tejaldesae.com via Web3Forms
 *   2. Log the lead to a Google Sheet via Apps Script
 *
 * Both fire in parallel. One failing does not block the other.
 */

// ── Configuration ────────────────────────────────────────────
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_KEY      = '5eb90167-6d6e-4872-9d00-1d73aee4786b';

// TODO: Replace with your deployed Google Apps Script Web App URL
// See docs/google-sheets-script.js for setup instructions
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwDYvs-fPOk-sqfQ0c582G2eg0yw5s5EQwYIAWkpzRW51QEoFGAG7E0wmdndfvtMvQ3/exec';

// Marketing automation platform (Tejal's lead capture webhook)
// Non-blocking — failures are logged but never block the user flow
const MARKETING_WEBHOOK_URL = 'https://api.advancedlifecoaching.in/functions/v1/lead-capture/tejal-desae-b9e51bbcd863';

// ── Program display names ────────────────────────────────────
const PROGRAM_NAMES = {
  'money-energetics':       'Money Energetics (€555)',
  'wealth-oracle':          'Wealth Oracle (€1,555)',
  'divine-wealth':          'Divine Wealth',
  'sovereign-mentor':       'Sovereign Mentor',
  'inner-sanctum':          'Inner Sanctum',
  'wealth-expansion-code':  'Wealth Expansion Code',
  'business-expansion-code':'Business Expansion Code',
};

// ── Archetype display names ──────────────────────────────────
const ARCHETYPE_NAMES = {
  A: 'The Guard',
  B: 'The Prover',
  C: 'The Hider',
  D: 'The Giver',
  E: 'The Gripper',
};

// ── Duplicate submission guard ───────────────────────────────
const recentSubmissions = new Set();

/**
 * Generates a simple fingerprint to prevent duplicate submissions
 * within the same session (e.g. double-click).
 */
function submissionFingerprint(data) {
  return `${data.email || ''}_${data.source || ''}_${Date.now() >> 14}`;
}


// ── Public API ───────────────────────────────────────────────

/**
 * Send a lead to both Web3Forms (email) and Google Sheets.
 *
 * @param {Object} data - Lead data with these fields:
 *   source     – 'Assessment Quiz' | 'Contact Form' | 'Application Form'
 *   firstName  – First name
 *   lastName   – Last name (optional)
 *   email      – Email address
 *   phone      – Phone / WhatsApp (optional)
 *   program    – Program slug or display name
 *   archetype  – Top archetype letter (A-E) or name (optional)
 *   scores     – JSON string or formatted scores (optional)
 *   message    – Freeform message (optional)
 *   quizAnswers – Comma-separated quiz answers (optional)
 *   extraFields – Object of additional key-value pairs for email (optional)
 *   notify     – false skips the Web3Forms email (the caller has already
 *                notified the team another way). Defaults to true.
 *   emailOnly  – true sends only the Web3Forms email (a fallback for when
 *                the sheet/marketing calls have already gone).
 *
 * @returns {Promise<{email: boolean, sheet: boolean}>}
 */
export async function sendLead(data) {
  // Guard: prevent duplicate submissions
  const fp = submissionFingerprint(data) + (data.notify === false ? '_quiet' : data.emailOnly ? '_email' : '');
  if (recentSubmissions.has(fp)) {
    return { email: false, sheet: false, reason: 'duplicate' };
  }
  recentSubmissions.add(fp);

  // Fire all three channels in parallel — one failure doesn't block the others
  const [emailResult, sheetResult, marketingResult] = await Promise.allSettled([
    data.notify === false ? Promise.resolve(false) : sendEmail(data),
    data.emailOnly ? Promise.resolve(false) : logToSheet(data),
    data.emailOnly ? Promise.resolve(false) : sendToMarketingPlatform(data),
  ]);

  return {
    email:     emailResult.status === 'fulfilled' && emailResult.value,
    sheet:     sheetResult.status === 'fulfilled' && sheetResult.value,
    marketing: marketingResult.status === 'fulfilled' && marketingResult.value,
  };
}


// ── Web3Forms Email ──────────────────────────────────────────

async function sendEmail(data) {
  const programDisplay = PROGRAM_NAMES[data.program] || data.program || 'Unknown';
  const archetypeName  = ARCHETYPE_NAMES[data.archetype] || data.archetype || '';

  // Build the email payload
  const payload = {
    access_key: WEB3FORMS_KEY,
    subject:    `New Lead — ${data.source || 'Website'} — ${programDisplay}`,
    from_name:  'Tejal Desae Website',
    replyto:    data.email || '',
    botcheck:   '',

    // Core fields
    'First Name': data.firstName || '',
    'Last Name':  data.lastName  || '',
    'Email':      data.email     || '',
    'Phone':      data.phone     || '',
    'Program':    programDisplay,
    'Source':     data.source    || '',
  };

  // Conditional fields (only include when present)
  if (archetypeName) {
    payload['Expansion Profile'] = archetypeName;
  }
  if (data.scores) {
    payload['Expansion Scores'] = formatScores(data.scores);
  }
  if (data.message) {
    payload['Message'] = data.message;
  }
  if (data.quizAnswers) {
    payload['Quiz Answers'] = data.quizAnswers;
  }

  // Merge any extra fields from application forms
  if (data.extraFields && typeof data.extraFields === 'object') {
    Object.entries(data.extraFields).forEach(([key, value]) => {
      if (value && key !== 'access_key' && key !== '_honeypot' && key !== 'botcheck') {
        payload[key] = value;
      }
    });
  }

  const res = await fetch(WEB3FORMS_ENDPOINT, {
    method:    'POST',
    headers:   { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:      JSON.stringify(payload),
    keepalive: true, // survive page navigation (user taps away before fetch completes)
  });

  const json = await res.json();
  return json.success === true;
}


// ── Google Sheets Logging ────────────────────────────────────

async function logToSheet(data) {
  if (!GOOGLE_SHEET_URL) {
    console.warn('[lead-service] Google Sheet URL not configured — skipping sheet log.');
    return false;
  }

  const archetypeName = ARCHETYPE_NAMES[data.archetype] || data.archetype || '';

  const payload = {
    source:      data.source      || '',
    firstName:   data.firstName   || '',
    lastName:    data.lastName    || '',
    email:       data.email       || '',
    phone:       data.phone       || '',
    program:     PROGRAM_NAMES[data.program] || data.program || '',
    archetype:   archetypeName,
    scores:      formatScores(data.scores),
    message:     data.message     || '',
    quizAnswers: data.quizAnswers || '',
  };

  const res = await fetch(GOOGLE_SHEET_URL, {
    method:    'POST',
    headers:   { 'Content-Type': 'text/plain' }, // text/plain avoids CORS preflight
    body:      JSON.stringify(payload),
    keepalive: true, // survive page navigation
  });

  const json = await res.json();
  return json.success === true;
}


// ── Helpers ──────────────────────────────────────────────────

/**
 * Formats expansion scores for human-readable display.
 * Input: JSON string like '{"A":3,"B":1,"C":2,"D":1,"E":1}' or object
 * Output: 'Safety: 3, Worthiness: 1, Visibility: 2, Receiving: 1, Ease: 1'
 */
function formatScores(scores) {
  if (!scores) return '';

  const labels = { A: 'Safety', B: 'Worthiness', C: 'Visibility', D: 'Receiving', E: 'Ease' };

  let parsed = scores;
  if (typeof scores === 'string') {
    try { parsed = JSON.parse(scores); } catch (_) { return scores; }
  }

  if (typeof parsed !== 'object') return String(scores);

  return Object.entries(parsed)
    .sort(([, a], [, b]) => b - a)
    .map(([key, val]) => `${labels[key] || key}: ${val}`)
    .join(', ');
}


// ── Marketing Automation Webhook ─────────────────────────────

/**
 * Sends lead data to Tejal's marketing automation platform.
 * Uses navigator.sendBeacon() so the request survives page navigations
 * (e.g. user taps "View your full report" immediately after submitting).
 * Falls back to fetch() if sendBeacon is unavailable.
 */
async function sendToMarketingPlatform(data) {
  if (!MARKETING_WEBHOOK_URL) return false;

  const archetypeName = ARCHETYPE_NAMES[data.archetype] || data.archetype || '';

  const payload = JSON.stringify({
    source:    data.source    || '',
    firstName: data.firstName || '',
    lastName:  data.lastName  || '',
    email:     data.email     || '',
    phone:     data.phone     || '',
    program:   PROGRAM_NAMES[data.program] || data.program || '',
    archetype: archetypeName,
    scores:    formatScores(data.scores),
  });

  // sendBeacon is fire-and-forget — guaranteed delivery even on navigation
  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([payload], { type: 'text/plain' });
    const queued = navigator.sendBeacon(MARKETING_WEBHOOK_URL, blob);
    if (!queued) {
      console.warn('[lead-service] sendBeacon rejected — falling back to fetch');
    } else {
      return true;
    }
  }

  // Fallback for environments without sendBeacon (rare)
  try {
    const res = await fetch(MARKETING_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    payload,
      keepalive: true, // also helps survive navigations in modern browsers
    });

    if (!res.ok) {
      console.warn('[lead-service] Marketing webhook returned', res.status);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[lead-service] Marketing webhook failed:', err.message);
    return false;
  }
}
