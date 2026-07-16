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

const CACHE = 'ist-v4';

// Precache the shell so the very first visit is instant and offline works.
// Anything not listed here is still cached on first use — it just isn't
// fetched up front.
const SHELL = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/cinema.css',
  '/assets/wow.css',
  '/assets/fonts.css',
  '/assets/apps.js',
  '/assets/notes.js',
  '/assets/app.js',
  '/assets/enhance.js',
  '/assets/cinema.js',
  '/assets/wow.js',
  '/assets/dazzle.css',
  '/assets/dazzle.js',
  '/manifest.webmanifest'
];

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
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put('/', copy));
          return r;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('/')))
    );
    return;
  }

  // Static assets: STALE-WHILE-REVALIDATE.
  // Answer from the cache instantly if we have it, and refresh it in the
  // background either way. No hand-bumped version constant, no stuck deploys.
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req)
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
