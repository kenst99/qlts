/* Service Worker — Quản Lý Tài Sản v2
   - Trang (HTML): ưu tiên mạng để luôn nhận bản cập nhật mới, mất mạng thì dùng bản đã lưu.
   - Tệp tĩnh (icon, Leaflet...): ưu tiên bộ nhớ đệm.
   - Font Google: dùng bản đệm, cập nhật ngầm.
   - Google Apps Script, tìm địa chỉ (Nominatim) và ô bản đồ: luôn đi thẳng ra mạng. */
const VERSION = 'qlts-v2.0.0';
const SHELL_CACHE = VERSION + '-shell';
const RUNTIME_CACHE = VERSION + '-runtime';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png'
];

const NETWORK_ONLY_HOSTS = [
  'script.google.com',
  'script.googleusercontent.com',
  'nominatim.openstreetmap.org',
  'tile.openstreetmap.org',
  'server.arcgisonline.com'
];

self.addEventListener('install', event => {
  // Thêm từng tệp riêng lẻ: thiếu 1 tệp cũng không làm hỏng cả quá trình cài đặt
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        .filter(name => name !== SHELL_CACHE && name !== RUNTIME_CACHE)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function isCacheable(response) {
  return response && response.ok && response.type !== 'opaque';
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => { if (isCacheable(response)) cache.put(request, response.clone()); return response; })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (NETWORK_ONLY_HOSTS.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) return;

  if (request.mode === 'navigate' || (url.origin === self.location.origin && url.pathname.endsWith('.html'))) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'unpkg.com') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});
