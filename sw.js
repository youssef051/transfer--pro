/* Service Worker - خواردنگەی یوسف
   هەر جارێک index.html گۆڕدرا، VERSION بگۆڕە بۆ v2, v3 ... */
const VERSION = 'v1';
const SHELL = 'yousef-shell-' + VERSION;
const RUNTIME = 'yousef-runtime-' + VERSION;
const IMAGES = 'yousef-images-' + VERSION;
const MAX_IMAGES = 80;

const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('yousef-') && ![SHELL, RUNTIME, IMAGES].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
}

// پەڕەی سەرەکی: سەرەتا ئینتەرنێت (بۆ نوێکارییەکان)، ئەگەر نەبوو کاشی
async function networkFirstPage(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) (await caches.open(SHELL)).put('./index.html', fresh.clone());
    return fresh;
  } catch (e) {
    return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
  }
}

// فایلە جێگیرەکان: لە کاشەوە بیدەرەوە و لە پشتەوە نوێی بکەرەوە
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

// وێنەکان: کاش سەرەتا، بە سنووردارکردنی ژمارە
async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) { cache.put(request, res.clone()); trim(IMAGES, MAX_IMAGES); }
    return res;
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST (تەلەگرام ...) هەرگیز دەستکاری ناکرێت

  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME));
    return;
  }

  if (req.destination === 'image' && !url.hostname.endsWith('openstreetmap.org')) {
    event.respondWith(cacheFirstImage(req));
    return;
  }
  // تایلی نەخشە، API، واتساپ و ... : هەمیشە ئینتەرنێت
});
