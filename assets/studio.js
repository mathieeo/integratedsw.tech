/* integratedsw.tech: the studio homepage (redesign 2026-10-17).
   The app grid is server-rendered by build.js from assets/apps.js; this file adds the
   hero tunnel, the ruler scrollbar, the section index, the ticker, the inquiry form,
   the rich-results list and the service worker. The terminal is assets/term.js. */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SRC = Array.isArray(window.APPS) ? window.APPS : [];
const APPS = SRC.filter(a => a.key).map(a => ({ key: a.key, slug: a.slug, name: a.name, c: a.accent, icon: a.icon, desc: a.desc, store: a.store }));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ---------- ticker and footer, from the same catalog as the grid ---------- */
const tick = APPS.map(a => `<span><i style="--c:${a.c}"></i>${esc(a.name)}</span>`).join('');
const tk = document.getElementById('ticker'); if (tk) tk.innerHTML = tick + tick;
const fa = document.getElementById('footApps'); if (fa) fa.innerHTML = APPS.map(a => `<a href="/apps/${a.slug}/">${esc(a.name)}</a>`).join('');

/* ---------- copy buttons ---------- */
function copy(text, btn, fallbackLabel) {
  const el = btn.querySelector('span') || btn, was = el.textContent;
  const done = ok => { el.textContent = ok ? 'Copied' : fallbackLabel; setTimeout(() => { el.textContent = was; }, 1800); };
  const legacy = () => { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} t.remove(); return ok; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(legacy())); else done(legacy());
}
const tt = document.getElementById('tooltri'); if (tt) tt.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copy(b.dataset.copy, b, 'Select it'); });
const cm = document.getElementById('copyMail'); if (cm) cm.addEventListener('click', () => copy('matt@integratedsw.tech', cm, 'matt@integratedsw.tech'));

/* ---------- project inquiry: ported unchanged from the old enhance.js ----------
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
    mark('name', !g('name')); mark('email', !emailOK);
    if (!g('name') || !emailOK) {
      say(!g('name') ? 'Please add your name so I know who I am replying to.' : 'That email does not look right, and I would not be able to reply.', 'err');
      const bad = field(!g('name') ? 'name' : 'email'); if (bad && bad.focus) bad.focus();
      return;
    }
    const subject = `Project inquiry: ${g('service')}`;
    const body = `Name: ${g('name')}\nEmail: ${g('email')}\n\nService: ${g('service')}\nBudget: ${g('budget')}\nTimeline: ${g('timeline')}\n\nDetails:\n${g('message') || '(none provided)'}\n`;
    const mailto = () => { location.href = `mailto:matt@integratedsw.tech?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
    if (!FORM_KEY) { mailto(); return; }
    form.classList.add('sending'); say('Sending…');
    try {
      const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: FORM_KEY, subject, from_name: g('name'), email: g('email'), name: g('name'), service: g('service'), budget: g('budget'), timeline: g('timeline'), message: g('message') || '(none provided)' }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.success === false) throw new Error(data.message || 'send failed');
      form.reset(); say('Thanks, that reached me. I usually reply within a day.', 'ok');
    } catch (err) {
      say('Could not send from here, so I am opening your email app instead.', 'err'); mailto();
    } finally { form.classList.remove('sending'); }
  });
}

/* ---------- rich results: the app list, with the REAL prices from the build-time App Store snapshot
   (the old homepage told Google every app cost 0) ---------- */
if (document.getElementById('appgrid')) try {
  const snap = (window.__RATINGS_SNAPSHOT && window.__RATINGS_SNAPSHOT.results) || [];
  const byId = {}; snap.forEach(r => { byId[String(r.trackId)] = r; });
  const idOf = u => ((u || '').match(/id(\d+)/) || [])[1];
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: APPS.filter(a => a.store).map((a, n) => {
    const r = byId[idOf(a.store)];
    const item = { '@type': 'SoftwareApplication', name: a.name, applicationCategory: 'MobileApplication', operatingSystem: 'iOS', url: a.store, description: a.desc,
      author: { '@type': 'Organization', name: 'Integrated Software Technologies Inc.' } };
    if (r && typeof r.price === 'number') item.offers = { '@type': 'Offer', price: r.price.toFixed(2), priceCurrency: r.currency || 'USD' };
    return { '@type': 'ListItem', position: n + 1, item };
  }) };
  const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
} catch (e) {}

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

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
  const RINGS = [[1.25, 'rgba(79,224,207,.55)', 4.2, .07], [1.9, 'rgba(242,241,238,.16)', 5.4, -.05], [2.7, 'rgba(250,184,77,.38)', 3.6, .09], [3.8, 'rgba(79,224,207,.28)', 4.8, -.12]];
  for (const [z, col, len, sp] of RINGS) {
    const r = R / z, a0 = t * sp + z * 1.7;
    rctx.beginPath(); rctx.ellipse(cx, cy, r, r * .86, 0, a0, a0 + len); rctx.strokeStyle = col; rctx.lineWidth = 1.4; rctx.stroke();
  }
  rctx.strokeStyle = 'rgba(242,241,238,.13)'; rctx.lineWidth = 1;
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
function goP(pp, smooth) { window.scrollTo({ top: pp * Math.max(0, docH - vh), behavior: smooth && !reduce ? 'smooth' : 'auto' }); }
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
/* in the hero the index is a table of contents at the bottom; after it, the sections you passed stack up top with the current one large */
function renderIndex(cur) {
  if (!index) return;
  if (cur === 0) { index.innerHTML = sections.slice(1).map((s, i) => `<span class="${i === 0 ? 'next' : ''}">${s.dataset.name}</span>`).join(''); return; }
  index.innerHTML = sections.slice(0, cur + 1).map((s, i) => `<span class="${i === cur ? 'now' : ''}">${s.dataset.name}</span>`).join('');
  scramble(index.querySelector('.now'), sections[cur].dataset.name.toUpperCase());
}
function onScroll() {
  let cur = 0; const mid = innerHeight * .4; sections.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) cur = i; });
  if (cur !== current) { current = cur; renderIndex(cur); navLinks.forEach((a, i) => a.classList.toggle('on', i === Math.min(cur, navLinks.length - 1) && cur < navLinks.length)); }
}
let ticking = false;
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });
let rz; const relayout = () => { clearTimeout(rz); rz = setTimeout(() => { if (hero) hero.size(); if (rail) rail.build(); onScroll(); if (reduce && hero) { hero.placeCards(0); hero.drawRings(0); } }, 150); };
addEventListener('resize', relayout);
if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
onScroll();
addEventListener('load', () => { if (rail) rail.build(); onScroll(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (rail) rail.build(); onScroll(); });
})();
