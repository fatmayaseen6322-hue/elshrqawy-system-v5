// ══════════════════════════════════════════════════════════════
// reportPrint.js
// طباعة تقارير A4 احترافية — يغلف printReport الموجود في utils
// ويضيف: شهادات، كشوف درجات، تقارير مالية
// ══════════════════════════════════════════════════════════════

import { MONTHS_AR } from "../../constants/index.js";

// ── CSS مشترك A4 ────────────────────────────────────────────
const A4_CSS = `
  @page { size: A4 portrait; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; font-size: 11px; direction: rtl; color: #1e293b; }
  .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 12px; }
  .header h1 { font-size: 20px; color: #1e3a8a; margin: 0 0 3px; }
  .header .sub { font-size: 12px; color: #475569; }
  .header .logo { font-size: 36px; margin-bottom: 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 12px; background: #f8fafc; padding: 6px 10px; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 12px; }
  th { background: #1e3a8a; color: #fff; padding: 8px 9px; text-align: right; font-weight: bold; }
  td { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: #eff6ff; }
  .footer { margin-top: 16px; text-align: center; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .badge { display:inline-block; padding:2px 7px; border-radius:999px; font-size:9.5px; font-weight:bold; }
  .badge-green  { background:#dcfce7; color:#166534; }
  .badge-red    { background:#fee2e2; color:#991b1b; }
  .badge-yellow { background:#fef9c3; color:#854d0e; }
  .badge-blue   { background:#dbeafe; color:#1d4ed8; }
  .summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
  .summary-card { background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:8px 12px; text-align:center; }
  .summary-card .num { font-size:18px; font-weight:bold; color:#1e3a8a; }
  .summary-card .lbl { font-size:9px; color:#64748b; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

function buildA4Html(body) {
  return `<!DOCTYPE html><html dir="rtl"><head>
<meta charset="UTF-8">
<style>${A4_CSS}</style>
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

function openPrintWindow(html) {
  if (!window.open) return false;
  try {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); return true; }
  } catch { /* Tauri fallback */ }
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

function nowDateStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

// ══════════════════════════════════════════════════════════════
// تقرير جدول عام (General Table Report)
// ══════════════════════════════════════════════════════════════
export function reportTable({ title, subtitle, cols, rows, centerName, summaryCards, footer }) {
  const cn = centerName || "مركز تعليمي";
  const tableRows = (rows || []).map(row =>
    `<tr>${row.map(cell => `<td>${cell ?? "—"}</td>`).join("")}</tr>`
  ).join("");

  const summaryHtml = summaryCards?.length
    ? `<div class="summary-grid">${summaryCards.map(c =>
        `<div class="summary-card"><div class="num">${c.value}</div><div class="lbl">${c.label}</div></div>`
      ).join("")}</div>`
    : "";

  const html = buildA4Html(`
    <div class="header">
      <div class="logo">🏫</div>
      <h1>${cn}</h1>
      <div class="sub">${title}${subtitle ? " — " + subtitle : ""}</div>
    </div>
    <div class="meta">
      <span>📅 التاريخ: ${nowDateStr()}</span>
      <span>📊 عدد السجلات: ${rows?.length ?? 0}</span>
    </div>
    ${summaryHtml}
    <table>
      <thead><tr>${(cols||[]).map(c=>`<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">${footer || `${cn} — نظام إدارة المركز`}</div>
  `);
  return openPrintWindow(html);
}

// ══════════════════════════════════════════════════════════════
// تقرير الديون (Finance Debts)
// ══════════════════════════════════════════════════════════════
export function reportDebts(students, centerName) {
  const debtors = (students||[])
    .filter(s => (s.totalFees - s.paid) > 0)
    .sort((a,b) => (b.totalFees-b.paid) - (a.totalFees-a.paid));
  const totalDebt = debtors.reduce((a,s) => a+(s.totalFees-s.paid), 0);
  const rows = debtors.map(s => [
    s.name, s.grade,
    `<span class="badge badge-blue">${s.totalFees} ج</span>`,
    `<span class="badge badge-green">${s.paid} ج</span>`,
    `<span class="badge badge-red">${s.totalFees-s.paid} ج</span>`,
  ]);
  return reportTable({
    title: "تقرير ديون الطلاب",
    cols: ["اسم الطالب","الصف","إجمالي الرسوم","المدفوع","المتبقي"],
    rows, centerName,
    summaryCards: [
      { label: "إجمالي المدينين",  value: debtors.length },
      { label: "إجمالي الديون",    value: `${totalDebt} ج` },
      { label: "متوسط الدين",      value: `${debtors.length ? Math.round(totalDebt/debtors.length) : 0} ج` },
    ],
  });
}

// ══════════════════════════════════════════════════════════════
// تقرير الغياب
// ══════════════════════════════════════════════════════════════
export function reportAbsence(students, centerName) {
  const absentees = (students||[])
    .filter(s => s.absent > 0)
    .sort((a,b) => b.absent - a.absent);
  const rows = absentees.map(s => {
    const pct = s.total ? Math.round(s.absent/s.total*100) : 0;
    const badge = pct > 25 ? "badge-red" : pct > 15 ? "badge-yellow" : "badge-blue";
    return [s.name, s.grade, s.absent, s.late, `<span class="badge ${badge}">${pct}%</span>`];
  });
  return reportTable({
    title: "تقرير الغياب",
    cols: ["اسم الطالب","الصف","أيام الغياب","التأخير","نسبة الغياب"],
    rows, centerName,
    summaryCards: [
      { label: "إجمالي المتغيبين",  value: absentees.length },
      { label: "إجمالي أيام غياب",  value: absentees.reduce((a,s)=>a+s.absent,0) },
      { label: "أعلى غياب",         value: absentees[0]?.absent ?? 0 },
    ],
  });
}

// ══════════════════════════════════════════════════════════════
// تقرير الإيرادات
// ══════════════════════════════════════════════════════════════
export function reportRevenue(finRecords, centerName) {
  const records = (finRecords||[]).slice().reverse().slice(0,150);
  const totalRev = records.reduce((a,r)=>a+(r.amount||0),0);
  const rows = records.map(r => [
    r.studentName, r.grade,
    r.month ? `${MONTHS_AR[(r.month||1)-1]} ${r.year}` : "—",
    `<span class="badge badge-green">${r.amount} ج</span>`,
    r.receiverName, r.timestamp,
  ]);
  return reportTable({
    title: "تقرير الإيرادات",
    cols: ["الطالب","الصف","الشهر","المبلغ","المستلم","التوقيت"],
    rows, centerName,
    summaryCards: [
      { label: "عدد السجلات",   value: records.length },
      { label: "إجمالي الإيرادات", value: `${totalRev} ج` },
      { label: "متوسط الإيصال", value: `${records.length ? Math.round(totalRev/records.length) : 0} ج` },
    ],
  });
}

// ══════════════════════════════════════════════════════════════
// تقرير الدرجات
// ══════════════════════════════════════════════════════════════
export function reportScores(students, centerName) {
  const sorted = (students||[]).slice().sort((a,b)=>b.score-a.score);
  const rows = sorted.map(s => {
    const badge = s.score>=85?"badge-green":s.score>=65?"badge-blue":s.score>=50?"badge-yellow":"badge-red";
    const label = s.score>=85?"ممتاز":s.score>=65?"جيد":s.score>=50?"مقبول":"ضعيف";
    return [
      s.name, s.grade,
      `<span class="badge ${badge}">${s.score}%</span>`,
      label,
      (s.weak||[]).join("، ") || "—",
    ];
  });
  const avg = sorted.length ? Math.round(sorted.reduce((a,s)=>a+s.score,0)/sorted.length) : 0;
  return reportTable({
    title: "تقرير الدرجات",
    cols: ["اسم الطالب","الصف","الدرجة","التقدير","نقاط الضعف"],
    rows, centerName,
    summaryCards: [
      { label: "إجمالي الطلاب", value: sorted.length },
      { label: "متوسط الدرجات", value: `${avg}%` },
      { label: "الناجحون",       value: sorted.filter(s=>s.score>=50).length },
    ],
  });
}

// ── backward compat مع printReport القديمة ──────────────────
export function reportPrint(opts) {
  return reportTable(opts);
}
