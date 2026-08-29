import { useState, useMemo } from "react";
import { pct, scC, fmt } from "../utils";

const MONTHS_AR = ["", "يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const STATUS_LABEL = { present: "حاضر", late: "متأخر", absent: "غائب" };
const STATUS_COLOR = { present: "text-emerald-400", late: "text-amber-400", absent: "text-red-400" };

// ══════════════════════════════════════════════════════════════
// 🔗 بوابة الطالب — صفحة عامة مستقلة عن باقي النظام
// بتتفتح من "لينك المجموعة" (قسم الامتحانات → الويب)، بتقرأ آخر نسخة
// لحظية من Firebase (elshrqawy_live_state/main) وتديها لأي طالب عنده
// إيميل + باسورد مسجّلين له من شاشة "تسجيل طالب" في نظام الإدارة.
// لا تحتاج تسجيل دخول كمستر/Assist ولا تلمس بيانات الجهاز المحلي.
// ══════════════════════════════════════════════════════════════

export default function StudentPortal({ grade, group }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [loading, setLoading] = useState(false);
  const [cloud, setCloud] = useState(null); // { students, finRecords, attRecords, webExams }
  const [student, setStudent] = useState(null);

  const login = async () => {
    setErr("");
    if (!email.trim() || !pass) { setErr("اكتب الإيميل والباسورد"); return; }
    setLoading(true);
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");
      const snap = await getDoc(doc(db, "elshrqawy_live_state", "main"));
      if (!snap.exists()) { setErr("النظام لسه ما عملش أي مزامنة سحابية — كلّمي إدارة السنتر"); setLoading(false); return; }
      const data = snap.data();
      const list = data.students || [];
      const found = list.find(s =>
        (s.portalEmail || "").trim().toLowerCase() === email.trim().toLowerCase() &&
        (s.portalPass  || "") === pass
      );
      if (!found) { setErr("الإيميل أو الباسورد غلط"); setLoading(false); return; }
      setCloud(data);
      setStudent(found);
    } catch (e) {
      setErr("تعذّر الاتصال — تأكد من النت وحاول تاني");
    }
    setLoading(false);
  };

  // #StudentPortal: أي حد من الثلاثة (👤 عام / 💰 مصاريف / 📝 درجات / ✅ غياب)
  const [tab, setTab] = useState("home");
  const [openWrong, setOpenWrong] = useState(null); // { text, options, correct, chosen } أو { desc } للأسئلة الورقية

  const myAtt = useMemo(() => {
    if (!student || !cloud) return [];
    return (cloud.attRecords || []).filter(r => r.studentId === student.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [student, cloud]);

  const myFin = useMemo(() => {
    if (!student || !cloud) return [];
    return (cloud.finRecords || []).filter(r => r.studentId === student.id)
      .sort((a, b) => (b.year - a.year) || (b.month - a.month) || String(b.timestamp).localeCompare(String(a.timestamp)));
  }, [student, cloud]);

  // نتائج الامتحانات السريعة أونلاين (webExams) — فيها wrongQ لو الامتحان
  // اتعمل بعد التحديث ده، وإلا wrong (اسم الموضوع بس) للامتحانات القديمة.
  const myWebExams = useMemo(() => {
    if (!student || !cloud) return [];
    return (cloud.webExams || [])
      .filter(e => e.grade === student.grade && e.group === student.group)
      .map(e => ({ e, r: (e.results || []).find(r => r.studentId === student.id) }))
      .filter(x => x.r)
      .sort((a, b) => (a.e.date < b.e.date ? 1 : -1));
  }, [student, cloud]);

  // أخطاء الامتحانات الورقية (المصححة بالكاميرا) — من student.examErrors،
  // بنترجم رقم كل سؤال لوصفه الفعلي عن طريق questionMeta بتاع centerExams
  // المرتبط بنفس الصف/الوحدة/الدرس (نفس منطق تقرير الأخطاء عند المستر).
  const myPaperErrors = useMemo(() => {
    if (!student || !cloud) return [];
    const errs = student.examErrors || [];
    const byLesson = {};
    errs.forEach(e => {
      const key = `${e.grade}__${e.unit}__${e.lesson}`;
      if (!byLesson[key]) byLesson[key] = { grade: e.grade, unit: e.unit, lesson: e.lesson, qs: new Set() };
      byLesson[key].qs.add(e.q);
    });
    return Object.values(byLesson).map(g => {
      const linkedExam = (cloud.centerExams || []).find(e => e.grade === g.grade && String(e.unit) === String(g.unit) && String(e.lesson) === String(g.lesson));
      return {
        ...g,
        qs: [...g.qs].sort((a, b) => a - b).map(q => {
          const d = linkedExam?.questionMeta?.[q];
          return { q, desc: d && d.trim() ? d.trim() : `سؤال ${q}` };
        }),
      };
    });
  }, [student, cloud]);

  const totalMissed = myAtt.filter(r => r.status === "absent").length;
  const totalLate   = myAtt.filter(r => r.status === "late").length;
  const due = student ? (student.totalFees || 0) - (student.paid || 0) : 0;

  const Header = () => (
    <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <div className="font-black text-lg">{student.name}</div>
        <div className="text-slate-400 text-xs mt-1">{student.grade} · مجموعة {student.group}</div>
      </div>
      {tab !== "home" && (
        <button onClick={() => setTab("home")} className="text-xs text-emerald-400 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
          ← الرئيسية
        </button>
      )}
    </div>
  );

  if (student) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-950 text-white p-4" style={{ fontFamily: "system-ui" }}>
        <div className="max-w-md mx-auto space-y-4">
          <Header />

          {/* الشاشة الرئيسية: 3 أزرار كبيرة */}
          {tab === "home" && (
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setTab("finance")}
                className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-transform">
                <div className="text-right">
                  <div className="font-bold text-sm">💰 المصاريف</div>
                  <div className={`text-xs mt-1 ${due > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {due > 0 ? `متبقي ${fmt(due)}` : "لا يوجد متأخرات"}
                  </div>
                </div>
                <span className="text-slate-500">←</span>
              </button>

              <button onClick={() => setTab("grades")}
                className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-transform">
                <div className="text-right">
                  <div className="font-bold text-sm">📝 الدرجات</div>
                  <div className="text-slate-400 text-xs mt-1">{myWebExams.length + myPaperErrors.reduce((a, g) => a + g.qs.length, 0)} نتيجة/خطأ مسجّل</div>
                </div>
                <span className="text-slate-500">←</span>
              </button>

              <button onClick={() => setTab("attendance")}
                className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center justify-between active:scale-95 transition-transform">
                <div className="text-right">
                  <div className="font-bold text-sm">✅ الغياب</div>
                  <div className={`text-xs mt-1 ${totalMissed > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {totalMissed > 0 ? `${totalMissed} حصة غياب` : "لا يوجد غياب"}
                  </div>
                </div>
                <span className="text-slate-500">←</span>
              </button>

              <button onClick={() => { setStudent(null); setCloud(null); setPass(""); setTab("home"); }}
                className="text-slate-500 text-xs w-full text-center py-2">تسجيل خروج</button>
            </div>
          )}

          {/* المصاريف */}
          {tab === "finance" && (
            <div className="space-y-3">
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
                <div className="flex justify-between text-sm"><span className="text-slate-400">المطلوب</span><span>{fmt(student.totalFees || 0)}</span></div>
                <div className="flex justify-between text-sm mt-1"><span className="text-slate-400">المدفوع</span><span className="text-emerald-400">{fmt(student.paid || 0)}</span></div>
                <div className="flex justify-between text-sm mt-1 font-bold"><span className="text-slate-400">المتبقي</span><span className={due > 0 ? "text-red-400" : "text-emerald-400"}>{fmt(due)}</span></div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
                <div className="font-bold text-sm mb-2">سجل الدفعات</div>
                {myFin.length === 0 ? <div className="text-slate-500 text-xs">لا توجد دفعات مسجَّلة بعد</div> :
                  myFin.map(r => (
                    <div key={r.id} className="flex justify-between text-sm border-t border-slate-700/30 py-1.5">
                      <span className="text-slate-400">{MONTHS_AR[r.month] || ""} {r.year}</span>
                      <span className="text-emerald-400 font-bold">{fmt(r.amount)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* الدرجات */}
          {tab === "grades" && (
            <div className="space-y-3">
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
                <div className="font-bold text-sm mb-2">نتائج الامتحانات</div>
                {myWebExams.length === 0 ? <div className="text-slate-500 text-xs">لا توجد نتائج امتحانات بعد</div> :
                  myWebExams.map(({ e, r }) => {
                    const p = pct(r.score, r.max);
                    const wrongList = r.wrongQ && r.wrongQ.length ? r.wrongQ : (r.wrong || []).map(t => ({ topic: t }));
                    return (
                      <div key={e.id} className="border-t border-slate-700/30 py-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-300">{e.name}</span>
                          <span className="font-black" style={{ color: scC(p) }}>{r.score}/{r.max} ({p}%)</span>
                        </div>
                        {wrongList.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {wrongList.map((w, i) => (
                              <button key={i} onClick={() => w.text ? setOpenWrong(w) : null}
                                className={`text-[11px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 ${w.text ? "active:scale-95" : "opacity-70"}`}>
                                {w.topic || "خطأ"}{w.text ? " ↗" : ""}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>

              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
                <div className="font-bold text-sm mb-2">أخطاء الامتحانات الورقية</div>
                {myPaperErrors.length === 0 ? <div className="text-slate-500 text-xs">لا توجد أخطاء مسجَّلة بعد</div> :
                  myPaperErrors.map((g, gi) => (
                    <div key={gi} className="border-t border-slate-700/30 py-2">
                      <div className="text-xs text-slate-400 mb-1.5">{g.grade} — وحدة {g.unit} — درس {g.lesson}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.qs.map((q, qi) => (
                          <button key={qi} onClick={() => setOpenWrong({ desc: q.desc })}
                            className="text-[11px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 active:scale-95">
                            {q.desc} ↗
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* الغياب */}
          {tab === "attendance" && (
            <div className="space-y-3">
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex justify-around text-center">
                <div><div className="text-red-400 font-black text-lg">{totalMissed}</div><div className="text-slate-500 text-[11px]">غياب</div></div>
                <div><div className="text-amber-400 font-black text-lg">{totalLate}</div><div className="text-slate-500 text-[11px]">تأخير</div></div>
                <div><div className="text-emerald-400 font-black text-lg">{myAtt.filter(r => r.status === "present").length}</div><div className="text-slate-500 text-[11px]">حضور</div></div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
                <div className="font-bold text-sm mb-2">سجل الحضور الكامل</div>
                {myAtt.length === 0 ? <div className="text-slate-500 text-xs">لا توجد سجلات حضور بعد</div> :
                  myAtt.map(r => (
                    <div key={r.id} className="flex justify-between text-sm border-t border-slate-700/30 py-1.5">
                      <span className="text-slate-400">{r.date}</span>
                      <span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status] || r.status}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>

        {/* مودال تفاصيل السؤال الغلط */}
        {openWrong && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setOpenWrong(null)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              {openWrong.desc ? (
                <div className="text-sm text-slate-200">{openWrong.desc}</div>
              ) : (
                <>
                  <div className="text-sm text-slate-200 font-bold mb-3">{openWrong.text}</div>
                  <div className="space-y-1.5">
                    {(openWrong.options || []).map((op, i) => (
                      <div key={i} className={`text-xs rounded-lg px-2.5 py-1.5 border ${
                        i === openWrong.correct ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" :
                        i === openWrong.chosen ? "border-red-500/40 bg-red-500/10 text-red-300" :
                        "border-slate-700/40 text-slate-400"}`}>
                        {op} {i === openWrong.correct ? "✓ الإجابة الصح" : i === openWrong.chosen ? "✗ اختيار الطالب" : ""}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button onClick={() => setOpenWrong(null)} className="w-full mt-3 text-xs text-slate-500 py-1.5">إغلاق</button>
            </div>
          </div>
        )}
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
          <label className="text-xs text-slate-400 mb-1 block">الإيميل</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">الباسورد</label>
          <input value={pass} onChange={e => setPass(e.target.value)} type="password"
            onKeyDown={e => e.key === "Enter" && login()}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
        </div>
        {err && <div className="text-red-400 text-xs text-center bg-red-500/10 rounded-lg py-2">{err}</div>}
        <button onClick={login} disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-xl py-2.5 font-bold text-sm transition-colors">
          {loading ? "⏳ جاري الدخول..." : "دخول"}
        </button>
      </div>
    </div>
  );
}
