// Tower Maze offline support (service worker) — lives next to index.html on GitHub Pages.
// Network-first: online = always fetch the latest page from GitHub and keep a fresh copy;
// offline (or no answer within NET_TIMEOUT_MS while a copy exists) = serve the saved copy.
// Bump CACHE with every release (matches APP_VERSION in the game) so old copies are deleted.
const CACHE = 'towermaze-v0.6.4';
const NET_TIMEOUT_MS = 6000;
const PAGE = new URL('./', self.location).href; // .../towermaze/

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => fetch(PAGE, { cache: 'no-cache' }).then(r => { if (r.ok) return c.put(PAGE, r); }))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('towermaze-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(req) {
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return false;
  const base = new URL(PAGE);
  return req.mode === 'navigate' && (u.pathname === base.pathname || u.pathname === base.pathname + 'index.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !isPage(req)) return; // everything else goes to the network as usual
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(PAGE);
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
      if (r.ok) cache.put(PAGE, r.clone()).catch(() => {});
      return r;
    });
    if (!saved) return net; // first visit: network only (nothing saved yet)
    const timeout = new Promise(res => setTimeout(() => res(null), NET_TIMEOUT_MS));
    try {
      const r = await Promise.race([net, timeout]);
      return (r && r.ok) ? r : saved;
    } catch (err) {
      return saved; // offline
    }
  })());
});
