/* ============================================================================
   Integrated Software Technologies — service worker
   ----------------------------------------------------------------------------
   WHAT WAS WRONG WITH THE OLD ONE (and it was not theoretical — it silently ate
   an entire afternoon of CSS changes):

   It was CACHE-FIRST with a lazy fill: `caches.match(req) || fetch(req)`, and
   every successful fetch was written back into the cache. So the first time a
   visitor loaded any asset it was frozen, permanently, and the ONLY way to ever
   update it was to remember to bump the CACHE constant by hand. The header even
   said so — "bump CACHE when you change shell assets" — which is a note asking a
   human to be perfect forever. Deploy a fix, and everyone who has been to the
   site before keeps the broken version. Hard-refreshing does not help them,
   because the service worker answers before the network is ever consulted.

   THE FIX: stale-while-revalidate.

   Serve the cached copy IMMEDIATELY (so the site still opens instantly and still
   works offline — that was the point of having this at all), but ALWAYS go to the
   network in the background and write the fresh copy back. The visitor sees a
   fast page now, and the correct page from their very next navigation onward.
   Nobody has to remember anything, and a bad deploy can no longer be permanent.
   ========================================================================== */

// Bumping CACHE is NOT the normal update path — stale-while-revalidate handles
// that on its own, which is the whole point of the rewrite described above.
// Bump it only to force a one-time flush for everyone, as with v5, which
// shipped the fix for the homepage rendering blank when a script hung.
// v6 (2026-10-17): the studio redesign replaced the whole homepage and its assets.
// v7 (same day): every page restyled, and the fetches below now bypass the HTTP cache
// (GitHub Pages sends max-age=600, which kept serving pre-deploy pages for 10 minutes).
const CACHE = 'ist-v7';

// Precache the shell so the very first visit is instant and offline works.
// Anything not listed here is still cached on first use — it just isn't
// fetched up front.
const SHELL = [
  '/',
  '/index.html',
  '/assets/studio.css',
  '/assets/term.css',
  '/assets/studio/fonts/archivo.woff2',
  '/assets/studio/fonts/inter.woff2',
  '/assets/studio/fonts/geist-mono.woff2',
  '/assets/studio/fonts/instrument-serif-italic.woff2',
  '/assets/apps.js',
  '/assets/ratings.js',
  '/assets/term.js',
  '/assets/studio.js',
  // the app pages still use the original theme
  '/assets/style.css',
  '/assets/fonts.css',
  '/manifest.webmanifest'
];

// Content, not chrome. Anything matching this is served network-first — see the
// long note in the fetch handler for why SWR is wrong for these specifically.
const DATA = /^\/assets\/(apps|ratings)\.js$/;

self.addEventListener('install', e => {
  // `addAll` is atomic — one 404 and the whole install fails, leaving the site
  // with no worker at all. Add them individually so a single renamed file cannot
  // take the offline experience down with it.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never touch cross-origin (the live iTunes ratings + reviews lookups).
  if (url.origin !== location.origin) return;

  // The document itself is network-first: content should be as fresh as the
  // connection allows, and the cache is only the offline safety net.
  if (req.mode === 'navigate') {
    e.respondWith(
      // cache: 'no-cache' revalidates with the server instead of trusting the browser's HTTP
      // cache, so a deploy shows on the very next load. Each page is stored under its OWN
      // URL (it used to be stored under '/', so offline the homepage became whatever page
      // was visited last).
      fetch(req, { cache: 'no-cache' })
        .then(r => {
          if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return r;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('/')))
    );
    return;
  }

  // DATA is network-first, like the document — not stale-while-revalidate.
  //
  // These files are not static assets, they are the site's content. The app grid
  // in index.html is server-rendered at build time and therefore rides the
  // navigation policy above (always fresh), while cinema.js builds its slides at
  // runtime from apps.js. Under SWR those two paths disagree for exactly one load
  // after every deploy — which is how Quitter showed "In review" in the scroll
  // section while the card grid on the same page already showed the App Store
  // button. Same data, two render paths, two freshness policies.
  //
  // Serving them network-first costs one request and makes the page internally
  // consistent. The cache is still the offline fallback.
  if (DATA.test(url.pathname)) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets: STALE-WHILE-REVALIDATE.
  // Answer from the cache instantly if we have it, and refresh it in the
  // background either way. No hand-bumped version constant, no stuck deploys.
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req, { cache: 'no-cache' })
        .then(r => {
          if (r && r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return r;
        })
        .catch(() => hit);          // offline: the cached copy is all we have
      return hit || fresh;
    })
  );
});
