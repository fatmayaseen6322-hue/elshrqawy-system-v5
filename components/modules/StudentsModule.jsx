import { useState, useEffect, useCallback } from "react";
import { GRADES_LIST, GROUPS_MAP, TODAY } from "../../constants";
import { pct, fmt, genSID, waLink } from "../../utils";
import { Av, Bar, Toast, Field, Inp, Sel, Btn, DatePicker, StatusBar } from "../ui";
import ImportStudentsModal from "./ImportStudentsModal";

// ══════════════════════════════════════════════════════════════
// MODULE 2: STUDENTS
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// SCORE HISTORY MINI CHART (#8) — تطور درجات الطالب
// ══════════════════════════════════════════════════════════════
function ScoreHistoryChart({ student }) {
  const history = student?.scoreHistory || [];
  if (history.length < 2) return null;
  const maxVal = Math.max(...history.map(h => h.score), 100);
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--card-bg, #1e293b)", border: "1px solid var(--border, #334155)" }}>
      <div className="text-xs font-bold mb-2" style={{ color: "var(--text-muted, #64748b)" }}>📈 تطور الدرجات</div>
      <div className="flex items-end gap-1 h-14">
        {history.map((h, i) => {
          const ratio = h.score / maxVal;
          const color = h.score >= 85 ? "#10b981" : h.score >= 65 ? "#3b82f6" : h.score >= 50 ? "#f59e0b" : "#ef4444";
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="rounded-t" style={{ width: "100%", height: `${Math.max(ratio * 48, 4)}px`, background: color }} />
              <div style={{ fontSize: "8px", color: "var(--text-muted, #64748b)" }}>{h.label || `#${i+1}`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentsModule({ students, setStudents, jumpTo, onJumpDone, addActivity }) {
  const [step, setStep] = useState("select");
  const [grade, setGrade] = useState(GRADES_LIST[2]);
  const [group, setGroup] = useState("A");
  const [date, setDate] = useState(TODAY);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (jumpTo) {
      // jumpTo دلوقتي عبارة عن id بس (مش الكائن كامل) — نجيب أحدث نسخة
      // من بيانات الطالب من `students` نفسها، عشان لو الطالب اتعدّل
      // من مكان تاني قبل ما نوصل هنا، الـ profile يعرض القيم الحالية.
      const fresh = (students || []).find(st => st.id === jumpTo);
      if (fresh) { setSel(fresh); setStep("profile"); }
      onJumpDone?.();
    }
  }, [jumpTo, students]);

  const stCfg = {
    active:   { l: "نشط",   bg: "bg-emerald-500/20", t: "text-emerald-400" },
    temp:     { l: "مؤقت",  bg: "bg-amber-500/20",   t: "text-amber-400"   },
    inactive: { l: "موقوف", bg: "bg-red-500/20",     t: "text-red-400"     },
  };

  // ── SELECT step ────────────────────────────────────────────
  if (step === "select") {
    const grpList = GROUPS_MAP[grade] || ["A"];
    const ready = grade && group && date;
    return (
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <div className="text-2xl">📋</div>
          <div className="text-white font-black text-base">اختر الصف والمجموعة والتاريخ</div>
          <div className="text-slate-500 text-xs">يجب اختيار الثلاثة لتفعيل الأقسام</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-4">
          <Field label="الصف الدراسي">
            <Sel value={grade} onChange={e => { setGrade(e.target.value); setGroup(GROUPS_MAP[e.target.value]?.[0] || "A"); }}>
              {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
            </Sel>
          </Field>
          <Field label="المجموعة">
            <div className="flex gap-2">
              {grpList.map(g => (
                <button key={g} onClick={() => setGroup(g)}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${group === g ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-900/50 border-slate-700/40 text-slate-400 hover:border-blue-500/40"}`}>
                  مجموعة {g}
                </button>
              ))}
            </div>
          </Field>
          <Field label="التاريخ"><DatePicker value={date} onChange={setDate} max={TODAY} /></Field>
        </div>
        <Btn variant="primary" size="lg" className="w-full" disabled={!ready} onClick={() => setStep("section")}>
          {ready ? "✓ متابعة — اختيار القسم" : "اختر الصف والمجموعة والتاريخ أولاً"}
        </Btn>
      </div>
    );
  }

  // ── SECTION step ───────────────────────────────────────────
  if (step === "section") {
    const grpStudents = students.filter(s => s.grade === grade && s.group === group);
    const sections = [
      { key: "errors",     icon: "🟥", label: "الأخطاء",    sub: "عرض وإدارة أخطاء الطلاب" },
      { key: "correction", icon: "🟦", label: "التصحيح",    sub: "تصحيح الأوراق والمراجعة" },
      { key: "exams",      icon: "📝", label: "الامتحانات", sub: "نتائج وإحصائيات الامتحانات" },
      { key: "web",        icon: "🌐", label: "الويب",       sub: "اختبارات ونماذج إلكترونية" },
    ];
    return (
      <div className="space-y-4">
        <button onClick={() => setStep("select")} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← تعديل الاختيار</button>
        <StatusBar grade={grade} group={group} date={date} />
        <div className="text-white font-black text-sm mt-2">اختر القسم</div>
        <div className="grid grid-cols-2 gap-3">
          {sections.map(s => (
            <button key={s.key} onClick={() => setStep(s.key)}
              className="bg-slate-800/70 border border-slate-700/40 hover:border-blue-500/50 hover:bg-slate-800 rounded-2xl p-4 text-right transition-all group">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-white font-bold text-sm group-hover:text-blue-300">{s.label}</div>
              <div className="text-slate-500 text-xs mt-0.5">{s.sub}</div>
            </button>
          ))}
        </div>
        <div className="border-t border-slate-800 pt-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-slate-400 text-xs font-medium">طلاب {grade} — مجموعة {group} ({grpStudents.length})</span>
            <div className="flex gap-2">
              <Btn size="sm" variant="ghost" onClick={() => setShowImport(true)}>📥 استيراد من ملف</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setStep("add")}>+ طالب</Btn>
            </div>
          </div>
          <div className="space-y-2">
            {grpStudents.slice(0, 5).map(s => {
              const cfg = stCfg[s.status] || stCfg.active;
              return (
                <button key={s.id} onClick={() => { setSel(s); setStep("profile"); }}
                  className="w-full bg-slate-800/50 border border-slate-700/30 rounded-xl px-3 py-2.5 flex items-center gap-3 hover:bg-slate-800 transition-colors">
                  <Av name={s.name} size="sm" />
                  <div className="flex-1 text-right min-w-0">
                    <div className="text-white text-xs font-bold truncate">{s.name}</div>
                    <div className="text-slate-500" style={{ fontSize: "10px" }}>{s.id}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.t} shrink-0`}>{s.score}%</span>
                </button>
              );
            })}
            {grpStudents.length > 5 && <div className="text-center text-slate-600 text-xs py-1">+ {grpStudents.length - 5} آخرين</div>}
          </div>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        {showImport && (
          <ImportStudentsModal
            onClose={() => setShowImport(false)}
            onImport={(newStudents) => {
              setStudents(prev => [...newStudents, ...prev]);
              addActivity?.(`استيراد ${newStudents.length} طالب من ملف`);
              setToast({ msg: `✓ تم استيراد ${newStudents.length} طالب بنجاح`, type: "success" });
              setShowImport(false);
            }}
          />
        )}
      </div>
    );
  }

  // ── Placeholder sub-sections ───────────────────────────────
  if (["errors","correction","exams","web"].includes(step)) {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep("section")} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
        <StatusBar grade={grade} group={group} date={date} />
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">{step === "errors" ? "🟥" : step === "correction" ? "🟦" : step === "exams" ? "📝" : "🌐"}</div>
          <div className="text-white font-bold">{step === "errors" ? "الأخطاء" : step === "correction" ? "التصحيح" : step === "exams" ? "الامتحانات" : "الويب"}</div>
          <div className="text-slate-500 text-sm mt-1">قريباً</div>
        </div>
      </div>
    );
  }

  // ── PROFILE step ───────────────────────────────────────────
  if (step === "profile" && sel) {
    const s = sel;
    const due = s.totalFees - s.paid;
    return (
      <div className="space-y-4">
        <button onClick={() => { setStep("section"); setSel(null); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
        <StatusBar grade={grade} group={group} date={date} />
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex gap-4 items-center">
            <Av name={s.name} size="lg" />
            <div className="flex-1">
              <div className="text-white font-black text-base">{s.name}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.grade} · مجموعة {s.group} · {s.id}</div>
              <span className={`mt-1.5 inline-block text-xs px-2.5 py-0.5 rounded-full ${stCfg[s.status]?.bg} ${stCfg[s.status]?.t}`}>{stCfg[s.status]?.l}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="bg-slate-900/50 rounded-xl p-3"><div className="text-slate-400 text-xs">هاتف</div><div className="text-white text-sm">{s.phone}</div></div>
            <div className="bg-slate-900/50 rounded-xl p-3"><div className="text-slate-400 text-xs">ولي الأمر</div><div className="text-white text-sm">{s.parentName}</div><div className="text-slate-500 text-xs">{s.parentPhone}</div></div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { l: "الحضور", v: `${pct(s.present, s.total)}%`, ok: pct(s.present, s.total) >= 80 },
              { l: "المستوى", v: `${s.score}%`, ok: s.score >= 65 },
              { l: "السداد", v: `${pct(s.paid, s.totalFees)}%`, ok: due === 0 }
            ].map(x => (
              <div key={x.l} className="bg-slate-900/50 rounded-xl p-2.5 text-center">
                <div className={`font-black text-lg ${x.ok ? "text-emerald-400" : "text-amber-400"}`}>{x.v}</div>
                <div className="text-xs text-slate-500">{x.l}</div>
              </div>
            ))}
          </div>
          {s.weak?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.weak.map(w => <span key={w} className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400">ضعيف في {w}</span>)}
            </div>
          )}
          <ScoreHistoryChart student={s} />
        </div>
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-white font-bold text-sm">💰 المصاريف</span>
            {due > 0 && <Btn size="sm" variant="success" onClick={() => setStep("pay")}>+ دفعة</Btn>}
          </div>
          <Bar value={s.paid} max={s.totalFees} color={due === 0 ? "#10b981" : s.paid === 0 ? "#ef4444" : "#f59e0b"} h="h-2.5" />
          <div className="flex justify-between text-xs">
            <span>مدفوع: <span className="text-emerald-400 font-bold">{fmt(s.paid)}</span></span>
            <span>متبقي: <span className={`font-bold ${due > 0 ? "text-red-400" : "text-slate-500"}`}>{fmt(due)}</span></span>
          </div>
          {due === 0 && <div className="text-emerald-400 text-xs text-center py-1">✓ تم السداد الكامل</div>}
          {s.payments?.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="text-xs text-slate-500 font-medium">سجل الدفعات</div>
              {[...s.payments].reverse().map(p => (
                <div key={p.id} className="flex justify-between items-center text-xs bg-slate-900/50 rounded-lg px-3 py-2">
                  <span className="text-slate-400">{p.date} · {p.method === "cash" ? "💵 كاش" : "🏦 تحويل"}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="text-emerald-400 font-bold">{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setStep("edit")}>✏️ تعديل</Btn>
          <button onClick={() => { const url = waLink(s.parentPhone); if (url) window.open(url, "_blank"); }}
            className="w-10 h-10 rounded-xl bg-green-700/30 border border-green-600/20 text-green-400 flex items-center justify-center text-lg">💬</button>
          <button onClick={() => setConfirmDel(s)}
            className="w-10 h-10 rounded-xl bg-red-700/20 border border-red-600/20 text-red-400 flex items-center justify-center">🗑</button>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        {confirmDel && (
          <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs space-y-4">
              <div className="text-white text-sm text-center">حذف {confirmDel.name}؟</div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm">إلغاء</button>
                <button onClick={() => { setStudents(p => p.filter(x => x.id !== confirmDel.id)); addActivity?.("حذف طالب", confirmDel.name); setConfirmDel(null); setStep("section"); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">حذف</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── ADD / EDIT steps ───────────────────────────────────────
  if (step === "add" || step === "edit") {
    return (
      <StudentFormSubmodule
        mode={step}
        student={step === "edit" ? sel : {}}
        defaultGrade={grade}
        defaultGroup={group}
        setStudents={setStudents}
        setSel={setSel}
        setToast={setToast}
        setStep={setStep}
        addActivity={addActivity}
      />
    );
  }

  // ── PAY step ───────────────────────────────────────────────
  if (step === "pay" && sel) {
    return (
      <StudentPaySubmodule
        student={sel}
        setSel={setSel}
        setStudents={setStudents}
        setToast={setToast}
        setStep={setStep}
      />
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// SUB: Student Form (Add / Edit)
// BUG FIX: removed local toast state — parent's setToast is used directly
// so Toast renders in the parent scope and actually shows.
// ══════════════════════════════════════════════════════════════
function StudentFormSubmodule({ mode, student: s, defaultGrade, defaultGroup, setStudents, setSel, setToast, setStep, addActivity }) {
  const [name,   setName]   = useState(s.name        || "");
  const [sg,     setSg]     = useState(s.grade        || defaultGrade);
  const [sgp,    setSgp]    = useState(s.group        || defaultGroup);
  const [phone,  setPhone]  = useState(s.phone        || "");
  const [pName,  setPName]  = useState(s.parentName   || "");
  const [pPhone, setPPhone] = useState(s.parentPhone  || "");
  const [fees,   setFees]   = useState(s.totalFees    || 2400);
  const [status, setStatus] = useState(s.status       || "active");
  const [weak,   setWeak]   = useState((s.weak || []).join("،"));
  const [err,    setErr]    = useState({});

  const save = useCallback(() => {
    const e = {};
    if (!name.trim())                        e.name   = "مطلوب";
    if (!phone.trim() || phone.length < 11)  e.phone  = "11 رقم";
    if (!pPhone.trim())                      e.pPhone = "مطلوب";
    setErr(e);
    if (Object.keys(e).length) return;

    const st = {
      id: s.id || genSID(),
      name: name.trim(), grade: sg, group: sgp, phone,
      parentName: pName, parentPhone: pPhone,
      joinDate: s.joinDate || TODAY, status,
      paid: s.paid || 0, totalFees: parseInt(fees) || 2400,
      score: s.score || 0, present: s.present || 0,
      absent: s.absent || 0, late: s.late || 0, total: s.total || 0,
      weak: weak ? weak.split(/[،,]/).map(x => x.trim()).filter(Boolean) : [],
    };

    if (mode === "add") setStudents(p => [st, ...p]);
    else                setStudents(p => p.map(x => x.id === st.id ? st : x));
    if (mode === "edit") setSel(st);

    // FIX: use parent's setToast directly — no local toast state needed
    setToast({ msg: mode === "add" ? `✓ تم تسجيل ${st.name}` : `✓ تم تعديل ${st.name}`, type: "success" });
    addActivity?.(mode === "add" ? "إضافة طالب" : "تعديل طالب", st.name);
    setStep(mode === "edit" ? "profile" : "section");
  }, [name, sg, sgp, phone, pName, pPhone, fees, status, weak, mode]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-white font-bold">{mode === "edit" ? "✏️ تعديل" : "👤 تسجيل طالب"}</h2>
        <button onClick={() => setStep(mode === "edit" ? "profile" : "section")} className="text-slate-400 text-xl">✕</button>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <Field label="الاسم الرباعي *" error={err.name}><Inp value={name} onChange={e => setName(e.target.value)} err={!!err.name} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الصف">
            <Sel value={sg} onChange={e => { setSg(e.target.value); setSgp(GROUPS_MAP[e.target.value]?.[0] || "A"); }}>
              {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
            </Sel>
          </Field>
          <Field label="المجموعة">
            <Sel value={sgp} onChange={e => setSgp(e.target.value)}>
              {(GROUPS_MAP[sg] || ["A"]).map(g => <option key={g}>{g}</option>)}
            </Sel>
          </Field>
        </div>
        <Field label="هاتف الطالب *" error={err.phone}><Inp value={phone} onChange={e => setPhone(e.target.value)} err={!!err.phone} /></Field>
        <Field label="نقاط الضعف"><Inp value={weak} onChange={e => setWeak(e.target.value)} placeholder="الجبر، الهندسة" /></Field>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <Field label="اسم ولي الأمر"><Inp value={pName} onChange={e => setPName(e.target.value)} /></Field>
        <Field label="هاتف ولي الأمر *" error={err.pPhone}><Inp value={pPhone} onChange={e => setPPhone(e.target.value)} err={!!err.pPhone} /></Field>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الرسوم (ج)"><Inp type="number" value={fees} onChange={e => setFees(e.target.value)} /></Field>
          <Field label="الحالة">
            <Sel value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">نشط</option>
              <option value="temp">مؤقت</option>
              <option value="inactive">موقوف</option>
            </Sel>
          </Field>
        </div>
      </div>
      <div className="flex gap-3">
        <Btn variant="ghost" size="lg" className="flex-1" onClick={() => setStep(mode === "edit" ? "profile" : "section")}>إلغاء</Btn>
        <Btn variant="primary" size="lg" className="flex-1" onClick={save}>{mode === "edit" ? "💾 حفظ" : "✓ تسجيل"}</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SUB: Payment
// ══════════════════════════════════════════════════════════════
function StudentPaySubmodule({ student: s, setSel, setStudents, setToast, setStep }) {
  const due = s.totalFees - s.paid;
  const [amount, setAmount] = useState(Math.min(600, due));
  const [method, setMethod] = useState("cash");
  const [dt,     setDt]     = useState(TODAY);
  const [note,   setNote]   = useState("");
  const [err,    setErr]    = useState("");

  const pay = () => {
    if (!amount || amount <= 0)  { setErr("أدخل مبلغاً"); return; }
    if (amount > due)            { setErr("المبلغ أكبر من المتبقي"); return; }
    const paid = parseInt(amount);
    const rec = { id: Date.now(), amount: paid, method, date: dt, note: note.trim() };
    setStudents(x => x.map(st => st.id === s.id
      ? { ...st, paid: st.paid + paid, payments: [...(st.payments || []), rec] }
      : st
    ));
    setSel(x => ({ ...x, paid: x.paid + paid, payments: [...(x.payments || []), rec] }));
    setToast({ msg: `✓ تم تسجيل ${fmt(paid)}`, type: "success" });
    setStep("profile");
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setStep("profile")} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center gap-3">
        <Av name={s.name} />
        <div className="flex-1"><div className="text-white font-bold">{s.name}</div><div className="text-slate-400 text-xs">{s.grade}</div></div>
        <div className="text-right"><div className="text-red-400 font-black">{fmt(due)}</div><div className="text-slate-500 text-xs">متبقي</div></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {[300, 600, 1200, due].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => (
          <button key={v} onClick={() => setAmount(v)} className={`px-4 py-2 rounded-xl text-xs font-bold ${amount === v ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
            {fmt(v)}{v === due ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div>
        <Inp type="number" value={amount} onChange={e => { setAmount(parseInt(e.target.value) || 0); setErr(""); }} className="text-2xl font-black text-center" />
        {err && <p className="text-red-400 text-xs text-center mt-1">{err}</p>}
      </div>
      <div className="flex gap-2">
        {[["cash","💵 كاش"],["transfer","🏦 تحويل"]].map(([k, v]) => (
          <button key={k} onClick={() => setMethod(k)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${method === k ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}>{v}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="التاريخ"><Inp type="date" value={dt} onChange={e => setDt(e.target.value)} max={TODAY} /></Field>
        <Field label="ملاحظة"><Inp value={note} onChange={e => setNote(e.target.value)} placeholder="قسط..." /></Field>
      </div>
      <Btn variant="success" size="lg" className="w-full" onClick={pay}>💾 تسجيل {fmt(parseInt(amount) || 0)}</Btn>
    </div>
  );
}
