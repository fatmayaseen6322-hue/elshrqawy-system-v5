import { useState, useMemo } from "react";
import { GRADES_LIST, GROUPS_MAP, TODAY } from "../../constants";
import { pct, lsGet, lsSet } from "../../utils";
import { Av, Sel, DatePicker, Toast } from "../ui";

// مفتاح تخزين أيام الحضور المسجَّلة فعلياً — بدون ده savedKeys كانت
// state محلي بس، تتمسح عند أي refresh ويصبح ممكن تسجيل نفس اليوم مرتين
// (إصلاح #5).
const SAVED_KEYS_LS_KEY = "app_attendance_saved_keys";

// ══════════════════════════════════════════════════════════════
// MODULE 1: ATTENDANCE
// ══════════════════════════════════════════════════════════════
export default function AttendanceModule({ students, setStudents }) {
  const [grade,     setGrade]     = useState(GRADES_LIST[2]);
  const [group,     setGroup]     = useState("A");
  const [date,      setDate]      = useState(TODAY);
  const [session,   setSession]   = useState({});
  const [savedKeys, setSavedKeys] = useState(() => new Set(lsGet(SAVED_KEYS_LS_KEY, [])));
  const [toast,     setToast]     = useState(null);

  const grpList     = GROUPS_MAP[grade] || ["A"];
  const grpStudents = useMemo(
    () => (students || []).filter(s => s && s.grade === grade && s.group === group),
    [students, grade, group]
  );

  const sessionKey  = `${grade}|${group}|${date}`;
  const alreadySaved = savedKeys.has(sessionKey);

  const handleGradeChange = (g) => {
    setGrade(g);
    setGroup(GROUPS_MAP[g]?.[0] || "A");
    setSession({});
  };

  const handleGroupChange = (g) => {
    setGroup(g);
    setSession({});
  };

  const handleDateChange = (d) => {
    // تحقق مستقل عن DatePicker: حتى لو القيمة جاية من مصدر تاني (إدخال
    // يدوي، أو نداء برمجي مباشر) ما نقبلش تاريخ بعد النهاردة (إصلاح #6).
    if (d > TODAY) {
      setToast({ msg: "لا يمكن اختيار تاريخ مستقبلي", type: "error" });
      return;
    }
    setDate(d);
    setSession({});
  };

  // Toggle: same status → deselect (lets teacher correct mis-taps)
  const mark = (id, st) => setSession(prev => {
    if (prev[id] === st) { const n = { ...prev }; delete n[id]; return n; }
    return { ...prev, [id]: st };
  });

  const markAll = st => setSession(() =>
    Object.fromEntries(grpStudents.map(s => [s.id, st]))
  );

  const marked = Object.keys(session).length;
  const counts = {
    p: Object.values(session).filter(v => v === "p").length,
    a: Object.values(session).filter(v => v === "a").length,
    l: Object.values(session).filter(v => v === "l").length,
  };

  const saveSession = () => {
    if (marked === 0) {
      setToast({ msg: "لم تحدد أي طالب", type: "error" });
      return;
    }
    if (alreadySaved) {
      setToast({ msg: "تم تسجيل حضور هذا اليوم مسبقاً", type: "error" });
      return;
    }
    setStudents(prev => (prev || []).map(s => {
      const st = session[s.id];
      if (!st) return s;
      return {
        ...s,
        present: (s.present || 0) + (st === "p" ? 1 : 0),
        absent:  (s.absent  || 0) + (st === "a" ? 1 : 0),
        late:    (s.late    || 0) + (st === "l" ? 1 : 0),
        total:   (s.total   || 0) + 1,
      };
    }));
    setSavedKeys(prev => {
      const next = new Set([...prev, sessionKey]);
      lsSet(SAVED_KEYS_LS_KEY, [...next]);
      return next;
    });
    setSession({});
    setToast({ msg: `✓ تم حفظ حضور ${marked} طالب`, type: "success" });
  };

  const stCfg = {
    p: { label: "حاضر",  color: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-400", icon: "✓"  },
    a: { label: "غائب",  color: "bg-red-500",     border: "border-red-500",     text: "text-red-400",    icon: "✗"  },
    l: { label: "متأخر", color: "bg-amber-500",   border: "border-amber-500",   text: "text-amber-400",  icon: "⏰" },
  };

  return (
    <div className="space-y-4">
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
        {alreadySaved && (
          <div className="text-amber-400 text-xs text-center bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            ⚠️ تم تسجيل حضور هذا اليوم بالفعل
          </div>
        )}
      </div>

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
                  <div className="text-white text-sm font-bold truncate">{s.name}</div>
                  <div className="text-slate-500 text-xs">حضور: {s.present || 0}/{s.total || 0} ({pct(s.present || 0, s.total || 0)}%)</div>
                </div>
                {st && (
                  <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${stCfg[st].color}/20 border ${stCfg[st].border}/40 ${stCfg[st].text}`}>
                    <span>{stCfg[st].icon}</span><span>{stCfg[st].label}</span>
                  </div>
                )}
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
          <button onClick={saveSession} disabled={marked === 0 || alreadySaved}
            className="w-full py-4 rounded-2xl font-black text-sm transition-all disabled:opacity-30 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
            {alreadySaved
              ? "✓ تم تسجيل هذا اليوم"
              : marked === 0
                ? "اختر حالة الطلاب أولاً"
                : `💾 حفظ الحضور — ${marked} من ${grpStudents.length} طالب`
            }
          </button>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
