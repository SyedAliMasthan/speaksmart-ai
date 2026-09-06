const CACHE_NAME = 'speaksmart-v2';
const STATIC = ['/', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co') || url.hostname.includes('groq.com')) return;

  if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|png|svg|woff2)$/)) {
    e.respondWith(caches.match(request).then(c => c || fetch(request).then(r => {
      const cl = r.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, cl));
      return r;
    })));
    return;
  }

  if (request.headers.get('Accept')?.includes('text/html')) {
    e.respondWith(fetch(request).then(r => {
      caches.open(CACHE_NAME).then(c => c.put(request, r.clone()));
      return r;
    }).catch(() => caches.match(request).then(c => c || caches.match('/'))));
    return;
  }

  e.respondWith(fetch(request).catch(() => caches.match(request)));
});
