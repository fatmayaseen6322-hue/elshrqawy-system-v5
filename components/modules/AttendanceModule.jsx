import { useState, useMemo } from "react";
import { GRADES_LIST, GROUPS_MAP, TODAY } from "../../constants";
import { pct } from "../../utils";
import { Av, Sel, DatePicker, Toast, Modal, Field, Btn } from "../ui";

// تطبيع الألف بأشكال الهمزة المختلفة عشان البحث ما يفرقش بين
// "احمد" و"أحمد" و"إحمد" و"آحمد" (طلب: البحث يتجاهل الهمزة)
const normalizeAr = (str = "") => str.replace(/[أإآء]/g, "ا");

const genAttId = () => `AT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ══════════════════════════════════════════════════════════════
// PASSWORD GATE — لتعديل غياب يوم قديم (المستر فقط)
// ══════════════════════════════════════════════════════════════
function AttendancePasswordGate({ onUnlock, onCancel }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <Modal title="🔒 تعديل غياب يوم قديم" onClose={onCancel}>
      <div className="space-y-4">
        <div className="text-slate-400 text-sm text-center">
          التعديل على غياب يوم سابق يحتاج باسورد المستر
        </div>
        <Field label="باسورد المستر" error={err}>
          <input
            type="password" value={pw} autoFocus
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
// MODULE 1: ATTENDANCE
// attRecords + setAttRecords (زي finRecords بالظبط) — سجل غياب لكل
// طالب في كل يوم، عشان يبقى ممكن نرجع نعدّله بعدين بدل عدّادات
// تراكمية بس محدش يقدر يرجع يعدلها.
// ══════════════════════════════════════════════════════════════
export default function AttendanceModule({ students, setStudents, attRecords, setAttRecords, settings, role = "admin", addActivity }) {
  const [grade,     setGrade]     = useState(GRADES_LIST[2]);
  const [group,     setGroup]     = useState("A");
  const [date,      setDate]      = useState(TODAY);
  const [session,   setSession]   = useState({});
  const [toast,     setToast]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [pendingGate, setPendingGate] = useState(false);
  const [sessionOpened, setSessionOpened] = useState(false);

  const safeAttRecords = attRecords || [];
  const grpList     = GROUPS_MAP[grade] || ["A"];
  const grpStudents = useMemo(
    () => (students || []).filter(s => s && s.grade === grade && s.group === group),
    [students, grade, group]
  );

  // البحث في كل المجاميع/الصفوف — مش بس المجموعة المفتوحة حاليًا
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = normalizeAr(search.trim());
    return (students || []).filter(s => s && normalizeAr(s.name || "").includes(q));
  }, [students, search]);

  const goToStudent = s => {
    setGrade(s.grade);
    setGroup(s.group);
    setDate(TODAY);
    setSearch("");
  };

  // سجلات اليوم/المجموعة المختارة حاليًا من مصدر الحقيقة (attRecords)
  const recordsForSession = useMemo(
    () => safeAttRecords.filter(r => r.grade === grade && r.group === group && r.date === date),
    [safeAttRecords, grade, group, date]
  );
  const existingMap = useMemo(
    () => Object.fromEntries(recordsForSession.map(r => [r.studentId, r.status])),
    [recordsForSession]
  );
  const hasExistingSession = recordsForSession.length > 0;
  const isOldDate = date !== TODAY;

  const handleGradeChange = (g) => {
    setGrade(g);
    setGroup(GROUPS_MAP[g]?.[0] || "A");
    setSession({});
    setSessionOpened(false);
  };

  const handleGroupChange = (g) => {
    setGroup(g);
    setSession({});
    setSessionOpened(false);
  };

  const handleDateChange = (d) => {
    if (d > TODAY) {
      setToast({ msg: "لا يمكن اختيار تاريخ مستقبلي", type: "error" });
      return;
    }
    setDate(d);
    setSession({});
    setSessionOpened(false);
  };

  // فتح مجموعة/يوم: نبدأ الـ session بالحالات المسجَّلة فعلاً (لو موجودة)
  // عشان يظهروا جاهزين للتعديل. لازم نعلّم إنها "اتفتحت" صراحة، لأن لو
  // مفيش بيانات قديمة existingMap بتكون {} وميبقاش فيه فرق نعتمد عليه.
  const openSession = () => {
    setSession({ ...existingMap });
    setSessionOpened(true);
  };

  // Toggle: same status → deselect (يسمح بالتصحيح)
  const mark = (id, st) => setSession(prev => {
    if (prev[id] === st) { const n = { ...prev }; delete n[id]; return n; }
    return { ...prev, [id]: st };
  });

  const markAll = st => setSession(prev =>
    Object.fromEntries(grpStudents.map(s => [s.id, st]))
  );

  const marked = Object.keys(session).length;
  const counts = {
    p: Object.values(session).filter(v => v === "p").length,
    a: Object.values(session).filter(v => v === "a").length,
    l: Object.values(session).filter(v => v === "l").length,
  };

  // هل فيه تغيير فعلي عن الحالة المحفوظة؟
  const changedIds = useMemo(() => {
    const ids = new Set([...Object.keys(session), ...Object.keys(existingMap)]);
    return [...ids].filter(id => (session[id] || null) !== (existingMap[id] || null));
  }, [session, existingMap]);

  const applyDiffAndSave = () => {
    setAttRecords(prev => {
      let list = prev || [];
      changedIds.forEach(id => {
        const newStatus = session[id] || null;
        const idx = list.findIndex(r => r.studentId === id && r.date === date && r.grade === grade && r.group === group);
        if (newStatus) {
          const rec = { id: list[idx]?.id || genAttId(), studentId: id, grade, group, date, status: newStatus };
          list = idx >= 0 ? [...list.slice(0, idx), rec, ...list.slice(idx + 1)] : [...list, rec];
        } else if (idx >= 0) {
          list = list.filter((_, i) => i !== idx);
        }
      });
      return list;
    });

    setStudents(prev => (prev || []).map(s => {
      if (!changedIds.includes(s.id)) return s;
      const oldSt = existingMap[s.id] || null;
      const newSt = session[s.id] || null;
      let present = s.present || 0, absent = s.absent || 0, late = s.late || 0, total = s.total || 0;
      if (oldSt === "p") present--; if (oldSt === "a") absent--; if (oldSt === "l") late--;
      if (oldSt && !newSt) total--;
      if (newSt === "p") present++; if (newSt === "a") absent++; if (newSt === "l") late++;
      if (!oldSt && newSt) total++;
      return { ...s, present: Math.max(0, present), absent: Math.max(0, absent), late: Math.max(0, late), total: Math.max(0, total) };
    }));

    addActivity?.("تسجيل غياب", `${grade} - مجموعة ${group} - ${date} (${changedIds.length} طالب)`);
    setToast({ msg: `✓ تم حفظ غياب ${changedIds.length} طالب`, type: "success" });
    setPendingGate(false);
  };

  const saveSession = () => {
    if (changedIds.length === 0) {
      setToast({ msg: "لا يوجد تغييرات لحفظها", type: "error" });
      return;
    }
    // تعديل يوم قديم (مش النهارده) على سجلات موجودة بالفعل ← يحتاج باسورد المستر
    const editsExistingOldRecord = isOldDate && changedIds.some(id => existingMap[id]);
    if (editsExistingOldRecord) {
      setPendingGate(true);
      return;
    }
    applyDiffAndSave();
  };

  const unlockAndSave = (pw, setErr) => {
    if (pw && pw === settings?.password) {
      applyDiffAndSave();
    } else {
      setErr("باسورد المستر غير صحيح");
    }
  };

  const stCfg = {
    p: { label: "حاضر",  color: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-400", icon: "✓"  },
    a: { label: "غائب",  color: "bg-red-500",     border: "border-red-500",     text: "text-red-400",    icon: "✗"  },
    l: { label: "متأخر", color: "bg-amber-500",   border: "border-amber-500",   text: "text-amber-400",  icon: "⏰" },
  };

  return (
    <div className="space-y-4">
      {pendingGate && (
        <AttendancePasswordGate
          onUnlock={unlockAndSave}
          onCancel={() => setPendingGate(false)}
        />
      )}

      {/* بحث عن طالب في كل المجاميع/الصفوف */}
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
                  <button key={s.id} onClick={() => goToStudent(s)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/40 hover:bg-slate-700/50 text-right">
                    <Av name={s.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-bold truncate">{s.name}</div>
                      <div className="text-slate-500 text-xs">{s.grade} — مجموعة {s.group}</div>
                    </div>
                  </button>
                ))}
              </div>
        )}
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Sel value={grade} onChange={e => handleGradeChange(e.target.value)}>
              {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
            </Sel>
          </div>
          <Sel value={group} onChange={e => handleGroupChange(e.target.value)}>
            {grpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
          </Sel>
        </div>
        <DatePicker value={date} onChange={handleDateChange} max={TODAY} />
        {hasExistingSession && !isOldDate && (
          <div className="text-emerald-400 text-xs text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            ✓ تم تسجيل غياب اليوم — تقدر تعدّل عادي من غير باسورد
          </div>
        )}
        {hasExistingSession && isOldDate && (
          <div className="text-amber-400 text-xs text-center bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            🔒 ده يوم قديم — أي تعديل هيطلب باسورد المستر
          </div>
        )}
        {!hasExistingSession && !sessionOpened && (
          <button onClick={openSession} className="w-full py-2 rounded-xl text-xs font-bold bg-blue-600/20 border border-blue-600/30 text-blue-300">
            فتح تسجيل الغياب لهذا اليوم
          </button>
        )}
      </div>

      {(hasExistingSession || sessionOpened) && <>
      <div className="grid grid-cols-3 gap-2">
        {[{ k: "p", l: "حاضر", v: counts.p }, { k: "a", l: "غائب", v: counts.a }, { k: "l", l: "متأخر", v: counts.l }].map(x => (
          <div key={x.k} className={`rounded-xl py-3 text-center border ${stCfg[x.k].border}/30 ${stCfg[x.k].color}/10`}>
            <div className={`text-2xl font-black ${stCfg[x.k].text}`}>{x.v}</div>
            <div className="text-slate-500 text-xs">{x.l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {[
          ["p","✓ كل حاضر","bg-emerald-600/20 border-emerald-600/30 text-emerald-300"],
          ["a","✗ كل غائب","bg-red-600/20 border-red-600/30 text-red-300"],
          ["l","⏰ كل متأخر","bg-amber-600/20 border-amber-600/30 text-amber-300"]
        ].map(([k, l, cls]) => (
          <button key={k} onClick={() => markAll(k)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${cls}`}>{l}</button>
        ))}
      </div>

      <div className="space-y-2">
        {grpStudents.length === 0 && (
          <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">👥</div>لا يوجد طلاب</div>
        )}
        {grpStudents.map((s, i) => {
          const st = session[s.id];
          return (
            <div key={s.id} className={`rounded-2xl border transition-all duration-200 overflow-hidden ${st ? "border-slate-600/50" : "border-slate-700/40"}`}>
              <div className={`flex items-center gap-3 px-4 py-3 ${st === "p" ? "bg-emerald-500/5" : st === "a" ? "bg-red-500/5" : st === "l" ? "bg-amber-500/5" : "bg-slate-800/60"}`}>
                <div className="w-6 h-6 rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">{i + 1}</div>
                <Av name={s.name} size="sm" />
                <div className="flex-1 min-w-0">
                  {/* الاسم والحالة جنب بعض في نفس المكان على اليمين */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white text-sm font-bold truncate">{s.name}</span>
                    {st && (
                      <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${stCfg[st].color}/20 border ${stCfg[st].border}/40 ${stCfg[st].text}`}>
                        <span>{stCfg[st].icon}</span><span>{stCfg[st].label}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-xs">حضور: {s.present || 0}/{s.total || 0} ({pct(s.present || 0, s.total || 0)}%)</div>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-slate-700/30">
                {[
                  ["p","✓ حاضر","hover:bg-emerald-500/15 hover:text-emerald-300","bg-emerald-500/20 text-emerald-300"],
                  ["a","✗ غائب","hover:bg-red-500/15 hover:text-red-300","bg-red-500/20 text-red-300"],
                  ["l","⏰ متأخر","hover:bg-amber-500/15 hover:text-amber-300","bg-amber-500/20 text-amber-300"]
                ].map(([k, label, hover, active]) => (
                  <button key={k} onClick={() => mark(s.id, k)}
                    className={`py-2.5 text-xs font-medium transition-colors border-l border-slate-700/30 last:border-0 ${st === k ? active : `text-slate-500 ${hover}`}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {grpStudents.length > 0 && (
        <div className="sticky bottom-0 pb-2 z-10">
          <button onClick={saveSession} disabled={changedIds.length === 0}
            className="w-full py-4 rounded-2xl font-black text-sm transition-all disabled:opacity-30 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
            {changedIds.length === 0
              ? "مفيش تغييرات"
              : isOldDate && recordsForSession.length > 0
                ? `🔒 حفظ التعديل (يوم قديم) — ${changedIds.length} طالب`
                : `💾 حفظ الحضور — ${changedIds.length} طالب`
            }
          </button>
        </div>
      )}
      </>}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
