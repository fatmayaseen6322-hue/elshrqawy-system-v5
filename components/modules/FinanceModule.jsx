import { useState, useMemo, useRef, useEffect } from "react";
import { GRADES_LIST, GROUPS_MAP, MONTHS_AR } from "../../constants";
import { fmtM, fmt, genFinId, nowStr } from "../../utils";
import { smartPrint } from "../../utils/print/printRouter";
import { Av, Toast, Modal, Field, Btn } from "../ui";

// ══════════════════════════════════════════════════════════════
// FINANCE PASSWORD GATE
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
// FINANCE ROW
// ══════════════════════════════════════════════════════════════
function FinRow({ student, record, globalReceiver, activeReceivers, onSave, passwordEnabled, financePassword, centerName, highlighted }) {
  const [amount,      setAmount]      = useState(record ? record.amount : (student._defaultFee || 0));
  const [receiverId,  setReceiverId]  = useState(record ? record.receiverId : (globalReceiver?.id || null));
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
      {showPw && <FinancePasswordGate onUnlock={unlockEdit} onCancel={() => setShowPw(false)} />}
      <tr ref={rowRef} className={`border-b transition-colors ${bgCls} ${highlighted ? "ring-2 ring-amber-400/70" : ""}`}>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Av name={student.name} size="sm" />
            <div className="min-w-0">
              <div className="text-white text-xs font-bold truncate" style={{ maxWidth: "90px" }}>{student.name}</div>
              <div className="text-slate-500" style={{ fontSize: "9px" }}>{student.id}</div>
            </div>
          </div>
        </td>
        <td className="px-2 py-3">
          {editing || !saved
            ? <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-16 bg-slate-700 border border-blue-500/40 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
            : <span className="text-amber-400 font-black text-sm">{amount}</span>
          }
        </td>
        <td className="px-2 py-3" style={{ minWidth: "100px" }}>
          {editing || !saved
            ? <select value={receiverId || ""} onChange={e => setReceiverId(parseInt(e.target.value))} className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
                <option value="">اختر</option>
                {(activeReceivers || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            : <span className="text-slate-300 text-xs">{receiverName}</span>
          }
        </td>
        <td className="px-2 py-3">
          <span className="text-slate-500 text-xs whitespace-nowrap">{localRecord?.timestamp || "—"}</span>
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

// ══════════════════════════════════════════════════════════════
// MODULE 3: FINANCE
// finRecords + setFinRecords come from App.jsx (single source of truth)
// ══════════════════════════════════════════════════════════════
export default function FinanceModule({ students, settings, setSettings, finRecords, setFinRecords, setStudents, addActivity, role = "admin", jumpTo, onJumpDone }) {
  const isAssist = role === "assist";
  const safeStudents  = students   || [];
  const safeSettings  = settings   || {};
  const safeRecords   = finRecords || [];

  const curMonth = new Date().getMonth() + 1;
  const curYear  = new Date().getFullYear();

  const [selGrade,         setSelGrade]         = useState("");
  const [selGroup,         setSelGroup]         = useState("");
  const [selMonth,         setSelMonth]         = useState(curMonth);
  const [selYear]                               = useState(curYear);
  const [tableOpen,        setTableOpen]        = useState(false);
  const [dayFilter,        setDayFilter]        = useState("");
  const [globalReceiverId, setGlobalReceiverId] = useState(null);
  const [toast,            setToast]            = useState(null);
  const [highlightId,      setHighlightId]      = useState(null); // تمييز طالب جاي من بحث التوبار

  // بحث التوبار العلوي: افتحلها صف وصفوف الطالب وافتح السجل تلقائي
  useEffect(() => {
    if (!jumpTo) return;
    const target = safeStudents.find(st => st.id === jumpTo);
    if (target) {
      setSelGrade(target.grade);
      setSelGroup(target.group);
      setTableOpen(true);
      setDayFilter("");
      setHighlightId(target.id);
      setTimeout(() => setHighlightId(null), 2500);
    }
    onJumpDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  const activeReceivers = (safeSettings.receivers || []).filter(r => r.active !== false);

  const tableStudents = useMemo(() => {
    if (!selGrade) return [];
    let list = safeStudents.filter(s => s && s.grade === selGrade);
    if (selGroup) list = list.filter(s => s.group === selGroup);
    return list.map(s => ({ ...s, _defaultFee: safeSettings.gradeFees?.[s.grade] || 0, _month: selMonth, _year: selYear }));
  }, [safeStudents, selGrade, selGroup, selMonth, selYear, safeSettings.gradeFees]);

  const monthRecords = useMemo(() =>
    safeRecords.filter(r =>
      r && r.grade === selGrade &&
      (!selGroup || r.group === selGroup) &&
      r.month === selMonth &&
      r.year  === selYear
    ),
  [safeRecords, selGrade, selGroup, selMonth, selYear]);

  const displayStudents = useMemo(() => {
    if (!dayFilter) return tableStudents;
    const dayStr = `${selYear}-${String(selMonth).padStart(2,"0")}-${String(dayFilter).padStart(2,"0")}`;
    const paidIds = new Set(monthRecords.filter(r => r.timestamp?.startsWith(dayStr)).map(r => r.studentId));
    return tableStudents.filter(s => paidIds.has(s.id));
  }, [tableStudents, dayFilter, monthRecords, selMonth, selYear]);

  const getRecord = studentId => monthRecords.find(r => r.studentId === studentId) || null;

  const handleSave = rec => {
    // أولاً: تحديد هل هذا سجل جديد أم تعديل على سجل قائم
    const existing = (finRecords || []).find(r => r.id === rec.id);
    const amountDiff = rec.amount - (existing?.amount || 0); // الفرق في المبلغ

    // حفظ في finRecords
    setFinRecords(prev => {
      const list = prev || [];
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) { const n = [...list]; n[idx] = rec; return n; }
      return [...list, rec];
    });

    // مزامنة student.paid — نضيف الفرق فقط (يعمل للإضافة والتعديل)
    if (amountDiff !== 0) {
      setStudents(prev => (prev || []).map(s =>
        s.id === rec.studentId
          ? { ...s, paid: Math.max(0, (s.paid || 0) + amountDiff) }
          : s
      ));
    }

    addActivity?.("دفعة مالية", `${rec.studentName} — ${rec.amount} ج`);
    setToast({ msg: `✓ تم حفظ دفعة ${rec.studentName}`, type: "success" });
  };

  const globalReceiver = activeReceivers.find(r => r.id === globalReceiverId) || null;
  const paidCount      = monthRecords.length;
  const totalCollected = monthRecords.reduce((a, r) => a + (r.amount || 0), 0);
  const grpList        = selGrade ? (GROUPS_MAP[selGrade] || ["A"]) : [];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 border border-amber-700/25 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-3xl">💰</span>
        <div><div className="text-white font-black text-base">إدارة المصاريف</div><div className="text-slate-400 text-xs">سجّل وتابع دفعات الطلاب</div></div>
        {paidCount > 0 && (
          <div className="mr-auto text-right">
            <div className="text-emerald-400 font-black text-lg">{fmt(totalCollected)}</div>
            <div className="text-slate-500 text-xs">{paidCount} طالب دفع</div>
          </div>
        )}
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="text-xs text-slate-400 font-bold mb-1">🔍 فلاتر البحث</div>
        <div className="grid grid-cols-2 gap-2">
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
          <Field label="الشهر">
            <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
              {MONTHS_AR.map((m, i) => <option key={i + 1} value={i + 1}>{i + 1} - {m}</option>)}
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
          <div className="bg-slate-800/50 border border-slate-700/30 rounded-2xl p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="فلترة بيوم محدد">
                <div className="flex gap-2">
                  <input type="number" min={1} max={31} value={dayFilter}
                    onChange={e => setDayFilter(e.target.value ? parseInt(e.target.value) : "")}
                    placeholder="أي يوم"
                    className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2 text-white text-sm focus:outline-none text-center" />
                  {dayFilter && <button onClick={() => setDayFilter("")} className="text-xs text-slate-500 hover:text-white px-2">✕</button>}
                </div>
              </Field>
              <Field label="المستلم (للكل)">
                <select value={globalReceiverId || ""} onChange={e => setGlobalReceiverId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-slate-900/60 border border-amber-500/30 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="">— اختر —</option>
                  {activeReceivers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
            </div>
            {dayFilter && (
              <div className="text-amber-400 text-xs text-center">
                📅 يعرض فقط من دفعوا يوم {dayFilter} {MONTHS_AR[selMonth - 1]} ({displayStudents.length} طالب)
              </div>
            )}
          </div>

          <div className={`grid gap-2 ${isAssist ? "grid-cols-2" : "grid-cols-3"}`}>
            {!isAssist && <div className="bg-slate-800/60 border border-slate-700/30 rounded-xl p-3 text-center"><div className="text-white font-black text-lg">{tableStudents.length}</div><div className="text-xs text-slate-500">الطلاب</div></div>}
            <div className="bg-emerald-900/20 border border-emerald-700/20 rounded-xl p-3 text-center"><div className="text-emerald-400 font-black text-lg">{paidCount}</div><div className="text-xs text-slate-500">دفعوا</div></div>
            <div className="bg-amber-900/20 border border-amber-700/20 rounded-xl p-3 text-center"><div className="text-amber-400 font-black text-sm">{fmtM(totalCollected)}</div><div className="text-xs text-slate-500">المحصّل</div></div>
          </div>

          {displayStudents.length === 0
            ? <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">📭</div><div className="text-sm">{dayFilter ? "لم يدفع أحد في هذا اليوم" : "لا يوجد طلاب لهذا الاختيار"}</div></div>
            : <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: "560px" }}>
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-700/60">
                        {["اسم الطالب","المبلغ (ج)","المستلم","وقت التسجيل","تعديل","طباعة"].map(h => (
                          <th key={h} className="px-3 py-3 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "11px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayStudents.map(s => (
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
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
