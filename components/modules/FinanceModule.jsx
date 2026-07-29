import { useState, useMemo } from "react";
import { GRADES_LIST, GROUPS_MAP, MONTHS_AR } from "../../constants";
import { fmtM } from "../../utils";
import { Av, Toast, Field } from "../ui";

// ══════════════════════════════════════════════════════════════
// MODULE 3: FINANCE — مصاريف اليوم (المستر فقط)
// finRecords يجيلها من App.jsx (single source of truth)
// تم إلغاء فلاتر تسجيل الدفعات القديمة (صف/مجموعة/شهر/سجل) بناءً على
// طلب صريح، وسيبنا بس تقرير "مصاريف اليوم" — عرض فقط، من غير تسجيل دفعات هنا.
// ══════════════════════════════════════════════════════════════
export default function FinanceModule({ finRecords, role = "admin" }) {
  const isAssist    = role === "assist";
  const safeRecords = finRecords || [];

  const curYear = new Date().getFullYear();

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

  if (isAssist) {
    return (
      <div className="text-center py-16 text-slate-600">
        <div className="text-5xl mb-3">🔒</div>
        <div className="text-sm">قسم المصاريف متاح للمستر فقط</div>
      </div>
    );
  }

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
                        <th key={h} className="px-3 py-2.5 text-right text-slate-400 font-bold whitespace-nowrap" style={{ fontSize: "11px" }}>{h}</th>
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
