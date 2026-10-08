// No se guardan respuestas privadas ni datos de huéspedes en caché.
const CACHE = 'gesell-shell-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/offline.html', '/offline.css', '/icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const path = new URL(event.request.url).pathname;
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
  else if (path === '/offline.css') event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});
