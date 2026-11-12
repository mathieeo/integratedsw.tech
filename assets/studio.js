/* integratedsw.tech: the studio homepage (redesign 2026-10-17).
   The app grid is server-rendered by build.js from assets/apps.js; this file adds the
   hero tunnel, the app spotlight, the releases strip, the iPhone Duo band, the phone menu, the icon glide
   between pages, the ruler scrollbar, the section index, the reveals (headline rise, counting numbers, typed
   command lines), the ticker, the contact form and the service worker. The terminal is assets/term.js. */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SRC = Array.isArray(window.APPS) ? window.APPS : [];
const APPS = SRC.filter(a => a.key).map(a => ({ key: a.key, slug: a.slug, name: a.name, c: a.accent, icon: a.icon, desc: a.desc, store: a.store }));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ---------- ticker and footer, from the same catalog as the grid ---------- */
const tick = APPS.map(a => `<span><i style="--c:${a.c}"></i>${esc(a.name)}</span>`).join('');
const tk = document.getElementById('ticker'); if (tk) tk.innerHTML = tick + tick;
const fa = document.getElementById('footApps'); if (fa) fa.innerHTML = '<a href="/apps/">All apps</a>' + APPS.map(a => `<a href="/apps/${a.slug}/">${esc(a.name)}</a>`).join('');

/* ---------- copy buttons ---------- */
function copy(text, btn, fallbackLabel) {
  const el = btn.querySelector('span') || btn, was = el.textContent;
  const done = ok => { el.textContent = ok ? 'Copied' : fallbackLabel; setTimeout(() => { el.textContent = was; }, 1800); };
  const legacy = () => { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} t.remove(); return ok; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(legacy())); else done(legacy());
}
const tt = document.getElementById('tooltri'); if (tt) tt.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copy(b.dataset.copy, b, 'Select it'); });
const cm = document.getElementById('copyMail'); if (cm) cm.addEventListener('click', () => copy('matt@integratedsw.tech', cm, 'matt@integratedsw.tech'));

/* ---------- contact form (2026-11-11: a plain message form, no longer a project intake) ----------
   Web3Forms posts straight to the inbox; the key is a public submit token by design.
   Anything that fails falls back to a pre-filled email, so a visitor is never stuck. */
const FORM_KEY = '5e673ac9-cbd9-40bd-8329-bd19c37f43c7';
const form = document.getElementById('inquiry');
if (form) {
  const note = document.getElementById('formnote');
  const say = (msg, cls) => { if (note) { note.textContent = msg; note.className = 'fnote' + (cls ? ' ' + cls : ''); } };
  const field = k => form.querySelector(`[name="${k}"]`);
  const mark = (k, bad) => { const el = field(k); if (el) el.classList.toggle('bad', bad); };
  if (FORM_KEY) say('Sent straight to my inbox. No accounts, no tracking, nothing stored on this site.');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form), g = k => (f.get(k) || '').toString().trim();
    if (g('botcheck')) return;
    const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g('email'));
    mark('name', !g('name')); mark('email', !emailOK); mark('message', !g('message'));
    const miss = !g('name') ? 'name' : !emailOK ? 'email' : !g('message') ? 'message' : '';
    if (miss) {
      say({ name: 'Please add your name so I know who I am replying to.', email: 'That email does not look right, and I would not be able to reply.', message: 'Please write a line or two so I know what you are asking.' }[miss], 'err');
      const bad = field(miss); if (bad && bad.focus) bad.focus();
      return;
    }
    const subject = `Website message: ${g('topic')}`;
    const body = `Name: ${g('name')}\nEmail: ${g('email')}\nAbout: ${g('topic')}\n\n${g('message')}\n`;
    const mailto = () => { location.href = `mailto:matt@integratedsw.tech?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
    if (!FORM_KEY) { mailto(); return; }
    form.classList.add('sending'); say('Sending…');
    try {
      const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: FORM_KEY, subject, from_name: g('name'), email: g('email'), name: g('name'), topic: g('topic'), message: g('message') }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.success === false) throw new Error(data.message || 'send failed');
      form.reset(); say('Thanks, that reached me. I usually reply within a day.', 'ok');
    } catch (err) {
      say('Could not send from here, so I am opening your email app instead.', 'err'); mailto();
    } finally { form.classList.remove('sending'); }
  });
}

/* (the app ItemList rich result moved to /apps/, server-rendered by build.js with real prices) */

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

/* ---------- hero intro (2026-10-25): the wordmark climbs in letter by letter; the scroll cue appears once the intro settles ----------
   The letters are split at runtime so the HTML keeps the plain word for crawlers; the h1 gets an aria-label and the
   spans leave the accessibility tree. Kerning across spans is lost, which costs a pixel or two of width. */
(() => {
  const word = document.querySelector('.hero .word');
  if (word && !reduce) {
    const tn = [...word.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (tn) {
      const txt = document.createElement('span'); txt.className = 'txt'; txt.setAttribute('aria-hidden', 'true');
      [...tn.textContent.trim()].forEach((ch, i) => { const c = document.createElement('span'); c.className = 'ch'; c.style.setProperty('--i', String(i)); c.textContent = ch; txt.appendChild(c); });
      word.setAttribute('aria-label', tn.textContent.trim()); word.replaceChild(txt, tn);
    }
  }
  setTimeout(() => document.body.classList.add('hero-in'), reduce ? 0 : 1900);
})();

/* ---------- the hero tunnel: real screens drifting toward you ---------- */
const hero = (() => {
const orbit = document.getElementById('orbit'), rings = document.getElementById('rings');
if (!orbit || !rings) return null;
const rctx = rings.getContext('2d');
const MEDIA = APPS.flatMap(a => [a.key + '-1', a.key + '-2']);
const small = innerWidth < 700;
const COUNT = small ? 16 : 28, Z0 = 1, Z1 = 4.4;
const cards = [];
for (let i = 0; i < COUNT; i++) {
  const el = document.createElement('div'); el.className = 'card';
  const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = 'assets/studio/shots/' + MEDIA[(i * 5) % MEDIA.length] + '.jpg'; img.onerror = () => { el.style.display = 'none'; }; el.appendChild(img);
  orbit.appendChild(el);
  cards.push({ el, th: i * 2.39996, z: Z0 + (Z1 - Z0) * ((i + .5) / COUNT), spin: (i % 2 ? 1 : -1) * (.6 + (i % 5) * .15) });
}
let W = 0, H = 0, R = 0, base = 120, heroVisible = true, lastT = 0, boost = 0, lastY = scrollY;
function size() {
  const r = orbit.getBoundingClientRect(); W = r.width; H = r.height; R = Math.max(W, H * 1.15) * .56; base = small ? 86 : Math.min(150, W * .1);
  const d = Math.min(2, devicePixelRatio || 1); rings.width = Math.round(W * d); rings.height = Math.round(H * d); rctx.setTransform(d, 0, 0, d, 0, 0);
  cards.forEach(c => c.el.style.setProperty('--w', base + 'px'));
}
function drawRings(t) {
  rctx.clearRect(0, 0, W, H); const cx = W / 2, cy = H / 2;
  const RINGS = [[1.25, 'rgba(94,167,220,.6)', 4.2, .07], [1.9, 'rgba(232,240,246,.16)', 5.4, -.05], [2.7, 'rgba(232,240,246,.24)', 3.6, .09], [3.8, 'rgba(44,92,134,.45)', 4.8, -.12]];
  for (const [z, col, len, sp] of RINGS) {
    const r = R / z, a0 = t * sp + z * 1.7;
    rctx.beginPath(); rctx.ellipse(cx, cy, r, r * .86, 0, a0, a0 + len); rctx.strokeStyle = col; rctx.lineWidth = 1.4; rctx.stroke();
  }
  rctx.strokeStyle = 'rgba(232,240,246,.13)'; rctx.lineWidth = 1;
  for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2 + t * .02, r = R / 1.55, l = k % 6 ? 5 : 10;
    rctx.beginPath(); rctx.moveTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * .86); rctx.lineTo(W / 2 + Math.cos(a) * (r + l), H / 2 + Math.sin(a) * (r + l) * .86); rctx.stroke(); }
}
function placeCards(dt) {
  const cx = W / 2, cy = H / 2, speed = .07 + boost;
  for (const c of cards) {
    c.z -= speed * dt; c.th += c.spin * .045 * dt;
    if (c.z < Z0 * .62) c.z += Z1 - Z0 * .62;
    const s = 1 / c.z, x = cx + Math.cos(c.th) * R * s, y = cy + Math.sin(c.th) * R * s * .86;
    const near = Math.min(1, (c.z - Z0 * .62) / .35), far = Math.min(1, (Z1 - c.z) / .6);
    const op = Math.max(0, Math.min(near, far)) * (.18 + .82 * Math.pow(Math.min(1, 1.35 / c.z), 1.6));
    const ry = -(x - cx) / cx * 26, rx = (y - cy) / cy * 18;
    c.el.style.transform = `translate3d(${(x - base / 2).toFixed(1)}px,${(y - base).toFixed(1)}px,0) scale(${(s * 1.15).toFixed(3)}) rotateY(${ry.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg)`;
    c.el.style.opacity = op.toFixed(3); c.el.style.zIndex = String(1000 - Math.round(c.z * 100));
  }
}
size(); placeCards(0); drawRings(0);
new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe(orbit);
function loop(now) {
  const t = now / 1000, dt = Math.min(.05, lastT ? t - lastT : .016); lastT = t;
  const y = scrollY, v = Math.abs(y - lastY) / Math.max(dt, .001); lastY = y; boost += (Math.min(1.2, v / 900) - boost) * Math.min(1, dt * 4);
  if (heroVisible && !reduce) { placeCards(dt); drawRings(t); }
  requestAnimationFrame(loop);
}
if (!reduce) requestAnimationFrame(loop);
return { size, placeCards, drawRings };
})();

/* ---------- press feedback: iOS only applies :active styles on pages that listen for touches ---------- */
document.addEventListener('touchstart', () => {}, { passive: true });

/* ---------- phone menu (2026-11-11) ----------
   Under 820px the nav links are hidden (studio.css). This adds a menu button to the nav and builds a full-screen
   panel from those same links, so the homepage, every generated page and the hand-written policy pages get it
   without new markup. No script, no menu: the nav stays as it was. */
(() => {
  const nav = document.querySelector('header.nav'); if (!nav) return;
  const links = [...nav.querySelectorAll('.links a')], cta = nav.querySelector('.cta'); if (!links.length) return;
  const root = document.documentElement;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'menu'; btn.innerHTML = '<i></i><i></i>';
  btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'mnav');
  nav.appendChild(btn);
  const panel = document.createElement('div'); panel.className = 'mnav'; panel.id = 'mnav';
  panel.innerHTML = links.map((a, i) => `<a class="big" href="${esc(a.getAttribute('href'))}" style="--i:${i}"><small>${String(i + 1).padStart(2, '0')}</small>${esc(a.textContent)}</a>`).join('')
    + `<div class="mfoot">${cta ? `<a class="btn" href="${esc(cta.getAttribute('href'))}">${esc(cta.textContent)}</a>` : ''}<span class="mono">matt@integratedsw.tech</span></div>`;
  nav.after(panel); panel.inert = true;
  const set = open => {
    root.classList.toggle('menu-open', open); panel.inert = !open;
    btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };
  btn.addEventListener('click', () => set(!root.classList.contains('menu-open')));
  panel.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { set(false); btn.focus(); } });
  const wide = matchMedia('(min-width:821px)'), shut = e => { if (e.matches) set(false); };
  if (wide.addEventListener) wide.addEventListener('change', shut); else if (wide.addListener) wide.addListener(shut);
  addEventListener('pageshow', e => { if (e.persisted) set(false); });   /* back from the page cache: never reopen on a menu */
})();

/* ---------- the app icon glides into its page (2026-11-11) ----------
   Cross-document view transitions are on for every page (studio.css). Just before a link to an app page is
   followed, the icon that was clicked is named "appicon"; the app page's header icon carries the same name
   (page.css), so the browser flies one into the other. Coming back from the page cache the name is still on the
   icon, so it flies home again. One name per page: the previous one is cleared first, and on an app page the
   header icon gives its name up when another icon (the next-app strip) takes it. */
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
  if (!/(?:^|\/)apps\/[a-z0-9-]+\/$/.test(a.getAttribute('href') || '')) return;
  let ic = a.querySelector('img[src*="assets/icons/"]');
  if (!ic) { const box = a.closest('.spot'); ic = box && box.querySelector('.spot-name img'); }
  const own = document.querySelector('.aicon');
  document.querySelectorAll('[data-vt]').forEach(el => { el.style.viewTransitionName = ''; el.removeAttribute('data-vt'); });
  if (own) own.style.viewTransitionName = '';
  if (ic && ic !== own) { ic.style.viewTransitionName = 'appicon'; ic.setAttribute('data-vt', ''); if (own) own.style.viewTransitionName = 'none'; }
}, true);

/* ---------- app spotlight (2026-11-11) ----------
   The homepage apps section shows one app at a time on a phone and walks through the catalog. The hairline at
   the foot of the panel is the clock: when its fill animation ends, the next app comes up. It waits while the
   pointer is on the wall or the panel, while the panel is off screen and while the tab is hidden; the pause
   button stops it until it is pressed again. Pointing at an icon (or focusing it) shows that app. With reduced
   motion nothing moves on its own; the icons and the arrows still work. The price tag comes from data-price on
   each icon, which build.js writes from the App Store lookup. Screens are assets/studio/spot/<key>.jpg (made by
   Tools/site/make_spot.py from real captures); an app without one falls back to its tunnel shot. */
(() => {
  const spot = document.getElementById('spot'), wall = document.getElementById('appgrid');
  if (!spot || !wall) return;
  const items = [...wall.querySelectorAll('a')].map(a => {
    const slug = ((a.getAttribute('href') || '').match(/apps\/([^/]+)\//) || [])[1];
    const app = SRC.find(x => x.slug === slug && x.key);
    return app ? { a, app, price: a.dataset.price || '' } : null;
  }).filter(Boolean);
  if (!items.length) return;
  const pad = n => String(n).padStart(2, '0');
  spot.innerHTML = '<div class="spot-info"><p class="spot-k"><b></b> / ' + pad(items.length) + ' <span></span></p>'
    + '<h3 class="spot-name"><img alt="" width="46" height="46"><span></span></h3><p class="spot-desc"></p><p class="spot-tags"></p><a class="spot-go" href="#"></a></div>'
    + '<div class="spot-ctl"><button type="button" data-d="-1" aria-label="Previous app">←</button><button type="button" data-d="1" aria-label="Next app">→</button>'
    + '<button type="button" class="pp" aria-label="Pause the spotlight" aria-pressed="false"><svg viewBox="0 0 10 10" aria-hidden="true"><path class="ii" d="M1.5 1h2.4v8H1.5zM6.1 1h2.4v8H6.1z"/><path class="tri" d="M2 1l7 4-7 4z"/></svg></button></div>'
    + '<a class="spot-stage" href="#" tabindex="-1" aria-hidden="true"><span class="spot-phone"><img alt=""><img alt=""></span></a>'
    + '<div class="spot-bar" aria-hidden="true"><i></i></div>';
  const q = s => spot.querySelector(s);
  const elN = q('.spot-k b'), elCat = q('.spot-k span'), elIc = q('.spot-name img'), elName = q('.spot-name span'), elDesc = q('.spot-desc'),
    elTags = q('.spot-tags'), elGo = q('.spot-go'), elStage = q('.spot-stage'), bar = q('.spot-bar i'), pp = q('.pp');
  const imgs = [...spot.querySelectorAll('.spot-phone img')];
  const shot = app => 'assets/studio/spot/' + app.key + '.jpg';
  let cur = -1, layer = 0, token = 0, hover = false, vis = false, paused = false, started = false;
  function text(it, i) {
    elN.textContent = pad(i + 1); elCat.textContent = '· ' + it.app.cat;
    elIc.src = 'assets/icons/' + it.app.icon + '.png'; elName.textContent = it.app.name; elDesc.textContent = it.app.desc;
    elTags.innerHTML = (it.price ? '<span class="hot">' + esc(it.price) + '</span>' : '') + '<span>iPhone</span>';
    elGo.textContent = 'Explore ' + it.app.name + ' ↗'; elGo.href = elStage.href = 'apps/' + it.app.slug + '/';
  }
  const sync = () => spot.classList.toggle('hold', paused || hover || !vis || document.hidden);
  function clock() { spot.classList.remove('run'); void bar.offsetWidth; if (!reduce) spot.classList.add('run'); sync(); }
  function show(i) {
    i = (i + items.length) % items.length; if (i === cur) return;
    const it = items[i], my = ++token, first = cur < 0; cur = i;
    items.forEach((x, k) => x.a.classList.toggle('now', k === i));
    spot.style.setProperty('--sc', it.app.accent);
    if (first || reduce) text(it, i);
    else { spot.classList.add('swap'); setTimeout(() => { if (my !== token) return; text(it, i); spot.classList.remove('swap'); }, 160); }
    const next = imgs[layer ^ 1], prev = imgs[layer];
    next.className = ''; next.onerror = () => { next.onerror = null; next.src = 'assets/studio/shots/' + it.app.key + '-1.jpg'; };
    next.src = shot(it.app);
    const swap = () => {
      if (my !== token) return;
      next.className = 'on'; prev.className = first ? '' : 'off'; layer ^= 1; clock();
      new Image().src = shot(items[(i + 1) % items.length].app);   /* have the next screen ready */
    };
    (next.decode ? next.decode() : Promise.resolve()).then(swap, swap);
  }
  bar.addEventListener('animationend', () => show(cur + 1));
  [wall, spot].forEach(el => {
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hover = true; sync(); } });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover = false; sync(); } });
    el.addEventListener('focusin', e => { if (e.target.matches && e.target.matches(':focus-visible')) { hover = true; sync(); } });
    el.addEventListener('focusout', () => { hover = false; sync(); });
  });
  items.forEach((it, k) => {
    it.a.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(k); });
    it.a.addEventListener('focus', () => show(k));
  });
  spot.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => show(cur + Number(b.dataset.d))));
  pp.addEventListener('click', () => {
    paused = !paused; pp.classList.toggle('off', paused); pp.setAttribute('aria-pressed', String(paused));
    pp.setAttribute('aria-label', paused ? 'Play the spotlight' : 'Pause the spotlight'); sync();
  });
  /* on a phone: a swipe across the screen moves to the next or previous app, a tap opens the app's page */
  let tx = null, swiped = false;
  elStage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; swiped = false; }, { passive: true });
  elStage.addEventListener('touchend', e => {
    if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 36) { swiped = true; show(cur + (dx < 0 ? 1 : -1)); }
  }, { passive: true });
  elStage.addEventListener('click', e => { if (swiped) { e.preventDefault(); swiped = false; } });
  addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es, io) => { if (es[0].isIntersecting && !started) { started = true; show(0); io.disconnect(); } }, { rootMargin: '500px 0px' }).observe(spot);
    new IntersectionObserver(es => { vis = es[0].isIntersecting; sync(); }, { threshold: .2 }).observe(spot);
  } else { vis = true; started = true; show(0); }
})();

/* ---------- sideways strips (the screenshots on an app page, the latest releases on the homepage): arrows in the bar, and drag with a mouse ---------- */
document.querySelectorAll('.strip, .relstrip').forEach(strip => {
  const sec = strip.closest('.rel') || strip.closest('section'), btns = sec ? [...sec.querySelectorAll('[data-strip]')] : [];
  const step = () => { const f = strip.firstElementChild; return f ? f.getBoundingClientRect().width : 260; };
  const upd = () => {
    const max = strip.scrollWidth - strip.clientWidth - 2;
    btns.forEach(b => { b.disabled = Number(b.dataset.strip) < 0 ? strip.scrollLeft <= 2 : strip.scrollLeft >= max; });
    if (sec) sec.classList.toggle('noscroll', max <= 2);
  };
  btns.forEach(b => b.addEventListener('click', () => strip.scrollBy({ left: Number(b.dataset.strip) * step() * 2, behavior: reduce ? 'auto' : 'smooth' })));
  strip.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); addEventListener('load', upd); upd();
  let down = false, moved = false, dragged = false, sx = 0, sl = 0;
  strip.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft; });
  /* the cards of the releases strip are links: letting go after a drag must not open one */
  strip.addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  addEventListener('pointermove', e => {
    if (!down) return; const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 5) { moved = true; strip.classList.add('drag', 'nosnap'); }
    if (moved) strip.scrollLeft = sl - dx;
  });
  addEventListener('pointerup', () => {
    if (!down) return; down = false; if (!moved) return;
    dragged = true; setTimeout(() => { dragged = false; }, 60);
    strip.classList.remove('drag'); const w = step();
    strip.scrollTo({ left: Math.round(strip.scrollLeft / w) * w, behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(() => strip.classList.remove('nosnap'), 420);
  });
  strip.addEventListener('dragstart', e => e.preventDefault());
});

/* ---------- the ruler scrollbar ----------
   A tape of 201 half-percent ticks scrolls 1:1 with the page; the accent line sits at T + p*L and always points
   at its own percentage on the tape (tape tick p lands at T + p*tapeH - scrollY = T + p*L when
   tapeH = docH - T - B). Ticks near the line swell with scroll speed and relax when you stop. */
const index = document.getElementById('index');
const sections = [...document.querySelectorAll('[data-name]')];
const navLinks = [...document.querySelectorAll('.nav .links a[data-s]')];
const rail = (() => {
const sbar = document.getElementById('sbar');
if (!sbar) return null;
const tape = document.getElementById('tape'), win = document.getElementById('win');
const hov = document.getElementById('hov'), hovv = document.getElementById('hovv'), ind = document.getElementById('ind');
const odoCols = [...ind.querySelectorAll('.odo span')];
let T = 60, B = 24, L = 0, docH = 0, vh = 0, tapeH = 0, ticks = [], shownVal = -1, amp = 0, lastSY = scrollY, lastRT = 0, swollen = new Set(), liveTimer = 0;
const clamp01 = v => Math.max(0, Math.min(1, v));
function buildTape() {
  docH = document.documentElement.scrollHeight; vh = innerHeight; const narrow = innerWidth <= 760;
  T = narrow ? 58 : 60; B = narrow ? 18 : 24; L = Math.max(40, vh - T - B); tapeH = Math.max(L, docH - T - B);
  tape.style.height = tapeH + 'px'; let html = '';
  /* half-percent ticks: minor every 0.5%, medium every 1%, major + label every 5% */
  for (let k = 0; k <= 200; k++) { const y = (tapeH * k / 200).toFixed(1); html += `<i class="${k % 10 === 0 ? 'mj' : k % 2 === 0 ? 'md' : ''}" style="top:${y}px"></i>`; if (k % 10 === 0) html += `<b style="top:${y}px">${k / 2}</b>`; }
  const max = Math.max(1, docH - vh);
  sections.slice(1).forEach(sec => { const top = sec.getBoundingClientRect().top + scrollY - 48; html += `<em style="top:${(clamp01(top / max) * tapeH + 14).toFixed(0)}px">${sec.dataset.name}</em>`; });
  tape.innerHTML = html; ticks = [...tape.querySelectorAll('i')]; swollen.clear();
}
function progress() { const max = docH - vh; return max > 0 ? clamp01(scrollY / max) : 0; }
function setOdo(v) {
  if (v === shownVal) return; shownVal = v; const d = String(v).padStart(3, '0');
  odoCols.forEach((c, i) => { c.style.transform = `translateY(${-Number(d[i])}em)`; });
  sbar.setAttribute('aria-valuenow', String(v)); sbar.setAttribute('aria-valuetext', v + '% of the page');
}
function railFrame(now) {
  const t = now / 1000, dt = Math.min(.05, lastRT ? t - lastRT : .016); lastRT = t;
  const y = scrollY, v = Math.abs(y - lastSY) / Math.max(dt, .001); lastSY = y;
  const target = reduce ? 0 : Math.min(1.1, v / 1800); amp += (target - amp) * Math.min(1, dt * (target > amp ? 14 : 3.2));
  const p = progress(), indY = T + p * L;
  tape.style.transform = `translate3d(0,${(T - y).toFixed(1)}px,0)`;
  ind.style.transform = `translate3d(0,${indY.toFixed(1)}px,0)`; ind.classList.toggle('on', p > .003);
  const len = Math.max(26, L * Math.min(1, vh / docH)); win.style.height = len.toFixed(1) + 'px'; win.style.transform = `translate3d(0,${(T + p * (L - len)).toFixed(1)}px,0)`;
  setOdo(Math.round(p * 100));
  const c = p * 200, touched = new Set();
  if (amp > .004) for (let k = Math.max(0, Math.floor(c) - 14); k <= Math.min(200, Math.ceil(c) + 14); k++) {
    const d = k - c, g = Math.exp(-(d * d) / (2 * 4.6 * 4.6)), sc = 1 + amp * (k % 10 === 0 ? .2 : 1.6) * g; /* labelled ticks barely grow, so they never cross their number */
    ticks[k].style.transform = `scaleX(${sc.toFixed(3)})`; ticks[k].style.opacity = String(Math.min(1, (k % 10 === 0 ? .8 : k % 2 === 0 ? .42 : .24) + amp * .7 * g)); touched.add(k);
  }
  swollen.forEach(k => { if (!touched.has(k)) { ticks[k].style.transform = ''; ticks[k].style.opacity = ''; } }); swollen = touched;
  requestAnimationFrame(railFrame);
}
/* click or drag anywhere on the ruler to scrub; the hover line previews where you would land */
let dragging = false;
function railP(cy) { return clamp01((cy - T) / L); }
/* 'instant', not 'auto': html has scroll-behavior:smooth now, and 'auto' would defer to it and lag the drag */
function goP(pp, smooth) { window.scrollTo({ top: pp * Math.max(0, docH - vh), behavior: smooth && !reduce ? 'smooth' : 'instant' }); }
sbar.addEventListener('pointerdown', e => { dragging = true; sbar.classList.add('drag'); try { sbar.setPointerCapture(e.pointerId); } catch (_) {} goP(railP(e.clientY), e.pointerType === 'mouse'); e.preventDefault(); });
sbar.addEventListener('pointermove', e => {
  const pp = railP(e.clientY); hov.style.transform = `translate3d(0,${(T + pp * L).toFixed(1)}px,0)`; hovv.textContent = String(Math.round(pp * 100)).padStart(3, '0') + '%';
  if (dragging) goP(pp, false);
});
const endDrag = () => { dragging = false; sbar.classList.remove('drag'); };
sbar.addEventListener('pointerup', endDrag); sbar.addEventListener('pointercancel', endDrag);
sbar.addEventListener('keydown', e => {
  const step = { ArrowDown: .08, ArrowUp: -.08, PageDown: .9, PageUp: -.9 }[e.key];
  if (step) { e.preventDefault(); window.scrollBy({ top: step * vh, behavior: reduce ? 'auto' : 'smooth' }); }
  else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); goP(e.key === 'End' ? 1 : 0, true); }
});
addEventListener('scroll', () => { sbar.classList.add('live'); clearTimeout(liveTimer); liveTimer = setTimeout(() => sbar.classList.remove('live'), 700); }, { passive: true });
buildTape(); requestAnimationFrame(railFrame);
return { build: buildTape };
})();

/* ---------- split section index ---------- */
let current = -1;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function scramble(el, text) {
  if (reduce) { el.textContent = text; return; }
  let f = 0; const total = 14; clearInterval(el._t);
  el._t = setInterval(() => { f++; const k = Math.floor(text.length * f / total);
    el.textContent = text.split('').map((ch, i) => i < k || ch === ' ' ? ch : LETTERS[Math.random() * 26 | 0]).join('');
    if (f >= total) { clearInterval(el._t); el.textContent = text; } }, 28);
}
/* one word at the top right: the section you are in (nothing in the hero; the nav says Home) */
function renderIndex(cur) {
  if (!index) return;
  if (cur === 0) { index.innerHTML = ''; return; }
  index.innerHTML = '<span class="now"></span>';
  scramble(index.querySelector('.now'), sections[cur].dataset.name.toUpperCase());
}
function onScroll() {
  document.body.classList.toggle('scrolled', scrollY > 40);
  let cur = 0; const mid = innerHeight * .4; sections.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) cur = i; });
  if (cur !== current) { current = cur; renderIndex(cur); navLinks.forEach((a, i) => a.classList.toggle('on', i === Math.min(cur, navLinks.length - 1) && cur < navLinks.length)); }
}
let ticking = false;
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });
let rz; const relayout = () => { clearTimeout(rz); rz = setTimeout(() => { if (hero) hero.size(); if (rail) rail.build(); onScroll(); if (reduce && hero) { hero.placeCards(0); hero.drawRings(0); } }, 150); };
addEventListener('resize', relayout);
if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
onScroll();

/* ---------- reveal on scroll: section content rises in as it enters, children staggered ---------- */
(() => {
  if (!('IntersectionObserver' in window)) return;
  const groups = ['.block .bar', '.block .intro > *', '.block .tri > div', '.block .iconwall a', '.block .close > *', '.block .wallwrap > *', '.block .spot', '.block .wallbox > .ctas', '.block .relstrip > *', '.block .duo-copy > *', '.block .duo-stage', '.block .more > *', '.block .apps > *', '.block .shots > *', '.block .gallery > *', '.block .pr > *'];
  const seen = new Set();
  groups.forEach(sel => document.querySelectorAll(sel).forEach(el => {
    if (seen.has(el) || el.closest('.inq')) return; seen.add(el);
    const kids = [...el.parentElement.children].filter(k => seen.has(k) || k.matches(sel));
    const i = kids.indexOf(el);
    el.classList.add('rv'); el.style.setProperty('--d', Math.min(i, 14) * (el.matches('.iconwall a') ? .045 : .09).toFixed(3) + 's');
  }));
  /* headline rise: a section heading comes up line by line from behind a mask. At the moment it is revealed the
     heading is rebuilt as one block per line (the lines depend on the width and the loaded face, so they are read
     off the laid-out words right then); each block holds exactly what that line held, so nothing moves. Once the
     motion is over the plain heading goes back in, and a later resize has nothing to undo. */
  const rise = new Set(reduce ? [] : [...seen].filter(el => el.matches('.intro h2, .close h2, .duo-copy h2')));
  function riseIn(el) {
    const plain = el.innerHTML, words = []; let gap = false;
    (function mark(node, em) { [...node.childNodes].forEach(n => {
      if (n.nodeType === 1) return mark(n, n);
      if (n.nodeType !== 3) return;
      const f = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(t => { if (!t) return;
        if (/^\s+$/.test(t)) { gap = true; f.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.textContent = t; f.appendChild(w); words.push({ w, em, gap }); gap = false; });
      n.replaceWith(f); }); })(el, null);
    const lines = []; let mid = null;
    words.forEach(x => { const r = x.w.getBoundingClientRect(), m = r.top + r.height / 2; if (mid === null || Math.abs(m - mid) > r.height * .5) { lines.push([]); mid = m; } lines[lines.length - 1].push(x); });
    if (!lines.length) { el.innerHTML = plain; el.classList.add('in'); return; }
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.innerHTML = lines.map((ln, i) => {
      let html = '', k = 0;
      while (k < ln.length) {
        const em = ln[k].em; let txt = '', first = true; const lead = k > 0 && ln[k].gap ? ' ' : '';
        while (k < ln.length && ln[k].em === em) { txt += (first || !ln[k].gap ? '' : ' ') + esc(ln[k].w.textContent); first = false; k++; }
        html += lead + (em ? '<em class="' + esc(em.className) + '">' + txt + '</em>' : txt);
      }
      return '<span class="ln" aria-hidden="true"><span class="lni" style="--l:' + i + '">' + html + '</span></span>';
    }).join('');
    el.classList.add('rise'); void el.offsetWidth; el.classList.add('in');
    const wait = ((parseFloat(el.style.getPropertyValue('--d')) || 0) + (lines.length - 1) * .11 + .95) * 1000 + 160;
    setTimeout(() => { el.innerHTML = plain; el.classList.remove('rise'); el.removeAttribute('aria-label'); }, wait);
  }
  const show = el => { if (rise.has(el)) riseIn(el); else el.classList.add('in'); };
  /* typed command lines: the pip lines in the open-source cards type themselves when their card arrives. Side by
     side the second waits for the first; stacked on a phone each starts with its own card. */
  if (!reduce) {
    const stacked = matchMedia('(max-width:860px)').matches; let t0 = .55;
    document.querySelectorAll('.tri .cmd code').forEach(code => {
      const m = code.textContent.match(/^\$ (.+)$/); if (!m || !code.closest('.rv')) return;
      code.innerHTML = '$ <span class="ty" style="--n:' + m[1].length + ';--t0:' + (stacked ? .55 : t0).toFixed(2) + 's"><span class="tx">' + esc(m[1]) + '</span><i></i></span>';
      t0 += m[1].length * .046 + .4;
    });
  }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  seen.forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) show(el); else io.observe(el); });
})();

/* ---------- numbers count up when they come into view ([data-count], whole numbers) ---------- */
(() => {
  const els = [...document.querySelectorAll('[data-count]')];
  if (!els.length || reduce || !('IntersectionObserver' in window)) return;
  const run = el => {
    const n = parseInt(el.textContent, 10); if (!(n > 1)) return;
    el.style.display = 'inline-block'; el.style.minWidth = el.getBoundingClientRect().width.toFixed(2) + 'px'; el.style.textAlign = 'right';
    const dur = Math.min(1500, 520 + n * 55), t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    el.textContent = '0'; requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); setTimeout(() => run(e.target), e.target.closest('.hero') ? 1500 : 260); }), { threshold: .6 });
  els.forEach(el => io.observe(el));
})();

/* ---------- iPhone Duo band (2026-11-11) ----------
   The phone unfolds as the band scrolls into view: --p on #duo runs from 0 (closed, the outer screen) to 1 (open,
   the inner screen across both halves) and follows the scroll both ways, eased a little so it glides. The chips
   swap the app on show (its two screens load first, then cross-fade). */
(() => {
  const duo = document.getElementById('duo'); if (!duo) return;
  const dev = duo.querySelector('.duo-dev'), stage = document.getElementById('duostage'), cap = document.getElementById('duocap');
  const inner = [...duo.querySelectorAll('img.di')], outer = duo.querySelector('img.do'), chips = [...duo.querySelectorAll('[data-duo]')];
  const load = src => { const i = new Image(); i.src = src; return (i.decode ? i.decode() : new Promise(r => { i.onload = i.onerror = r; })).catch(() => {}); };
  let turn = 0;
  chips.forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('on')) return;
    const t = ++turn, base = 'assets/studio/duo/' + b.dataset.duo;
    chips.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    duo.style.setProperty('--dc', b.dataset.c);
    Promise.all([load(base + '-in.jpg'), load(base + '-out.jpg')]).then(() => {
      if (t !== turn) return;
      dev.classList.add('sw'); cap.classList.add('sw');
      setTimeout(() => {
        if (t !== turn) return;
        inner.forEach(i => { i.src = base + '-in.jpg'; }); outer.src = base + '-out.jpg';
        cap.innerHTML = '<b>' + esc(b.dataset.name) + '.</b> ' + esc(b.dataset.cap);
        stage.setAttribute('aria-label', 'An iPhone Duo unfolding to show ' + b.dataset.name + ' across its inner screen');
        dev.classList.remove('sw'); cap.classList.remove('sw');
      }, reduce ? 0 : 230);
    });
  }));
  if (reduce) return;
  let cur = -1, goal = 0, raf = 0;
  const measure = () => { const r = dev.getBoundingClientRect(), c = r.top + r.height / 2, vh = innerHeight; goal = Math.min(1, Math.max(0, (vh * .98 - c) / (vh * .44))); };
  const frame = () => {
    cur = cur < 0 ? goal : cur + (goal - cur) * .14; if (Math.abs(goal - cur) < .0015) cur = goal;
    const e = cur * cur * (3 - 2 * cur);
    duo.style.setProperty('--p', e.toFixed(4));
    raf = cur === goal ? 0 : requestAnimationFrame(frame);
  };
  const on = () => { measure(); if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); addEventListener('load', on); on();
})();

/* ---------- pointer motion (fine pointers only): hero copy drifts, buttons lean toward the cursor ---------- */
if (!reduce && matchMedia('(pointer: fine)').matches) {
  const heroEl = document.querySelector('.hero'), copy = document.querySelector('.hcopy');
  if (heroEl && copy) {
    heroEl.addEventListener('pointermove', e => { const r = heroEl.getBoundingClientRect(); copy.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5) * 14 + 'px'); copy.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5) * 10 + 'px'); });
    heroEl.addEventListener('pointerleave', () => { copy.style.setProperty('--px', '0px'); copy.style.setProperty('--py', '0px'); });
  }
  document.querySelectorAll('.btn').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5) * 8 + 'px'); b.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5) * 6 + 'px'); });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });
  /* cards: a soft light follows the pointer (.glow, --gx/--gy), and what stands on the card leans toward it (--rx/--ry:
     the screen on a lineup card, the spotlight phone) */
  document.querySelectorAll('.tri > div, .lu, .spot').forEach(el => {
    el.classList.add('glow');
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      el.style.setProperty('--ry', ((x - .5) * 10).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
  });
}
addEventListener('load', () => { if (rail) rail.build(); onScroll(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (rail) rail.build(); onScroll(); });
})();
