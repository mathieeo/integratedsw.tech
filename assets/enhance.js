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
    // A cross-origin <script> has no timeout of its own: on a bad cellular
    // connection it can hang, which keeps `window.load` from ever firing. The
    // build-time snapshot has already painted the badges, so after 6 seconds
    // this request has nothing left to offer and is dropped.
    setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 6000);
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

  /* --------------------------------------------------- Terminal: term.js --
     The terminal used to live here and had grown to 60% of this file. It is
     now assets/term.js, which owns its own hotkeys, the dock button and the
     Konami code. Nothing here needs to know about it. */

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

  /* -------------------------------------------------- Testimonials: gone --
     Apple retired the public customerreviews RSS feed — every request 400s —
     so the live-testimonials loader here could never render again. It was
     eleven failed script loads on every visit. Removed; if reviews come back
     they come back hand-curated, not as a dead feed. */

  /* --------------------------------------------------------- Inquiry form */
  // Paste the Web3Forms access key here. One is free at https://web3forms.com —
  // enter matt@integratedsw.tech and they email the key straight back; there is
  // no account to create.
  //
  // Leaving this empty is SAFE. The form silently reverts to the old mailto:
  // behaviour, so the site is never worse than it was before. The key is a
  // public submit token by design, not a secret: it only permits posting to
  // this one inbox, which is all the form does anyway.
  const FORM_KEY = '5e673ac9-cbd9-40bd-8329-bd19c37f43c7';

  const form = $('#inquiry');
  if (form) {
    const note = $('#formnote');
    let noteDefault = note ? note.textContent : '';
    const say = (msg, cls) => {
      if (!note) return;
      note.textContent = msg;
      note.className = 'fnote' + (cls ? ' ' + cls : '');
    };
    const field = k => form.querySelector(`[name="${k}"]`);
    const mark = (k, bad) => { const el = field(k); if (el) el.classList.toggle('bad', bad); };

    // The markup promises the mailto: behaviour, because that is what runs with
    // no key. Once a key exists the promise changes, so the copy has to as well
    // — a form that says "sent straight to my inbox" while opening Mail.app is
    // a small lie, and this is the one part of the site asking for trust.
    if (FORM_KEY && note) {
      note.textContent = 'Sent straight to my inbox. No accounts, no tracking, nothing stored on this site.';
      noteDefault = note.textContent;
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(form), g = k => (f.get(k) || '').toString().trim();

      // Dropped with no request at all: a human never sees the honeypot, so
      // anything in it is automated and is not worth a round trip.
      if (g('botcheck')) return;

      // The form was `novalidate` and accepted anything, which meant an inquiry
      // could arrive with no way to reply to it. A name and a plausible email
      // are the minimum that makes the message worth sending.
      const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g('email'));
      mark('name', !g('name'));
      mark('email', !emailOK);
      if (!g('name') || !emailOK) {
        say(!g('name')
          ? 'Please add your name so I know who I am replying to.'
          : 'That email does not look right, and I would not be able to reply.', 'err');
        const bad = field(!g('name') ? 'name' : 'email');
        if (bad && bad.focus) bad.focus();
        return;
      }

      const subject = `Project inquiry: ${g('service')}`;
      const body =
        `Name: ${g('name')}\nEmail: ${g('email')}\n\n` +
        `Service: ${g('service')}\nBudget: ${g('budget')}\nTimeline: ${g('timeline')}\n\n` +
        `Details:\n${g('message') || '(none provided)'}\n`;
      const mailto = () => {
        location.href = `mailto:matt@integratedsw.tech?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      };

      if (!FORM_KEY) { form.dispatchEvent(new CustomEvent('ist:sent')); mailto(); return; }

      form.classList.add('sending');
      say('Sending…');
      try {
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: FORM_KEY,
            subject,
            from_name: g('name'),
            // Web3Forms treats `email` as the reply-to, which is the point:
            // replying to the notification goes straight back to the sender.
            email: g('email'),
            name: g('name'),
            service: g('service'),
            budget: g('budget'),
            timeline: g('timeline'),
            message: g('message') || '(none provided)'
          })
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.success === false) throw new Error(data.message || 'send failed');
        form.reset();
        say('Thanks, that reached me. I usually reply within a day.', 'ok');
        form.dispatchEvent(new CustomEvent('ist:sent'));
      } catch (err) {
        // Offline, blocked by an extension, or the service is down. Never
        // dead-end the visitor: hand them the pre-filled email instead.
        say('Could not send from here, so I am opening your email app instead.', 'err');
        mailto();
      } finally {
        form.classList.remove('sending');
      }
    });

    // Clear the error state the moment they start fixing it.
    form.addEventListener('input', e => {
      if (e.target.classList && e.target.classList.contains('bad')) {
        e.target.classList.remove('bad');
        if (note && note.classList.contains('err')) say(noteDefault);
      }
    });
  }

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
