import { useState, useEffect } from "react";
import { SIDEBAR_NAV, TODAY } from "./constants";
import { fmt, waLink, lsGet, lsSet } from "./utils";
import useAppData from "./hooks/useAppData";

// UI
import { Av, Toast, TopSearchBar } from "./components/ui";
import PrinterPickerModal             from "./components/ui/PrinterPickerModal";
import PrintStatusToast               from "./components/ui/PrintStatusToast";
import { EV_CHOOSE_PRINTER }          from "./utils/print/printRouter";

// Modules
import AttendanceModule from "./components/modules/AttendanceModule";
import StudentsModule   from "./components/modules/StudentsModule";
import BlockModule      from "./components/modules/BlockModule";
import FinanceModule    from "./components/modules/FinanceModule";
import ExamsModule      from "./components/modules/ExamsModule";
import DashboardModule  from "./components/modules/DashboardModule";
import WhatsappModule   from "./components/modules/WhatsappModule";
import CallModule       from "./components/modules/CallModule";
import SettingsModule   from "./components/modules/SettingsModule";
import RoleGate, { ROLE_PERMS } from "./components/modules/RoleGate";
import StudentPortal            from "./components/StudentPortal";

// ══════════════════════════════════════════════════════════════
// ROOT APP
// كل بيانات التطبيق (state + setters) تأتي من useAppData (مصدر واحد).
// App.jsx مسؤول فقط عن: تخطيط الصفحة، التنقل بين الصفحات، وتمرير
// البيانات إلى الـ Module المطلوب — لا يحمل أي منطق تحميل/حفظ بيانات.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// THEME SYSTEM
// ══════════════════════════════════════════════════════════════
// ── Full Design Token Themes ──
// كل ثيم: accent · bg · category (dark/light/special)
const THEMES = [
  // ── Dark themes ──
  { id: "ocean",   label: "أزرق داكن",    accent: "#2563eb", bg: "#020617",  category: "dark"    },
  { id: "purple",  label: "بنفسجي",       accent: "#7c3aed", bg: "#0d0a1a",  category: "dark"    },
  { id: "emerald", label: "أخضر زمردي",   accent: "#059669", bg: "#021408",  category: "dark"    },
  { id: "sunset",  label: "برتقالي",      accent: "#ea580c", bg: "#1a0a00",  category: "dark"    },
  // ── Light themes ──
  { id: "light",   label: "فاتح",         accent: "#2563eb", bg: "#f1f5f9",  category: "light"   },
  { id: "ios",     label: "iOS",           accent: "#007aff", bg: "#f2f2f7",  category: "light"   },
  // ── Dark themes (new) ──
  { id: "crimson", label: "أحمر داكن",     accent: "#dc2626", bg: "#0f0202",  category: "dark"    },
  { id: "gold",    label: "ذهبي داكن",     accent: "#d97706", bg: "#0c0800",  category: "dark"    },
  // ── Light themes (new) ──
  { id: "paper",   label: "ورقي دافئ",     accent: "#b45309", bg: "#faf7f2",  category: "light"   },
  // ── Special ──
  { id: "saas",    label: "SaaS Pro",      accent: "#6366f1", bg: "#0a0b0f",  category: "special" },
  { id: "nova",    label: "✦ Nova Glass",  accent: "#818cf8", bg: "#07080f",  category: "special" },
  { id: "matrix",  label: "◈ Matrix",      accent: "#00ff41", bg: "#000300",  category: "special" },
  { id: "rose",    label: "✿ Rose Quartz", accent: "#e879a0", bg: "#0f0510",  category: "special" },
];

const CATEGORY_LABELS = { dark: "داكن", light: "فاتح", special: "احترافي" };

function useTheme() {
  // إصلاح #21: قراءة/كتابة مباشرة لـ localStorage بدون حماية كانت ممكن
  // ترمي استثناء في متصفحات في وضع التصفح الخاص وتوقف تحميل التطبيق بالكامل.
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("app-theme") || "ocean"; } catch { return "ocean"; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("app-theme", theme); } catch { /* quota/private mode — تجاهل بأمان */ }
  }, [theme]);
  return [theme, setThemeState];
}

function ThemePanel({ current, onChange, onClose }) {
  const categories = ["dark", "light", "special"];

  const swatchBg = (t) => {
    if (t.id === "nova")   return "linear-gradient(135deg, #818cf8 0%, #c084fc 45%, #67e8f9 100%)";
    if (t.id === "matrix") return "linear-gradient(135deg, #00ff41 0%, #003a0e 100%)";
    if (t.id === "rose")   return "linear-gradient(135deg, #e879a0 0%, #2d0525 100%)";
    return `linear-gradient(135deg, ${t.accent} 0%, ${t.bg} 100%)`;
  };

  return (
    <div
      className="shadow-2xl max-w-3xl mx-auto overflow-hidden"
      style={{ background: "var(--sidebar-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>🎨 المظهر</span>
        <button onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-xs transition-colors"
          style={{ color: "var(--text-muted)", borderRadius: "var(--radius-sm)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >✕</button>
      </div>

      {/* Grid cards — كل الاستايلات الموجودة بالفعل، بدون إنشاء أي جديد */}
      <div className="overflow-y-auto p-3" style={{ maxHeight: "60vh" }}>
        {categories.map(cat => {
          const group = THEMES.filter(t => t.category === cat);
          return (
            <div key={cat} className="mb-3">
              <div className="text-xs font-semibold mb-1.5 px-1 uppercase tracking-wider" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
                {group.map(t => {
                  const isActive = current === t.id;
                  return (
                    <button key={t.id} onClick={() => onChange(t.id)}
                      className="flex flex-col items-center gap-1.5 px-2 py-3 transition-all"
                      style={{
                        borderRadius: "var(--radius-lg)",
                        background: isActive ? `${t.accent}1f` : "var(--card-bg)",
                        border: `1px solid ${isActive ? t.accent + "70" : "var(--border)"}`,
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--border)"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "var(--card-bg)"; }}
                    >
                      {/* preview صغير من الثيم — يستخدم accent/bg الموجودين فقط */}
                      <span
                        className="relative shrink-0 border-2"
                        style={{
                          width: "34px", height: "34px", borderRadius: "50%",
                          background: swatchBg(t),
                          borderColor: isActive ? t.accent : "rgba(255,255,255,0.15)",
                          boxShadow: isActive ? `0 0 10px ${t.accent}88` : "none",
                          display: "inline-block",
                        }}
                      >
                        {isActive && (
                          <span className="absolute -top-1 -left-1 w-4 h-4 flex items-center justify-center rounded-full text-[12px] font-bold"
                            style={{ background: t.accent, color: "#fff" }}>✓</span>
                        )}
                      </span>
                      <span className="text-xs text-center leading-tight" style={{ color: isActive ? "var(--text-primary)" : "var(--text-muted)", fontWeight: isActive ? 700 : 400 }}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS PANEL — 3 أقسام (غياب / مصروفات / امتحانات)
// كل قسم بيحمل رقمه الخاص جوه الجرس، ولما تفتحيه (تضغطي عليه) رقمه
// بيختفي من إجمالي الجرس لنفس اليوم (حتى لو قفلتي القائمة وفتحتيها تاني).
// ══════════════════════════════════════════════════════════════
function NotifSection({ icon, title, count, expanded, onToggle, children }) {
  return (
    <div>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between text-right"
        style={{ background: expanded ? "var(--card-bg)" : "transparent" }}>
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          <span>{icon}</span>{title}
        </span>
        <span className="flex items-center gap-2">
          {count > 0 && (
            <span className="w-5 h-5 flex items-center justify-center text-[12px] font-bold rounded-full bg-red-500 text-white">{count}</span>
          )}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{expanded ? "▲" : "▼"}</span>
        </span>
      </button>
      {expanded && <div className="pb-2" style={{ borderBottom: "1px solid var(--border)" }}>{children}</div>}
    </div>
  );
}

function NotifEmpty({ msg = "لا يوجد" }) {
  return <div className="py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>{msg}</div>;
}

function AbsentNotifRow({ a, onToggleContacted }) {
  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <Av name={a.name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.name}</div>
        <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{a.grade} · مجموعة {a.group}</div>
      </div>
      {a.contacted ? (
        <button onClick={() => onToggleContacted(a.recId, false)}
          className="text-[13px] px-2 py-1 rounded-lg shrink-0"
          style={{ background: "rgba(22,163,74,0.15)", color: "#4ade80" }}>✓ تم التواصل</button>
      ) : (
        <button onClick={() => onToggleContacted(a.recId, true, a.phone)}
          className="text-[13px] px-2 py-1 rounded-lg shrink-0"
          style={{ background: "rgba(22,163,74,0.2)", color: "#86efac" }}>💬 تواصل</button>
      )}
    </div>
  );
}

export default function App() {
  // 🔗 بوابة الطالب: لينك مستقل تمامًا (?portal=1) — بيتفتح من قسم
  // الامتحانات → الويب → "رابط المجموعة". لازم يتشيّك هنا فورًا قبل أي
  // hook تاني، عشان الجهاز اللي بيفتح اللينك ده (موبايل الطالب) ميعملش
  // useAppData() اللي بيحمّل/يرفع بيانات الجهاز المحلي (اللي أصلاً فاضية
  // عند الطالب) فوق النسخة السحابية الحقيقية بالغلط.
  const portalParams = new URLSearchParams(window.location.search);
  if (portalParams.get("portal") === "1") {
    return <StudentPortal grade={portalParams.get("grade") || ""} group={portalParams.get("group") || ""} />;
  }

  const [theme, setTheme]             = useTheme();
  const [showTheme, setShowTheme]     = useState(false);
  const [page, setPage]               = useState("attendance");
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifs, setShowNotifs]     = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false); // #4
  // Printer Intelligence System
  const [showPrinterPicker, setShowPrinterPicker]   = useState(false);
  const [detectedPrinters,  setDetectedPrinters]    = useState([]);
  const [wasAutoDetected,   setWasAutoDetected]      = useState(false);
  const [storageWarnDismissed, setStorageWarnDismissed] = useState(false); // #1
  const [jumpStudent, setJumpStudent] = useState(null);
  // بحث التوبار الموحّد: كل صفحة عندها "جمب" خاص بيها عشان لما تدوّري
  // على طالب وانتي واقفة في صفحة معينة، ييجيلك في نفس الصفحة مش يوديكي
  // لصفحة الطلاب دايمًا.
  const [financeJump,    setFinanceJump]    = useState(null);
  const [financeMode,     setFinanceMode]     = useState(null); // null | "late" | "current" | "past" | "log"
  const [attendanceJump, setAttendanceJump] = useState(null);
  const [dashboardJump,  setDashboardJump]  = useState(null);
  const [dashboardSectionJump, setDashboardSectionJump] = useState(null); // 🔔 زرار الإشعارات → قسم "حالة حرجة"
  const [toast, setToast]             = useState(null); // #3 — global toast
  const showToast = (msg, type="success") => setToast({ msg, type });

  // ── كل البيانات الأساسية: مصدر واحد فقط ──
  const {
    students,    setStudents,
    settings,    setSettings,
    finRecords,  setFinRecords,
    attRecords,  setAttRecords,
    webExams,    setWebExams,
    centerExams, setCenterExams,
    examQs,      setExamQs,
    activityLog, addActivity,   // #4
    currentRole, setCurrentRole, // #7
    storageWarn,                 // #1
    pendingBackup, dismissPendingBackup, // #1
    cloudBackupState, backupToCloud, restoreFromCloud, // #Cloud
  } = useAppData();

  // ── Derived: alerts from students ────────────────
  const alerts = (students || []).filter(s =>
    s && (s.score < 60 || s.absent > 8 || ((s.totalFees || 0) - (s.paid || 0)) > 1200)
  );

  // ══════════════════════════════════════════════════════════════
  // 🔔 التنبيهات الجديدة — 3 أقسام: غياب اليوم / مصروفات اليوم / امتحانات الأسبوع
  // "مقروء" بيتحفظ في localStorage بتاريخ اليوم — يوم جديد = تصفير تلقائي.
  // ══════════════════════════════════════════════════════════════
  const NOTIF_READ_KEY = "app_notif_read";
  const [notifRead, setNotifReadRaw] = useState(() => {
    const saved = lsGet(NOTIF_READ_KEY, null);
    return (saved && saved.date === TODAY) ? saved.read : { absence: false, finance: false, exams: false, phone: false };
  });
  const [expandedNotif, setExpandedNotif] = useState(null);
  const markNotifRead = (key) => {
    setNotifReadRaw(prev => {
      const next = { ...prev, [key]: true };
      lsSet(NOTIF_READ_KEY, { date: TODAY, read: next });
      return next;
    });
  };
  const toggleNotifSection = (key) => {
    setExpandedNotif(v => v === key ? null : key);
    markNotifRead(key);
  };
  const handleToggleContacted = (recId, contacted, phone) => {
    setAttRecords(prev => (prev || []).map(r => r.id === recId ? { ...r, contacted } : r));
    if (contacted && phone) { const url = waLink(phone); if (url) window.open(url, "_blank"); }
  };

  // 1) غياب اليوم — مين اتواصلوا معاه ومين لسه
  const absentToday = (attRecords || [])
    .filter(r => r.date === TODAY && r.status === "a")
    .map(r => {
      const st = (students || []).find(s => s.id === r.studentId);
      return { recId: r.id, name: st?.name || r.studentId, phone: st?.parentPhone, grade: r.grade, group: r.group, contacted: !!r.contacted };
    });
  const absentNotContacted = absentToday.filter(a => !a.contacted);
  const absentContacted    = absentToday.filter(a => a.contacted);

  // 2) مصروفات اليوم — عدد الطلاب اللي دفعوا واجمالي كل صف واجمالي عام
  const dateOfFin = r => (r.timestamp || "").slice(0, 10);
  const finToday = (finRecords || []).filter(r => dateOfFin(r) === TODAY);
  const finByGrade = {};
  finToday.forEach(r => {
    const g = r.grade || "غير محدد";
    if (!finByGrade[g]) finByGrade[g] = { ids: new Set(), total: 0 };
    finByGrade[g].ids.add(r.studentId);
    finByGrade[g].total += (r.amount || 0);
  });
  const finGradesList = Object.entries(finByGrade).map(([grade, v]) => ({ grade, count: v.ids.size, total: v.total }));
  const finGrandTotal = finGradesList.reduce((a, g) => a + g.total, 0);
  const finGrandCount = new Set(finToday.map(r => r.studentId)).size;

  // 3) طلاب من غير امتحان خلال آخر ٧ أيام (حسب امتحانات الموقع webExams، اللي بتسجل نتيجة كل طالب بالاسم)
  const weekAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const examTakenIds = new Set();
  (webExams || []).forEach(e => { if (e.date >= weekAgoDate) (e.results || []).forEach(r => examTakenIds.add(r.studentId)); });
  const examsMissing = (students || []).filter(s => s && !examTakenIds.has(s.id));
  const examsMissingByGrade = Object.entries(
    examsMissing.reduce((acc, s) => { const g = s.grade || "غير محدد"; (acc[g] ||= []).push(s); return acc; }, {})
  );

  // 4) طلاب بدون أي رقم هاتف مسجَّل (لا رقم الطالب ولا رقم ولي الأمر)
  const noPhoneStudents = (students || []).filter(s => s && !(s.parentPhone && s.parentPhone.trim()) && !(s.phone && s.phone.trim()));
  const noPhoneByGrade = Object.entries(
    noPhoneStudents.reduce((acc, s) => { const g = s.grade || "غير محدد"; (acc[g] ||= []).push(s); return acc; }, {})
  );

  const absenceCount = absentToday.length;
  const financeCount = finGrandCount;
  const examsCount   = examsMissing.length;
  const noPhoneCount = noPhoneStudents.length;
  const notifBadgeTotal =
    (notifRead.absence ? 0 : absenceCount) +
    (notifRead.finance ? 0 : financeCount) +
    (notifRead.exams   ? 0 : examsCount) +
    (notifRead.phone   ? 0 : noPhoneCount);

  // فتح ملف الطالب مباشرة من قائمة "بدون رقم" — بيقفل قائمة التنبيهات
  // ويودّي المستخدم لصفحة الطلاب على طول عشان يضيف الرقم.
  const openStudentFromNotif = s => {
    setJumpStudent(s.id);
    setPage("students");
    setShowNotifs(false);
  };

  // نمرر فقط الـ id بدل الكائن كامل — عشان StudentsModule يقرأ
  // أحدث نسخة من بيانات الطالب من `students` وقت التنقل، مش نسخة قديمة (snapshot)
  // محفوظة من وقت الضغط على نتيجة البحث (إصلاح #4).
  const handleStudentSelect = s => {
    if (safePage === "finance")     { setFinanceJump(s.id);    return; }
    if (safePage === "attendance")  { setAttendanceJump(s.id); return; }
    if (safePage === "dashboard")   { setDashboardJump(s.id);  return; }
    // أي صفحة تانية (طلاب، امتحانات، واتساب، بلوك...) → نعرض بروفايل الطالب كامل
    setJumpStudent(s.id);
    setPage("students");
  };

  // Printer Intelligence — يستمع لطلب اختيار الطابعة
  useEffect(() => {
    const handler = (e) => {
      const { printers = [], autoDetected = false } = e.detail || {};
      setDetectedPrinters(printers);
      setWasAutoDetected(autoDetected);
      setShowPrinterPicker(true);
    };
    window.addEventListener(EV_CHOOSE_PRINTER, handler);
    return () => window.removeEventListener(EV_CHOOSE_PRINTER, handler);
  }, []);

  const bgStyle = settings?.bg
    ? (settings.bg.startsWith("data:") || settings.bg.startsWith("http"))
      ? { backgroundImage: `url(${settings.bg})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { backgroundColor: settings.bg }
    : { backgroundColor: "#020617" };

  const centerName = settings?.centerName || "مركز تعليمي";

  // #7 — إذا لم يسجل الدخول بعد، نعرض RoleGate
  if (!currentRole) {
    return <RoleGate settings={settings} onEnter={(r) => { setCurrentRole(r); addActivity("login", `دخل كـ ${r.label}`); }} />;
  }

  // #7 — الصفحات المسموح بها للدور الحالي
  const allowedPages = ROLE_PERMS[currentRole.role] || [];
  const safePage = allowedPages.includes(page) ? page : allowedPages[0] || "dashboard";

  return (
    <div className="flex h-screen overflow-hidden nova-bg" dir="rtl"
      style={{ fontFamily: "var(--font-base,'Segoe UI',Tahoma,sans-serif)", color: "var(--text-primary)", ...bgStyle }}>
      {/* Aurora orbs — Nova theme فقط */}
      <div className="aurora-orb-1" />
      <div className="aurora-orb-2" />
      <div className="aurora-orb-3" />
      {settings?.bg && settings.bg.startsWith("data:") && (
        <div className="absolute inset-0 pointer-events-none z-0" style={{ background: "rgba(2,6,23,0.80)" }} />
      )}

      {/* ─── Sidebar ─── */}
      <aside className="relative z-10 flex flex-col shrink-0"
        style={{ width: "72px", background: "var(--sidebar-bg)", borderLeft: "1px solid var(--border)" }}>
        <div className="flex flex-col items-center justify-center gap-2" style={{ height: "25%", minHeight: "140px", borderBottom: "1px solid var(--border)" }}>
          {settings?.logo
            ? <img src={settings.logo} alt="logo" className="w-10 h-10 object-cover" style={{ borderRadius: "var(--radius-md)" }} />
            : <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-violet-600 to-indigo-700 flex items-center justify-center text-xl shadow-lg" style={{ borderRadius: "var(--radius-md)" }}>🏫</div>
          }
          <div className="text-center leading-tight px-1">
            <div className="font-black" style={{ fontSize: "12px", lineHeight: "1.3", color: "var(--text-primary)", whiteSpace: "pre-line" }} title={centerName}>{centerName.split(" ").slice(0, 2).join("\n")}</div>
          </div>
          {allowedPages.includes("settings") && (
            <button onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center transition-colors"
              style={{ borderRadius: "var(--radius-md)", color: "var(--text-muted)", background: "var(--card-bg)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "var(--card-bg)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
          )}
        </div>
        <nav className="flex-1 flex flex-col items-center justify-around py-3">
          {SIDEBAR_NAV.filter(n => allowedPages.includes(n.key)).map(n => {
            const active = page === n.key;
            return (
              <div key={n.key} className="relative">
                <button
                  onClick={() => { setPage(n.key); if (n.key === "finance") setFinanceMode(null); }}
                  className="relative flex flex-col items-center justify-center gap-1 transition-all duration-200"
                  style={{
                    width: "56px", height: "56px",
                    borderRadius: "var(--radius-lg)",
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#fff" : "var(--text-muted)",
                    transform: active ? "scale(1.05)" : "scale(1)",
                    boxShadow: active ? "var(--shadow-accent)" : "none",
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--card-bg)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}}
                >
                  {n.key === "dashboard" && alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-black z-10 animate-pulse" style={{ fontSize: "11px" }}>{alerts.length}</span>
                  )}
                  <span className="text-xl leading-none">{n.icon}</span>
                  <span className="font-medium leading-none" style={{ fontSize: "11px" }}>{n.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 shrink-0"
          style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => { setShowTheme(v => !v); setShowNotifs(false); }}
            className="w-9 h-9 flex flex-col items-center justify-center gap-1 transition-colors shrink-0"
            style={{ borderRadius: "var(--radius-md)", background: "var(--card-bg)", color: "var(--text-muted)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--card-bg)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            title="الاستايل"
          >
            <div className="w-4 h-0.5 rounded" style={{ background: "currentColor" }} />
            <div className="w-4 h-0.5 rounded" style={{ background: "currentColor" }} />
            <div className="w-3 h-0.5 rounded" style={{ background: "currentColor" }} />
          </button>
          <TopSearchBar students={students || []} onSelect={handleStudentSelect} />
          {/* #9 — Dark/Light toggle سريع */}
          <button
            title="تبديل المظهر الفاتح / الداكن"
            onClick={() => {
              const current = THEMES.find(t => t.id === theme);
              const isLight = current?.category === "light";
              setTheme(isLight ? "ocean" : "light");
            }}
            className="w-9 h-9 flex items-center justify-center text-sm shrink-0 transition-colors"
            style={{ borderRadius: "var(--radius-md)", background: "var(--card-bg)", color: "var(--text-muted)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--card-bg)"}
          >
            {THEMES.find(t=>t.id===theme)?.category === "light" ? "🌙" : "☀️"}
          </button>
          <button onClick={() => { setShowNotifs(v => !v); setShowTheme(false); }}
            className="relative w-9 h-9 flex items-center justify-center text-sm shrink-0 transition-colors"
            style={{ borderRadius: "var(--radius-md)", background: "var(--card-bg)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--card-bg)"}
          >
            🔔
            {notifBadgeTotal > 0 && <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">{notifBadgeTotal}</span>}
          </button>
          {/* #7 — زر تسجيل الخروج */}
          <button title={`خروج (${currentRole.label})`}
            onClick={() => { addActivity("logout", `خرج من ${currentRole.label}`); setCurrentRole(null); }}
            className="w-9 h-9 flex items-center justify-center text-sm shrink-0 transition-colors"
            style={{ borderRadius: "var(--radius-md)", background: "var(--card-bg)", color: "var(--text-muted)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--card-bg)"}
          >
            {currentRole.icon}
          </button>
        </header>

        {/* #1 — Storage Warning */}
        {storageWarn && !storageWarnDismissed && (
          <div className="px-4 py-2 text-xs text-center font-bold"
            style={{ background: "#92400e", color: "#fef3c7" }}>
            ⚠️ مساحة التخزين تقترب من الحد — قم بتصدير نسخة احتياطية من الإعدادات
            <button onClick={() => setStorageWarnDismissed(true)} className="mr-3 underline">إخفاء</button>
          </div>
        )}
        {/* #1 — Auto Backup Banner — مخفي بالكامل بناءً على طلب صريح
            (بيظل النسخ الاحتياطي شغال في الخلفية، بس من غير ما يبان أي بانر). */}
        {showTheme && (
          <div className="fixed inset-0 z-40" onClick={() => setShowTheme(false)}>
            <div className="absolute top-14 left-4 right-4 max-w-3xl mx-auto" onClick={e => e.stopPropagation()}>
              <ThemePanel current={theme} onChange={setTheme} onClose={() => setShowTheme(false)} />
            </div>
          </div>
        )}
        {/* Notifications panel — إصلاح #5: لف بـ overlay كامل الشاشة
            (نفس نمط ThemePanel) بحيث الضغط بره البانل يقفلها. */}
        {showNotifs && (
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)}>
            <div className="absolute top-14 left-4 right-4 shadow-xl max-w-lg mx-auto overflow-hidden"
              style={{ background: "var(--sidebar-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)" }}
              onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>🔔 التنبيهات{notifBadgeTotal > 0 ? ` (${notifBadgeTotal})` : ""}</span>
                <div className="flex items-center gap-3">
                  {allowedPages.includes("dashboard") && (
                    <button
                      onClick={() => { setPage("dashboard"); setDashboardSectionJump(Date.now()); setShowNotifs(false); }}
                      className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
                    >🔴 حالة حرجة</button>
                  )}
                  <button onClick={() => setShowNotifs(false)} style={{ color: "var(--text-muted)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
                  >✕</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y" style={{ borderColor: "var(--border)" }}>
                {/* 1) غياب اليوم */}
                <NotifSection icon="🚫" title="غياب اليوم" count={notifRead.absence ? 0 : absenceCount}
                  expanded={expandedNotif === "absence"} onToggle={() => toggleNotifSection("absence")}>
                  {absentToday.length === 0 ? <NotifEmpty msg="مفيش غياب اليوم 🎉" /> : (
                    <>
                      {absentNotContacted.length > 0 && (
                        <div className="text-[13px] font-bold px-4 pt-1 pb-1" style={{ color: "#f87171" }}>لم يتم التواصل ({absentNotContacted.length})</div>
                      )}
                      {absentNotContacted.map(a => <AbsentNotifRow key={a.recId} a={a} onToggleContacted={handleToggleContacted} />)}
                      {absentContacted.length > 0 && (
                        <div className="text-[13px] font-bold px-4 pt-2 pb-1" style={{ color: "#4ade80" }}>تم التواصل ({absentContacted.length})</div>
                      )}
                      {absentContacted.map(a => <AbsentNotifRow key={a.recId} a={a} onToggleContacted={handleToggleContacted} />)}
                    </>
                  )}
                </NotifSection>

                {/* 2) مصروفات اليوم */}
                <NotifSection icon="💰" title="مصروفات اليوم" count={notifRead.finance ? 0 : financeCount}
                  expanded={expandedNotif === "finance"} onToggle={() => toggleNotifSection("finance")}>
                  {finGradesList.length === 0 ? <NotifEmpty msg="لسه محدش دفع النهاردة" /> : (
                    <>
                      {finGradesList.map(g => (
                        <div key={g.grade} className="px-4 py-2 flex justify-between items-center text-xs">
                          <span style={{ color: "var(--text-primary)" }}>{g.grade}</span>
                          <span style={{ color: "var(--text-muted)" }}>{g.count} طالب · {fmt(g.total)}</span>
                        </div>
                      ))}
                      <div className="px-4 py-2 flex justify-between items-center text-xs font-bold" style={{ borderTop: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--text-primary)" }}>الإجمالي</span>
                        <span style={{ color: "#fbbf24" }}>{finGrandCount} طالب · {fmt(finGrandTotal)}</span>
                      </div>
                    </>
                  )}
                </NotifSection>

                {/* 3) طلاب من غير امتحان خلال الأسبوع */}
                <NotifSection icon="📝" title="بدون امتحان (٧ أيام)" count={notifRead.exams ? 0 : examsCount}
                  expanded={expandedNotif === "exams"} onToggle={() => toggleNotifSection("exams")}>
                  {examsMissing.length === 0 ? <NotifEmpty msg="كل الطلاب عملوا امتحان الأسبوع ده ✓" /> : (
                    examsMissingByGrade.map(([grade, list]) => (
                      <div key={grade} className="px-4 py-2">
                        <div className="text-[13px] font-bold mb-1" style={{ color: "var(--text-muted)" }}>{grade} ({list.length})</div>
                        <div className="flex flex-wrap gap-1">
                          {list.map(s => (
                            <span key={s.id} className="text-[12px] px-2 py-0.5 rounded-lg" style={{ background: "var(--card-bg)", color: "var(--text-primary)" }}>{s.name}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </NotifSection>

                {/* 4) طلاب بدون رقم هاتف ولي أمر */}
                <NotifSection icon="📵" title="بدون رقم" count={notifRead.phone ? 0 : noPhoneCount}
                  expanded={expandedNotif === "phone"} onToggle={() => toggleNotifSection("phone")}>
                  {noPhoneStudents.length === 0 ? <NotifEmpty msg="كل الطلاب عندهم رقم مسجَّل ✓" /> : (
                    noPhoneByGrade.map(([grade, list]) => (
                      <div key={grade} className="px-4 py-2">
                        <div className="text-[13px] font-bold mb-1" style={{ color: "var(--text-muted)" }}>{grade} ({list.length})</div>
                        <div className="flex flex-wrap gap-1">
                          {list.map(s => (
                            <button key={s.id} onClick={() => openStudentFromNotif(s)}
                              className="text-[12px] px-2 py-0.5 rounded-lg"
                              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>{s.name} ›</button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </NotifSection>
              </div>
              {/* #4 — Activity Log زر */}
              <div style={{ borderTop: "1px solid var(--border)" }} className="px-4 py-2">
                <button onClick={() => { setShowNotifs(false); setShowActivityLog(true); }}
                  className="w-full text-xs text-center py-1"
                  style={{ color: "var(--text-muted)" }}>
                  📋 سجل النشاط ({activityLog?.length || 0} حدث)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto">
            {safePage === "attendance" && <AttendanceModule students={students || []} setStudents={setStudents} attRecords={attRecords || []} setAttRecords={setAttRecords} settings={settings} role={currentRole.role} addActivity={addActivity} jumpTo={attendanceJump} onJumpDone={() => setAttendanceJump(null)} />}
            {safePage === "students"   && <StudentsModule   students={students || []} setStudents={setStudents} finRecords={finRecords || []} setFinRecords={setFinRecords} attRecords={attRecords || []} setAttRecords={setAttRecords} webExams={webExams || []} centerExams={centerExams || []} settings={settings} jumpTo={jumpStudent} onJumpDone={() => setJumpStudent(null)} addActivity={addActivity} />}
            {safePage === "addStudent" && <StudentsModule   students={students || []} setStudents={setStudents} finRecords={finRecords || []} settings={settings} addActivity={addActivity} startAdd onDone={() => setPage("students")} />}
            {safePage === "finance"    && <FinanceModule    students={students || []} settings={settings} setSettings={setSettings} finRecords={finRecords || []} setFinRecords={setFinRecords} setStudents={setStudents} addActivity={addActivity} role={currentRole.role} jumpTo={financeJump} onJumpDone={() => setFinanceJump(null)} financeMode={financeMode} setFinanceMode={setFinanceMode} />}
            {safePage === "exams"      && <ExamsModule      students={students || []} setStudents={setStudents} addActivity={addActivity} questions={examQs || []} setQuestions={setExamQs} webExams={webExams || []} setWebExams={setWebExams} centerExams={centerExams || []} setCenterExams={setCenterExams} />}
            {safePage === "dashboard"  && <DashboardModule  students={students || []} finRecords={finRecords || []} attRecords={attRecords || []} settings={settings} role={currentRole.role} setStudents={setStudents} addActivity={addActivity} activityLog={activityLog || []} jumpTo={dashboardJump} onJumpDone={() => setDashboardJump(null)} showToast={showToast} sectionJump={dashboardSectionJump} onSectionJumpDone={() => setDashboardSectionJump(null)} />}
            {safePage === "call"       && <CallModule       students={students || []} />}
            {safePage === "whatsapp"   && <WhatsappModule   students={students || []} settings={settings} attRecords={attRecords || []} />}
            {safePage === "block"      && <BlockModule      students={students || []} setStudents={setStudents} finRecords={finRecords || []} setFinRecords={setFinRecords} attRecords={attRecords || []} setAttRecords={setAttRecords} webExams={webExams || []} setWebExams={setWebExams} addActivity={addActivity} />}
          </div>
        </main>
      </div>

      {/* Overlays */}
      {/* #4 — Activity Log Modal */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowActivityLog(false)}>
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900">
              <span className="text-white font-black text-sm">📋 سجل النشاط</span>
              <button onClick={() => setShowActivityLog(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {(activityLog||[]).slice(0,50).map((e,i) => (
                <div key={e.id||i} className="px-4 py-2.5 flex items-start gap-3" style={{ borderBottom:"1px solid var(--border)" }}>
                  <span className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{e.ts}</span>
                  <div className="flex-1 text-xs" style={{ color:"var(--text-primary)" }}>{e.action}{e.detail ? ` — ${e.detail}` : ""}</div>
                </div>
              ))}
              {(activityLog||[]).length === 0 && <div className="py-8 text-center text-sm" style={{ color:"var(--text-muted)" }}>لا يوجد نشاط بعد</div>}
            </div>
          </div>
        </div>
      )}
      {/* Printer Intelligence — Modal اختيار الطابعة */}
      {showPrinterPicker && (
        <PrinterPickerModal
          printers={detectedPrinters}
          autoDetected={wasAutoDetected}
          onSelect={(type, name) => {
            addActivity("إعداد طابعة", `${type}${name ? " — " + name : ""}`);
          }}
          onClose={() => setShowPrinterPicker(false)}
        />
      )}
      {/* Print Status Toast — يظهر تلقائياً عند أي طباعة */}
      <PrintStatusToast />
      {showSettings && <SettingsModule settings={settings} setSettings={setSettings} students={students || []} setStudents={setStudents} finRecords={finRecords || []} setFinRecords={setFinRecords} webExams={webExams || []} setWebExams={setWebExams} centerExams={centerExams || []} setCenterExams={setCenterExams} examQs={examQs || []} setExamQs={setExamQs} cloudBackupState={cloudBackupState} backupToCloud={backupToCloud} restoreFromCloud={restoreFromCloud} addActivity={addActivity} onClose={() => setShowSettings(false)} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
