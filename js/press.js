/**
 * press.js — tactile feedback for everything you can click, on every page.
 *
 *   • A soft ripple spreads from the exact point you press a button
 *     (mouse or finger), so a tap visibly "lands" even on phones, where
 *     there is no hover.
 *   • .is-pressed is held for at least a beat, so a quick tap still shows
 *     its pressed state instead of flickering past it.
 *   • A trailing → or leading ← in a button is wrapped in <span class="arr">
 *     so the stylesheet can nudge it in the direction of travel on hover;
 *     primary buttons without an arrow are given one.
 *
 * Works by delegation from the document, so buttons drawn later — the
 * details pop-up, the assessment's answers — are covered too. Styles live in
 * site-premium.css (INTERACTION). With reduced motion: no ripple, the
 * colour change alone carries the feedback.
 */
(function () {
  'use strict';

  var PRESSABLE = '.btn, .bk-submit, .bk-close, #nav .ncta, .nav-burger, .opt, .multi-opt, ' +
                  '.back2, .fq summary, .askfirst > summary, .hero-link, .stickycta .btn';
  var RIPPLE = '.btn, .bk-submit, #nav .ncta, .opt, .multi-opt';
  var MIN_PRESS_MS = 140;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ripple(el, x, y) {
    var r = el.getBoundingClientRect();
    // big enough to reach the far corner from wherever the press landed
    var size = Math.hypot(Math.max(x - r.left, r.right - x), Math.max(y - r.top, r.bottom - y)) * 2;
    var dot = document.createElement('span');
    dot.className = 'press-ripple';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (x - r.left - size / 2) + 'px';
    dot.style.top = (y - r.top - size / 2) + 'px';
    el.appendChild(dot);
    dot.addEventListener('animationend', function () { dot.remove(); });
    setTimeout(function () { dot.remove(); }, 1200); // in case the animation never ran
  }

  function press(el) {
    el.classList.add('is-pressed');
    var start = Date.now();
    function release() {
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      setTimeout(function () { el.classList.remove('is-pressed'); },
        Math.max(0, MIN_PRESS_MS - (Date.now() - start)));
    }
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var el = e.target.closest && e.target.closest(PRESSABLE);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    press(el);
    if (!reduced && el.matches(RIPPLE)) ripple(el, e.clientX, e.clientY);
  }, { passive: true });

  // Keyboard presses get the same pressed look (no ripple — there's no point to spread from).
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest && e.target.closest(PRESSABLE);
    if (!el || el.disabled) return;
    el.classList.add('is-pressed');
    setTimeout(function () { el.classList.remove('is-pressed'); }, MIN_PRESS_MS);
  });

  // Arrows: wrap a trailing "→" / leading "←" so it can move on hover.
  // Done lazily on first hover, so text that scripts rewrite later (the
  // pop-up's submit button) is picked up again the next time.
  function wrapArrow(el) {
    if (el.querySelector('.arr')) return;
    var nodes = el.childNodes;
    var last = nodes[nodes.length - 1];
    var first = nodes[0];
    if (last && last.nodeType === 3 && /\s*→\s*$/.test(last.nodeValue)) {
      last.nodeValue = last.nodeValue.replace(/\s*→\s*$/, ' ');
      el.insertAdjacentHTML('beforeend', '<span class="arr" aria-hidden="true">→</span>');
    } else if (first && first.nodeType === 3 && /^\s*←\s*/.test(first.nodeValue)) {
      first.nodeValue = first.nodeValue.replace(/^\s*←\s*/, ' ');
      el.insertAdjacentHTML('afterbegin', '<span class="arr arr-back" aria-hidden="true">←</span>');
    } else if (el.matches('.btn-em, .btn-ch') && !el.disabled && !el.hasAttribute('data-no-arrow')) {
      // Primary buttons without one get a forward arrow: the clearest
      // "this takes you somewhere" cue. Decorative, so screen readers skip it.
      el.insertAdjacentHTML('beforeend', '<span class="arr" aria-hidden="true">→</span>');
    }
  }
  function wrapAll(root) {
    (root || document).querySelectorAll('.btn, .bk-submit, .back2, .askfirst > summary').forEach(wrapArrow);
  }
  document.addEventListener('pointerover', function (e) {
    var el = e.target.closest && e.target.closest('.btn, .bk-submit, .back2, .askfirst > summary');
    if (el) wrapArrow(el);
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('.btn, .bk-submit, .back2, .askfirst > summary');
    if (el) wrapArrow(el);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { wrapAll(); });
  else wrapAll();
})();
