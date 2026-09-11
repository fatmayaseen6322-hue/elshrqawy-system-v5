// ══════════════════════════════════════════════════════════════
// Firebase config — القيم من متغيرات البيئة (.env)
// خدها من: Firebase Console → Project Settings → Your apps → SDK config
// ══════════════════════════════════════════════════════════════
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ══════════════════════════════════════════════════════════════
// #SecureRules — تسجيل دخول مجهول (Anonymous Auth) تلقائي.
// ليه محتاجينه: عشان نقدر نقفل قواعد Firestore بحيث الكتابة، وقراءة
// بيانات الإعدادات/النسخ الاحتياطية (اللي فيها كل الباسوردات)، تتطلب
// "request.auth != null" بدل ما تكون مفتوحة لأي حد على النت
// (allow write: if true). أي صفحة في الموقع (سواء التطبيق نفسه أو
// بوابة الطالب) بتسجّل دخول مجهول هنا تلقائيًا من غير أي شاشة أو
// كلمة مرور يشوفها المستخدم — مش بديل حقيقي عن حماية سيرفر خلفي،
// لكنها بتمنع أي بوت/سكربت عشوائي بيدوّر على قواعد بيانات مفتوحة
// على الإنترنت من الكتابة أو قراءة الباسوردات مباشرة من غير ما يفتح
// الموقع خالص أصلًا.
// ══════════════════════════════════════════════════════════════
export const auth = getAuth(app);
export const authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) { unsub(); resolve(user); }
  });
  signInAnonymously(auth).catch(() => resolve(null));
});
