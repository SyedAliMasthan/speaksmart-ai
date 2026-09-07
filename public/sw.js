const CACHE_NAME = 'speaksmart-static-v3';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('speaksmart') && name !== CACHE_NAME) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/assets/') || request.headers.has('Authorization')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME); const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && !response.headers.get('Cache-Control')?.includes('no-store')) await cache.put(request, response.clone());
    return response;
  })());
});
