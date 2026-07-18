/* ============================================================================
   Integrated Software Technologies — enhancements layer
   Adds: live App Store ratings · rich results (JSON-LD) · PWA · a hidden
   terminal easter egg (Konami code). No visible UI chrome — the site stays
   dark-first and uncluttered. Loads after app.js; reads its global APPS array.
   ============================================================================ */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const apps = (typeof APPS !== 'undefined') ? APPS : [];
  const grid = $('#appgrid');

  /* ------------------------------------------------ Live App Store ratings */
  // one JSONP call to the public iTunes Lookup API for every app with an id.
  const idOf = url => (url && url.match(/id(\d+)/) || [])[1];
  const rated = apps.map((a, i) => ({ a, i, id: idOf(a.store) })).filter(x => x.id);
  window.__ratings = {}; // id -> {avg,count,price}
  function starHTML(v) {
    const full = Math.round(v);
    return '<span class="stars" aria-hidden="true">' +
      Array.from({ length: 5 }, (_, k) => `<span class="${k < full ? 'on' : ''}">★</span>`).join('') + '</span>';
  }
  function badge(r) {
    if (!r) return '';
    if (r.count > 0) return `<span class="rating">${starHTML(r.avg)}<b>${r.avg.toFixed(1)}</b><span class="rc">${r.count.toLocaleString()} ratings</span></span>`;
    return `<span class="rating new">${r.price || 'On the App Store'}</span>`;
  }
  window.__appmeta = {}; // id -> {version,updated,size,minOs,genre,price}
  window.__istRatings = function (data) {
    (data && data.results || []).forEach(r => {
      window.__ratings[r.trackId] = {
        avg: +r.averageUserRating || 0,
        count: +r.userRatingCount || 0,
        price: r.formattedPrice || (r.price === 0 ? 'Free' : '')
      };
      window.__appmeta[r.trackId] = {
        version: r.version || '',
        updated: r.currentVersionReleaseDate ? new Date(r.currentVersionReleaseDate) : null,
        size: +r.fileSizeBytes ? Math.round(+r.fileSizeBytes / 1048576) + ' MB' : '',
        minOs: r.minimumOsVersion ? 'iOS ' + r.minimumOsVersion + '+' : '',
        genre: r.primaryGenreName || '',
        price: r.formattedPrice || (r.price === 0 ? 'Free' : '')
      };
    });
    rated.forEach(({ i, id }) => {
      const r = window.__ratings[id]; if (!r) return;
      const card = grid && grid.querySelector(`.card[data-app="${i}"] .top > div`);
      if (card && !card.querySelector('.rating')) card.insertAdjacentHTML('beforeend', badge(r));
    });
  };
  // Seed from the BUILD-TIME snapshot first (assets/ratings.js, written by
  // build.js) so badges render even if Apple ever retires the lookup JSONP the
  // way it retired the reviews feed — then let the live call overwrite it.
  if (window.__RATINGS_SNAPSHOT) {
    try { window.__istRatings(window.__RATINGS_SNAPSHOT); } catch (e) {}
  }
  if (rated.length) {
    const s = document.createElement('script');
    s.src = 'https://itunes.apple.com/lookup?id=' + rated.map(x => x.id).join(',') +
      '&country=us&callback=__istRatings';
    s.onerror = () => {};
    document.head.appendChild(s);
  }
  // enrich the detail modal too, by wrapping app.js's openApp
  if (typeof openApp === 'function') {
    const _open = openApp;
    window.openApp = function (i) {
      _open(i);
      try {
        const id = idOf(apps[i].store), r = id && window.__ratings[id];
        if (r) {
          const cat = document.querySelector('#appmodal .mhead .cat');
          if (cat && !cat.parentNode.querySelector('.rating')) cat.insertAdjacentHTML('afterend', badge(r));
        }
        const m = id && window.__appmeta[id], links = document.querySelector('#appmodal .mlinks');
        if (m && links && !document.querySelector('#appmodal .mmeta')) {
          const bits = [
            m.price && `<span>${m.price}</span>`,
            m.version && `<span>Version ${m.version}</span>`,
            m.updated && `<span>Updated ${m.updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>`,
            m.size && `<span>${m.size}</span>`,
            m.minOs && `<span>${m.minOs}</span>`
          ].filter(Boolean).join('<i>·</i>');
          if (bits) links.insertAdjacentHTML('afterend', `<div class="mmeta">${bits}</div>`);
        }
      } catch (e) {}
    };
  }

  /* --------------------------------------------------- Terminal easter egg */
  // hidden: only appears if you enter the Konami code. No visible trigger.
  let term, termBody, termInput;
  function buildTerm() {
    term = document.createElement('div');
    term.id = 'term';
    term.innerHTML =
      `<div class="termwin" role="dialog" aria-label="Terminal">
         <div class="termbar"><span class="td r"></span><span class="td y"></span><span class="td g"></span>
           <span class="termtitle">matt@integratedsw ~ %</span><button class="termx" aria-label="Close">✕</button></div>
         <div class="termbody" id="termbody"></div>
         <div class="termline"><span class="termps">$</span><input id="terminput" autocomplete="off" spellcheck="false" aria-label="terminal input"></div>
       </div>`;
    document.body.appendChild(term);
    termBody = $('#termbody'); termInput = $('#terminput');
    term.querySelector('.termx').addEventListener('click', closeTerm);
    term.addEventListener('mousedown', e => { if (e.target === term) closeTerm(); });
    termInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { runTerm(termInput.value); termInput.value = ''; }
      if (e.key === 'Escape') closeTerm();
    });
    print('Integrated Software Technologies — web shell v1.0', 'muted');
    print('Type <b>help</b> for commands. You found the easter egg. 🥚', 'muted');
  }
  function print(html, cls) { const l = document.createElement('div'); l.className = 'terml ' + (cls || ''); l.innerHTML = html; termBody.appendChild(l); termBody.scrollTop = termBody.scrollHeight; }
  const TCMD = {
    help: () => print('Commands: <b>ls</b>, <b>open</b> &lt;app&gt;, <b>about</b>, <b>contact</b>, <b>whoami</b>, <b>sudo</b>, <b>clear</b>, <b>exit</b>'),
    ls: () => print(apps.map(a => `<span class="tapp">${a.name.replace(/\s/g, '')}</span>`).join('  ')),
    about: () => print('Integrated Software Technologies Inc. — a one-person iOS studio. Native, on-device, no tracking. Built by Matthew Mesropian in Glendale, CA.'),
    contact: () => print('matt@integratedsw.tech · (818) 671-9866'),
    whoami: () => print('guest — but you clearly know your way around a keyboard.'),
    sudo: () => print('Nice try. You already have root — this is your browser. 😎', 'ok'),
    clear: () => { termBody.innerHTML = ''; },
    exit: () => closeTerm(),
    '': () => {}
  };
  function runTerm(raw) {
    const line = raw.trim();
    print(`<span class="termps">$</span> ${line.replace(/</g, '&lt;')}`, 'echo');
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(' ').toLowerCase();
    if (cmd === 'open') {
      const i = apps.findIndex(a => a.name.toLowerCase().replace(/\s/g, '') === arg.replace(/\s/g, ''));
      if (i >= 0) { print('opening ' + apps[i].name + '…', 'ok'); setTimeout(() => { closeTerm(); (window.openApp || openApp)(i); }, 350); }
      else print('open: no such app: ' + (arg || '(none)') + ' — try <b>ls</b>', 'err');
      return;
    }
    if (cmd in TCMD) TCMD[cmd]();
    else print('command not found: ' + cmd + ' — try <b>help</b>', 'err');
  }
  function openTerm() { if (!term) buildTerm(); term.classList.add('open'); setTimeout(() => termInput.focus(), 60); }
  function closeTerm() { term && term.classList.remove('open'); }

  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kk = 0;
  addEventListener('keydown', e => {
    // ` opens the terminal directly (Quake-style) — but never while typing in a
    // field, or the shortcut would eat backticks from the inquiry form and the
    // terminal's own input.
    if (e.key === '`' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                           t.tagName === 'SELECT' || t.isContentEditable);
      if (!typing) { e.preventDefault(); openTerm(); return; }
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kk = (k === KONAMI[kk]) ? kk + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kk === KONAMI.length) { kk = 0; openTerm(); }
  });

  /* ---------------------------------------------------- reveal + card FX -- */
  // app.js only observed .reveal elements present at load; animate any we add
  // dynamically, and give new .card elements the same tilt/glow behaviour.
  const revIO = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revIO.unobserve(e.target); } });
  }, { threshold: .12 });
  const revealIn = scope => $$('.reveal:not(.in)', scope || document).forEach(el => revIO.observe(el));
  function bindCard(card) {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `translateY(-6px) perspective(800px) rotateX(${-y * 6}deg) rotateY(${x * 8}deg)`;
      const g = card.querySelector('.glow');
      if (g) { g.style.left = (e.clientX - r.left - 110) + 'px'; g.style.top = (e.clientY - r.top - 110) + 'px'; g.style.right = 'auto'; }
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }

  /* -------------------------------------------------------------- Journal -- */
  const jgrid = $('#journalgrid'), notes = (typeof NOTES !== 'undefined') ? NOTES : [];
  if (jgrid && notes.length) {
    const fmt = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    jgrid.innerHTML = notes.map((n, i) => `
      <a class="card note reveal ${['', 'd1', 'd2'][i % 3]}" href="notes/${n.slug}/" style="--a:var(--c2)">
        <div class="glow" style="--gc:var(--c2)"></div>
        <div class="ntop"><span class="ndate">${fmt(n.date)}</span>
          <span class="ntags">${(n.tags || []).slice(0, 2).map(t => `<span>${t}</span>`).join('')}</span></div>
        <h3>${n.title}</h3>
        <div class="desc">${n.dek}</div>
        <span class="chip more">Read →</span>
      </a>`).join('');
    $$('.card.note', jgrid).forEach(bindCard);
    revealIn(jgrid);
  }

  /* -------------------------------------------------- Testimonials: gone --
     Apple retired the public customerreviews RSS feed — every request 400s —
     so the live-testimonials loader here could never render again. It was
     eleven failed script loads on every visit. Removed; if reviews come back
     they come back hand-curated, not as a dead feed. */

  /* --------------------------------------------------------- Inquiry form */
  const form = $('#inquiry');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form), g = k => (f.get(k) || '').toString().trim();
    const subject = `Project inquiry: ${g('service')}`;
    const body =
      `Name: ${g('name')}\nEmail: ${g('email')}\n\n` +
      `Service: ${g('service')}\nBudget: ${g('budget')}\nTimeline: ${g('timeline')}\n\n` +
      `Details:\n${g('message') || '(none provided)'}\n`;
    location.href = `mailto:matt@integratedsw.tech?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  /* --------------------------------------------------- Rich results: apps -- */
  // ItemList of SoftwareApplication for Google (injected; Google renders JS).
  try {
    const ld = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: apps.filter(a => a.store).map((a, n) => ({
        '@type': 'ListItem', position: n + 1,
        item: {
          '@type': 'SoftwareApplication', name: a.name, applicationCategory: 'MobileApplication',
          operatingSystem: 'iOS', url: a.store, description: a.desc,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          author: { '@type': 'Organization', name: 'Integrated Software Technologies Inc.' }
        }
      }))
    };
    const s = document.createElement('script'); s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld); document.head.appendChild(s);
  } catch (e) {}

  /* ------------------------------------------------------------------ PWA -- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
