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
  let cmdHist = [], histIdx = 0;          // shell history + up/down recall
  let snakeActive = false, snakeState = null;
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
      else if (e.key === 'Escape') closeTerm();
      // Shell-style history recall — the muscle memory any developer expects.
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (histIdx > 0) termInput.value = cmdHist[--histIdx] || ''; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx < cmdHist.length) { histIdx++; termInput.value = cmdHist[histIdx] || ''; } }
    });
    print('Integrated Software Technologies — web shell v1.0', 'muted');
    print('Type <b>help</b> for commands. You found the easter egg. 🥚', 'muted');
  }
  function print(html, cls) { const l = document.createElement('div'); l.className = 'terml ' + (cls || ''); l.innerHTML = html; termBody.appendChild(l); termBody.scrollTop = termBody.scrollHeight; }
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Match an app by its spaceless name (what `ls` prints) OR its short key,
  // so both `open netscanpro` and `cat netscan` resolve.
  const findApp = q => { q = q.replace(/\s/g, ''); return apps.find(a => a.name.toLowerCase().replace(/\s/g, '') === q || (a.key || '').toLowerCase() === q); };

  const FORTUNES = [
    'There are only two hard things in computer science: cache invalidation, naming things, and off-by-one errors.',
    'It works on my machine. 🤷',
    'Weeks of coding can save you hours of planning.',
    'A user interface is like a joke — if you have to explain it, it’s not that good.',
    '“Temporary” is the longest-lived word in software.',
    'Deleted code is debugged code.',
    'The best error message is the one that never shows up.',
    'Ship it on-device. No server, no problem.',
    'Real programmers count from 0.',
    'To understand recursion, first understand recursion.',
    '99 little bugs in the code… patch one down, compile it around, 127 little bugs in the code.',
    'Premature optimization is the root of all evil — but so is shipping nothing.'
  ];

  const TCMD = {
    help: () => {
      print('Apps: <b>ls</b> · <b>open</b> &lt;app&gt; · <b>cat</b> &lt;app&gt;');
      print('Fun:  <b>snake</b> · <b>matrix</b> · <b>fortune</b> · <b>cowsay</b> &lt;msg&gt; · <b>neofetch</b> · <b>coffee</b>');
      print('Info: <b>about</b> · <b>contact</b> · <b>whoami</b> · <b>date</b> · <b>echo</b> · <b>history</b> · <b>clear</b> · <b>exit</b>');
    },
    ls: () => print(apps.map(a => `<span class="tapp">${a.name.replace(/\s/g, '')}</span>`).join('  ')),
    cat: (arg) => {
      if (!arg) { print('usage: cat &lt;app&gt; — try <b>ls</b>', 'muted'); return; }
      const a = findApp(arg);
      if (!a) { print('cat: ' + esc(arg) + ': no such app', 'err'); return; }
      print('<b class="tapp">' + esc(a.name) + '</b> — ' + esc(a.cat));
      print(esc(a.long || a.desc));
      if (a.store) print(esc(a.store), 'muted');
    },
    about: () => print('Integrated Software Technologies Inc. — a one-person iOS studio. Native, on-device, no tracking. Built by Matthew Mesropian in Glendale, CA.'),
    contact: () => print('matt@integratedsw.tech · (818) 671-9866'),
    whoami: () => print('guest — but you clearly know your way around a keyboard.'),
    date: () => print(new Date().toString()),
    echo: (arg, raw) => print(esc(raw) || '&nbsp;'),
    fortune: () => print('🥠 ' + esc(FORTUNES[(Math.random() * FORTUNES.length) | 0])),
    cowsay: (arg, raw) => print(cowsay(raw)),
    coffee: () => print(['      ) )', '     ( (', '    ........', '    |      |]', '    \\      /', "     `----'", '', 'brewing… ☕ on-device, of course.'].join('\n'), 'ok'),
    neofetch: () => neofetch(),
    matrix: () => runMatrix(),
    snake: () => startSnake(),
    history: () => print(cmdHist.length ? cmdHist.map((c, i) => `  ${String(i + 1).padStart(3)}  ${esc(c)}`).join('\n') : 'no history yet.', 'muted'),
    sudo: (arg, raw) => {
      if (/\brm\b.*-.*r/.test(raw)) { print('rm: permission denied — and honestly, you’ll thank me later. 😌', 'err'); return; }
      print('Nice try. You already have root — this is your browser. 😎', 'ok');
    },
    clear: () => { termBody.innerHTML = ''; },
    exit: () => closeTerm(),
    '': () => {}
  };

  function runTerm(raw) {
    const line = raw.trim();
    print(`<span class="termps">$</span> ${esc(line)}`, 'echo');
    if (line && cmdHist[cmdHist.length - 1] !== line) cmdHist.push(line);
    histIdx = cmdHist.length;
    const [cmd, ...rest] = line.split(/\s+/);
    const rawArg = rest.join(' ');
    const arg = rawArg.toLowerCase();
    if (cmd === 'open') {
      const a = findApp(arg), i = a ? apps.indexOf(a) : -1;
      if (i >= 0) { print('opening ' + apps[i].name + '…', 'ok'); setTimeout(() => { closeTerm(); (window.openApp || openApp)(i); }, 350); }
      else print('open: no such app: ' + (esc(arg) || '(none)') + ' — try <b>ls</b>', 'err');
      return;
    }
    if (cmd in TCMD) TCMD[cmd](arg, rawArg);
    else print('command not found: ' + esc(cmd) + ' — try <b>help</b>', 'err');
  }
  function openTerm() { if (!term) buildTerm(); term.classList.add('open'); setTimeout(() => termInput.focus(), 60); }
  function closeTerm() { stopSnake(true); term && term.classList.remove('open'); }

  /* ------------------------------------------------------- terminal toys -- */
  function cowsay(text) {
    text = (text || 'moo').replace(/\s+/g, ' ').trim().slice(0, 120);
    const bar = ' ' + '_'.repeat(text.length + 2);
    const bot = ' ' + '-'.repeat(text.length + 2);
    const cow = [
      '        \\   ^__^',
      '         \\  (oo)\\_______',
      '            (__)\\       )\\/\\',
      '                ||----w |',
      '                ||     ||'
    ].join('\n');
    return `<span style="white-space:pre">${bar}\n&lt; ${esc(text)} &gt;\n${bot}\n${cow}</span>`;
  }

  function neofetch() {
    const live = apps.filter(a => a.status !== 'soon').length;
    const logo = ['╔════════╗', '║   ▄▄   ║', '║        ║', '║   ██   ║', '║   ██   ║', '║   ██   ║', '╚════════╝'].join('\n');
    const info = [
      ['host', 'integratedsw.tech'],
      ['studio', 'Integrated Software Technologies'],
      ['founder', 'Matthew Mesropian'],
      ['location', 'Glendale, CA'],
      ['apps', live + ' shipped'],
      ['stack', 'Swift · SwiftUI · C++ · Python'],
      ['privacy', 'on-device · 0 trackers'],
      ['uptime', 'since 2024']
    ].map(([k, v]) => `<b class="tapp">${k}</b>  ${esc(v)}`).join('\n');
    print(`<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">`
      + `<div style="color:#33e6d1;white-space:pre;line-height:1.15">${logo}</div>`
      + `<div style="white-space:pre;line-height:1.5">${info}</div></div>`);
  }

  function runMatrix() {
    const wrap = document.createElement('div');
    wrap.className = 'mtxwrap';
    wrap.innerHTML = '<canvas class="mtxcv" width="560" height="200"></canvas><div class="snakehud">decoding the mainframe…</div>';
    termBody.appendChild(wrap);
    termBody.scrollTop = termBody.scrollHeight;
    const cv = wrap.querySelector('canvas'), cx = cv.getContext('2d');
    const fs = 13, cols = Math.floor(cv.width / (fs * 0.72));
    const ys = Array(cols).fill(0).map(() => (Math.random() * 15) | 0);
    const glyphs = '01<>{}[]=;/\\+*アイウエオカサ0123456789abcdef';
    const pick = () => glyphs[(Math.random() * glyphs.length) | 0];
    cx.fillStyle = '#06070d'; cx.fillRect(0, 0, cv.width, cv.height);
    const timer = setInterval(() => {
      cx.fillStyle = 'rgba(6,7,13,0.12)'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.font = fs + 'px monospace';
      for (let i = 0; i < cols; i++) {
        const x = i * fs * 0.72, y = ys[i] * fs;
        cx.fillStyle = '#6ef2e0'; cx.fillText(pick(), x, y);
        cx.fillStyle = '#248c85'; cx.fillText(pick(), x, y - fs);
        ys[i] = (y > cv.height && Math.random() > 0.96) ? 0 : ys[i] + 1;
      }
    }, 55);
    setTimeout(() => { clearInterval(timer); const cap = wrap.querySelector('.snakehud'); if (cap) cap.textContent = 'decoded. it was on-device all along.'; }, 4600);
  }

  /* ----------------------------------------------------------- snake game -- */
  function startSnake() {
    if (snakeActive || !term) return;
    snakeActive = true;
    termInput.disabled = true; termInput.blur();
    const cell = 14, cols = 28, rows = 16;
    const wrap = document.createElement('div');
    wrap.className = 'snakewrap';
    wrap.innerHTML = `<canvas class="snakecv" width="${cols * cell}" height="${rows * cell}"></canvas>`
      + `<div class="snakehud"><span class="snakescore">score 0</span> · arrows / WASD to move · Q to quit</div>`;
    termBody.appendChild(wrap);
    termBody.scrollTop = termBody.scrollHeight;
    const cv = wrap.querySelector('canvas'), cx = cv.getContext('2d');
    const scoreEl = wrap.querySelector('.snakescore');
    let snake, dir, nextDir, food, score, dead;
    function spawn() { let p; do { p = { x: (Math.random() * cols) | 0, y: (Math.random() * rows) | 0 }; } while (snake && snake.some(s => s.x === p.x && s.y === p.y)); return p; }
    function reset() { snake = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }]; dir = { x: 1, y: 0 }; nextDir = dir; score = 0; scoreEl.textContent = 'score 0'; food = spawn(); dead = false; draw(); }
    function draw() {
      cx.fillStyle = '#06070d'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.fillStyle = '#fab84d'; cx.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4);
      snake.forEach((s, i) => { cx.fillStyle = i === 0 ? '#6ef2e0' : '#33e6d1'; cx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2); });
    }
    function over() {
      dead = true;
      cx.fillStyle = 'rgba(6,7,13,0.74)'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.textAlign = 'center';
      cx.fillStyle = '#fa6b6b'; cx.font = 'bold 22px monospace'; cx.fillText('GAME OVER', cv.width / 2, cv.height / 2 - 4);
      cx.fillStyle = '#98a0b8'; cx.font = '12px monospace'; cx.fillText('score ' + score + '  ·  Enter to retry  ·  Q to quit', cv.width / 2, cv.height / 2 + 18);
      cx.textAlign = 'left';
    }
    function tick() {
      if (dead) return;
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows || snake.some(s => s.x === head.x && s.y === head.y)) { over(); return; }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; scoreEl.textContent = 'score ' + score; food = spawn(); } else { snake.pop(); }
      draw();
    }
    reset();
    const timer = setInterval(tick, 110);
    snakeState = {
      setDir(d) { if (dead) return; if (d.x === -dir.x && d.y === -dir.y) return; nextDir = d; },
      retry() { if (dead) reset(); },
      stop() { clearInterval(timer); }
    };
  }
  function stopSnake(silent) {
    if (!snakeActive) return;
    snakeActive = false;
    if (snakeState) { snakeState.stop(); snakeState = null; }
    if (termInput) termInput.disabled = false;
    if (!silent) { print('snake: quit — thanks for playing. 🐍', 'muted'); setTimeout(() => termInput && termInput.focus(), 40); }
  }
  function handleSnakeKey(e) {
    const k = e.key;
    if (k === 'q' || k === 'Q' || k === 'Escape') { e.preventDefault(); stopSnake(false); return; }
    if (k === 'Enter') { e.preventDefault(); if (snakeState) snakeState.retry(); return; }
    const m = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    const dv = m[k.toLowerCase()];
    if (dv) { e.preventDefault(); if (snakeState) snakeState.setDir({ x: dv[0], y: dv[1] }); }
  }

  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kk = 0;
  addEventListener('keydown', e => {
    // While snake is running it owns the keyboard: arrows steer (and must not
    // scroll the page or advance the Konami counter), Q/Esc quit.
    if (snakeActive) { handleSnakeKey(e); return; }
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
