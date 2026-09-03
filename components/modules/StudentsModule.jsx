import { useState, useEffect, useCallback, useMemo } from "react";
import { GRADES_LIST, GROUPS_MAP, TODAY, MONTHS_AR } from "../../constants";
import { pct, fmt, genSID, genStudentId, waLink, isBlocked, isMonthBlocked, sortStudentsList } from "../../utils";
import { Av, Bar, Toast, Field, Inp, Sel, Btn, DatePicker, StatusBar, GradeSelect } from "../ui";
import ImportStudentsModal from "./ImportStudentsModal";

// المستوى الحقيقي للطالب: مبني على حاجتين مع بعض —
//  1) دقة الامتحانات الحقيقية (100% ناقص نسبة النقط الغلط من إجمالي نقط
//     الامتحانات المرفوعة فعليًا)
//  2) نسبة الحضور (present / total)
// لو الاتنين متاحين، المستوى = المتوسط بينهم. لو واحد بس متاح، بيتاخد هو
// لوحده. لو مفيش أي بيانات كفاية، بترجع null.
function computeRealLevel(s, centerExams) {
  const lessonKeys = [...new Set((s.examErrors || []).map(e => `${e.grade}__${e.unit}__${e.lesson}`))];
  let examLevel = null;
  if (lessonKeys.length > 0) {
    let totalPoints = 0, wrongPoints = 0;
    lessonKeys.forEach(key => {
      const [g, u, l] = key.split("__");
      const exam = (centerExams || []).find(ex => ex.grade === g && String(ex.unit) === u && String(ex.lesson) === l);
      const pts = exam ? (exam.numQuestions || 0) * (exam.pointsPerQuestion || 0) : 0;
      if (!pts) return;
      const wrong = (s.examErrors || []).filter(e => e.grade === g && e.unit === u && e.lesson === l).length;
      totalPoints += pts;
      wrongPoints += wrong;
    });
    if (totalPoints > 0) examLevel = Math.max(0, Math.round(100 - (wrongPoints / totalPoints) * 100));
  }

  const attTotal = s.total || 0;
  const attLevel = attTotal > 0 ? Math.max(0, Math.round(((s.present || 0) / attTotal) * 100)) : null;

  if (examLevel === null && attLevel === null) return null;
  if (examLevel === null) return attLevel;
  if (attLevel === null) return examLevel;
  return Math.round((examLevel + attLevel) / 2);
}

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
              <div style={{ fontSize: "10px", color: "var(--text-muted, #64748b)" }}>{h.label || `#${i+1}`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentsModule({ students, setStudents, finRecords, setFinRecords, attRecords, setAttRecords, webExams, centerExams, jumpTo, onJumpDone, addActivity, startAdd, onDone }) {
  const [step, setStep] = useState(startAdd ? "add" : "select");
  const [grade, setGrade] = useState(GRADES_LIST[2]);
  const [group, setGroup] = useState("A");
  const [date, setDate] = useState(TODAY);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [blockReason, setBlockReason] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [openErrKey, setOpenErrKey] = useState(null);

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

        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
          <div className="grid grid-cols-4 gap-2 items-stretch">
            <GradeSelect value={grade} onChange={v => { setGrade(v); setGroup(GROUPS_MAP[v]?.[0] || "A"); }} />
            <Sel value={group} onChange={e => setGroup(e.target.value)}>
              {grpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
            </Sel>
            <DatePicker value={date} onChange={setDate} max={TODAY} />
            <button onClick={() => ready && setStep("section")} disabled={!ready}
              className={`rounded-xl px-1 py-1 text-center border flex flex-col items-center justify-center gap-0.5 transition-all ${ready ? "border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30" : "border-slate-700/40 bg-slate-900/30 opacity-40 cursor-not-allowed"}`}>
              <span className="text-sm leading-none">✓</span>
              <span className={`text-[12px] font-bold leading-tight ${ready ? "text-blue-300" : "text-slate-500"}`}>متابعة اختيار القسم</span>
            </button>
          </div>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    );
  }

  // ── SECTION step ───────────────────────────────────────────
  if (step === "section") {
    const grpStudents = sortStudentsList(students.filter(s => s.grade === grade && s.group === group && !isBlocked(s)));
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
          <div>
            {grpStudents.length === 0 ? (
              <div className="text-center text-slate-600 text-xs py-4">مفيش طلاب في المجموعة دي</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-700/30">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="led-thead bg-slate-800/70 text-slate-400 text-xs">
                      <th className="px-3 py-2 font-medium">الطالب</th>
                      <th className="px-3 py-2 font-medium">أرقام التليفونات</th>
                      <th className="px-3 py-2 font-medium">المستوى</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grpStudents.map(s => {
                      const cfg = stCfg[s.status] || stCfg.active;
                      const lvl = computeRealLevel(s, centerExams);
                      return (
                        <tr key={s.id} onClick={() => { setSel(s); setStep("profile"); }}
                          className="bg-slate-800/50 hover:bg-slate-800 border-t border-slate-700/30 cursor-pointer transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <Av name={s.name} size="sm" />
                              <span className="text-white text-xs font-bold whitespace-normal break-words">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-normal break-words" style={{ fontSize: "12px" }}>
                            <div>{s.phone || "—"}</div>
                            {s.parentPhone && s.parentPhone !== s.phone && (
                              <div className="text-slate-600">ولي الأمر: {s.parentPhone}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.t}`}>{lvl === null ? "—" : `${lvl}%`}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
      if (isMonthBlocked(s, m, currentYearNum)) continue; // شهر بلوك — مش دَين
      if (!isMonthPaid(m, currentYearNum)) overdueMonths.push(m);
    }

    // نسبة السداد الحقيقية: مبنية على نفس بيانات finRecords اللي بتحسب
    // الشهور المتأخرة فوق (مش على s.paid/s.totalFees الثابتين) — عشان
    // الرقم يبقى متطابق مع تنبيه "متأخر" جنبه، بدل ما يظهر رقمين متناقضين.
    const monthsBeforeCurrent = currentMonthNum - startMonth;
    const paidBeforeCurrent = monthsBeforeCurrent - overdueMonths.length;
    const totalMonthsSoFar = monthsBeforeCurrent + 1; // شامل الشهر الحالي
    const paidMonthsSoFar = paidBeforeCurrent + (currentMonthPaid ? 1 : 0);
    const paymentPct = totalMonthsSoFar > 0 ? Math.round((paidMonthsSoFar / totalMonthsSoFar) * 100) : 100;
    const contactPhone = s.phone || s.parentPhone || "";

    // ── أخطاء حقيقية من الامتحانات (مربوطة بالوحدة/الدرس/اليوم) ──
    // بتتجمّع من كل امتحان اتسجّل فيه هذا الطالب كـ "الممتحِن" فعليًا
    // (results[].wrong)، مش تقديرات عشوائية لباقي المجموعة.
    const examMistakes = (() => {
      const bucket = {};
      (webExams || []).forEach(e => {
        const r = (e.results || []).find(x => x.studentId === s.id && x.wrong?.length);
        if (!r) return;
        r.wrong.forEach(topic => {
          const key = `${topic}__${e.unit}__${e.lesson}`;
          if (!bucket[key]) bucket[key] = { topic, unit: e.unit, lesson: e.lesson, count: 0, lastDate: e.date };
          bucket[key].count++;
          if (e.date > bucket[key].lastDate) bucket[key].lastDate = e.date;
        });
      });
      return Object.values(bucket).sort((a, b) => b.count - a.count);
    })();

    // ── أخطاء الأسئلة المسجّلة من قسم "الأخطاء" (وحدة/درس ← أرقام الأسئلة) ──
    const errorsByLesson = (() => {
      const bucket = {};
      (s.examErrors || []).forEach(e => {
        const key = `${e.unit}__${e.lesson}`;
        if (!bucket[key]) bucket[key] = { unit: e.unit, lesson: e.lesson, items: [] };
        bucket[key].items.push(e);
      });
      return Object.values(bucket).sort((a, b) => (a.unit - b.unit) || (a.lesson - b.lesson));
    })();

    // ── المستوى الحقيقي: 100% ناقص نسبة النقط الغلط من إجمالي نقط الامتحانات
    // الحقيقية المرفوعة (مش رقم ثابت ولا عشوائي) ──
    const realLevel = computeRealLevel(s, centerExams);

    return (
      <div className="space-y-4">
        <button onClick={() => { setStep("section"); setSel(null); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1">← رجوع</button>
        <StatusBar grade={grade} group={group} date={date} />
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            <Av name={s.name} size="lg" />
            <div className="shrink-0 pl-1">
              <div className="text-white font-black text-base whitespace-nowrap">{s.name}</div>
              <span className={`mt-1.5 inline-block text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap ${stCfg[s.status]?.bg} ${stCfg[s.status]?.t}`}>{stCfg[s.status]?.l}</span>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-2.5 text-center shrink-0 min-w-[68px]">
              <div className="font-black text-sm text-white truncate">{s.phone || "—"}</div>
              <div className="text-xs text-slate-500">هاتف</div>
            </div>
            {contactPhone && (
              <div className="flex flex-col gap-1 shrink-0">
                <a href={`tel:${contactPhone}`}
                  className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 flex items-center justify-center text-sm">📞</a>
                <a href={waLink(contactPhone) || "#"} target="_blank" rel="noreferrer"
                  className="w-8 h-8 rounded-lg bg-green-700/30 border border-green-600/20 text-green-400 flex items-center justify-center text-sm">💬</a>
              </div>
            )}
            {[
              { l: "الحضور", v: `${pct(s.present, s.total)}%`, ok: pct(s.present, s.total) >= 80 },
              { l: "المستوى", v: realLevel === null ? "—" : `${realLevel}%`, ok: realLevel === null ? true : realLevel >= 65 },
              { l: "السداد", v: `${paymentPct}%`, ok: overdueMonths.length === 0 && currentMonthPaid }
            ].map(x => (
              <div key={x.l} className="bg-slate-900/50 rounded-xl p-2.5 text-center shrink-0 min-w-[68px]">
                <div className={`font-black text-lg ${x.ok ? "text-emerald-400" : "text-amber-400"}`}>{x.v}</div>
                <div className="text-xs text-slate-500">{x.l}</div>
              </div>
            ))}
          </div>

          {/* المصاريف مدموجة هنا: الشهر الحالي + الشهور المتأخرة + تعديل في خط واحد */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
            <div className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap ${currentMonthPaid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              {currentMonthPaid ? `✓ ${MONTHS_AR[currentMonthNum - 1]} مدفوع` : `✗ ${MONTHS_AR[currentMonthNum - 1]} غير مدفوع`}
            </div>
            <div className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap ${overdueMonths.length > 0 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
              {overdueMonths.length > 0 ? `⚠️ متأخر: ${overdueMonths.join("، ")}` : "✓ لا يوجد شهور متأخرة"}
            </div>
            <div className="shrink-0 flex rounded-xl border border-slate-700/40 overflow-hidden">
              <button onClick={() => setStep("edit")}
                className="px-3 py-2 text-xs font-bold bg-blue-600/20 border-l border-slate-700/40 text-blue-300 whitespace-nowrap">
                ✏️ تعديل
              </button>
              <button onClick={() => setConfirmDel(s)}
                className="px-3 py-2 text-xs font-bold bg-red-700/20 text-red-400 whitespace-nowrap">
                🚫 حظر
              </button>
            </div>
          </div>
          {s.weak?.length > 0 && (
            <div className="mt-3 bg-slate-900/40 rounded-xl p-3">
              <div className="text-slate-500 text-xs mb-1.5">📝 نقاط ضعف (مسجّلة يدويًا)</div>
              <div className="flex flex-wrap gap-1.5">
                {s.weak.map(w => <span key={w} className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400">ضعيف في {w}</span>)}
              </div>
            </div>
          )}
          {examMistakes.length > 0 && (
            <div className="mt-3 bg-slate-900/40 rounded-xl p-3">
              <div className="text-slate-500 text-xs mb-1.5">📚 أخطاء من الامتحانات</div>
              <div className="flex flex-wrap gap-1.5">
                {examMistakes.map(m => (
                  <span key={`${m.topic}__${m.unit}__${m.lesson}`} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/20 text-amber-400">
                    {m.topic} · {m.unit}/{m.lesson} · {m.count}× · آخرها {m.lastDate}
                  </span>
                ))}
              </div>
            </div>
          )}
          {errorsByLesson.length > 0 && (
            <div className="mt-3 bg-slate-900/40 rounded-xl p-3">
              <div className="text-slate-500 text-xs mb-1.5">🟥 أخطاء الأسئلة (وحدة / درس)</div>
              <div className="flex flex-wrap gap-1.5">
                {errorsByLesson.map(g => {
                  const key = `${g.unit}__${g.lesson}`;
                  const isOpen = openErrKey === key;
                  return (
                    <button key={key} onClick={() => setOpenErrKey(isOpen ? null : key)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        isOpen ? "bg-red-600 border-red-500 text-white" : "bg-red-500/15 border-red-500/20 text-red-400 hover:bg-red-500/25"}`}>
                      وحدة {g.unit} - درس {g.lesson} ({g.items.length})
                    </button>
                  );
                })}
              </div>
              {openErrKey && (() => {
                const g = errorsByLesson.find(x => `${x.unit}__${x.lesson}` === openErrKey);
                if (!g) return null;
                const qs = [...new Set(g.items.map(e => e.q))].sort((a, b) => a - b);
                return (
                  <div className="mt-2.5 space-y-1.5">
                    {qs.map(q => {
                      const pts = g.items.filter(e => e.q === q).map(e => e.p).sort((a, b) => a - b);
                      return (
                        <div key={q} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-1.5">
                          <span className="text-white text-xs font-bold shrink-0">سؤال {q}</span>
                          <span className="text-red-300 text-xs">نقطة {pts.join("، ")}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
          <ScoreHistoryChart student={s} />
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
        setFinRecords={setFinRecords}
        setAttRecords={setAttRecords}
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
function StudentFormSubmodule({ mode, student: s, defaultGrade, defaultGroup, students, setStudents, setFinRecords, setAttRecords, setSel, setToast, setStep, addActivity, onDoneAdd }) {
  const [name,   setName]   = useState(s.name        || "");
  const [sg,     setSg]     = useState(s.grade        || defaultGrade || "");
  const [sgp,    setSgp]    = useState(s.group        || defaultGroup);
  const [gender, setGender] = useState(s.gender       || "");
  const [pPhone, setPPhone] = useState(s.parentPhone  || "");
  const [sPhone, setSPhone] = useState(s.phone        || "");
  const [fees,   setFees]   = useState(s.totalFees    || 2400);
  const [err,    setErr]    = useState({});

  // ── تسجيل بتاريخ الحضور الفعلي + حساب المطلوب حسب الحصص المتبقية (بس عند الإضافة) ──
  // الفكرة: الرسوم دي رسوم شهرية مقسّمة على عدد حصص الشهر، ولو الطالب
  // منضم في نص الشهر بيدفع بس تمن الحصص الباقية مش الشهر كامل.
  const [joinDate,   setJoinDate]   = useState(s.joinDate || TODAY);
  const [sessionsPerMonth, setSessionsPerMonth] = useState(s.sessionsPerMonth || 12);
  const [remainingSessions, setRemainingSessions] = useState(s.remainingSessions ?? (s.sessionsPerMonth || 12));
  const perSession = sessionsPerMonth > 0 ? (parseInt(fees) || 0) / sessionsPerMonth : 0;
  const owedAmount = Math.round(perSession * (parseInt(remainingSessions) || 0));

  // لو الصفحة دي اتفتحت مباشرة من "إضافة طالب" في الشريط الجانبي، بعد
  // الحفظ أو الإلغاء نرجع للمكان اللي جينا منه (onDoneAdd) بدل "section"
  const finishStep = () => {
    if (mode === "add" && onDoneAdd) { onDoneAdd(); return; }
    setStep(mode === "edit" ? "profile" : "section");
  };

  const save = useCallback(() => {
    const e = {};
    if (!name.trim())    e.name   = "مطلوب";
    if (!sg)             e.grade  = "مطلوب اختيار الصف";
    if (!gender)         e.gender = "مطلوب";
    setErr(e);
    if (Object.keys(e).length) return;

    // لو الطالب لسه من غير أي رقم هاتف حقيقي (لا هاتفه ولا هاتف ولي أمره)،
    // "الرقم المسجل" اللي هيدخل بيه على بوابة الويب ما ينفعش يبقى بنفس
    // شكل رقم تليفون حقيقي (01xxxxxxxxx) عشان محدش يتلخبط ويفتكره رقم
    // فعلي — فبيتولد كود بشكل مختلف واضح (SHR-...) بدل رقم عشوائي شكله رقم تليفون.
    const hasRealPhone = !!(sPhone.trim() || pPhone.trim());
    const st = {
      id: s.id || (hasRealPhone ? genStudentId((students || []).map(x => x.id)) : genSID()),
      name: name.trim(), grade: sg, group: sgp, gender,
      phone: sPhone.trim(), parentName: s.parentName || "", parentPhone: pPhone.trim(),
      joinDate: mode === "add" ? joinDate : (s.joinDate || TODAY), status: s.status || "active",
      paid: s.paid || 0,
      totalFees: mode === "add" ? owedAmount : (parseInt(fees) || 2400),
      sessionsPerMonth: parseInt(sessionsPerMonth) || 12,
      remainingSessions: mode === "add" ? (parseInt(remainingSessions) || 0) : (s.remainingSessions ?? (parseInt(sessionsPerMonth) || 12)),
      score: s.score || 0, present: s.present || 0,
      absent: s.absent || 0, late: s.late || 0, total: s.total || 0,
      weak: s.weak || [],
    };

    if (mode === "add") {
      setStudents(p => [st, ...p]);
    } else {
      setStudents(p => p.map(x => x.id === st.id ? st : x));
      // لو اتغيّر الصف أو المجموعة، حدّث كل سجلات الحضور والمصاريف
      // القديمة بتاعة نفس الطالب تلقائي عشان تفضل تظهر صح لما حد
      // يفتح مجموعته/صفه الجديد (مش تبقى "تايهة" على المجموعة القديمة).
      if (s.id && (s.grade !== st.grade || s.group !== st.group)) {
        setFinRecords?.(p => (p || []).map(r => r.studentId === st.id ? { ...r, grade: st.grade, group: st.group } : r));
        setAttRecords?.(p => (p || []).map(r => r.studentId === st.id ? { ...r, grade: st.grade, group: st.group } : r));
      }
    }
    if (mode === "edit") setSel(st);

    // لو اتسجّل من غير رقم هاتف ولي أمر، بننبّه فورًا هنا + الطالب هيظهر
    // تلقائيًا في قسم "📵 بدون رقم" بالتنبيهات وفي "الطلاب بدون أرقام"
    // في برج المراقبة وفي قسم الطلاب لحد ما يتضاف الرقم.
    const noPhoneWarn = !pPhone.trim() ? " — ⚠️ من غير رقم هاتف ولي أمر" : "";
    setToast({ msg: mode === "add" ? `✓ تم تسجيل ${st.name} — عليه ${fmt(owedAmount)} (${remainingSessions} حصة من ${sessionsPerMonth})${noPhoneWarn}` : `✓ تم تعديل ${st.name}${noPhoneWarn}`, type: !pPhone.trim() ? "info" : "success" });
    addActivity?.(mode === "add" ? "إضافة طالب" : "تعديل طالب", st.name);

    if (mode === "edit") {
      setStep("profile");
    } else {
      // بعد الإضافة نفضل في نفس صفحة "تسجيل طالب" عشان تسجّلي طالب جديد
      // على طول، من غير ما نرجع لصفحة تانية — الصف/المجموعة بيفضلوا
      // زي ما هما (نفس الفصل)، وباقي الحقول بترجع فاضية للطالب الجديد.
      setName(""); setPPhone(""); setSPhone(""); setGender("");
      setErr({});
      setJoinDate(TODAY);
      setRemainingSessions(sessionsPerMonth);
    }
  }, [name, sg, sgp, gender, pPhone, sPhone, fees, mode, students, joinDate, sessionsPerMonth, remainingSessions, owedAmount]);

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
            <Field label="الصف *" error={err.grade}>
              <GradeSelect value={sg} err={!!err.grade} placeholder="اختر الصف"
                onChange={v => { setSg(v); setSgp(GROUPS_MAP[v]?.[0] || "A"); }} />
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
            <Field label="الرسوم الشهرية (ج)"><Inp type="number" value={fees} onChange={e => setFees(e.target.value)} /></Field>
          </div>
        </div>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="النوع *" error={err.gender}>
            <Sel value={gender} err={!!err.gender} onChange={e => setGender(e.target.value)}>
              <option value="">اختر النوع</option>
              <option value="بنت">بنت</option>
              <option value="ولد">ولد</option>
            </Sel>
          </Field>
          <div />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="هاتف ولي الأمر" error={err.pPhone}><Inp value={pPhone} onChange={e => setPPhone(e.target.value)} err={!!err.pPhone} placeholder="اختياري — لو فاضي هيظهر تنبيه" /></Field>
          <Field label="هاتف الطالب"><Inp value={sPhone} onChange={e => setSPhone(e.target.value)} /></Field>
        </div>
      </div>
      {mode === "edit" && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
          <div className="text-slate-400 text-xs font-bold">🔐 دخول الطالب على بوابة "لينك المجموعة"</div>
          <div className="text-slate-500 text-xs">الطالب بيدخل ببياناته هو بس بكتابة اسمه (كامل أو جزء منه) + الرقم المسجل بيه عندنا:</div>
          <div className="flex items-center justify-between bg-slate-900/50 rounded-xl px-3 py-2.5">
            <span className="text-slate-400 text-xs">الرقم المسجل</span>
            <span className="text-emerald-400 font-black text-base" style={{ direction: "ltr" }}>{s.id}</span>
          </div>
          <Btn
            variant="ghost" size="sm" className="w-full"
            onClick={() => {
              const phone = sPhone.trim() || pPhone.trim();
              const link  = waLink(phone, `?text=${encodeURIComponent(`بيانات دخولك على بوابة ${name || "الطالب"}:\nاكتب اسمك: ${name || ""}\nالرقم المسجل: ${s.id}`)}`);
              if (!link) { setToast({ msg: "محتاجة تكتبي رقم هاتف الطالب أو ولي الأمر الأول", type: "error" }); return; }
              window.open(link, "_blank");
            }}
          >📲 ابعتيله رقمه واتساب</Btn>
        </div>
      )}
      {mode === "add" && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
          <div className="text-slate-400 text-xs font-bold">📅 تاريخ الانضمام وحساب المطلوب</div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="تاريخ أول حضور">
              <DatePicker value={joinDate} onChange={setJoinDate} max={TODAY} />
            </Field>
            <Field label="حصص الشهر">
              <Inp type="number" value={sessionsPerMonth} onChange={e => setSessionsPerMonth(e.target.value)} />
            </Field>
            <Field label="الحصص المتبقية">
              <Inp type="number" value={remainingSessions} onChange={e => setRemainingSessions(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center justify-between bg-slate-900/50 rounded-xl px-3 py-2.5">
            <span className="text-slate-400 text-xs">المطلوب دفعه (بعد خصم حصص ما قبل الانضمام)</span>
            <span className="text-emerald-400 font-black text-base">{fmt(owedAmount)}</span>
          </div>
        </div>
      )}
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
