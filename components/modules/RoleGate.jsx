import { useState } from "react";
import { checkPwd } from "../../utils";

// ══════════════════════════════════════════════════════════════
// ROLE GATE — شاشة اختيار الدور وإدخال كلمة المرور (#7)
// إصلاح الأمان:
//   - كل الأدوار تحتاج كلمة مرور (مش المدير فقط)
//   - checkPwd يدعم SHA-256 hash + plain text للتوافق مع القديم
// ══════════════════════════════════════════════════════════════

const ROLES = [
  { key: "admin",  icon: "👑", label: "المستر",  desc: "كل الصلاحيات",                              color: "#6366f1", pwdKey: "password"        },
  { key: "assist", icon: "💼", label: "Assist",  desc: "الحضور، المصاريف، الامتحانات، برج المراقبة، متابعة أولياء الأمور", color: "#f59e0b", pwdKey: "cashierPassword"  },
];

export const ROLE_PERMS = {
  admin:  ["attendance","students","addStudent","finance","exams","dashboard","whatsapp","block","settings","parentFollowup"],
  assist: ["attendance","finance","exams","dashboard","parentFollowup","addStudent"],
};

// صلاحيات عرض مقيّدة داخل صفحة المصاريف لدور Assist:
// - يشوف خانة "الطلاب المتأخرين في السداد" فقط
// - ممنوع يشوف "عدد الطلاب الكلي" أو "إجمالي المصاريف المتأخرة" (الرقم الكلي)
export const FINANCE_VIEW_RESTRICTIONS = {
  assist: { hideTotalStudentsCount: true, hideTotalOverdueAmount: true, showOverdueStudentsList: true },
};

export default function RoleGate({ settings, onEnter }) {
  const [role,    setRole]    = useState(null);
  const [pw,      setPw]      = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleEnter = async () => {
    if (!role) { setErr("اختر الدور أولاً"); return; }
    if (!pw) { setErr("اكتب كلمة المرور"); return; }
    setLoading(true);
    const ok = await checkPwd(pw, settings?.[role.pwdKey]);
    setLoading(false);
    if (!ok) { setErr("كلمة المرور غلط"); return; }
    onEnter({ role: role.key, label: role.label, icon: role.icon });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]"
      style={{ background: "var(--bg, #020617)" }}>
      <div className="w-full max-w-sm space-y-5">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="text-5xl mb-2">🏫</div>
          <div className="text-white font-black text-xl">{settings?.centerName || "مركز تعليمي"}</div>
          <div className="text-xs" style={{ color: "var(--text-muted, #64748b)" }}>اختر دورك وأدخل كلمة المرور</div>
        </div>

        {/* Role cards */}
        <div className="space-y-2">
          {ROLES.map(r => (
            <button key={r.key} onClick={() => { setRole(r); setPw(""); setErr(""); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-right"
              style={{
                background: role?.key === r.key ? `${r.color}20` : "var(--card-bg, #1e293b)",
                border: `1.5px solid ${role?.key === r.key ? r.color : "var(--border, #334155)"}`,
                boxShadow: role?.key === r.key ? `0 0 0 1px ${r.color}40` : "none",
              }}>
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: role?.key === r.key ? r.color : "var(--text-primary, #f1f5f9)" }}>{r.label}</div>
                <div className="text-xs" style={{ color: "var(--text-muted, #64748b)" }}>{r.desc}</div>
              </div>
              {role?.key === r.key && <span className="text-xs font-bold" style={{ color: r.color }}>✓</span>}
            </button>
          ))}
        </div>

        {/* كلمة المرور */}
        {role && (
          <input
            type="password"
            value={pw}
            autoFocus
            onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => { if (e.key === "Enter") handleEnter(); }}
            placeholder="كلمة المرور"
            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-2xl px-4 py-3.5 text-white text-sm text-center focus:outline-none focus:border-blue-500/60"
          />
        )}

        {err && <p className="text-red-400 text-xs text-center">{err}</p>}

        <button onClick={handleEnter} disabled={loading || !role}
          className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-40"
          style={{ background: role ? "var(--accent, #2563eb)" : "var(--border, #334155)" }}>
          {loading ? "⏳ جاري التحقق..." : role ? `${role.icon} دخول كـ ${role.label}` : "اختر الدور أولاً"}
        </button>
      </div>
    </div>
  );
}
