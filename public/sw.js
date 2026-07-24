// Service Worker بسيط — الغرض الأساسي منه تفعيل خاصية "تثبيت التطبيق"
// في المتصفح (Chrome/Edge)، وليس عمل تخزين أوفلاين متقدم.
const CACHE_NAME = "elshrqawy-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// استراتيجية بسيطة: حاول الشبكة أولاً، ولو فشلت (أوفلاين) استخدم آخر نسخة محفوظة
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
