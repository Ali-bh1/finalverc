/**
 * eq-core.js — Expansion Quotient questions + scoring.
 *
 * Shared by the assessment page (browser) and /api/eq-submit (Node), so
 * the question wording in the owner's email and the territory the client
 * is told about always match what was actually on screen.
 *
 * Scoring (see text/expansion_quotient_prospect_results_and_response_library.md):
 *   Q1–Q11 each map to one of 7 Expansion Territories. Option A = 1
 *   (existing capacity) through D = 4 (area worth exploring). A territory's
 *   score is the average of its questions; the highest average is the
 *   client's Expansion Edge, the lowest is their Current Strength.
 */

export const TERRITORY_NAMES = {
  identity:      'Identity',
  receiving:     'Receiving',
  wealth:        'Wealth',
  relationships: 'Relationships & Boundaries',
  time:          'Time & Experience',
  certainty:     'Certainty & Surrender',
  body:          'Body & Capacity',
};

// Tie-break order when two territories score exactly the same.
const TERRITORY_ORDER = ['identity', 'receiving', 'wealth', 'relationships', 'time', 'certainty', 'body'];

// Q1–Q11 — single select. Option index 0–3 scores 1–4.
export const QUESTIONS = [
  { title: 'The Life You Built', territory: 'time',
    q: 'When you look at your life from the outside, which feels closest to the truth?',
    o: ["I've built a life I'm proud of, and I genuinely have space to enjoy it.",
        "I'm grateful for what I've built, but I know there are parts of my life that haven't expanded with my success.",
        "I'm achieving constantly, but the next target arrives before I've really experienced the last one.",
        "I sometimes wonder, 'I worked this hard for this life. Why doesn't it feel the way I thought it would?'"] },

  { title: 'Identity', territory: 'identity',
    q: 'Take away your title, business, income, responsibilities and the people who depend on you. How comfortable are you with who remains?',
    o: ['Very. My accomplishments are part of my life, not my identity.',
        'Mostly, although achievement still influences how I see myself.',
        'That question makes me surprisingly uncomfortable.',
        "I'm not sure I know who I am when I'm not achieving, solving, providing or being useful."] },

  { title: 'Control & Certainty', territory: 'certainty',
    q: "When something deeply matters to you but the outcome isn't fully in your control (money, business, family, health, relationships or timing), what happens?",
    o: ['I do what is mine to do and can generally release the rest.',
        'I tell myself to let go, but my mind keeps returning to it.',
        'I plan, analyse, anticipate and keep looking for something else I can do.',
        'Uncertainty is extremely uncomfortable. I feel safest when I know what is going to happen.'] },

  { title: 'Money', territory: 'wealth',
    q: 'Which statement best describes your relationship with money today?',
    o: ['Money feels like a resource. I can create, receive, hold, enjoy and direct it consciously.',
        'I earn well, but money can still create more anxiety than I think it should.',
        "I'm comfortable earning money, but receiving more, charging more, holding it or enjoying it can feel different.",
        'Regardless of how much I have or earn, some part of me still worries that it may not be enough.'] },

  { title: 'Receiving', territory: 'receiving',
    q: 'Something wonderful comes toward you: recognition, money, support, an opportunity, affection or praise. What happens naturally?',
    o: ['I receive it and enjoy it.',
        'I receive it, but quickly think about what I need to do next.',
        'I often minimise it, deflect it or feel I need to reciprocate immediately.',
        'Giving feels considerably easier than receiving.'] },

  { title: 'Responsibility', territory: 'relationships',
    q: 'How often do you find yourself carrying things that technically belong to other capable adults?',
    o: ["Rarely. I'm clear about what belongs to me.",
        'Occasionally, particularly with people I love.',
        "Often. It's usually easier to handle it myself.",
        "Constantly. I'm the person everyone turns to, and I don't really know how not to be."] },

  { title: 'Relationships', territory: 'relationships',
    q: 'When something is difficult for YOU, who gets access to that version of you?',
    o: ['I have people with whom I can be completely myself.',
        'A few people, although I still tend to handle most things privately.',
        "People know what's happening in my life, but not necessarily what I'm experiencing underneath it.",
        "I'm surrounded by people, but there are things I genuinely don't know who I would call about."] },

  { title: 'The Body Behind the Ambition', territory: 'body',
    q: 'At the end of a demanding day, what does your system naturally know how to do?',
    o: ['Switch off, recover and enjoy the rest of my life.',
        'Physically stop working while my mind keeps going.',
        'Reach for scrolling, food, television, shopping, another drink, more work or stimulation to switch off.',
        "I'm so accustomed to functioning under pressure that I often notice exhaustion only when my body forces me to."] },

  { title: 'Time', territory: 'time',
    q: 'If I looked at your calendar rather than your vision board, what would it tell me you value most?',
    o: ['My calendar reflects what matters to me remarkably well.',
        'Work still receives more of me than I consciously intend.',
        'The people and experiences I say matter most often receive whatever time is left.',
        "Much of the life I want is still sitting under 'when things settle down.'"] },

  { title: 'Spirituality', territory: 'certainty',
    q: 'When life refuses to follow your plan, what does spirituality look like for you?',
    o: ['I can take aligned action and genuinely surrender what I cannot control.',
        'I believe in God/Universe/Source, but surrender is much easier intellectually than practically.',
        'I tend to reach for spirituality most when I need something to change.',
        'I struggle to trust when reality looks very different from what I hoped for.'] },

  { title: 'Success', territory: 'body',
    q: "Complete this sentence: 'I'll finally be able to relax/enjoy myself when...'",
    o: ["I don't really live that way anymore.",
        'I reach the next financial/business milestone.',
        'This current problem or responsibility is handled.',
        "If I'm truthful, the answer keeps changing. Every finish line seems to create another one."] },
];

// Q12 — multi select.
export const DESIRE_OPTIONS = [
  'Peace', 'Money', 'Time', 'Love', 'Health', 'Intimacy',
  'Friendship', 'Spiritual connection', 'Freedom', 'Business growth',
  'Meaning', 'Joy', 'Travel & experiences', 'Confidence', 'Support', 'Something else',
];

// Q13 — conversation intent. Keys are what gets stored and emailed.
export const INTENT_OPTIONS = [
  ['understand',   "I'd love to understand what my results are showing me and what I could do next."],
  ['conversation', "I'd be open to a private conversation if Tejal feels there's something worth exploring together."],
  ['independent',  "I'd like my results and would prefer to explore them independently for now."],
];

export const VISION_QUESTION =
  "If we spoke again six months from now and you told me, 'Something really shifted,' what would be different in your life?";

/**
 * @param {number[]} answers  11 option indexes (0–3), one per question
 * @returns {{averages: Object<string,number>, dominant: string, secondary: string|null, strength: string}}
 */
export function scoreAnswers(answers) {
  const totals = {};
  QUESTIONS.forEach((q, i) => {
    const idx = answers[i];
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;
    const t = (totals[q.territory] ||= { sum: 0, n: 0 });
    t.sum += idx + 1;
    t.n += 1;
  });

  const averages = {};
  for (const key of TERRITORY_ORDER) {
    if (totals[key]) averages[key] = totals[key].sum / totals[key].n;
  }

  // Highest average first; stable sort keeps TERRITORY_ORDER on ties.
  const ranked = Object.keys(averages).sort((a, b) => averages[b] - averages[a]);
  const dominant = ranked[0] || 'identity';
  const strength = ranked[ranked.length - 1] || 'identity';

  // Two connected edges when the runner-up is within a quarter point —
  // but only once there is a real edge. Someone who answered mostly A
  // shouldn't be told they have two.
  const top = averages[dominant] || 0;
  const secondary = ranked.length > 1 && top >= 2 && top - averages[ranked[1]] <= 0.25
    ? ranked[1]
    : null;

  return { averages, dominant, secondary, strength };
}
