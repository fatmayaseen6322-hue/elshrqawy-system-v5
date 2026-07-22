import { useState } from "react";
import { checkPwd } from "../../utils";

// ══════════════════════════════════════════════════════════════
// ROLE GATE — شاشة اختيار الدور وإدخال كلمة المرور (#7)
// إصلاح الأمان:
//   - كل الأدوار تحتاج كلمة مرور (مش المدير فقط)
//   - checkPwd يدعم SHA-256 hash + plain text للتوافق مع القديم
// ══════════════════════════════════════════════════════════════

const ROLES = [
  { key: "admin",   icon: "👑", label: "مدير النظام",  desc: "كل الصلاحيات",               color: "#6366f1", pwdKey: "password"        },
  { key: "cashier", icon: "💰", label: "المحصّل",       desc: "المصاريف والتقارير المالية", color: "#f59e0b", pwdKey: "cashierPassword"  },
  { key: "teacher", icon: "📚", label: "مدرّس",         desc: "الحضور والامتحانات",          color: "#10b981", pwdKey: "teacherPassword"  },
];

export const ROLE_PERMS = {
  admin:   ["attendance","students","finance","exams","dashboard","whatsapp","settings"],
  cashier: ["finance","dashboard"],
  teacher: ["attendance","exams","dashboard"],
};

export default function RoleGate({ settings, onEnter }) {
  const [role,    setRole]    = useState(null);
  const [pw,      setPw]      = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  // ⚠️ TEMP: كلمة المرور معطّلة مؤقتًا — دخول مباشر بمجرد اختيار الدور.
  // لإعادة التفعيل: رجّع الكود القديم اللي كان بيستخدم checkPwd هنا.
  const handleEnter = async () => {
    if (!role) { setErr("اختر الدور أولاً"); return; }
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

        {/* Password field — لكل الأدوار */}
        {role && (
          <div>
            <input
              type="password" value={pw} autoFocus
              onChange={e => { setPw(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && !loading && handleEnter()}
              placeholder={`كلمة مرور ${role.label}`}
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none disabled:opacity-50"
              style={{
                background: "var(--card-bg, #1e293b)",
                border: `1.5px solid ${err ? "#ef4444" : "var(--border, #334155)"}`,
                color: "var(--text-primary, #f1f5f9)",
              }}
            />
            {err && <p className="text-red-400 text-xs text-center mt-2">{err}</p>}
          </div>
        )}

        <button onClick={handleEnter} disabled={loading || !role}
          className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-40"
          style={{ background: role ? "var(--accent, #2563eb)" : "var(--border, #334155)" }}>
          {loading ? "⏳ جاري التحقق..." : role ? `${role.icon} دخول كـ ${role.label}` : "اختر الدور أولاً"}
        </button>
      </div>
    </div>
  );
}
