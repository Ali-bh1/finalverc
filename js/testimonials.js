/**
 * testimonials.js — endless horizontal scroll for .tmq
 *
 * The track holds the real testimonials once. Here they are repeated
 * until one "lap" is wider than the viewport, then that lap is doubled
 * and the CSS animation slides exactly one lap (-50%) before looping —
 * so there is never a gap or a jump. Clones are aria-hidden, so screen
 * readers hear each testimonial once.
 *
 * Paused on hover/focus (CSS) and on touch. With reduced motion the
 * script does nothing and the row is a plain swipeable scroller.
 */

const SPEED = 38; // px per second — slow enough to read along

function build(root) {
  const track = root.querySelector('.tmq-track');
  if (!track || track.dataset.ready) return;
  const originals = [...track.children];
  if (!originals.length) return;

  const lapWidth = () => track.scrollWidth;
  // One lap must be at least as wide as the visible strip.
  let guard = 0;
  while (lapWidth() < root.clientWidth + 1 && guard++ < 10) {
    originals.forEach((el) => track.append(clone(el)));
  }
  const lap = lapWidth();
  [...track.children].forEach((el) => track.append(clone(el)));

  track.style.setProperty('--tmq-dur', `${Math.round(lap / SPEED)}s`);
  track.dataset.ready = '1';
  root.classList.add('is-moving');

  // Touch: tap to pause/resume (there is no hover on phones).
  root.addEventListener('touchstart', () => root.classList.toggle('is-paused'), { passive: true });
}

function clone(el) {
  const c = el.cloneNode(true);
  c.setAttribute('aria-hidden', 'true');
  c.querySelectorAll('a, button, [tabindex]').forEach((n) => n.setAttribute('tabindex', '-1'));
  return c;
}

function init() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.tmq').forEach(build);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
