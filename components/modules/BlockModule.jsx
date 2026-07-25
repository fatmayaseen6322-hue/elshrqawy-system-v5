import { useState, useMemo } from "react";
import { Av, Toast } from "../ui";

// تطبيع الألف بأشكال الهمزة المختلفة — نفس آلية البحث في الحضور/الطلاب
const normalizeAr = (str = "") => str.replace(/[أإآء]/g, "ا");

// طالب يُعتبر "بلوك" لو اتنقل يدويًا (blocked) أو حالته "موقوف" (inactive)
const isBlocked = s => s && (s.blocked === true || s.status === "inactive");

// ══════════════════════════════════════════════════════════════
// MODULE: BLOCK — الطلاب المحذوفين/الموقوفين (بدل الحذف النهائي المباشر)
// الطالب هنا لسه موجود في البيانات بس متشال من القوائم النشطة.
// زرار ✗ هنا هو اللي بيحذفه نهائيًا من النظام.
// ══════════════════════════════════════════════════════════════
export default function BlockModule({ students: studentsProp, setStudents, addActivity }) {
  const students = studentsProp || [];
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast] = useState(null);

  const blockedStudents = useMemo(() => students.filter(isBlocked), [students]);

  const filtered = useMemo(() => {
    if (!search.trim()) return blockedStudents;
    const q = normalizeAr(search.trim());
    return blockedStudents.filter(s => normalizeAr(s.name || "").includes(q));
  }, [blockedStudents, search]);

  const groups = useMemo(() => {
    const map = {};
    filtered.forEach(s => { if (!map[s.grade]) map[s.grade] = []; map[s.grade].push(s); });
    return Object.entries(map);
  }, [filtered]);

  const restore = s => {
    setStudents(p => p.map(x => x.id === s.id ? { ...x, blocked: false, status: "active" } : x));
    addActivity?.("استرجاع من بلوك", s.name);
    setToast({ msg: `✓ تم استرجاع ${s.name}`, type: "success" });
  };

  const hardDelete = s => {
    setStudents(p => p.filter(x => x.id !== s.id));
    addActivity?.("حذف نهائي", s.name);
    setToast({ msg: `✓ تم حذف ${s.name} نهائيًا`, type: "success" });
    setConfirmDel(null);
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <div className="text-2xl">🚫</div>
        <div className="text-white font-black text-base">بلوك</div>
        <div className="text-slate-500 text-xs">الطلاب المحذوفين أو الموقوفين — {blockedStudents.length}</div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 دوّر في البلوك بالاسم..."
          className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none" />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">🚫</div>مفيش طلاب في البلوك</div>
      )}

      {groups.map(([grade, list]) => (
        <div key={grade} className="space-y-2">
          <div className="text-slate-400 text-xs font-bold px-1">{grade} ({list.length})</div>
          {list.map(s => (
            <div key={s.id} className="bg-slate-800/50 border border-slate-700/30 rounded-xl px-3 py-2.5 flex items-center gap-3">
              <Av name={s.name} size="sm" />
              <div className="flex-1 min-w-0 text-right">
                <div className="text-white text-sm font-bold truncate">{s.name}</div>
                <div className="text-slate-500 text-xs">مجموعة {s.group} · {s.id}</div>
              </div>
              <button onClick={() => restore(s)}
                className="shrink-0 px-2.5 h-8 rounded-lg bg-emerald-700/20 border border-emerald-600/30 text-emerald-300 text-xs font-bold">↩ استرجاع</button>
              <button onClick={() => setConfirmDel(s)}
                className="shrink-0 w-8 h-8 rounded-lg bg-red-700/25 border border-red-600/30 text-red-300 flex items-center justify-center font-bold">✗</button>
            </div>
          ))}
        </div>
      ))}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs space-y-4">
            <div className="text-white text-sm text-center">حذف {confirmDel.name} نهائيًا؟</div>
            <div className="text-red-400 text-xs text-center">الخطوة دي نهائية ومش هترجع تاني</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm">إلغاء</button>
              <button onClick={() => hardDelete(confirmDel)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">✗ حذف نهائي</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
