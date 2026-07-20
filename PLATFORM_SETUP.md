# دليل التشغيل متعدد المنصات — مركز الشرقاوي

## ✅ التعديلات المُطبَّقة (3 ملفات فقط)

| الملف | التغيير | السبب |
|---|---|---|
| `vite.config.js` | أضيف `base: "./"` | Capacitor/Tauri يحمّل الملفات من نظام الملفات، ليس سيرفر |
| `index.html` | `src="./src/main.jsx"` + meta tags موبايل | مسار نسبي + منع zoom على Android |
| `utils/index.js` | `printThermal` blob fallback | Tauri يحجب `window.open("","_blank")` |

---

## 🌐 Web (بدون تغيير)

```bash
npm run dev      # تطوير
npm run build    # بناء
```

---

## 📱 Android عبر Capacitor

### المتطلبات
- Node.js + npm
- Android Studio مع Android SDK
- Java 17+

### خطوات التشغيل

```bash
# 1. تثبيت الحزم
npm install

# 2. بناء المشروع
npm run build

# 3. إضافة منصة Android (مرة واحدة فقط)
npx cap add android

# 4. مزامنة الملفات
npx cap sync

# 5. فتح Android Studio
npx cap open android
```

### في Android Studio
- انتظر Gradle sync ينتهي
- اضغط ▶ Run لتشغيله على المحاكي أو جهاز حقيقي

### ملاحظات Android
- `localStorage` ← يعمل بشكل طبيعي في WebView
- `window.open` (واتساب) ← يفتح التطبيق الخارجي
- `window.confirm` ← يعمل
- `printThermal` ← لن يطبع (لا يوجد print في موبايل)، زر الطباعة سيُهمَل بصمت

---

## 💻 Desktop عبر Tauri

### المتطلبات
- Node.js + npm
- Rust: https://rustup.rs
- متطلبات Tauri للنظام:
  - Windows: Microsoft Visual C++ Build Tools
  - Linux: `libwebkit2gtk-4.0-dev libssl-dev`
  - macOS: Xcode Command Line Tools

### خطوات التشغيل

```bash
# 1. تثبيت الحزم
npm install

# 2. تشغيل في وضع التطوير
npm run tauri:dev

# 3. بناء ملف تثبيت
npm run tauri:build
# → ملف التثبيت في: src-tauri/target/release/bundle/
```

### ملاحظات Tauri
- `localStorage` ← يعمل بشكل طبيعي
- `window.open` للواتساب ← يفتح المتصفح الافتراضي (مسموح في tauri.conf.json)
- `window.confirm` ← يعمل
- `printThermal` ← يستخدم blob URL fallback تلقائياً

---

## ⚡ سلوك كل منصة

| الميزة | Web | Android | Desktop (Tauri) |
|---|---|---|---|
| localStorage | ✅ | ✅ | ✅ |
| window.confirm | ✅ | ✅ | ✅ |
| window.open (واتساب) | ✅ | ✅ تفتح التطبيق | ✅ يفتح المتصفح |
| printThermal | ✅ | ⚠️ صامت (لا print) | ✅ blob fallback |
| speechSynthesis (asal.ai) | ✅ | ✅ | ✅ |
| ملف import/export JSON | ✅ | ✅ | ✅ |

