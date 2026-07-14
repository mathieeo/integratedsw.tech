/* ============================================================================
   Integrated Software Technologies — enhancements layer
   Adds: theme toggle · accent picker · app filter/search · ⌘K command palette ·
   terminal easter egg · live App Store ratings · PWA · rich results (JSON-LD).
   Loads after app.js, so the app grid is already rendered. Reads the global
   APPS array declared in app.js.
   ============================================================================ */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const apps = (typeof APPS !== 'undefined') ? APPS : [];
  const root = document.documentElement;

  /* ---------------------------------------------------------------- Theme -- */
  const themeBtn = $('#themeToggle');
  function setTheme(t, persist) {
    root.setAttribute('data-theme', t);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f4f5fb' : '#06070d');
    if (persist) { try { localStorage.setItem('ist-theme', t); } catch (e) {} }
  }
  themeBtn && themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next, true);
  });

  /* --------------------------------------------------------------- Accent -- */
  const ACCENTS = [
    ['#8b5cf6', 'Violet'], ['#22d3ee', 'Cyan'], ['#34d399', 'Emerald'],
    ['#ec4899', 'Pink'], ['#f59e0b', 'Amber'], ['#3b82f6', 'Blue'], ['#f43f5e', 'Rose']
  ];
  const accPop = $('#accpop'), accBtn = $('#openAccent');
  if (accPop) {
    accPop.innerHTML = ACCENTS.map(([c, n]) =>
      `<button class="accsw" role="menuitem" data-c="${c}" title="${n}" style="background:${c}"></button>`).join('') +
      `<button class="accsw accreset" data-c="#8b5cf6" title="Reset">↺</button>`;
    const applyAccent = (c, persist) => {
      root.style.setProperty('--c2', c);
      const dot = $('.accdot'); if (dot) dot.style.background = c;
      if (persist) { try { localStorage.setItem('ist-accent', c); } catch (e) {} }
    };
    accPop.addEventListener('click', e => {
      const b = e.target.closest('.accsw'); if (!b) return;
      applyAccent(b.dataset.c, true); accPop.classList.remove('open');
    });
    accBtn.addEventListener('click', e => { e.stopPropagation(); accPop.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!e.target.closest('.ntaccent')) accPop.classList.remove('open'); });
  }

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
  window.__istRatings = function (data) {
    (data && data.results || []).forEach(r => {
      window.__ratings[r.trackId] = {
        avg: +r.averageUserRating || 0,
        count: +r.userRatingCount || 0,
        price: r.formattedPrice || (r.price === 0 ? 'Free' : '')
      };
    });
    rated.forEach(({ i, id }) => {
      const r = window.__ratings[id]; if (!r) return;
      const card = grid && grid.querySelector(`.card[data-app="${i}"] .top > div`);
      if (card && !card.querySelector('.rating')) card.insertAdjacentHTML('beforeend', badge(r));
    });
  };
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
      } catch (e) {}
    };
  }

  /* --------------------------------------------------- ⌘K command palette -- */
  const pal = document.createElement('div');
  pal.id = 'palette';
  pal.innerHTML =
    `<div class="palback"></div>
     <div class="palbox" role="dialog" aria-modal="true" aria-label="Command palette">
       <div class="palin"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
         <input id="palq" placeholder="Search apps and actions…" autocomplete="off"><span class="palesc">esc</span></div>
       <div class="pallist" id="pallist"></div>
     </div>`;
  document.body.appendChild(pal);
  const palList = $('#pallist'), palQ = $('#palq');

  function commands() {
    const items = [];
    apps.forEach((a, i) => items.push({
      kind: 'App', label: a.name, sub: a.cat, icon: a.icon,
      run: () => { closePal(); (window.openApp || openApp)(i); }
    }));
    [['Apps', '#apps'], ['Open Source', '#opensource'], ['Services', '#services'], ['About', '#about'], ['Contact', '#contact']]
      .forEach(([l, h]) => items.push({ kind: 'Go', label: l, sub: 'Jump to section', glyph: '↘', run: () => { closePal(); location.hash = h; } }));
    items.push({ kind: 'Action', label: 'Toggle light / dark', sub: 'Theme', glyph: '◐', run: () => { themeBtn && themeBtn.click(); } });
    items.push({ kind: 'Action', label: 'Email Matthew', sub: 'matt@integratedsw.tech', glyph: '✉', run: () => { closePal(); location.href = 'mailto:matt@integratedsw.tech'; } });
    items.push({ kind: 'Action', label: 'Open source on GitHub', sub: 'github.com/mathieeo', glyph: '⌥', run: () => { closePal(); open('https://github.com/mathieeo', '_blank'); } });
    items.push({ kind: 'Fun', label: 'Open terminal', sub: 'A little easter egg', glyph: '▸', run: () => { closePal(); openTerm(); } });
    return items;
  }
  let palItems = [], palIdx = 0;
  function renderPal(q) {
    q = (q || '').trim().toLowerCase();
    const all = commands();
    palItems = !q ? all : all.filter(c => (c.label + ' ' + c.sub + ' ' + c.kind).toLowerCase().includes(q));
    palIdx = 0;
    palList.innerHTML = palItems.length ? palItems.map((c, i) => {
      const ic = c.icon ? `<img src="assets/icons/${c.icon}.png" alt="">` : `<span class="palglyph">${c.glyph || '›'}</span>`;
      return `<div class="palrow${i === 0 ? ' on' : ''}" data-i="${i}">${ic}
        <span class="pallabel">${c.label}<small>${c.sub}</small></span><span class="palkind">${c.kind}</span></div>`;
    }).join('') : `<div class="palnone">No matches for “${q}”</div>`;
  }
  function movePal(d) {
    if (!palItems.length) return;
    palIdx = (palIdx + d + palItems.length) % palItems.length;
    $$('.palrow', palList).forEach((r, i) => r.classList.toggle('on', i === palIdx));
    const el = $$('.palrow', palList)[palIdx]; el && el.scrollIntoView({ block: 'nearest' });
  }
  function openPal() { renderPal(''); pal.classList.add('open'); document.body.style.overflow = 'hidden'; setTimeout(() => palQ.focus(), 30); }
  function closePal() { pal.classList.remove('open'); palQ.value = ''; document.body.style.overflow = ''; }
  palQ.addEventListener('input', () => renderPal(palQ.value));
  palList.addEventListener('mousemove', e => { const r = e.target.closest('.palrow'); if (r) { palIdx = +r.dataset.i; $$('.palrow', palList).forEach(x => x.classList.toggle('on', x === r)); } });
  palList.addEventListener('click', e => { const r = e.target.closest('.palrow'); if (r) palItems[+r.dataset.i].run(); });
  pal.addEventListener('click', e => { if (e.target.classList.contains('palback')) closePal(); });
  $('#openPalette') && $('#openPalette').addEventListener('click', openPal);
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('open') ? closePal() : openPal(); return; }
    if (!pal.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closePal(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); movePal(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); movePal(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); palItems[palIdx] && palItems[palIdx].run(); }
  });

  /* --------------------------------------------------- Terminal easter egg */
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
    help: () => print('Commands: <b>ls</b>, <b>open</b> &lt;app&gt;, <b>about</b>, <b>contact</b>, <b>theme</b>, <b>whoami</b>, <b>sudo</b>, <b>clear</b>, <b>exit</b>'),
    ls: () => print(apps.map(a => `<span class="tapp">${a.name.replace(/\s/g, '')}</span>`).join('  ')),
    about: () => print('Integrated Software Technologies Inc. — a one-person iOS studio. Native, on-device, no tracking. Built by Matthew Mesropian in Glendale, CA.'),
    contact: () => print('matt@integratedsw.tech · (818) 671-9866'),
    whoami: () => print('guest — but you clearly know your way around a keyboard.'),
    theme: () => { themeBtn && themeBtn.click(); print('theme toggled → ' + root.getAttribute('data-theme')); },
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

  // Konami code → terminal
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kk = 0;
  addEventListener('keydown', e => {
    if (pal.classList.contains('open')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kk = (k === KONAMI[kk]) ? kk + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kk === KONAMI.length) { kk = 0; openTerm(); }
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
