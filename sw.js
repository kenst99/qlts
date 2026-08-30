const CACHE_NAME = 'qlts-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// Cài đặt Service Worker và lưu bộ nhớ đệm
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Xóa cache cũ khi có phiên bản mới
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Lấy dữ liệu từ Cache khi offline
self.addEventListener('fetch', event => {
  // Bỏ qua các request lấy dữ liệu từ Google Apps Script (để luôn đồng bộ dữ liệu mới nhất nếu có mạng)
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Trả về cache nếu có, nếu không thì tải từ internet
        return response || fetch(event.request);
      })
  );
});