import { useState, useMemo, useEffect } from "react";
import { GRADES_LIST, GROUPS_MAP, TODAY } from "../../constants";
import { pct, isBlocked, waLink, shortGradeLabel } from "../../utils";
import { Av, Sel, DatePicker, Toast, Modal, Field, Btn, GradeCircles } from "../ui";

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

const stCfg = {
  p: { label: "حاضر",  color: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-400", icon: "✓"  },
  a: { label: "غائب",  color: "bg-red-500",     border: "border-red-500",     text: "text-red-400",    icon: "✗"  },
  l: { label: "متأخر", color: "bg-amber-500",   border: "border-amber-500",   text: "text-amber-400",  icon: "⏰" },
};

// ══════════════════════════════════════════════════════════════
// سهم اتجاه (SVG بدل رمز يونيكود) — الأسهم النصية زي → و ← عندها
// خاصية Bidi_Mirrored في اليونيكود فبتتقلب تلقائيًا جوه أي سياق RTL
// (زي صفحتنا كلها)، وده كان بيخلي زرار "اللي قبل كده" يبان بشكل
// عكس المفروض وحاسس المستخدم إنه "مش شغال". SVG رسم ثابت مالوش
// أي مفهوم Bidi خالص، فبيفضل ثابت الاتجاه في أي سياق.
// ══════════════════════════════════════════════════════════════
function ChevronIcon({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      {dir === "right" ? <polyline points="9 5 16 12 9 19" /> : <polyline points="15 5 8 12 15 19" />}
    </svg>
  );
}

// اختصار اسم الصف عشان يتظبط جوه دايرة صغيرة — منقول لملف utils المشترك
// (shortGradeLabel) عشان تُستخدم في كل فلاتر الصف الدائرية بالتطبيق.

// ══════════════════════════════════════════════════════════════
// MODULE 1: ATTENDANCE
// attRecords + setAttRecords (زي finRecords بالظبط) — سجل غياب لكل
// طالب في كل يوم، فيه status + reason (سبب الغياب/التأخير الاختياري)
// عشان يبقى ممكن نرجع نعدّله بعدين بدل عدّادات تراكمية.
//
// السلوك:
//  - النهارده: بتفتح تلقائي، تقدر تعدّل بحرية من غير باسورد.
//  - يوم قديم: بتفتح تلقائي كـ"جدول عرض فقط" (اسم/حالة/سبب)، ومحدش
//    يقدر يعدّل فيها غير المستر (role === "admin") وبعد ما يدخل الباسورد.
// ══════════════════════════════════════════════════════════════
export default function AttendanceModule({ students, setStudents, attRecords, setAttRecords, settings, role = "admin", currentUserName = null, addActivity, jumpTo, onJumpDone }) {
  const [grade,     setGrade]     = useState(GRADES_LIST[2]);
  const [group,     setGroup]     = useState("A");
  const [date,      setDate]      = useState(TODAY);
  const [session,   setSession]   = useState({}); // { [studentId]: { status, reason } }
  const [toast,     setToast]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [pendingGate, setPendingGate] = useState(false);
  const [editUnlocked, setEditUnlocked] = useState(false); // مفتوح للتعديل (يوم قديم بعد الباسورد)
  const [reasonDrafts, setReasonDrafts] = useState({}); // نص السبب قبل ما يتحفظ بالزرار الصغير
  const [highlightId, setHighlightId] = useState(null); // تمييز الطالب لما نيجي من بحث التوبار

  // ══════════════════════════════════════════════════════════════
  // 📲 تنبيه واتساب تلقائي لولي الأمر بعد حفظ غياب/تأخير اليوم
  // ملحوظة مهمة: واتساب نفسه (من غير API رسمي مدفوع من ميتا) بيرفض
  // إرسال رسالة "صامت" تمامًا من غير ما حد يضغط زرار "إرسال" جوه
  // الشات — فده أقصى أتمتة ممكنة فعليًا: بعد الحفظ، بتفتح تلقائي قائمة
  // بكل غايب/متأخر معاه رقم ولي أمر، وانتي بس بتدوسي "التالي" وهو
  // بيفتحلك الشات جاهز بالرسالة، تدوسي إرسال جوه واتساب وخلاص.
  // ══════════════════════════════════════════════════════════════
  const [waPrompt, setWaPrompt] = useState(null); // [{student, kind:"a"|"l"}]
  const [waQueue,  setWaQueue]  = useState(null); // { list, idx }
  const [waToast,  setWaToast]  = useState(null);

  const cn = settings?.centerName || "مركز الشرقاوي";
  const waMsg = (s, kind, time) => kind === "l"
    ? `السلام عليكم ولي أمر ${s.name}،\n${s.name} اتأخر النهاردة${time ? " الساعة " + time : ""}.\nيرجى المتابعة.\nشكراً - ${cn}`
    : `السلام عليكم ولي أمر ${s.name}،\n${s.name} غايب النهاردة.\nيرجى المتابعة.\nشكراً - ${cn}`;

  // ══════════════════════════════════════════════════════════════
  // 📔 دفتر / سجل الغياب — صفحة عرض منفصلة (الصف/المجموعة/التاريخ)
  // بتفتح تلقائي على آخر صف/مجموعة اتسجّل لها غياب (نفس الصف/المجموعة
  // المختارين حاليًا فوق)، وأي تغيير يدوي للصف أو المجموعة من الفلتر
  // بيرجّع التاريخ لليوم الحالي تلقائي.
  // ══════════════════════════════════════════════════════════════
  const [logOpen,  setLogOpen]  = useState(false);
  const [logGrade, setLogGrade] = useState(grade);
  const [logGroup, setLogGroup] = useState(group);
  const [logDate,  setLogDate]  = useState(TODAY);

  // آخر يوم اتسجّل فيه غياب فعليًا لصف/مجموعة معيّنين — لو مفيش أي سجل خالص، رجّع اليوم الحالي
  const lastRecordedLogDate = (g, grp) => {
    const dates = (attRecords || []).filter(r => r.grade === g && r.group === grp).map(r => r.date);
    return dates.length ? dates.sort().slice(-1)[0] : TODAY;
  };

  // آخر صف/مجموعة اتاخد فيها غياب فعليًا النهاردة بالذات (مش أي يوم) —
  // بيعتمد على حقل ts (وقت الحفظ) لو موجود عشان يبقى دقيق مع أكتر من
  // مجموعة اتسجّلت النهاردة، ولو السجلات قديمة من غير ts بيرجع لترتيب
  // ظهورها في المصفوفة (آخر واحد اتضاف).
  const lastGroupTakenToday = () => {
    const todays = (attRecords || []).filter(r => r.date === TODAY);
    if (!todays.length) return null;
    const withTs = todays.filter(r => r.ts);
    const best = withTs.length ? withTs.reduce((a, b) => (b.ts > a.ts ? b : a)) : todays[todays.length - 1];
    return { grade: best.grade, group: best.group };
  };

  const openLog = () => {
    const last = lastGroupTakenToday();
    if (last) {
      setLogGrade(last.grade);
      setLogGroup(last.group);
      setLogDate(TODAY);
    } else {
      setLogGrade(grade);
      setLogGroup(group);
      setLogDate(lastRecordedLogDate(grade, group));
    }
    setLogOpen(true);
  };

  const handleLogGradeChange = (g) => {
    const newGroup = GROUPS_MAP[g]?.[0] || "A";
    setLogGrade(g);
    setLogGroup(newGroup);
    setLogDate(lastRecordedLogDate(g, newGroup));
  };

  const handleLogGroupChange = (g) => {
    setLogGroup(g);
    setLogDate(lastRecordedLogDate(logGrade, g));
  };

  const logGrpList = GROUPS_MAP[logGrade] || ["A"];
  const logStudents = useMemo(
    () => (students || []).filter(s => s && s.grade === logGrade && s.group === logGroup && !isBlocked(s)),
    [students, logGrade, logGroup]
  );
  const logRecordsMap = useMemo(() => {
    const recs = (attRecords || []).filter(r => r.grade === logGrade && r.group === logGroup && r.date === logDate);
    return Object.fromEntries(recs.map(r => [r.studentId, r]));
  }, [attRecords, logGrade, logGroup, logDate]);
  // أسماء كل اللي سجّلوا حضور/غياب في اليوم/المجموعة دي (ممكن يكون فيه
  // أكتر من اسم لو حد عدّل بعد حد تاني) — بتظهر فوق الجدول مباشرة.
  const logTakenByList = useMemo(() => {
    const names = new Set(Object.values(logRecordsMap).map(r => r?.takenBy).filter(Boolean));
    return [...names];
  }, [logRecordsMap]);

  // نفس إصلاح "الطلاب المنقولين" بس لصفحة الدفتر
  const logStudentsForDisplay = useMemo(() => {
    const currentIds = new Set(logStudents.map(s => s.id));
    const extra = Object.keys(logRecordsMap)
      .filter(id => !currentIds.has(id))
      .map(id => (students || []).find(s => s.id === id) || { id, name: "طالب سابق (نُقل أو حُذف)" });
    return [...logStudents, ...extra];
  }, [logStudents, logRecordsMap, students]);

  // كل الأيام اللي فيها سجل غياب فعلي لنفس الصف/المجموعة، مرتبة تصاعديًا —
  // بيتستخدموا في أسهم التنقل (يمين = قبل كده، شمال = بعد كده)
  const logDatesList = useMemo(() => {
    const set = new Set((attRecords || []).filter(r => r.grade === logGrade && r.group === logGroup).map(r => r.date));
    return [...set].sort();
  }, [attRecords, logGrade, logGroup]);

  const logDateIdx = logDatesList.indexOf(logDate);
  const hasPrevLogDate = logDateIdx > 0 || (logDateIdx === -1 && logDatesList.length > 0);
  const hasNextLogDate = logDateIdx !== -1 && logDateIdx < logDatesList.length - 1;

  const goPrevLogDate = () => {
    if (logDateIdx > 0) setLogDate(logDatesList[logDateIdx - 1]);
    else if (logDateIdx === -1 && logDatesList.length) setLogDate(logDatesList[logDatesList.length - 1]);
  };
  const goNextLogDate = () => {
    if (logDateIdx !== -1 && logDateIdx < logDatesList.length - 1) setLogDate(logDatesList[logDateIdx + 1]);
  };


  // ══════════════════════════════════════════════════════════════
  // 🚫 تقرير الغياب السريع (زرار "غياب" جنب البحث)
  // اختيار صف → بيفتح أوتوماتيك آخر تاريخ اتسجل فيه غياب لهذا الصف
  // (أي مجموعة)، وممكن يغيّر التاريخ يدويًا بعد كده.
  // ══════════════════════════════════════════════════════════════
  const [reportOpen,  setReportOpen]  = useState(false);
  const [reportGrade, setReportGrade] = useState(grade);
  const [reportDate,  setReportDate]  = useState(TODAY);

  // الصفوف اللي اتسجّل لها غياب فعليًا في تاريخ معيّن — عشان قائمة الصفوف
  // في مودال "غياب" تعرض بس الصفوف اللي فيها سجلات، مش كل الصفوف.
  const gradesWithAttendanceOn = (d) => {
    const set = new Set((attRecords || []).filter(r => r.date === d).map(r => r.grade));
    return GRADES_LIST.filter(g => set.has(g));
  };

  const reportGradeOptions = useMemo(() => {
    const list = gradesWithAttendanceOn(reportDate);
    return list.length ? list : GRADES_LIST; // فallback: لو مفيش أي سجل خالص، اعرض كل الصفوف
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attRecords, reportDate]);

  // زرار "غياب": يفتح دايمًا على اليوم الحالي، والصف اللي معروض هو أول
  // صف من الصفوف اللي اتسجّل لها غياب النهاردة (لو الصف المختار حاليًا
  // مش من ضمنهم).
  const openReport = () => {
    setReportDate(TODAY);
    const options = gradesWithAttendanceOn(TODAY);
    const g = options.includes(grade) ? grade : (options[0] || grade);
    setReportGrade(g);
    setReportOpen(true);
  };

  const handleReportGradeChange = (g) => {
    setReportGrade(g);
  };

  const handleReportDateChange = (d) => {
    setReportDate(d);
    const options = gradesWithAttendanceOn(d);
    if (options.length && !options.includes(reportGrade)) {
      setReportGrade(options[0]);
    }
  };

  const reportRows = useMemo(() => {
    if (!reportOpen) return [];
    return (attRecords || [])
      .filter(r => r.grade === reportGrade && r.date === reportDate && r.status === "a")
      .map(r => {
        const st = (students || []).find(s => s.id === r.studentId);
        return { recId: r.id, name: st?.name || r.studentId, group: r.group, reason: r.reason || "—", contacted: !!r.contacted };
      });
  }, [reportOpen, attRecords, reportGrade, reportDate, students]);

  const toggleReportContacted = (recId) => {
    setAttRecords(prev => (prev || []).map(r => r.id === recId ? { ...r, contacted: !r.contacted } : r));
  };

  const safeAttRecords = attRecords || [];
  const grpList     = GROUPS_MAP[grade] || ["A"];
  const grpStudents = useMemo(
    () => (students || []).filter(s => s && s.grade === grade && s.group === group && !isBlocked(s)),
    [students, grade, group]
  );

  // البحث في كل المجاميع/الصفوف — مش بس المجموعة المفتوحة حاليًا
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = normalizeAr(search.trim());
    return (students || []).filter(s => s && !isBlocked(s) && normalizeAr(s.name || "").includes(q));
  }, [students, search]);

  const goToStudent = s => {
    setGrade(s.grade);
    setGroup(s.group);
    setDate(TODAY);
    setSearch("");
  };

  // بحث التوبار العلوي: لما تدوّري على طالب وانتي واقفة في صفحة الحضور،
  // ييجيلك مباشرة لمجموعته وصفه ويتحدد شوية عشان تلاقيه بسرعة.
  useEffect(() => {
    if (!jumpTo) return;
    const target = (students || []).find(st => st.id === jumpTo);
    if (target) {
      goToStudent(target);
      setHighlightId(target.id);
      setTimeout(() => setHighlightId(null), 2500);
    }
    onJumpDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  // سجلات اليوم/المجموعة المختارة حاليًا من مصدر الحقيقة (attRecords)
  const recordsForSession = useMemo(
    () => safeAttRecords.filter(r => r.grade === grade && r.group === group && r.date === date),
    [safeAttRecords, grade, group, date]
  );
  const existingMap = useMemo(
    () => Object.fromEntries(recordsForSession.map(r => [r.studentId, { status: r.status, reason: r.reason || "", time: r.time || null }])),
    [recordsForSession]
  );
  const hasExistingSession = recordsForSession.length > 0;
  const isOldDate = date !== TODAY;

  // إصلاح: طالب اتسجّل له غياب فعلي في هذا اليوم بالذات، بس دلوقتي
  // اتنقل لصف/مجموعة تانية (أو اتحذف) — سجله القديم لازم يفضل ظاهر هنا
  // عشان "لا يختفي" من يوم كان مسجَّل فيه، حتى لو مش من ضمن طلاب
  // الصف/المجموعة الحاليين.
  const grpStudentsForDisplay = useMemo(() => {
    if (!isOldDate) return grpStudents;
    const currentIds = new Set(grpStudents.map(s => s.id));
    const extra = recordsForSession
      .filter(r => !currentIds.has(r.studentId))
      .map(r => (students || []).find(s => s.id === r.studentId) || { id: r.studentId, name: "طالب سابق (نُقل أو حُذف)" });
    return [...grpStudents, ...extra];
  }, [grpStudents, recordsForSession, students, isOldDate]);

  // فتح تلقائي: كل ما يتغيّر الصف/المجموعة/اليوم، السيشن بتتظبط من السجلات
  // الموجودة (لو فيه) من غير الحاجة لأي ضغط زرار.
  useEffect(() => {
    setSession({ ...existingMap });
    setEditUnlocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, group, date]);

  const handleGradeChange = (g) => {
    setGrade(g);
    setGroup(GROUPS_MAP[g]?.[0] || "A");
  };

  const handleGroupChange = (g) => setGroup(g);

  const handleDateChange = (d) => {
    if (d > TODAY) {
      setToast({ msg: "لا يمكن اختيار تاريخ مستقبلي", type: "error" });
      return;
    }
    setDate(d);
  };

  // Toggle الحالة: نفس الحالة تاني → إلغاء التحديد (يسمح بالتصحيح)
  // لو الحالة الجديدة "متأخر" (l)، بنلقط وقت الحضور تلقائيًا (ساعة:دقيقة)
  // لحظة الضغط، من غير ما يحتاج يكتبه هو.
  const mark = (id, st) => setSession(prev => {
    const cur = prev[id] || {};
    if (cur.status === st) {
      const next = { ...cur, status: null };
      if (st === "l") next.time = null;
      return { ...prev, [id]: next };
    }
    const next = { ...cur, status: st };
    if (st === "l") {
      next.time = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    } else {
      next.time = null;
    }
    return { ...prev, [id]: next };
  });

  const setReasonFor = (id, text) => setSession(prev => ({
    ...prev, [id]: { ...(prev[id] || {}), reason: text }
  }));

  // ملحوظة إصلاح: زرار حفظ السبب الصغير كان بيحفظ في السيشن المؤقت بس،
  // فلو المستخدم خرج من الصفحة قبل ما يدوس "حفظ الحضور" الكبير كان السبب بيضيع.
  // دلوقتي بيحفظ فورًا في attRecords (التخزين الدائم) — نفس منطق applyDiffAndSave
  // بس لطالب واحد بس.
  const saveReason = (id) => {
    const draft = reasonDrafts[id];
    if (draft === undefined) return;
    setReasonFor(id, draft);
    setReasonDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });

    const newStatus = session[id]?.status || null;
    if (!newStatus) {
      setToast({ msg: "لازم تحدد الحالة (غايب/متأخر) الأول", type: "error" });
      return;
    }
    const oldStatus = existingMap[id]?.status || null;

    setAttRecords(prev => {
      let list = prev || [];
      const idx = list.findIndex(r => r.studentId === id && r.date === date && r.grade === grade && r.group === group);
      const newTime = newStatus === "l" ? (session[id]?.time || list[idx]?.time || null) : null;
      const rec = { ...(list[idx] || {}), id: list[idx]?.id || genAttId(), studentId: id, grade, group, date, status: newStatus, reason: draft, time: newTime, takenBy: currentUserName || list[idx]?.takenBy || null, ts: Date.now() };
      return idx >= 0 ? [...list.slice(0, idx), rec, ...list.slice(idx + 1)] : [...list, rec];
    });

    if (newStatus !== oldStatus) {
      setStudents(prev => (prev || []).map(s => {
        if (s.id !== id) return s;
        let present = s.present || 0, absent = s.absent || 0, late = s.late || 0, total = s.total || 0;
        if (oldStatus === "p") present--; if (oldStatus === "a") absent--; if (oldStatus === "l") late--;
        if (oldStatus && !newStatus) total--;
        if (newStatus === "p") present++; if (newStatus === "a") absent++; if (newStatus === "l") late++;
        if (!oldStatus && newStatus) total++;
        return { ...s, present: Math.max(0, present), absent: Math.max(0, absent), late: Math.max(0, late), total: Math.max(0, total) };
      }));
    }

    addActivity?.("سبب غياب/تأخير", `${grade} - مجموعة ${group} - ${date}`);
    setToast({ msg: "✓ تم حفظ السبب بشكل نهائي", type: "success" });
  };

  const markAll = st => setSession(prev => Object.fromEntries(
    grpStudents.map(s => [s.id, { status: st, reason: prev[s.id]?.reason || "" }])
  ));

  const counts = {
    p: Object.values(session).filter(v => v?.status === "p").length,
    a: Object.values(session).filter(v => v?.status === "a").length,
    l: Object.values(session).filter(v => v?.status === "l").length,
  };

  // هل فيه تغيير فعلي (حالة أو سبب) عن الحالة المحفوظة؟
  const changedIds = useMemo(() => {
    const ids = new Set([...Object.keys(session), ...Object.keys(existingMap)]);
    return [...ids].filter(id => {
      const s = session[id] || {};
      const e = existingMap[id] || {};
      return (s.status || null) !== (e.status || null) || (s.reason || "") !== (e.reason || "");
    });
  }, [session, existingMap]);

  const applyDiffAndSave = () => {
    setAttRecords(prev => {
      let list = prev || [];
      changedIds.forEach(id => {
        const newStatus = session[id]?.status || null;
        const newReason = session[id]?.reason || "";
        const idx = list.findIndex(r => r.studentId === id && r.date === date && r.grade === grade && r.group === group);
        const newTime = newStatus === "l" ? (session[id]?.time || list[idx]?.time || null) : null;
        if (newStatus) {
          const rec = { ...(list[idx] || {}), id: list[idx]?.id || genAttId(), studentId: id, grade, group, date, status: newStatus, reason: newReason, time: newTime, takenBy: currentUserName || list[idx]?.takenBy || null, ts: Date.now() };
          list = idx >= 0 ? [...list.slice(0, idx), rec, ...list.slice(idx + 1)] : [...list, rec];
        } else if (idx >= 0) {
          list = list.filter((_, i) => i !== idx);
        }
      });
      return list;
    });

    setStudents(prev => (prev || []).map(s => {
      if (!changedIds.includes(s.id)) return s;
      const oldSt = existingMap[s.id]?.status || null;
      const newSt = session[s.id]?.status || null;
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

    // بعد الحفظ: لو النهارده (مش تعديل يوم قديم)، اجمعي كل طالب اتسجّل
    // غايب/متأخر عنده رقم ولي أمر، واعرضي عليها ترسل واتساب دلوقتي.
    if (date === TODAY) {
      const notifyList = changedIds
        .map(id => {
          const st = session[id]?.status;
          if (st !== "a" && st !== "l") return null;
          const stu = (students || []).find(s => s.id === id);
          if (!stu || !stu.parentPhone) return null;
          return { student: stu, kind: st, time: session[id]?.time || null };
        })
        .filter(Boolean);
      if (notifyList.length > 0) setWaPrompt(notifyList);
    }
  };

  const saveSession = () => {
    if (changedIds.length === 0) {
      setToast({ msg: "لا يوجد تغييرات لحفظها", type: "error" });
      return;
    }
    applyDiffAndSave();
  };

  // فتح وضع التعديل ليوم قديم — لازم باسورد المستر، ومتاح للمستر بس
  const unlockOldDateEdit = (pw, setErr) => {
    if (pw && pw === settings?.password) {
      setSession({ ...existingMap });
      setEditUnlocked(true);
      setPendingGate(false);
    } else {
      setErr("باسورد المستر غير صحيح");
    }
  };

  const isEditable = !isOldDate || editUnlocked;

  // ══════════════════════════════════════════════════════════════
  // 📲 منطق قائمة إرسال واتساب التلقائية (بعد سؤال waPrompt)
  // ══════════════════════════════════════════════════════════════
  const startWaQueue = () => {
    const withPhone = (waPrompt || []).filter(x => waLink(x.student.parentPhone));
    if (withPhone.length === 0) {
      setWaToast({ msg: "محدش من الغايبين/المتأخرين عنده رقم ولي أمر", type: "error" });
      setWaPrompt(null);
      return;
    }
    setWaQueue({ list: withPhone, idx: 0 });
    setWaPrompt(null);
  };

  const waQueueNext = () => {
    if (!waQueue) return;
    const cur = waQueue.list[waQueue.idx];
    const url = waLink(cur.student.parentPhone, `?text=${encodeURIComponent(waMsg(cur.student, cur.kind, cur.time))}`);
    if (url) window.open(url, "_blank");
    const nextIdx = waQueue.idx + 1;
    if (nextIdx >= waQueue.list.length) {
      setWaQueue(null);
      setWaToast({ msg: `✓ تم فتح واتساب لـ ${waQueue.list.length} من أولياء الأمور`, type: "success" });
    } else {
      setWaQueue(q => ({ ...q, idx: nextIdx }));
    }
  };

  const waQueueCancel = () => setWaQueue(null);
  const dismissWaPrompt = () => setWaPrompt(null);

  // شاشة قائمة إرسال واتساب المنبثقة بعد الحفظ
  if (waQueue) {
    const current  = waQueue.list[waQueue.idx];
    const progress = waQueue.idx + 1;
    const total    = waQueue.list.length;
    return (
      <div className="space-y-4">
        <div className="bg-green-900/30 border border-green-500/20 rounded-2xl p-4 text-center">
          <div className="text-3xl mb-2">💬</div>
          <div className="text-white font-black">إرسال تنبيه واتساب لأولياء الأمور</div>
          <div className="text-slate-400 text-xs mt-1">{progress} من {total}</div>
        </div>

        <div className="bg-slate-800 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${((progress - 1) / total) * 100}%` }} />
        </div>

        <div className="bg-slate-800/60 border border-green-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Av name={current.student.name} />
            <div className="flex-1 min-w-0">
              <div className="text-white font-black">{current.student.name}</div>
              <div className="text-slate-400 text-xs">
                {current.kind === "l" ? "⏰ متأخر" : "✗ غايب"} · {current.student.parentPhone}
              </div>
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 text-slate-300 text-xs leading-relaxed whitespace-pre-line">
            {waMsg(current.student, current.kind, current.time)}
          </div>
        </div>

        <Btn variant="success" size="lg" className="w-full" onClick={waQueueNext}>
          💬 فتح واتساب — {current.student.name} ({progress}/{total})
        </Btn>
        <Btn variant="ghost" size="lg" className="w-full" onClick={waQueueCancel}>
          ✕ إيقاف الإرسال
        </Btn>

        {waToast && <Toast msg={waToast.msg} type={waToast.type} onDone={() => setWaToast(null)} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // صفحة "سجل الغياب" (الدفتر) — عرض فقط، بفلاتر صف/مجموعة/تاريخ
  // ══════════════════════════════════════════════════════════════
  if (logOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setLogOpen(false)}
            className="w-9 h-9 shrink-0 rounded-xl bg-slate-800/60 border border-slate-700/40 text-slate-300 flex items-center justify-center">
            ›
          </button>
          <div className="text-white font-black text-sm">📔 سجل الغياب</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-3.5 space-y-3">
          {/* دواير الصفوف — حجم معقول وثابت (مش بيكبر مع عرض الشاشة) عشان ما تبقاش كبيرة قوي على الشاشات الواسعة */}
          <GradeCircles value={logGrade} onChange={handleLogGradeChange} />

          {/* المجموعة جنب اليوم/الشهر والأسهم في نفس الصف */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {logGrpList.map(g => (
                <button key={g} onClick={() => handleLogGroupChange(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    logGroup === g
                      ? "bg-blue-600/25 border-blue-500/60 text-blue-200"
                      : "bg-slate-900/40 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-500"
                  }`}>
                  مجموعة {g}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={goPrevLogDate} disabled={!hasPrevLogDate}
                title="السجل اللي قبل كده"
                className="w-8 h-8 shrink-0 rounded-lg bg-slate-700/60 border border-slate-600/40 text-slate-300 disabled:opacity-25 flex items-center justify-center">
                <ChevronIcon dir="right" />
              </button>
              <div className="shrink-0 max-w-[150px]">
                <DatePicker value={logDate} onChange={setLogDate} max={TODAY} />
              </div>
              <button onClick={goNextLogDate} disabled={!hasNextLogDate}
                title="السجل اللي بعد كده"
                className="w-8 h-8 shrink-0 rounded-lg bg-slate-700/60 border border-slate-600/40 text-slate-300 disabled:opacity-25 flex items-center justify-center">
                <ChevronIcon dir="left" />
              </button>
            </div>
          </div>
          {logDatesList.length > 0 && (
            <div className="text-slate-500 text-[11px] text-center">
              {logDateIdx >= 0 ? `سجل ${logDateIdx + 1} من ${logDatesList.length}` : `${logDatesList.length} يوم مسجَّل — دوس → عشان تشوف آخرهم`}
            </div>
          )}
          {logTakenByList.length > 0 && (
            <div className="text-amber-400/90 text-[11px] text-center font-bold">
              👤 سجّله: {logTakenByList.join("، ")}
            </div>
          )}
        </div>

        {logStudentsForDisplay.length === 0 ? (
          <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">👥</div>لا يوجد طلاب</div>
        ) : (
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="led-thead text-slate-400 text-xs border-b border-slate-700/40">
                  <th className="text-right px-3 py-2.5">الطالب</th>
                  <th className="text-center px-3 py-2.5">الحالة</th>
                  <th className="text-right px-3 py-2.5">السبب</th>
                  <th className="text-right px-3 py-2.5">المسؤول</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const logHasSession = Object.keys(logRecordsMap).length > 0;
                  return logStudentsForDisplay.map((s, i) => {
                    const rec = logRecordsMap[s.id];
                    const effStatus = rec?.status || (logHasSession ? "a" : null);
                    return (
                      <tr key={s.id} className={i % 2 === 0 ? "bg-slate-900/20" : ""}>
                        <td className="px-3 py-2.5 text-white text-sm font-bold break-words">{s.name}</td>
                        <td className="px-3 py-2.5 text-center">
                          {effStatus
                            ? <div className="flex flex-col items-center gap-0.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${stCfg[effStatus].color}/20 border ${stCfg[effStatus].border}/40 ${stCfg[effStatus].text}`}>
                                  <span>{stCfg[effStatus].icon}</span><span>{stCfg[effStatus].label}</span>
                                </span>
                                {effStatus === "l" && rec?.time && (
                                  <span className="text-[10px] text-slate-500">🕐 {rec.time}</span>
                                )}
                              </div>
                            : <span className="text-slate-600 text-xs">لم يُسجَّل</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{rec?.reason || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{rec?.takenBy || "—"}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingGate && (
        <AttendancePasswordGate
          onUnlock={unlockOldDateEdit}
          onCancel={() => setPendingGate(false)}
        />
      )}

      {reportOpen && (
        <Modal title="🚫 غياب حصة" onClose={() => setReportOpen(false)} maxW="max-w-lg">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Sel value={reportGrade} onChange={e => handleReportGradeChange(e.target.value)}>
                {reportGradeOptions.map(g => <option key={g}>{g}</option>)}
              </Sel>
              <DatePicker value={reportDate} onChange={handleReportDateChange} max={TODAY} />
            </div>
            <div className="border border-slate-700/40 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="led-thead bg-slate-900/60 text-slate-400 text-xs">
                    <th className="text-right px-3 py-2">الطالب</th>
                    <th className="text-right px-3 py-2">السبب</th>
                    <th className="text-center px-3 py-2 w-16">تواصل</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-slate-500 text-xs py-4">مفيش غياب مسجّل في هذا التاريخ لهذا الصف</td></tr>
                  ) : reportRows.map(r => (
                    <tr key={r.recId} className="border-t border-slate-700/30">
                      <td className="px-3 py-2">
                        <div className="text-white text-sm font-medium">{r.name}</div>
                        <div className="text-slate-500 text-[12px]">مجموعة {r.group}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-300 text-xs">{r.reason}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleReportContacted(r.recId)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${r.contacted ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                          title={r.contacted ? "تم التواصل — اضغط للتراجع" : "لم يتم التواصل — اضغط للتأكيد"}>
                          {r.contacted ? "✓" : "✗"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* زرار غياب سريع + سجل الغياب (متاحين لكل الأدوار) */}
      <div className="flex gap-2 items-stretch">
        <button onClick={openReport}
          className="w-full bg-slate-800/60 border border-slate-700/40 rounded-2xl flex flex-row items-center justify-center gap-2 py-3 hover:bg-slate-700/50 transition-colors">
          <span className="text-xl leading-none">🚫</span>
          <span className="text-sm font-bold text-red-400">غياب</span>
        </button>
        <button onClick={openLog}
          className="w-full bg-slate-800/60 border border-slate-700/40 rounded-2xl flex flex-row items-center justify-center gap-2 py-3 hover:bg-slate-700/50 transition-colors">
          <span className="text-xl leading-none">📔</span>
          <span className="text-sm font-bold text-blue-400">سجل الغياب</span>
        </button>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
        <div className="grid grid-cols-4 gap-2 items-stretch">
          <Sel value={grade} onChange={e => handleGradeChange(e.target.value)}>
            {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
          </Sel>
          <Sel value={group} onChange={e => handleGroupChange(e.target.value)}>
            {grpList.map(g => <option key={g} value={g}>مجموعة {g}</option>)}
          </Sel>
          <DatePicker value={date} onChange={handleDateChange} max={TODAY} />
          <div className={`rounded-xl px-1 py-1 text-center border flex flex-col items-center justify-center gap-0.5 ${(!isOldDate || editUnlocked) ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}
            title={(!isOldDate || editUnlocked) ? "سجل حضور اليوم مفتوح — عدّل عادي من غير باسورد" : "ده يوم قديم — عرض فقط. المستر بس يقدر يعدّل بعد إدخال الباسورد"}>
            <span className="text-sm leading-none">{(!isOldDate || editUnlocked) ? "✓" : "🔒"}</span>
            <span className={`text-[12px] font-bold leading-tight ${(!isOldDate || editUnlocked) ? "text-emerald-400" : "text-amber-400"}`}>عرض الحضور</span>
          </div>
        </div>
      </div>

      {grpStudentsForDisplay.length === 0 && (
        <div className="text-center py-10 text-slate-600"><div className="text-4xl mb-2">👥</div>لا يوجد طلاب</div>
      )}

      {grpStudentsForDisplay.length > 0 && <>
        <div className="grid grid-cols-3 gap-1.5">
          {[{ k: "p", l: "حاضر", v: counts.p }, { k: "a", l: "غائب", v: counts.a }, { k: "l", l: "متأخر", v: counts.l }].map(x => (
            <div key={x.k} className={`rounded-lg py-2 text-center border ${stCfg[x.k].border}/30 ${stCfg[x.k].color}/10`}>
              <div className={`text-lg font-black ${stCfg[x.k].text}`}>{x.v}</div>
              <div className="text-slate-500 text-[12px]">{x.l}</div>
            </div>
          ))}
        </div>

        {/* ═══════ يوم قديم غير مفتوح للتعديل: جدول عرض فقط ═══════ */}
        {isOldDate && !editUnlocked && (
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="led-thead text-slate-400 text-xs border-b border-slate-700/40">
                  <th className="text-right px-3 py-2.5">الطالب</th>
                  <th className="text-center px-3 py-2.5">الحالة</th>
                  <th className="text-right px-3 py-2.5">السبب</th>
                </tr>
              </thead>
              <tbody>
                {grpStudentsForDisplay.map((s, i) => {
                  const rec = existingMap[s.id];
                  // لو اليوم ده اتاخد فيه حضور فعلاً (فيه سجلات لطلاب تانيين)،
                  // أي طالب من غير حالة صريحة معناه إنه ما اتحضّرش = غائب،
                  // مش "لم يُسجَّل". "لم يُسجَّل" تفضل بس لو اليوم مالوش سجل خالص.
                  const effStatus = rec?.status || (hasExistingSession ? "a" : null);
                  return (
                    <tr key={s.id} className={`${i % 2 === 0 ? "bg-slate-900/20" : ""} ${highlightId === s.id ? "ring-2 ring-amber-400/70" : ""}`}>
                      <td className="px-3 py-2.5 text-white text-sm font-bold break-words">{s.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        {effStatus
                          ? <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${stCfg[effStatus].color}/20 border ${stCfg[effStatus].border}/40 ${stCfg[effStatus].text}`}>
                                <span>{stCfg[effStatus].icon}</span><span>{stCfg[effStatus].label}</span>
                              </span>
                              {effStatus === "l" && rec?.time && (
                                <span className="text-[10px] text-slate-500">🕐 {rec.time}</span>
                              )}
                            </div>
                          : <span className="text-slate-600 text-xs">لم يُسجَّل</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{rec?.reason || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {role === "admin" && (
              <div className="p-3 border-t border-slate-700/40">
                <button onClick={() => setPendingGate(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-600/20 border border-amber-600/30 text-amber-300">
                  🔒 تعديل غياب هذا اليوم (باسورد المستر)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════ وضع التعديل: اليوم الحالي، أو يوم قديم بعد فتحه بالباسورد ═══════ */}
        {isEditable && <>
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
            {grpStudentsForDisplay.map((s, i) => {
              const st = session[s.id]?.status;
              const reason = session[s.id]?.reason || "";
              const time = session[s.id]?.time || "";
              return (
                <div key={s.id} className={`rounded-2xl border transition-all duration-200 ${st ? "border-slate-600/50" : "border-slate-700/40"} ${highlightId === s.id ? "ring-2 ring-amber-400/70" : ""}`}>
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl ${st === "p" ? "bg-emerald-500/5" : st === "a" ? "bg-red-500/5" : st === "l" ? "bg-amber-500/5" : "bg-slate-800/60"}`}>
                    <div className="w-6 h-6 rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">{i + 1}</div>
                    <Av name={s.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-bold break-words">{s.name}</div>
                      <div className="text-slate-500 text-[12px] truncate">{s.present || 0}/{s.total || 0} ({pct(s.present || 0, s.total || 0)}%)</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {[
                        ["p","✓","border-emerald-500/40","bg-emerald-500/20 text-emerald-300"],
                        ["a","✗","border-red-500/40","bg-red-500/20 text-red-300"],
                        ["l","⏰","border-amber-500/40","bg-amber-500/20 text-amber-300"]
                      ].map(([k, icon, border, active]) => (
                        <button key={k} onClick={() => mark(s.id, k)}
                          className={`w-9 h-9 rounded-lg text-sm font-bold border flex items-center justify-center transition-colors ${st === k ? `${active} ${border}` : "border-slate-700/50 text-slate-500 hover:text-white"}`}>
                          {icon}
                        </button>
                      ))}
                    </div>
                    {(st === "a" || st === "l") && (
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        {st === "l" && time && (
                          <span className="shrink-0 text-[11px] text-amber-400 font-bold" title="وقت الحضور التلقائي">
                            🕐 {time}
                          </span>
                        )}
                        <input
                          value={reasonDrafts[s.id] ?? reason}
                          onChange={e => setReasonDrafts(prev => ({ ...prev, [s.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") saveReason(s.id); }}
                          placeholder="السبب"
                          className="flex-1 min-w-0 bg-slate-900/50 border border-slate-700/40 rounded-lg px-2 py-1.5 text-[13px] text-slate-300 focus:outline-none" />
                        <button onClick={() => saveReason(s.id)}
                          className="shrink-0 w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-600/30 text-blue-300 text-xs flex items-center justify-center">
                          💾
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 pb-2 z-10">
            <button onClick={saveSession} disabled={changedIds.length === 0}
              className="w-full py-4 rounded-2xl font-black text-sm transition-all disabled:opacity-30 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
              {changedIds.length === 0
                ? "مفيش تغييرات"
                : isOldDate
                  ? `🔒 حفظ التعديل (يوم قديم) — ${changedIds.length} طالب`
                  : `💾 حفظ الحضور — ${changedIds.length} طالب`
              }
            </button>
          </div>
        </>}
      </>}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* سؤال إرسال واتساب تلقائي بعد الحفظ */}
      {waPrompt && (
        <Modal title="📲 تنبيه أولياء الأمور" onClose={dismissWaPrompt}>
          <div className="space-y-4">
            <div className="text-slate-300 text-sm text-center leading-relaxed">
              فيه <span className="text-white font-black">{waPrompt.length}</span> طالب اتسجّل غايب/متأخر النهاردة ومعاه رقم ولي أمر.
              <br />عايزة تبعتيلهم رسالة واتساب دلوقتي؟
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={dismissWaPrompt}>لأ، مش دلوقتي</Btn>
              <Btn variant="success" className="flex-1" onClick={startWaQueue}>💬 ابدأ الإرسال</Btn>
            </div>
          </div>
        </Modal>
      )}
      {waToast && <Toast msg={waToast.msg} type={waToast.type} onDone={() => setWaToast(null)} />}
    </div>
  );
}
