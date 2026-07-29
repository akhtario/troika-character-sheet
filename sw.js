importScripts('./js/version.js');

const CACHE_NAME = `troika-cs-${APP_VERSION}`;
const BASE = '/troika-character-sheet/';
const CORE_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}style.css`,
  `${BASE}app.js`,
  `${BASE}js/version.js`,
  `${BASE}js/dice.js`,
  `${BASE}js/storage.js`,
];
const STATIC_ASSETS = [
  `${BASE}manifest.json`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([...CORE_ASSETS, ...STATIC_ASSETS]))
  );
  // Don't auto-activate here; wait for the page to confirm via SKIP_WAITING
  // (see index.html), so users get a chance to know an update happened
  // instead of silently swapping app.js under them mid-session.
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isCoreAsset(url) {
  return CORE_ASSETS.some(asset => url.endsWith(asset)) || url.endsWith(BASE);
}

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Core app files (HTML/JS/CSS): network-first so updates are picked up
  // immediately when online, falling back to the cache when offline.
  if (event.request.mode === 'navigate' || isCoreAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (icons, manifest): cache-first, fall back to network.
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
