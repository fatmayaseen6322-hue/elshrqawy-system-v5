import React from "react";
import ReactDOM from "react-dom/client";
import App from "../App.jsx";
import { getPlatform } from "../utils/print/detectPlatform.js";
import "./index.css";

// ── علّم الصفحة بنوع المنصة (android / tauri / web) عشان الـ CSS
// يقدر يفرّق بين نسخة التليفون (Capacitor/Android) وباقي النسخ ──
document.documentElement.classList.add("platform-" + getPlatform());

// ── حماية إضافية: أي خطأ JS يحصل بره دورة الـ render العادية
// (زي جوه event handler أو Promise) مش بيتمسك بواسطة React Error
// Boundary عادةً، وده بيسيب الشاشة سايبة كده (سودا/فاضية) من غير
// أي رجوع. هنا بنمسك أي خطأ من النوع ده على أندرويد تحديدًا،
// ولو الصفحة فضلت "ساكنة" بعده، بنعمل تحديث تلقائي مرة واحدة
// (نفس فكرة ChunkErrorBoundary بالظبط) بدل ما تفضل شاشة سودا. ──
if (document.documentElement.classList.contains("platform-android")) {
  const scheduleAutoRecover = () => {
    const key = "app_hard_error_reload_ts";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  };
  window.addEventListener("error", scheduleAutoRecover);
  window.addEventListener("unhandledrejection", scheduleAutoRecover);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
