import { useState, useEffect, useRef } from "react";
import { pct, scC } from "../../utils/index.js";
import { MONTHS_AR, GROUPS_MAP, GRADES_LIST, addCustomGrade } from "../../constants/index.js";

// ══════════════════════════════════════════════════════════════
// PRIMITIVE UI COMPONENTS — v8
// كل component بيستخدم CSS variables من نظام الـ tokens
// بدل hardcoded Tailwind colors — يستجيب لكل ثيم تلقائياً
// ══════════════════════════════════════════════════════════════

/** Avatar circle with gradient based on name */
export function Av({ name, size = "md" }) {
  const safeName = name || "?"; // إصلاح #9: اسم فاضي/undefined كان يولّد NaN ويكسر التدرج واللون
  const sz = size === "sm" ? "w-9 h-9 text-sm" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
  const cs = ["from-blue-600 to-violet-700","from-emerald-600 to-teal-700","from-rose-600 to-pink-700","from-amber-600 to-orange-700","from-cyan-600 to-blue-700"];
  return (
    <div className={`${sz} bg-gradient-to-br ${cs[safeName.charCodeAt(0) % 5]} flex items-center justify-center font-bold text-white shrink-0`}
      style={{ borderRadius: "var(--radius-md)" }}>
      {safeName[0]}
    </div>
  );
}

/** Horizontal progress bar */
export function Bar({ value, max, color, h = "h-1.5" }) {
  const widthPct = Math.max(0, Math.min(pct(value, max), 100)); // إصلاح #11: منع نسبة سالبة لو value سالب
  return (
    <div className={`w-full rounded-full ${h} overflow-hidden`} style={{ background: "var(--border)" }}>
      <div className={`${h} rounded-full transition-all duration-500`} style={{ width: `${widthPct}%`, backgroundColor: color || scC(pct(value, max)) }} />
    </div>
  );
}

/** Auto-dismissing toast notification */
export function Toast({ msg, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  const bg = type === "success" ? "#059669" : type === "error" ? "#dc2626" : "var(--accent)";
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-sm px-5 py-3 shadow-xl z-[300] text-center"
      style={{ background: bg, borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)", maxWidth: "90vw", width: "max-content" }}>
      {msg}
    </div>
  );
}

/** Centered modal overlay */
export function Modal({ title, onClose, children, maxW = "max-w-md", confirmClose }) {
  // إصلاح #13: الضغط بره الـ Modal كان يقفلها فورًا بدون أي تحذير، حتى لو
  // فيها بيانات مكتوبة لسه ماتحفظتش. confirmClose اختياري: لو مفعّل
  // (true أو نص تحذير مخصص)، الضغط بره يطلب تأكيدًا أولًا. السلوك القديم
  // (إغلاق فوري) يفضل كما هو لأي استخدام لا يمرر هذا الـ prop.
  const handleBackdropClick = () => {
    if (!confirmClose) { onClose(); return; }
    const msg = typeof confirmClose === "string" ? confirmClose : "هل تريد إغلاق النافذة؟ قد تفقد أي بيانات لم تُحفظ.";
    if (window.confirm(msg)) onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={handleBackdropClick}>
      <div
        className={`w-full ${maxW} max-h-[85vh] overflow-y-auto border`}
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)" }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex justify-between items-center px-5 py-4 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--border)", background: "var(--sidebar-bg)", borderRadius: `var(--radius-xl) var(--radius-xl) 0 0` }}
        >
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>{title}</span>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-xl transition-colors"
            style={{ color: "var(--text-muted)", borderRadius: "var(--radius-md)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Form field wrapper with label + optional error */
export function Field({ label, children, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

/** Styled text input */
export function Inp({ className = "", err, style: extraStyle = {}, ...p }) {
  return (
    <input {...p}
      className={`w-full px-3 py-2.5 text-sm focus:outline-none transition-colors ${className}`}
      style={{
        background: "var(--card-bg)",
        border: `1px solid ${err ? "#ef4444" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        color: "var(--text-primary)",
        ...extraStyle,
      }}
    />
  );
}

/** Styled select */
export function Sel({ children, className = "", err, style: extraStyle = {}, ...p }) {
  return (
    <select {...p}
      className={`w-full px-3 py-2.5 text-sm focus:outline-none ${className}`}
      style={{
        background: "var(--card-bg)",
        border: `1px solid ${err ? "#ef4444" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        color: "var(--text-primary)",
        ...extraStyle,
      }}
    >
      {children}
    </select>
  );
}

// قيمة خاصة بتظهر كخيار أخير في قائمة الصفوف — اختيارها بيفتح حقل
// كتابة اسم الصف الجديد بدل ما يغيّر القيمة فعليًا.
const ADD_NEW_GRADE = "__add_new_grade__";

/**
 * قائمة منسدلة لاختيار الصف، مع خيار "➕ إضافة صف جديد" في آخرها.
 * لما المستخدم يختاره، بيظهر بدل القائمة حقل كتابة صغير؛ بمجرد
 * التأكيد بيتضاف الصف للنظام كله (عبر addCustomGrade) ويتم اختياره
 * تلقائيًا.
 */
export function GradeSelect({ value, onChange, placeholder, className = "", err }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === ADD_NEW_GRADE) { setNewName(""); setAdding(true); return; }
    onChange(v);
  };

  const confirmAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addCustomGrade(name); // لو الاسم موجود بالفعل، الدالة بتتجاهل التكرار وتسيب الحالي
    onChange(name);
    setAdding(false);
    setNewName("");
  };

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Inp
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") confirmAdd(); if (e.key === "Escape") setAdding(false); }}
          placeholder="اسم الصف الجديد"
          className={className}
        />
        <button type="button" onClick={confirmAdd}
          className="px-3 rounded-lg bg-emerald-700/30 border border-emerald-600/30 text-emerald-300 text-sm shrink-0">✓</button>
        <button type="button" onClick={() => setAdding(false)}
          className="px-3 rounded-lg bg-slate-700/40 text-slate-300 text-sm shrink-0">✕</button>
      </div>
    );
  }

  return (
    <Sel value={value} err={err} onChange={handleSelect} className={className}>
      {placeholder && <option value="">{placeholder}</option>}
      {GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
      <option value={ADD_NEW_GRADE}>➕ إضافة صف جديد</option>
    </Sel>
  );
}

/** Button with variant support */
export function Btn({ children, variant = "primary", size = "md", className = "", style: extraStyle = {}, ...p }) {
  const variantStyles = {
    primary: { background: "var(--accent)",      color: "#fff" },
    ghost:   { background: "var(--card-bg)",      color: "var(--text-primary)", border: "1px solid var(--border)" },
    danger:  { background: "rgba(220,38,38,0.15)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)" },
    success: { background: "#059669",             color: "#fff" },
    green:   { background: "#16a34a",             color: "#fff" },
  };
  const sizeStyles = {
    sm: { padding: "6px 12px",  fontSize: "var(--font-size-sm)" },
    md: { padding: "10px 16px", fontSize: "var(--font-size-md)" },
    lg: { padding: "12px 20px", fontSize: "var(--font-size-md)", fontWeight: "var(--font-weight-bold)" },
  };
  return (
    <button {...p}
      className={`font-medium transition-colors disabled:opacity-40 ${className}`}
      style={{
        borderRadius: "var(--radius-md)",
        ...(variantStyles[variant] || variantStyles.primary),
        ...(sizeStyles[size] || sizeStyles.md),
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

/** Toggle switch */
export function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition-colors duration-300"
      style={{ background: on ? "var(--accent)" : "var(--border)" }}
    >
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

/** Searchable dropdown */
export function SearchSel({ options, value, onChange, placeholder = "ابحث..." }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 text-sm flex justify-between items-center transition-colors"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: value ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        <span>{value || placeholder}</span>
        <span style={{ color: "var(--text-muted)", fontSize: "var(--font-size-xs)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 left-0 shadow-xl z-50 overflow-hidden"
          style={{ background: "var(--sidebar-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." autoFocus
              className="w-full px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0
              ? <div className="py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>لا نتائج</div>
              : filtered.map(o => (
                <button key={o} onClick={() => { onChange(o); setQ(""); setOpen(false); }}
                  className="w-full text-right px-4 py-2.5 text-sm transition-colors"
                  style={{ color: value === o ? "var(--accent)" : "var(--text-primary)", fontWeight: value === o ? "700" : "400" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >{o}</button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

/** Arabic calendar date picker */
export function DatePicker({ value, onChange, max }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const parseDate = s => { const p = s.split("-"); return { y: parseInt(p[0]), m: parseInt(p[1]) - 1, d: parseInt(p[2]) }; };
  const pad = n => String(n).padStart(2, "0");
  const { y, m, d } = parseDate(value);
  const [viewY, setViewY] = useState(y);
  const [viewM, setViewM] = useState(m);
  const maxP = max ? parseDate(max) : null;
  const DAYS_AR = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
  const isDisabled = (cy, cm, cd) => maxP && (cy > maxP.y || (cy === maxP.y && cm > maxP.m) || (cy === maxP.y && cm === maxP.m && cd > maxP.d));
  const firstDay = new Date(viewY, viewM, 1).getDay();
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  // إصلاح #2: منع التنقل للأمام إلى ما بعد شهر/سنة `max` —
  // قبل ذلك كانت nextM لا تتحقق من maxP أبداً، فيمكن فتح أي شهر مستقبلي
  // حتى لو كل أيامه معطّلة (disabled) في الشبكة.
  const atOrPastMax = maxP && (viewY > maxP.y || (viewY === maxP.y && viewM >= maxP.m));
  const prevM = () => { if (viewM === 0) { setViewM(11); setViewY(v => v - 1); } else setViewM(v => v - 1); };
  const nextM = () => {
    if (atOrPastMax) return; // لا تتجاوز الحد الأقصى
    if (viewM === 11) { setViewM(0); setViewY(v => v + 1); } else setViewM(v => v + 1);
  };
  // إصلاح #4: viewY/viewM كانت تُهيَّأ من value مرة واحدة فقط عند أول mount
  // (useState(y))، فلو الأب غيّر value من الخارج بعد ذلك، شهر العرض كان
  // يفضل عالقاً على القيمة القديمة. نعيد المزامنة فقط والبكر مقفول، عشان
  // لا نخطف الشهر من مستخدم يتنقّل فعلياً داخل تقويم مفتوح.
  useEffect(() => {
    if (!open) { setViewY(y); setViewM(m); }
  }, [value, open]);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)" }}
      >
        <span style={{ fontSize: "13px" }}>{d} {MONTHS_AR[m]} {y}</span>
        <span style={{ color: "var(--text-muted)" }}>📅</span>
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 z-[150] p-3 w-64"
          style={{ background: "var(--sidebar-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            {/* إصلاح #1: U+203A/U+2039 لهما خاصية Bidi_Mirrored في يونيكود،
                فالمتصفح كان يعكس شكل السهم تلقائياً داخل سياق dir="rtl"
                (الصفحة كلها rtl) — فيظهر السهم بعكس اتجاهه الحقيقي.
                direction:"ltr" هنا يمنع الانعكاس التلقائي بينما يبقى
                ترتيب الزرارين (التالي=يمين، السابق=شمال) متوافقاً مع RTL. */}
            <button onClick={nextM} disabled={atOrPastMax}
              className="w-7 h-7 flex items-center justify-center text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: "var(--text-muted)", borderRadius: "var(--radius-sm)", direction: "ltr" }}
              onMouseEnter={e => { if (!atOrPastMax) e.currentTarget.style.background = "var(--border)"; }}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >›</button>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{MONTHS_AR[viewM]} {viewY}</span>
            <button onClick={prevM} className="w-7 h-7 flex items-center justify-center text-sm transition-colors"
              style={{ color: "var(--text-muted)", borderRadius: "var(--radius-sm)", direction: "ltr" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >‹</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS_AR.map(dy => (
              <div key={dy} className="text-center font-medium py-1" style={{ color: "var(--text-muted)", fontSize: "11px" }}>{dy.slice(0, 2)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const isSel = day === d && viewM === m && viewY === y;
              const isDis = isDisabled(viewY, viewM, day);
              return (
                <button key={`d-${day}`}
                  onClick={() => { if (!isDis) { onChange(`${viewY}-${pad(viewM + 1)}-${pad(day)}`); setOpen(false); } }}
                  disabled={isDis}
                  className="w-full aspect-square text-xs font-medium flex items-center justify-center transition-colors"
                  style={{
                    borderRadius: "var(--radius-sm)",
                    background: isSel ? "var(--accent)" : "transparent",
                    color: isSel ? "#fff" : isDis ? "var(--border)" : "var(--text-primary)",
                    cursor: isDis ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => { if (!isSel && !isDis) e.currentTarget.style.background = "var(--border)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setViewY(v => v - 1)}
              className="text-xs px-2 py-1 transition-colors"
              style={{ color: "var(--text-muted)", borderRadius: "var(--radius-sm)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
            >− سنة</button>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{viewY}</span>
            <button onClick={() => setViewY(v => v + 1)}
              className="text-xs px-2 py-1 transition-colors"
              style={{ color: "var(--text-muted)", borderRadius: "var(--radius-sm)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
            >سنة +</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Grade / Group / Date status bar */
export function StatusBar({ grade, group, date }) {
  if (!grade || !group || !date) return null;
  const p = date.split("-");
  const dStr = `${parseInt(p[2])} ${MONTHS_AR[parseInt(p[1]) - 1]} ${p[0]}`;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs px-3 py-1.5 font-medium" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "var(--accent)", borderRadius: "var(--radius-md)" }}>📚 {grade}</span>
      <span className="text-xs px-3 py-1.5 font-medium" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa", borderRadius: "var(--radius-md)" }}>👥 مجموعة {group}</span>
      <span className="text-xs px-3 py-1.5 font-medium" style={{ background: "rgba(5,150,105,0.15)", border: "1px solid rgba(5,150,105,0.3)", color: "#6ee7b7", borderRadius: "var(--radius-md)" }}>📅 {dStr}</span>
    </div>
  );
}

/** Global top search bar */
export function TopSearchBar({ students, onSelect }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const res = q.length === 0 ? [] : students.filter(s =>
    s.name?.toLowerCase().includes(q.toLowerCase()) ||
    s.id?.toLowerCase().includes(q.toLowerCase()) ||
    String(s.phone || "").includes(q)
  );
  return (
    <div ref={ref} className="relative flex-1">
      <input value={q} onChange={e => { setQ(e.target.value); setShow(true); }} onFocus={() => setShow(true)}
        placeholder="ابحث عن طالب..."
        className="w-full h-10 px-4 pl-9 text-sm focus:outline-none transition-colors"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)" }}
      />
      <span className="absolute left-3 top-2.5 text-sm" style={{ color: "var(--text-muted)" }}>🔍</span>
      {show && q.length > 0 && (
        <div className="absolute top-12 right-0 left-0 shadow-xl z-50 max-h-60 overflow-y-auto"
          style={{ background: "var(--sidebar-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)" }}
        >
          {res.length === 0
            ? <div className="px-4 py-4 text-sm text-center" style={{ color: "var(--text-muted)" }}>لا توجد نتائج</div>
            : res.slice(0, 6).map(s => (
              <button key={s.id} onClick={() => { onSelect(s); setShow(false); setQ(""); }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--card-bg)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <Av name={s.name} size="sm" />
                <div className="flex-1 text-right min-w-0">
                  <div className="text-sm font-medium whitespace-normal break-words" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.grade} · {s.id}</div>
                </div>
                <div className="text-xs font-bold shrink-0" style={{ color: scC(s.score) }}>{s.score}%</div>
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}
