import { useState, useEffect, useCallback, useMemo } from "react";
import { GRADES_LIST, GROUPS_MAP, TODAY, MONTHS_AR } from "../../constants";
import { pct, fmt, genSID, genStudentId, waLink } from "../../utils";
import { Av, Bar, Toast, Field, Inp, Sel, Btn, DatePicker, StatusBar } from "../ui";
import ImportStudentsModal from "./ImportStudentsModal";

// تطبيع الألف بأشكال الهمزة المختلفة عشان البحث ما يفرقش بين
// "احمد" و"أحمد" و"إحمد" و"آحمد" — نفس آلية البحث في صفحة الحضور
const normalizeAr = (str = "") => str.replace(/[أإآء]/g, "ا");

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

export default function StudentsModule({ students, setStudents, finRecords, jumpTo, onJumpDone, addActivity, startAdd, onDone }) {
  const [step, setStep] = useState(startAdd ? "add" : "select");
  const [grade, setGrade] = useState(GRADES_LIST[2]);
  const [group, setGroup] = useState("A");
  const [date, setDate] = useState(TODAY);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [blockReason, setBlockReason] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");

  // بحث عن طالب بالاسم في كل المجاميع والصفوف — بيوديك على طول لملفه
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = normalizeAr(search.trim());
    return (students || []).filter(s => s && normalizeAr(s.name || "").includes(q));
  }, [students, search]);

  const goToStudentDirect = s => {
    setSel(s);
    setStep("profile");
    setSearch("");
  };

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
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-3 space-y-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 دوّر على طالب بالاسم (في كل المجاميع)..."
            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" />
          {searchResults && (
            searchResults.length === 0
              ? <div className="text-center text-slate-500 text-xs py-3">مفيش طالب بهذا الاسم</div>
              : <div className="max-h-56 overflow-y-auto space-y-1">
                  {searchResults.map(s => (
                    <button key={s.id} onClick={() => goToStudentDirect(s)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/40 hover:bg-slate-700/50 text-right">
                      <Av name={s.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-white text-sm font-bold truncate">{s.name}</span>
                        </div>
                        <div className="text-slate-500 text-xs">{s.grade} — مجموعة {s.group}</div>
                      </div>
                    </button>
                  ))}
                </div>
          )}
        </div>

        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
          <div className="grid grid-cols-4 gap-2 items-stretch">
            <Sel value={grade} onChange={e => { setGrade(e.target.value); setGroup(GROUPS_MAP[e.target.value]?.[0] || "A"); }}>
              {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
            </Sel>
            <Sel value={group} onChange={e => setGroup(e.target.value)}>
              {grpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
            </Sel>
            <DatePicker value={date} onChange={setDate} max={TODAY} />
            <button onClick={() => ready && setStep("section")} disabled={!ready}
              className={`rounded-xl px-1 py-1 text-center border flex flex-col items-center justify-center gap-0.5 transition-all ${ready ? "border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30" : "border-slate-700/40 bg-slate-900/30 opacity-40 cursor-not-allowed"}`}>
              <span className="text-sm leading-none">✓</span>
              <span className={`text-[10px] font-bold leading-tight ${ready ? "text-blue-300" : "text-slate-500"}`}>متابعة اختيار القسم</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SECTION step ───────────────────────────────────────────
  if (step === "section") {
    const grpStudents = students.filter(s => s.grade === grade && s.group === group);
    return (
      <div className="space-y-4">
        <button onClick={() => setStep("select")} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← تعديل الاختيار</button>
        <StatusBar grade={grade} group={group} date={date} />
        <div className="border-t border-slate-800 pt-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-slate-400 text-xs font-medium">طلاب {grade} — مجموعة {group} ({grpStudents.length})</span>
            <div className="flex gap-2">
              <Btn size="sm" variant="ghost" onClick={() => setShowImport(true)}>📥 استيراد من ملف</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setStep("add")}>+ طالب</Btn>
            </div>
          </div>
          <div className="space-y-2">
            {grpStudents.map(s => {
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
            {grpStudents.length === 0 && <div className="text-center text-slate-600 text-xs py-4">مفيش طلاب في المجموعة دي</div>}
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

  // ── PROFILE step ───────────────────────────────────────────
  if (step === "profile" && sel) {
    const s = sel;
    const due = s.totalFees - s.paid;

    // حالة السداد الشهري الحقيقية (من finRecords — نفس نظام صفحة المصاريف)
    const [curYearStr, curMonthStr] = TODAY.split("-");
    const currentYearNum  = parseInt(curYearStr, 10);
    const currentMonthNum = parseInt(curMonthStr, 10);
    const [joinYearStr, joinMonthStr] = (s.joinDate || TODAY).split("-");
    const joinYearNum  = parseInt(joinYearStr, 10);
    const joinMonthNum = parseInt(joinMonthStr, 10);

    const studentFinRecords = (finRecords || []).filter(r => r.studentId === s.id);
    const isMonthPaid = (m, y) => studentFinRecords.some(r => r.month === m && r.year === y && (r.amount || 0) > 0);

    const currentMonthPaid = isMonthPaid(currentMonthNum, currentYearNum);

    const overdueMonths = [];
    const startMonth = (joinYearNum === currentYearNum) ? joinMonthNum : 1;
    for (let m = startMonth; m < currentMonthNum; m++) {
      if (!isMonthPaid(m, currentYearNum)) overdueMonths.push(m);
    }
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
            <span className="text-white font-bold text-sm">💰 المصاريف — حالة السداد الشهري</span>
          </div>
          <div className={`text-center py-2.5 rounded-xl text-sm font-bold border ${currentMonthPaid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
            {currentMonthPaid ? `✓ الشهر الحالي (${MONTHS_AR[currentMonthNum - 1]}) مدفوع` : `✗ الشهر الحالي (${MONTHS_AR[currentMonthNum - 1]}) غير مدفوع`}
          </div>
          {overdueMonths.length > 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-center">
              <div className="text-amber-400 text-xs font-bold mb-1">⚠️ شهور متأخرة</div>
              <div className="text-amber-300 text-sm font-black">{overdueMonths.join("، ")}</div>
            </div>
          ) : (
            <div className="text-emerald-400 text-xs text-center py-1">✓ لا يوجد شهور متأخرة</div>
          )}
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setStep("edit")}>✏️ تعديل</Btn>
          <button onClick={() => { const url = waLink(s.parentPhone); if (url) window.open(url, "_blank"); }}
            className="w-10 h-10 rounded-xl bg-green-700/30 border border-green-600/20 text-green-400 flex items-center justify-center text-lg">💬</button>
          <button onClick={() => setConfirmDel(s)}
            className="w-10 h-10 rounded-xl bg-red-700/20 border border-red-600/20 text-red-400 flex items-center justify-center">🚫</button>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        {confirmDel && (
          <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs space-y-4">
              <div className="text-white text-sm text-center">نقل {confirmDel.name} لقائمة البلوك؟</div>
              <div className="text-slate-500 text-xs text-center">هيتشال من القوائم النشطة، وتقدري تحذفيه نهائي أو ترجعيه من صفحة "بلوك"</div>
              <Field label="سبب البلوك (اختياري)">
                <input
                  value={blockReason} onChange={e => setBlockReason(e.target.value)}
                  placeholder="مثال: تأخر في السداد"
                  className="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" />
              </Field>
              <div className="flex gap-2">
                <button onClick={() => { setConfirmDel(null); setBlockReason(""); }} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm">إلغاء</button>
                <button onClick={() => {
                  const reason = blockReason.trim();
                  setStudents(p => p.map(x => x.id === confirmDel.id
                    ? { ...x, blocked: true, blockHistory: [...(x.blockHistory || []), { blockDate: TODAY, reason }] }
                    : x));
                  addActivity?.("نقل لبلوك", `${confirmDel.name} — يوم ${TODAY}${reason ? " — سبب: " + reason : ""}`);
                  setConfirmDel(null); setBlockReason(""); setStep("section");
                }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">نقل لبلوك</button>
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
        students={students}
        setStudents={setStudents}
        setSel={setSel}
        setToast={setToast}
        setStep={setStep}
        addActivity={addActivity}
        onDoneAdd={startAdd ? onDone : null}
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
function StudentFormSubmodule({ mode, student: s, defaultGrade, defaultGroup, students, setStudents, setSel, setToast, setStep, addActivity, onDoneAdd }) {
  const [name,   setName]   = useState(s.name        || "");
  const [sg,     setSg]     = useState(s.grade        || defaultGrade);
  const [sgp,    setSgp]    = useState(s.group        || defaultGroup);
  const [pPhone, setPPhone] = useState(s.parentPhone  || "");
  const [sPhone, setSPhone] = useState(s.phone        || "");
  const [fees,   setFees]   = useState(s.totalFees    || 2400);
  const [err,    setErr]    = useState({});

  // لو الصفحة دي اتفتحت مباشرة من "إضافة طالب" في الشريط الجانبي، بعد
  // الحفظ أو الإلغاء نرجع للمكان اللي جينا منه (onDoneAdd) بدل "section"
  const finishStep = () => {
    if (mode === "add" && onDoneAdd) { onDoneAdd(); return; }
    setStep(mode === "edit" ? "profile" : "section");
  };

  const save = useCallback(() => {
    const e = {};
    if (!name.trim())    e.name   = "مطلوب";
    if (!pPhone.trim())  e.pPhone = "مطلوب";
    setErr(e);
    if (Object.keys(e).length) return;

    const st = {
      id: s.id || genStudentId((students || []).map(x => x.id)),
      name: name.trim(), grade: sg, group: sgp,
      phone: sPhone.trim(), parentName: s.parentName || "", parentPhone: pPhone,
      joinDate: s.joinDate || TODAY, status: s.status || "active",
      paid: s.paid || 0, totalFees: parseInt(fees) || 2400,
      score: s.score || 0, present: s.present || 0,
      absent: s.absent || 0, late: s.late || 0, total: s.total || 0,
      weak: s.weak || [],
    };

    if (mode === "add") setStudents(p => [st, ...p]);
    else                setStudents(p => p.map(x => x.id === st.id ? st : x));
    if (mode === "edit") setSel(st);

    // FIX: use parent's setToast directly — no local toast state needed
    setToast({ msg: mode === "add" ? `✓ تم تسجيل ${st.name}` : `✓ تم تعديل ${st.name}`, type: "success" });
    addActivity?.(mode === "add" ? "إضافة طالب" : "تعديل طالب", st.name);
    if (mode === "edit") setStep("profile"); else finishStep();
  }, [name, sg, sgp, pPhone, sPhone, fees, mode, students]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-white font-bold">{mode === "edit" ? "✏️ تعديل" : "👤 تسجيل طالب"}</h2>
        <button onClick={finishStep} className="text-slate-400 text-xl">✕</button>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-[2] min-w-0">
            <Field label="الاسم الرباعي *" error={err.name}><Inp value={name} onChange={e => setName(e.target.value)} err={!!err.name} /></Field>
          </div>
          <div className="flex-1 min-w-0">
            <Field label="الصف">
              <Sel value={sg} onChange={e => { setSg(e.target.value); setSgp(GROUPS_MAP[e.target.value]?.[0] || "A"); }}>
                {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
              </Sel>
            </Field>
          </div>
          <div className="flex-1 min-w-0">
            <Field label="المجموعة">
              <Sel value={sgp} onChange={e => setSgp(e.target.value)}>
                {(GROUPS_MAP[sg] || ["A"]).map(g => <option key={g}>{g}</option>)}
              </Sel>
            </Field>
          </div>
          <div className="flex-1 min-w-0">
            <Field label="الرسوم (ج)"><Inp type="number" value={fees} onChange={e => setFees(e.target.value)} /></Field>
          </div>
        </div>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="هاتف ولي الأمر *" error={err.pPhone}><Inp value={pPhone} onChange={e => setPPhone(e.target.value)} err={!!err.pPhone} /></Field>
          <Field label="هاتف الطالب"><Inp value={sPhone} onChange={e => setSPhone(e.target.value)} /></Field>
        </div>
      </div>
      <div className="flex gap-3">
        <Btn variant="ghost" size="lg" className="flex-1" onClick={finishStep}>إلغاء</Btn>
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
