import { useState, useCallback, useEffect, useRef } from "react";
import { lsGet, lsSet, nowStr } from "../utils";
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
};

function loadStudents()    { return lsGet(KEYS.students, INIT_STUDENTS); }
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
  //   3) نطاق البيانات المرفوعة اتقلّص لبس: المصاريف (finRecords)،
  //      الغياب (attRecords)، ودرجات/أخطاء الامتحانات — بيانات الطلاب
  //      الأساسية (اسم/موبايل/ولي أمر) والإعدادات (settings) فضلوا محليين بس.
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

      const hasAnything = newFin.length || newAtt.length || examChanges.length || newCenterExamResults.length;

      if (hasAnything) {
        const { doc, setDoc } = await import("firebase/firestore");
        const { db } = await import("../src/firebase");
        await setDoc(doc(db, "elshrqawy_daily_backups", today), {
          finRecords:        newFin,
          attRecords:        newAtt,
          examChanges,
          centerExamResults: newCenterExamResults,
          savedAt:           new Date().toISOString(),
        });
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
      snaps.forEach(d => {
        const data = d.data();
        lastDate = data.savedAt?.split("T")[0] || d.id;
        (data.finRecords || []).forEach(r => { finMap[r.id] = r; });
        (data.attRecords || []).forEach(r => { attMap[r.id] = r; });
        (data.examChanges || []).forEach(c => { examSnap[c.studentId] = c; });
        (data.centerExamResults || []).forEach(c => { examResultsMap[c.id] = c; });
      });

      // دمج مع الموجود محليًا (مش استبدال كامل) — لأن رفع السحابة نفسه تراكمي
      setFinRecords(prev => Object.values({ ...Object.fromEntries((prev || []).map(r => [r.id, r])), ...finMap }));
      setAttRecords(prev => Object.values({ ...Object.fromEntries((prev || []).map(r => [r.id, r])), ...attMap }));
      setStudents(prev => (prev || []).map(s => examSnap[s.id] ? { ...s, score: examSnap[s.id].score, weak: examSnap[s.id].weak } : s));
      setCenterExams(prev => (prev || []).map(e => examResultsMap[e.id]
        ? { ...e, _score: examResultsMap[e.id].score, _max: examResultsMap[e.id].max, correctionDate: examResultsMap[e.id].correctionDate, status: "needs_review" }
        : e));

      setCloudBackupState({ status: "success", message: `تم الاسترجاع ودمج كل النسخ اليومية (آخرها ${lastDate}) ✓` });
    } catch (e) {
      setCloudBackupState({ status: "error", message: "فشل الاسترجاع — تأكد من إعداد Firebase في .env" });
    }
  }, []);

  // ── تشغيل النسخة التراكمية أوتوماتيك أول ما الموقع يتفتح في يوم جديد ──
  const cloudAutoRan = useRef(false);
  useEffect(() => {
    if (cloudAutoRan.current) return;
    cloudAutoRan.current = true;
    runIncrementalCloudBackup(false);
  }, [runIncrementalCloudBackup]);

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
  };
}
