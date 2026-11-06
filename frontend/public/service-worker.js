const CACHE_NAME = 'campus-styles-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './css/style.css',
  './css/styles.css',
  './js/config.js',
  './js/api.js',
  './js/main.js',
  './pages/index.html',
  './pages/shop.html',
  './pages/product.html',
  './pages/about.html',
  './pages/contact.html',
  './pages/cart.html',
  './pages/checkout.html',
  './pages/login.html',
  './pages/register.html',
  './pages/forgot-password.html',
  './pages/reset-password.html',
  './pages/orders.html',
  './pages/admin.html',
  './pages/images/WhatsApp Image 2026-04-02 at 3.18.29 PM.jpeg',
  './pages/images/accessories.png',
  './pages/images/accessory.png',
  './pages/images/menflier.png',
  './pages/images/mens.png',
  './pages/images/shoesflier.png',
  './pages/images/slide1.png',
  './pages/images/sneaker.png',
  './pages/images/topsales.jpeg',
  './pages/images/women.jpeg',
  './pages/images/women.png',
  './pages/images/womenflier.png',
];
const MAX_RUNTIME_CACHE_ITEMS = 120;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('campus-styles-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

const isApiRequest = (url) => url.pathname.startsWith(new URL('api/', self.registration.scope).pathname);

const cacheResponse = async (cache, request, response) => {
  if (!response.ok && response.type !== 'opaque') return;

  await cache.put(request, response.clone());
  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME_CACHE_ITEMS) {
    await cache.delete(keys[0]);
  }
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && isApiRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.origin === self.location.origin) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cacheResponse(cache, request, response);
          } catch (error) {
            console.warn('Offline page could not be cached:', request.url, error);
          }
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cachedPage = await cache.match(request, { ignoreSearch: true });
        if (cachedPage) return cachedPage;

        const offlinePage = await cache.match(new URL('offline.html', self.registration.scope));
        if (offlinePage) return offlinePage;
        return Response.error();
      }
    })());
    return;
  }

  const isLocalResource = url.origin === self.location.origin;
  const isRemoteImageOrFont = !isLocalResource && ['image', 'font'].includes(request.destination);
  if (!isLocalResource && !isRemoteImageOrFont) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const response = await fetch(request);
    if (isLocalResource || response.type === 'opaque' || response.ok) {
      try {
        await cacheResponse(cache, request, response);
      } catch (error) {
        console.warn('Offline resource could not be cached:', request.url, error);
      }
    }
    return response;
  })());
});
