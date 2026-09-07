import { useState, useMemo, useRef, useEffect } from "react";
import { GRADES_LIST, MONTHS_AR, TODAY } from "../../constants";
import { pct, scC, isBlocked, normalizeAr, isMonthBlocked, isMonthExempt, getStatementMonths } from "../../utils";
import { smartPrint } from "../../utils/print/printRouter";
import { Bar } from "../ui";

// أرقام برج المراقبة بالإنجليزي (Latin digits) بدل الأرقام العربية (١٢٣) —
// طلب صريح: هنا بس، باقي الموديولات (المصاريف مثلاً) لسه بتستخدم fmt/fmtM العادية
const fmt  = n => (n || 0).toLocaleString("en-US") + " ج";
const fmtM = n => (n || 0).toLocaleString("en-US");

// ══════════════════════════════════════════════════════════════
// صوت إنذار بسيط وواطي (Web Audio API — من غير أي ملف صوت خارجي)
// بيتشغل مرة واحدة لما الأسست تفتح برج المراقبة ولسه فيه متأخرين
// أو طلاب بدون أرقام، عشان يلفت انتباهها.
// ══════════════════════════════════════════════════════════════
function playAssistAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const beep = (start, freq, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.07, now + start + 0.03);
      gain.gain.linearRampToValueAtTime(0, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    beep(0, 420, 0.28);
    beep(0.38, 340, 0.28);
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1500);
  } catch (e) { /* الجهاز مش بيدعم الصوت — تجاهل بهدوء */ }
}

// ══════════════════════════════════════════════════════════════
// كشف التكرار: طلاب بنفس الاسم *وفي نفس الصف بالظبط* (بغض النظر عن
// المجموعة) — لو طالبين بنفس الاسم في صفوف مختلفة، ده طبيعي (إخوات في
// سنين مختلفة مثلاً) ومش بيتحسب تكرار أصلاً. أو نفس رقم التليفون مسجّل
// لأكتر من طالب — بيشمل الطلاب النشطين والمحظورين (البلوك) كمان عشان
// يمسك التكرار الناتج عن استيراد قديم أو غلطة يدوية.
// ══════════════════════════════════════════════════════════════
function buildDuplicatesData(allStudents) {
  allStudents = allStudents || [];
  // الطلاب اللي اتأكد عليهم يدويًا إنهم مش تكرار فعلي (زي إخوات بنفس
  // الاسم) بيتشالوا من كشف التكرار تمامًا وميظهروش تاني.
  const relevant = allStudents.filter(s => !s?.dupConfirmed);

  const byNameGrade = {};
  relevant.forEach(s => {
    if (!s?.name?.trim() || !s?.grade) return;
    const key = normalizeAr(s.name).toLowerCase() + "__" + s.grade; // نفس الاسم + نفس الصف بالظبط
    (byNameGrade[key] ||= []).push(s);
  });
  const dupNames = Object.values(byNameGrade).filter(list => list.length > 1);

  const byPhone = {};
  relevant.forEach(s => {
    const phone = (s?.phone || "").trim();
    if (!phone) return;
    (byPhone[phone] ||= []).push(s);
  });
  const dupPhones = Object.values(byPhone).filter(list => list.length > 1);

  const affectedIds = new Set();
  dupNames.forEach(list => list.forEach(s => affectedIds.add(s.id)));
  dupPhones.forEach(list => list.forEach(s => affectedIds.add(s.id)));

  return { dupNames, dupPhones, count: affectedIds.size };
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD DATA BUILDER
// Uses finRecords (single source of truth) instead of payments
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// سبب "الغلطة الكبيرة": قسم الغياب في برج المراقبة كان بيعتمد على
// عدّادات قديمة تراكمية جوه بيانات الطالب نفسه (s.present/absent/late/total)
// بدل ما يعتمد على attRecords (مصدر الحقيقة الحقيقي اللي بتشوفيه في
// صفحة الحضور). العدّادات دي ممكن "تخرج عن المزامنة" مع attRecords —
// فتظهر طالب "غايب" في البرج وهو أصلاً مسجّل حاضر أو مالوش أي سجل غياب
// حقيقي في صفحة الحضور. الحل: نحسب إحصائيات الغياب مباشرة من attRecords
// نفسها بدل العدّادات، عشان القسمين (البرج وصفحة الحضور) يفضلوا متطابقين دايمًا.
// ══════════════════════════════════════════════════════════════
function buildAttStatsByStudent(attRecords) {
  const map = {};
  (attRecords || []).forEach(r => {
    if (!r?.studentId) return;
    const rec = (map[r.studentId] ||= { present: 0, absent: 0, late: 0, total: 0 });
    if (r.status === "p") rec.present++;
    else if (r.status === "a") rec.absent++;
    else if (r.status === "l") rec.late++;
    if (r.status === "p" || r.status === "a" || r.status === "l") rec.total++;
  });
  return map;
}

export function buildDashboardData(students, finRecords, gradeFees, attRecords) {
  students   = students   || [];
  finRecords = finRecords || [];
  gradeFees  = gradeFees  || {};
  const attStats = buildAttStatsByStudent(attRecords);
  const attOf = s => attStats[s.id] || { present: 0, absent: 0, late: 0, total: 0 };

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


  // المتبقي الحقيقي لكل طالب = عدد الشهور المتأخرة × رسم الصف (من الإعدادات) — بنفس منطق صفحة المصاريف "المتأخر"
  const getRealDue = s => {
    const [curYearStr, curMonthStr] = TODAY.split("-");
    const currentYearNum  = parseInt(curYearStr, 10);
    const currentMonthNum = parseInt(curMonthStr, 10);
    const [joinYearStr, joinMonthStr, joinDayStr] = (s.joinDate || TODAY).split("-");
    const joinYearNum  = parseInt(joinYearStr, 10);
    const joinMonthNum = parseInt(joinMonthStr, 10);
    const joinDayNum   = parseInt(joinDayStr, 10);
    const studentFinRecords = finRecords.filter(r => r.studentId === s.id);
    const isMonthPaid = (m, y) => studentFinRecords.some(r => r.month === m && r.year === y && (r.amount || 0) > 0);
    const startMonth = (joinYearNum === currentYearNum) ? joinMonthNum : 1;
    const fee = Math.max(0, (gradeFees?.[s.grade] || 0) - (s.discount || 0));
    // لو اتسجّل بعد يوم 25 من شهر الانضمام، الشهر ده مفيهوش مصاريف
    // خالص (صفر). لو بعد يوم 15 (وحتى 25)، الشهر ده بيتحاسب بنص الرسوم
    // — نفس منطق صفحة المصاريف (getExpectedFeeForMonth).
    const feeForMonth = m => {
      if (joinYearNum === currentYearNum && m === joinMonthNum) {
        if (joinDayNum > 25) return 0;
        if (joinDayNum > 15) return Math.round(fee / 2);
      }
      return fee;
    };
    let total = 0;
    for (let m = startMonth; m <= currentMonthNum; m++) {
      if (isMonthBlocked(s, m, currentYearNum)) continue;
      if (isMonthExempt(s, m, currentYearNum)) continue;
      if (!isMonthPaid(m, currentYearNum)) total += feeForMonth(m);
    }
    return total;
  };

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
    for (let m = startMonth; m < currentMonthNum; m++) {
      if (isMonthBlocked(s, m, currentYearNum)) continue;
      if (isMonthExempt(s, m, currentYearNum)) continue;
      if (!isMonthPaid(m, currentYearNum)) return m; // < مش <= — بيستبعد الشهر الحالي
    }
    return null;
  };
  const prevDebtorsList = students
    .map(s => ({ s, oldest: getOldestPrevOwedMonth(s) }))
    .filter(x => x.oldest !== null)
    .sort((a, b) => a.oldest - b.oldest)
    .map(x => ({ name: x.s.name, grade: x.s.grade, monthNum: x.oldest, monthLabel: MONTHS_AR[x.oldest - 1] }));
  const gradeDebtStudents = GRADES_LIST.map(g => ({ grade: g, list: prevDebtorsList.filter(x => x.grade === g) }));

  const absenceStudents = students
    .map(s => ({ s, a: attOf(s) }))
    .filter(({ a }) => a.absent > 3 || pct(a.absent, a.total || 1) > 15)
    .sort((x, y) => y.a.absent - x.a.absent)
    .map(({ s, a }) => ({ name: s.name, absentDays: a.absent, lateCount: a.late, absentPct: `${pct(a.absent, a.total || 1)}%`, grade: s.grade }));
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

  return { stats: { total, active, temp, totalRevenue, revToday, revWeek, revMonth, totalDebt }, gradeCounts, gradeDebts, gradeDebtStudents, absenceSection, examsSection, noPhoneSection, absenceByStudentId: attStats };
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

function renderProblemRow(title, s, extra) {
  switch (title) {
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
                <div className="border-t border-red-500/15 p-2 overflow-x-auto rtable-wrap">
                  <table className="w-full text-xs min-w-max rtable">
                    <thead><tr className="led-thead text-slate-400">{data.cols.map((c, ci) => <th key={ci} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
                    <tbody>{g.students.map((s, si) => <tr key={si} className="border-t border-slate-700/30">{renderProblemRow(data.title, s, extra).map((cell, ci) => <td key={ci} className={`px-2 py-2 text-slate-300 whitespace-nowrap ${ci === 0 ? "rt-name" : ""}`} data-label={ci === 0 ? undefined : data.cols[ci]}>{cell}</td>)}</tr>)}</tbody>
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
function ReportButtons({ students, finRecords, settings, role = "admin" }) {
  const cn = settings?.centerName || "مركز تعليمي";
  const [open, setOpen] = useState(false);
  const reports = [
    { label: "تقرير ديون الطلاب", icon: "💳",
      run: () => { smartPrint({ docType:"debts",   data:students,    centerName:cn }); setOpen(false); }
    },
    { label: "تقرير الغياب",       icon: "📋",
      run: () => { smartPrint({ docType:"absence", data:students,    centerName:cn }); setOpen(false); }
    },
    ...(role === "admin" ? [{ label: "تقرير الإيرادات",    icon: "💰",
      run: () => { smartPrint({ docType:"revenue", data:finRecords,  centerName:cn }); setOpen(false); }
    }] : []),
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
// MODULE 5: DASHBOARD
// Receives finRecords instead of payments
// ══════════════════════════════════════════════════════════════
export default function DashboardModule({ students: studentsProp, finRecords: finRecordsProp, attRecords: attRecordsProp, webExams, setWebExams, settings, role = "admin", setStudents, setFinRecords, setAttRecords, addActivity, activityLog, jumpTo, onJumpDone, showToast, sectionJump, onSectionJumpDone, trashedDupStudents = [], moveDupToTrash, restoreDupFromTrash }) {
  const students   = (studentsProp || []).filter(s => !isBlocked(s));
  const finRecords = finRecordsProp || [];
  const attRecords = attRecordsProp || [];
  const [period, setPeriod] = useState("today");
  const [showOldDebtors, setShowOldDebtors] = useState(false);
  const [oldDebtorsGrade, setOldDebtorsGrade] = useState(null);
  const [showNoPhone, setShowNoPhone] = useState(false);
  const [noPhoneGrade, setNoPhoneGrade] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [logCategory, setLogCategory] = useState(null);
  const [logPickedDate, setLogPickedDate] = useState("");
  const [showExams, setShowExams] = useState(false);
  const [examsGrade, setExamsGrade] = useState(null);
  const [showDup, setShowDup] = useState(false);
  const [confirmDeleteDup, setConfirmDeleteDup] = useState(null);
  const [showReceiversCompare, setShowReceiversCompare] = useState(false);
  // ── تنبيه الأسست: رسائل ثابتة على الشاشة متختفيش إلا لما تدوس على
  // قسم "المتأخرين" وبعده "بدون أرقام" — عشان تتأكد إنها فعلاً شافتهم
  const [ackLate, setAckLate] = useState(false);
  const [ackNoPhone, setAckNoPhone] = useState(false);

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

  const periodLabels = { today: "اليوم", week: "الأسبوع", month: "الشهر" };
  const refs = { absence: useRef(null), exams: useRef(null), todayAtt: useRef(null) };

  // زرار الإشعارات في التوب بار → بيوصل لآخر مكان فيه بيانات فعلية (الغياب).
  useEffect(() => {
    if (!sectionJump) return;
    const target = refs.absence.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.style.outline = "2px solid #f87171";
      setTimeout(() => { if (target) target.style.outline = "none"; }, 1800);
    }
    onSectionJumpDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionJump]);

  const dd = useMemo(() => buildDashboardData(students, finRecords, settings?.gradeFees, attRecords), [students, finRecords, settings?.gradeFees, attRecords]);
  const alerts = students.filter(s => s.score < 60 || (dd.absenceByStudentId?.[s.id]?.absent || 0) > 8 || (s.totalFees - s.paid) > 1200);
  const dupData = useMemo(() => buildDuplicatesData(studentsProp), [studentsProp]);

  // ══════════════════════════════════════════════════════════════
  // جدول مقارنة المستلمين ("المس") — لكل مستلم (مس)، عدد الطلاب اللي
  // حصّل منهم فعليًا في كل شهر من شهور السنة الدراسية (أغسطس..يونيو).
  // بنعتمد على finRecords نفسها (receiverId + month + year + amount>0)
  // زي باقي حسابات المصاريف بالظبط.
  // ══════════════════════════════════════════════════════════════
  const receiversCompareMonths = useMemo(() => {
    const [curYearStr, curMonthStr] = TODAY.split("-");
    const curYear  = parseInt(curYearStr, 10);
    const curMonth = parseInt(curMonthStr, 10);
    const startYear = curMonth >= 8 ? curYear : curYear - 1;
    return getStatementMonths(startYear);
  }, []);

  const receiversCompareData = useMemo(() => {
    const receivers = (settings?.receivers || []);
    return receivers.map(r => {
      const counts = receiversCompareMonths.map(({ month, year }) => {
        const studentIds = new Set(
          (finRecords || [])
            .filter(rec => rec.receiverId === r.id && rec.month === month && rec.year === year && (rec.amount || 0) > 0)
            .map(rec => rec.studentId)
        );
        return studentIds.size;
      });
      return { id: r.id, name: r.name, active: r.active !== false, counts, total: counts.reduce((a, b) => a + b, 0) };
    });
  }, [settings?.receivers, finRecords, receiversCompareMonths]);
  // بتتعلّم لما يتدوس ✓ على اسم في "الأسماء المكررة" — بتحفظ إن الطالب/
  // الطلاب دول اتأكد عليهم إنهم مش تكرار فعلي (زي إخوات بنفس الاسم)
  // فيختفوا من القايمة نهائيًا وميرجعوش تاني.
  const confirmNotDup = (ids) => {
    setStudents?.(p => p.map(x => ids.includes(x.id) ? { ...x, dupConfirmed: true } : x));
  };
  // ── نقل لسلة المهملات بدل الحذف النهائي المباشر (حالة التكرار بس) ──
  // بيفضل الطالب وسجلاته (مصاريف/غياب) محفوظين في السلة شهرين كاملين،
  // ممكن يترجعوا خلالها لو الاختيار غلط. بعد الشهرين بيتشالوا تلقائيًا.
  // ملحوظة: نتائج الامتحانات (webExams) بتتشال نهائيًا وقت النقل للسلة
  // نفسه (مش بترجع مع الاسترجاع) لتبسيط الفكرة — البيانات الأهم
  // (مصاريف وغياب) هي اللي بترجع كاملة.
  const hardDeleteDup = (s) => {
    const finForS = (finRecords || []).filter(r => r.studentId === s.id);
    const attForS = (attRecords || []).filter(r => r.studentId === s.id);
    moveDupToTrash?.(s, finForS, attForS);
    setStudents?.(p => (p || []).filter(x => x.id !== s.id));
    setFinRecords?.(p => (p || []).filter(r => r.studentId !== s.id));
    setAttRecords?.(p => (p || []).filter(r => r.studentId !== s.id));
    setWebExams?.(p => (p || []).map(e => ({
      ...e,
      results:  (e.results  || []).filter(r => r.studentId !== s.id),
      cheating: (e.cheating || []).filter(r => r.studentId !== s.id),
    })));
    addActivity?.("نقل لسلة المهملات", `${s.name} — تكرار اتنقل لسلة المهملات (هيتشال نهائيًا بعد شهرين لو محدش استرجعه)`);
    showToast?.(`🗑 اتنقل ${s.name} لسلة المهملات — يمكن استرجاعه خلال شهرين`, "success");
  };
  const daysLeftInTrash = (deletedAt) => Math.max(0, 60 - Math.floor((Date.now() - deletedAt) / (24 * 60 * 60 * 1000)));
  const restoreFromTrash = (studentId, name) => {
    restoreDupFromTrash?.(studentId);
    addActivity?.("استرجاع من سلة المهملات", `${name} — اترجع من سلة المهملات`);
    showToast?.(`↩️ تم استرجاع ${name}`, "success");
  };
  const todayAtt = useMemo(() => buildTodayAttendance(attRecords, students), [attRecords, students]);

  // Assist: يشوف المحصّل + قائمة المتأخرين بالاسم + الغياب — بدون إجمالي عدد الطلاب أو إجمالي الديون
  const isAssist = role === "assist";
  // Assist: كارت المحصّل ثابت على "اليوم" فقط (مفيش أسبوع/شهر) — المستر مش بيتأثر وفاضل زي ما هو
  const effectivePeriod = isAssist ? "today" : period;
  const revVal = effectivePeriod === "today" ? dd.stats.revToday : effectivePeriod === "week" ? dd.stats.revWeek : dd.stats.revMonth;
  const oldDebtorsCount = dd.gradeDebtStudents.reduce((a, g) => a + g.list.length, 0);
  const noPhoneCount = dd.noPhoneSection.grades.reduce((a, g) => a + g.students.length, 0);

  // تنبيه صوتي بسيط لما الأسست تفتح برج المراقبة ولسه فيه متأخرين أو
  // طلاب بدون أرقام محتاجين متابعة (مرة واحدة بس عند فتح الصفحة)
  useEffect(() => {
    if (isAssist && (oldDebtorsCount > 0 || noPhoneCount > 0)) {
      playAssistAlertSound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssist]);

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

  // ── تصنيف "السجل" (كل التعديلات في البرنامج) لمستطيلات حسب نوع النشاط ──
  const LOG_CATS = [
    { key: "finance",  icon: "💰", label: "المصروفات", match: a => ["دفعة مالية", "تراجع عن دفعة", "رسوم صف"].includes(a) },
    { key: "students", icon: "👥", label: "الطلاب / الإضافة", match: a => a === "إضافة طالب" || a === "تعديل طالب" || a.startsWith("استيراد") },
    { key: "block",    icon: "🚫", label: "البلوك", match: a => ["نقل لبلوك", "استرجاع من بلوك", "حذف نهائي"].includes(a) },
    { key: "edit",     icon: "✏️", label: "تعديلات وأخطاء الامتحانات", match: a => ["خطأ سؤال", "إلغاء خطأ سؤال", "سبب غياب/تأخير"].includes(a) },
    { key: "other",    icon: "📌", label: "أنشطة أخرى", match: () => true },
  ];
  const safeLog = activityLog || [];
  const categorize = entry => LOG_CATS.find(c => c.key !== "other" && c.match(entry.action)) || LOG_CATS.find(c => c.key === "other");
  const logByCategory = LOG_CATS.map(c => ({
    ...c,
    entries: safeLog.filter(e => categorize(e).key === c.key),
  }));
  const YESTERDAY = (() => { const d = new Date(TODAY); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; })();
  const entryDate = e => (e.ts || "").split(" ")[0];

  if (showLog) {
    const cat = logCategory ? logByCategory.find(c => c.key === logCategory) : null;
    const catToday     = cat ? cat.entries.filter(e => entryDate(e) === TODAY) : [];
    const catYesterday = cat ? cat.entries.filter(e => entryDate(e) === YESTERDAY) : [];
    const otherDates = cat
      ? [...new Set(cat.entries.filter(e => entryDate(e) !== TODAY && entryDate(e) !== YESTERDAY).map(entryDate))].sort((a, b) => b.localeCompare(a))
      : [];
    const pickedEntries = cat && logPickedDate ? cat.entries.filter(e => entryDate(e) === logPickedDate) : [];
    const renderEntryCard = (e, i) => (
      <div key={e.id || i} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-bold">{e.action}</span>
          <span className="text-slate-500 text-xs shrink-0">{e.ts}</span>
        </div>
        {e.detail && <div className="text-slate-400 text-xs mt-1">{e.detail}</div>}
      </div>
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setShowLog(false); setLogCategory(null); setLogPickedDate(""); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
          <h2 className="text-white font-bold text-sm">السجل</h2>
          <span className="w-10" />
        </div>
        {!logCategory ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {logByCategory.map((c, i) => (
              <button key={i} onClick={() => setLogCategory(c.key)}
                className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-center hover:bg-slate-800 transition-colors">
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="text-white font-bold text-sm">{c.label}</div>
                <div className={`text-xs mt-1 ${c.entries.length ? "text-amber-400 font-bold" : "text-slate-500"}`}>
                  {c.entries.length ? `${c.entries.length} نشاط` : "لا يوجد"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => { setLogCategory(null); setLogPickedDate(""); }} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">← كل الأقسام</button>
              <span className="text-white font-bold text-sm">{cat.icon} {cat.label}</span>
            </div>

            <div>
              <div className="text-xs text-slate-400 font-bold mb-2">📅 تعديل اليوم</div>
              {catToday.length === 0
                ? <div className="text-center text-slate-500 text-xs py-4">لا يوجد تعديلات اليوم</div>
                : <div className="space-y-2">{catToday.map(renderEntryCard)}</div>}
            </div>

            <div>
              <div className="text-xs text-slate-400 font-bold mb-2">📅 أمس</div>
              {catYesterday.length === 0
                ? <div className="text-center text-slate-500 text-xs py-4">لا يوجد تعديلات أمس</div>
                : <div className="space-y-2">{catYesterday.map(renderEntryCard)}</div>}
            </div>

            <div>
              <div className="text-xs text-slate-400 font-bold mb-2">🗓️ تواريخ أقدم</div>
              <select value={logPickedDate} onChange={e => setLogPickedDate(e.target.value)}
                disabled={otherDates.length === 0}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none disabled:opacity-40">
                <option value="">{otherDates.length === 0 ? "— مفيش تواريخ تانية —" : "— اختر تاريخ —"}</option>
                {otherDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {logPickedDate && (
                <div className="space-y-2 mt-2">
                  {pickedEntries.length === 0
                    ? <div className="text-center text-slate-500 text-xs py-4">مفيش تعديلات في التاريخ ده</div>
                    : pickedEntries.map(renderEntryCard)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── صفحة "الامتحانات" — مستطيلات صفوف، وبالضغط على صف يظهر جدول
  // الطلاب الضعاف بنفس طريقة العمل الحالية (نفس الأعمدة والبيانات القديمة)
  if (showExams) {
    const gradeList = examsGrade ? dd.examsSection.grades.find(g => g.grade === examsGrade)?.students || [] : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setShowExams(false); setExamsGrade(null); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
          <h2 className="text-white font-bold text-sm">الامتحانات</h2>
          <span className="w-10" />
        </div>
        {!examsGrade ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dd.examsSection.grades.map((g, i) => (
              <button key={i} onClick={() => setExamsGrade(g.grade)}
                className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-center hover:bg-slate-800 transition-colors">
                <div className="text-white font-bold text-sm">{g.grade}</div>
                <div className={`text-xs mt-1 ${g.students.length ? "text-red-400 font-bold" : "text-slate-500"}`}>
                  {g.students.length ? `${g.students.length} طالب` : "لا يوجد"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setExamsGrade(null)} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">← كل الصفوف</button>
              <span className="text-white font-bold text-sm">{examsGrade}</span>
            </div>
            {gradeList.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">مفيش طلاب ضعاف في الصف ده</div>
            ) : (
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto rtable-wrap">
                  <table className="w-full text-xs min-w-max rtable">
                    <thead>
                      <tr className="led-thead text-slate-400">
                        {dd.examsSection.cols.map((c, ci) => <th key={ci} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {gradeList.map((s, si) => (
                        <tr key={si} className="border-t border-slate-700/30">
                          {renderProblemRow(dd.examsSection.title, s).map((cell, ci) => (
                            <td key={ci} className={`px-2 py-2 text-slate-300 whitespace-nowrap ${ci === 0 ? "rt-name" : ""}`} data-label={ci === 0 ? undefined : dd.examsSection.cols[ci]}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── صفحة "مقارنة المستلمين (المس)" — جدول: صف لكل مستلم، عمود لكل
  // شهر دراسي (أغسطس..يونيو)، وكل خانة = عدد الطلاب اللي حصّل منهم
  // المستلم ده في الشهر ده. ──
  if (showReceiversCompare) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowReceiversCompare(false)} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
          <h2 className="text-white font-bold text-sm">مقارنة المستلمين (المس)</h2>
          <span className="w-10" />
        </div>

        {receiversCompareData.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">مفيش أسماء مستلمين مسجّلة — ضيفيهم من الإعدادات ← أسماء المستلمين</div>
        ) : (
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900/60">
                  <th className="px-3 py-2.5 text-right text-slate-400 font-bold sticky right-0 bg-slate-900/60">المس</th>
                  {receiversCompareMonths.map(({ month, year }) => (
                    <th key={`${month}-${year}`} className="px-3 py-2.5 text-center text-slate-400 font-bold">{MONTHS_AR[month - 1]}</th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-emerald-400 font-bold">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {receiversCompareData.map(r => (
                  <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                    <td className="px-3 py-2.5 text-white font-bold sticky right-0 bg-slate-800/90">{r.name}{!r.active && " (معطّل)"}</td>
                    {r.counts.map((c, i) => (
                      <td key={i} className={`px-3 py-2.5 text-center ${c > 0 ? "text-slate-200" : "text-slate-600"}`}>{c || "—"}</td>
                    ))}
                    <td className="px-3 py-2.5 text-center text-emerald-400 font-bold">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── صفحة "الطلاب بدون أرقام" — نفس آلية "الطلاب المتأخرين من شهور سابقة"
  // بالظبط: مستطيل واحد، وبالضغط عليه بيفتح شاشة صفوف ثم أسماء
  if (showDup) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowDup(false)} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
          <h2 className="text-white font-bold text-sm">الأسماء المكررة</h2>
          <span className="w-10" />
        </div>

        {dupData.dupNames.length === 0 && dupData.dupPhones.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">مفيش أي تكرار في الأسماء أو أرقام التليفونات 🎉</div>
        ) : (
          <div className="space-y-5">
            {dupData.dupNames.length > 0 && (
              <div className="space-y-2">
                <div className="text-red-400 font-bold text-xs flex items-center gap-1.5">👤 نفس الاسم ({dupData.dupNames.length} حالة)</div>
                {dupData.dupNames.map((list, i) => (
                  <div key={i} className="bg-slate-800/60 border border-red-500/20 rounded-2xl overflow-hidden">
                    <div className="px-3 py-2 bg-red-500/10 flex items-center justify-between gap-2">
                      <span className="text-white text-sm font-bold">{list[0].name} — {list[0].grade} — {list.length} طالب بنفس الاسم في نفس الصف</span>
                      <button
                        onClick={() => confirmNotDup(list.map(s => s.id))}
                        title="دول فعلاً أشخاص مختلفين (مثلاً إخوات بنفس الاسم في نفس الصف) — اخفِ التحذير بس من غير ما تمسح حد"
                        className="shrink-0 w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold hover:bg-emerald-600/30 transition-colors">
                        ✓
                      </button>
                    </div>
                    <div className="text-amber-300/80 text-[11px] px-3 pt-1.5">✓ = دول أشخاص مختلفين فعلاً (منفصل عن الحذف). 🗑 = مسح الطالب ده نهائيًا لأنه نسخة زيادة.</div>
                    <div className="divide-y divide-slate-700/40">
                      {list.map((s, si) => (
                        <div key={si} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div className="text-slate-300">{s.grade} — مجموعة {s.group} · {s.id}</div>
                          <div className="flex items-center gap-2">
                            {s.phone && <span className="text-slate-500">{s.phone}</span>}
                            {isBlocked(s) && <span className="text-amber-400 font-bold">🚫 بلوك</span>}
                            <button
                              onClick={() => confirmNotDup([s.id])}
                              title="الطالب ده شخص مختلف فعلاً — اخفِ التحذير بس من غير حذف"
                              className="shrink-0 w-6 h-6 rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold hover:bg-emerald-600/30 transition-colors">
                              ✓
                            </button>
                            <button
                              onClick={() => setConfirmDeleteDup(s)}
                              title="نسخة زيادة — احذفه نهائيًا هو وكل سجلاته"
                              className="shrink-0 w-6 h-6 rounded-md bg-red-700/25 border border-red-600/30 text-red-300 flex items-center justify-center font-bold hover:bg-red-700/35 transition-colors">
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dupData.dupPhones.length > 0 && (
              <div className="space-y-2">
                <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">📞 نفس رقم التليفون ({dupData.dupPhones.length} حالة)</div>
                {dupData.dupPhones.map((list, i) => (
                  <div key={i} className="bg-slate-800/60 border border-amber-500/20 rounded-2xl overflow-hidden">
                    <div className="px-3 py-2 bg-amber-500/10 text-white text-sm font-bold">{list[0].phone} — مسجّل لـ {list.length} طلاب</div>
                    <div className="divide-y divide-slate-700/40">
                      {list.map((s, si) => (
                        <div key={si} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div className="text-slate-300">{s.name} — {s.grade} — مجموعة {s.group}</div>
                          {isBlocked(s) && <span className="text-amber-400 font-bold">🚫 بلوك</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── سلة المهملات: الطلاب اللي اتحذفوا بسبب تكرار، بيفضلوا هنا
        شهرين قابلين للاسترجاع قبل ما يتشالوا نهائيًا ── */}
        {trashedDupStudents.length > 0 && (
          <div className="space-y-2">
            <div className="text-slate-400 font-bold text-xs flex items-center gap-1.5">🗑 سلة المهملات ({trashedDupStudents.length}) — بيتشالوا نهائيًا بعد شهرين لو محدش استرجعهم</div>
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl divide-y divide-slate-700/40 overflow-hidden">
              {trashedDupStudents.map((t) => (
                <div key={t.student.id} className="px-3 py-2.5 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="text-white font-bold">{t.student.name}</div>
                    <div className="text-slate-500">{t.student.grade} — مجموعة {t.student.group} · باقي {daysLeftInTrash(t.deletedAt)} يوم قبل الحذف النهائي</div>
                  </div>
                  <button
                    onClick={() => restoreFromTrash(t.student.id, t.student.name)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 font-bold hover:bg-emerald-600/30 transition-colors whitespace-nowrap">
                    ↩️ استرجاع
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {confirmDeleteDup && (
          <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs space-y-4">
              <div className="text-white text-sm text-center">نقل {confirmDeleteDup.name} ({confirmDeleteDup.grade} — مجموعة {confirmDeleteDup.group}) لسلة المهملات؟</div>
              <div className="text-amber-400 text-xs text-center">هيتنقل هو وسجلات الحضور والمصاريف بتاعته لسلة المهملات لمدة شهرين، وممكن تسترجعيه خلالها. بعد الشهرين هيتشال نهائيًا تلقائيًا.</div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteDup(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm">إلغاء</button>
                <button onClick={() => { hardDeleteDup(confirmDeleteDup); setConfirmDeleteDup(null); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">🗑 نقل لسلة المهملات</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
      {isAssist && (
        <style>{`
          @keyframes assistAlertGlow {
            0%, 100% { box-shadow: 0 0 0px 0px rgba(248,113,113,0.0); }
            50% { box-shadow: 0 0 16px 4px rgba(248,113,113,0.55); }
          }
          .assist-glow { animation: assistAlertGlow 1.6s ease-in-out infinite; }
        `}</style>
      )}
      <div className={`flex items-center justify-between gap-3 flex-wrap ${isAssist && (oldDebtorsCount > 0 || noPhoneCount > 0) ? "assist-glow rounded-2xl px-1" : ""}`}>
        <div><h1 className="text-lg font-bold text-white flex items-center gap-2">🗼 برج المراقبة{alerts.length > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">{alerts.length}</span>}</h1><p className="text-xs text-slate-500">Control Tower</p></div>
        {!isAssist && <div className="flex gap-1 bg-slate-800 rounded-xl p-1">{Object.entries(periodLabels).map(([k, v]) => <button key={k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === k ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>{v}</button>)}</div>}
      </div>
      {isAssist && !ackLate && oldDebtorsCount > 0 && (
        <button onClick={() => setAckLate(true)}
          className="assist-glow w-full bg-red-500/15 border border-red-500/50 rounded-2xl p-4 text-right">
          <div className="text-red-300 font-bold text-sm">🚨 يا مس، فيه طلاب متأخرين في السداد من شهور سابقة!</div>
          <div className="text-red-300/80 text-xs mt-1">شوفي القايمة تحت واطلبي منهم يدفعوا الفلوس المتأخرة.</div>
          <div className="text-red-200/60 text-[11px] mt-2">(دوسي هنا بعد ما تشوفي المتأخرين عشان الرسالة تختفي)</div>
        </button>
      )}
      {isAssist && (ackLate || oldDebtorsCount === 0) && !ackNoPhone && noPhoneCount > 0 && (
        <button onClick={() => setAckNoPhone(true)}
          className="assist-glow w-full bg-amber-500/15 border border-amber-500/50 rounded-2xl p-4 text-right">
          <div className="text-amber-300 font-bold text-sm">📵 يا مس، فيه طلاب مسجّلين من غير رقم تليفون!</div>
          <div className="text-amber-300/80 text-xs mt-1">شوفي القايمة تحت واطلبي منهم يبعتوا رقم ولي الأمر أو رقم الطالب.</div>
          <div className="text-amber-200/60 text-[11px] mt-2">(دوسي هنا بعد ما تشوفي الطلاب بدون أرقام عشان الرسالة تختفي)</div>
        </button>
      )}
      {!isAssist && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <KPICard icon="👥" label="إجمالي الطلاب" value={dd.stats.total} sub={`${dd.stats.active} نشط · ${dd.stats.temp} مؤقت`} color="#60a5fa" gradeBreakdown={dd.gradeCounts} />
          <KPICard icon="💰" label={`المحصّل (${periodLabels[effectivePeriod]})`} value={fmtM(revVal)} sub="ج.م" color="#fbbf24" />
          <KPICard icon="📉" label="إجمالي الديون" value={fmtM(dd.stats.totalDebt)} sub="ج.م" color="#f87171" gradeBreakdown={dd.gradeDebts} formatValue={fmtM} onNamesClick={() => setShowOldDebtors(true)} namesLabel="الطلاب المتأخرين من شهور سابقة" />
          <button onClick={() => setShowDup(true)}
            className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex flex-col gap-1 text-right hover:bg-slate-800 transition-colors">
            <span className="text-2xl">🧬</span>
            <div className={`text-2xl font-bold ${dupData.count > 0 ? "text-red-400" : "text-emerald-400"}`}>{dupData.count}</div>
            <div className="text-slate-400 text-xs">الأسماء المكررة</div>
          </button>
          <button onClick={() => setShowReceiversCompare(true)}
            className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex flex-col gap-1 text-right hover:bg-slate-800 transition-colors">
            <span className="text-2xl">🧑‍💼</span>
            <div className="text-2xl font-bold text-blue-400">{(settings?.receivers || []).length}</div>
            <div className="text-slate-400 text-xs">المس</div>
          </button>
        </div>
      )}
      {isAssist && (
        <div className="space-y-2">
          <button onClick={() => setAckLate(true)}
            className={`w-full flex items-center justify-between ${oldDebtorsCount > 0 && !ackLate ? "assist-glow" : ""} bg-slate-800/40 rounded-xl px-2 py-1.5 text-right`}>
            <h3 className="text-white font-bold text-sm flex items-center gap-2">🟠 الطلاب المتأخرين من شهور سابقة</h3>
            <span className="bg-amber-500/15 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">{oldDebtorsCount}</span>
          </button>
          {oldDebtorsCount === 0 ? (
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-center text-slate-500 text-xs">لا يوجد متأخرين من شهور سابقة 🎉</div>
          ) : (
            dd.gradeDebtStudents.filter(g => g.list.length > 0).map((g, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="px-3 py-2 bg-amber-500/10 flex items-center justify-between">
                  <span className="text-white text-sm font-bold">{g.grade}</span>
                  <span className="text-amber-400 text-xs font-bold">{g.list.length} طالب</span>
                </div>
                <div className="divide-y divide-slate-700/40">
                  {g.list.map((s, si) => (
                    <div key={si} className="px-3 py-2.5 flex items-center justify-between text-xs">
                      <span className="text-white font-bold">{s.name}</span>
                      <span className="text-red-400 font-bold shrink-0">متأخر من شهر {s.monthLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {!isAssist && (
        <>
          <ProblemSection data={todayAtt} idRef={refs.todayAtt} />
          <ProblemSection data={dd.absenceSection}  idRef={refs.absence}  />
        </>
      )}
      {!isAssist && (
        <button onClick={() => setShowLog(true)}
          className="w-full bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center justify-between text-right hover:bg-slate-800 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📜</span>
            <span className="text-white font-bold text-sm">السجل</span>
          </div>
          <span className="bg-blue-500/15 text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {safeLog.length} نشاط
          </span>
        </button>
      )}
      {dd.noPhoneSection.grades.length > 0 && (
        isAssist ? (
          <div className="space-y-2">
            <button onClick={() => setAckNoPhone(true)}
              className={`w-full flex items-center justify-between ${noPhoneCount > 0 && !ackNoPhone ? "assist-glow" : ""} bg-slate-800/40 rounded-xl px-2 py-1.5 text-right`}>
              <h3 className="text-white font-bold text-sm flex items-center gap-2">📵 الطلاب بدون أرقام</h3>
              <span className="bg-amber-500/15 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {noPhoneCount} طالب
              </span>
            </button>
            {dd.noPhoneSection.grades.map((g, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="px-3 py-2 bg-amber-500/10 flex items-center justify-between">
                  <span className="text-white text-sm font-bold">{g.grade}</span>
                  <span className="text-amber-400 text-xs font-bold">{g.students.length} طالب</span>
                </div>
                <div className="divide-y divide-slate-700/40">
                  {g.students.map((s, si) => (
                    <div key={si} className="px-3 py-2.5 flex items-center justify-between text-xs">
                      <span className="text-white font-bold">{s.name}</span>
                      <span className="text-amber-400 font-bold shrink-0">مجموعة {s.group}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
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
        )
      )}
      {!isAssist && (
        <button ref={refs.exams} onClick={() => setShowExams(true)}
          className="w-full bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center justify-between text-right hover:bg-slate-800 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📝</span>
            <span className="text-white font-bold text-sm">الامتحانات</span>
          </div>
          <span className="bg-red-500/15 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {dd.examsSection.grades.reduce((a, g) => a + g.students.length, 0)} طالب
          </span>
        </button>
      )}
      {!isAssist && <MonthlyChart finRecords={finRecords} />}
      <ReportButtons students={students} finRecords={finRecords} settings={settings} role={role} />
    </div>
  );
}
