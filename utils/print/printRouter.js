// ══════════════════════════════════════════════════════════════
// printRouter.js  —  نقطة الدخول الوحيدة لكل عمليات الطباعة
//
// Flow:
//  1. loadPrinterPref()       ← هل المستخدم اختار طابعته قبل كده؟
//  2. لو لا → dispatch event  ← App.jsx يعرض PrinterPickerModal
//  3. routeByType()           ← يوجه للدالة الصحيحة
//  4. fallbackToPDF()         ← لو فشل كل شيء
//
// الاستخدام:
//   import { smartPrint } from "../../utils/print/printRouter";
//   await smartPrint({ docType: "receipt", data: rec, centerName: "مركز X" });
//
// docType المتاحة:
//   "receipt"    → إيصال مالي
//   "score"      → شهادة درجة
//   "attendance" → ورقة حضور
//   "debts"      → تقرير ديون A4
//   "absence"    → تقرير غياب A4
//   "revenue"    → تقرير إيرادات A4
//   "scores"     → تقرير درجات A4
//   "table"      → تقرير جدول حر A4
// ══════════════════════════════════════════════════════════════

import { loadPrinterPref, savePrinterPref } from "./printerSettings.js";
import { thermalReceipt, thermalScoreSlip, thermalAttendanceSlip } from "./thermalPrint.js";
import {
  reportDebts, reportAbsence, reportRevenue,
  reportScores, reportTable,
} from "./reportPrint.js";
import { getPlatform, getTauriPrinters } from "./detectPlatform.js";
import { buildPrinterList } from "./classifyPrinter.js";

// ── Event names ──────────────────────────────────────────────
export const EV_CHOOSE_PRINTER  = "app:choosePrinter";   // يرفعه printRouter لما يحتاج اختيار
export const EV_PRINTER_CHOSEN  = "app:printerChosen";   // يرفعه Modal لما المستخدم يختار
export const EV_PRINT_STATUS    = "app:printStatus";      // { status: "printing"|"done"|"error"|"fallback", msg }

// ── Status event helper ──────────────────────────────────────
function emitStatus(status, msg) {
  window.dispatchEvent(new CustomEvent(EV_PRINT_STATUS, { detail: { status, msg } }));
}

// ══════════════════════════════════════════════════════════════
// smartPrint — الدالة الرئيسية
// ══════════════════════════════════════════════════════════════
export async function smartPrint({ docType, data, centerName, printerTypeOverride }) {
  emitStatus("printing", "جارٍ الطباعة…");

  let printerType = printerTypeOverride || null;

  // 1. لو مش محدد، حاول تحميل التفضيل المحفوظ
  if (!printerType) {
    const pref = loadPrinterPref();
    if (pref) {
      printerType = pref.type;
    } else {
      // 2. لازم نسأل المستخدم (مرة واحدة بس)
      printerType = await askUserPrinterType();
    }
  }

  // 3. توجيه الطباعة
  const ok = await executePrint(printerType, docType, data, centerName);

  if (ok) {
    emitStatus("done", "✓ تمت الطباعة بنجاح");
  } else {
    // 4. Fallback → PDF download
    emitStatus("fallback", "⚠️ فشلت الطباعة — حاول مرة أخرى أو غيّر نوع الطابعة");
    fallbackPDF(docType, data, centerName);
  }

  return ok;
}

// ══════════════════════════════════════════════════════════════
// askUserPrinterType — ينتظر اختيار المستخدم من الـ Modal
// ══════════════════════════════════════════════════════════════
async function askUserPrinterType() {
  return new Promise((resolve) => {
    // نحاول نكتشف تلقائياً أولاً على Tauri
    if (getPlatform() === "tauri") {
      getTauriPrinters().then(names => {
        const printers = buildPrinterList(names);
        window.dispatchEvent(new CustomEvent(EV_CHOOSE_PRINTER, {
          detail: { printers, autoDetected: true }
        }));
      }).catch(() => {
        window.dispatchEvent(new CustomEvent(EV_CHOOSE_PRINTER, { detail: { printers: [], autoDetected: false } }));
      });
    } else {
      // Web / Android — لا detection، نعرض الخيارات اليدوية
      window.dispatchEvent(new CustomEvent(EV_CHOOSE_PRINTER, { detail: { printers: [], autoDetected: false } }));
    }

    // ننتظر رد المستخدم
    const handler = (e) => {
      window.removeEventListener(EV_PRINTER_CHOSEN, handler);
      const { type, name } = e.detail || {};
      if (type) savePrinterPref(type, name || "");
      resolve(type || "system");
    };
    window.addEventListener(EV_PRINTER_CHOSEN, handler);
  });
}

// ══════════════════════════════════════════════════════════════
// executePrint — التوجيه الفعلي حسب نوع الطابعة والمستند
// ══════════════════════════════════════════════════════════════
async function executePrint(printerType, docType, data, centerName) {
  try {
    // ── طابعة حرارية ──
    if (printerType === "thermal") {
      if (docType === "receipt")    return thermalReceipt(data, centerName);
      if (docType === "score")      return thermalScoreSlip(data.student, data.examTitle, centerName);
      if (docType === "attendance") return thermalAttendanceSlip(
        data.grade, data.group, data.date, data.presentCount, data.totalCount, centerName
      );
      // لو نوع مش حراري بطبيعته — اطبعه كـ system بدل ما نفشل
      return executeSystemPrint(docType, data, centerName);
    }

    // ── طابعة عادية أو PDF ──
    return executeSystemPrint(docType, data, centerName);

  } catch (err) {
    console.warn("printRouter: executePrint error", err);
    return false;
  }
}

function executeSystemPrint(docType, data, centerName) {
  if (docType === "receipt")    return thermalReceipt(data, centerName);  // إيصال = دايماً HTML بسيط
  if (docType === "debts")      return reportDebts(data, centerName);
  if (docType === "absence")    return reportAbsence(data, centerName);
  if (docType === "revenue")    return reportRevenue(data, centerName);
  if (docType === "scores")     return reportScores(data, centerName);
  if (docType === "score")      return reportTable({
    title: "شهادة درجة",
    cols: ["الاسم","الصف","الدرجة","التقدير"],
    rows: [[data?.student?.name, data?.student?.grade, `${data?.student?.score}%`,
      data?.student?.score>=85?"ممتاز":data?.student?.score>=65?"جيد":"مقبول"]],
    centerName,
  });
  if (docType === "table")      return reportTable({ ...data, centerName });
  // fallback عام: نفتح print dialog الـ browser
  window.print();
  return true;
}

// ══════════════════════════════════════════════════════════════
// fallbackPDF — تنزيل HTML كملف (آخر حل)
// ══════════════════════════════════════════════════════════════
function fallbackPDF(docType, data, centerName) {
  try {
    const content = `<html dir="rtl"><head><meta charset="UTF-8">
      <style>body{font-family:Tahoma;direction:rtl;padding:20px;}</style></head>
      <body><h2>${centerName || "مركز تعليمي"}</h2>
      <p>نوع المستند: ${docType}</p>
      <pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
    const blob = new Blob([content], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `print-${docType}-${Date.now()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════
// resetPrinterPref — لإعادة الاختيار (من Settings)
// ══════════════════════════════════════════════════════════════
export { savePrinterPref, loadPrinterPref };
export { clearPrinterPref } from "./printerSettings.js";
