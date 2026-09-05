// Service Worker — بالإضافة لتفعيل "تثبيت التطبيق"، دلوقتي بيعمل تخزين
// ذكي للملفات الثابتة (JS/CSS) عشان فتح البرنامج يبقى أسرع بكتير من
// الموبايل، خصوصًا على نت بطيء أو ضعيف.
//
// ⚠️ لازم تتغيّر (زيادة الرقم) في كل تحديث كبير للـ Service Worker نفسه
// (مش لازم مع كل نشر عادي — أسماء ملفات /assets/ بتتغيّر تلقائيًا بالهاش
// فمفيش خطر إن نسخة قديمة تفضل عالقة).
const CACHE_NAME = "elshrqawy-shell-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // نضف أي كاش قديم بإصدار مختلف (زي v1 القديمة) عشان ما يفضلش ياخد مساحة أو يسبب لبس
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // ── ملفات ثابتة بأسماء فيها هاش (JS/CSS جوه /assets/): الاسم نفسه
  // بيتغيّر تلقائيًا لو المحتوى اتغيّر (كل نشر جديد بيطلع أسماء جديدة)،
  // يبقى آمن نستخدمها من الكاش فورًا من غير ما ننتظر الشبكة خالص —
  // ده اللي بيخلي فتح البرنامج تاني مرة أسرع بشكل كبير.
  const isHashedAsset = url.pathname.includes("/assets/");
  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        });
      })
    );
    return;
  }

  // ── باقي الطلبات (index.html، أي API...): الشبكة أولاً عشان لو فيه
  // تحديث جديد للبرنامج يظهر فورًا، ولو النت مقطوع نرجع لآخر نسخة محفوظة ──
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
