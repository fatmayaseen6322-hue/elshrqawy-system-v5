import { useState, useRef } from "react";
import { waLink, checkPwd, hashPwdStored } from "../../utils";
import { TODAY, GRADES_LIST } from "../../constants";
import { INIT_STUDENTS } from "../../data";
import { Field, Inp, Sel, Btn, Toggle, Toast } from "../ui";
import { PrinterResetButton } from "../ui/PrinterPickerModal";

// ══════════════════════════════════════════════════════════════
// MODULE 7: SETTINGS
// ══════════════════════════════════════════════════════════════
// ADMIN PASSWORD GATE — لحماية تعديل رسم صف معتمد من قبل
// ══════════════════════════════════════════════════════════════
function AdminPasswordGate({ title = "🔑 صلاحية المستر", adminHash, onUnlock, onCancel }) {
  const [pw, setPw]     = useState("");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await checkPwd(pw, adminHash);
    setBusy(false);
    if (ok) onUnlock();
    else setErr("كلمة مرور المستر غير صحيحة");
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs space-y-4" onClick={e => e.stopPropagation()}>
        <div className="text-white font-black text-sm text-center">{title}</div>
        <div className="text-slate-400 text-xs text-center">هذا الإجراء يتطلب كلمة مرور المستر</div>
        <input
          ref={inputRef} type="password" value={pw} autoFocus
          onChange={e => { setPw(e.target.value); setErr(""); }}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          className={`w-full bg-slate-800/80 border ${err ? "border-red-500" : "border-slate-700/50"} rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center tracking-widest text-lg`}
          placeholder="••••" />
        {err && <div className="text-red-400 text-xs text-center">⚠️ {err}</div>}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium">إلغاء</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold">{busy ? "جارٍ التحقق…" : "✓ دخول"}</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ msg, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs space-y-4">
        <div className="text-white text-sm text-center">{msg}</div>
        <div className="flex gap-2">
          <button onClick={onCancel}  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">تأكيد</button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsModule({ settings, setSettings, students, setStudents, finRecords, setFinRecords, webExams, setWebExams, centerExams, setCenterExams, examQs, setExamQs, cloudBackupState, backupToCloud, restoreFromCloud, addActivity, onClose }) {
  const [confirmModal, setConfirmModal] = useState(null);
  const [view, setView] = useState("main");
  const [toast, setToast] = useState(null);
  const [cn, setCn] = useState(settings.centerName);
  const [ap, setAp] = useState(settings.adminPhone);
  const [oldP, setOldP] = useState(""); const [newP, setNewP] = useState(""); const [confP, setConfP] = useState(""); const [pErr, setPErr] = useState("");
  const [notifs, setNotifs] = useState({ ...settings.notifs });
  const [waList, setWaList] = useState([...settings.waNumbers]);
  const [newNum, setNewNum] = useState(""); const [newType, setNewType] = useState("admin"); const [newLabel, setNewLabel] = useState("");
  const logoRef = useRef(null); const bgRef = useRef(null); const importRef = useRef(null);

  // ── إدخال رسم الصف الشهري (كل صف) — منقولة من صفحة المصاريف ──
  const [feeGrade,    setFeeGrade]    = useState("");
  const [feeAmount,   setFeeAmount]   = useState("");
  const [feeUnlocked, setFeeUnlocked] = useState(false);
  const [showFeePw,   setShowFeePw]   = useState(false);
  const feeAmountRef = useRef(null);
  const feeLocked = (settings.gradeFees?.[feeGrade] || 0) > 0 && !feeUnlocked;

  const openFeeGrade = g => {
    setFeeGrade(g);
    setFeeUnlocked(false);
    setFeeAmount(settings.gradeFees?.[g] ? String(settings.gradeFees[g]) : "");
    setTimeout(() => feeAmountRef.current?.focus(), 50);
  };
  const requestFeeEdit = () => setShowFeePw(true);
  const unlockFeeEdit  = () => { setShowFeePw(false); setFeeUnlocked(true); };
  const saveFee = () => {
    if (!feeGrade || feeAmount === "") return;
    setSettings(prev => ({ ...(prev || {}), gradeFees: { ...(prev?.gradeFees || {}), [feeGrade]: parseInt(feeAmount) || 0 } }));
    addActivity?.("رسوم صف", `${feeGrade} — ${feeAmount} ج`);
    setToast({ msg: `✓ تم حفظ رسم ${feeGrade}`, type: "success" });
    setFeeUnlocked(false);
  };

  const save = (field, val, msg = "✓ تم الحفظ") => { setSettings(s => ({ ...s, [field]: val })); setToast({ msg, type: "success" }); };
  const handleImg = (e, field, label) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setToast({ msg: "الملف أكبر من 5MB", type: "error" }); return; }
    const r = new FileReader(); r.onload = ev => { save(field, ev.target.result, `✓ تم رفع ${label}`); }; r.readAsDataURL(f); e.target.value = "";
  };
  const changePwd = async () => {
    if (!oldP) { setPErr("أدخل كلمة المرور الحالية"); return; }
    const ok = await checkPwd(oldP, settings.password);
    if (!ok) { setPErr("كلمة المرور غير صحيحة"); return; }
    if (newP.length < 6) { setPErr("6 أحرف على الأقل"); return; }
    if (newP !== confP) { setPErr("غير متطابقة"); return; }
    const hashed = await hashPwdStored(newP);
    save("password", hashed, "✓ تم تغيير كلمة المرور"); setOldP(""); setNewP(""); setConfP(""); setPErr(""); setView("main");
  };
  const changeRolePwd = async (roleKey, pwdKey, newVal, confirmVal, setErrFn) => {
    if (newVal.length < 4) { setErrFn("4 أحرف على الأقل"); return; }
    if (newVal !== confirmVal) { setErrFn("غير متطابقة"); return; }
    const hashed = await hashPwdStored(newVal);
    save(pwdKey, hashed, `✓ تم تغيير كلمة مرور ${roleKey}`); setErrFn(""); setView("main");
  };
  const addWa = () => {
    if (!newNum || newNum.length < 11) { setToast({ msg: "رقم غير صحيح", type: "error" }); return; }
    const n = { id: Date.now(), number: newNum, type: newType, label: newLabel || newType };
    const u = [...waList, n]; setWaList(u); save("waNumbers", u, "✓ تم إضافة الرقم"); setNewNum(""); setNewLabel("");
  };
  const delWa = id => { const u = waList.filter(w => w.id !== id); setWaList(u); save("waNumbers", u, "تم الحذف"); };
  const exportData = () => {
    const d = JSON.stringify({ students, settings, finRecords, webExams, centerExams, examQs, date: new Date().toISOString() }, null, 2);
    const b = new Blob([d], { type: "application/json" }); const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = `elshrqawy-${TODAY}.json`; a.click(); URL.revokeObjectURL(u);
    setToast({ msg: "✓ تم التصدير", type: "success" });
  };
  const importData = e => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        const summary = [
          d.students    ? `${d.students.length} طالب` : null,
          d.finRecords  ? `${d.finRecords.length} سجل مالي` : null,
          d.webExams    ? `${d.webExams.length} امتحان` : null,
          d.examQs      ? `${d.examQs.length} سؤال` : null,
        ].filter(Boolean).join(" · ");
        setConfirmModal({
          msg: `سيتم استبدال كل البيانات الحالية بـ:\n${summary}\n\nلا يمكن التراجع عن هذه العملية.`,
          onConfirm: () => {
            if (d.students)    setStudents(d.students);
            if (d.settings)    setSettings(d.settings);
            if (d.finRecords)  setFinRecords(d.finRecords);
            if (d.webExams)    setWebExams(d.webExams);
            if (d.centerExams) setCenterExams(d.centerExams);
            if (d.examQs)      setExamQs(d.examQs);
            setConfirmModal(null);
            setToast({ msg: "✓ تم الاستيراد", type: "success" });
          },
        });
      }
      catch { setToast({ msg: "ملف غير صحيح أو تالف", type: "error" }); }
    }; r.readAsText(f); e.target.value = "";
  };
  const Back = () => <button onClick={() => setView("main")} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-5">← رجوع</button>;
  const menu = [
    { i: "🏫", l: "اسم السنتر",         d: settings.centerName,              v: "center"        },
    { i: "🔑", l: "كلمة مرور المدير",    d: "••••••••",                       v: "password"      },
    { i: "💰", l: "كلمة مرور المحصّل",  d: settings.cashierPassword ? "✓ مُعيَّنة" : "⚠️ غير مُعيَّنة", v: "cashierpwd"  },
    { i: "📚", l: "كلمة مرور المدرّس",  d: settings.teacherPassword ? "✓ مُعيَّنة" : "⚠️ غير مُعيَّنة", v: "teacherpwd"  },
    { i: "🖼️", l: "شعار السنتر",        d: settings.logo ? "✓ تم الرفع" : "لم يُرفع", v: "logo" },
    { i: "🎨", l: "صورة الخلفية",       d: settings.bg   ? "✓ تم الرفع" : "لم تُرفع", v: "bg"   },
    { i: "💵", l: "ادخل المصاريف كل صف", d: "رسوم الصفوف الشهرية",             v: "classfees"     },
    { i: "📱", l: "أرقام الواتساب",     d: `${waList.length} أرقام`,          v: "whatsapp"      },
    { i: "🔔", l: "الإشعارات",          d: "تفضيلات",                         v: "notifs"        },
    { i: "💾", l: "النسخ الاحتياطي",    d: "تصدير / استيراد",                v: "backup"        },
    { i: "ℹ️", l: "عن النظام",          d: "v9.0",                            v: "about"         },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-3xl z-10">
          <span className="text-white font-black text-base">⚙️ {view === "main" ? "الإعدادات" : menu.find(m => m.v === view)?.l || ""}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-xl">✕</button>
        </div>
        <div className="p-5">
          {view === "main" && (
            <div className="space-y-1">
              {menu.map(item => (
                <button key={item.v} onClick={() => setView(item.v)} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-slate-800 transition-colors text-right">
                  <span className="text-2xl w-8 text-center shrink-0">{item.i}</span>
                  <div className="flex-1 min-w-0"><div className="text-slate-100 text-sm font-medium">{item.l}</div><div className="text-slate-500 text-xs truncate">{item.d}</div></div>
                  <span className="text-slate-600 shrink-0">←</span>
                </button>
              ))}
            </div>
          )}
          {view === "center" && <><Back /><div className="space-y-4"><Field label="اسم السنتر"><Inp value={cn} onChange={e => setCn(e.target.value)} /></Field><Field label="هاتف الإدارة"><Inp value={ap} onChange={e => setAp(e.target.value)} /></Field><Btn variant="primary" size="lg" className="w-full" onClick={() => { save("centerName", cn); save("adminPhone", ap, "✓ تم حفظ البيانات"); }}>💾 حفظ</Btn></div></>}
          {view === "password" && (() => { const [cp, setCp] = useState(""); const [np, setNp] = useState(""); const [cf, setCf] = useState(""); const [er, setEr] = useState(""); return <><Back /><div className="space-y-4"><Field label="كلمة المرور الحالية"><Inp type="password" value={oldP} onChange={e => { setOldP(e.target.value); setPErr(""); }} /></Field><Field label="الجديدة"><Inp type="password" value={newP} onChange={e => { setNewP(e.target.value); setPErr(""); }} /></Field><Field label="تأكيد"><Inp type="password" value={confP} onChange={e => { setConfP(e.target.value); setPErr(""); }} /></Field>{pErr && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-sm">⚠️ {pErr}</div>}<Btn variant="primary" size="lg" className="w-full" onClick={changePwd}>🔑 تغيير كلمة مرور المدير</Btn></div></>; })()}
          {view === "cashierpwd" && (() => { const [np, setNp] = useState(""); const [cf, setCf] = useState(""); const [er, setEr] = useState(""); return <><Back /><div className="space-y-4"><div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-amber-400 text-xs">💰 كلمة مرور المحصّل — تُستخدم عند دخول دور المحصّل</div><Field label="كلمة المرور الجديدة"><Inp type="password" value={np} onChange={e => { setNp(e.target.value); setEr(""); }} /></Field><Field label="تأكيد"><Inp type="password" value={cf} onChange={e => { setCf(e.target.value); setEr(""); }} /></Field>{er && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-sm">⚠️ {er}</div>}<Btn variant="primary" size="lg" className="w-full" onClick={() => changeRolePwd("المحصّل","cashierPassword",np,cf,setEr)}>💾 حفظ كلمة مرور المحصّل</Btn></div></>; })()}
          {view === "teacherpwd" && (() => { const [np, setNp] = useState(""); const [cf, setCf] = useState(""); const [er, setEr] = useState(""); return <><Back /><div className="space-y-4"><div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-emerald-400 text-xs">📚 كلمة مرور المدرّس — تُستخدم عند دخول دور المدرّس</div><Field label="كلمة المرور الجديدة"><Inp type="password" value={np} onChange={e => { setNp(e.target.value); setEr(""); }} /></Field><Field label="تأكيد"><Inp type="password" value={cf} onChange={e => { setCf(e.target.value); setEr(""); }} /></Field>{er && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-sm">⚠️ {er}</div>}<Btn variant="primary" size="lg" className="w-full" onClick={() => changeRolePwd("المدرّس","teacherPassword",np,cf,setEr)}>💾 حفظ كلمة مرور المدرّس</Btn></div></>; })()}
          {view === "logo" && <><Back /><div className="space-y-4">{settings.logo ? <div className="text-center space-y-3"><img src={settings.logo} alt="logo" className="w-28 h-28 rounded-2xl object-cover mx-auto border-2 border-blue-500/30" /><div className="text-slate-400 text-xs">الشعار الحالي</div></div> : <div className="border-2 border-dashed border-slate-700/60 rounded-2xl p-10 text-center"><div className="text-5xl mb-3">🏫</div><div className="text-slate-500 text-sm">لم يُرفع شعار بعد</div></div>}<input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e => handleImg(e, "logo", "الشعار")} /><Btn variant="primary" size="lg" className="w-full" onClick={() => logoRef.current?.click()}>📤 {settings.logo ? "استبدال" : "رفع شعار"}</Btn>{settings.logo && <Btn variant="danger" size="lg" className="w-full" onClick={() => save("logo", null, "تم حذف الشعار")}>🗑 حذف</Btn>}</div></>}
          {view === "bg" && <><Back /><div className="space-y-4">{settings.bg && settings.bg.startsWith("data:") ? <div className="text-center space-y-2"><img src={settings.bg} alt="bg" className="w-full h-36 rounded-2xl object-cover border border-slate-700/50" /><div className="text-slate-400 text-xs">الخلفية الحالية</div></div> : <div className="border-2 border-dashed border-slate-700/60 rounded-2xl p-8 text-center"><div className="text-4xl mb-2">🎨</div><div className="text-slate-500 text-sm">لم تُرفع صورة</div></div>}<div className="space-y-2"><div className="text-xs text-slate-400 font-medium">ألوان جاهزة</div><div className="grid grid-cols-5 gap-2">{["#0f172a","#1e1b4b","#0c4a6e","#14532d","#1c1917"].map(c => <button key={c} onClick={() => save("bg", c, "✓ تم تغيير اللون")} className={`h-10 rounded-xl border-2 transition-colors ${settings.bg === c ? "border-white/60" : "border-slate-700/50 hover:border-white/20"}`} style={{ backgroundColor: c }} />)}</div></div><input ref={bgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => handleImg(e, "bg", "الخلفية")} /><Btn variant="primary" size="lg" className="w-full" onClick={() => bgRef.current?.click()}>📤 رفع صورة خلفية</Btn>{settings.bg && <Btn variant="ghost" size="lg" className="w-full" onClick={() => save("bg", null, "تمت الإزالة")}>↩ إزالة</Btn>}</div></>}
          {view === "classfees" && (
            <>
              <Back />
              <div className="bg-slate-800/50 border border-slate-700/30 rounded-2xl p-4 space-y-3">
                <Field label="الصف">
                  <select value={feeGrade} onChange={e => openFeeGrade(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    <option value="">— اختر الصف —</option>
                    {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label={feeLocked ? "الرسم (معتمد 🔒)" : "قيمة الرسم"}>
                  <div className="flex gap-2">
                    <input
                      ref={feeAmountRef} type="number" value={feeAmount} disabled={!feeGrade || feeLocked}
                      onChange={e => setFeeAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !feeLocked) saveFee(); }}
                      placeholder="مثال: 500"
                      className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none disabled:opacity-50" />
                    {feeGrade && (feeLocked
                      ? <button onClick={requestFeeEdit} className="px-3 rounded-xl bg-blue-700/25 border border-blue-600/30 text-blue-300 text-sm hover:bg-blue-700/40">✏️</button>
                      : <button onClick={saveFee} disabled={feeAmount === ""} className="px-3 rounded-xl bg-emerald-700/30 border border-emerald-600/30 text-emerald-300 text-sm disabled:opacity-30 hover:bg-emerald-700/50">💾</button>)}
                  </div>
                </Field>
                {feeLocked && <div className="text-slate-500 text-xs text-center">هذا الرسم معتمد من قبل — أي تعديل يتطلب باسورد المستر.</div>}
              </div>
              {showFeePw && (
                <AdminPasswordGate title="🔑 تعديل رسم صف معتمد" adminHash={settings.password} onUnlock={unlockFeeEdit} onCancel={() => setShowFeePw(false)} />
              )}
            </>
          )}
          {view === "whatsapp" && <><Back /><div className="space-y-4"><div className="space-y-2">{waList.map(w => <div key={w.id} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3 flex items-center gap-3"><span className="text-xl">💬</span><div className="flex-1 min-w-0"><div className="text-white text-sm font-medium">{w.number}</div><div className="text-slate-500 text-xs">{w.label}</div></div><div className="flex gap-2"><button onClick={() => { const url = waLink(w.number); if (url) window.open(url, "_blank"); }} className="text-green-400 text-xs px-2 py-1 rounded-lg bg-green-700/20">اختبار</button><button onClick={() => delWa(w.id)} className="text-red-400 text-xs px-2 py-1 rounded-lg bg-red-700/20">حذف</button></div></div>)}</div><div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3"><div className="text-xs text-blue-400 font-bold">إضافة رقم</div><Field label="الرقم"><Inp value={newNum} onChange={e => setNewNum(e.target.value)} placeholder="01xxxxxxxxx" /></Field><div className="grid grid-cols-2 gap-2"><Field label="النوع"><Sel value={newType} onChange={e => setNewType(e.target.value)}><option value="admin">إدارة</option><option value="teacher">مدرس</option><option value="support">دعم</option></Sel></Field><Field label="اسم"><Inp value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="أ. محمود" /></Field></div><Btn variant="success" className="w-full" onClick={addWa}>+ إضافة</Btn></div></div></>}
          {view === "notifs" && <><Back /><div className="space-y-3">{[{k:"autoNotifs",l:"إشعارات تلقائية"},{k:"absenceAlert",l:"تنبيه الغياب"},{k:"feesAlert",l:"تنبيه المصاريف"},{k:"autoSave",l:"حفظ تلقائي"},{k:"scoreAlert",l:"تنبيه المستوى"}].map(s => <div key={s.k} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3.5 flex items-center justify-between"><span className="text-slate-200 text-sm">{s.l}</span><Toggle on={notifs[s.k] ?? true} onChange={v => { const n = { ...notifs, [s.k]: v }; setNotifs(n); save("notifs", n, `${s.l} ${v ? "✓ مفعّل" : "معطّل"}`); }} /></div>)}</div></>}
          {view === "backup" && <><Back /><div className="space-y-4"><div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4"><div className="text-blue-400 font-bold text-sm mb-1">💾 النسخ الاحتياطي</div><div className="text-slate-400 text-xs">احتفظ بنسخة من كل البيانات</div></div><Btn variant="primary" size="lg" className="w-full" onClick={exportData}>📤 تصدير البيانات (JSON)</Btn><div className="pt-1"><PrinterResetButton /></div><input ref={importRef} type="file" accept=".json" className="hidden" onChange={importData} /><Btn variant="ghost" size="lg" className="w-full" onClick={() => importRef.current?.click()}>📥 استيراد بيانات</Btn>{backupToCloud && <div className="border-t border-slate-800 pt-4 space-y-3"><div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4"><div className="text-violet-400 font-bold text-sm mb-1">☁️ نسخة سحابية (Firebase)</div><div className="text-slate-400 text-xs">التخزين الأساسي محلي دايمًا — الزرار ده بس بيرفع/يرجّع نسخة يدويًا لما تحتاجها (مثلاً عشان تنقل البيانات لجهاز تاني)</div></div><Btn variant="primary" size="lg" className="w-full" disabled={cloudBackupState?.status === "uploading"} onClick={backupToCloud}>{cloudBackupState?.status === "uploading" ? "⏳ جاري الرفع..." : "☁️ رفع نسخة على السحابة"}</Btn><Btn variant="ghost" size="lg" className="w-full" disabled={cloudBackupState?.status === "downloading"} onClick={() => setConfirmModal({ msg: "استرجاع النسخة السحابية هيستبدل كل البيانات الحالية على الجهاز ده. متأكد؟", onConfirm: () => { restoreFromCloud(); setConfirmModal(null); } })}>{cloudBackupState?.status === "downloading" ? "⏳ جاري الاسترجاع..." : "📥 استرجاع من السحابة"}</Btn>{cloudBackupState?.message && <div className={`text-xs text-center rounded-xl px-3 py-2 ${cloudBackupState.status === "error" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>{cloudBackupState.message}</div>}</div>}<div className="border-t border-slate-800 pt-4"><div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-3"><div className="text-red-400 font-bold text-sm">⚠️ منطقة الخطر</div><Btn variant="danger" className="w-full" onClick={() => setConfirmModal({ msg: "هل تريد إعادة تعيين بيانات الطلاب؟ لا يمكن التراجع.", onConfirm: () => { setStudents(INIT_STUDENTS); setConfirmModal(null); setToast({ msg: "✓ تم إعادة التعيين", type: "success" }); } })}>🗑 إعادة تعيين</Btn></div></div></div></>}
          {view === "about" && <><Back /><div className="space-y-4"><div className="text-center py-6"><div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 via-violet-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 text-4xl">🏫</div><div className="text-white font-black text-xl">Elshrqawy System</div><div className="text-slate-400 text-sm mt-1">نظام إدارة المراكز التعليمية</div><div className="text-blue-400 font-bold mt-2">الإصدار 9.0</div></div>{[{l:"الطلاب",v:`${students.length} طالب`},{l:"الوحدات",v:"7 وحدات + asal.ai"},{l:"آخر تحديث",v:TODAY}].map(x => <div key={x.l} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3 flex justify-between"><span className="text-slate-400 text-sm">{x.l}</span><span className="text-white font-bold text-sm">{x.v}</span></div>)}</div></>}
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        {confirmModal && <ConfirmModal msg={confirmModal.msg} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />}
      </div>
    </div>
  );
}
