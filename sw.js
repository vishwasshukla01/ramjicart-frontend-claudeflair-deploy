const CACHE_NAME = 'ramjicart-pages-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('ramjicart-pages-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const responseToCache = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache)).catch((error) => {
            console.error('Unable to cache page for offline use:', error);
          })
        );
      }
      return response;
    }).catch(() =>
      caches.match(request).then((cachedResponse) =>
        cachedResponse || caches.match('/').then((cachedHomePage) => cachedHomePage || Response.error())
      )
    )
  );
});
