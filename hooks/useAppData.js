import { useState, useCallback, useEffect, useRef } from "react";
import { lsGet, lsSet, nowStr, isBlocked, normalizeAr } from "../utils";
import {
  INIT_STUDENTS, INIT_SETTINGS, INIT_FIN_RECORDS,
  WEB_EXAMS, CENTER_EXAMS, EXAM_QS,
} from "../data";

// ══════════════════════════════════════════════════════════════
// useAppData — المصدر الوحيد لكل بيانات التطبيق
// إضافات:
//   #1  — Backup تلقائي أسبوعي + تحذير storage
//   #4  — Activity Log (سجل الأنشطة)
//   #7  — نظام صلاحيات (Admin / محصّل / مدرس)
// ══════════════════════════════════════════════════════════════

const KEYS = {
  students:    "app_students",
  settings:    "app_settings",
  finRecords:  "app_fin_records",
  attRecords:  "app_att_records",   // سجلات الغياب اليومية (تعديل غياب قديم)
  webExams:    "app_web_exams",
  centerExams: "app_center_exams",
  examQs:      "app_exam_questions",
  activityLog: "app_activity_log",    // #4
  lastBackup:  "app_last_backup_ts",  // #1
  session:     "app_session",         // #7
  cloudSync:   "app_cloud_sync_state", // #Cloud (تراكمي)
  liveSyncTs:  "app_live_sync_ts",    // #LiveSync (مزامنة تلقائية لحظية)
};

function loadStudents()    { return lsGet(KEYS.students, []); }
function loadSettings()    { return { ...INIT_SETTINGS, ...(lsGet(KEYS.settings, {}) || {}) }; }
function loadFinRecords()  { return lsGet(KEYS.finRecords, INIT_FIN_RECORDS); }
function loadAttRecords()  { return lsGet(KEYS.attRecords, []); }
function loadWebExams()    { return lsGet(KEYS.webExams, WEB_EXAMS); }
function loadCenterExams() { return lsGet(KEYS.centerExams, CENTER_EXAMS); }
function loadExamQs()      { return lsGet(KEYS.examQs, EXAM_QS.map(q => ({ ...q }))); }
function loadActivityLog() { return lsGet(KEYS.activityLog, []); }  // #4

function usePersisted(key, loader) {
  const [value, setRaw] = useState(loader);
  const set = useCallback((v) => {
    setRaw(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(key, next);
      return next;
    });
  }, [key]);
  return [value, set];
}

function useLocalOnly(key, loader) {
  const [value, setRaw] = useState(loader);
  const set = useCallback((v) => {
    setRaw(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(key, next);
      return next;
    });
  }, [key]);
  return [value, set];
}

// ── #1: حساب حجم localStorage ──────────────────────────────
function getStorageUsagePct() {
  try {
    let total = 0;
    for (let k in localStorage) {
      if (!localStorage.hasOwnProperty(k)) continue;
      total += (localStorage[k].length + k.length) * 2; // UTF-16
    }
    const limit = 5 * 1024 * 1024; // 5MB تقريباً
    return Math.round((total / limit) * 100);
  } catch { return 0; }
}

// ── #DedupGuard: حماية جذرية دائمة ضد تكرار اسم الطالب ──────────
// بدل ما نحاول نمنع كل مصدر ممكن يسبب تكرار (استيراد / مزامنة لحظية بين
// الأجهزة / استرجاع نسخة سحابية قديمة / أي كود مستقبلي يضيف طالب من
// غير ما يتحقق)، بنخلي "مصدر الحقيقة" نفسه (state الطلاب هنا) مايقبلش
// أصلاً وجود اسمين متطابقين (بعد تجاهل الهمزة والمسافات الزيادة) في نفس
// اللحظة. لو حصل تكرار لأي سبب، بيتشال تلقائيًا وفورًا، والطالب اللي
// بيفضل هو: النشط (مش بلوك) عن المحذوف/البلوك، وعند التساوي اللي عنده
// سجلات مصاريف/غياب أكتر (يعني الأصلي اللي النظام فعلاً بيتعامل معاه) —
// عشان لو حصل تكرار قبل ما الحماية دي تتفعّل، منمسحش الطالب الصح بالغلط.
function dedupeStudents(list, finRecords, attRecords) {
  if (!Array.isArray(list) || list.length < 2) return list;
  const groups = {};
  list.forEach(s => {
    if (!s || !s.id) return;
    const key = normalizeAr(s.name || "").toLowerCase();
    if (!key) return;
    (groups[key] = groups[key] || []).push(s);
  });
  const dropIds = new Set();
  Object.values(groups).forEach(group => {
    if (group.length < 2) return;
    const scored = group.map(s => ({
      s,
      blockedScore: isBlocked(s) ? 1 : 0,
      recCount: finRecords.filter(r => r.studentId === s.id).length + attRecords.filter(r => r.studentId === s.id).length,
    }));
    scored.sort((a, b) => (a.blockedScore - b.blockedScore) || (b.recCount - a.recCount));
    scored.slice(1).forEach(x => dropIds.add(x.s.id));
  });
  return dropIds.size ? list.filter(s => !dropIds.has(s.id)) : list;
}


export default function useAppData() {
  const [students,    setStudents]    = usePersisted(KEYS.students,    loadStudents);
  const [settings,    setSettings]    = usePersisted(KEYS.settings,    loadSettings);
  const [finRecords,  setFinRecords]  = usePersisted(KEYS.finRecords,  loadFinRecords);
  const [attRecords,  setAttRecords]  = usePersisted(KEYS.attRecords,  loadAttRecords);
  const [webExams,    setWebExams]    = usePersisted(KEYS.webExams,    loadWebExams);
  const [centerExams, setCenterExams] = usePersisted(KEYS.centerExams, loadCenterExams);
  const [examQs,      setExamQs]      = usePersisted(KEYS.examQs,      loadExamQs);

  // ── #4: Activity Log ─────────────────────────────────────
  const [activityLog, setActivityLogRaw] = useLocalOnly(KEYS.activityLog, loadActivityLog);
  const addActivity = useCallback((action, detail = "") => {
    const entry = { id: Date.now(), ts: nowStr(), action, detail };
    setActivityLogRaw(prev => {
      const next = [entry, ...(prev || [])].slice(0, 200); // آخر 200 نشاط
      lsSet(KEYS.activityLog, next);
      return next;
    });
  }, [setActivityLogRaw]);

  // ── #7: نظام صلاحيات ─────────────────────────────────────
  // الـ session محفوظ في sessionStorage (يُمسح عند إغلاق التبويب)
  const [currentRole, setCurrentRoleState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(KEYS.session) || "null"); } catch { return null; }
  });
  const setCurrentRole = useCallback((roleObj) => {
    setCurrentRoleState(roleObj);
    try {
      if (roleObj) sessionStorage.setItem(KEYS.session, JSON.stringify(roleObj));
      else         sessionStorage.removeItem(KEYS.session);
    } catch { /* ignore */ }
  }, []);

  // ── #1: Backup تلقائي أسبوعي ──────────────────────────
  const [storageWarn,   setStorageWarn]   = useState(false);
  // pendingBackup: اسم الملف الجاهز للتحميل — الـ UI يعرض banner يطلب تأكيد
  const [pendingBackup, setPendingBackup] = useState(null); // { filename, trigger }
  const backupRan = useRef(false);

  useEffect(() => {
    if (backupRan.current) return;
    backupRan.current = true;

    // تحقق من حجم الـ storage
    const usagePct = getStorageUsagePct();
    if (usagePct > 80) setStorageWarn(true);

    // Backup تلقائي كل 7 أيام
    const lastTs = lsGet(KEYS.lastBackup, 0);
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastTs > weekMs) {
      const today = new Date().toISOString().split("T")[0];
      const filename = `auto-backup-${today}.json`;
      // trigger: دالة تُنفَّذ عند موافقة المستخدم — تبني الـ blob وتشغّل التحميل
      const trigger = () => {
        try {
          const data = {
            students:    lsGet(KEYS.students,    []),
            settings:    lsGet(KEYS.settings,    {}),
            finRecords:  lsGet(KEYS.finRecords,  []),
            attRecords:  lsGet(KEYS.attRecords,  []),
            webExams:    lsGet(KEYS.webExams,    []),
            centerExams: lsGet(KEYS.centerExams, []),
            examQs:      lsGet(KEYS.examQs,      []),
            date:        new Date().toISOString(),
            autoBackup:  true,
          };
          const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href     = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          lsSet(KEYS.lastBackup, Date.now());
        } catch { /* ignore */ }
      };
      setPendingBackup({ filename, trigger });
    }
  }, []);

  // ── #Cloud: نسخة احتياطية تراكمية تلقائية يومية على Firebase ──
  // التخزين الأساسي يفضل محلي (localStorage) زي ما هو دايمًا.
  // الفرق عن الإصدار القديم:
  //   1) بتشتغل أوتوماتيك أول ما الموقع يتفتح في يوم جديد — مفيش زرار مطلوب.
  //   2) كل يوم بيتحط مستند جديد في Collection (مش مستند واحد بيتغطى)،
  //      وبيحتوي بس على السجلات "الجديدة" اللي اتضافت من آخر نسخة (Diff)،
  //      مش كل البيانات القديمة تاني — عشان الكوتة تفضل عملية كتابة واحدة/يوم.
  //   3) النسخة التلقائية اليومية (الخلفية) نطاقها بس: المصاريف
  //      (finRecords)، الغياب (attRecords)، ودرجات/أخطاء الامتحانات.
  //   4) زرار "رفع نسخة على السحابة" اليدوي (Settings) بيرفع كمان نسخة
  //      كاملة من الطلاب (بالبلوك) والإعدادات (بالباسورد) — عشان جهاز
  //      تاني (زي نسخة سطح المكتب) يقدر "يسترجع من السحابة" ويحصل على
  //      نفس الطلاب/البلوك/الباسورد بالظبط من غير تصدير/استيراد ملف.
  const [cloudBackupState, setCloudBackupState] = useState({ status: "idle", message: "" });
  // status: "idle" | "uploading" | "success" | "error" | "downloading"

  const runIncrementalCloudBackup = useCallback(async (force = false) => {
    const today = new Date().toISOString().split("T")[0];
    const sync = lsGet(KEYS.cloudSync, {
      lastDate: null, syncedFinIds: [], syncedAttIds: [], syncedExamIds: [], examSnapshot: {},
    });
    if (!force && sync.lastDate === today) return; // اتعمل نسخة النهارده بالفعل

    setCloudBackupState({ status: "uploading", message: "" });
    try {
      const curFin         = lsGet(KEYS.finRecords,  []);
      const curAtt          = lsGet(KEYS.attRecords,  []);
      const curStudents     = lsGet(KEYS.students,    []);
      const curSettings     = lsGet(KEYS.settings,    {});
      const curCenterExams  = lsGet(KEYS.centerExams, []);

      // الجديد فقط منذ آخر نسخة (بالـ id، مش بالتاريخ، عشان يتحمل أي تعديل رجعي)
      const newFin = curFin.filter(r => !sync.syncedFinIds.includes(r.id));
      const newAtt = curAtt.filter(r => !sync.syncedAttIds.includes(r.id));

      // درجات/أخطاء الطلاب: بس اللي اتغيّر (score أو weak) عن آخر نسخة محفوظة
      const examChanges = [];
      curStudents.forEach(s => {
        const prev = sync.examSnapshot[s.id];
        const weakNow = s.weak || [];
        if (!prev || prev.score !== s.score || JSON.stringify(prev.weak || []) !== JSON.stringify(weakNow)) {
          examChanges.push({ studentId: s.id, score: s.score, weak: weakNow });
        }
      });

      // نتائج تصحيح الامتحانات (centerExams) الجديدة اللي لسه ما اترفعتش
      const newCenterExamResults = curCenterExams
        .filter(e => e.status === "needs_review" && e._score != null && !sync.syncedExamIds.includes(e.id))
        .map(e => ({ id: e.id, name: e.name, score: e._score, max: e._max, correctionDate: e.correctionDate }));

      // زرار "رفع نسخة على السحابة" اليدوي (force=true) بيرفع كمان نسخة كاملة
      // من الطلاب (بكل حالات البلوك) والإعدادات (بكل الباسوردات) — عشان أي
      // جهاز تاني (زي نسخة سطح المكتب) يقدر "يستورد" نفس الطلاب والباسورد
      // بالظبط من زرار "استرجاع من السحابة" من غير تصدير/استيراد ملف يدوي.
      const hasAnything = force || newFin.length || newAtt.length || examChanges.length || newCenterExamResults.length;

      if (hasAnything) {
        const { doc, setDoc } = await import("firebase/firestore");
        const { db } = await import("../src/firebase");
        const payload = {
          finRecords:        newFin,
          attRecords:        newAtt,
          examChanges,
          centerExamResults: newCenterExamResults,
          savedAt:           new Date().toISOString(),
        };
        if (force) {
          payload.students = curStudents; // نسخة كاملة (فيها البلوك)
          payload.settings = curSettings; // نسخة كاملة (فيها الباسورد)
        }
        await setDoc(doc(db, "elshrqawy_daily_backups", today), payload);
      }

      lsSet(KEYS.cloudSync, {
        lastDate: today,
        syncedFinIds:  [...sync.syncedFinIds,  ...newFin.map(r => r.id)],
        syncedAttIds:  [...sync.syncedAttIds,  ...newAtt.map(r => r.id)],
        syncedExamIds: [...sync.syncedExamIds, ...newCenterExamResults.map(r => r.id)],
        examSnapshot:  { ...sync.examSnapshot, ...Object.fromEntries(examChanges.map(c => [c.studentId, { score: c.score, weak: c.weak }])) },
      });

      setCloudBackupState(hasAnything
        ? { status: "success", message: `تم رفع نسخة تراكمية تلقائية ليوم ${today} ✓` }
        : { status: "success", message: `لا يوجد جديد للرفع اليوم — كل شيء متزامن ✓` });
    } catch (e) {
      setCloudBackupState({ status: "error", message: "فشل النسخ الاحتياطي — تأكد من إعداد Firebase في .env" });
    }
  }, []);

  // نسخة "يدوية" للاستخدام من زرار الإعدادات — نفس المنطق التراكمي، لكن force=true
  // (بترفع أي جديد فورًا من غير ما تستنى بداية يوم جديد)
  const backupToCloud = useCallback(() => runIncrementalCloudBackup(true), [runIncrementalCloudBackup]);

  const restoreFromCloud = useCallback(async () => {
    setCloudBackupState({ status: "downloading", message: "" });
    try {
      const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");
      const snaps = await getDocs(query(collection(db, "elshrqawy_daily_backups"), orderBy("savedAt", "asc")));
      if (snaps.empty) {
        setCloudBackupState({ status: "error", message: "مفيش نسخ احتياطية محفوظة على السحابة" });
        return;
      }

      const finMap = {}, attMap = {}, examSnap = {}, examResultsMap = {};
      let lastDate = "";
      let fullStudents = null, fullSettings = null; // آخر نسخة كاملة (من زرار الرفع اليدوي)
      snaps.forEach(d => {
        const data = d.data();
        lastDate = data.savedAt?.split("T")[0] || d.id;
        (data.finRecords || []).forEach(r => { finMap[r.id] = r; });
        (data.attRecords || []).forEach(r => { attMap[r.id] = r; });
        (data.examChanges || []).forEach(c => { examSnap[c.studentId] = c; });
        (data.centerExamResults || []).forEach(c => { examResultsMap[c.id] = c; });
        if (data.students) fullStudents = data.students; // بترتيب الوقت (asc) فآخر واحد فيه students هو الأحدث
        if (data.settings) fullSettings = data.settings;
      });

      // دمج مع الموجود محليًا (مش استبدال كامل) — لأن رفع السحابة نفسه تراكمي
      setFinRecords(prev => Object.values({ ...Object.fromEntries((prev || []).map(r => [r.id, r])), ...finMap }));
      setAttRecords(prev => Object.values({ ...Object.fromEntries((prev || []).map(r => [r.id, r])), ...attMap }));
      // الطلاب والإعدادات: لو فيه نسخة كاملة اترفعت من زرار يدوي، بتستبدل
      // بالكامل (مش دمج) — عشان البلوك والباسورد يبقوا مطابقين تمامًا
      // للنسخة اللي رفعتيها، بدل ما يفضل خليط قديم/جديد.
      if (fullStudents) {
        setStudents(fullStudents);
      } else {
        setStudents(prev => (prev || []).map(s => examSnap[s.id] ? { ...s, score: examSnap[s.id].score, weak: examSnap[s.id].weak } : s));
      }
      if (fullSettings) setSettings(fullSettings);
      setCenterExams(prev => (prev || []).map(e => examResultsMap[e.id]
        ? { ...e, _score: examResultsMap[e.id].score, _max: examResultsMap[e.id].max, correctionDate: examResultsMap[e.id].correctionDate, status: "needs_review" }
        : e));

      setCloudBackupState({ status: "success", message: `تم الاسترجاع ودمج كل النسخ اليومية (آخرها ${lastDate}) ✓` });
    } catch (e) {
      setCloudBackupState({ status: "error", message: "فشل الاسترجاع — تأكد من إعداد Firebase في .env" });
    }
  }, []);

  // ── #LiveSync: مزامنة تلقائية بين أي جهاز أونلاين (فون النت) والنسخة
  // المحلية على اللاب توب (أوفلاين) — بدون أي زرار يدوي.
  // الفكرة: كل تغيير في الطلاب أو الإعدادات (إضافة/حذف/تعديل) بيتحفظ محليًا
  // زي العادة فورًا، وكمان (لو فيه نت وقتها) بيترفع نسخة كاملة على Firebase
  // مع وقت التحديث. أي جهاز تاني (زي اللاب توب لما يوصله نت) بيقارن وقته
  // المحلي بوقت السحابة، ولو السحابة أحدث بيسحب النسخة الجديدة تلقائيًا
  // ويحدّث نفسه — كله من غير تدخّل يدوي.
  const [liveSyncState, setLiveSyncState] = useState({ status: "idle", message: "" });
  const isApplyingRemote = useRef(false);
  const pushTimer = useRef(null);
  const firstRun  = useRef(true);

  const pushLiveState = useCallback(async (ts) => {
    if (!navigator.onLine) return;
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");
      await setDoc(doc(db, "elshrqawy_live_state", "main"), {
        students:    lsGet(KEYS.students,    []),
        settings:    lsGet(KEYS.settings,    {}),
        // #StudentPortal: لازم البيانات دي كمان عشان بوابة الطالب (لينك المجموعة)
        // تقدر تعرض حضوره ومصاريفه ودرجاته لحظيًا من أي جهاز.
        finRecords:  lsGet(KEYS.finRecords,  []),
        attRecords:  lsGet(KEYS.attRecords,  []),
        webExams:    lsGet(KEYS.webExams,    []),
        // #StudentPortal: لازم centerExams كمان عشان زر "الدرجات" في بوابة
        // الطالب يقدر يترجم رقم السؤال (examErrors) لاسم/وصف السؤال الفعلي
        // من questionMeta بتاع الامتحان الورقي المرتبط.
        centerExams: lsGet(KEYS.centerExams, []),
        updatedAt: ts,
      });
      setLiveSyncState({ status: "success", message: "تمت المزامنة التلقائية ✓" });
    } catch (e) {
      setLiveSyncState({ status: "error", message: "تعذّرت المزامنة التلقائية (تأكد من النت)" });
    }
  }, []);

  // بتطبّق نسخة سحابية (جاية من getDoc أو من onSnapshot) على البيانات
  // المحلية — بتاخد بالها من كل أنواع البيانات (طلاب/مصاريف/غياب/امتحانات)
  // مش الطلاب والإعدادات بس زي أول نسخة من الميزة دي.
  const applyCloudSnapshot = useCallback((cloud) => {
    if (!cloud) return;
    const localTs = lsGet(KEYS.liveSyncTs, 0);
    if (!cloud.updatedAt || cloud.updatedAt <= localTs) return;

    // ── إصلاح جذري لمشكلة "رجوع الطلاب المكررين بعد الحذف/البلوك" ──
    // لو فيه تعديل محلي حصل من ثانية/اتنين ولسه في نافذة الـ 3 ثواني
    // قبل ما يترفع على السحابة (pushTimer لسه شغال)، وفي نفس اللحظة
    // وصل تحديث من جهاز تاني (onSnapshot) — كان الكود القديم بيستبدل
    // البيانات المحلية بالنسخة الجاية من السحابة فورًا، ويمسح التايمر
    // المجدوَل، فيضيع تعديلك المحلي (زي حذف طالب مكرر) قبل ما يوصل
    // للسحابة أصلاً من غير أي رسالة خطأ. فمرة تانية أي جهاز يعمل push
    // كانت بترجع النسخة القديمة اللي فيها التكرار وكأن حذفك ماحصلش.
    // الحل: لو فيه تعديل محلي مستني الرفع، ارفعيه فورًا الأول (بدل
    // الانتظار) وتجاهلي التحديث الجاي من السحابة مؤقتًا — هيوصلك تاني
    // صح بعد ما رفعك يخلص عن طريق onSnapshot نفسه.
    if (pushTimer.current) {
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
      const ts = Date.now();
      lsSet(KEYS.liveSyncTs, ts);
      pushLiveState(ts);
      return;
    }

    isApplyingRemote.current = true;
    setStudents(cloud.students || []);
    setSettings(prev => ({ ...prev, ...(cloud.settings || {}) }));
    setFinRecords(cloud.finRecords || []);
    setAttRecords(cloud.attRecords || []);
    setWebExams(cloud.webExams || []);
    setCenterExams(cloud.centerExams || []);
    lsSet(KEYS.liveSyncTs, cloud.updatedAt);
    setLiveSyncState({ status: "success", message: "تم تحديث البيانات من جهاز تاني تلقائيًا ✓" });
  }, [setStudents, setSettings, setFinRecords, setAttRecords, setWebExams, setCenterExams]);

  const pullLiveState = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");
      const snap = await getDoc(doc(db, "elshrqawy_live_state", "main"));
      if (!snap.exists()) return;
      applyCloudSnapshot(snap.data());
    } catch (e) {
      setLiveSyncState({ status: "error", message: "تعذّر سحب التحديثات (تأكد من النت)" });
    }
  }, [applyCloudSnapshot]);

  // أول ما الصفحة تتفتح: اسحب أحدث نسخة فورًا (لو النت شغال)، وبعدين
  // فضّل "مستمع" (onSnapshot) شغال طول الوقت — أي جهاز تاني يغيّر حاجة
  // على السحابة، الجهاز ده بيستلم التحديث لحظيًا من غير ما يحتاج refresh
  // أو ينتظر رجوع النت. ده اللي بيخلي التليفون واللاب توب "متزامنين أونلاين".
  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    pullLiveState();
    (async () => {
      try {
        const { doc, onSnapshot } = await import("firebase/firestore");
        const { db } = await import("../src/firebase");
        if (cancelled) return;
        unsub = onSnapshot(
          doc(db, "elshrqawy_live_state", "main"),
          snap => { if (snap.exists()) applyCloudSnapshot(snap.data()); },
          () => setLiveSyncState({ status: "error", message: "تعذّرت المزامنة اللحظية (تأكد من النت وصلاحيات Firestore)" })
        );
      } catch (e) {
        setLiveSyncState({ status: "error", message: "تعذّر تفعيل المزامنة اللحظية" });
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [pullLiveState, applyCloudSnapshot]);

  // أي تغيير حقيقي (من المستخدم) في الطلاب أو الإعدادات → ارفع نسخة جديدة
  // (بعد 3 ثواني هدوء عشان ميرفعش مرة لكل حرف بيتكتب)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (isApplyingRemote.current) { isApplyingRemote.current = false; return; } // تحديث جاي من السحابة نفسها، متبقاش ترفعه تاني
    const ts = Date.now();
    lsSet(KEYS.liveSyncTs, ts);
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => pushLiveState(ts), 3000);
    return () => clearTimeout(pushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, settings, finRecords, attRecords, webExams]);


  const cloudAutoRan = useRef(false);
  useEffect(() => {
    if (cloudAutoRan.current) return;
    cloudAutoRan.current = true;
    runIncrementalCloudBackup(false);
  }, [runIncrementalCloudBackup]);

  // ── #DedupGuard: تشغيل الحماية على أي تغيير في قائمة الطلاب، من أي
  // مصدر (استيراد / مزامنة لحظية / استرجاع سحابي / إضافة يدوية) ──
  useEffect(() => {
    const cleaned = dedupeStudents(students, finRecords, attRecords);
    if (cleaned !== students) setStudents(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, finRecords, attRecords]);

  return {
    students,    setStudents,
    settings,    setSettings,
    finRecords,  setFinRecords,
    attRecords,  setAttRecords,
    webExams,    setWebExams,
    centerExams, setCenterExams,
    examQs,      setExamQs,
    // #4
    activityLog, addActivity,
    // #7
    currentRole, setCurrentRole,
    // #1
    storageWarn,
    pendingBackup, dismissPendingBackup: () => setPendingBackup(null),
    // #Cloud
    cloudBackupState, backupToCloud, restoreFromCloud,
    // #LiveSync
    liveSyncState,
  };
}
