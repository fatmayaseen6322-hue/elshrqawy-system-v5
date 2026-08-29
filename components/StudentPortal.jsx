import { useState, useMemo } from "react";
import { pct, scC } from "../utils";

// ══════════════════════════════════════════════════════════════
// 🔗 بوابة الطالب — صفحة عامة مستقلة عن باقي النظام
// بتتفتح من "لينك المجموعة" (قسم الامتحانات → الويب)، بتقرأ آخر نسخة
// لحظية من Firebase (elshrqawy_live_state/main) وتديها لأي طالب عنده
// إيميل + باسورد مسجّلين له من شاشة "تسجيل طالب" في نظام الإدارة.
// لا تحتاج تسجيل دخول كمستر/Assist ولا تلمس بيانات الجهاز المحلي.
// ══════════════════════════════════════════════════════════════

export default function StudentPortal({ grade, group }) {
  const [name, setNameVal] = useState("");
  const [sid,  setSid]     = useState("");
  const [err,   setErr]   = useState("");
  const [loading, setLoading] = useState(false);
  const [cloud, setCloud] = useState(null); // { students, finRecords, attRecords, webExams }
  const [student, setStudent] = useState(null);

  const normalizeAr = (str = "") => String(str).trim().replace(/[أإآء]/g, "ا").replace(/\s+/g, " ");

  const login = async () => {
    setErr("");
    if (!name.trim() || !sid.trim()) { setErr("اكتب اسمك والرقم المسجل"); return; }
    setLoading(true);
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");
      const snap = await getDoc(doc(db, "elshrqawy_live_state", "main"));
      if (!snap.exists()) { setErr("النظام لسه ما عملش أي مزامنة سحابية — كلّمي إدارة السنتر"); setLoading(false); return; }
      const data = snap.data();
      const list = data.students || [];
      const typedName = normalizeAr(name);
      const typedId   = sid.trim();
      const found = list.find(s =>
        String(s.id || "").trim() === typedId &&
        normalizeAr(s.name || "").includes(typedName)
      );
      if (!found) { setErr("الاسم أو الرقم المسجل غلط"); setLoading(false); return; }
      setCloud(data);
      setStudent(found);
    } catch (e) {
      setErr("تعذّر الاتصال — تأكد من النت وحاول تاني");
    }
    setLoading(false);
  };

  const myAtt = useMemo(() => {
    if (!student || !cloud) return [];
    return (cloud.attRecords || []).filter(r => r.studentId === student.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [student, cloud]);

  const myFin = useMemo(() => {
    if (!student || !cloud) return [];
    return (cloud.finRecords || []).filter(r => r.studentId === student.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [student, cloud]);

  const myExams = useMemo(() => {
    if (!student || !cloud) return [];
    return (cloud.webExams || [])
      .filter(e => e.grade === student.grade && e.group === student.group)
      .map(e => ({ e, r: (e.results || []).find(r => r.studentId === student.id) }))
      .filter(x => x.r);
  }, [student, cloud]);

  if (student) {
    const due = (student.totalFees || 0) - (student.paid || 0);
    return (
      <div dir="rtl" className="min-h-screen bg-slate-950 text-white p-4" style={{ fontFamily: "system-ui" }}>
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-2xl p-4">
            <div className="font-black text-lg">{student.name}</div>
            <div className="text-slate-400 text-xs mt-1">{student.grade} · مجموعة {student.group}</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
            <div className="font-bold text-sm mb-2">💰 المصاريف</div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">المطلوب</span><span>{student.totalFees || 0} ج</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-400">المدفوع</span><span className="text-emerald-400">{student.paid || 0} ج</span>
            </div>
            <div className="flex justify-between text-sm mt-1 font-bold">
              <span className="text-slate-400">المتبقي</span><span className={due > 0 ? "text-red-400" : "text-emerald-400"}>{due} ج</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
            <div className="font-bold text-sm mb-2">✅ الحضور (آخر 10 أيام)</div>
            {myAtt.length === 0 ? <div className="text-slate-500 text-xs">لا توجد سجلات حضور بعد</div> :
              myAtt.slice(0, 10).map(r => (
                <div key={r.id} className="flex justify-between text-sm border-t border-slate-700/30 py-1.5">
                  <span className="text-slate-400">{r.date}</span>
                  <span className={r.status === "present" ? "text-emerald-400" : r.status === "late" ? "text-amber-400" : "text-red-400"}>
                    {r.status === "present" ? "حاضر" : r.status === "late" ? "متأخر" : "غائب"}
                  </span>
                </div>
              ))
            }
          </div>

          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
            <div className="font-bold text-sm mb-2">📝 الامتحانات</div>
            {myExams.length === 0 ? <div className="text-slate-500 text-xs">لا توجد نتائج امتحانات بعد</div> :
              myExams.map(({ e, r }) => {
                const p = pct(r.score, r.max);
                return (
                  <div key={e.id} className="flex justify-between items-center text-sm border-t border-slate-700/30 py-1.5">
                    <span className="text-slate-300">{e.name}</span>
                    <span className="font-black" style={{ color: scC(p) }}>{r.score}/{r.max} ({p}%)</span>
                  </div>
                );
              })
            }
          </div>

          <button onClick={() => { setStudent(null); setCloud(null); }} className="text-slate-500 text-xs w-full text-center py-2">تسجيل خروج</button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4" style={{ fontFamily: "system-ui" }}>
      <div className="w-full max-w-sm bg-slate-900/70 border border-slate-700/40 rounded-2xl p-6 space-y-4">
        <div className="text-center">
          <div className="text-3xl mb-1">🎓</div>
          <div className="font-black text-lg">بوابة الطالب</div>
          {(grade || group) && <div className="text-slate-500 text-xs mt-1">{grade}{grade && group ? " · " : ""}{group ? `مجموعة ${group}` : ""}</div>}
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">اسمك</label>
          <input value={name} onChange={e => setNameVal(e.target.value)} type="text" placeholder="اكتب اسمك"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الرقم المسجل بيه عندنا</label>
          <input value={sid} onChange={e => setSid(e.target.value)} type="text" inputMode="numeric" placeholder="مثال: 01xxxxxxxxx"
            onKeyDown={e => e.key === "Enter" && login()}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
        </div>
        {err && <div className="text-red-400 text-xs text-center bg-red-500/10 rounded-lg py-2">{err}</div>}
        <button onClick={login} disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-xl py-2.5 font-bold text-sm transition-colors">
          {loading ? "⏳ جاري الدخول..." : "▶ تشغيل"}
        </button>
      </div>
    </div>
  );
}
