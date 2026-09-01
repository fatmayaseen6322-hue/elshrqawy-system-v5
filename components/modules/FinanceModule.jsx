import { useState, useMemo, useRef, useEffect } from "react";
import { GRADES_LIST, GROUPS_MAP, MONTHS_AR, TODAY } from "../../constants";
import { fmtM, genFinId, nowStr, isBlocked, isMonthBlocked, checkPwd } from "../../utils";
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
// UNDO PASSWORD GATE (كلمة سر "تراجع في المصاريف" — من الإعدادات، مشفّرة)
// ══════════════════════════════════════════════════════════════
function UndoPasswordGate({ undoHash, onUnlock, onCancel }) {
  const [pw, setPw]     = useState("");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);
  const submit = async () => {
    if (busy) return;
    if (!undoHash) { setErr("لازم تحددي كلمة سر التراجع الأول من الإعدادات ⚙️ ← كلمة السر ← تراجع في المصاريف"); return; }
    setBusy(true);
    const ok = await checkPwd(pw, undoHash);
    setBusy(false);
    if (ok) onUnlock();
    else setErr("كلمة المرور غير صحيحة");
  };
  return (
    <Modal title="↩️ تراجع عن تسجيل الطالب" onClose={onCancel}>
      <div className="space-y-4">
        <div className="text-slate-400 text-sm text-center">هيتم مسح دفعة اليوم لهذا الطالب وترجع بياناته فاضية — أدخل كلمة سر التراجع للمتابعة</div>
        <Field label="كلمة السر" error={err}>
          <input
            ref={inputRef} type="password" value={pw}
            onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            className={`w-full bg-slate-800/80 border ${err ? "border-red-500" : "border-slate-700/50"} rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center tracking-widest text-lg`}
            placeholder="••••" />
        </Field>
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={onCancel}>إلغاء</Btn>
          <Btn variant="danger" className="flex-1" disabled={busy} onClick={submit}>{busy ? "جارٍ التحقق…" : "↩️ تأكيد التراجع"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// FINANCE ROW (نفس آلية العرض القديمة: اسم / مبلغ / مستلم / وقت / تعديل / طباعة / تراجع)
// ══════════════════════════════════════════════════════════════
function FinRow({ student, index, record, globalReceiver, activeReceivers, onSave, onUndo, passwordEnabled, financePassword, undoPassword, centerName, highlighted }) {
  const [amount,      setAmount]      = useState(record ? record.amount : (student._defaultFee || 0));
  const [receiverId,  setReceiverId]  = useState(record ? record.receiverId : (globalReceiver?.id || null));
  const [pickTime,    setPickTime]    = useState(""); // ⏱ وقت اختيار المستلم (قبل الحفظ)
  const [saved,       setSaved]       = useState(!!record);
  const [editing,     setEditing]     = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [showUndoPw,  setShowUndoPw]  = useState(false);
  const [localRecord, setLocalRecord] = useState(record || null);
  const rowRef = useRef(null);

  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  useEffect(() => {
    if (!saved && globalReceiver) setReceiverId(globalReceiver.id);
  }, [globalReceiver]);

  const receiverName = (activeReceivers || []).find(r => r.id === receiverId)?.name || "—";

  const buildRec = (recvId, recvName, amt = amount) => ({
    id: record?.id || localRecord?.id || genFinId(),
    studentId: student.id, studentName: student.name,
    grade: student.grade, group: student.group,
    month: student._month, year: student._year,
    amount: parseInt(amt) || 0,
    receiverId: recvId, receiverName: recvName,
    timestamp: nowStr(), note: "",
  });

  const doSave = () => {
    if (!receiverId || !amount) return;
    const rec = buildRec(receiverId, receiverName);
    onSave(rec);
    setLocalRecord(rec);
    setSaved(true);
    setEditing(false);
  };

  // ── حفظ تلقائي فوري لحظة تعديل المبلغ (بدون انتظار الخروج من الخانة) ──
  // بيضمن إن أي تعديل في مصاريف الطالب يفضل ثابت حتى لو قفلت الجدول أو غيّرت الصف وردّي تاني.
  const autoSaveAmount = val => {
    setAmount(val);
    if (receiverId && val !== "" && (parseInt(val) || 0) > 0) {
      const rec = buildRec(receiverId, receiverName, val);
      onSave(rec);
      setLocalRecord(rec);
      setSaved(true);
    }
  };

  // ── اختيار المستلم من القائمة: يسجّل الدفعة أوتوماتيك فورًا (لو المبلغ موجود) ──
  // وبيبلّغ الأب إن المستلم ده يبقى الافتراضي للطلاب اللي جايين بعد كده (اللي لسه ما اتسجلوش)
  const pickReceiver = id => {
    const numId = id ? parseInt(id) : null;
    setReceiverId(numId);
    const time = nowStr();
    setPickTime(time);
    if (numId && amount) {
      const recvName = (activeReceivers || []).find(r => r.id === numId)?.name || "—";
      const rec = buildRec(numId, recvName);
      onSave(rec);
      setLocalRecord(rec);
      setSaved(true);
      setEditing(false);
    }
  };

  const requestEdit = () => {
    if (passwordEnabled) setShowPw(true);
    else                 setEditing(true);
  };
  const unlockEdit = (pw, setErr) => {
    if (pw === financePassword) { setShowPw(false); setEditing(true); }
    else setErr("كلمة المرور غير صحيحة");
  };

  // ── تراجع عن تسجيل الطالب: يمسح دفعة اليوم/الشهر ده ويرجّع الصف فاضي كأنه لسه ما اتسجلش ──
  const requestUndo = () => setShowUndoPw(true);
  const confirmUndo = () => {
    setShowUndoPw(false);
    if (localRecord) onUndo?.(localRecord);
    setLocalRecord(null);
    setSaved(false);
    setEditing(false);
    setAmount(student._defaultFee || 0);
    setReceiverId(globalReceiver?.id || null);
    setPickTime("");
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
      {showUndoPw && (
        <UndoPasswordGate undoHash={undoPassword} onUnlock={confirmUndo} onCancel={() => setShowUndoPw(false)} />
      )}
      <tr ref={rowRef} className={`border-b transition-colors ${bgCls} ${highlighted ? "ring-2 ring-amber-400/70" : ""}`}>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {typeof index === "number" && (
              <span className="text-slate-500 font-bold text-xs shrink-0">{index + 1}.</span>
            )}
            <Av name={student.name} size="sm" />
            <div className="min-w-0">
              <div className="text-white text-xs font-bold whitespace-normal break-words">{student.name}</div>
              <div className="text-slate-500" style={{ fontSize: "9px" }}>{student.id}</div>
            </div>
          </div>
        </td>
        <td className="px-2 py-3" style={{ minWidth: "100px" }}>
          {editing || !saved
            ? <select value={receiverId || ""} onChange={e => pickReceiver(e.target.value)} className="w-full bg-slate-700 border border-slate-600/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
                <option value="">اختر</option>
                {(activeReceivers || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            : <span className="text-slate-300 text-xs">{receiverName}</span>
          }
        </td>
        <td className="px-2 py-3">
          <span className="text-slate-500 text-xs whitespace-nowrap">{(editing || !saved) ? (pickTime || "—") : (localRecord?.timestamp || "—")}</span>
        </td>
        <td className="px-2 py-3">
          {editing || !saved
            ? <input type="number" value={amount} onChange={e => autoSaveAmount(e.target.value)}
                onBlur={() => setEditing(false)}
                className="w-16 bg-slate-700 border border-blue-500/40 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
            : <span className="text-amber-400 font-black text-sm">{amount}</span>
          }
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
        <td className="px-2 py-3 text-center">
          <button
            onClick={requestUndo}
            disabled={!saved}
            title={saved ? "تراجع عن تسجيل الطالب" : "لسه ما اتسجلش"}
            className="w-9 h-8 rounded-lg bg-red-700/20 border border-red-600/30 text-red-400 text-sm disabled:opacity-30 hover:bg-red-700/40">
            ↩️
          </button>
        </td>
      </tr>
    </>
  );
}

// ── زرار تراجع بسيط لصف واحد (مستخدم في تبويب "المصاريف" بتاع Assist) ──
function UndoCell({ canUndo, undoPassword, onConfirm }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <button
        onClick={() => setShow(true)}
        disabled={!canUndo}
        title={canUndo ? "تراجع عن تسجيل الطالب" : "لسه ما اتسجلش"}
        className="w-9 h-8 rounded-lg bg-red-700/20 border border-red-600/30 text-red-400 text-sm disabled:opacity-30 hover:bg-red-700/40">
        ↩️
      </button>
      {show && (
        <UndoPasswordGate undoHash={undoPassword} onUnlock={() => { setShow(false); onConfirm(); }} onCancel={() => setShow(false)} />
      )}
    </>
  );
}

export default function FinanceModule({ students, settings, finRecords, setFinRecords, setStudents, addActivity, role = "admin", jumpTo, onJumpDone, financeMode = null, setFinanceMode }) {
  const safeStudents = (students || []).filter(s => !isBlocked(s));
  const safeSettings = settings   || {};
  const safeRecords  = finRecords || [];

  const curMonth = new Date().getMonth() + 1;
  const curYear  = new Date().getFullYear();
  const curDay   = new Date().getDate();

  // ══════════════ زر "تسجيل الشهور الماضية" — اختيار الشهر/السنة المطلوب تسجيله ══════════════
  const [regMonth, setRegMonth] = useState(curMonth);
  const [regYear,  setRegYear]  = useState(curYear);
  const effMonth = financeMode === "past" ? regMonth : curMonth;
  const effYear  = financeMode === "past" ? regYear  : curYear;
  const activeReceivers = (safeSettings.receivers || []).filter(r => r.active !== false);
  // (Assist بقى بياخد نفس شاشة/عملية المستر بالكامل بدل الشاشة المبسطة اللي كانت بتاعته لوحده)

  // ══════════════════════════ ADMIN VIEW ══════════════════════════

  // ── لسه محددتش قسم: اعرض 4 مستطيلات كبيرة تملا الشاشة (بدل قائمة منسدلة) ──
  if (!financeMode) {
    const sections = [
      { key: "current", icon: "💰", label: "الشهر الحالي",        desc: "تسجيل مصاريف الشهر الحالي" },
      { key: "late",    icon: "⏰", label: "متأخر",                desc: "الطلاب المتأخرين في السداد" },
      { key: "past",    icon: "🗓️", label: "تسجيل الشهور الماضية", desc: "تسجيل دفعة لشهر سابق" },
      { key: "log",     icon: "📒", label: "سجل المعاملات",        desc: "كل المعاملات في يوم معيّن" },
    ];
    return (
      <div className="min-h-[70vh] flex flex-col justify-center gap-3">
        <div className="text-center text-slate-400 text-sm font-bold mb-2">💰 المصاريف — اختر القسم</div>
        <div className="grid grid-cols-2 gap-3">
          {sections.map(s => (
            <button key={s.key}
              onClick={() => setFinanceMode?.(s.key)}
              className="flex flex-col items-center justify-center gap-2 py-10 rounded-3xl font-bold bg-slate-800/60 border border-slate-700/40 hover:bg-emerald-600/20 hover:border-emerald-500/40 text-slate-200 hover:text-white transition-all">
              <span className="text-4xl">{s.icon}</span>
              <span className="text-base">{s.label}</span>
              <span className="text-xs text-slate-500 font-normal">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setFinanceMode?.(null)}
        className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-1.5 transition-all">
        ☰ تغيير القسم
      </button>
      {financeMode === "current" ? (
        !selGrade ? (
          // ── مفيش صف متاختار: اعرض 6 مستطيلات للصفوف ──
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
            <div className="text-xs text-slate-400 font-bold mb-1">💰 الشهر الحالي — اختر الصف</div>
            <div className="grid grid-cols-2 gap-2">
              {GRADES_LIST.map(g => (
                <button key={g}
                  onClick={() => { setSelGrade(g); setSelGroup(""); setTableOpen(true); }}
                  className="py-4 rounded-2xl font-bold text-sm bg-slate-700/60 hover:bg-emerald-600/80 text-slate-200 hover:text-white border border-slate-600/40 transition-all">
                  {g}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // ── صف متاختار: تلات ازرار فوق (رجوع / مصاريف اليوم / عرض سجل المصاريف) ──
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelGrade(""); setSelGroup(""); setTableOpen(false); }}
                className="px-3 py-2.5 rounded-xl font-bold text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all whitespace-nowrap">
                ⬅️ رجوع
              </button>
              <div className="flex-1 px-3 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 text-white text-center">
                💰 مصاريف اليوم — {selGrade}
              </div>
              <button onClick={() => setDayReportOpen(true)}
                className="px-3 py-2.5 rounded-xl font-bold text-sm bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25 transition-all whitespace-nowrap">
                📅 عرض سجل المصاريف
              </button>
            </div>
          </div>
        )
      ) : financeMode === "log" ? (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-8 text-center space-y-2">
          <div className="text-4xl mb-1">📒</div>
          <div className="text-sm text-slate-400">سجل المعاملات — اختر اليوم من النافذة اللي فتحت</div>
          <button onClick={() => setDayReportOpen(true)} className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 hover:bg-blue-500/20">
            📅 فتح سجل المصاريف
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-slate-400 font-bold">
              {financeMode === "late" ? "⏰ المتأخرين في السداد" : "🗓️ تسجيل الشهور الماضية"}
            </div>
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

          {financeMode === "past" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="الشهر">
                <select value={regMonth} onChange={e => setRegMonth(parseInt(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                  {MONTHS_AR.map((m, i) => <option key={i + 1} value={i + 1}>{i + 1} - {m}</option>)}
                </select>
              </Field>
              <Field label="السنة">
                <input type="number" value={regYear} onChange={e => setRegYear(e.target.value ? parseInt(e.target.value) : curYear)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center" />
              </Field>
            </div>
          )}
        </div>
      )}

      {tableOpen && selGrade && financeMode === "late" && (
        adminLateStudents.length === 0
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
                    {adminLateStudents.map(({ student, count, currentMonthOverdue, overdueMonths }) => (
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
      )}

      {tableOpen && selGrade && financeMode !== "late" && (
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
                        {["اسم الطالب","المستلم","وقت التسجيل","المبلغ (ج)","تعديل","طباعة","تراجع"].map(h => (
                          <th key={h} className="px-3 py-3 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "11px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableStudents.map((s, i) => (
                        <FinRow
                          key={s.id} student={s} index={i} record={getRecord(s.id)}
                          globalReceiver={globalReceiver} activeReceivers={activeReceivers}
                          onSave={handleSave} onUndo={handleUndo}
                          passwordEnabled={safeSettings.financePasswordEnabled}
                          financePassword={safeSettings.financePassword}
                          undoPassword={safeSettings.financeUndoPassword}
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
      {financeMode !== "current" && !tableOpen && selGrade && <div className="text-center py-6 text-slate-600 text-sm">اضغط "عرض السجل" لفتح الجدول</div>}
      {financeMode !== "current" && !selGrade && <div className="text-center py-10 text-slate-600"><div className="text-5xl mb-3">💰</div><div className="text-sm">اختر الصف للبدء</div></div>}

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
