/* ============================================================================
   Integrated Software Technologies — the cinematic layer
   ----------------------------------------------------------------------------
   Loads last. Reads the global APPS from apps.js. Adds:

     · a split-word headline that comes INTO FOCUS rather than sliding in
     · a floating hero device with scroll + pointer parallax
     · THE SHOWCASE — a pinned section where the scroll wheel is a scrub bar
     · an endless belt of the real app icons
     · scroll depth on the background

   Three rules it holds to:

   1. ONE rAF LOOP, ONE SCROLL LISTENER. The page already had four separate
      `addEventListener('scroll')` handlers, each doing layout reads. Scroll
      handlers that read geometry are the classic way to make a beautiful site
      that stutters — every read forces the browser to flush pending style work.
      Everything here batches into a single rAF and reads geometry ONCE.
   2. NOTHING IS HOVER-ONLY. Hover is a desktop luxury. The showcase is driven
      by scroll, so a phone gets exactly the same film, not a lesser one.
   3. IT TURNS OFF. `prefers-reduced-motion` short-circuits all of it and the
      page stays complete.
   ========================================================================== */
(function () {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const apps = (typeof APPS !== 'undefined') ? APPS : [];
  const shot = (a, n) => `assets/shots/${a.key}/0${n}.png`;

  /* ------------------------------------------------------ split headline -- */
  // Split on WORDS, not characters. Per-character reveals look impressive in a
  // demo and read as gimmicky in a headline — and they wreck the line-breaking,
  // which on a phone is the difference between a headline and a mess.
  (function splitHeadline() {
    const h1 = document.querySelector('header h1');
    if (!h1 || reduced) return;

    const walk = node => {
      const out = [];
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach(t => {
            if (!t) return;
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = t;
            out.push(s);
          });
        } else if (n.nodeType === 1) {
          // DO NOT SPLIT INSIDE THE GRADIENT SPAN. This was the bug, and it put a
          // hole in the hero.
          //
          // `h1 .g` paints its words with `background:var(--grad)` +
          // `background-clip:text` + `color:transparent` — the text is a *window*
          // cut into a gradient. Splitting it into `.w` spans gave each word its own
          // inline-block box that inherited `color:transparent` and had NO gradient
          // of its own to show through. So "fast, private," was rendered as
          // transparent text on nothing: perfectly laid out, taking up its space,
          // and completely invisible. The headline read "Apps that are ⟨gap⟩ and
          // built to feel alive." and had done since the day this shipped.
          //
          // The gradient span is therefore ONE reveal unit. It fades and focuses in
          // as a phrase, which is what it is, and the gradient paints across it
          // exactly as the stylesheet intends.
          const el = n.cloneNode(true);
          el.classList.add('w');
          out.push(el);
        }
      });
      return out;
    };

    const parts = walk(h1);
    h1.innerHTML = '';
    const wrap = document.createElement('span');
    wrap.className = 'split';
    parts.forEach(p => wrap.appendChild(p));
    h1.appendChild(wrap);

    // Stagger. 38 ms: enough that the eye reads it as a sequence, little enough
    // that the whole sentence still lands as one thought — and the headline is
    // the LCP element, so the entire reveal has to be over in well under a second.
    wrap.querySelectorAll('.w').forEach((w, i) => {
      w.style.setProperty('--wd', (i * 0.038).toFixed(3) + 's');
    });
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
  })();

  /* --------------------------------------------------------- hero device -- */
  const heroPhone = (function buildHeroPhone() {
    const stage = document.getElementById('herostage');
    if (!stage || !apps.length) return null;

    const withShots = apps.filter(a => a.key);
    if (!withShots.length) return null;

    const phone = document.createElement('div');
    phone.className = 'phone';
    phone.innerHTML =
      `<div class="screen">${withShots.map((a, i) =>
        `<img src="${shot(a, 1)}" alt="${a.name}" ${i === 0 ? 'class="on"' : ''} loading="${i === 0 ? 'eager' : 'lazy'}">`
      ).join('')}<div class="glare"></div></div>`;
    stage.appendChild(phone);

    // Cycle the hero screen slowly. This is the ONE thing on the page that runs
    // on a timer, and it earns it: the hero is what you look at while deciding
    // whether to scroll at all, and a still image gives you no reason to.
    const imgs = Array.from(phone.querySelectorAll('.screen img'));

    // ONE advance function, owned by the phone — not by the timer.
    //
    // The timer used to hold the index in its own closure, which meant a tap could
    // not move the phone on without the two of them fighting over which screen was
    // showing. The phone owns `next()`; the timer is just one thing that calls it,
    // and so is a finger.
    let k = 0;
    phone.next = () => {
      if (imgs.length < 2) return;
      imgs[k].classList.remove('on');
      k = (k + 1) % imgs.length;
      imgs[k].classList.add('on');
      // A tap restarts the idle clock, so it does not flip again a moment later.
      if (phone._t) { clearInterval(phone._t); phone._t = start(); }
    };

    const start = () => (!reduced && imgs.length > 1)
      ? setInterval(() => phone.next(), 2600)
      : null;
    phone._t = start();

    return phone;
  })();

  /* ------------------------------------------------------------ showcase -- */
  const showcase = (function buildShowcase() {
    const track = document.querySelector('#showcase .sc-track');
    if (!track) return null;

    const list = apps.filter(a => a.key);
    if (!list.length) { track.closest('section').remove(); return null; }

    // Two sentences of the long copy, or the short desc. Naively doing
    // `split('. ').slice(0,2).join('. ') + '.'` re-adds a full stop that the
    // last sentence already had — every card ended in "on-device..".
    const blurb = a => {
      const src = (a.long || a.desc || '').trim();
      const m = src.match(/[^.!?]+[.!?]+/g);
      if (!m) return src;
      return m.slice(0, 2).join(' ').trim();
    };

    const stage = track.querySelector('.sc-stage');
    const copy = track.querySelector('.sc-copy');
    const wrap = track.querySelector('.sc-phonewrap');
    const dots = track.querySelector('.sc-dots');

    copy.insertAdjacentHTML('beforeend', list.map((a, i) => `
      <article class="sc-slide ${i === 0 ? 'on' : ''}">
        <span class="sc-cat" style="color:${a.accent};background:${a.accent}1f">${a.cat}</span>
        <h3>${a.name}</h3>
        <p>${blurb(a)}</p>
        ${a.store
          ? `<a class="btn primary" href="${a.store}" target="_blank" rel="noopener">View on the App Store →</a>`
          : `<span class="chip soon">${a.status === 'soon' ? 'In development' : 'In review'}</span>`}
      </article>`).join(''));

    const phone = document.createElement('div');
    phone.className = 'phone';
    // Each app gets its FIRST screenshot; the phone cross-fades between them as
    // the scroll scrubs. Lazy on everything but the first, or the page pays for
    // eight full-size screenshots it may never show.
    phone.innerHTML = `<div class="screen">${list.map((a, i) =>
      `<img src="${shot(a, 1)}" alt="${a.name} screenshot" ${i === 0 ? 'class="on"' : ''} loading="${i === 0 ? 'eager' : 'lazy'}">`
    ).join('')}<div class="glare"></div></div>`;
    wrap.appendChild(phone);

    dots.innerHTML = list.map((a, i) =>
      `<button class="${i === 0 ? 'on' : ''}" data-i="${i}" aria-label="${a.name}"></button>`).join('');

    // The track's height IS the scroll distance of the film. 0.8 of a viewport
    // per app, plus a bit for the entry and exit: any less and the cross-fades
    // trip over each other; any more and the visitor starts to wonder whether the
    // page has broken. Eight full viewports (the first cut) was a long time to
    // ask someone to scroll before they had even reached the apps grid.
    track.style.height = (list.length * 0.8 + 0.6) * 100 + 'svh';

    const slides = Array.from(copy.querySelectorAll('.sc-slide'));
    const imgs = Array.from(phone.querySelectorAll('.screen img'));
    const btns = Array.from(dots.querySelectorAll('button'));
    let current = -1;

    dots.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const i = +b.dataset.i;
      const top = track.offsetTop + (i + 0.5) * (track.offsetHeight - stage.offsetHeight) / list.length;
      scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    });

    function select(i) {
      // CLAMP. Without this the whole thing throws: under `prefers-reduced-motion`
      // the sticky stage is unpinned and the track collapses to auto height, so
      // `track.offsetHeight - stage.offsetHeight` is zero or negative — the
      // progress divides by ~0, the index lands past the end of the list, and
      // `list[i].accent` explodes on the very first frame.
      i = Math.max(0, Math.min(list.length - 1, i | 0));
      if (i === current) return;
      current = i;
      slides.forEach((s, k) => s.classList.toggle('on', k === i));
      imgs.forEach((s, k) => s.classList.toggle('on', k === i));
      btns.forEach((b, k) => b.classList.toggle('on', k === i));
      // The light under the phone takes the app's own colour. This is the whole
      // trick: one accent, applied to the pool of light, the pill and the dot,
      // and the section reads as being ABOUT that app rather than showing it.
      const a = list[i].accent;
      wrap.style.setProperty('--a', a);
      dots.style.setProperty('--a', a);
    }

    return {
      track, stage, phone, select,
      count: list.length,
      // Called from the single rAF loop below with the page's scroll position.
      update(scrollY, vh) {
        const start = track.offsetTop;
        const span = track.offsetHeight - stage.offsetHeight;
        // A collapsed track (reduced motion, or a browser without sticky) has no
        // scrub range at all. Show the first app and leave it alone.
        if (!(span > 0)) { select(0); return; }
        const p = Math.min(1, Math.max(0, (scrollY - start) / span));   // 0…1
        select(Math.floor(p * list.length));

        // The phone turns very slightly as the film runs — a few degrees across
        // the whole section. Enough that the device feels like an object in a
        // space; little enough that nobody could tell you it happened.
        if (!reduced) {
          const turn = (p - 0.5) * 10;
          phone.style.transform =
            `rotateY(${turn}deg) rotateX(${-turn * 0.25}deg) translateZ(0)`;
        }
      }
    };
  })();

  /* -------------------------------------------------------------- marquee -- */
  (function buildMarquee() {
    const host = document.getElementById('marquee');
    if (!host) return;
    const icons = apps.filter(a => a.icon).map(a => a.icon);
    if (!icons.length) { host.remove(); return; }
    // Duplicated EXACTLY once, and the keyframe translates by exactly -50%. The
    // usual bug is to guess a pixel offset, which leaves a visible hitch on
    // every lap; this way the seam is mathematically impossible to see.
    const belt = [...icons, ...icons]
      .map(i => `<img src="assets/icons/${i}.png" alt="" loading="lazy">`).join('');
    host.innerHTML = `<div class="mq-belt">${belt}</div>`;
  })();

  /* ------------------------------------------------------- tap the phone --
     The hero device cycles on its own, slowly. But it is a phone, on a page made
     by people who make phone apps, and the first instinct of anybody who sees a
     phone on a screen is to touch it. So: touching it works. It snaps to the next
     app immediately, with a little press, and the idle cycle picks up from there.

     This is the cheapest kind of delight — the thing you expected to be dead turns
     out to be alive — and it costs a click handler. */
  (function makeHeroTappable() {
    const stage = document.getElementById('herostage');
    if (!stage || !heroPhone) return;
    const phone = heroPhone.querySelector ? heroPhone : null;
    if (!phone) return;
    phone.style.cursor = 'pointer';
    phone.setAttribute('role', 'button');
    phone.setAttribute('aria-label', 'Show the next app');
    phone.addEventListener('click', () => {
      if (typeof phone.next === 'function') phone.next();
      if (reduced) return;
      phone.classList.remove('tapped');
      void phone.offsetWidth;              // restart the animation
      phone.classList.add('tapped');
    });
  })();

  /* ------------------------------------------------------- card spotlight --
     A specular sheen that follows the pointer across a card, and a tilt of about a
     degree. Both are doing the same job: they say the card is a PHYSICAL SURFACE
     with a light above it, rather than a rectangle of colour.

     The tilt is deliberately tiny. A big tilt is a party trick and it makes text
     unreadable while it moves; a degree and a half is the amount you feel and do
     not see, which is the amount Apple uses.

     Pointer-only: a phone has no cursor, and faking one with touch is how you make
     a card that fights the scroll. */
  const spotlightCards = [];
  if (!reduced && matchMedia('(hover: hover)').matches) {
    const attach = () => {
      document.querySelectorAll('.card, .card2').forEach(card => {
        if (card.dataset.lit) return;
        card.dataset.lit = '1';
        spotlightCards.push(card);
        card.addEventListener('pointermove', e => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          const y = (e.clientY - r.top) / r.height;
          card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
          card.style.setProperty('--tx', ((x - 0.5) * 3).toFixed(2) + 'deg');
          card.style.setProperty('--ty', ((0.5 - y) * 3).toFixed(2) + 'deg');
        }, { passive: true });
        card.addEventListener('pointerleave', () => {
          card.style.setProperty('--tx', '0deg');
          card.style.setProperty('--ty', '0deg');
        });
      });
    };
    attach();
    // The app grid is rendered by app.js, which may not have run yet.
    addEventListener('load', attach);
    setTimeout(attach, 400);
  }

  /* ------------------------------------------------------ magnetic buttons --
     The primary call to action leans toward the cursor as you approach it, and
     snaps back when you leave. It is a two-line idea and it is the single most
     "expensive-feeling" thing on a page, because a button that reaches for you is
     a button that is *aware of you*.

     Capped at 6 px. Any further and the hit target stops being where the button
     looks, which is a genuinely user-hostile trick dressed up as delight. */
  if (!reduced && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.btn.primary, .chip.app, .mail').forEach(btn => {
      const R = 90;      // the distance at which it starts to notice you
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d > R) return;
        const pull = (1 - d / R) * 6;
        btn.style.transform =
          `translate(${(dx / d || 0) * pull}px, ${(dy / d || 0) * pull}px)`;
      }, { passive: true });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* --------------------------------------------- ONE loop, ONE scroll read --
     Every scroll-driven thing on the page reads its geometry here, once, and
     writes in the same frame. Four independent scroll handlers each calling
     getBoundingClientRect() is how a site that looks expensive ends up feeling
     cheap on a mid-range Android. */
  let ticking = false, py = 0, pointerX = 0, pointerY = 0;

  const nav = document.getElementById('nav');
  const bar = document.getElementById('progress');
  const doc = document.documentElement;

  function frame() {
    ticking = false;
    const y = scrollY, vh = innerHeight;

    document.body.classList.toggle('scrolled', y > 40);
    if (nav) nav.classList.toggle('scrolled', y > 30);
    if (bar) {
      const max = doc.scrollHeight - doc.clientHeight;
      bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }

    if (showcase) showcase.update(y, vh);

    // Hero device: drifts up and away as you leave, and leans toward the
    // pointer. Both are parallax, and parallax is the cheapest depth there is.
    if (heroPhone && !reduced) {
      const t = Math.min(1, y / vh);
      const lean = pointerX * 9;
      const pitch = -pointerY * 7;
      heroPhone.style.transform =
        `translateY(${t * -70}px) scale(${1 - t * 0.12}) ` +
        `rotateY(${lean}deg) rotateX(${pitch}deg)`;
      heroPhone.style.opacity = String(1 - t * 0.85);
    }

    py = y;
  }

  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });

  if (!reduced && matchMedia('(hover: hover)').matches) {
    addEventListener('pointermove', e => {
      pointerX = (e.clientX / innerWidth) * 2 - 1;      // −1 … 1
      pointerY = (e.clientY / innerHeight) * 2 - 1;
      request();
    }, { passive: true });
  }

  request();
})();
