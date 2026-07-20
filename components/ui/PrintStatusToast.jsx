// ══════════════════════════════════════════════════════════════
// PrintStatusToast.jsx
// Toast مخصص لحالات الطباعة — يستمع لـ EV_PRINT_STATUS
// يُضاف مرة واحدة في App.jsx بجانب الـ Toast العام
// ══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { EV_PRINT_STATUS } from "../../utils/print/printRouter";

const CONFIG = {
  printing: { icon: "⏳", color: "#3b82f6", label: "جارٍ الطباعة…",      bg: "#1e3a8a" },
  done:     { icon: "✅", color: "#10b981", label: "تمت الطباعة بنجاح",   bg: "#064e3b" },
  error:    { icon: "❌", color: "#ef4444", label: "فشلت الطباعة",         bg: "#7f1d1d" },
  fallback: { icon: "⚠️", color: "#f59e0b", label: "تم التنزيل كـ PDF",   bg: "#78350f" },
};

export default function PrintStatusToast() {
  const [status, setStatus] = useState(null); // { status, msg }
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      const { status: s, msg } = e.detail || {};
      setStatus({ status: s, msg });
      setVisible(true);
      // "printing" يظل حتى يجي done/error/fallback
      if (s !== "printing") {
        setTimeout(() => setVisible(false), 3500);
      }
    };
    window.addEventListener(EV_PRINT_STATUS, handler);
    return () => window.removeEventListener(EV_PRINT_STATUS, handler);
  }, []);

  if (!visible || !status) return null;

  const cfg = CONFIG[status.status] || CONFIG.printing;

  return (
    <div
      className="fixed bottom-20 left-1/2 z-[500] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl transition-all"
      style={{
        transform: "translateX(-50%)",
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        minWidth: "220px",
        maxWidth: "320px",
      }}
    >
      {/* Spinner لـ "printing" */}
      {status.status === "printing" ? (
        <div className="w-5 h-5 rounded-full border-2 shrink-0 animate-spin"
          style={{ borderColor: `${cfg.color}40`, borderTopColor: cfg.color }} />
      ) : (
        <span className="text-lg shrink-0">{cfg.icon}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black" style={{ color: cfg.color }}>{cfg.label}</div>
        {status.msg && status.msg !== cfg.label && (
          <div className="text-xs mt-0.5 truncate" style={{ color: `${cfg.color}cc` }}>
            {status.msg}
          </div>
        )}
      </div>
      <button onClick={() => setVisible(false)}
        className="text-xs shrink-0 opacity-50 hover:opacity-100"
        style={{ color: cfg.color }}>✕</button>
    </div>
  );
}
