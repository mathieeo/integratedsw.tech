/* ============================================================================
   Integrated Software Technologies — enhancements layer
   Adds: live App Store ratings · rich results (JSON-LD) · PWA · a hidden
   terminal easter egg (Konami code). No visible UI chrome — the site stays
   dark-first and uncluttered. Loads after app.js; reads its global APPS array.
   ============================================================================ */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
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
