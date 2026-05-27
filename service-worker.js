/*
  service-worker.js — minimal offline cache.

  Strategy: "cache, falling back to network".
    - On install, pre-cache the app shell (HTML/CSS/JS/icons).
    - On fetch, try the cache first; if not cached, hit the network.
    - Bump CACHE_VERSION whenever you change cached files so old
      caches get cleared on activate.

  We intentionally do NOT cache the videos. They can be large, and
  remote ones change. Local videos work offline because the browser
  caches them at the network layer when first played.
*/

const CACHE_VERSION = 'habits-v6';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './js/storage.js',
  './js/video.js',
  './js/habits.js',
  './js/calendar.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // waitUntil keeps the SW alive until the cache is populated.
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  );
  // Activate this SW immediately instead of waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete any caches that don't match the current version.
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only cache GET requests — POST/PUT shouldn't be cached.
  if (req.method !== 'GET') return;

  // Skip video files; they're large and we don't want to fill up storage.
  if (req.url.endsWith('.mp4')) return;

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
