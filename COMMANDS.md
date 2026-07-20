# أوامر رفع Elshrqawy v9 على GitHub + ربطه بـ Firebase + Vercel

المشروع اللي بين إيديك دلوقتي هو v9 (اللي رفعته أنت) بعد إضافة
تخزين Firestore بدل localStorage + إصلاح خطأ بسيط في SettingsModule.
اتعمله build تجريبي هنا ونجح 100%.

نفّذ الأقسام دي بالترتيب. لو حصل خطأ في قسم، اقف عنده وابعتلي رسالة
الخطأ كاملة (نص) — متكملش اللي بعده.

---

## 0) قبل ما تبدأ

استبدل:
- `<GITHUB_USERNAME>` باسمك على GitHub
- `<REPO_NAME>` باسم الريبو اللي هتعمله

---

## 1) تثبيت المكتبات وتجربة محلية

افتح مجلد المشروع في الترمينال، وشغّل:

```bash
npm install
npm run dev
```

هيديك رابط زي `http://localhost:5173` — افتحه في المتصفح وتأكد إن
النظام شغال (هيطلب دخول بدور Admin/Cashier/Teacher حسب RoleGate).

لو في خطأ في `npm install` أو `npm run dev`، وقف وابعتلي الرسالة كاملة.

---

## 2) رفع المشروع على GitHub

```bash
git init
git add .
git commit -m "Elshrqawy v9 — Firestore integration"
git branch -M main

# اعمل ريبو فاضي الأول من https://github.com/new (من غير README)
git remote add origin https://github.com/<GITHUB_USERNAME>/<REPO_NAME>.git
git push -u origin main
```

لو طلب باسورد وقت الـ push، GitHub بطّل الباسورد العادي — استخدم
GitHub CLI (`gh auth login`) أو Personal Access Token.

---

## 3) إنشاء مشروع Firebase وتفعيل Firestore

1. https://console.firebase.google.com → **Add project** → سمّيه
   (مثلاً `elshrqawy-system`).
2. من القائمة الجانبية: **Build → Firestore Database → Create database**
   → Production mode → اختر أقرب سيرفر (`eur3` أو `europe-west`).
3. **Project settings (⚙️) → General → Your apps → Web (</>) icon**
   - سمّي الـ app (مثلاً `elshrqawy-web`).
   - **متختارش** "Also set up Firebase Hosting" (فيرسل هو اللي هيستضيف).
   - انسخ قيم `firebaseConfig` (apiKey, authDomain, projectId,
     storageBucket, messagingSenderId, appId).

### قواعد الأمان (مؤقتة للتجربة)

من **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /elshrqawy/{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ دي مفتوحة لأي حد يعرف رابط المشروع. النظام أصلاً عنده نظام أدوار
(RoleGate) بكلمة مرور، لكن ده حماية على مستوى الواجهة بس — القاعدة دي
سايبة قاعدة البيانات نفسها مفتوحة. لو عايز تقفلها صح (بـ Firebase
Authentication حقيقي) قولّي وهنضيفها في خطوة تانية.

---

## 4) متغيرات البيئة محليًا

```bash
cp .env.example .env
```

افتح `.env` واملأ القيم اللي نسختها من Firebase:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

جرّب تاني:

```bash
npm run dev
```

سجّل طالب جديد أو دفعة، وتأكد إنها ظهرت في Firebase Console →
Firestore Database → collection `elshrqawy` (هتلاقي مستندات بأسماء
زي `app_students`, `app_settings`, `app_fin_records`... إلخ).

---

## 5) الربط بـ Vercel والنشر

### من الموقع مباشرة (الأسهل):

1. https://vercel.com/new → Import Git Repository → حدد الريبو.
2. Vercel هيكتشف Vite تلقائي.
3. قبل الـ Deploy، **Environment Variables** → ضيف نفس الـ 6 متغيرات
   اللي في `.env` (كل واحد لوحده بنفس الاسم بالظبط).
4. اضغط **Deploy**.

### أو بالـ CLI:

```bash
npm install -g vercel
vercel login
vercel
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_FIREBASE_AUTH_DOMAIN production
vercel env add VITE_FIREBASE_PROJECT_ID production
vercel env add VITE_FIREBASE_STORAGE_BUCKET production
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
vercel env add VITE_FIREBASE_APP_ID production
vercel --prod
```

---

## 6) بعد كل تعديل جديد

```bash
git add .
git commit -m "وصف التعديل"
git push
```

لو الريبو متربط بـ Vercel، هيعمل Deploy تلقائي مع كل push على `main`.

---

## ملاحظات مهمة عن التعديلات اللي عملتها

- **أضفت:** `src/firebase.js` (إعداد الاتصال بـ Firebase)،
  `hooks/useFirestoreSync.js` (المزامنة الفعلية).
- **عدّلت:** `hooks/useAppData.js` — دالة `usePersisted` بقت بتخزن
  على Firestore بدل localStorage بس (مع الاحتفاظ بـ localStorage
  كـ cache للعمل حتى لو النت وقع). سجل النشاط (`activityLog`) سيبته
  محلي بس (مش محتاج يتزامن بين الأجهزة).
- **صلّحت:** قوس زيادة `}` في `components/modules/SettingsModule.jsx`
  (سطر خاص بشاشة "كلمة مرور المدرّس") كان هيظهر كنص فاضي غلط في الشاشة.
- **أضفت:** `@tauri-apps/api` في `package.json` (كانت ناقصة وبتوقف
  الـ build بتاع الويب حتى لو مش هتستخدم Tauri).
- ملف `.env` **ماينفعش** يترفع على GitHub (موجود في `.gitignore`) —
  القيم بتتحط في Vercel Environment Variables بس (خطوة 5).
