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
  webExams:    "app_web_exams",
  centerExams: "app_center_exams",
  examQs:      "app_exam_questions",
  activityLog: "app_activity_log",    // #4
  lastBackup:  "app_last_backup_ts",  // #1
  session:     "app_session",         // #7
};

function loadStudents()    { return lsGet(KEYS.students, INIT_STUDENTS); }
function loadSettings()    { return { ...INIT_SETTINGS, ...(lsGet(KEYS.settings, {}) || {}) }; }
function loadFinRecords()  { return lsGet(KEYS.finRecords, INIT_FIN_RECORDS); }
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

  // ── #Cloud: نسخة احتياطية يدوية على Firebase (بالزرار بس) ──
  // التخزين الأساسي محلي (localStorage) زي ما هو. الوظيفة دي بترفع
  // "لقطة" (snapshot) من كل البيانات لمستند واحد في Firestore وقت ما
  // المستخدم يدوس الزرار بنفسه، ومفيش أي رفع تلقائي أو مستمر.
  const [cloudBackupState, setCloudBackupState] = useState({ status: "idle", message: "" });
  // status: "idle" | "uploading" | "success" | "error" | "downloading"

  const backupToCloud = useCallback(async () => {
    setCloudBackupState({ status: "uploading", message: "" });
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");
      const snapshot = {
        students:    lsGet(KEYS.students,    []),
        settings:    lsGet(KEYS.settings,    {}),
        finRecords:  lsGet(KEYS.finRecords,  []),
        webExams:    lsGet(KEYS.webExams,    []),
        centerExams: lsGet(KEYS.centerExams, []),
        examQs:      lsGet(KEYS.examQs,      []),
        savedAt:     new Date().toISOString(),
      };
      await setDoc(doc(db, "elshrqawy_backups", "latest"), snapshot);
      setCloudBackupState({ status: "success", message: "تم رفع نسخة احتياطية على السحابة ✓" });
    } catch (e) {
      setCloudBackupState({ status: "error", message: "فشل الرفع — تأكد من إعداد Firebase في .env" });
    }
  }, []);

  const restoreFromCloud = useCallback(async () => {
    setCloudBackupState({ status: "downloading", message: "" });
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");
      const snap = await getDoc(doc(db, "elshrqawy_backups", "latest"));
      if (!snap.exists()) {
        setCloudBackupState({ status: "error", message: "مفيش نسخة احتياطية محفوظة على السحابة" });
        return;
      }
      const data = snap.data();
      if (data.students)    setStudents(data.students);
      if (data.settings)    setSettings(data.settings);
      if (data.finRecords)  setFinRecords(data.finRecords);
      if (data.webExams)    setWebExams(data.webExams);
      if (data.centerExams) setCenterExams(data.centerExams);
      if (data.examQs)      setExamQs(data.examQs);
      setCloudBackupState({ status: "success", message: `تم الاسترجاع من نسخة ${data.savedAt?.split("T")[0] || ""} ✓` });
    } catch (e) {
      setCloudBackupState({ status: "error", message: "فشل الاسترجاع — تأكد من إعداد Firebase في .env" });
    }
  }, []);

  return {
    students,    setStudents,
    settings,    setSettings,
    finRecords,  setFinRecords,
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
