/* ============================================================================
   Integrated Software Technologies — the "dazzle" layer
   ----------------------------------------------------------------------------
   Loads after wow.js. Pure delight, and it holds the same rules as wow.js:

     1. ONE rAF, AND IT SLEEPS. A single loop that only runs while the pointer
        is moving over the hero. When everything is at rest it parks itself —
        no idle battery drain.
     2. IT NEVER BREAKS THE BASE SITE. Everything is additive and composes with
        the transforms the other scripts already apply.
     3. IT TURNS OFF. prefers-reduced-motion short-circuits the whole file, so
        the calm CSS version is what a motion-sensitive visitor sees.
   ============================================================================ */
(function () {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;                       // leave the base experience alone
  const canHover = matchMedia('(hover: hover)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  document.body.classList.add('dazzle');

  /* ---- shared sleeping rAF ---------------------------------------------- */
  const tasks = [];
  let running = false;
  function wake() { if (!running) { running = true; requestAnimationFrame(tick); } }
  function tick(now) {
    let alive = false;
    for (const t of tasks) alive = t(now) || alive;
    if (alive) requestAnimationFrame(tick); else running = false;
  }

  /* Nothing here has any business running once you have scrolled past the
   * hero. Gate the loop on the header being on screen: parked while you read
   * the page, woken the instant the hero returns. */
  let heroVisible = true;
  const heroEl = document.getElementById('top') || document.querySelector('header');
  if (heroEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      heroVisible = es[0].isIntersecting;
      if (heroVisible) wake();
    }, { threshold: 0 }).observe(heroEl);
  }

  /* ---- 2. LAYERED HERO DEPTH -------------------------------------------- *
   * The background drifts WITH the pointer, a little. This used to be half of a
   * two-plane effect — wow.js drifted the hero icon cluster the other way, and
   * the differing rates read as depth — but that cluster was removed, so what
   * is left is a single subtle plane. Scaled up 6% first so the drift never
   * bares an edge of the fixed backdrop.                                     */
  (function heroDepth() {
    if (!canHover) return;
    const bg = document.getElementById('bg');
    if (!bg) return;
    let tx = 0, ty = 0, x = 0, y = 0;
    addEventListener('pointermove', e => {
      tx = ((e.clientX / innerWidth) * 2 - 1);
      ty = ((e.clientY / innerHeight) * 2 - 1);
      wake();
    }, { passive: true });
    tasks.push(() => {
      if (!heroVisible) return false;          // the backdrop drift only reads over the hero
      x = lerp(x, tx, 0.06); y = lerp(y, ty, 0.06);
      bg.style.transform = `scale(1.06) translate(${(x * 10).toFixed(2)}px,${(y * 8).toFixed(2)}px)`;
      return Math.abs(x - tx) > 0.002 || Math.abs(y - ty) > 0.002;
    });
  })();

  /* ---- 3. SCROLL AURORA ------------------------------------------------- *
   * The palette shifts hue as you descend — the site slowly changes light on
   * the way down. Cheap: a single CSS var the stylesheet turns into a
   * hue-rotate on the backdrop. No rAF; a passive scroll write is enough.    */
  (function scrollAura() {
    const doc = document.documentElement;
    let ticking = false;
    function set() {
      ticking = false;
      const max = doc.scrollHeight - doc.clientHeight;
      const p = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
      doc.style.setProperty('--aura', (p * 42).toFixed(1) + 'deg');
    }
    addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(set); }
    }, { passive: true });
    set();
  })();

  /* ---- the click ping ring ---------------------------------------------- */
  function ping(x, y) {
    const el = document.createElement('div');
    el.className = 'icon-ping';
    const s0 = 30;
    el.style.width = el.style.height = s0 + 'px';
    el.style.left = (x - s0 / 2) + 'px';
    el.style.top = (y - s0 / 2) + 'px';
    document.body.appendChild(el);
    let f = 0;
    (function grow() {
      f++;
      const k = f / 22;
      el.style.transform = `scale(${(1 + k * 2.6).toFixed(2)})`;
      el.style.opacity = String(Math.max(0, 0.7 * (1 - k)));
      if (f < 22) requestAnimationFrame(grow); else el.remove();
    })();
  }
})();
