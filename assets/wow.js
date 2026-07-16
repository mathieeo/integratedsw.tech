/* ============================================================================
   Integrated Software Technologies — the "wow" layer
   ----------------------------------------------------------------------------
   Loads dead last. Everything the other scripts do is load-bearing; this file
   is pure delight, and it holds to the same three rules the rest of the site
   does, because breaking them is how delight turns into jank:

     1. ONE rAF, AND IT SLEEPS. There is a single animation loop here and it
        only runs while something is actually moving (the cursor, the scroll,
        a decaying velocity). When the page is still it stops entirely — no
        idle battery drain, no rAF fighting cinema.js's loop for the frame.
     2. IT NEVER OWNS THE POINTER. The trailing cursor is drawn ON TOP of the
        real one, never instead of it, so a stutter can't strand the visitor.
     3. IT TURNS OFF. prefers-reduced-motion short-circuits every moving part,
        and a touch device gets the gravity-tilt film the other scripts already
        provide rather than a fake desktop cursor.
   ============================================================================ */
(function () {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---- shared, sleeping rAF --------------------------------------------- */
  // Anything that needs per-frame work calls wake(); the loop runs each frame
  // that at least one task reports it still has motion left, and parks itself
  // the moment they all report done.
  const tasks = [];
  let running = false;
  function wake() {
    if (running || reduced) return;
    running = true;
    requestAnimationFrame(tick);
  }
  function tick(now) {
    let alive = false;
    for (const t of tasks) alive = t(now) || alive;
    if (alive) requestAnimationFrame(tick);
    else running = false;
  }

  /* ---- the trailing cursor ---------------------------------------------- */
  (function trailingCursor() {
    if (reduced || !canHover) return;

    const dot = mk('cursor-dot'), ring = mk('cursor-ring');
    function mk(id) { const el = document.createElement('div'); el.id = id; document.body.appendChild(el); return el; }

    let px = innerWidth / 2, py = innerHeight / 2;   // pointer target
    let rx = px, ry = py;                             // ring, chasing
    let seen = false, moving = false;

    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY;
      // The dot is exact — it IS the pointer — so it never lags on a fast flick.
      dot.style.transform = `translate(${px}px,${py}px) translate(-50%,-50%)`;
      if (!seen) { seen = true; rx = px; ry = py; document.body.classList.add('cursor-on'); }
      moving = true; wake();
    }, { passive: true });

    // Grow the ring over anything that responds to a click.
    const hot = 'a,button,input,select,textarea,.card,.card2,[role="button"],.chip,.dot,.sc-dots button,.copy,label';
    addEventListener('pointerover', e => {
      if (e.target.closest && e.target.closest(hot)) document.body.classList.add('cursor-hot');
    }, { passive: true });
    addEventListener('pointerout', e => {
      if (e.target.closest && e.target.closest(hot) &&
          !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(hot)))
        document.body.classList.remove('cursor-hot');
    }, { passive: true });
    addEventListener('pointerdown', () => { document.body.classList.add('cursor-press'); wake(); }, { passive: true });
    addEventListener('pointerup', () => { document.body.classList.remove('cursor-press'); wake(); }, { passive: true });
    addEventListener('blur', () => document.body.classList.remove('cursor-on'));
    addEventListener('mouseleave', () => document.body.classList.remove('cursor-on'));
    addEventListener('mouseenter', () => { if (seen) document.body.classList.add('cursor-on'); });

    tasks.push(() => {
      // The ring eases toward the pointer — the lag is the whole effect.
      rx = lerp(rx, px, 0.2); ry = lerp(ry, py, 0.2);
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      const near = Math.hypot(rx - px, ry - py) < 0.4;
      const still = near && !moving;
      moving = false;
      return !still;   // keep running until the ring has caught up and the pointer stopped
    });
  })();

  /* ---- scroll-reactive marquee + hero parallax + back-to-top ------------ */
  (function scrollLife() {
    const marquee = document.getElementById('marquee');
    const floats = document.getElementById('floaticons');
    const doc = document.documentElement;

    // Back-to-top button (built here so the markup stays clean).
    const top = document.createElement('button');
    top.id = 'totop';
    top.type = 'button';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-7 7 7-7 7 7"/></svg>';
    document.body.appendChild(top);
    top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

    let vel = 0, lastY = scrollY, targetSkew = 0, skew = 0, drift = 0;

    addEventListener('scroll', () => {
      const y = scrollY;
      vel = clamp(y - lastY, -80, 80);
      lastY = y;
      // progress 0…1 down the page, mirrored onto the button's ring.
      const max = doc.scrollHeight - doc.clientHeight;
      const p = max > 0 ? y / max : 0;
      top.style.setProperty('--p', p.toFixed(3));
      top.classList.toggle('show', y > innerHeight * 1.2);
      if (reduced) return;
      targetSkew = clamp(vel * 0.05, -3.2, 3.2);   // how far the belt leans
      wake();
    }, { passive: true });

    if (reduced) return;

    // Desktop pointer parallax for the hero icon cluster — set the target here
    // (cheap, no layout read); the rAF eases toward it.
    let pxn = 0, pyn = 0, dxn = 0, dyn = 0;
    if (canHover) {
      addEventListener('pointermove', e => {
        pxn = (e.clientX / innerWidth) * 2 - 1;
        pyn = (e.clientY / innerHeight) * 2 - 1;
        wake();
      }, { passive: true });
    }

    tasks.push(() => {
      // marquee: ease the skew toward its target, and let velocity decay so the
      // belt keeps leaning for a moment after a flick, then settles.
      skew = lerp(skew, targetSkew, 0.18);
      drift = lerp(drift, clamp(vel * 0.6, -26, 26), 0.18);
      targetSkew *= 0.9; vel *= 0.9;
      if (marquee) marquee.style.transform = `skewX(${skew.toFixed(2)}deg) translateX(${drift.toFixed(1)}px)`;

      // hero cluster: ease toward the pointer target for a floating plane.
      dxn = lerp(dxn, pxn, 0.08); dyn = lerp(dyn, pyn, 0.08);
      if (floats) floats.style.transform = `translate(${(-dxn * 14).toFixed(1)}px,${(-dyn * 10).toFixed(1)}px)`;

      const restingBelt = Math.abs(skew) < 0.02 && Math.abs(drift) < 0.1 && Math.abs(vel) < 0.4;
      const restingHero = Math.abs(dxn - pxn) < 0.005 && Math.abs(dyn - pyn) < 0.005;
      return !(restingBelt && restingHero);
    });
  })();

  /* ---- confetti celebration --------------------------------------------- */
  // A short, honest burst: each scrap is thrown up and out, then falls under
  // gravity and tumbles, and removes itself when it lands. Reused by the
  // inquiry form and the copy-to-clipboard buttons — the two moments on the
  // page where the visitor did a thing and deserves a little "yes".
  const COLORS = ['#22d3ee', '#8b5cf6', '#ec4899', '#34d399', '#fbbf24', '#eaeefb'];
  function confetti(x, y, count) {
    if (reduced) return;
    count = count || 26;
    for (let i = 0; i < count; i++) {
      const bit = document.createElement('i');
      bit.className = 'confetti-bit';
      const w = 5 + Math.random() * 6, h = 8 + Math.random() * 8;
      bit.style.width = w + 'px'; bit.style.height = h + 'px';
      bit.style.left = x + 'px'; bit.style.top = y + 'px';
      bit.style.background = COLORS[(Math.random() * COLORS.length) | 0];
      document.body.appendChild(bit);

      const ang = Math.random() * Math.PI * 2;
      let vx = Math.cos(ang) * (1 + Math.random() * 3);
      let vy = -(4 + Math.random() * 7);                 // most of the throw is up
      const g = 0.22, spin = (Math.random() - 0.5) * 26;
      const flut = 2 + Math.random() * 4, ph = Math.random() * 6.28;
      let ox = 0, oy = 0, rot = Math.random() * 360, life = 0;
      const total = 70 + (Math.random() * 40 | 0);       // frames (~1.4s)

      // Honest per-frame integration: the offset accumulates, so a decaying
      // sideways throw and a real gravity arc both come out right.
      (function fall() {
        life++;
        vy += g; vx *= 0.99;
        const swish = Math.sin(life / 6 * flut + ph) * 1.1;
        ox += vx + swish; oy += vy;
        bit.style.transform =
          `translate(${ox.toFixed(1)}px,${oy.toFixed(1)}px) ` +
          `rotate(${(rot += spin)}deg) scaleY(${(0.4 + 0.6 * Math.abs(Math.cos(life / 8 + ph))).toFixed(2)})`;
        bit.style.opacity = life > total * 0.7 ? String(Math.max(0, 1 - (life - total * 0.7) / (total * 0.3))) : '1';
        if (life < total) requestAnimationFrame(fall);
        else bit.remove();
      })();
    }
  }
  // expose it — the framework loves a reusable party, and other scripts may want it.
  window.istConfetti = confetti;

  const form = document.getElementById('inquiry');
  if (form) form.addEventListener('submit', () => {
    const b = form.querySelector('button[type=submit]');
    if (b) { const r = b.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 34); }
  }, true);   // capture: fire alongside the mailto handler in enhance.js, not instead of it

  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.copy');
    if (c) { const r = c.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 16); }
  });

  /* ---- press feedback on the big targets -------------------------------- */
  // A quick squash on press. Toggled by class (not :active) because these
  // elements already carry inline magnetic transforms; the class wins with
  // !important and is removed the instant the finger lifts.
  if (!reduced) {
    const press = '.btn,.chip.app,.mail,.chip.more,.copy,#totop,.navlinks a.cta';
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest(press);
      if (el) el.classList.add('wow-press');
    }, { passive: true });
    const lift = e => {
      // clear on any element currently pressed
      document.querySelectorAll('.wow-press').forEach(el => el.classList.remove('wow-press'));
    };
    addEventListener('pointerup', lift, { passive: true });
    addEventListener('pointercancel', lift, { passive: true });
  }
})();
