/* Integrated Software Technologies — service worker
   Cache-first for the app shell so the site opens instantly and works offline.
   Bump CACHE when you change shell assets to force an update. */
const CACHE = 'ist-v2';
const SHELL = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/fonts.css',
  '/assets/apps.js',
  '/assets/notes.js',
  '/assets/app.js',
  '/assets/enhance.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never cache cross-origin (e.g. the live iTunes ratings lookup)
  if (url.origin !== location.origin) return;

  // network-first for the document so content stays fresh; fall back to cache offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put('/', copy));
      return r;
    }).catch(() => caches.match('/') || caches.match('/index.html')));
    return;
  }
  // cache-first for static assets, then fill the cache lazily
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => hit)));
});
