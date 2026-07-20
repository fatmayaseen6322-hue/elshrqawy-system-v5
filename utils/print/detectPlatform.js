// ══════════════════════════════════════════════════════════════
// detectPlatform.js
// يحدد بيئة التشغيل مرة واحدة ويحفظها — Web / Tauri / Android
// ══════════════════════════════════════════════════════════════

let _platform = null;

export function getPlatform() {
  if (_platform) return _platform;

  // Tauri: يضيف window.__TAURI__ في كل نسخة Tauri
  if (typeof window !== "undefined" && window.__TAURI__) {
    _platform = "tauri";
    return _platform;
  }

  // Capacitor: يضيف window.Capacitor
  if (typeof window !== "undefined" && window.Capacitor) {
    const plat = window.Capacitor.getPlatform?.() || "web";
    _platform = plat === "android" ? "android" : "web";
    return _platform;
  }

  _platform = "web";
  return _platform;
}

// ── Tauri: جلب قائمة الطابعات عبر invoke ───────────────────
export async function getTauriPrinters() {
  if (getPlatform() !== "tauri") return [];
  try {
    const { invoke } = await import("@tauri-apps/api/tauri");
    const names = await invoke("list_printers");
    return Array.isArray(names) ? names : [];
  } catch {
    return [];
  }
}
