// ══════════════════════════════════════════════════════════════
// printerSettings.js
// حفظ وقراءة تفضيلات الطابعة من localStorage
// ══════════════════════════════════════════════════════════════

import { lsGet, lsSet } from "../index.js";

const KEY = "app_printer_pref";

/**
 * @typedef {{ type: "thermal"|"system"|"pdf", name?: string, savedAt: number }} PrinterPref
 */

/** قراءة التفضيل المحفوظ */
export function loadPrinterPref() {
  return /** @type {PrinterPref|null} */ (lsGet(KEY, null));
}

/** حفظ التفضيل */
export function savePrinterPref(type, name = "") {
  lsSet(KEY, { type, name, savedAt: Date.now() });
}

/** مسح التفضيل (لإعادة الاختيار) */
export function clearPrinterPref() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
