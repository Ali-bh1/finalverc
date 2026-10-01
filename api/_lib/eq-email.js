/**
 * Renders the two Expansion Quotient emails:
 *   clientEmail() — the personalised result the respondent receives
 *   ownerEmail()  — the full response set for Tejal's team to review
 *
 * Table layout and inline styles throughout: Gmail and Outlook strip
 * <style> blocks and ignore flexbox.
 */

import { QUESTIONS, INTENT_OPTIONS, TERRITORY_NAMES, VISION_QUESTION } from '../../js/eq-core.js';
import { RESULTS, SIGNATURE_LINE } from './eq-results.js';

const C = {
  em: '#154230', emDeep: '#0E3122', gold: '#E6D3A3', goldDeep: '#C7AC6D',
  goldText: '#8C6F2E', cream: '#FBFAF6', card: '#FFFFFF', ink: '#2B3A31', quiet: '#5E6B62',
};
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Helvetica,Arial,sans-serif";

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');
const intentLabel = (key) => (INTENT_OPTIONS.find(([k]) => k === key) || [, 'Not answered'])[1];

function territoryLine(result) {
  const a = TERRITORY_NAMES[result.dominant];
  return result.secondary ? `${a} and ${TERRITORY_NAMES[result.secondary]}` : a;
}

// ── Shared building blocks ───────────────────────────────────

const p = (html, extra = '') =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.75;color:${C.ink};${extra}">${html}</p>`;

const label = (text, color = C.goldText) =>
  `<p style="margin:0 0 8px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${color}">${text}</p>`;

const rule = `<tr><td style="padding:8px 0"><div style="height:1px;background:${C.gold};line-height:1px;font-size:1px">&nbsp;</div></td></tr>`;

function shell(preheader, inner) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>The Expansion Quotient</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
${inner}
</table>
</td></tr></table>
</body></html>`;
}

function header(eyebrow, title) {
  return `<tr><td style="background:${C.em};padding:34px 36px 30px;text-align:center">
  <p style="margin:0 0 14px;font-family:${SANS};font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:${C.goldDeep}">${eyebrow}</p>
  <h1 style="margin:0;font-family:${SERIF};font-size:28px;line-height:1.25;font-weight:normal;color:${C.gold}">${title}</h1>
</td></tr>`;
}

function detailsRows(rows) {
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr>
      <td style="padding:7px 12px 7px 0;font-family:${SANS};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.quiet};vertical-align:top;white-space:nowrap;width:130px">${k}</td>
      <td style="padding:7px 0;font-family:${SANS};font-size:14px;line-height:1.55;color:${C.ink};vertical-align:top">${v}</td>
    </tr>`).join('');
}

function contactRows(c) {
  return [
    ['Name', esc(`${c.firstName} ${c.lastName}`.trim())],
    ['Email', esc(c.email)],
    ['Phone', esc(c.phone)],
    ['Country', esc(c.country)],
    ['Role / Title', esc(c.role)],
    ['Company', esc(c.company)],
    ['LinkedIn', esc(c.linkedin)],
  ];
}

// ── Client email ─────────────────────────────────────────────

export function clientEmail(sub, result) {
  const { contact: c } = sub;
  const r = RESULTS[result.dominant];
  const r2 = result.secondary ? RESULTS[result.secondary] : null;
  const edge = territoryLine(result);
  const first = esc(c.firstName);

  const subject = `${c.firstName}, here's where your next expansion may be`;

  const opening = `
    ${p(`Hi ${first},`)}
    ${p('Thank you for taking the Expansion Quotient.')}
    ${p("You didn't take this assessment because something has to be wrong with your life. In fact, your answers may reflect just how much you have already built, handled and become.")}
    ${p(`The Expansion Quotient looks at a different question:<br><em style="font-family:${SERIF};font-size:17px;color:${C.em}">Has every part of you expanded at the same pace as the life you've created?</em>`)}`;

  const edgeBlock = r2
    ? `${label('Your Expansion Edges')}
       <p style="margin:0 0 14px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.em}">${esc(edge)}</p>
       ${p("Your results point to two connected expansion edges. That isn't unusual. Our lives don't organise themselves into neat categories. Identity can affect money. Responsibility can affect relationships. Control can affect the body. Time can affect intimacy.")}
       ${p(`The useful question is not, <em>'Which one is the problem?'</em> It is: <em>Which one, if expanded, would create the greatest positive ripple through the rest of my life?</em>`, 'margin:0')}`
    : `${label('Your Expansion Edge')}
       <p style="margin:0 0 6px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.em}">${esc(edge)}</p>
       ${p("Here's what that can mean for you.", `margin:0;color:${C.quiet}`)}`;

  const module = (res, name) => `
    <tr><td style="background:${C.card};border:1px solid ${C.gold};padding:30px 32px">
      ${label(esc(name))}
      <p style="margin:0 0 22px;font-family:${SERIF};font-size:20px;line-height:1.45;color:${C.em};font-style:italic">${esc(res.headline)}</p>
      ${label('What your answers may be showing', C.quiet)}
      ${p(esc(res.showing))}
      ${label('What this can look like in real life', C.quiet)}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px">
        ${res.realLife.map((l) => `<tr><td style="padding:0 10px 8px 0;vertical-align:top;color:${C.goldDeep};font-size:15px;line-height:1.7">&#9670;</td><td style="padding:0 0 8px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.ink}">${esc(l)}</td></tr>`).join('')}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="border-left:3px solid ${C.goldDeep};padding:4px 0 4px 18px">
        ${label('Your question to sit with', C.quiet)}
        <p style="margin:0;font-family:${SERIF};font-size:19px;line-height:1.45;color:${C.em};font-style:italic">${esc(res.question)}</p>
      </td></tr></table>
      ${label('One small next step', C.quiet)}
      ${p(esc(res.step))}
      ${label('From Tejal', C.quiet)}
      ${p(esc(res.fromTejal), 'margin:0')}
    </td></tr>`;

  const shortModule = (res, name) => `
    <tr><td style="background:${C.card};border:1px solid ${C.gold};padding:26px 32px">
      ${label(esc(name))}
      <p style="margin:0 0 16px;font-family:${SERIF};font-size:18px;line-height:1.45;color:${C.em};font-style:italic">${esc(res.headline)}</p>
      ${label('Your question to sit with', C.quiet)}
      ${p(esc(res.question), `margin:0;font-family:${SERIF};font-size:17px;font-style:italic;color:${C.em}`)}
    </td></tr>`;

  const strength = `
    <tr><td style="background:${C.emDeep};padding:26px 32px">
      ${label('Your current strength', C.goldDeep)}
      <p style="margin:0 0 8px;font-family:${SERIF};font-size:20px;color:${C.gold}">${esc(TERRITORY_NAMES[result.strength])}</p>
      <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.7;color:#F3EEDF">${esc(RESULTS[result.strength].strength)}</p>
    </td></tr>`;

  // What happens next depends on how they arrived and what they told us.
  let next;
  if (sub.origin === 'book-call') {
    next = `${p('You asked for a free Expansion Call with Tejal, and we have your request.')}
      ${p(`Our team will be in touch within two working days. We'll either call you${c.phone ? ` on <b>${esc(c.phone)}</b>` : ''} or email you a link to choose a time that suits you.`)}
      ${p("Before we speak, spend a few minutes with your question above. It's a good place to start the conversation.", 'margin:0')}`;
  } else if (sub.intent === 'conversation') {
    next = `${p("You mentioned you'd be open to a private conversation. Thank you, we've noted that.")}
      ${p("My team reads the responses personally. If we see something in yours that I believe would be valuable to explore together, we'll reach out and invite you to a private Expansion Conversation with me. There's no obligation.", 'margin:0')}`;
  } else {
    next = `${p('Awareness often begins before action. Notice where your question appears in ordinary life: in a meeting, a money decision, a conversation, a quiet evening, or the moment you automatically say yes.')}
      ${p('And if at some point you want to explore what your responses are showing more deeply, simply reply to this email.', 'margin:0')}`;
  }

  const shared = [
    ...contactRows(c),
    ['What you want more of', esc(sub.desires.join(', '))],
    ['What you want next', esc(intentLabel(sub.intent))],
  ];

  const html = shell(`Your Expansion Edge: ${edge}`, `
    ${header('The Expansion Quotient&trade;', 'Your results are here')}
    <tr><td style="background:${C.card};padding:32px 36px 16px">${opening}</td></tr>
    <tr><td style="background:${C.card};padding:0 36px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${C.cream};border:1px solid ${C.gold};padding:22px 24px;text-align:center">${edgeBlock}</td></tr></table>
    </td></tr>
    <tr><td style="height:18px;line-height:18px;font-size:1px">&nbsp;</td></tr>
    ${module(r, TERRITORY_NAMES[result.dominant])}
    ${r2 ? `<tr><td style="height:14px;line-height:14px;font-size:1px">&nbsp;</td></tr>${shortModule(r2, TERRITORY_NAMES[result.secondary])}` : ''}
    <tr><td style="height:14px;line-height:14px;font-size:1px">&nbsp;</td></tr>
    ${strength}
    <tr><td style="height:18px;line-height:18px;font-size:1px">&nbsp;</td></tr>
    <tr><td style="background:${C.card};padding:30px 36px">
      ${label('What happens next')}
      ${next}
    </td></tr>
    <tr><td style="height:18px;line-height:18px;font-size:1px">&nbsp;</td></tr>
    <tr><td style="background:${C.card};padding:28px 36px">
      ${label('What you shared with us')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsRows(shared)}</table>
      ${sub.vision ? `<div style="margin-top:14px">${label('In six months, something really shifted…', C.quiet)}<p style="margin:0;font-family:${SERIF};font-size:16px;line-height:1.6;font-style:italic;color:${C.em}">&ldquo;${nl2br(sub.vision)}&rdquo;</p></div>` : ''}
    </td></tr>
    <tr><td style="padding:30px 36px 10px;text-align:center">
      <p style="margin:0;font-family:${SERIF};font-size:18px;color:${C.em}">Warmly,<br>Tejal Desae</p>
      <p style="margin:4px 0 14px;font-family:${SANS};font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.quiet}">Wealth &amp; Identity Mentor</p>
      <p style="margin:0 0 22px;font-family:${SERIF};font-size:15px;font-style:italic;color:${C.goldText}">${esc(SIGNATURE_LINE)}</p>
      <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:${C.quiet}">The Expansion Quotient is a reflective self-discovery tool. It is not a medical, psychological, financial or clinical assessment.<br>You're receiving this because you took the Expansion Quotient at tejaldesae.com.</p>
    </td></tr>
  `);

  const text = [
    `Hi ${c.firstName},`, '',
    'Thank you for taking the Expansion Quotient.', '',
    `Your ${r2 ? 'Expansion Edges' : 'Expansion Edge'}: ${edge}`, '',
    r.headline, '',
    'WHAT YOUR ANSWERS MAY BE SHOWING', r.showing, '',
    'WHAT THIS CAN LOOK LIKE IN REAL LIFE', ...r.realLife.map((l) => `- ${l}`), '',
    'YOUR QUESTION TO SIT WITH', r.question, '',
    'ONE SMALL NEXT STEP', r.step, '',
    'FROM TEJAL', r.fromTejal, '',
    ...(r2 ? [`ALSO: ${TERRITORY_NAMES[result.secondary].toUpperCase()}`, r2.headline, r2.question, ''] : []),
    `YOUR CURRENT STRENGTH: ${TERRITORY_NAMES[result.strength]}`, RESULTS[result.strength].strength, '',
    'WHAT HAPPENS NEXT',
    sub.origin === 'book-call'
      ? "Our team will be in touch within two working days. We'll either call you or email you a link to choose a time."
      : 'If you want to explore what your responses are showing more deeply, simply reply to this email.',
    '',
    'Warmly,', 'Tejal Desae', 'Wealth & Identity Mentor', SIGNATURE_LINE,
  ].join('\n');

  return { subject, html, text };
}

// ── Owner / team email ───────────────────────────────────────

export function ownerEmail(sub, result) {
  const { contact: c } = sub;
  const name = `${c.firstName} ${c.lastName}`.trim();
  const wantsCall = sub.origin === 'book-call';
  const openToTalk = sub.intent === 'conversation';

  const flag = wantsCall ? 'REQUESTED A CALL' : openToTalk ? 'OPEN TO A CONVERSATION' : 'Results only';
  const flagBg = wantsCall ? '#8C2F1B' : openToTalk ? C.goldText : C.quiet;
  const subject = `${wantsCall ? '[Call request] ' : openToTalk ? '[Review] ' : ''}EQ: ${name} · ${territoryLine(result)}`;

  const phoneDigits = (c.phone || '').replace(/[^\d+]/g, '');
  const contactLinks = [
    ...contactRows(c).map(([k, v]) => {
      if (k === 'Email' && v) return [k, `<a href="mailto:${esc(c.email)}" style="color:${C.em}">${v}</a>`];
      if (k === 'Phone' && v) return [k, `<a href="tel:${esc(phoneDigits)}" style="color:${C.em}">${v}</a> &middot; <a href="https://wa.me/${esc(phoneDigits.replace('+', ''))}" style="color:${C.em}">WhatsApp</a>`];
      if (k === 'LinkedIn' && v) return [k, `<a href="${esc(/^https?:/i.test(c.linkedin) ? c.linkedin : 'https://' + c.linkedin)}" style="color:${C.em}">${v}</a>`];
      return [k, v];
    }),
    ['Marketing opt-in', c.consent ? 'Yes' : 'No'],
  ];

  const bars = Object.entries(result.averages)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const pct = Math.round(((v - 1) / 3) * 100);
      return `<tr>
        <td style="padding:5px 12px 5px 0;font-family:${SANS};font-size:13px;color:${C.ink};white-space:nowrap;width:190px">${esc(TERRITORY_NAMES[k])}</td>
        <td width="100%" style="padding:5px 0;width:100%"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE8D6"><tr>
          <td width="${Math.max(pct, 2)}%" style="background:${C.em};height:8px;line-height:8px;font-size:1px">&nbsp;</td><td style="height:8px;line-height:8px;font-size:1px">&nbsp;</td>
        </tr></table></td>
        <td style="padding:5px 0 5px 10px;font-family:${SANS};font-size:12px;color:${C.quiet};white-space:nowrap">${v.toFixed(2)}</td>
      </tr>`;
    }).join('');

  const answerRows = QUESTIONS.map((q, i) => {
    const idx = sub.answers[i];
    const letter = 'ABCD'[idx] || '–';
    const shade = idx >= 2 ? C.em : C.quiet;
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #EFE8D6">
      <p style="margin:0 0 4px;font-family:${SANS};font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${C.quiet}">Q${i + 1} &middot; ${esc(q.title)} &middot; ${esc(TERRITORY_NAMES[q.territory])}</p>
      <p style="margin:0 0 4px;font-family:${SANS};font-size:13px;color:${C.quiet}">${esc(q.q)}</p>
      <p style="margin:0;font-family:${SANS};font-size:14px;color:${shade}"><b>${letter}.</b> ${esc(q.o[idx] ?? 'Not answered')}</p>
    </td></tr>`;
  }).join('');

  const m = sub.meta || {};
  const metaRows = [
    ['Arrived via', wantsCall ? 'Book-a-call button → popup → assessment' : 'Assessment directly'],
    ['Submitted', esc(sub.submittedAt)],
    ['UTM source', esc(m.utm_source)], ['UTM medium', esc(m.utm_medium)], ['UTM campaign', esc(m.utm_campaign)],
    ['UTM content', esc(m.utm_content)], ['UTM term', esc(m.utm_term)],
    ['Referrer', esc(m.referrer)], ['Landing page', esc(m.landing)], ['Programme', esc(m.program)],
  ];

  const html = shell(`${flag}: ${name}, ${territoryLine(result)}`, `
    <tr><td style="background:${C.em};padding:22px 28px">
      <p style="margin:0 0 10px"><span style="display:inline-block;background:${flagBg};color:#fff;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.14em;padding:5px 10px">${flag}</span></p>
      <h1 style="margin:0;font-family:${SERIF};font-size:26px;font-weight:normal;color:${C.gold}">${esc(name)}</h1>
      <p style="margin:6px 0 0;font-family:${SANS};font-size:14px;color:#F3EEDF">${esc([c.role, c.company, c.country].filter(Boolean).join(' · '))}</p>
    </td></tr>
    <tr><td style="background:${C.card};padding:24px 28px">
      ${label('Contact')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsRows(contactLinks)}</table>
    </td></tr>
    ${rule}
    <tr><td style="background:${C.card};padding:24px 28px">
      ${label('Six-month outcome (their words)')}
      <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.6;font-style:italic;color:${C.em}">${sub.vision ? `&ldquo;${nl2br(sub.vision)}&rdquo;` : '<span style="color:#999">Left blank</span>'}</p>
    </td></tr>
    ${rule}
    <tr><td style="background:${C.card};padding:24px 28px">
      ${label('Result sent to them')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsRows([
        ['Expansion edge', `<b>${esc(TERRITORY_NAMES[result.dominant])}</b>`],
        ['Second edge', esc(result.secondary ? TERRITORY_NAMES[result.secondary] : '')],
        ['Current strength', esc(TERRITORY_NAMES[result.strength])],
        ['Wants more of', esc(sub.desires.join(', ') || 'Nothing selected')],
        ['What they want next', esc(intentLabel(sub.intent))],
      ])}</table>
      <div style="margin-top:16px">${label('Territory scores (1 = capacity, 4 = edge)', C.quiet)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars}</table></div>
    </td></tr>
    ${rule}
    <tr><td style="background:${C.card};padding:24px 28px">
      ${label('All answers')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${answerRows}
        <tr><td style="padding:10px 0"><p style="margin:0 0 4px;font-family:${SANS};font-size:13px;color:${C.quiet}">${esc(VISION_QUESTION)}</p>
        <p style="margin:0;font-family:${SANS};font-size:14px;color:${C.em}">${sub.vision ? nl2br(sub.vision) : 'Not answered'}</p></td></tr>
      </table>
    </td></tr>
    ${rule}
    <tr><td style="background:${C.card};padding:20px 28px 26px">
      ${label('Source', C.quiet)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsRows(metaRows)}</table>
    </td></tr>
    <tr><td style="padding:16px 28px;text-align:center;font-family:${SANS};font-size:12px;color:${C.quiet}">Reply to this email to write to ${esc(c.firstName)} directly.</td></tr>
  `);

  const text = [
    `${flag}: ${name}`,
    `${c.email} · ${c.phone || 'no phone'} · ${c.country}`,
    `${c.role || ''}${c.company ? ' · ' + c.company : ''}`,
    c.linkedin || '', '',
    `Expansion edge: ${territoryLine(result)}`,
    `Current strength: ${TERRITORY_NAMES[result.strength]}`,
    `Wants more of: ${sub.desires.join(', ') || 'None'}`,
    `Next: ${intentLabel(sub.intent)}`, '',
    'Six-month outcome:', sub.vision || 'Not answered', '',
    ...QUESTIONS.map((q, i) => `Q${i + 1} ${q.title}: ${'ABCD'[sub.answers[i]] || '–'}. ${q.o[sub.answers[i]] ?? ''}`),
  ].join('\n');

  return { subject, html, text };
}
