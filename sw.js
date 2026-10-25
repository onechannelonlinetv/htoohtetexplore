/* HTOO HTET — PWA service worker (auto-update friendly) */
const CACHE = 'hh-pwa-v3';
const PRECACHE = ['./icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() => {
      // Tell open tabs/PWA windows a new SW is active → they can soft-reload
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          try { client.postMessage({ type: 'HH_SW_UPDATED', cache: CACHE }); } catch (e) {}
        });
      });
    })
  );
});

function isHtmlRequest(req, url) {
  if (req.mode === 'navigate') return true;
  const path = url.pathname || '';
  if (path.endsWith('.html') || path.endsWith('/') || path === '' || /\/index(\.html)?$/i.test(path)) return true;
  const accept = req.headers && req.headers.get('accept');
  if (accept && accept.indexOf('text/html') !== -1) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept Firebase / Google / storage
  if (/firebase|googleapis|gstatic|firebasestorage|ytimg|youtube/i.test(url.hostname)) return;

  // Admin always network
  if (url.pathname.indexOf('admin') !== -1) return;

  // HTML / navigation: network-only (no stale shell for Add-to-Home)
  if (isHtmlRequest(req, url)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then((res) => res).catch(() =>
        caches.match('./index.html').then((r) => r || caches.match(req))
      )
    );
    return;
  }

  // Static same-origin: network-first, cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
