import { useState, useMemo } from "react";
import { GRADES_LIST } from "../../constants";
import { normalizeAr, sortStudentsList, isBlocked, waLink } from "../../utils";
import { Av, Inp, Sel, Modal } from "../ui";

// ══════════════════════════════════════════════════════════════
// MODULE: CALL LIST — دليل اتصال سريع
// شاشة بسيطة مخصوصة للموبايل: اسم الطالب + رقم ولي الأمر + زرار اتصال
// كبير. من غير خطوات (اختيار صف إجباري إلخ) — بتفتح وتلاقي كل الطلاب
// على طول، وفيها بحث سريع بالاسم. الرقم بيتاخد من ولي الأمر أولاً،
// ولو مش موجود بياخد رقم الطالب نفسه.
// ══════════════════════════════════════════════════════════════
export default function CallModule({ students: studentsProp }) {
  const students = studentsProp || [];
  const [search,   setSearch]   = useState("");
  const [selGrade, setSelGrade] = useState(""); // فاضي = كل الصفوف
  const [waStudent, setWaStudent] = useState(null); // الطالب المفتوح عليه اختيار رسالة الواتساب

  const list = useMemo(() => {
    const q = normalizeAr(search);
    let arr = students.filter(s => !isBlocked(s));
    if (selGrade) arr = arr.filter(s => s.grade === selGrade);
    if (q) arr = arr.filter(s => normalizeAr(s.name).includes(q));
    return sortStudentsList(arr);
  }, [students, search, selGrade]);

  const withPhone = list.filter(s => s.parentPhone || s.phone);
  const withoutPhone = list.filter(s => !s.parentPhone && !s.phone);

  const sendWa = (kind) => {
    if (!waStudent) return;
    const phone = waStudent.parentPhone || waStudent.phone;
    const msg = kind === "absent"
      ? `تحية طيبة، نفيدكم بأن الطالب/ة ${waStudent.name} غاب/ت عن الحصة اليوم. برجاء المتابعة معنا.`
      : `تحية طيبة، نفيدكم بأن الطالب/ة ${waStudent.name} تأخر/ت عن حضور الحصة اليوم. برجاء المتابعة معنا.`;
    const link = waLink(phone, `?text=${encodeURIComponent(msg)}`);
    if (link) window.open(link, "_blank");
    setWaStudent(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/30 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-4xl">📞</span>
        <div>
          <div className="text-white font-black">دليل الاتصال</div>
          <div className="text-slate-400 text-xs">{withPhone.length} طالب برقم متاح</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Inp value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 دوّري باسم الطالب..." />
        </div>
        <Sel value={selGrade} onChange={e => setSelGrade(e.target.value)}>
          <option value="">كل الصفوف</option>
          {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
        </Sel>
      </div>

      {withPhone.length === 0 && (
        <div className="text-center py-10 text-slate-600">
          <div className="text-4xl mb-2">📵</div>
          <div className="text-sm">مفيش طلاب بأرقام متاحة في البحث ده</div>
        </div>
      )}

      <div className="space-y-2">
        {withPhone.map(s => {
          const phone = s.parentPhone || s.phone;
          return (
            <div
              key={s.id}
              className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-3 flex items-center gap-3"
            >
              <Av name={s.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium whitespace-normal break-words">{s.name}</div>
                <div className="text-slate-500 text-xs flex items-center gap-1">
                  <span>{s.grade}</span>
                  <span>·</span>
                  <span style={{ direction: "ltr" }}>{phone}</span>
                  {!s.parentPhone && <span className="text-amber-400">(رقم الطالب)</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaStudent(s)}
                className="shrink-0 w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg active:bg-emerald-700 transition-colors"
              >💬</button>
              <a
                href={`tel:${phone}`}
                className="shrink-0 w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg active:bg-blue-700 transition-colors"
              >📞</a>
            </div>
          );
        })}
      </div>

      {withoutPhone.length > 0 && (
        <div className="pt-2">
          <div className="text-slate-500 text-xs mb-2">📵 بدون رقم ({withoutPhone.length})</div>
          <div className="space-y-1.5">
            {withoutPhone.map(s => (
              <div key={s.id} className="bg-slate-800/30 border border-slate-700/20 rounded-xl p-2.5 flex items-center gap-2.5 opacity-60">
                <Av name={s.name} size="sm" />
                <div className="flex-1 min-w-0 text-slate-400 text-xs">{s.name} — {s.grade}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {waStudent && (
        <Modal title={`رسالة واتساب — ${waStudent.name}`} onClose={() => setWaStudent(null)}>
          <div className="p-5 space-y-3">
            <div className="text-slate-400 text-xs text-center mb-1">اختاري نوع الرسالة، وهتفتح واتساب على طول جاهزة للإرسال</div>
            <button
              onClick={() => sendWa("absent")}
              className="w-full py-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 font-bold flex items-center justify-center gap-2 text-base active:bg-red-500/25"
            >🔴 غياب</button>
            <button
              onClick={() => sendWa("late")}
              className="w-full py-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-center gap-2 text-base active:bg-amber-500/25"
            >🟡 تأخير</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
