import { useState, useMemo, useRef, useEffect } from "react";
import { GRADES_LIST, MONTHS_AR, TODAY } from "../../constants";
import { pct, scC, speak, isBlocked } from "../../utils";
import { smartPrint } from "../../utils/print/printRouter";
import { Bar } from "../ui";

// أرقام برج المراقبة بالإنجليزي (Latin digits) بدل الأرقام العربية (١٢٣) —
// طلب صريح: هنا بس، باقي الموديولات (المصاريف مثلاً) لسه بتستخدم fmt/fmtM العادية
const fmt  = n => (n || 0).toLocaleString("en-US") + " ج";
const fmtM = n => (n || 0).toLocaleString("en-US");

// ══════════════════════════════════════════════════════════════
// DASHBOARD DATA BUILDER
// Uses finRecords (single source of truth) instead of payments
// ══════════════════════════════════════════════════════════════
export function buildDashboardData(students, finRecords, gradeFees) {
  students   = students   || [];
  finRecords = finRecords || [];
  gradeFees  = gradeFees  || {};

  const total  = students.length;
  const active = students.filter(s => s.status === "active").length;
  const temp   = students.filter(s => s.status === "temp").length;

  // Revenue from finRecords — use timestamp date prefix (YYYY-MM-DD)
  const totalRevenue = finRecords.reduce((a, r) => a + (r.amount || 0), 0);

  const todayStr = TODAY;
  const weekAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const dateOf  = r => (r.timestamp || "").slice(0, 10);   // "YYYY-MM-DD HH:MM" → "YYYY-MM-DD"
  const revToday = finRecords.filter(r => dateOf(r) === todayStr).reduce((a, r) => a + (r.amount || 0), 0);
  const revWeek  = finRecords.filter(r => dateOf(r) >= weekAgo ).reduce((a, r) => a + (r.amount || 0), 0);
  const revMonth = finRecords.filter(r => dateOf(r) >= monthAgo).reduce((a, r) => a + (r.amount || 0), 0);

  const gradeCounts = GRADES_LIST.map(g => ({ grade: g, count: students.filter(s => s.grade === g).length }));

  const groupByGrade = arr => {
    const map = {};
    arr.forEach(s => { if (!map[s.grade]) map[s.grade] = []; map[s.grade].push(s); });
    return Object.entries(map).filter(([, v]) => v.length > 0).map(([grade, students]) => ({ grade, students }));
  };

  // الشهور المستحقة (غير المدفوعة) لكل طالب — من finRecords، بنفس منطق صفحة "ملف الطالب"
  const getOwedMonthsLabel = s => {
    const [curYearStr, curMonthStr] = TODAY.split("-");
    const currentYearNum  = parseInt(curYearStr, 10);
    const currentMonthNum = parseInt(curMonthStr, 10);
    const [joinYearStr, joinMonthStr] = (s.joinDate || TODAY).split("-");
    const joinYearNum  = parseInt(joinYearStr, 10);
    const joinMonthNum = parseInt(joinMonthStr, 10);
    const studentFinRecords = finRecords.filter(r => r.studentId === s.id);
    const isMonthPaid = (m, y) => studentFinRecords.some(r => r.month === m && r.year === y && (r.amount || 0) > 0);
    const startMonth = (joinYearNum === currentYearNum) ? joinMonthNum : 1;
    const owed = [];
    for (let m = startMonth; m <= currentMonthNum; m++) if (!isMonthPaid(m, currentYearNum)) owed.push(MONTHS_AR[m - 1]);
    return owed.length ? owed.join("، ") : "—";
  };

  // المتبقي الحقيقي لكل طالب = عدد الشهور المتأخرة × رسم الصف (من الإعدادات) — بنفس منطق صفحة المصاريف "المتأخر"
  const getRealDue = s => {
    const [curYearStr, curMonthStr] = TODAY.split("-");
    const currentYearNum  = parseInt(curYearStr, 10);
    const currentMonthNum = parseInt(curMonthStr, 10);
    const [joinYearStr, joinMonthStr] = (s.joinDate || TODAY).split("-");
    const joinYearNum  = parseInt(joinYearStr, 10);
    const joinMonthNum = parseInt(joinMonthStr, 10);
    const studentFinRecords = finRecords.filter(r => r.studentId === s.id);
    const isMonthPaid = (m, y) => studentFinRecords.some(r => r.month === m && r.year === y && (r.amount || 0) > 0);
    const startMonth = (joinYearNum === currentYearNum) ? joinMonthNum : 1;
    const fee = Math.max(0, (gradeFees?.[s.grade] || 0) - (s.discount || 0));
    let owedMonths = 0;
    for (let m = startMonth; m <= currentMonthNum; m++) if (!isMonthPaid(m, currentYearNum)) owedMonths++;
    return owedMonths * fee;
  };

  const expensesStudents = students
    .map(s => ({ ...s, _realDue: getRealDue(s) }))
    .filter(s => s._realDue > 0)
    .sort((a, b) => b._realDue - a._realDue)
    .map(s => ({ id: s.id, name: s.name, due: fmt(s._realDue), owedMonths: getOwedMonthsLabel(s), dueDate: s.paymentDueDate || "", _due: s._realDue, grade: s.grade }));

  const totalDebt = students.reduce((a, s) => a + getRealDue(s), 0);
  const gradeDebts = GRADES_LIST.map(g => ({ grade: g, count: students.filter(s => s.grade === g).reduce((a, s) => a + getRealDue(s), 0) }));

  // أقدم شهر متأخر (من شهور سابقة فقط — مش الشهر الحالي) لكل طالب — عشان
  // صفحة "الطلاب المتأخرين من شهور سابقة" بجوار كارت إجمالي الديون في برج المراقبة
  const getOldestPrevOwedMonth = s => {
    const [curYearStr, curMonthStr] = TODAY.split("-");
    const currentYearNum  = parseInt(curYearStr, 10);
    const currentMonthNum = parseInt(curMonthStr, 10);
    const [joinYearStr, joinMonthStr] = (s.joinDate || TODAY).split("-");
    const joinYearNum  = parseInt(joinYearStr, 10);
    const joinMonthNum = parseInt(joinMonthStr, 10);
    const studentFinRecords = finRecords.filter(r => r.studentId === s.id);
    const isMonthPaid = (m, y) => studentFinRecords.some(r => r.month === m && r.year === y && (r.amount || 0) > 0);
    const startMonth = (joinYearNum === currentYearNum) ? joinMonthNum : 1;
    for (let m = startMonth; m < currentMonthNum; m++) if (!isMonthPaid(m, currentYearNum)) return m; // < مش <= — بيستبعد الشهر الحالي
    return null;
  };
  const prevDebtorsList = students
    .map(s => ({ s, oldest: getOldestPrevOwedMonth(s) }))
    .filter(x => x.oldest !== null)
    .sort((a, b) => a.oldest - b.oldest)
    .map(x => ({ name: x.s.name, grade: x.s.grade, monthNum: x.oldest, monthLabel: MONTHS_AR[x.oldest - 1] }));
  const gradeDebtStudents = GRADES_LIST.map(g => ({ grade: g, list: prevDebtorsList.filter(x => x.grade === g) }));

  const expensesSection = {
    title: "حالة حرجة - المصروفات", icon: "🔴",
    cols: ["اسم الطالب","المتبقي","الشهور المستحقة","آخر ميعاد للتسديد"],
    grades: groupByGrade(expensesStudents),
  };

  const absenceStudents = students
    .filter(s => s.absent > 3 || pct(s.absent, s.total || 1) > 15)
    .sort((a, b) => b.absent - a.absent)
    .map(s => ({ name: s.name, absentDays: s.absent, lateCount: s.late, absentPct: `${pct(s.absent, s.total || 1)}%`, grade: s.grade }));
  const absenceSection = {
    title: "الغياب", icon: "📋",
    cols: ["اسم الطالب","أيام الغياب","تأخير","نسبة الغياب"],
    grades: groupByGrade(absenceStudents),
  };

  const examStudents = students
    .filter(s => s.score < 60)
    .sort((a, b) => a.score - b.score)
    .map(s => ({ name: s.name, score: `${s.score}/100`, pct: `${s.score}%`, lessons: s.weak?.join("، ") || "—", grade: s.grade }));
  const examsSection = {
    title: "الامتحانات", icon: "📝",
    cols: ["اسم الطالب","الدرجة","النسبة","الدروس الضعيفة"],
    grades: groupByGrade(examStudents),
  };

  // طلاب بدون أي رقم هاتف مسجَّل (لا رقم الطالب ولا رقم ولي الأمر) — بيظهر مستطيل بعد "الامتحانات" وقبل "الإيرادات"
  const noPhoneStudents = students
    .filter(s => !(s.parentPhone && s.parentPhone.trim()) && !(s.phone && s.phone.trim()))
    .map(s => ({ name: s.name, group: s.group, grade: s.grade }));
  const noPhoneSection = {
    title: "الطلاب بدون أرقام", icon: "📵",
    cols: ["اسم الطالب","المجموعة"],
    grades: groupByGrade(noPhoneStudents),
  };

  return { stats: { total, active, temp, totalRevenue, revToday, revWeek, revMonth, totalDebt }, gradeCounts, gradeDebts, gradeDebtStudents, expensesSection, absenceSection, examsSection, noPhoneSection };
}

// ══════════════════════════════════════════════════════════════
// غياب اليوم (فوري) — مبني مباشرة من attRecords بدل عدّادات students
// عشان يظهر أي غياب/تأخير النهارده لحظيًا من غير انتظار أي حد أدنى
// ══════════════════════════════════════════════════════════════
export function buildTodayAttendance(attRecords, students) {
  attRecords = attRecords || [];
  students   = students   || [];
  const todayRecs = attRecords.filter(r => r.date === TODAY && (r.status === "a" || r.status === "l"));
  const rows = todayRecs.map(r => {
    const s = students.find(st => st.id === r.studentId);
    return { name: s?.name || "—", statusLabel: r.status === "a" ? "غائب" : "متأخر", reason: r.reason || "—", grade: r.grade };
  });
  const groupByGrade = arr => {
    const map = {};
    arr.forEach(s => { if (!map[s.grade]) map[s.grade] = []; map[s.grade].push(s); });
    return Object.entries(map).filter(([, v]) => v.length > 0).map(([grade, students]) => ({ grade, students }));
  };
  return { title: "غياب اليوم", icon: "📅", cols: ["اسم الطالب","الحالة","السبب"], grades: groupByGrade(rows) };
}

// ══════════════════════════════════════════════════════════════
function KPICard({ icon, label, value, sub, color, trend, gradeBreakdown, formatValue, onNamesClick, namesLabel }) {
  const [open, setOpen] = useState(false);
  const [selGrade, setSelGrade] = useState(null);
  const fmt = formatValue || (v => v);
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex flex-col gap-1 relative">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <div className="flex items-center gap-1">
          {trend != null && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%</span>}
          {onNamesClick && <button onClick={onNamesClick} className="text-amber-400 text-sm leading-none" title={namesLabel || "الأسماء"}>👤▾</button>}
          {gradeBreakdown && <button onClick={() => setOpen(o => !o)} className="text-emerald-400 text-sm leading-none">▾</button>}
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{selGrade ? fmt(gradeBreakdown.find(g => g.grade === selGrade)?.count) : value}</div>
      <div className="text-slate-400 text-xs">{selGrade || label}</div>
      {sub && !selGrade && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
      {selGrade && <button onClick={() => setSelGrade(null)} className="text-slate-500 text-xs mt-1 underline self-start">عرض الإجمالي</button>}
      {open && gradeBreakdown && (
        <div className="absolute top-12 left-3 right-3 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
          {gradeBreakdown.map((g, i) => <button key={i} onClick={() => { setSelGrade(g.grade); setOpen(false); }} className="w-full px-3 py-2 text-right text-xs text-slate-200 hover:bg-slate-800 flex justify-between border-b border-slate-800 last:border-0"><span>{g.grade}</span><span className="text-blue-400 font-bold">{fmt(g.count)}</span></button>)}
        </div>
      )}
    </div>
  );
}

// ── خلية "آخر ميعاد للتسديد" — تسجيل/تعديل ميعاد يحدده الطالب ──
function DueDateCell({ studentId, initialDate, onSave }) {
  const [value,   setValue]   = useState(initialDate || "");
  const [saved,   setSaved]   = useState(!!initialDate);
  const [editing, setEditing] = useState(!initialDate);

  useEffect(() => { setValue(initialDate || ""); setSaved(!!initialDate); setEditing(!initialDate); }, [initialDate]);

  const doSave = () => {
    if (!value) return;
    onSave?.(studentId, value);
    setSaved(true);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      {editing || !saved
        ? <input type="date" value={value} onChange={e => setValue(e.target.value)}
            className="bg-slate-700 border border-blue-500/40 rounded-lg px-2 py-1 text-white text-xs focus:outline-none" />
        : <span className="text-slate-300 text-xs whitespace-nowrap">{value}</span>
      }
      {saved && !editing
        ? <button onClick={() => setEditing(true)} className="w-7 h-7 shrink-0 rounded-lg bg-blue-700/25 border border-blue-600/30 text-blue-300 text-xs hover:bg-blue-700/40">✏️</button>
        : <button onClick={doSave} disabled={!value} className="w-7 h-7 shrink-0 rounded-lg bg-emerald-700/30 border border-emerald-600/30 text-emerald-300 text-xs disabled:opacity-30 hover:bg-emerald-700/50">💾</button>
      }
    </div>
  );
}

function renderProblemRow(title, s, extra) {
  switch (title) {
    case "حالة حرجة - المصروفات": return [
      s.name,
      <span className="text-red-400 font-bold">{s.due}</span>,
      <span className="text-amber-400 text-xs">{s.owedMonths}</span>,
      <DueDateCell studentId={s.id} initialDate={s.dueDate} onSave={extra?.onSaveDueDate} />,
    ];
    case "الغياب": return [s.name, <span className="text-red-400 font-bold">{s.absentDays}</span>, s.lateCount, s.absentPct];
    case "غياب اليوم": return [s.name, <span className={s.statusLabel === "غائب" ? "text-red-400 font-bold" : "text-amber-400 font-bold"}>{s.statusLabel}</span>, s.reason];
    case "الامتحانات": return [s.name, s.score, <span className="text-red-400 font-bold">{s.pct}</span>, s.lessons];
    case "الطلاب بدون أرقام": return [s.name, s.group];
    default: return [];
  }
}

function ProblemSection({ data, idRef, extra }) {
  const [openGrade, setOpenGrade] = useState(null);
  if (!data.grades || data.grades.length === 0) return null;
  const total = data.grades.reduce((a, g) => a + g.students.length, 0);
  return (
    <div ref={idRef} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 transition-all">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm flex items-center gap-2"><span>{data.icon}</span>{data.title}</h3>
        <div className="flex items-center gap-2"><span className="bg-red-500/15 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">إجمالي {total}</span><span className="bg-slate-700/40 text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">{data.grades.length} صف</span></div>
      </div>
      <div className="space-y-2">
        {data.grades.map((g, i) => {
          const open = openGrade === g.grade;
          return (
            <div key={i} className="border border-red-500/20 bg-red-500/5 rounded-xl overflow-hidden">
              <button onClick={() => setOpenGrade(open ? null : g.grade)} className="w-full flex items-center justify-between px-3 py-2.5 text-right">
                <span className="text-white text-sm font-medium">{g.grade}</span>
                <div className="flex items-center gap-2"><span className="text-red-400 text-xs">{g.students.length} طالب</span><span className="text-slate-500 text-xs">{open ? "▲" : "▼"}</span></div>
              </button>
              {open && (
                <div className="border-t border-red-500/15 p-2 overflow-x-auto">
                  <table className="w-full text-xs min-w-max">
                    <thead><tr className="led-thead text-slate-400">{data.cols.map((c, ci) => <th key={ci} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
                    <tbody>{g.students.map((s, si) => <tr key={si} className="border-t border-slate-700/30">{renderProblemRow(data.title, s, extra).map((cell, ci) => <td key={ci} className="px-2 py-2 text-slate-300 whitespace-nowrap">{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MONTHLY COMPARISON CHART (#5) — مقارنة الإيرادات الشهرية
// ══════════════════════════════════════════════════════════════
function MonthlyChart({ finRecords }) {
  const records = finRecords || [];
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
    const total = records
      .filter(r => (r.timestamp || "").startsWith(prefix))
      .reduce((a, r) => a + (r.amount || 0), 0);
    months.push({ label: MONTHS_AR[m].slice(0, 3), total });
  }
  const maxVal = Math.max(...months.map(m => m.total), 1);
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>📊 الإيرادات — آخر 6 أشهر</h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>ج.م</span>
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {months.map((m, i) => {
          const ratio = maxVal > 0 ? (m.total / maxVal) : 0;
          const isLast = i === months.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-center w-full" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {m.total > 0 ? fmtM(m.total) : ""}
              </div>
              <div className="w-full rounded-t-lg transition-all" style={{
                height: `${Math.max(ratio * 80, m.total > 0 ? 4 : 2)}px`,
                background: isLast ? "var(--accent)" : "var(--border)",
                opacity: isLast ? 1 : 0.6,
              }} />
              <div style={{ fontSize: "11px", color: isLast ? "var(--accent)" : "var(--text-muted)", fontWeight: isLast ? 700 : 400 }}>
                {m.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── زرار تقارير PDF (#2) ──────────────────────────────────────
function ReportButtons({ students, finRecords, settings }) {
  const cn = settings?.centerName || "مركز تعليمي";
  const [open, setOpen] = useState(false);
  const reports = [
    { label: "تقرير ديون الطلاب", icon: "💳",
      run: () => { smartPrint({ docType:"debts",   data:students,    centerName:cn }); setOpen(false); }
    },
    { label: "تقرير الغياب",       icon: "📋",
      run: () => { smartPrint({ docType:"absence", data:students,    centerName:cn }); setOpen(false); }
    },
    { label: "تقرير الإيرادات",    icon: "💰",
      run: () => { smartPrint({ docType:"revenue", data:finRecords,  centerName:cn }); setOpen(false); }
    },
    { label: "تقرير الدرجات",      icon: "📝",
      run: () => { smartPrint({ docType:"scores",  data:students,    centerName:cn }); setOpen(false); }
    },
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{ background:"var(--card-bg)", border:"1px solid var(--border)", color:"var(--text-primary)" }}>
        🖨️ طباعة تقرير
      </button>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute left-4 right-4 max-w-xs mx-auto rounded-2xl overflow-hidden shadow-xl"
            style={{ background:"var(--sidebar-bg)", border:"1px solid var(--border)", top:"50%", transform:"translateY(-50%)" }}
            onClick={e => e.stopPropagation()}>
            {reports.map((r,i) => (
              <button key={i} onClick={r.run}
                className="w-full flex items-center gap-3 px-4 py-3 text-right transition-colors"
                style={{ borderBottom:i<reports.length-1?"1px solid var(--border)":"none", color:"var(--text-primary)" }}
                onMouseEnter={e=>e.currentTarget.style.background="var(--card-bg)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span>{r.icon}</span><span className="text-sm">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ASAL AI CHAT WIDGET
// ══════════════════════════════════════════════════════════════
function buildCtxSummary(students, finRecords) {
  const dd = buildDashboardData(students, finRecords);
  const lines = [];
  lines.push(`إجمالي الطلاب: ${dd.stats.total} (نشط: ${dd.stats.active}، مؤقت: ${dd.stats.temp})`);
  lines.push(`إجمالي الإيرادات المحصّلة: ${dd.stats.totalRevenue} ج.م`);
  lines.push(`إيرادات الشهر الأخير: ${dd.stats.revMonth} ج.م`);
  [dd.expensesSection, dd.absenceSection, dd.examsSection].forEach(sec => {
    sec.grades.forEach(g => {
      g.students.forEach(s => {
        const fields = Object.entries(s).filter(([k]) => !["grade","_due","_grade"].includes(k)).map(([k, v]) => `${k}:${v}`).join(", ");
        lines.push(`[${sec.title} | ${g.grade}] ${fields}`);
      });
    });
  });
  students.forEach(s => lines.push(`[طالب] ${s.name} | ${s.grade} | غياب:${s.absent} | درجة:${s.score}% | مدفوع:${s.paid}/${s.totalFees}`));
  return lines.join("\n");
}

export function AsalAI({ sectionRefs, students, finRecords }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem("asal_api_key") || ""; } catch { return ""; } });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!open) {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    }
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };
  }, [open]);

  const saveApiKey = (k) => {
    setApiKey(k);
    try { localStorage.setItem("asal_api_key", k); } catch { /* ignore */ }
  };

  const performAction = action => {
    if (!action || action === "none") return;
    const ref = sectionRefs[action];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      ref.current.style.outline = "2px solid #60a5fa";
      setTimeout(() => { if (ref.current) ref.current.style.outline = "none"; }, 1800);
    }
  };

  const activate = () => {
    setOpen(true);
    if (messages.length === 0) {
      const greet = "أهلاً بيك مستر، أنا asal.ai. اسألني عن أي شيء في النظام أو أي سؤال عام، وهرد عليك مع نسبة تقدير لدقة الإجابة.";
      setMessages(m => [...m, { role: "ai", text: greet }]);
      speak(greet);
    }
  };

  const handleCommand = async text => {
    if (!text.trim()) return;
    if (!apiKey) { setShowKeyInput(true); return; }
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    const sys = `أنت "asal.ai"، مساعد ذكاء اصطناعي مدمج في نظام Elshrqawy. أجب عن أي سؤال — عن النظام أو عام. كن مفيداً ومختصراً.\nبيانات النظام:\n${buildCtxSummary(students, finRecords)}\n\nفي نهاية كل رد أضف:\nCONFIDENCE: <0-100>\nACTION: expenses أو absence أو exams أو none`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 600,
          system: sys,
          messages: [...messages.map(m => ({
            role: m.role === "ai" ? "assistant" : "user",
            content: (m.text || "").replace(/\nCONFIDENCE:.*\nACTION:.*/s, "").trim()
          })), { role: "user", content: text }]
        })
      });
      if (res.status === 401) {
        setMessages(m => [...m, { role: "ai", text: "❌ مفتاح API غير صحيح — اضغط ⚙ لتحديثه.", confidence: 0 }]);
        setShowKeyInput(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      let full = (data.content || []).map(c => c.text || "").join("\n").trim() || "معلش، لم أستطع الرد الآن.\nCONFIDENCE: 0\nACTION: none";
      const action = (full.match(/ACTION:\s*(expenses|absence|exams|none)/) || [])[1] || null;
      const confidence = Math.min(100, parseInt((full.match(/CONFIDENCE:\s*(\d{1,3})/) || [])[1] || 0));
      const clean = full.replace(/CONFIDENCE:\s*\d{1,3}/, "").replace(/ACTION:\s*(expenses|absence|exams|none)/, "").trim();
      setMessages(m => [...m, { role: "ai", text: clean, confidence }]);
      speak(clean);
      performAction(action);
    } catch {
      const e = "حصل خطأ في الاتصال، حاول تاني.";
      setMessages(m => [...m, { role: "ai", text: e, confidence: 0 }]);
      speak(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={activate} className="fixed bottom-5 left-5 z-40 flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white px-4 py-3 rounded-2xl shadow-lg shadow-violet-500/30 font-bold text-sm"><span className="text-lg">✨</span> asal.ai</button>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="text-xl">✨</span><div><div className="text-white font-bold text-sm">asal.ai</div><div className={`text-xs ${loading ? "text-amber-400" : "text-emerald-400"}`}>{loading ? "⏳ بيفكر..." : "🟢 جاهز"}</div></div></div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowKeyInput(v => !v)} title="إعداد API Key" className="text-slate-400 hover:text-slate-200 text-sm px-2">⚙</button>
                <button onClick={() => setOpen(false)} className="text-slate-400 text-sm">✕</button>
              </div>
            </div>
            {/* API Key input panel */}
            {showKeyInput && (
              <div className="px-4 py-3 border-b border-slate-700/40 bg-slate-800/60 space-y-2">
                <div className="text-xs text-amber-400 font-bold">🔑 Anthropic API Key</div>
                <div className="text-xs text-slate-500">احصل على مفتاحك من console.anthropic.com — يُحفظ محلياً فقط</div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    defaultValue={apiKey}
                    placeholder="sk-ant-..."
                    onBlur={e => saveApiKey(e.target.value.trim())}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                  <button onClick={() => setShowKeyInput(false)} className="bg-violet-600 text-white text-xs px-3 rounded-xl">حفظ</button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs whitespace-pre-line ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-200"}`}>
                    {m.text}
                    {m.role === "ai" && m.confidence != null && <div className={`mt-1.5 pt-1.5 border-t border-slate-700/50 text-xs flex items-center gap-1.5 ${m.confidence >= 80 ? "text-emerald-400" : m.confidence >= 50 ? "text-amber-400" : "text-red-400"}`}><span>📊 ثقة:</span><span className="font-bold">{m.confidence}%</span></div>}
                  </div>
                </div>
              ))}
              {loading && <div className="flex justify-start"><div className="bg-slate-800 text-slate-400 rounded-2xl px-3 py-2 text-xs flex gap-1"><span className="animate-pulse">●</span><span className="animate-pulse">●</span><span className="animate-pulse">●</span></div></div>}
              <div ref={endRef} />
            </div>
            <div className="p-3 border-t border-slate-700/40 flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !loading) handleCommand(input); }} placeholder={apiKey ? "اسأل أي سؤال..." : "⚙ أدخل API Key أولاً..."} disabled={loading} className="flex-1 bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/60 disabled:opacity-50" />
              <button onClick={() => !loading && handleCommand(input)} disabled={loading} className="bg-blue-600 text-white px-3 rounded-xl text-sm disabled:opacity-50">إرسال</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE 5: DASHBOARD
// Receives finRecords instead of payments
// ══════════════════════════════════════════════════════════════
export default function DashboardModule({ students: studentsProp, finRecords: finRecordsProp, attRecords: attRecordsProp, settings, role = "admin", setStudents, addActivity, jumpTo, onJumpDone, showToast, sectionJump, onSectionJumpDone }) {
  const students   = (studentsProp || []).filter(s => !isBlocked(s));
  const finRecords = finRecordsProp || [];
  const attRecords = attRecordsProp || [];
  const [period, setPeriod] = useState("today");
  const [showOldDebtors, setShowOldDebtors] = useState(false);
  const [oldDebtorsGrade, setOldDebtorsGrade] = useState(null);
  const [showNoPhone, setShowNoPhone] = useState(false);
  const [noPhoneGrade, setNoPhoneGrade] = useState(null);

  // بحث التوبار العلوي: مفيش صف فردي ثابت للطالب في برج المراقبة (البيانات
  // كلها مجمّعة/مقسّمة بالصف)، فبنعرضلها بطاقة معلومات سريعة عنه بدل ما
  // نودّيها لمكان تاني.
  useEffect(() => {
    if (!jumpTo) return;
    const s = students.find(st => st.id === jumpTo);
    if (s) {
      const due = (s.totalFees || 0) - (s.paid || 0);
      showToast?.(
        `👤 ${s.name} — ${s.grade} · مجموعة ${s.group} — الأداء ${s.score || 0}% — غياب ${s.absent || 0} — متبقي ${due > 0 ? due + " ج" : "لا يوجد"}`,
        due > 1200 || (s.score || 0) < 60 ? "error" : "success"
      );
    }
    onJumpDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  const handleSaveDueDate = (studentId, dateStr) => {
    setStudents?.(prev => (prev || []).map(s => s.id === studentId ? { ...s, paymentDueDate: dateStr } : s));
    addActivity?.("ميعاد تسديد", `تم تحديد ميعاد ${dateStr} لطالب`);
  };
  const periodLabels = { today: "اليوم", week: "الأسبوع", month: "الشهر" };
  const refs = { expenses: useRef(null), absence: useRef(null), exams: useRef(null), todayAtt: useRef(null) };

  // زرار الإشعارات في التوب بار → قسم "حالة حرجة" هنا. بيوصل لآخر مكان
  // فيه بيانات فعلية (المصروفات المتأخرة أولاً، وإلا الغياب) بدل مكان تايه.
  useEffect(() => {
    if (!sectionJump) return;
    const target = refs.expenses.current || refs.absence.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.style.outline = "2px solid #f87171";
      setTimeout(() => { if (target) target.style.outline = "none"; }, 1800);
    }
    onSectionJumpDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionJump]);

  const alerts = students.filter(s => s.score < 60 || s.absent > 8 || (s.totalFees - s.paid) > 1200);
  const dd = useMemo(() => buildDashboardData(students, finRecords, settings?.gradeFees), [students, finRecords, settings?.gradeFees]);
  const todayAtt = useMemo(() => buildTodayAttendance(attRecords, students), [attRecords, students]);

  // Assist: يشوف المحصّل + قائمة المتأخرين بالاسم + الغياب — بدون إجمالي عدد الطلاب أو إجمالي الديون
  const isAssist = role === "assist";
  // Assist: كارت المحصّل ثابت على "اليوم" فقط (مفيش أسبوع/شهر) — المستر مش بيتأثر وفاضل زي ما هو
  const effectivePeriod = isAssist ? "today" : period;
  const revVal = effectivePeriod === "today" ? dd.stats.revToday : effectivePeriod === "week" ? dd.stats.revWeek : dd.stats.revMonth;
  const oldDebtorsCount = dd.gradeDebtStudents.reduce((a, g) => a + g.list.length, 0);

  // ── صفحة "الطلاب المتأخرين من شهور سابقة" — منفصلة عن برج المراقبة، بتتفتح
  // من زرار 👤▾ بجوار كارت إجمالي الديون، وترجع لبرج المراقبة بزرار الرجوع فوق
  if (showOldDebtors) {
    const gradeList = oldDebtorsGrade ? dd.gradeDebtStudents.find(g => g.grade === oldDebtorsGrade)?.list || [] : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setShowOldDebtors(false); setOldDebtorsGrade(null); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
          <h2 className="text-white font-bold text-sm">الطلاب المتأخرين من شهور سابقة</h2>
          <span className="w-10" />
        </div>
        {!oldDebtorsGrade ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dd.gradeDebtStudents.map((g, i) => (
              <button key={i} onClick={() => setOldDebtorsGrade(g.grade)}
                className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-center hover:bg-slate-800 transition-colors">
                <div className="text-white font-bold text-sm">{g.grade}</div>
                <div className={`text-xs mt-1 ${g.list.length ? "text-red-400 font-bold" : "text-slate-500"}`}>
                  {g.list.length ? `${g.list.length} طالب متأخر` : "لا يوجد متأخرين"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setOldDebtorsGrade(null)} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">← كل الصفوف</button>
              <span className="text-white font-bold text-sm">{oldDebtorsGrade}</span>
            </div>
            {gradeList.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">مفيش طلاب متأخرين من شهور سابقة في الصف ده</div>
            ) : (
              <div className="space-y-2">
                {gradeList.map((s, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-white text-sm font-bold">{s.name}</span>
                    <span className="text-red-400 text-xs font-bold shrink-0">متأخر من شهر {s.monthLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── صفحة "الطلاب بدون أرقام" — نفس آلية "الطلاب المتأخرين من شهور سابقة"
  // بالظبط: مستطيل واحد، وبالضغط عليه بيفتح شاشة صفوف ثم أسماء
  if (showNoPhone) {
    const gradeList = noPhoneGrade ? dd.noPhoneSection.grades.find(g => g.grade === noPhoneGrade)?.students || [] : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setShowNoPhone(false); setNoPhoneGrade(null); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
          <h2 className="text-white font-bold text-sm">الطلاب بدون أرقام</h2>
          <span className="w-10" />
        </div>
        {!noPhoneGrade ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dd.noPhoneSection.grades.map((g, i) => (
              <button key={i} onClick={() => setNoPhoneGrade(g.grade)}
                className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-center hover:bg-slate-800 transition-colors">
                <div className="text-white font-bold text-sm">{g.grade}</div>
                <div className={`text-xs mt-1 ${g.students.length ? "text-amber-400 font-bold" : "text-slate-500"}`}>
                  {g.students.length ? `${g.students.length} طالب` : "لا يوجد"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setNoPhoneGrade(null)} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">← كل الصفوف</button>
              <span className="text-white font-bold text-sm">{noPhoneGrade}</span>
            </div>
            {gradeList.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">مفيش طلاب بدون أرقام في الصف ده</div>
            ) : (
              <div className="space-y-2">
                {gradeList.map((s, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-white text-sm font-bold">{s.name}</span>
                    <span className="text-amber-400 text-xs font-bold shrink-0">مجموعة {s.group}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white flex items-center gap-2">🗼 برج المراقبة{alerts.length > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">{alerts.length}</span>}</h1><p className="text-xs text-slate-500">Control Tower</p></div>
        {!isAssist && <div className="flex gap-1 bg-slate-800 rounded-xl p-1">{Object.entries(periodLabels).map(([k, v]) => <button key={k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === k ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>{v}</button>)}</div>}
      </div>
      {!isAssist && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <KPICard icon="👥" label="إجمالي الطلاب" value={dd.stats.total} sub={`${dd.stats.active} نشط · ${dd.stats.temp} مؤقت`} color="#60a5fa" gradeBreakdown={dd.gradeCounts} />
          <KPICard icon="💰" label={`المحصّل (${periodLabels[effectivePeriod]})`} value={fmtM(revVal)} sub="ج.م" color="#fbbf24" />
          <KPICard icon="📉" label="إجمالي الديون" value={fmtM(dd.stats.totalDebt)} sub="ج.م" color="#f87171" gradeBreakdown={dd.gradeDebts} formatValue={fmtM} onNamesClick={() => setShowOldDebtors(true)} namesLabel="الطلاب المتأخرين من شهور سابقة" />
        </div>
      )}
      {isAssist && (
        <div className="grid gap-3 grid-cols-2">
          <KPICard icon="💰" label="المحصّل (اليوم)" value={fmtM(revVal)} sub="ج.م" color="#fbbf24" />
          <button onClick={() => setShowOldDebtors(true)}
            className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex flex-col gap-1 text-right hover:bg-slate-800 transition-colors">
            <span className="text-2xl">🟠</span>
            <div className="text-2xl font-bold text-amber-400">{oldDebtorsCount}</div>
            <div className="text-slate-400 text-xs">متأخرين من شهور سابقة</div>
          </button>
        </div>
      )}
      <ProblemSection data={dd.expensesSection} idRef={refs.expenses} extra={{ onSaveDueDate: handleSaveDueDate }} />
      <ProblemSection data={todayAtt} idRef={refs.todayAtt} />
      <ProblemSection data={dd.absenceSection}  idRef={refs.absence}  />
      {!isAssist && <ProblemSection data={dd.examsSection} idRef={refs.exams} />}
      {dd.noPhoneSection.grades.length > 0 && (
        <button onClick={() => setShowNoPhone(true)}
          className="w-full bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center justify-between text-right hover:bg-slate-800 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📵</span>
            <span className="text-white font-bold text-sm">الطلاب بدون أرقام</span>
          </div>
          <span className="bg-amber-500/15 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {dd.noPhoneSection.grades.reduce((a, g) => a + g.students.length, 0)} طالب
          </span>
        </button>
      )}
      {!isAssist && <MonthlyChart finRecords={finRecords} />}
      <ReportButtons students={students} finRecords={finRecords} settings={settings} />
      <AsalAI sectionRefs={refs} students={students} finRecords={finRecords} />
    </div>
  );
}
