import { useState, useRef, useCallback, useMemo } from "react";
import { GRADES_LIST, GROUPS_MAP, TODAY } from "../../constants";
import { pct, scC, scL, genExamId } from "../../utils";
import { Av, Bar, Toast, Field, Inp, Sel, Btn, DatePicker, Modal } from "../ui";

// ══════════════════════════════════════════════════════════════
// MODULE 4: EXAMS  —  v2 (إصلاح شامل)
// ══════════════════════════════════════════════════════════════

// ─── Panel: بنك الأسئلة ──────────────────────────────────────
function ExamPanelQuestionBank({ questions, setQuestions }) {
  const [search, setSearch]       = useState("");
  const [editing, setEditing]     = useState(null); // null | "new" | questionObj
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast]         = useState(null);
  const [topicFilter, setTopicFilter] = useState("");

  const emptyForm = { text: "", topic: "", marks: 10, options: ["","","",""], correct: 0 };
  const [form, setForm] = useState(emptyForm);

  // الموضوعات المتاحة من الأسئلة الحالية
  const topics = useMemo(() => [...new Set(questions.map(q => q.topic).filter(Boolean))], [questions]);

  const filtered = useMemo(() =>
    questions.filter(q =>
      (q.text.includes(search) || q.topic.includes(search)) &&
      (!topicFilter || q.topic === topicFilter)
    ), [questions, search, topicFilter]);

  const openNew  = () => { setForm(emptyForm); setEditing("new"); };
  const openEdit = q  => { setForm({ text: q.text, topic: q.topic, marks: q.marks, options: [...q.options], correct: q.correct }); setEditing(q); };

  const saveForm = () => {
    // Validation كامل
    if (!form.text.trim()) { setToast({ msg: "أدخل نص السؤال", type: "error" }); return; }
    if (!form.topic.trim()) { setToast({ msg: "أدخل موضوع السؤال", type: "error" }); return; }
    const emptyOpts = form.options.filter(o => !o.trim());
    if (emptyOpts.length > 0) { setToast({ msg: `خيار ${emptyOpts.length > 1 ? "بعض الخيارات" : "خيار"} فارغ — أدخل نص لكل الخيارات`, type: "error" }); return; }
    if (form.marks < 1 || form.marks > 100) { setToast({ msg: "الدرجة يجب أن تكون بين 1 و100", type: "error" }); return; }

    if (editing === "new") {
      setQuestions(p => [...p, { id: `q${Date.now()}`, ...form }]);
      setToast({ msg: "✓ تم إضافة السؤال", type: "success" });
    } else {
      setQuestions(p => p.map(q => q.id === editing.id ? { ...q, ...form } : q));
      setToast({ msg: "✓ تم تعديل السؤال", type: "success" });
    }
    setEditing(null);
  };

  if (editing) return (
    <div className="space-y-4">
      <button onClick={() => setEditing(null)} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
      <h3 className="text-white font-black">{editing === "new" ? "➕ إضافة سؤال جديد" : "✏️ تعديل السؤال"}</h3>

      <Field label="نص السؤال *">
        <Inp value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="اكتب نص السؤال هنا..." />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="الموضوع *">
          <Inp
            value={form.topic}
            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
            placeholder="الجبر، الهندسة..."
            list="topics-list"
          />
          {topics.length > 0 && (
            <datalist id="topics-list">
              {topics.map(t => <option key={t} value={t} />)}
            </datalist>
          )}
        </Field>
        <Field label="الدرجة *">
          <Inp
            type="number" min="1" max="100"
            value={form.marks}
            onChange={e => setForm(f => ({ ...f, marks: Math.max(1, parseInt(e.target.value) || 1) }))}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400 font-medium">الخيارات * (اضغط ✓ لتحديد الإجابة الصحيحة)</label>
        {form.options.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <button
              onClick={() => setForm(f => ({ ...f, correct: i }))}
              className={`w-8 h-8 rounded-xl border shrink-0 text-sm font-bold transition-colors ${
                form.correct === i
                  ? "bg-emerald-500/30 border-emerald-400 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-500 hover:border-emerald-500/40"
              }`}
            >✓</button>
            <Inp
              value={o}
              onChange={e => {
                const ops = [...form.options];
                ops[i] = e.target.value;
                setForm(f => ({ ...f, options: ops }));
              }}
              placeholder={`الخيار ${i + 1} (مطلوب)`}
            />
          </div>
        ))}
        <p className="text-xs text-emerald-500/70 px-1">الإجابة الصحيحة: الخيار {form.correct + 1}</p>
      </div>

      <div className="flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={() => setEditing(null)}>إلغاء</Btn>
        <Btn variant="primary" className="flex-1" onClick={saveForm}>💾 حفظ السؤال</Btn>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* شريط البحث والفلتر */}
      <div className="flex gap-2">
        <Inp value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث في الأسئلة..." className="flex-1" />
        <Btn variant="primary" onClick={openNew}>+ سؤال</Btn>
      </div>

      {topics.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTopicFilter("")}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${!topicFilter ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
          >الكل</button>
          {topics.map(t => (
            <button
              key={t}
              onClick={() => setTopicFilter(t === topicFilter ? "" : t)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${topicFilter === t ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
            >{t}</button>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-500">{filtered.length} سؤال{topicFilter ? ` في "${topicFilter}"` : ""} من {questions.length}</div>

      {/* Empty state */}
      {questions.length === 0 && (
        <div className="text-center py-14 text-slate-600">
          <div className="text-5xl mb-3">📚</div>
          <div className="text-sm font-medium text-slate-500">لا توجد أسئلة بعد</div>
          <div className="text-xs mt-1">اضغط "+ سؤال" لإضافة أول سؤال</div>
        </div>
      )}

      {questions.length > 0 && filtered.length === 0 && (
        <div className="text-center py-10 text-slate-600">
          <div className="text-4xl mb-2">🔍</div>
          <div className="text-sm">لا توجد نتائج للبحث</div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(q => (
          <div key={q.id} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium leading-snug">{q.text}</div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400">{q.topic}</span>
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-700 text-slate-400">{q.marks} درجة</span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(q)} className="w-8 h-8 rounded-xl bg-blue-700/20 text-blue-400 flex items-center justify-center text-sm hover:bg-blue-700/40">✏️</button>
                <button onClick={() => setConfirmDel(q.id)} className="w-8 h-8 rounded-xl bg-red-700/20 text-red-400 flex items-center justify-center text-sm hover:bg-red-700/40">🗑</button>
              </div>
            </div>
            <div className="space-y-1">
              {q.options.map((o, i) => (
                <div key={i} className={`text-xs px-2 py-1.5 rounded-lg ${i === q.correct ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-slate-900/50 text-slate-500"}`}>
                  {i === q.correct ? "✓ " : `${i + 1}. `}{o}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs space-y-4">
            <div className="text-white text-sm text-center font-medium">هل تريد حذف هذا السؤال؟</div>
            <div className="text-slate-400 text-xs text-center">لا يمكن التراجع عن هذه العملية</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm">إلغاء</button>
              <button onClick={() => { setQuestions(p => p.filter(q => q.id !== confirmDel)); setConfirmDel(null); setToast({ msg: "✓ تم حذف السؤال", type: "success" }); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: إنشاء سريع ──────────────────────────────────────
function ExamPanelQuickCreate({ questions, webExams, setWebExams, students }) {
  const [step, setStep]       = useState(1);
  const [grade, setGrade]     = useState(GRADES_LIST[2]);
  const [group, setGroup]     = useState("A");
  const [name, setName]       = useState("");
  const [date, setDate]       = useState(TODAY);
  const [numQ, setNumQ]       = useState(Math.min(5, questions.length || 1));
  const [selQ, setSelQ]       = useState([]);
  const [topicFilter, setTopicFilter] = useState("");
  const [answers, setAnswers] = useState({});
  const [done, setDone]       = useState(false);
  const [score, setScore]     = useState(0);
  const [preview, setPreview] = useState(false);
  const [takerId, setTakerId] = useState("");
  const [toast, setToast]     = useState(null);

  const topics = useMemo(() => [...new Set(questions.map(q => q.topic).filter(Boolean))], [questions]);
  const filteredQs = useMemo(() =>
    topicFilter ? questions.filter(q => q.topic === topicFilter) : questions,
    [questions, topicFilter]
  );
  const grpStudents = useMemo(() => students.filter(s => s.grade === grade && s.group === group), [students, grade, group]);

  const reset = () => { setStep(1); setName(""); setSelQ([]); setAnswers({}); setDone(false); setScore(0); setPreview(false); setTopicFilter(""); setTakerId(""); };

  // بيسجّل نتيجة حقيقية فقط للطالب المحدد كـ "الممتحِن"، مربوطة
  // بالوحدة/الدرس/اليوم بتوع الامتحان — وده مصدر بيانات "الأخطاء" في ملف
  // الطالب. باقي طلاب المجموعة اللي معملوش الامتحان فعليًا مش بيتسجلّهم
  // أي نتيجة خالص (مش رقم عشوائي زي الأول).
  const saveExam = useCallback((finalScore, examQs, finalAnswers) => {
    const totalMarks = examQs.reduce((a, q) => a + q.marks, 0);
    const wrongTopics = examQs.filter(q => finalAnswers[q.id] !== q.correct).map(q => q.topic || "عام");
    const newExam = {
      id: genExamId(),
      name,
      date,
      grade,
      group,
      lesson: topicFilter || "متنوع",
      unit: "إنشاء سريع",
      results: [{ studentId: takerId, score: finalScore, max: totalMarks, wrong: wrongTopics }],
      cheating: [],
      _myScore: finalScore,
      _myMax: totalMarks,
    };
    setWebExams(p => [newExam, ...p]);
    setToast({ msg: "✓ تم حفظ نتائج الامتحان", type: "success" });
  }, [name, date, grade, group, topicFilter, takerId, setWebExams]);

  // Step 1: الإعداد
  if (step === 1) {
    const maxQ = questions.length;
    if (maxQ === 0) return (
      <div className="text-center py-14 text-slate-600">
        <div className="text-5xl mb-3">📚</div>
        <div className="text-sm font-medium text-slate-500">لا توجد أسئلة في بنك الأسئلة</div>
        <div className="text-xs mt-1">أضف أسئلة أولاً من "بنك الأسئلة"</div>
      </div>
    );
    return (
      <div className="space-y-4">
        <h3 className="text-white font-black">⚡ إنشاء امتحان سريع</h3>
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
          <Field label="اسم الامتحان *">
            <Inp value={name} onChange={e => setName(e.target.value)} placeholder="امتحان الجبر الشهري..." />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="الصف">
              <Sel value={grade} onChange={e => { setGrade(e.target.value); setGroup(GROUPS_MAP[e.target.value]?.[0] || "A"); }}>
                {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
              </Sel>
            </Field>
            <Field label="المجموعة">
              <Sel value={group} onChange={e => setGroup(e.target.value)}>
                {(GROUPS_MAP[grade] || ["A"]).map(g => <option key={g}>{g}</option>)}
              </Sel>
            </Field>
          </div>
          <Field label="التاريخ">
            <DatePicker value={date} onChange={d => setDate(d)} max={TODAY} />
          </Field>
          <Field label="الطالب (اختياري — لتسجيل نتيجته الحقيقية وربطها بملفه)">
            <Sel value={takerId} onChange={e => setTakerId(e.target.value)}>
              <option value="">بدون ربط (تقدير عام للمجموعة)</option>
              {grpStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Sel>
          </Field>
          <Field label={`عدد الأسئلة: ${numQ} (من ${maxQ} متاح)`}>
            <input
              type="range" min={1} max={maxQ}
              value={Math.min(numQ, maxQ)}
              onChange={e => setNumQ(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>1</span><span>{maxQ}</span>
            </div>
          </Field>
        </div>
        <Btn variant="primary" size="lg" className="w-full" disabled={!name.trim()} onClick={() => setStep(2)}>
          التالي ← اختيار الأسئلة
        </Btn>
      </div>
    );
  }

  // Step 2: اختيار الأسئلة
  if (step === 2) return (
    <div className="space-y-4">
      <button onClick={() => setStep(1)} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
      <div className="flex items-center justify-between">
        <h3 className="text-white font-black">اختر الأسئلة ({selQ.length}/{numQ})</h3>
        <button
          onClick={() => {
            const random = [...questions].sort(() => Math.random() - 0.5).slice(0, numQ).map(q => q.id);
            setSelQ(random);
          }}
          className="text-xs px-3 py-1.5 rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/20"
        >🎲 عشوائي</button>
      </div>

      {topics.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTopicFilter("")} className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${!topicFilter ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>الكل</button>
          {topics.map(t => (
            <button key={t} onClick={() => setTopicFilter(t === topicFilter ? "" : t)} className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${topicFilter === t ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>{t}</button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-slate-800 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(selQ.length / numQ) * 100}%` }} />
      </div>

      <div className="space-y-2">
        {filteredQs.map(q => {
          const isSel = selQ.includes(q.id);
          const isDisabled = !isSel && selQ.length >= numQ;
          return (
            <button
              key={q.id}
              onClick={() => setSelQ(p => isSel ? p.filter(x => x !== q.id) : (p.length < numQ ? [...p, q.id] : p))}
              disabled={isDisabled}
              className={`w-full text-right p-3 rounded-xl border transition-colors ${
                isSel ? "bg-blue-600/20 border-blue-500/40"
                : isDisabled ? "bg-slate-800/30 border-slate-700/20 opacity-40 cursor-not-allowed"
                : "bg-slate-800/60 border-slate-700/40 hover:border-blue-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 ${isSel ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-500"}`}>{isSel ? "✓" : ""}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium">{q.text}</div>
                  <div className="text-slate-500 text-xs">{q.topic} · {q.marks} درجة</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Btn variant="success" size="lg" className="w-full" disabled={selQ.length === 0} onClick={() => setStep(3)}>
        🚀 بدء الامتحان ({selQ.length} أسئلة · {questions.filter(q => selQ.includes(q.id)).reduce((a, q) => a + q.marks, 0)} درجة)
      </Btn>
    </div>
  );

  // Step 3: الامتحان
  const examQs = questions.filter(q => selQ.includes(q.id));
  const totalMarks = examQs.reduce((a, q) => a + q.marks, 0);

  if (step === 3 && !done) {
    const answeredCount = Object.keys(answers).length;
    const remaining = examQs.length - answeredCount;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setStep(2)} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
          <div className="text-xs text-slate-400">{remaining > 0 ? `${remaining} سؤال متبقي` : "✓ أجبت على كل الأسئلة"}</div>
        </div>

        {/* Progress */}
        <div className="bg-slate-800 rounded-full h-1.5">
          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / examQs.length) * 100}%` }} />
        </div>

        <div className="bg-gradient-to-br from-blue-900/40 to-violet-900/30 border border-blue-500/20 rounded-2xl p-3">
          <div className="text-white font-black text-sm">{name}</div>
          <div className="text-slate-400 text-xs">{grade} · مج. {group} · {date} · {totalMarks} درجة</div>
        </div>

        {examQs.map((q, i) => (
          <div key={q.id} className={`bg-slate-800/60 border rounded-2xl p-4 space-y-3 transition-colors ${answers[q.id] !== undefined ? "border-emerald-500/20" : "border-slate-700/40"}`}>
            <div className="flex justify-between text-xs text-slate-500">
              <span>س{i + 1} · {q.topic}</span>
              <span>{answers[q.id] !== undefined ? "✓ تمت الإجابة" : `${q.marks} درجة`}</span>
            </div>
            <div className="text-white text-sm font-medium">{q.text}</div>
            <div className="space-y-2">
              {q.options.map((o, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                  className={`w-full text-right py-2.5 px-3 rounded-xl border text-sm transition-colors ${
                    answers[q.id] === oi
                      ? "bg-blue-600/30 border-blue-400 text-white"
                      : "bg-slate-900/50 border-slate-700/40 text-slate-300 hover:border-blue-500/30"
                  }`}
                >
                  <span className="text-slate-500 ml-2">{oi + 1}.</span>{o}
                </button>
              ))}
            </div>
          </div>
        ))}

        <Btn
          variant="success" size="lg" className="w-full"
          disabled={answeredCount < examQs.length}
          onClick={() => {
            let s = 0;
            examQs.forEach(q => { if (answers[q.id] === q.correct) s += q.marks; });
            setScore(s);
            setDone(true);
            saveExam(s, examQs, answers);
          }}
        >
          تسليم ({answeredCount}/{examQs.length})
          {answeredCount < examQs.length && ` — أجب على ${remaining} سؤال`}
        </Btn>
      </div>
    );
  }

  // النتيجة النهائية
  return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <div className="text-4xl font-black" style={{ color: scC(pct(score, totalMarks)) }}>{score}/{totalMarks}</div>
        <div className="text-slate-400 text-sm mt-1">{pct(score, totalMarks)}% · {scL(pct(score, totalMarks))}</div>
        <div className="text-slate-500 text-xs mt-2">{name} · {date}</div>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setPreview(v => !v)}
        className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700/40 text-slate-300 text-sm"
      >{preview ? "▲ إخفاء" : "▼ عرض"} تفاصيل الإجابات</button>

      {preview && examQs.map(q => {
        const c = answers[q.id] === q.correct;
        return (
          <div key={q.id} className={`border rounded-xl p-3 space-y-2 ${c ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <div className="flex gap-2">
              <span>{c ? "✅" : "❌"}</span>
              <div className="flex-1">
                <div className="text-white text-sm">{q.text}</div>
                <div className="text-xs mt-1 text-slate-400">إجابتك: {q.options[answers[q.id]]}</div>
                {!c && <div className="text-emerald-400 text-xs">الصحيح: {q.options[q.correct]}</div>}
              </div>
              <div className={`text-xs font-black shrink-0 ${c ? "text-emerald-400" : "text-red-400"}`}>{c ? `+${q.marks}` : "0"}</div>
            </div>
          </div>
        );
      })}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <Btn variant="primary" size="lg" className="w-full" onClick={reset}>↩ امتحان جديد</Btn>
    </div>
  );
}

// ─── Panel: رفع امتحان ──────────────────────────────────────
function ExamPanelUpload({ centerExams, setCenterExams }) {
  const [file, setFile]     = useState(null);
  const [grade, setGrade]   = useState(GRADES_LIST[2]);
  const [group, setGroup]   = useState("A");
  const [examName, setExamName] = useState("");
  const [sheets, setSheets] = useState("");
  const [toast, setToast]   = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const ref = useRef(null);

  const handle = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const maxSize = 20 * 1024 * 1024;
    if (f.size > maxSize) { setToast({ msg: "الملف أكبر من 20MB", type: "error" }); e.target.value = ""; return; }
    setFile(f);
    if (!examName) setExamName(f.name.replace(/\.[^/.]+$/, ""));
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!file) { setToast({ msg: "اختر ملفاً أولاً", type: "error" }); return; }
    if (!examName.trim()) { setToast({ msg: "أدخل اسم الامتحان", type: "error" }); return; }

    const newExam = {
      id: genExamId(),
      name: examName.trim(),
      grade,
      group,
      date: TODAY,
      sheets: parseInt(sheets) || 0,
      status: "needs_review",
      corrector: "",
      fileName: file.name,
      fileSize: file.size,
    };
    setCenterExams(p => [newExam, ...p]);
    setSubmitted(true);
    setToast({ msg: "✓ تم رفع الامتحان وإضافته للمراجعة", type: "success" });
  };

  if (submitted) return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
        <div className="text-5xl mb-3">✅</div>
        <div className="text-white font-black">{examName}</div>
        <div className="text-slate-400 text-sm mt-1">تم الإرسال للمراجعة</div>
      </div>
      <Btn variant="primary" size="lg" className="w-full" onClick={() => { setFile(null); setExamName(""); setSheets(""); setSubmitted(false); }}>
        📤 رفع امتحان آخر
      </Btn>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-white font-black">📤 رفع امتحان جاهز</h3>

      {/* Upload zone */}
      <div
        onClick={() => ref.current?.click()}
        className="border-2 border-dashed border-slate-600/60 hover:border-blue-500/50 rounded-2xl p-8 text-center cursor-pointer transition-colors group"
      >
        <div className="text-5xl mb-3">📁</div>
        <div className="text-slate-300 font-medium group-hover:text-white transition-colors">اضغط لاختيار الملف</div>
        <div className="text-slate-600 text-xs mt-1">PDF · DOCX · XLSX · حد أقصى 20MB</div>
      </div>
      <input ref={ref} type="file" accept=".pdf,.docx,.xlsx,.doc" className="hidden" onChange={handle} />

      {file && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-3xl">📄</span>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate">{file.name}</div>
            <div className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
          <button onClick={() => setFile(null)} className="text-red-400 text-lg hover:text-red-300">🗑</button>
        </div>
      )}

      {/* بيانات الامتحان */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <Field label="اسم الامتحان *">
          <Inp value={examName} onChange={e => setExamName(e.target.value)} placeholder="امتحان نصف الترم..." />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="الصف">
            <Sel value={grade} onChange={e => { setGrade(e.target.value); setGroup(GROUPS_MAP[e.target.value]?.[0] || "A"); }}>
              {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
            </Sel>
          </Field>
          <Field label="المجموعة">
            <Sel value={group} onChange={e => setGroup(e.target.value)}>
              {(GROUPS_MAP[grade] || ["A"]).map(g => <option key={g}>{g}</option>)}
            </Sel>
          </Field>
        </div>
        <Field label="عدد الأوراق (اختياري)">
          <Inp type="number" min="0" value={sheets} onChange={e => setSheets(e.target.value)} placeholder="0" />
        </Field>
      </div>

      <Btn variant="success" size="lg" className="w-full" disabled={!file || !examName.trim()} onClick={handleSubmit}>
        🚀 إرسال للمراجعة
      </Btn>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Panel: التنبيهات ────────────────────────────────────────
// ─── وحدات/دروس كل صف — كل الصفوف 4 وحدات × 6 دروس، ما عدا
// "ثالثة ثانوي" حالة استثنائية: 8 وحدات × 6 دروس ────────────────
const unitsCountFor = grade => grade === "ثالثة ثانوي" ? 8 : 4;
const LESSONS_COUNT = 6;

// ─── ورقة تسجيل خطأ سؤال لطالب معيّن ────────────────────────
function StudentErrorSheet({ student, grade, unit, lesson, setStudents, addActivity, centerExams, onClose }) {
  const [toast,   setToast]   = useState(null);

  const tag = `و${unit} - د${lesson}`;
  const linkedExam = (centerExams || []).find(e => e.grade === grade && String(e.unit) === String(unit) && String(e.lesson) === String(lesson)) || null;
  // عدد الأسئلة وعدد النقط بيجوا أوتوماتيك من الامتحان المرفوع لنفس الصف/الوحدة/الدرس
  const numQ   = linkedExam?.numQuestions      || 0;
  const numPts = linkedExam?.pointsPerQuestion || 0;
  const errors = (student.examErrors || []).filter(e => e.grade === grade && e.unit === unit && e.lesson === lesson);

  const markPoint = (q, p) => {
    const label = `${tag} - سؤال ${q} (نقطة ${p})`;
    const already = errors.some(e => e.q === q && e.p === p);
    setStudents(prev => (prev || []).map(s => {
      if (s.id !== student.id) return s;
      const newErrors = already
        ? (s.examErrors || []).filter(e => !(e.grade === grade && e.unit === unit && e.lesson === lesson && e.q === q && e.p === p))
        : [...(s.examErrors || []), { id: Date.now() + Math.random(), grade, unit, lesson, q, p, examId: linkedExam?.id || null, ts: new Date().toISOString() }];
      const newWeak = already
        ? (s.weak || []).filter(w => w !== label)
        : ((s.weak || []).includes(label) ? (s.weak || []) : [...(s.weak || []), label]);
      return { ...s, examErrors: newErrors, weak: newWeak };
    }));
    addActivity?.(already ? "إلغاء خطأ سؤال" : "خطأ سؤال", `${student.name} — ${label}`);
    setToast({ msg: already ? `تم إلغاء: سؤال ${q} - نقطة ${p}` : `✓ اتسجّل: سؤال ${q} - نقطة ${p}`, type: already ? "info" : "success" });
  };

  const removeError = e => {
    setStudents(prev => (prev || []).map(s => {
      if (s.id !== student.id) return s;
      const label = `${tag} - سؤال ${e.q} (نقطة ${e.p})`;
      return {
        ...s,
        examErrors: (s.examErrors || []).filter(x => x.id !== e.id),
        weak: (s.weak || []).filter(w => w !== label),
      };
    }));
  };

  return (
    <Modal title={`📝 ${student.name} — ${tag}`} onClose={onClose} maxW="max-w-lg">
      <div className="space-y-4">
        {linkedExam
          ? <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-emerald-300 text-xs text-center">📎 مربوط بامتحان: {linkedExam.fileName} — {numQ} سؤال × {numPts} نقط</div>
          : <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-amber-300 text-xs text-center">⚠️ لا يوجد امتحان مرفوع لهذه الوحدة/الدرس بعد — ارفعي الامتحان أولًا من قسم "الامتحانات" وحددي عدد الأسئلة والنقط عشان تقدري تسجّلي الأخطاء هنا</div>}

        {linkedExam && (
        <div>
          <div className="text-xs text-slate-400 font-bold mb-2">دوسي على ✓ جنب رقم النقطة الغلط في كل سؤال — دوسي تاني عليها لو غلطتِ عشان تلغيها</div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {Array.from({ length: numQ }, (_, i) => i + 1).map(q => (
              <div key={q} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-white shrink-0 w-14">سؤال {q}</span>
                <div className="flex gap-1.5 flex-wrap flex-1">
                  {Array.from({ length: numPts }, (_, j) => j + 1).map(p => {
                    const isMarked = errors.some(e => e.q === q && e.p === p);
                    return (
                      <button key={p} onClick={() => markPoint(q, p)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          isMarked ? "bg-red-600 text-white" : "bg-slate-900 border border-slate-700/50 text-slate-300 hover:bg-red-700/40"}`}>
                        <span>{p}</span>
                        <span className={isMarked ? "text-white" : "text-slate-500"}>✓</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {errors.length > 0 && (
          <div>
            <div className="text-xs text-red-400 font-bold mb-2">الأخطاء المسجَّلة في هذا الدرس ({errors.length})</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {errors.map(e => (
                <div key={e.id} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                  <span className="text-red-300 text-xs">سؤال {e.q} — نقطة {e.p}</span>
                  <button onClick={() => removeError(e)} className="text-slate-500 hover:text-white text-xs px-2">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Btn variant="ghost" className="w-full" onClick={onClose}>إغلاق</Btn>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    </Modal>
  );
}

// ─── تسجيل أخطاء الأسئلة: صف ← وحدة ← درس ← جدول طلاب الصف ─────
function ExamErrorEntry({ students, setStudents, addActivity, centerExams }) {
  const [grade,   setGrade]   = useState("");
  const [unit,    setUnit]    = useState("");
  const [lesson,  setLesson]  = useState("");
  const [openStudent, setOpenStudent] = useState(null);

  const maxUnits = grade ? unitsCountFor(grade) : 0;
  const gradeStudents = useMemo(() => students.filter(s => s.grade === grade), [students, grade]);

  const errCountFor = s => (s.examErrors || []).filter(e => e.grade === grade && e.unit === unit && e.lesson === lesson).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Field label="الصف">
          <select value={grade} onChange={e => { setGrade(e.target.value); setUnit(""); setLesson(""); }}
            className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none">
            <option value="">— اختر —</option>
            {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="الوحدة">
          <select value={unit} onChange={e => setUnit(e.target.value)} disabled={!grade}
            className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none disabled:opacity-40">
            <option value="">— اختر —</option>
            {Array.from({ length: maxUnits }, (_, i) => i + 1).map(u => <option key={u} value={u}>وحدة {u}</option>)}
          </select>
        </Field>
        <Field label="الدرس">
          <select value={lesson} onChange={e => setLesson(e.target.value)} disabled={!unit}
            className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none disabled:opacity-40">
            <option value="">— اختر —</option>
            {Array.from({ length: LESSONS_COUNT }, (_, i) => i + 1).map(l => <option key={l} value={l}>درس {l}</option>)}
          </select>
        </Field>
      </div>

      {grade === "ثالثة ثانوي" && (
        <div className="text-amber-400 text-xs text-center">ملحوظة: ثالثة ثانوي عندها 8 وحدات (حالة استثنائية).</div>
      )}

      {grade && unit && lesson && (
        gradeStudents.length === 0
          ? <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">📭</div><div className="text-sm">لا يوجد طلاب في هذا الصف</div></div>
          : <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden divide-y divide-slate-700/40">
              {gradeStudents.map(s => {
                const n = errCountFor(s);
                return (
                  <button key={s.id} onClick={() => setOpenStudent(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800 transition-colors text-right">
                    <Av name={s.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-bold truncate">{s.name}</div>
                      <div className="text-slate-500" style={{ fontSize: "10px" }}>{s.group ? `مجموعة ${s.group}` : ""}</div>
                    </div>
                    {n > 0 && <span className="text-xs px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400 shrink-0">{n} خطأ</span>}
                    <span className="text-slate-500 text-xs shrink-0">تسجيل ›</span>
                  </button>
                );
              })}
            </div>
      )}
      {(!grade || !unit || !lesson) && (
        <div className="text-center py-10 text-slate-600"><div className="text-5xl mb-3">📝</div><div className="text-sm">اختاري الصف ثم الوحدة ثم الدرس</div></div>
      )}

      {openStudent && (
        <StudentErrorSheet
          student={openStudent} grade={grade} unit={unit} lesson={lesson}
          setStudents={setStudents} addActivity={addActivity} centerExams={centerExams}
          onClose={() => setOpenStudent(null)}
        />
      )}
    </div>
  );
}

function ExamPanelAlerts({ students, setStudents, addActivity, centerExams }) {
  const [tab, setTab] = useState("record"); // record = تسجيل الأخطاء (الافتراضي الجديد) | notif = التنبيهات القديمة
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
        <button onClick={() => setTab("record")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${tab === "record" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"}`}>
          🎯 تسجيل أخطاء الأسئلة
        </button>
        <button onClick={() => setTab("notif")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${tab === "notif" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"}`}>
          🔔 التنبيهات
        </button>
      </div>
      {tab === "record" && <ExamErrorEntry students={students} setStudents={setStudents} addActivity={addActivity} centerExams={centerExams} />}
      {tab === "notif"  && <ExamPanelAlertsOld students={students} />}
    </div>
  );
}

function ExamPanelAlertsOld({ students }) {
  const [toast, setToast] = useState(null);
  const [sentAll, setSentAll] = useState(false);

  const lowScore   = useMemo(() => students.filter(s => s.score < 60), [students]);
  const highAbsent = useMemo(() => students.filter(s => pct(s.absent, s.total) > 20), [students]);
  const allAlerts  = useMemo(() => [...new Map([...lowScore, ...highAbsent].map(s => [s.id, s])).values()], [lowScore, highAbsent]);

  const notify = (s, type) => {
    const msgs = {
      score:  `تنبيه: مستوى ${s.name} في الامتحانات (${s.score}%) يحتاج تحسين.`,
      absent: `تنبيه: نسبة غياب ${s.name} مرتفعة (${pct(s.absent, s.total)}%).`,
    };
    setToast({ msg: `✓ تم إرسال تنبيه لـ ${s.name}`, type: "success" });
    console.log("WhatsApp message:", msgs[type]);
  };

  const notifyAll = () => {
    setSentAll(true);
    setToast({ msg: `✓ تم إرسال ${allAlerts.length} تنبيه`, type: "success" });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-white font-black">🔔 نظام التنبيهات</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-900/30 border border-red-700/20 rounded-2xl p-3 text-center">
          <div className="text-2xl font-black text-red-400">{lowScore.length}</div>
          <div className="text-xs text-slate-400">مستوى منخفض</div>
        </div>
        <div className="bg-amber-900/30 border border-amber-700/20 rounded-2xl p-3 text-center">
          <div className="text-2xl font-black text-amber-400">{highAbsent.length}</div>
          <div className="text-xs text-slate-400">غياب مرتفع</div>
        </div>
      </div>

      {allAlerts.length > 0 && (
        <Btn
          variant={sentAll ? "ghost" : "success"}
          className="w-full"
          disabled={sentAll}
          onClick={notifyAll}
        >
          {sentAll ? "✓ تم الإرسال للجميع" : `💬 إرسال تنبيه للجميع (${allAlerts.length})`}
        </Btn>
      )}

      {lowScore.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-red-400 font-bold px-1">📉 مستوى منخفض (أقل من 60%)</div>
          {lowScore.map(s => (
            <div key={s.id} className="bg-slate-800/60 border border-red-500/20 rounded-xl px-3 py-2.5 flex items-center gap-3">
              <Av name={s.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-bold truncate">{s.name}</div>
                <div className="text-red-400 text-xs">{s.score}%</div>
              </div>
              <button onClick={() => notify(s, "score")} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-700/30 text-green-300 shrink-0">💬</button>
            </div>
          ))}
        </div>
      )}

      {highAbsent.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-amber-400 font-bold px-1">📅 غياب مرتفع (أكثر من 20%)</div>
          {highAbsent.map(s => (
            <div key={s.id} className="bg-slate-800/60 border border-amber-500/20 rounded-xl px-3 py-2.5 flex items-center gap-3">
              <Av name={s.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-bold truncate">{s.name}</div>
                <div className="text-amber-400 text-xs">{pct(s.absent, s.total)}% غياب</div>
              </div>
              <button onClick={() => notify(s, "absent")} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-700/30 text-green-300 shrink-0">💬</button>
            </div>
          ))}
        </div>
      )}

      {allAlerts.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          <div className="text-5xl mb-3">✅</div>
          <div className="text-sm font-medium text-slate-400">لا توجد تنبيهات حالياً</div>
          <div className="text-xs mt-1">جميع الطلاب بمستوى جيد</div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Panel: ربط بالمحتوى ────────────────────────────────────
function ExamPanelCurriculum({ webExams, students }) {
  const [selGrade, setSelGrade] = useState(GRADES_LIST[2]);
  const [selGroup, setSelGroup] = useState("A");
  const [selExam, setSelExam]   = useState(null);
  const [activeTab, setActiveTab] = useState("results");

  const filtW = useMemo(() =>
    webExams.filter(e => e.grade === selGrade && e.group === selGroup),
    [webExams, selGrade, selGroup]
  );

  const getStats = useCallback(ex => {
    const sc = ex.results.map(r => pct(r.score, r.max));
    if (!sc.length) return { avg: 0, pass: 0 };
    return {
      avg:  Math.round(sc.reduce((a, v) => a + v, 0) / sc.length),
      pass: Math.round(sc.filter(s => s >= 50).length / sc.length * 100),
    };
  }, []);

  const getName = useCallback(id => students.find(s => s.id === id)?.name || id, [students]);

  if (selExam) {
    const stats  = getStats(selExam);
    const ranked = [...selExam.results].sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelExam(null); setActiveTab("results"); }} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
        <div className="bg-gradient-to-br from-violet-900/40 to-blue-900/30 border border-violet-500/20 rounded-2xl p-4">
          <div className="text-white font-black">{selExam.name}</div>
          <div className="text-slate-400 text-xs mt-1">{selExam.date} · {selExam.lesson} · {selExam.unit}</div>
        </div>

        <div className="flex gap-2">
          {[["results","النتائج"],["cheating","الغش"],["stats","إحصائيات"]].map(([k, v]) => (
            <button key={k} onClick={() => setActiveTab(k)} className={`px-3 py-2 rounded-xl text-xs ${activeTab === k ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400"}`}>{v}</button>
          ))}
        </div>

        {activeTab === "results" && (
          <div className="space-y-2">
            {ranked.length === 0 ? (
              <div className="text-center py-8 text-slate-600"><div className="text-3xl mb-2">📊</div>لا توجد نتائج</div>
            ) : ranked.map(r => {
              const p = pct(r.score, r.max);
              return (
                <div key={r.studentId} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                    r.rank === 1 ? "bg-amber-500/20 text-amber-400"
                    : r.rank === 2 ? "bg-slate-400/20 text-slate-300"
                    : r.rank === 3 ? "bg-orange-700/20 text-orange-400"
                    : "bg-slate-800 text-slate-500"
                  }`}>{r.rank}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{getName(r.studentId)}</div>
                    <Bar value={r.score} max={r.max} />
                  </div>
                  <div className="font-black text-sm shrink-0" style={{ color: scC(p) }}>{p}%</div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "cheating" && (
          <div>
            {selExam.cheating.length === 0
              ? <div className="text-center py-8 text-slate-600"><div className="text-4xl mb-2">✅</div>لا مخالفات مسجلة</div>
              : selExam.cheating.map((c, i) => (
                <div key={i} className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex gap-3">
                  <Av name={getName(c.studentId)} size="sm" />
                  <div className="flex-1"><div className="text-white text-sm">{getName(c.studentId)}</div><div className="text-red-400 text-xs">{c.violation}</div></div>
                  <div className="text-red-400 font-black">{c.count}x</div>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "المتوسط",  v: `${stats.avg}%`,        c: "text-blue-400"    },
                { l: "نسبة النجاح", v: `${stats.pass}%`,   c: "text-emerald-400" },
                { l: "عدد الطلاب", v: selExam.results.length, c: "text-violet-400"},
                { l: "مخالفات", v: selExam.cheating.length, c: selExam.cheating.length > 0 ? "text-red-400" : "text-slate-500" },
              ].map(s => (
                <div key={s.l} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-black ${s.c}`}>{s.v}</div>
                  <div className="text-xs text-slate-400 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
            {/* Mini bar chart للنتائج */}
            {selExam.results.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
                <div className="text-xs text-slate-400 mb-3 font-medium">توزيع الدرجات</div>
                {[
                  { label: "ممتاز (85%+)",  min: 85, color: "bg-emerald-500" },
                  { label: "جيد (65-84%)",  min: 65, color: "bg-blue-500"    },
                  { label: "مقبول (50-64%)",min: 50, color: "bg-amber-500"   },
                  { label: "ضعيف (<50%)",   min: 0,  color: "bg-red-500"     },
                ].map((band, bi, arr) => {
                  const max = arr[bi - 1]?.min ?? 101;
                  const count = selExam.results.filter(r => {
                    const p = pct(r.score, r.max);
                    return p >= band.min && p < max;
                  }).length;
                  const w = selExam.results.length ? (count / selExam.results.length) * 100 : 0;
                  return (
                    <div key={band.label} className="flex items-center gap-2 mb-1.5">
                      <div className="text-xs text-slate-500 w-24 shrink-0 text-right">{band.label}</div>
                      <div className="flex-1 bg-slate-700/40 rounded-full h-4 overflow-hidden">
                        <div className={`h-full ${band.color} rounded-full transition-all`} style={{ width: `${w}%` }} />
                      </div>
                      <div className="text-xs text-slate-400 w-6 text-center">{count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-black">🔗 ربط الامتحان بالمحتوى</h3>
      <div className="flex gap-2">
        <div className="flex-1">
          <Sel value={selGrade} onChange={e => { setSelGrade(e.target.value); setSelGroup(GROUPS_MAP[e.target.value]?.[0] || "A"); }}>
            {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
          </Sel>
        </div>
        <div style={{ width: "100px" }}>
          <Sel value={selGroup} onChange={e => setSelGroup(e.target.value)}>
            {(GROUPS_MAP[selGrade] || ["A"]).map(g => <option key={g}>مج. {g}</option>)}
          </Sel>
        </div>
      </div>

      {filtW.length === 0
        ? <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">🔗</div>لا توجد امتحانات لهذه المجموعة</div>
        : filtW.map(e => {
          const s = getStats(e);
          return (
            <div key={e.id} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
              <div className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div><div className="text-white font-black text-sm">{e.name}</div><div className="text-slate-400 text-xs">{e.date}</div></div>
                  <div className="font-black text-sm" style={{ color: scC(s.avg) }}>{s.avg}%</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400">📖 {e.lesson}</span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-violet-500/15 text-violet-400">📚 {e.unit}</span>
                </div>
              </div>
              <button onClick={() => setSelExam(e)} className="w-full py-2.5 bg-violet-600/20 hover:bg-violet-600/40 border-t border-slate-700/40 text-violet-300 text-sm font-medium">عرض النتائج ←</button>
            </div>
          );
        })
      }
    </div>
  );
}

// ─── Panel: لوحة التحكم ─────────────────────────────────────
function ExamPanelDashboard({ questions, webExams, centerExams, setCenterExams, students }) {
  const [correction, setCorrection] = useState(null);  // centerExam object
  const [answers, setAnswers]       = useState({});
  const [done, setDone]             = useState(false);
  const [score, setScore]           = useState(0);
  const [toast, setToast]           = useState(null);

  const needsCorrection = useMemo(() => centerExams.filter(e => e.status === "needs_correction"), [centerExams]);
  const needsReview     = useMemo(() => centerExams.filter(e => e.status === "needs_review"),     [centerExams]);
  const totalExams      = webExams.length + centerExams.length;
  const avgScore        = useMemo(() =>
    students.length ? Math.round(students.reduce((a, s) => a + s.score, 0) / students.length) : 0,
    [students]
  );

  // الأسئلة المرتبطة بالامتحان: إذا كان للامتحان أسئلة محددة استخدمها، وإلا استخدم كل البنك
  const correctionQs = useMemo(() => {
    if (!correction) return [];
    if (correction.questionIds?.length) {
      return questions.filter(q => correction.questionIds.includes(q.id));
    }
    return questions; // استخدام كل البنك كـ fallback
  }, [correction, questions]);

  const totalCorrMarks = useMemo(() =>
    correctionQs.reduce((a, q) => a + q.marks, 0),
    [correctionQs]
  );

  const markCorrected = useCallback((examId, finalScore) => {
    setCenterExams(p => p.map(e =>
      e.id === examId
        ? { ...e, status: "needs_review", corrector: "المعلم", correctionDate: TODAY, _score: finalScore, _max: totalCorrMarks }
        : e
    ));
  }, [setCenterExams, totalCorrMarks]);

  // شاشة نتيجة التصحيح
  if (correction && done) return (
    <div className="space-y-4">
      <button onClick={() => { setCorrection(null); setAnswers({}); setDone(false); setScore(0); }} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
        <div className="text-5xl mb-2">✅</div>
        <div className="text-4xl font-black" style={{ color: scC(pct(score, totalCorrMarks)) }}>
          {score}/{totalCorrMarks}
        </div>
        <div className="text-slate-400 text-sm">{pct(score, totalCorrMarks)}% · {scL(pct(score, totalCorrMarks))}</div>
        <div className="text-slate-500 text-xs mt-2">{correction.name}</div>
      </div>

      {correctionQs.map(q => {
        const c = answers[q.id] === q.correct;
        return (
          <div key={q.id} className={`border rounded-xl p-3 flex gap-2 ${c ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <span>{c ? "✅" : "❌"}</span>
            <div className="flex-1">
              <div className="text-white text-sm">{q.text}</div>
              <div className="text-xs text-slate-400 mt-0.5">إجابتك: {q.options[answers[q.id]]}</div>
              {!c && <div className="text-red-400 text-xs mt-0.5">الصحيح: {q.options[q.correct]}</div>}
            </div>
            <div className={`text-xs font-black shrink-0 ${c ? "text-emerald-400" : "text-red-400"}`}>{c ? `+${q.marks}` : "0"}</div>
          </div>
        );
      })}

      <Btn variant="primary" size="lg" className="w-full" onClick={() => { setCorrection(null); setAnswers({}); setDone(false); setScore(0); }}>
        حفظ وإغلاق
      </Btn>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );

  // شاشة التصحيح
  if (correction) {
    if (correctionQs.length === 0) return (
      <div className="space-y-4">
        <button onClick={() => setCorrection(null)} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
        <div className="text-center py-10 text-slate-600">
          <div className="text-4xl mb-2">📚</div>
          <div className="text-sm">لا توجد أسئلة في بنك الأسئلة</div>
          <div className="text-xs mt-1">أضف أسئلة لتتمكن من التصحيح</div>
        </div>
      </div>
    );

    const answeredCount = Object.keys(answers).length;
    return (
      <div className="space-y-4">
        <button onClick={() => setCorrection(null)} className="text-slate-400 text-sm flex items-center gap-1">← رجوع</button>
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
          <div className="text-white font-black text-sm">{correction.name}</div>
          <div className="text-slate-400 text-xs">{correction.sheets} ورقة · {correctionQs.length} سؤال · {totalCorrMarks} درجة</div>
        </div>

        {/* Progress */}
        <div className="bg-slate-800 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / correctionQs.length) * 100}%` }} />
        </div>

        {correctionQs.map((q, i) => (
          <div key={q.id} className={`bg-slate-800/60 border rounded-2xl p-4 space-y-3 ${answers[q.id] !== undefined ? "border-emerald-500/20" : "border-slate-700/40"}`}>
            <div className="flex justify-between text-xs text-slate-500">
              <span>س{i + 1} · {q.topic}</span>
              <span>{answers[q.id] !== undefined ? "✓" : `${q.marks} درجة`}</span>
            </div>
            <div className="text-white text-sm font-medium">{q.text}</div>
            <div className="space-y-2">
              {q.options.map((o, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                  className={`w-full text-right py-2.5 px-3 rounded-xl border text-sm transition-colors ${
                    answers[q.id] === oi
                      ? "bg-blue-600/30 border-blue-400 text-white"
                      : "bg-slate-900/50 border-slate-700/40 text-slate-300 hover:border-blue-500/30"
                  }`}
                >
                  <span className="text-slate-500 ml-2">{oi + 1}.</span>{o}
                </button>
              ))}
            </div>
          </div>
        ))}

        <Btn
          variant="success" size="lg" className="w-full"
          disabled={answeredCount < correctionQs.length}
          onClick={() => {
            let s = 0;
            correctionQs.forEach(q => { if (answers[q.id] === q.correct) s += q.marks; });
            setScore(s);
            markCorrected(correction.id, s);
            setDone(true);
            setToast({ msg: "✓ تم التصحيح وحفظ النتيجة", type: "success" });
          }}
        >
          تأكيد التصحيح ({answeredCount}/{correctionQs.length})
        </Btn>
      </div>
    );
  }

  // الشاشة الرئيسية للوحة التحكم
  return (
    <div className="space-y-4">
      <h3 className="text-white font-black">🎛️ لوحة تحكم الامتحانات</h3>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-900/20 border border-blue-700/20 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-blue-400">{totalExams}</div>
          <div className="text-xs text-slate-400 mt-1">إجمالي الامتحانات</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black" style={{ color: scC(avgScore) }}>{avgScore}%</div>
          <div className="text-xs text-slate-400 mt-1">متوسط الطلاب</div>
        </div>
        <div className="bg-red-900/20 border border-red-700/20 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-red-400">{needsCorrection.length}</div>
          <div className="text-xs text-slate-400 mt-1">تحتاج تصحيح</div>
        </div>
        <div className="bg-amber-900/20 border border-amber-700/20 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-amber-400">{needsReview.length}</div>
          <div className="text-xs text-slate-400 mt-1">تحتاج مراجعة</div>
        </div>
      </div>

      {/* Bar chart بسيط لمتوسط درجات الطلاب */}
      {students.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
          <div className="text-xs text-slate-400 mb-3 font-medium">توزيع مستويات الطلاب</div>
          {[
            { label: "ممتاز",  min: 85, color: "bg-emerald-500" },
            { label: "جيد",    min: 65, color: "bg-blue-500"    },
            { label: "مقبول",  min: 50, color: "bg-amber-500"   },
            { label: "ضعيف",   min: 0,  color: "bg-red-500"     },
          ].map((band, bi, arr) => {
            const max = arr[bi - 1]?.min ?? 101;
            const count = students.filter(s => s.score >= band.min && s.score < max).length;
            const w = students.length ? (count / students.length) * 100 : 0;
            return (
              <div key={band.label} className="flex items-center gap-2 mb-1.5">
                <div className="text-xs text-slate-500 w-12 shrink-0 text-right">{band.label}</div>
                <div className="flex-1 bg-slate-700/40 rounded-full h-5 overflow-hidden">
                  <div className={`h-full ${band.color} rounded-full transition-all flex items-center justify-end pr-1`} style={{ width: `${Math.max(w, 3)}%` }}>
                    {count > 0 && <span className="text-white text-xs font-bold">{count}</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-400 w-8 text-center">{Math.round(w)}%</div>
              </div>
            );
          })}
        </div>
      )}

      {needsCorrection.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-red-400 font-bold px-1">🖊️ تحتاج تصحيح</div>
          {needsCorrection.map(e => (
            <div key={e.id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-white font-black text-sm">{e.name}</div>
                  <div className="text-slate-400 text-xs">{e.date} · {e.grade} · مج. {e.group}</div>
                </div>
                <div className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-lg">{e.sheets} ورقة</div>
              </div>
              {questions.length === 0
                ? <div className="text-xs text-amber-400 text-center py-1">⚠️ أضف أسئلة لبنك الأسئلة أولاً</div>
                : <Btn variant="danger" className="w-full" onClick={() => setCorrection(e)}>🖊️ بدء التصحيح</Btn>
              }
            </div>
          ))}
        </div>
      )}

      {needsReview.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-amber-400 font-bold px-1">🔍 تحتاج مراجعة</div>
          {needsReview.map(e => (
            <div key={e.id} className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex justify-between mb-3">
                <div>
                  <div className="text-white font-black text-sm">{e.name}</div>
                  <div className="text-slate-500 text-xs">المصحح: {e.corrector || "—"}</div>
                  {e._score !== undefined && (
                    <div className="text-xs mt-0.5" style={{ color: scC(pct(e._score, e._max)) }}>
                      النتيجة: {e._score}/{e._max} ({pct(e._score, e._max)}%)
                    </div>
                  )}
                </div>
                <div className="text-amber-400 text-sm font-bold">{e.sheets} طالب</div>
              </div>
              <button className="w-full py-2.5 rounded-xl bg-amber-600/30 text-amber-200 text-sm">🔍 مراجعة</button>
            </div>
          ))}
        </div>
      )}

      {totalExams === 0 && (
        <div className="text-center py-10 text-slate-600">
          <div className="text-4xl mb-2">🎛️</div>
          <div className="text-sm">لا توجد امتحانات بعد</div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── ألوان مميزة لكل صف في تقرير الأخطاء ──────────────────────
const GRADE_COLORS = [
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-amber-600 to-orange-700",
  "from-rose-600 to-pink-700",
  "from-violet-600 to-purple-700",
  "from-cyan-600 to-blue-700",
];

// ─── تقرير الأخطاء: صف (6 مستطيلات) ← وحدة/درس ← جدول أخطاء
// الطلاب، بوصف السؤال (لو متسجّل من قسم "الامتحانات") بدل رقمه ─────
function ExamMistakesReport({ students, centerExams }) {
  const [grade,  setGrade]  = useState("");
  const [unit,   setUnit]   = useState("");
  const [lesson, setLesson] = useState("");

  const maxUnits = grade ? unitsCountFor(grade) : 0;

  const linkedExam = (centerExams || []).find(e => e.grade === grade && String(e.unit) === String(unit) && String(e.lesson) === String(lesson)) || null;

  const gradeStudents = useMemo(() => (students || []).filter(s => s.grade === grade), [students, grade]);

  // وصف السؤال: من questionMeta اللي اتسجّل وقت رفع الامتحان لو موجود، وإلا رقم السؤال زي ما هو
  const descFor = q => {
    const d = linkedExam?.questionMeta?.[q];
    return d && d.trim() ? d.trim() : `سؤال ${q}`;
  };

  // كل طالب في الصف له أخطاء مسجَّلة (من قسم "التصحيح") في نفس الوحدة/الدرس ده
  const rows = useMemo(() => {
    if (!grade || !unit || !lesson) return [];
    return gradeStudents
      .map(s => {
        const errs = (s.examErrors || []).filter(e => e.grade === grade && e.unit === unit && e.lesson === lesson);
        const qs = [...new Set(errs.map(e => e.q))].sort((a, b) => a - b);
        return { student: s, qs };
      })
      .filter(r => r.qs.length > 0);
  }, [gradeStudents, grade, unit, lesson]);

  const resetToGrades   = () => { setGrade(""); setUnit(""); setLesson(""); };
  const resetUnitLesson = () => { setUnit(""); setLesson(""); };

  // الشاشة 1: اختيار الصف — 6 مستطيلات (من أولى إعدادي لثالثة ثانوي)
  if (!grade) return (
    <div className="space-y-4">
      <div className="text-white font-black text-sm">اختاري الصف</div>
      <div className="grid grid-cols-2 gap-3">
        {GRADES_LIST.map((g, i) => (
          <button key={g} onClick={() => setGrade(g)}
            className={`bg-gradient-to-br ${GRADE_COLORS[i % GRADE_COLORS.length]} rounded-2xl p-4 text-white text-right shadow-md active:scale-95 transition-transform`}>
            <div className="text-2xl mb-1">🎓</div>
            <div className="font-black text-sm leading-tight">{g}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // الشاشة 2: مستطيل اختيار الوحدة والدرس
  if (!unit || !lesson) return (
    <div className="space-y-4">
      <button onClick={resetToGrades} className="text-slate-400 text-sm flex items-center gap-1">← تغيير الصف</button>
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4 space-y-3">
        <div className="text-white font-black text-sm">{grade} — اختاري الوحدة والدرس</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="الوحدة">
            <select value={unit} onChange={e => { setUnit(e.target.value); setLesson(""); }}
              className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none">
              <option value="">— اختر —</option>
              {Array.from({ length: maxUnits }, (_, i) => i + 1).map(u => <option key={u} value={u}>وحدة {u}</option>)}
            </select>
          </Field>
          <Field label="الدرس">
            <select value={lesson} onChange={e => setLesson(e.target.value)} disabled={!unit}
              className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none disabled:opacity-40">
              <option value="">— اختر —</option>
              {Array.from({ length: LESSONS_COUNT }, (_, i) => i + 1).map(l => <option key={l} value={l}>درس {l}</option>)}
            </select>
          </Field>
        </div>
        {grade === "ثالثة ثانوي" && (
          <div className="text-amber-400 text-xs text-center">ملحوظة: ثالثة ثانوي عندها 8 وحدات (حالة استثنائية).</div>
        )}
      </div>
    </div>
  );

  // الشاشة 3: جدول أخطاء الطلاب — اسم الطالب + وصف كل سؤال أخطأ فيه (مش رقمه)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={resetUnitLesson} className="text-slate-400 text-sm flex items-center gap-1">← تغيير الوحدة/الدرس</button>
        <button onClick={resetToGrades} className="text-slate-500 text-xs">تغيير الصف</button>
      </div>
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-red-300 text-xs text-center">
        {grade} — وحدة {unit} — درس {lesson}
      </div>

      {!linkedExam && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-amber-300 text-xs text-center">
          ⚠️ مفيش امتحان مربوط بهذه الوحدة/الدرس ولا وصف أسئلة متسجّل — هيظهر تحت رقم السؤال بس لحد ما تضيفي الوصف من قسم "الامتحانات"
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">✅</div><div className="text-sm">مفيش أخطاء مسجَّلة لأي طالب في هذه الوحدة/الدرس</div></div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ student: s, qs }) => (
            <div key={s.id} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Av name={s.name} size="sm" />
                <div className="text-white text-sm font-bold">{s.name}</div>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400 shrink-0 mr-auto">{qs.length} خطأ</span>
              </div>
              <div className="space-y-1">
                {qs.map(q => (
                  <div key={q} className="text-xs text-slate-300 bg-slate-900/50 rounded-lg px-2.5 py-1.5">
                    أخطأ في: <span className="text-red-300 font-medium">{descFor(q)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── حاوية قسم "الأخطاء": تقرير الأخطاء (الافتراضي الجديد) + لوحة
// التحكم القديمة (إحصائيات + تصحيح أوراق الامتحانات) في تاب تاني ───
function ExamPanelErrorsHub({ questions, webExams, centerExams, setCenterExams, students }) {
  const [tab, setTab] = useState("report");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
        <button onClick={() => setTab("report")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${tab === "report" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"}`}>
          🧾 تقرير الأخطاء
        </button>
        <button onClick={() => setTab("dashboard")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${tab === "dashboard" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"}`}>
          🎛️ لوحة التحكم
        </button>
      </div>
      {tab === "report"    && <ExamMistakesReport students={students} centerExams={centerExams} />}
      {tab === "dashboard" && <ExamPanelDashboard questions={questions} webExams={webExams} centerExams={centerExams} setCenterExams={setCenterExams} students={students} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main ExamsModule
// ══════════════════════════════════════════════════════════════
const PANELS = [
  { key: "errors",     icon: "🟦", label: "التصحيح",    desc: "تسجيل خطأ كل سؤال لكل طالب + تنبيهات",  color: "from-blue-600 to-blue-700",     border: "border-blue-500/25",    glow: "shadow-blue-500/10"    },
  { key: "correction", icon: "🟥", label: "الأخطاء",    desc: "تقرير أخطاء الطلاب حسب الصف والوحدة والدرس",  color: "from-red-600 to-rose-700",      border: "border-red-500/25",     glow: "shadow-red-500/10"     },
  { key: "exams",      icon: "📝", label: "الامتحانات", desc: "رفع امتحان (Word/PDF/صورة) لكل صف ووحدة ودرس", color: "from-violet-600 to-purple-700", border: "border-violet-500/25",  glow: "shadow-violet-500/10"  },
  { key: "web",        icon: "🌐", label: "الويب",       desc: "ربط الامتحانات بالمحتوى التعليمي",    color: "from-emerald-600 to-green-700", border: "border-emerald-500/25", glow: "shadow-emerald-500/10" },
];

// قسم "الامتحانات": بقى بس رفع ملف الامتحان (Word / PDF / صورة) مربوط
// بصف + وحدة + درس (بنفس طريقة قسم "الأخطاء")، عشان لما تتسجّل أخطاء
// طالب على نفس الوحدة/الدرس تبقى مربوطة تلقائيًا بهذا الامتحان المرفوع.
const EXAM_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";
function fileKindIcon(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (["jpg","jpeg","png","webp"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📕";
  if (["doc","docx"].includes(ext)) return "📄";
  return "📎";
}

function ExamUploadLinked({ students, centerExams, setCenterExams }) {
  const [grade,  setGrade]  = useState("");
  const [unit,   setUnit]   = useState("");
  const [lesson, setLesson] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast]   = useState(null);
  const [numQuestions, setNumQuestions] = useState(20);
  const [pointsPerQuestion, setPointsPerQuestion] = useState(4);
  const [analyzing, setAnalyzing] = useState(false);
  const ref = useRef(null);

  const maxUnits = grade ? unitsCountFor(grade) : 0;
  const ready = grade && unit && lesson;

  const existing = (centerExams || []).filter(e => e.grade === grade && String(e.unit) === String(unit) && String(e.lesson) === String(lesson));

  const fileToBase64 = f => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("تعذّرت قراءة الملف"));
    r.readAsDataURL(f);
  });

  // بيقرأ الملف فعليًا (صورة أو PDF) عن طريق Claude Vision ويرجّع عدد
  // الأسئلة وعدد النقط (الاختيارات) في كل سؤال، بدل ما تكتبيهم إنتي.
  // بيستخدم نفس مفتاح API بتاع "asal.ai" (لازم يبقى متسجّل قبل كده).
  const analyzeExamFile = async (f, ext) => {
    let apiKey = "";
    try { apiKey = localStorage.getItem("asal_api_key") || ""; } catch { /* ignore */ }
    if (!apiKey) return { ok: false, reason: "no_key" };

    const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);
    const isPdf = ext === "pdf";
    if (!isImage && !isPdf) return { ok: false, reason: "unsupported" };

    try {
      const b64 = await fileToBase64(f);
      const mediaType = isPdf ? "application/pdf" : (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: mediaType, data: b64 } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } };

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: [
              contentBlock,
              { type: "text", text: "دي ورقة امتحان. عدّي إجمالي عدد الأسئلة، وحددي عدد الاختيارات/النقط في كل سؤال (زي عدد اختيارات كل سؤال اختيار من متعدد؛ لو مش موحّد خدي الأكثر تكرارًا). كمان اكتبي لكل سؤال وصف قصير جدًا (٣-٨ كلمات بالعربي) يلخّص فكرة السؤال بدل رقمه: لو السؤال بيطلب تفسير أو سبب، ابدئي الوصف بـ'ليه...' أو 'فسّر ليه...'؛ لو بيطلب نتيجة أو نتائج، ابدئي بـ'نتائج...' أو 'ما نتيجة...'؛ لو سؤال صح وغلط، اكتبي نص العبارة نفسها (مختصرة)؛ غير كده اكتبي موضوع السؤال باختصار. متكتبيش كلمة 'سؤال رقم' في الوصف نفسه. ردّي بصيغة JSON فقط بدون أي كلام تاني، بالظبط بالشكل ده: {\"numQuestions\": رقم, \"pointsPerQuestion\": رقم, \"questions\": [{\"q\": رقم السؤال, \"desc\": \"الوصف القصير\"}, ...] }" }
            ]
          }]
        })
      });
      if (res.status === 401) return { ok: false, reason: "bad_key" };
      if (!res.ok) return { ok: false, reason: "http_error" };
      const data = await res.json();
      const text = (data.content || []).map(c => c.text || "").join("").trim();
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const nq = parseInt(parsed.numQuestions);
      const np = parseInt(parsed.pointsPerQuestion);
      if (!nq || !np) return { ok: false, reason: "parse_error" };
      const questionMeta = {};
      if (Array.isArray(parsed.questions)) {
        parsed.questions.forEach(item => {
          const qn = parseInt(item?.q);
          const desc = String(item?.desc || "").trim();
          if (qn && desc) questionMeta[qn] = desc;
        });
      }
      return { ok: true, numQuestions: Math.max(1, nq), pointsPerQuestion: Math.max(1, np), questionMeta };
    } catch {
      return { ok: false, reason: "error" };
    }
  };

  const acceptFile = async f => {
    if (!f) return;
    const maxSize = 20 * 1024 * 1024;
    if (f.size > maxSize) { setToast({ msg: "الملف أكبر من 20MB", type: "error" }); return; }
    const ext = f.name.split(".").pop().toLowerCase();
    if (!EXAM_ACCEPT.includes(ext)) { setToast({ msg: "الصيغة غير مدعومة — Word أو PDF أو صورة فقط", type: "error" }); return; }

    const examId = genExamId();
    const newExam = {
      id: examId, grade, unit, lesson,
      fileName: f.name, fileSize: f.size, fileType: ext,
      date: TODAY,
      numQuestions: numQuestions || 20,
      pointsPerQuestion: pointsPerQuestion || 4,
    };
    setCenterExams(p => [newExam, ...(p || [])]);
    setToast({ msg: `✓ تم رفع ${f.name} — جاري قراءة عدد الأسئلة تلقائيًا...`, type: "success" });

    setAnalyzing(true);
    const result = await analyzeExamFile(f, ext);
    setAnalyzing(false);

    if (result.ok) {
      const hasDesc = result.questionMeta && Object.keys(result.questionMeta).length > 0;
      setCenterExams(p => (p || []).map(e => e.id === examId
        ? { ...e, numQuestions: result.numQuestions, pointsPerQuestion: result.pointsPerQuestion, questionMeta: { ...(e.questionMeta || {}), ...(result.questionMeta || {}) } }
        : e));
      setToast({ msg: hasDesc
        ? `✓ اتقرأ الامتحان: ${result.numQuestions} سؤال × ${result.pointsPerQuestion} نقط + وصف كل سؤال`
        : `✓ اتقرأ الامتحان: ${result.numQuestions} سؤال × ${result.pointsPerQuestion} نقط`, type: "success" });
    } else if (result.reason === "no_key") {
      setToast({ msg: "⚠️ محتاجة تسجّلي مفتاح API بتاع asal.ai الأول عشان القراءة التلقائية تشتغل — العدد اللي كتبتيه فوق اتحفظ عادي", type: "error" });
    } else if (result.reason === "unsupported") {
      setToast({ msg: "الصور والـ PDF بس قابلين للقراءة التلقائية — ملفات Word لازم تدخلي العدد يدويًا", type: "error" });
    } else {
      setToast({ msg: "⚠️ مقدرتش أقرأ عدد الأسئلة تلقائيًا من الملف ده — عدّلي العدد يدويًا تحت لو مختلف", type: "error" });
    }
  };

  const removeExam = id => setCenterExams(p => (p || []).filter(e => e.id !== id));
  const [descOpenId, setDescOpenId] = useState(null); // أي امتحان مفتوح دلوقتي لتعديل وصف أسئلته

  const updateExamCounts = (id, field, value) => {
    setCenterExams(p => (p || []).map(e => e.id === id ? { ...e, [field]: Math.max(1, parseInt(value) || 1) } : e));
  };

  // وصف قصير اختياري لكل سؤال (زي "فسّر ليه..." أو "صح وغلط") — بيتحفظ
  // في questionMeta عشان يظهر بدل رقم السؤال في تقرير "الأخطاء".
  const updateQuestionDesc = (examId, q, text) => {
    setCenterExams(p => (p || []).map(e => e.id === examId ? { ...e, questionMeta: { ...(e.questionMeta || {}), [q]: text } } : e));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Field label="الصف">
          <select value={grade} onChange={e => { setGrade(e.target.value); setUnit(""); setLesson(""); }}
            className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none">
            <option value="">— اختر —</option>
            {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="الوحدة">
          <select value={unit} onChange={e => setUnit(e.target.value)} disabled={!grade}
            className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none disabled:opacity-40">
            <option value="">— اختر —</option>
            {Array.from({ length: maxUnits }, (_, i) => i + 1).map(u => <option key={u} value={u}>وحدة {u}</option>)}
          </select>
        </Field>
        <Field label="الدرس">
          <select value={lesson} onChange={e => setLesson(e.target.value)} disabled={!unit}
            className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none disabled:opacity-40">
            <option value="">— اختر —</option>
            {Array.from({ length: LESSONS_COUNT }, (_, i) => i + 1).map(l => <option key={l} value={l}>درس {l}</option>)}
          </select>
        </Field>
      </div>
      {grade === "ثالثة ثانوي" && (
        <div className="text-amber-400 text-xs text-center">ملحوظة: ثالثة ثانوي عندها 8 وحدات (حالة استثنائية).</div>
      )}

      {ready ? (
        <>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-blue-300 text-xs text-center">
            📷 لو الملف صورة أو PDF، هقرأ عدد الأسئلة والنقط تلقائيًا من جوه الامتحان بعد الرفع. الأرقام تحت دي بس قيمة مبدئية.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="عدد أسئلة الامتحان (مبدئي)">
              <input type="number" min={1} max={100} value={numQuestions} onChange={e => setNumQuestions(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none" />
            </Field>
            <Field label="عدد النقط في كل سؤال (مبدئي)">
              <input type="number" min={1} max={20} value={pointsPerQuestion} onChange={e => setPointsPerQuestion(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none" />
            </Field>
          </div>
          <div
            onClick={() => !analyzing && ref.current?.click()}
            onDragOver={e => { e.preventDefault(); if (!analyzing) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (!analyzing) acceptFile(e.dataTransfer.files?.[0]); }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors group ${analyzing ? "opacity-60 cursor-wait" : "cursor-pointer"} ${dragOver ? "border-blue-500 bg-blue-500/10" : "border-slate-600/60 hover:border-blue-500/50"}`}
          >
            <div className="text-5xl mb-3">{analyzing ? "🔎" : "📁"}</div>
            <div className="text-slate-300 font-medium group-hover:text-white transition-colors">
              {analyzing ? "بيقرأ الامتحان تلقائيًا دلوقتي... استني شوية" : "اسحبي الملف هنا أو اضغطي للفتح من اللابتوب"}
            </div>
            <div className="text-slate-600 text-xs mt-1">Word · PDF · صورة — حد أقصى 20MB</div>
            <div className="text-blue-400 text-xs mt-2">هيتربط بـ {grade} — وحدة {unit} — درس {lesson}</div>
          </div>
          <input ref={ref} type="file" accept={EXAM_ACCEPT} className="hidden" onChange={e => { acceptFile(e.target.files?.[0]); e.target.value = ""; }} />

          {existing.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-bold px-1">الامتحانات المرفوعة لهذا الدرس ({existing.length})</div>
              {existing.map(ex => (
                <div key={ex.id} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 flex items-center gap-3 flex-wrap">
                  <span className="text-2xl">{fileKindIcon(ex.fileName)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-bold truncate">{ex.fileName}</div>
                    <div className="text-slate-500 text-xs">{(ex.fileSize / 1024).toFixed(1)} KB — {ex.date}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} max={100} value={ex.numQuestions || 20}
                      onChange={e => updateExamCounts(ex.id, "numQuestions", e.target.value)}
                      title="عدد الأسئلة"
                      className="w-14 bg-slate-900 border border-slate-700/50 rounded-lg px-1 py-1 text-white text-xs text-center focus:outline-none" />
                    <span className="text-slate-500 text-xs">×</span>
                    <input type="number" min={1} max={20} value={ex.pointsPerQuestion || 4}
                      onChange={e => updateExamCounts(ex.id, "pointsPerQuestion", e.target.value)}
                      title="عدد النقط بكل سؤال"
                      className="w-14 bg-slate-900 border border-slate-700/50 rounded-lg px-1 py-1 text-white text-xs text-center focus:outline-none" />
                  </div>
                  <button onClick={() => setDescOpenId(descOpenId === ex.id ? null : ex.id)} className="text-blue-400 text-xs px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0 whitespace-nowrap">📋 وصف الأسئلة</button>
                  <button onClick={() => removeExam(ex.id)} className="text-red-400 text-lg hover:text-red-300">🗑</button>

                  {descOpenId === ex.id && (
                    <div className="w-full space-y-1.5 pt-2 border-t border-slate-700/40 mt-1">
                      <div className="text-slate-500 text-xs">
                        وصف كل سؤال بيتقرأ تلقائيًا من الملف وقت الرفع (لو صورة/PDF) ويظهر بدل رقم السؤال في تقرير "الأخطاء" — تقدري تعدّلي أي وصف يدويًا هنا لو مش دقيق. سيبيه فاضي لو عايزة يفضل بالرقم.
                      </div>
                      {Array.from({ length: ex.numQuestions || 20 }, (_, i) => i + 1).map(q => (
                        <div key={q} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-14 shrink-0">سؤال {q}</span>
                          <input
                            value={ex.questionMeta?.[q] || ""}
                            onChange={e => updateQuestionDesc(ex.id, q, e.target.value)}
                            placeholder="مثال: فسّر لماذا... / ما نتائج... / صح وغلط"
                            className="flex-1 bg-slate-900 border border-slate-700/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-10 text-slate-600"><div className="text-5xl mb-3">📤</div><div className="text-sm">اختاري الصف ثم الوحدة ثم الدرس عشان تقدري ترفعي الامتحان</div></div>
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

export default function ExamsModule({ students, setStudents, addActivity, questions, setQuestions, webExams, setWebExams, centerExams, setCenterExams }) {
  const [activePanel, setActivePanel] = useState(null);

  if (activePanel) {
    const panel = PANELS.find(p => p.key === activePanel);
    return (
      <div className="space-y-4">
        <button onClick={() => setActivePanel(null)} className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors">← الرجوع للامتحانات</button>
        <div className={`bg-gradient-to-br ${panel.color} rounded-2xl p-4 flex items-center gap-3 shadow-lg ${panel.glow}`}>
          <span className="text-3xl">{panel.icon}</span>
          <div>
            <div className="text-white font-black">{panel.label}</div>
            <div className="text-white/70 text-xs mt-0.5">{panel.desc}</div>
          </div>
        </div>

        {activePanel === "errors"     && <ExamPanelAlerts        students={students} setStudents={setStudents} addActivity={addActivity} centerExams={centerExams} />}
        {activePanel === "correction" && <ExamPanelErrorsHub     questions={questions} webExams={webExams} centerExams={centerExams} setCenterExams={setCenterExams} students={students} />}
        {activePanel === "exams"      && <ExamUploadLinked       students={students} centerExams={centerExams} setCenterExams={setCenterExams} />}
        {activePanel === "web"        && <ExamPanelCurriculum    webExams={webExams} students={students} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-white">📝 الامتحانات</h2>
        <p className="text-xs text-slate-500 mt-0.5">اختر قسماً للبدء</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PANELS.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePanel(p.key)}
            className={`bg-slate-800/70 border ${p.border} rounded-2xl p-4 text-right hover:bg-slate-800 hover:shadow-lg ${p.glow} transition-all duration-200 active:scale-95 group`}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl mb-3 shadow-md group-hover:scale-110 transition-transform duration-200`}>{p.icon}</div>
            <div className="text-white font-black text-sm leading-tight">{p.label}</div>
            <div className="text-slate-500 text-xs mt-1 leading-relaxed">{p.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
