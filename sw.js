'use strict';

const CACHE_NAME = 'petlog-cache-v8';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './app-logo.png'
];

/* Google Fonts CSS + the actual woff2 files it references. These are
   cross-origin, so we cache them best-effort: a failure here must never
   block the rest of the app shell from installing. Without this, the
   fonts only exist for as long as the browser's own HTTP cache keeps
   them — meaning a PWA that's supposed to work offline silently loses
   its intended typography and falls back to a generic system glyph
   font the moment the network is unavailable. */
const FONT_SHELL_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

async function cacheFontShell(cache){
  try{
    const cssRes = await fetch(FONT_SHELL_URL, { mode: 'cors' });
    if(!cssRes.ok) return;
    await cache.put(FONT_SHELL_URL, cssRes.clone());

    const cssText = await cssRes.text();
    const urls = Array.from(cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)).map(m => m[1]);
    await Promise.allSettled(
      urls.map(async (url) => {
        const fontRes = await fetch(url, { mode: 'cors' });
        if(fontRes.ok) await cache.put(url, fontRes);
      })
    );
  }catch(err){
    /* Offline during install, or fonts.googleapis.com unreachable —
       app shell still installs fine, text just uses the system-font
       fallback in the CSS stack until a font-capable connection lands. */
  }
}

/* ---- install: pre-cache the app shell (+ best-effort font shell) ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).then(() => cacheFontShell(cache)))
      .then(() => self.skipWaiting())
  );
});

/* ---- activate: drop stale caches from previous versions ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---- fetch: cache-first, falling back to network, then to index.html
   for navigations so the app still opens fully offline ---- */
self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if(cached) return cached;

      const isFontHost = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(event.request.url);

      return fetch(event.request)
        .then((response) => {
          if(response && response.ok && (response.type === 'basic' || (isFontHost && response.type === 'cors'))){
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if(event.request.mode === 'navigate'){
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});