// ══════════════════════════════════════════════════════════════
// PrinterPickerModal.jsx
// يظهر مرة واحدة فقط لاختيار نوع الطابعة.
// لو Tauri — يعرض الطابعات المكتشفة تلقائياً.
// لو Web / Android — يعرض الخيارات اليدوية.
//
// الاستخدام في App.jsx:
//   import PrinterPickerModal from "../ui/PrinterPickerModal";
//   {showPrinterPicker && (
//     <PrinterPickerModal
//       printers={detectedPrinters}      ← من event detail
//       autoDetected={wasAutoDetected}
//       onSelect={(type, name) => { ... }}
//       onClose={() => setShowPrinterPicker(false)}
//     />
//   )}
// ══════════════════════════════════════════════════════════════

import { useState } from "react";
import { EV_PRINTER_CHOSEN } from "../../utils/print/printRouter";
import { clearPrinterPref } from "../../utils/print/printerSettings";

// ── أنواع الطابعات اليدوية ──────────────────────────────────
const MANUAL_OPTIONS = [
  {
    type:  "thermal",
    icon:  "🧾",
    label: "طابعة حرارية",
    desc:  "POS — 58mm / 80mm — إيصالات سريعة",
    color: "#f59e0b",
    hint:  "مناسبة للإيصالات المالية",
  },
  {
    type:  "system",
    icon:  "🖨️",
    label: "طابعة عادية",
    desc:  "Laser / Inkjet — A4 — شهادات وتقارير",
    color: "#3b82f6",
    hint:  "مناسبة للتقارير والشهادات",
  },
  {
    type:  "pdf",
    icon:  "📄",
    label: "حفظ PDF",
    desc:  "تنزيل الملف بدون طباعة فورية",
    color: "#10b981",
    hint:  "للأرشفة أو الإرسال",
  },
];

export default function PrinterPickerModal({ printers = [], autoDetected = false, onSelect, onClose }) {
  const [selected, setSelected] = useState(null); // { type, name? }
  const [tab, setTab]           = useState(autoDetected && printers.length > 0 ? "auto" : "manual");

  const confirm = () => {
    if (!selected) return;
    // أطلق event يستمع له printRouter
    window.dispatchEvent(new CustomEvent(EV_PRINTER_CHOSEN, {
      detail: { type: selected.type, name: selected.name || "" }
    }));
    onSelect?.(selected.type, selected.name || "");
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "var(--sidebar-bg)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "var(--accent-alpha, rgba(99,102,241,0.15))" }}>🖨️</div>
            <div>
              <div className="font-black text-sm" style={{ color: "var(--text-primary)" }}>
                اختر نوع الطابعة
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                يُحفظ الاختيار — لن يُسأل مرة أخرى
              </div>
            </div>
          </div>

          {/* Tabs — auto / manual */}
          {autoDetected && printers.length > 0 && (
            <div className="flex gap-2 mt-3">
              {[
                { key: "auto",   label: `🔍 مكتشفة (${printers.length})` },
                { key: "manual", label: "✎ يدوي"                         },
              ].map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: tab === t.key ? "var(--accent)"         : "var(--card-bg)",
                    color:      tab === t.key ? "#fff"                   : "var(--text-muted)",
                    border:     `1px solid ${tab === t.key ? "var(--accent)" : "var(--border)"}`,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-3 space-y-2 max-h-72 overflow-y-auto">

          {/* ── Auto-detected printers (Tauri only) ── */}
          {tab === "auto" && printers.map((p, i) => {
            const opt = MANUAL_OPTIONS.find(o => o.type === p.type) || MANUAL_OPTIONS[1];
            const isSel = selected?.name === p.name;
            return (
              <button key={i} onClick={() => setSelected({ type: p.type, name: p.name })}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-right transition-all"
                style={{
                  background: isSel ? `${opt.color}18` : "var(--card-bg)",
                  border: `1.5px solid ${isSel ? opt.color : "var(--border)"}`,
                }}>
                <span className="text-2xl shrink-0">{opt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate"
                    style={{ color: isSel ? opt.color : "var(--text-primary)" }}>{p.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{opt.label}</div>
                </div>
                {isSel && <span className="text-xs font-black shrink-0" style={{ color: opt.color }}>✓</span>}
              </button>
            );
          })}

          {/* ── Manual options ── */}
          {tab === "manual" && MANUAL_OPTIONS.map(o => {
            const isSel = selected?.type === o.type && !selected?.name;
            return (
              <button key={o.type} onClick={() => setSelected({ type: o.type })}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-right transition-all"
                style={{
                  background: isSel ? `${o.color}18` : "var(--card-bg)",
                  border: `1.5px solid ${isSel ? o.color : "var(--border)"}`,
                }}>
                <span className="text-2xl shrink-0">{o.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold"
                    style={{ color: isSel ? o.color : "var(--text-primary)" }}>{o.label}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{o.desc}</div>
                  <div className="text-xs mt-0.5" style={{ color: isSel ? o.color : "var(--text-muted)", opacity: 0.7 }}>{o.hint}</div>
                </div>
                {isSel && <span className="text-xs font-black shrink-0" style={{ color: o.color }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={confirm} disabled={!selected}
            className="w-full py-3 rounded-2xl text-sm font-black text-white transition-all"
            style={{
              background: selected ? "var(--accent)" : "var(--border)",
              opacity: selected ? 1 : 0.5,
              cursor: selected ? "pointer" : "not-allowed",
            }}>
            {selected ? "✓ تأكيد الاختيار" : "اختر طابعة أولاً"}
          </button>
          <button onClick={onClose}
            className="w-full py-2 text-xs"
            style={{ color: "var(--text-muted)" }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ── مكوّن مستقل لإعادة الاختيار من الإعدادات ─────────────────
export function PrinterResetButton() {
  return (
    <button
      onClick={() => {
        clearPrinterPref();
        window.dispatchEvent(new CustomEvent("app:choosePrinter", {
          detail: { printers: [], autoDetected: false }
        }));
      }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      🖨️ تغيير إعداد الطابعة
    </button>
  );
}
