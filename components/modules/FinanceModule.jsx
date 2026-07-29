import { useState, useMemo } from "react";
import { GRADES_LIST, GROUPS_MAP, MONTHS_AR, TODAY } from "../../constants";
import { fmtM, genFinId, nowStr } from "../../utils";
import { Av, Toast, Field } from "../ui";

// ══════════════════════════════════════════════════════════════
// MODULE 3: FINANCE
// - المستر: تقرير "مصاريف اليوم" (زي ما كان بالظبط، من غير تعديل).
// - Assist: زرارين جنب بعض في نفس الخط:
//     💰 المصاريف  → تسجيل دفعة طالب (جدول: اسم / مبلغ / مستلم / حفظ)
//     ⏰ المتأخر    → فلاتر (صف/مجموعة/اسم) وتظهر الطلاب المتأخرين
//                      وعدد الشهور المتأخرة، وهل الشهر الحالي متأخر ولا لأ
// finRecords يجيلها من App.jsx (single source of truth)
// ══════════════════════════════════════════════════════════════

// ── حساب الشهور المتأخرة لطالب واحد (نفس منطق ملف الطالب والداشبورد) ──
function getOverdueInfo(student, finRecords) {
  const [curYearStr, curMonthStr] = TODAY.split("-");
  const currentYearNum  = parseInt(curYearStr, 10);
  const currentMonthNum = parseInt(curMonthStr, 10);
  const [joinYearStr, joinMonthStr] = (student.joinDate || TODAY).split("-");
  const joinYearNum  = parseInt(joinYearStr, 10);
  const joinMonthNum = parseInt(joinMonthStr, 10);

  const studentFinRecords = (finRecords || []).filter(r => r.studentId === student.id);
  const isMonthPaid = (m, y) => studentFinRecords.some(r => r.month === m && r.year === y && (r.amount || 0) > 0);
  const startMonth = (joinYearNum === currentYearNum) ? joinMonthNum : 1;

  const overdueMonths = [];
  for (let m = startMonth; m <= currentMonthNum; m++) {
    if (!isMonthPaid(m, currentYearNum)) overdueMonths.push(MONTHS_AR[m - 1]);
  }
  return {
    overdueMonths,
    count: overdueMonths.length,
    currentMonthOverdue: !isMonthPaid(currentMonthNum, currentYearNum),
  };
}

export default function FinanceModule({ students, settings, finRecords, setFinRecords, setStudents, addActivity, role = "admin" }) {
  const isAssist     = role === "assist";
  const safeStudents = students   || [];
  const safeSettings = settings   || {};
  const safeRecords  = finRecords || [];

  const curMonth = new Date().getMonth() + 1;
  const curYear  = new Date().getFullYear();

  // ══════════════ Assist: تبويب "المصاريف" (تسجيل دفعة) ══════════════
  const [aTab,       setATab]       = useState(null); // "pay" | "late" | null
  const [pSelGrade,  setPSelGrade]  = useState("");
  const [pSelGroup,  setPSelGroup]  = useState("");
  const [toastP,     setToastP]     = useState(null);
  const [rowAmounts,   setRowAmounts]   = useState({});
  const [rowReceivers, setRowReceivers] = useState({});

  const activeReceivers = (safeSettings.receivers || []).filter(r => r.active !== false);
  const pGrpList = pSelGrade ? (GROUPS_MAP[pSelGrade] || ["A"]) : [];

  const pStudents = useMemo(() => {
    if (!pSelGrade) return [];
    let list = safeStudents.filter(s => s && s.grade === pSelGrade);
    if (pSelGroup) list = list.filter(s => s.group === pSelGroup);
    return list;
  }, [safeStudents, pSelGrade, pSelGroup]);

  const monthRecordsMap = useMemo(() => {
    const map = {};
    safeRecords.forEach(r => { if (r && r.month === curMonth && r.year === curYear) map[r.studentId] = r; });
    return map;
  }, [safeRecords, curMonth, curYear]);

  const savePayment = student => {
    const existing = monthRecordsMap[student.id];
    const defaultAmount = Math.max(0, (safeSettings.gradeFees?.[student.grade] || 0) - (student.discount || 0));
    const amount = rowAmounts[student.id] ?? (existing ? existing.amount : defaultAmount);
    const receiverId = rowReceivers[student.id] ?? existing?.receiverId ?? activeReceivers[0]?.id ?? "";
    const receiverName = activeReceivers.find(r => r.id === receiverId)?.name || "—";

    if (!receiverId || !amount) { setToastP({ msg: "اكتب المبلغ واختر المستلم", type: "error" }); return; }

    const rec = {
      id: existing?.id || genFinId(),
      studentId: student.id, studentName: student.name,
      grade: student.grade, group: student.group,
      month: curMonth, year: curYear,
      amount: parseInt(amount) || 0,
      receiverId, receiverName,
      timestamp: nowStr(), note: "",
    };
    const amountDiff = rec.amount - (existing?.amount || 0);

    setFinRecords(prev => {
      const list = prev || [];
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) { const n = [...list]; n[idx] = rec; return n; }
      return [...list, rec];
    });
    if (amountDiff !== 0) {
      setStudents(prev => (prev || []).map(s => s.id === rec.studentId ? { ...s, paid: Math.max(0, (s.paid || 0) + amountDiff) } : s));
    }
    addActivity?.("دفعة مالية", `${rec.studentName} — ${rec.amount} ج`);
    setToastP({ msg: `✓ اتسجلت دفعة ${rec.studentName}`, type: "success" });
  };

  // ══════════════ Assist: تبويب "المتأخر" ══════════════
  const [lSelGrade, setLSelGrade] = useState("");
  const [lSelGroup, setLSelGroup] = useState("");
  const [lSearch,   setLSearch]   = useState("");

  const lGrpList = lSelGrade ? (GROUPS_MAP[lSelGrade] || ["A"]) : [];

  const lateStudents = useMemo(() => {
    let list = safeStudents;
    if (lSelGrade) list = list.filter(s => s.grade === lSelGrade);
    if (lSelGroup) list = list.filter(s => s.group === lSelGroup);
    if (lSearch.trim()) { const q = lSearch.trim(); list = list.filter(s => (s.name || "").includes(q)); }
    return list
      .map(s => ({ student: s, ...getOverdueInfo(s, safeRecords) }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [safeStudents, safeRecords, lSelGrade, lSelGroup, lSearch]);

  // ══════════════ المستر: تقرير مصاريف اليوم (زي ما كان بالظبط) ══════════════
  const [dSelGrade,  setDSelGrade]  = useState("");
  const [dSelGroup,  setDSelGroup]  = useState("");
  const [dSelDay,    setDSelDay]    = useState(new Date().getDate());
  const [dSelMonth,  setDSelMonth]  = useState(new Date().getMonth() + 1);
  const [dTableOpen, setDTableOpen] = useState(false);
  const [toast,      setToast]      = useState(null);

  const dGrpList = dSelGrade ? (GROUPS_MAP[dSelGrade] || ["A"]) : [];

  const dayRecords = useMemo(() => {
    if (!dSelDay || !dSelMonth) return [];
    const dayStr = `${curYear}-${String(dSelMonth).padStart(2, "0")}-${String(dSelDay).padStart(2, "0")}`;
    return safeRecords.filter(r =>
      r && r.timestamp?.startsWith(dayStr) &&
      (!dSelGrade || r.grade === dSelGrade) &&
      (!dSelGroup || r.group === dSelGroup)
    );
  }, [safeRecords, dSelGrade, dSelGroup, dSelDay, dSelMonth, curYear]);

  const dayTotal = dayRecords.reduce((a, r) => a + (r.amount || 0), 0);

  // ══════════════════════════ ASSIST VIEW ══════════════════════════
  if (isAssist) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setATab(aTab === "pay" ? null : "pay")}
            className={`py-3 rounded-2xl font-bold text-sm transition-all ${aTab === "pay" ? "bg-emerald-600 text-white" : "bg-slate-800/60 border border-slate-700/40 text-slate-300 hover:text-white"}`}>
            💰 المصاريف
          </button>
          <button onClick={() => setATab(aTab === "late" ? null : "late")}
            className={`py-3 rounded-2xl font-bold text-sm transition-all ${aTab === "late" ? "bg-red-600 text-white" : "bg-slate-800/60 border border-slate-700/40 text-slate-300 hover:text-white"}`}>
            ⏰ المتأخر
          </button>
        </div>

        {aTab === "pay" && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="الصف">
                  <select value={pSelGrade} onChange={e => { setPSelGrade(e.target.value); setPSelGroup(""); }}
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    <option value="">— اختر الصف —</option>
                    {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="المجموعة">
                  <select value={pSelGroup} onChange={e => setPSelGroup(e.target.value)} disabled={!pSelGrade}
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none disabled:opacity-40">
                    <option value="">— الكل —</option>
                    {pGrpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {!pSelGrade && <div className="text-center py-10 text-slate-600"><div className="text-5xl mb-3">💰</div><div className="text-sm">اختر الصف للبدء</div></div>}

            {pSelGrade && (
              pStudents.length === 0
                ? <div className="text-center py-10 text-slate-600 text-sm">لا يوجد طلاب لهذا الاختيار</div>
                : <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ minWidth: "480px" }}>
                        <thead>
                          <tr className="bg-slate-900/80 border-b border-slate-700/60">
                            {["اسم الطالب","المبلغ (ج)","المستلم","حفظ"].map(h => (
                              <th key={h} className="px-3 py-2.5 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "13px" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pStudents.map(s => {
                            const existing = monthRecordsMap[s.id];
                            const defaultAmount = Math.max(0, (safeSettings.gradeFees?.[s.grade] || 0) - (s.discount || 0));
                            const amount = rowAmounts[s.id] ?? (existing ? existing.amount : defaultAmount);
                            const receiverId = rowReceivers[s.id] ?? existing?.receiverId ?? activeReceivers[0]?.id ?? "";
                            return (
                              <tr key={s.id} className={`border-b border-slate-700/20 ${existing ? "bg-emerald-500/5" : ""}`}>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Av name={s.name} size="sm" />
                                    <span className="text-white text-xs font-bold truncate" style={{ maxWidth: "110px" }}>{s.name}</span>
                                    {existing && <span className="text-emerald-400 text-xs">✓</span>}
                                  </div>
                                </td>
                                <td className="px-2 py-2.5">
                                  <input type="number" value={amount}
                                    onChange={e => setRowAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                                    className="w-16 bg-slate-700 border border-blue-500/40 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                                </td>
                                <td className="px-2 py-2.5" style={{ minWidth: "100px" }}>
                                  <select value={receiverId}
                                    onChange={e => setRowReceivers(prev => ({ ...prev, [s.id]: parseInt(e.target.value) }))}
                                    className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
                                    <option value="">اختر</option>
                                    {activeReceivers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>
                                </td>
                                <td className="px-2 py-2.5 text-center">
                                  <button onClick={() => savePayment(s)} className="w-9 h-8 rounded-lg bg-emerald-700/30 border border-emerald-600/30 text-emerald-300 text-sm hover:bg-emerald-700/50">💾</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
            )}
            {toastP && <Toast msg={toastP.msg} type={toastP.type} onDone={() => setToastP(null)} />}
          </div>
        )}

        {aTab === "late" && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="الصف">
                  <select value={lSelGrade} onChange={e => { setLSelGrade(e.target.value); setLSelGroup(""); }}
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    <option value="">— كل الصفوف —</option>
                    {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="المجموعة">
                  <select value={lSelGroup} onChange={e => setLSelGroup(e.target.value)} disabled={!lSelGrade}
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none disabled:opacity-40">
                    <option value="">— الكل —</option>
                    {lGrpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
                  </select>
                </Field>
                <Field label="اسم الطالب">
                  <input value={lSearch} onChange={e => setLSearch(e.target.value)} placeholder="دور بالاسم"
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" />
                </Field>
              </div>
            </div>

            {lateStudents.length === 0
              ? <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">🎉</div><div className="text-sm">مفيش طلاب متأخرين بالفلتر ده</div></div>
              : <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ minWidth: "480px" }}>
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-700/60">
                          {["اسم الطالب","الصف / المجموعة","عدد الشهور المتأخرة","الشهر الحالي"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "13px" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lateStudents.map(({ student, count, currentMonthOverdue, overdueMonths }) => (
                          <tr key={student.id} className="border-b border-slate-700/20">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Av name={student.name} size="sm" />
                                <span className="text-white text-xs font-bold truncate" style={{ maxWidth: "110px" }}>{student.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{student.grade} — {student.group}</td>
                            <td className="px-3 py-2.5" title={overdueMonths.join("، ")}>
                              <span className="text-red-400 font-black text-sm">{count}</span>
                              <span className="text-slate-500 text-xs"> شهر</span>
                            </td>
                            <td className="px-3 py-2.5">
                              {currentMonthOverdue
                                ? <span className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold">متأخر</span>
                                : <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold">مدفوع</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
            }
          </div>
        )}

        {!aTab && <div className="text-center py-16 text-slate-600"><div className="text-5xl mb-3">💰</div><div className="text-sm">اختار "المصاريف" لتسجيل دفعة، أو "المتأخر" لمعرفة المتأخرين</div></div>}
      </div>
    );
  }

  // ══════════════════════════ ADMIN VIEW (زي ما كان بالظبط) ══════════════════════════
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="text-xs text-slate-400 font-bold mb-1">💰 مصاريف اليوم</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Field label="الصف">
            <select value={dSelGrade} onChange={e => { setDSelGrade(e.target.value); setDSelGroup(""); setDTableOpen(false); }}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
              <option value="">— كل الصفوف —</option>
              {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="المجموعة">
            <select value={dSelGroup} onChange={e => { setDSelGroup(e.target.value); setDTableOpen(false); }} disabled={!dSelGrade}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none disabled:opacity-40">
              <option value="">— الكل —</option>
              {dGrpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
            </select>
          </Field>
          <Field label="اليوم / الشهر">
            <div className="flex gap-1.5">
              <input type="number" min={1} max={31} value={dSelDay}
                onChange={e => { setDSelDay(e.target.value ? parseInt(e.target.value) : ""); setDTableOpen(false); }}
                placeholder="يوم"
                className="w-16 bg-slate-900/60 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-sm focus:outline-none text-center" />
              <select value={dSelMonth} onChange={e => { setDSelMonth(parseInt(e.target.value)); setDTableOpen(false); }}
                className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-sm focus:outline-none">
                {MONTHS_AR.map((m, i) => <option key={i + 1} value={i + 1}>{i + 1} - {m}</option>)}
              </select>
            </div>
          </Field>
          <Field label="السجل">
            <button
              onClick={() => { if (!dSelDay) { setToast({ msg: "اختر اليوم أولاً", type: "error" }); return; } setDTableOpen(true); }}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${dTableOpen ? "bg-amber-600 text-white" : "bg-slate-700 hover:bg-amber-600/70 text-slate-300 hover:text-white"}`}>
              {dTableOpen ? "📋 السجل مفتوح" : "📋 عرض السجل"}
            </button>
          </Field>
        </div>
      </div>

      {dTableOpen && (
        dayRecords.length === 0
          ? <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">📭</div><div className="text-sm">محدش دفع في يوم {dSelDay} {MONTHS_AR[dSelMonth - 1]}</div></div>
          : <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: "480px" }}>
                  <thead>
                    <tr className="led-thead bg-slate-900/80 border-b border-slate-700/60">
                      {["اسم الطالب","الصف / المجموعة","المبلغ (ج)","المستلم","وقت التسجيل"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "13px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayRecords.map(r => (
                      <tr key={r.id} className="border-b border-slate-700/20">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Av name={r.studentName} size="sm" />
                            <span className="text-white text-xs font-bold truncate" style={{ maxWidth: "110px" }}>{r.studentName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{r.grade} — {r.group}</td>
                        <td className="px-3 py-2.5 text-amber-400 font-black text-sm">{r.amount}</td>
                        <td className="px-3 py-2.5 text-slate-300 text-xs">{r.receiverName || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{r.timestamp || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-900/20 border-t-2 border-emerald-700/30">
                      <td colSpan={2} className="px-3 py-3 text-emerald-400 font-bold text-sm">💰 إجمالي التحصيل</td>
                      <td colSpan={3} className="px-3 py-3 text-emerald-400 font-black text-base">{fmtM(dayTotal)} ({dayRecords.length} دفعة)</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
