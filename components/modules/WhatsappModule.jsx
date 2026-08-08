import { useState } from "react";
import { GRADES_LIST } from "../../constants";
import { fmt, waLink } from "../../utils";
import { Av, Sel, Btn, Toast } from "../ui";

// ══════════════════════════════════════════════════════════════
// MODULE 6: WHATSAPP
// ══════════════════════════════════════════════════════════════
export default function WhatsappModule({ students: studentsProp, settings }) {
  const students = studentsProp || [];
  const [msgType,   setMsgType]   = useState("absent");
  const [selGrade,  setSelGrade]  = useState("الكل");
  const [sent,      setSent]      = useState([]);
  const [toast,     setToast]     = useState(null);
  // قائمة الانتظار لـ "إرسال للكل"
  const [queue,     setQueue]     = useState(null); // null | { list, idx }

  const cn = settings?.centerName || "مركز الشرقاوي";

  // فلتر الطلاب — الصف + النشطين فقط
  const filtered = students.filter(s =>
    (selGrade === "الكل" || s.grade === selGrade) && s.status !== "inactive"
  );

  const tpls = {
    absent:  s => `السلام عليكم ولي أمر ${s.name}،\nتغيب ${s.name} ${s.absent} مرة.\nيرجى المتابعة.\nشكراً - ${cn}`,
    fees:    s => `السلام عليكم ولي أمر ${s.name}،\nيوجد مبلغ مستحق ${fmt(s.totalFees - s.paid)}.\nيرجى السداد.\nشكراً - ${cn}`,
    score:   s => `السلام عليكم ولي أمر ${s.name}،\nمستوى ${s.name} (${s.score}%) يحتاج متابعة.\nنرجو التواصل.\nشكراً - ${cn}`,
    general: s => `السلام عليكم ولي أمر ${s.name}،\nتحية طيبة من ${cn} 😊`,
  };

  const openWa = s => {
    const url = waLink(s.parentPhone, `?text=${encodeURIComponent(tpls[msgType](s))}`);
    if (!url) return; // لا يوجد رقم هاتف صالح
    window.open(url, "_blank");
    setSent(p => [...p, s.id]);
  };

  const send = s => {
    openWa(s);
    setToast({ msg: `✓ تم فتح واتساب لـ ${s.name}`, type: "success" });
  };

  // "إرسال للكل" — يبدأ queue: المستخدم يضغط "التالي" لكل طالب
  const startQueue = () => {
    const unsent = filtered.filter(s => !sent.includes(s.id));
    if (unsent.length === 0) { setToast({ msg: "تم الإرسال للجميع بالفعل", type: "success" }); return; }
    setQueue({ list: unsent, idx: 0 });
  };

  const queueNext = () => {
    if (!queue) return;
    const s = queue.list[queue.idx];
    openWa(s);
    const nextIdx = queue.idx + 1;
    if (nextIdx >= queue.list.length) {
      setQueue(null);
      setToast({ msg: `✓ تم الإرسال لـ ${queue.list.length} طالب`, type: "success" });
    } else {
      setQueue(q => ({ ...q, idx: nextIdx }));
    }
  };

  const queueCancel = () => setQueue(null);

  // شاشة الـ queue
  if (queue) {
    const current = queue.list[queue.idx];
    const progress = queue.idx + 1;
    const total    = queue.list.length;
    return (
      <div className="space-y-4">
        <div className="bg-green-900/30 border border-green-500/20 rounded-2xl p-4 text-center">
          <div className="text-3xl mb-2">💬</div>
          <div className="text-white font-black">إرسال للكل</div>
          <div className="text-slate-400 text-xs mt-1">{progress} من {total}</div>
        </div>

        {/* Progress bar */}
        <div className="bg-slate-800 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${((progress - 1) / total) * 100}%` }} />
        </div>

        {/* الطالب الحالي */}
        <div className="bg-slate-800/60 border border-green-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Av name={current.name} />
            <div>
              <div className="text-white font-black">{current.name}</div>
              <div className="text-slate-400 text-xs">{current.parentPhone}</div>
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 text-slate-300 text-xs leading-relaxed whitespace-pre-line">
            {tpls[msgType](current)}
          </div>
        </div>

        {/* أزرار */}
        <Btn variant="success" size="lg" className="w-full" onClick={queueNext}>
          💬 فتح واتساب — {current.name} ({progress}/{total})
        </Btn>
        <Btn variant="ghost" size="lg" className="w-full" onClick={queueCancel}>
          ✕ إيقاف الإرسال
        </Btn>

        {/* قائمة المتبقين */}
        {queue.list.slice(queue.idx + 1, queue.idx + 4).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-slate-500 px-1">التالي:</div>
            {queue.list.slice(queue.idx + 1, queue.idx + 4).map(s => (
              <div key={s.id} className="bg-slate-800/40 rounded-xl px-3 py-2 flex items-center gap-2">
                <Av name={s.name} size="sm" />
                <span className="text-slate-400 text-xs">{s.name}</span>
              </div>
            ))}
            {queue.list.length - queue.idx - 4 > 0 && (
              <div className="text-xs text-slate-600 text-center">+ {queue.list.length - queue.idx - 4} آخرين</div>
            )}
          </div>
        )}

        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/30 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-4xl">💬</span>
        <div>
          <div className="text-white font-black">التواصل عبر واتساب</div>
          <div className="text-slate-400 text-xs">{filtered.length} طالب · أُرسل: {sent.length}</div>
        </div>
      </div>

      {/* نوع الرسالة */}
      <div className="grid grid-cols-2 gap-2">
        {[["absent","📅 الغياب"],["fees","💰 المصاريف"],["score","📊 المستوى"],["general","✉️ عام"]].map(([k, v]) => (
          <button key={k} onClick={() => setMsgType(k)}
            className={`py-2.5 rounded-xl text-sm font-medium ${msgType === k ? "bg-green-600 text-white" : "bg-slate-800 text-slate-400"}`}>
            {v}
          </button>
        ))}
      </div>

      {/* فلتر الصف */}
      <Sel value={selGrade} onChange={e => setSelGrade(e.target.value)}>
        <option>الكل</option>
        {GRADES_LIST.map(g => <option key={g}>{g}</option>)}
      </Sel>

      {/* معاينة الرسالة */}
      {filtered[0] && (
        <div className="bg-slate-800/60 border border-green-700/20 rounded-2xl p-3">
          <div className="text-xs text-green-400 font-medium mb-2">نموذج الرسالة</div>
          <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-line bg-slate-900/40 rounded-xl p-3">
            {tpls[msgType](filtered[0]).replace(filtered[0].name, "[اسم الطالب]")}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-10 text-slate-600">
          <div className="text-4xl mb-2">💬</div>
          <div className="text-sm">لا يوجد طلاب لهذا الاختيار</div>
        </div>
      )}

      {/* قائمة الطلاب */}
      <div className="space-y-2">
        {filtered.map(s => {
          const isSent = sent.includes(s.id);
          return (
            <div key={s.id} className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-3 flex items-center gap-3">
              <Av name={s.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium whitespace-normal break-words">{s.name}</div>
                <div className="text-slate-500 text-xs">{s.parentPhone}</div>
              </div>
              <button
                onClick={() => send(s)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold ${
                  isSent
                    ? "bg-emerald-700/30 border border-emerald-600/20 text-emerald-300"
                    : "bg-green-600 hover:bg-green-500 text-white"
                }`}
              >
                {isSent ? "✓ أُرسل" : "إرسال"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Btn variant="ghost" size="lg" className="flex-1" onClick={() => setSent([])}>↩ إعادة تعيين</Btn>
        <Btn variant="green" size="lg" className="flex-1" onClick={startQueue}>
          💬 إرسال للكل ({filtered.filter(s => !sent.includes(s.id)).length})
        </Btn>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
