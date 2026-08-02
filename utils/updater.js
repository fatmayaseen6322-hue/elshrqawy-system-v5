// ══════════════════════════════════════════════════════════════
// updater.js — التحقق من وجود تحديث وتثبيته تلقائيًا (نسخة سطح المكتب فقط)
// ══════════════════════════════════════════════════════════════
// بيشتغل بس جوه برنامج سطح المكتب (Tauri). لو النظام شغال في المتصفح
// (elshrqawy-system-v5.vercel.app) بيرجع حالة "غير متاح" على طول من غير أخطاء.

export const isDesktopApp = () =>
  typeof window !== "undefined" && !!window.__TAURI__;

/**
 * يتحقق من وجود نسخة جديدة على GitHub Releases.
 * @returns {Promise<{available:boolean, manifest?:object, version?:string, error?:string}>}
 */
export async function checkForUpdate() {
  if (!isDesktopApp()) return { available: false, error: "NOT_DESKTOP" };
  try {
    const { checkUpdate } = await import("@tauri-apps/api/updater");
    const { shouldUpdate, manifest } = await checkUpdate();
    return { available: !!shouldUpdate, manifest, version: manifest?.version };
  } catch (e) {
    return { available: false, error: e?.message || String(e) };
  }
}

/**
 * يحمّل وينزّل التحديث، ثم يعيد تشغيل البرنامج تلقائيًا بالنسخة الجديدة.
 * @param {(status:string)=>void} onProgress دالة اختيارية لمتابعة الحالة
 */
export async function installUpdateAndRestart(onProgress) {
  if (!isDesktopApp()) throw new Error("NOT_DESKTOP");
  const { installUpdate } = await import("@tauri-apps/api/updater");
  const { relaunch } = await import("@tauri-apps/api/process");
  onProgress?.("downloading");
  await installUpdate();
  onProgress?.("restarting");
  await relaunch();
}
