const CACHE = 'jsa-riwayat-harian-card-v2';
const CORE = [
  '/',
  '/index.html',
  '/admin.html',
  '/style.css',
  '/config.js',
  '/data-stok-barang.js',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/jsa.svg',
  '/vendor/jspdf.umd.min.js',
  '/vendor/xlsx.full.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('jsa-local-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
