import { useState, useMemo, useRef, useEffect } from "react";
import { GRADES_LIST, GROUPS_MAP, MONTHS_AR, TODAY } from "../../constants";
import { fmtM, genFinId, nowStr, isBlocked, isMonthBlocked } from "../../utils";
import { smartPrint } from "../../utils/print/printRouter";
import { Av, Toast, Modal, Field, Btn } from "../ui";

// ══════════════════════════════════════════════════════════════
// MODULE 3: FINANCE
// - المستر: فلاتر (الصف / المجموعة / السجل) فقط — من غير يوم/شهر —
//   وبعد فتح السجل يظهر جدول تسجيل الدفعات القديم (تعديل/حفظ/طباعة).
// - Assist: زرارين جنب بعض في نفس الخط:
//     💰 المصاريف  → تسجيل دفعة طالب (جدول: اسم / مبلغ / مستلم / حفظ)
//     ⏰ المتأخر    → فلاتر (صف/مجموعة/اسم) وتظهر الطلاب المتأخرين
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
    if (isMonthBlocked(student, m, currentYearNum)) continue; // شهر بلوك — مش دَين
    if (!isMonthPaid(m, currentYearNum)) overdueMonths.push(MONTHS_AR[m - 1]);
  }
  return {
    overdueMonths,
    count: overdueMonths.length,
    currentMonthOverdue: !isMonthBlocked(student, currentMonthNum, currentYearNum) && !isMonthPaid(currentMonthNum, currentYearNum),
  };
}

// ══════════════════════════════════════════════════════════════
// FINANCE PASSWORD GATE (كلمة مرور المصاريف العادية — تُستخدم فقط
// إذا فُعِّل الخيار العام financePasswordEnabled من الإعدادات)
// ══════════════════════════════════════════════════════════════
function FinancePasswordGate({ onUnlock, onCancel }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);
  return (
    <Modal title="🔑 تعديل المصاريف" onClose={onCancel}>
      <div className="space-y-4">
        <div className="text-slate-400 text-sm text-center">أدخل كلمة مرور التعديل للمتابعة</div>
        <Field label="كلمة المرور" error={err}>
          <input
            ref={inputRef} type="password" value={pw}
            onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => { if (e.key === "Enter") onUnlock(pw, setErr); }}
            className={`w-full bg-slate-800/80 border ${err ? "border-red-500" : "border-slate-700/50"} rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center tracking-widest text-lg`}
            placeholder="••••" />
        </Field>
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={onCancel}>إلغاء</Btn>
          <Btn variant="primary" className="flex-1" onClick={() => onUnlock(pw, setErr)}>✓ دخول</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// FINANCE ROW (نفس آلية العرض القديمة: اسم / مبلغ / مستلم / وقت / تعديل / طباعة)
// ══════════════════════════════════════════════════════════════
function FinRow({ student, record, globalReceiver, activeReceivers, onSave, passwordEnabled, financePassword, centerName, highlighted }) {
  const [amount,      setAmount]      = useState(record ? record.amount : (student._defaultFee || 0));
  const [receiverId,  setReceiverId]  = useState(record ? record.receiverId : (globalReceiver?.id || null));
  const [pickTime,    setPickTime]    = useState(""); // ⏱ وقت اختيار المستلم (قبل الحفظ)
  const [saved,       setSaved]       = useState(!!record);
  const [editing,     setEditing]     = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [localRecord, setLocalRecord] = useState(record || null);
  const rowRef = useRef(null);

  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  useEffect(() => {
    if (!saved && globalReceiver) setReceiverId(globalReceiver.id);
  }, [globalReceiver]);

  const receiverName = (activeReceivers || []).find(r => r.id === receiverId)?.name || "—";

  const doSave = () => {
    if (!receiverId || !amount) return;
    const rec = {
      id: record?.id || localRecord?.id || genFinId(),
      studentId: student.id, studentName: student.name,
      grade: student.grade, group: student.group,
      month: student._month, year: student._year,
      amount: parseInt(amount) || 0,
      receiverId, receiverName,
      timestamp: nowStr(), note: "",
    };
    onSave(rec);
    setLocalRecord(rec);
    setSaved(true);
    setEditing(false);
  };

  const requestEdit = () => {
    if (passwordEnabled) setShowPw(true);
    else                 setEditing(true);
  };
  const unlockEdit = (pw, setErr) => {
    if (pw === financePassword) { setShowPw(false); setEditing(true); }
    else setErr("كلمة المرور غير صحيحة");
  };

  const canPrint = saved && localRecord !== null;
  const bgCls = saved
    ? "bg-emerald-500/5 border-emerald-500/20"
    : "bg-slate-800/40 border-slate-700/30";

  return (
    <>
      {showPw && (
        <FinancePasswordGate onUnlock={unlockEdit} onCancel={() => setShowPw(false)} />
      )}
      <tr ref={rowRef} className={`border-b transition-colors ${bgCls} ${highlighted ? "ring-2 ring-amber-400/70" : ""}`}>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Av name={student.name} size="sm" />
            <div className="min-w-0">
              <div className="text-white text-xs font-bold whitespace-normal break-words">{student.name}</div>
              <div className="text-slate-500" style={{ fontSize: "9px" }}>{student.id}</div>
            </div>
          </div>
        </td>
        <td className="px-2 py-3">
          {editing || !saved
            ? <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                onBlur={() => { if (receiverId && amount) doSave(); }}
                className="w-16 bg-slate-700 border border-blue-500/40 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
            : <span className="text-amber-400 font-black text-sm">{amount}</span>
          }
        </td>
        <td className="px-2 py-3" style={{ minWidth: "100px" }}>
          {editing || !saved
            ? <select value={receiverId || ""} onChange={e => { setReceiverId(parseInt(e.target.value)); setPickTime(nowStr()); }} className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
                <option value="">اختر</option>
                {(activeReceivers || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            : <span className="text-slate-300 text-xs">{receiverName}</span>
          }
        </td>
        <td className="px-2 py-3">
          <span className="text-slate-500 text-xs whitespace-nowrap">{(editing || !saved) ? (pickTime || "—") : (localRecord?.timestamp || "—")}</span>
        </td>
        <td className="px-2 py-3 text-center">
          {saved && !editing
            ? <button onClick={requestEdit} className="w-9 h-8 rounded-lg bg-blue-700/25 border border-blue-600/30 text-blue-300 text-sm hover:bg-blue-700/40">✏️</button>
            : <button onClick={doSave} disabled={!receiverId || !amount} className="w-9 h-8 rounded-lg bg-emerald-700/30 border border-emerald-600/30 text-emerald-300 text-sm disabled:opacity-30 hover:bg-emerald-700/50">💾</button>
          }
        </td>
        <td className="px-2 py-3 text-center">
          <button
            onClick={() => canPrint && smartPrint({ docType: "receipt", data: localRecord, centerName })}
            disabled={!canPrint}
            title={canPrint ? "طباعة إيصال" : "احفظ السجل أولاً"}
            className="w-9 h-8 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-300 text-sm disabled:opacity-30 hover:bg-slate-700/60">
            🖨️
          </button>
        </td>
      </tr>
    </>
  );
}

export default function FinanceModule({ students, settings, finRecords, setFinRecords, setStudents, addActivity, role = "admin", jumpTo, onJumpDone }) {
  const isAssist     = role === "assist";
  const safeStudents = (students || []).filter(s => !isBlocked(s));
  const safeSettings = settings   || {};
  const safeRecords  = finRecords || [];

  const curMonth = new Date().getMonth() + 1;
  const curYear  = new Date().getFullYear();
  const curDay   = new Date().getDate();

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

  // ══════════════ المستر: فلاتر الصف/المجموعة/السجل (زي ما كانت بالظبط، من غير يوم/شهر) ══════════════
  const [selGrade,         setSelGrade]         = useState("");
  const [selGroup,         setSelGroup]         = useState("");
  const [tableOpen,        setTableOpen]        = useState(false);
  const [globalReceiverId, setGlobalReceiverId] = useState(null);
  const [toast,            setToast]            = useState(null);
  const [highlightId,      setHighlightId]      = useState(null); // تمييز طالب جاي من بحث التوبار
  const [receiverStreak,   setReceiverStreak]   = useState({ id: null, count: 0 });

  // ══════════════ المستر: "عرض سجل المصاريف" — تقرير كل المعاملات في يوم معيّن (كل الصفوف) ══════════════
  const [dayReportOpen, setDayReportOpen] = useState(false);
  const [dSelDay,       setDSelDay]       = useState(curDay);
  const [dSelMonth,     setDSelMonth]     = useState(curMonth);
  const [dSelYear,      setDSelYear]      = useState(curYear);

  // تصفح إلكتروني بين الأيام (زي صفحات كتاب) — يوم قبل / يوم بعد
  const goDay = (delta) => {
    const d = new Date(dSelYear, dSelMonth - 1, dSelDay);
    d.setDate(d.getDate() + delta);
    setDSelDay(d.getDate());
    setDSelMonth(d.getMonth() + 1);
    setDSelYear(d.getFullYear());
  };

  const dayRecords = useMemo(() => {
    if (!dSelDay || !dSelMonth || !dSelYear) return [];
    const dayStr = `${dSelYear}-${String(dSelMonth).padStart(2, "0")}-${String(dSelDay).padStart(2, "0")}`;
    return safeRecords.filter(r => r && r.timestamp?.startsWith(dayStr));
  }, [safeRecords, dSelDay, dSelMonth, dSelYear]);

  const dayTotal = dayRecords.reduce((a, r) => a + (r.amount || 0), 0);

  // بحث التوبار العلوي: افتحلها صف وصف الطالب وافتح السجل تلقائي
  useEffect(() => {
    if (!jumpTo) return;
    const target = safeStudents.find(st => st.id === jumpTo);
    if (target) {
      setSelGrade(target.grade);
      setSelGroup(target.group);
      setTableOpen(true);
      setHighlightId(target.id);
      setTimeout(() => setHighlightId(null), 2500);
    }
    onJumpDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  const grpList = selGrade ? (GROUPS_MAP[selGrade] || ["A"]) : [];

  const tableStudents = useMemo(() => {
    if (!selGrade) return [];
    let list = safeStudents.filter(s => s && s.grade === selGrade);
    if (selGroup) list = list.filter(s => s.group === selGroup);
    return list.map(s => ({ ...s, _defaultFee: Math.max(0, (safeSettings.gradeFees?.[s.grade] || 0) - (s.discount || 0)), _month: curMonth, _year: curYear }));
  }, [safeStudents, selGrade, selGroup, safeSettings.gradeFees, curMonth, curYear]);

  const monthRecords = useMemo(() =>
    safeRecords.filter(r =>
      r && r.grade === selGrade &&
      (!selGroup || r.group === selGroup) &&
      r.month === curMonth &&
      r.year  === curYear
    ),
  [safeRecords, selGrade, selGroup, curMonth, curYear]);

  const getRecord = studentId => monthRecords.find(r => r.studentId === studentId) || null;

  const handleSave = rec => {
    const existing = (finRecords || []).find(r => r.id === rec.id);
    const amountDiff = rec.amount - (existing?.amount || 0);

    setFinRecords(prev => {
      const list = prev || [];
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) { const n = [...list]; n[idx] = rec; return n; }
      return [...list, rec];
    });

    if (amountDiff !== 0) {
      setStudents(prev => (prev || []).map(s =>
        s.id === rec.studentId
          ? { ...s, paid: Math.max(0, (s.paid || 0) + amountDiff) }
          : s
      ));
    }

    addActivity?.("دفعة مالية", `${rec.studentName} — ${rec.amount} ج`);
    setToast({ msg: `✓ تم حفظ دفعة ${rec.studentName}`, type: "success" });

    // ── منطق "المستلم الافتراضي التلقائي": لو تكرر اختيار نفس المستلم البديل مرتين، يبقى هو الافتراضي ──
    if (rec.receiverId && rec.receiverId !== globalReceiverId) {
      setReceiverStreak(prev => {
        if (prev.id === rec.receiverId) {
          const nextCount = prev.count + 1;
          if (nextCount >= 2) {
            setGlobalReceiverId(rec.receiverId);
            return { id: null, count: 0 };
          }
          return { id: rec.receiverId, count: nextCount };
        }
        return { id: rec.receiverId, count: 1 };
      });
    } else if (rec.receiverId === globalReceiverId) {
      setReceiverStreak({ id: null, count: 0 });
    }
  };

  const globalReceiver = activeReceivers.find(r => r.id === globalReceiverId) || null;
  const paidCount      = monthRecords.length;
  const lateCount      = Math.max(0, tableStudents.length - paidCount);

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
                                    <span className="text-white text-xs font-bold whitespace-normal break-words">{s.name}</span>
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
                                <span className="text-white text-xs font-bold whitespace-normal break-words">{student.name}</span>
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

  // ══════════════════════════ ADMIN VIEW (فلاتر الصف/المجموعة/السجل فقط — بنفس آلية العرض القديمة) ══════════════════════════
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-slate-400 font-bold">🔍 فلاتر البحث</div>
          <button onClick={() => setDayReportOpen(true)} className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1 hover:bg-blue-500/20">
            📅 عرض سجل المصاريف
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="الصف">
            <select value={selGrade} onChange={e => { setSelGrade(e.target.value); setSelGroup(""); setTableOpen(false); }}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
              <option value="">— اختر الصف —</option>
              {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="المجموعة">
            <select value={selGroup} onChange={e => setSelGroup(e.target.value)} disabled={!selGrade}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none disabled:opacity-40">
              <option value="">— الكل —</option>
              {grpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
            </select>
          </Field>
          <Field label="السجل">
            <button
              onClick={() => { if (selGrade) setTableOpen(true); else setToast({ msg: "اختر الصف أولاً", type: "error" }); }}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${tableOpen && selGrade ? "bg-amber-600 text-white" : "bg-slate-700 hover:bg-amber-600/70 text-slate-300 hover:text-white"}`}>
              {tableOpen && selGrade ? "📋 السجل مفتوح" : "📋 عرض السجل"}
            </button>
          </Field>
        </div>
      </div>

      {tableOpen && selGrade && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-800/60 border border-slate-700/30 rounded-xl p-3 text-center"><div className="text-white font-black text-lg">{tableStudents.length}</div><div className="text-xs text-slate-500">الطلاب</div></div>
            <div className="bg-emerald-900/20 border border-emerald-700/20 rounded-xl p-3 text-center"><div className="text-emerald-400 font-black text-lg">{paidCount}</div><div className="text-xs text-slate-500">دفعوا</div></div>
            <div className="bg-red-900/20 border border-red-700/20 rounded-xl p-3 text-center"><div className="text-red-400 font-black text-lg">{lateCount}</div><div className="text-xs text-slate-500">متأخر</div></div>
          </div>

          {tableStudents.length === 0
            ? <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">📭</div><div className="text-sm">لا يوجد طلاب لهذا الاختيار</div></div>
            : <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: "560px" }}>
                    <thead>
                      <tr className="led-thead bg-slate-900/80 border-b border-slate-700/60">
                        {["اسم الطالب","المبلغ (ج)","المستلم","وقت التسجيل","تعديل","طباعة"].map(h => (
                          <th key={h} className="px-3 py-3 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "11px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableStudents.map(s => (
                        <FinRow
                          key={s.id} student={s} record={getRecord(s.id)}
                          globalReceiver={globalReceiver} activeReceivers={activeReceivers}
                          onSave={handleSave}
                          passwordEnabled={safeSettings.financePasswordEnabled}
                          financePassword={safeSettings.financePassword}
                          centerName={safeSettings.centerName || "مركز تعليمي"}
                          highlighted={highlightId === s.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          }
        </>
      )}
      {!tableOpen && selGrade && <div className="text-center py-6 text-slate-600 text-sm">اضغط "عرض السجل" لفتح الجدول</div>}
      {!selGrade && <div className="text-center py-10 text-slate-600"><div className="text-5xl mb-3">💰</div><div className="text-sm">اختر الصف للبدء</div></div>}

      {dayReportOpen && (
        <Modal title="📅 سجل المصاريف اليومي" onClose={() => setDayReportOpen(false)} maxW="max-w-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Field label="اليوم">
                <input type="number" min={1} max={31} value={dSelDay}
                  onChange={e => setDSelDay(e.target.value ? parseInt(e.target.value) : "")}
                  placeholder="يوم"
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center" />
              </Field>
              <Field label="الشهر">
                <select value={dSelMonth} onChange={e => setDSelMonth(parseInt(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                  {MONTHS_AR.map((m, i) => <option key={i + 1} value={i + 1}>{i + 1} - {m}</option>)}
                </select>
              </Field>
              <Field label="السنة">
                <input type="number" value={dSelYear}
                  onChange={e => setDSelYear(e.target.value ? parseInt(e.target.value) : curYear)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center" />
              </Field>
            </div>

            {/* تصفح إلكتروني — زي صفحات كتاب: يوم قبل / يوم بعد */}
            <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2.5">
              <button onClick={() => goDay(-1)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold">◀ اليوم اللي قبله</button>
              <span className="text-slate-300 text-xs font-bold">{dSelDay} {MONTHS_AR[dSelMonth - 1]} {dSelYear}</span>
              <button onClick={() => goDay(1)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold">اليوم اللي بعده ▶</button>
            </div>

            {dayRecords.length === 0
              ? <div className="text-center py-8 text-slate-600"><div className="text-4xl mb-2">📭</div><div className="text-sm">محدش دفع في يوم {dSelDay} {MONTHS_AR[dSelMonth - 1]}</div></div>
              : <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full border-collapse" style={{ minWidth: "480px" }}>
                      <thead className="sticky top-0">
                        <tr className="led-thead bg-slate-900 border-b border-slate-700/60">
                          {["اسم الطالب","الصف","المبلغ (ج)","المستلم"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "12px" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dayRecords.map(r => (
                          <tr key={r.id} className="border-b border-slate-700/20">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Av name={r.studentName} size="sm" />
                                <span className="text-white text-xs font-bold whitespace-normal break-words">{r.studentName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{r.grade} — {r.group}</td>
                            <td className="px-3 py-2.5 text-amber-400 font-black text-sm">{r.amount}</td>
                            <td className="px-3 py-2.5 text-slate-300 text-xs">{r.receiverName || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-900/20 border-t-2 border-emerald-700/30">
                          <td colSpan={2} className="px-3 py-3 text-emerald-400 font-bold text-sm">💰 إجمالي التحصيل</td>
                          <td colSpan={2} className="px-3 py-3 text-emerald-400 font-black text-base">{fmtM(dayTotal)} ({dayRecords.length} دفعة)</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
            }
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
