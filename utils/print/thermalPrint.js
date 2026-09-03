// ══════════════════════════════════════════════════════════════
// thermalPrint.js
// يولد HTML مهيأ لطابعة حرارية 80mm ويرسله للطباعة
// يدعم: إيصال مالي — شهادة درجة — ورقة تقرير صغيرة
// ══════════════════════════════════════════════════════════════

import { MONTHS_AR } from "../../constants/index.js";

// ── CSS مشترك للطباعة الحرارية ──────────────────────────────
const THERMAL_CSS = `
  @page { size: 80mm auto; margin: 3mm 4mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    direction: rtl;
    text-align: center;
    color: #000;
    background: #fff;
  }
  h1 { font-size: 14px; font-weight: bold; margin: 2px 0 1px; }
  h2 { font-size: 11px; font-weight: bold; margin: 1px 0; }
  .sep  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .sep2 { border: none; border-top: 1px solid  #000; margin: 4px 0; }
  .row  { display: flex; justify-content: space-between; font-size: 11px; margin: 1.5px 0; }
  .lbl  { color: #333; }
  .val  { font-weight: bold; }
  .big  { font-size: 15px; font-weight: bold; margin: 4px 0; }
  .ok   { font-size: 12px; font-weight: bold; }
  .center { text-align: center; }
  .note { font-size: 9px; color: #555; margin-top: 4px; }
`;

// ── Builder مشترك لـ HTML ───────────────────────────────────
function buildThermalHtml(body) {
  return `<!DOCTYPE html><html dir="rtl"><head>
<meta charset="UTF-8">
<style>${THERMAL_CSS}</style>
</head><body>
${body}
<script>
  window.onload = function() {
    window.print();
    window.onafterprint = function() { window.close(); };
  };
<\/script>
</body></html>`;
}

// ── فتح نافذة الطباعة (مع Tauri fallback) ──────────────────
function openPrintWindow(html) {
  if (!window.open) return false;
  try {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); return true; }
  } catch { /* Tauri CSP — try blob */ }
  try {
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, "_blank");
    if (w) {
      try { w.addEventListener("load", () => URL.revokeObjectURL(url), { once: true }); }
      catch { setTimeout(() => URL.revokeObjectURL(url), 30000); }
      return true;
    }
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
  return false;
}

// ══════════════════════════════════════════════════════════════
// إيصال مالي (Finance receipt)
// ══════════════════════════════════════════════════════════════
export function thermalReceipt(rec, centerName) {
  if (!rec) return false;
  const monthName = MONTHS_AR[(rec.month ?? 1) - 1] || "";
  const html = buildThermalHtml(`
    <h1>${centerName || "مركز تعليمي"}</h1>
    <h2>إيصال مصاريف</h2>
    <hr class="sep2"/>
    <div class="row"><span class="lbl">الطالب</span><span class="val">${rec.studentName || "—"}</span></div>
    <div class="row"><span class="lbl">الصف</span><span class="val">${rec.grade || "—"} — مج.${rec.group || "—"}</span></div>
    <div class="row"><span class="lbl">الشهر</span><span class="val">${monthName} ${rec.year || ""}</span></div>
    <hr class="sep"/>
    <div class="big">${rec.amount || 0} جنيه</div>
    <div class="row"><span class="lbl">المستلم</span><span class="val">${rec.receiverName || "—"}</span></div>
    <div class="row"><span class="lbl">التوقيت</span><span class="val">${rec.timestamp || "—"}</span></div>
    <hr class="sep"/>
    <div class="ok">✓ تم الاستلام</div>
    <div class="note">شكراً لثقتكم — ${centerName || ""}</div>
  `);
  return openPrintWindow(html);
}

// ══════════════════════════════════════════════════════════════
// شهادة درجة طالب (Score slip)
// ══════════════════════════════════════════════════════════════
export function thermalScoreSlip(student, examTitle, centerName) {
  if (!student) return false;
  const grade = student.score ?? 0;
  const status = grade >= 85 ? "ممتاز 🌟" : grade >= 65 ? "جيد ✓" : grade >= 50 ? "مقبول" : "ضعيف ⚠️";
  const html = buildThermalHtml(`
    <h1>${centerName || "مركز تعليمي"}</h1>
    <h2>${examTitle || "نتيجة امتحان"}</h2>
    <hr class="sep2"/>
    <div class="row"><span class="lbl">الطالب</span><span class="val">${student.name || "—"}</span></div>
    <div class="row"><span class="lbl">الصف</span><span class="val">${student.grade || "—"}</span></div>
    <hr class="sep"/>
    <div class="big">${grade}%</div>
    <div class="ok">${status}</div>
    ${student.weak?.length ? `<div class="note">نقاط ضعف: ${student.weak.join("، ")}</div>` : ""}
    <hr class="sep"/>
    <div class="note">${new Date().toLocaleDateString("en-GB")}</div>
  `);
  return openPrintWindow(html);
}

// ══════════════════════════════════════════════════════════════
// ورقة حضور سريعة (Attendance slip)
// ══════════════════════════════════════════════════════════════
export function thermalAttendanceSlip(grade, group, date, presentCount, totalCount, centerName) {
  const html = buildThermalHtml(`
    <h1>${centerName || "مركز تعليمي"}</h1>
    <h2>كشف حضور</h2>
    <hr class="sep2"/>
    <div class="row"><span class="lbl">الصف</span><span class="val">${grade} — مج.${group}</span></div>
    <div class="row"><span class="lbl">التاريخ</span><span class="val">${date}</span></div>
    <hr class="sep"/>
    <div class="big">${presentCount} / ${totalCount}</div>
    <div class="ok">حاضر من إجمالي</div>
    <hr class="sep"/>
    <div class="note">تم التسجيل بواسطة النظام</div>
  `);
  return openPrintWindow(html);
}

// ── الدالة العامة (backward compatible مع printThermal القديمة) ─
export function thermalPrint(rec, centerName) {
  return thermalReceipt(rec, centerName);
}
