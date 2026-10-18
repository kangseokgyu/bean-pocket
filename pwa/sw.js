const BUILD_VERSION = '__BUILD_VERSION__';
const SCOPE_KEY = encodeURIComponent(new URL(self.registration.scope).pathname);
const CACHE_PREFIX = `bean-pocket-shell-${SCOPE_KEY}-`;
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const APP_FILES = ["./", "./index.html", "./app.mjs", "./data/notion-client.mjs", "./data/notion-properties.mjs", "./domain.mjs", "./platform/connection-file.mjs", "./styles.css", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)),
  )));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const appUrls = APP_FILES.map(file => new URL(file, self.registration.scope).href);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !appUrls.includes(url.href)) return;

  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(request);
    return cached || fetch(request);
  }));
});
