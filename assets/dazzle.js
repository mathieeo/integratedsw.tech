/* ============================================================================
   Integrated Software Technologies — the "dazzle" layer
   ----------------------------------------------------------------------------
   Loads after wow.js. Pure delight, and it holds the same rules as wow.js:

     1. ONE rAF, AND IT SLEEPS. A single loop that only runs while the hero
        icons are still settling or the pointer is moving over the hero. When
        everything is at rest it parks itself — no idle battery drain.
     2. IT NEVER BREAKS THE BASE SITE. Everything is additive and composes with
        the transforms the other scripts already apply (wow.js parallaxes the
        icon CLUSTER; this animates each icon WITHIN it — parent × child).
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

  /* The hero icons idle-float forever by nature, so the loop can't rest on its
   * own — but it has no business running once you have scrolled past the hero.
   * Gate it on the header being on screen: parked while you read the page,
   * woken the instant the hero returns. This is how a perpetual bob still
   * honours the site's "the rAF sleeps" rule. */
  let heroVisible = true;
  const heroEl = document.getElementById('top') || document.querySelector('header');
  if (heroEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      heroVisible = es[0].isIntersecting;
      if (heroVisible) wake();
    }, { threshold: 0 }).observe(heroEl);
  }

  /* ---- 1. LIVING HERO ICONS --------------------------------------------- *
   * Each app icon idles with a gentle bob, scatters away from the pointer as
   * it passes, and springs back — the cluster becomes something you can play
   * with, which is the whole "built to feel alive" promise made literal. The
   * motion is a real spring (velocity + restoring force + damping), so the
   * chase has weight instead of a canned tween.                              */
  (function livingIcons() {
    const wrap = document.getElementById('floaticons');
    if (!wrap) return;
    const imgs = [].slice.call(wrap.querySelectorAll('img'));
    if (!imgs.length) return;

    const K = 0.055;        // spring stiffness back to the idle bob
    const DAMP = 0.86;      // velocity damping — the settle
    const R = 130;          // repel radius (px)
    const PUSH = 46;        // how hard the pointer shoves an icon

    const ics = imgs.map((el, i) => ({
      el,
      cx: 0, cy: 0,                                   // base (layout) centre, viewport space
      ox: 0, oy: 0, vx: 0, vy: 0,                     // live offset + velocity
      ph: Math.random() * 6.28,                       // idle-bob phase
      amp: 5 + Math.random() * 5,                     // idle-bob amplitude
      sp: 0.7 + Math.random() * 0.5,                  // idle-bob speed
      boing: 0                                        // click pop, decays
    }));

    // Base centres are read from layout (not from the live transform) so the
    // repel maths never chases its own tail. Refreshed on resize/scroll.
    function measure() {
      for (const s of ics) {
        const r = s.el.getBoundingClientRect();
        s.cx = r.left + r.width / 2 - s.ox;           // subtract the offset we added
        s.cy = r.top + r.height / 2 - s.oy;
      }
    }
    measure();
    addEventListener('resize', () => { measure(); wake(); }, { passive: true });
    addEventListener('scroll', () => { measure(); wake(); }, { passive: true });

    let mx = -9999, my = -9999;
    if (canHover) addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY; wake();
    }, { passive: true });

    // A poke: the icon pops and throws a little sparkle ring + confetti.
    imgs.forEach((el, i) => el.addEventListener('pointerdown', e => {
      const s = ics[i];
      s.boing = 1;
      // a kick away from where it was tapped, so it feels struck
      s.vx += (Math.random() - 0.5) * 8; s.vy -= 6 + Math.random() * 6;
      const r = el.getBoundingClientRect();
      ping(r.left + r.width / 2, r.top + r.height / 2);
      if (window.istConfetti) window.istConfetti(r.left + r.width / 2, r.top + r.height / 2, 10);
      wake();
    }, { passive: true }));

    const t0 = performance.now();
    tasks.push((now) => {
      if (!heroVisible) return false;          // park while the hero is off screen
      const t = (now - t0) / 1000;
      let alive = false;
      for (const s of ics) {
        // idle target = a slow bob around the rest point
        const bx = 0;
        const by = Math.sin(t * s.sp + s.ph) * s.amp;

        // pointer repel — an outward shove that falls off with distance
        let px = 0, py = 0;
        const dx = (s.cx + s.ox) - mx, dy = (s.cy + s.oy) - my;
        const d = Math.hypot(dx, dy);
        if (d < R && d > 0.01) {
          const f = (1 - d / R) * PUSH;
          px = (dx / d) * f; py = (dy / d) * f;
        }

        // spring the live offset toward (idle bob + repel), with momentum
        s.vx += (bx + px - s.ox) * K;
        s.vy += (by + py - s.oy) * K;
        s.vx *= DAMP; s.vy *= DAMP;
        s.ox += s.vx; s.oy += s.vy;

        const scale = 1 + s.boing * 0.28;
        s.boing *= 0.88;
        s.el.style.transform =
          `translate(${s.ox.toFixed(2)}px,${s.oy.toFixed(2)}px) scale(${scale.toFixed(3)})`;

        // still moving if the spring or the bob or a fading pop is live
        if (Math.abs(s.vx) > 0.02 || Math.abs(s.vy) > 0.02 ||
            s.boing > 0.01 || Math.abs(by) > 0.05) alive = true;
      }
      return alive;
    });
    wake();   // kick off the perpetual gentle bob
  })();

  /* ---- 2. LAYERED HERO DEPTH -------------------------------------------- *
   * The background drifts WITH the pointer, a little, while wow.js drifts the
   * icon cluster the other way — two planes moving at different rates is what
   * the eye reads as depth. Scaled up 6% first so the drift never bares an
   * edge of the fixed backdrop.                                              */
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
