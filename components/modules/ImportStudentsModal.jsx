import { useState, useRef } from "react";
import { GRADES_LIST, GROUPS_MAP } from "../../constants";
import { genSID } from "../../utils";
import { Btn, Toast } from "../ui";

// ══════════════════════════════════════════════════════════════
// استيراد طلاب من ملف Excel (.xlsx/.xls) أو CSV
// ══════════════════════════════════════════════════════════════
// الفكرة: كل صف في الملف = طالب واحد. نحاول نكتشف الأعمدة تلقائيًا
// (الاسم / الهاتف / الصف / المجموعة) بغض النظر عن ترتيبها أو اسمها
// بالظبط (عربي أو إنجليزي)، وبعدين نعرض معاينة قبل التأكيد النهائي
// عشان المستخدم يقدر يصحح أي صف غلط (خصوصًا الصف/المجموعة) قبل الحفظ.
// ══════════════════════════════════════════════════════════════

// أسماء أعمدة محتملة لكل حقل (بيتقارن بعد إزالة المسافات والتصغير)
const NAME_KEYS  = ["الاسم", "اسمالطالب", "اسم الطالب".replace(/\s/g, ""), "name", "studentname"];
const PHONE_KEYS = ["الهاتف", "رقمالهاتف", "الموبايل", "التليفون", "رقم", "phone", "mobile", "tel"];
const GRADE_KEYS = ["الصف", "المرحلة", "الصفالدراسي", "grade", "class"];
const GROUP_KEYS = ["المجموعة", "الفصل", "group", "section"];

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s/g, "");

// ══════════════════════════════════════════════════════════════
// دعم استيراد من ملف Word (.docx)
// ══════════════════════════════════════════════════════════════
// لو الملف فيه جدول (table) بنقرأ صفوفه زي ما هي (نفس منطق Excel).
// لو مفيش جدول، بنقرأ النص سطر سطر ونحاول نفصل الاسم عن رقم الهاتف
// تلقائيًا (تاب / فاصلة / أو اكتشاف رقم هاتف داخل السطر).
function splitNameLine(line) {
  const clean = line.trim();
  if (!clean) return [];
  if (clean.includes("\t")) {
    return clean.split("\t").map(s => s.trim()).filter(Boolean);
  }
  // اكتشاف رقم هاتف (مصري أو عام) داخل السطر
  const phoneMatch = clean.match(/(01[0-2,5][\s-]?\d{4}[\s-]?\d{4}|0\d{9,10}|\d{10,11})/);
  if (phoneMatch) {
    const phone = phoneMatch[0].replace(/[\s-]/g, "");
    const name = clean.replace(phoneMatch[0], "").replace(/[,،\-–|]+/g, " ").trim();
    return [name, phone];
  }
  if (clean.includes(",") || clean.includes("،")) {
    return clean.split(/[,،]/).map(s => s.trim()).filter(Boolean);
  }
  return [clean];
}

// بيدوّر لو النص ده مطابق (تمامًا تقريبًا) لاسم صف من GRADES_LIST —
// بيُستخدم لاكتشاف عناوين الصفوف اللي بتيجي كفقرة منفصلة فوق كل جدول
// أو كسطر منفصل قبل مجموعة أسماء الطلاب.
function matchGradeHeading(text) {
  const t = norm(text);
  if (!t) return null;
  return GRADES_LIST.find(g => norm(g) === t) || null;
}

async function parseDocxToGrid(file) {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const doc = new DOMParser().parseFromString(html, "text/html");

  // نمشي على عناصر المستند بالترتيب (فقرات وجداول) — لما نلاقي فقرة
  // عنوانها اسم صف (زي "أولى إعدادي") نسجّله كـ"الصف الحالي"، وكل
  // جدول جاي بعده بناخد صفوفه ونربطها بالصف ده لحد ما نلاقي عنوان جديد.
  const grid = [];
  let currentGrade = "";
  let sawAnyTable = false;
  Array.from(doc.body.children).forEach(el => {
    if (el.tagName === "TABLE") {
      sawAnyTable = true;
      let isFirstRow = true;
      el.querySelectorAll("tr").forEach(tr => {
        const cells = Array.from(tr.querySelectorAll("td,th")).map(td => td.textContent.trim());
        if (!cells.some(c => c)) return;
        // كل جدول (لكل صف) بييجي بصف عناوين خاص بيه ("اسم الطالب"/"رقم الهاتف") —
        // نتجاهله عشان ميتحسبش كطالب.
        if (isFirstRow) {
          isFirstRow = false;
          if (detectColumns(cells).name !== undefined) return;
        }
        grid.push(currentGrade ? [...cells, currentGrade] : cells);
      });
    } else {
      const heading = matchGradeHeading(el.textContent);
      if (heading) currentGrade = heading;
    }
  });
  if (sawAnyTable && grid.length) return grid;

  // مفيش جدول (أو الجدول فاضي) — نرجع للنص العادي سطر سطر، ونطبّق
  // نفس منطق اكتشاف عنوان الصف على الأسطر بدل الفقرات.
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
  const rows = [];
  currentGrade = "";
  text.split("\n").forEach(line => {
    const heading = matchGradeHeading(line);
    if (heading) { currentGrade = heading; return; }
    const parts = splitNameLine(line);
    const name = (parts[0] || "").trim();
    if (!name) return;
    const phone = parts[1] || "";
    rows.push(currentGrade ? [name, phone, currentGrade] : [name, phone]);
  });
  return rows;
}

function detectColumns(headerRow) {
  const map = {}; // fieldKey -> index
  headerRow.forEach((raw, idx) => {
    const h = norm(raw);
    if (!h) return;
    if (map.name === undefined && NAME_KEYS.some(k => h.includes(norm(k)))) map.name = idx;
    else if (map.phone === undefined && PHONE_KEYS.some(k => h.includes(norm(k)))) map.phone = idx;
    else if (map.grade === undefined && GRADE_KEYS.some(k => h.includes(norm(k)))) map.grade = idx;
    else if (map.group === undefined && GROUP_KEYS.some(k => h.includes(norm(k)))) map.group = idx;
  });
  return map;
}

// أقرب تطابق لاسم الصف (تجاهل اختلاف الهمزات/المسافات البسيطة)
function matchGrade(value) {
  const v = norm(value);
  if (!v) return GRADES_LIST[0];
  const exact = GRADES_LIST.find(g => norm(g) === v);
  if (exact) return exact;
  const partial = GRADES_LIST.find(g => norm(g).includes(v) || v.includes(norm(g)));
  return partial || GRADES_LIST[0];
}

function matchGroup(grade, value) {
  const options = GROUPS_MAP[grade] || ["A"];
  const v = norm(value);
  if (!v) return options[0];
  const found = options.find(g => norm(g) === v);
  return found || options[0];
}

export default function ImportStudentsModal({ onImport, onClose }) {
  const [rows, setRows] = useState(null);   // preview rows بعد التحليل
  const [fileName, setFileName] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const isDocx = /\.docx$/i.test(file.name);
      let grid;
      if (isDocx) {
        grid = await parseDocxToGrid(file);
      } else {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      }
      if (!grid.length) { setToast({ msg: "الملف فاضي", type: "error" }); setBusy(false); return; }

      const headerRow = grid[0];
      let cols = detectColumns(headerRow);
      let dataRows;

      if (cols.name !== undefined) {
        // أول صف عناوين أعمدة معروفة — نتعامل معاه كهيدر ونتجاهله من البيانات
        dataRows = grid.slice(1).filter(r => r.some(c => String(c || "").trim() !== ""));
      } else if (isDocx) {
        // ملف Word من غير هيدر أعمدة واضح — العمود الأول اسم والتاني هاتف.
        // لو parseDocxToGrid لقى عناوين صفوف فوق الجداول (زي "أولى إعدادي")،
        // بيكون ضاف عمود تالت لكل صف بالصف المكتشف — نستخدمه هنا.
        const hasGradeCol = grid.some(r => r.length >= 3 && String(r[2] || "").trim());
        cols = hasGradeCol ? { name: 0, phone: 1, grade: 2 } : { name: 0, phone: 1 };
        dataRows = grid.filter(r => r.some(c => String(c || "").trim() !== ""));
      } else {
        setToast({ msg: "لم أستطع إيجاد عمود الاسم — تأكد إن أول صف في الملف عناوين أعمدة", type: "error" });
        setBusy(false);
        return;
      }

      const parsed = dataRows.map((r, i) => {
        const name  = String(r[cols.name] || "").trim();
        const phone = cols.phone !== undefined ? String(r[cols.phone] || "").trim() : "";
        const gradeRaw = cols.grade !== undefined ? r[cols.grade] : "";
        const groupRaw = cols.group !== undefined ? r[cols.group] : "";
        const grade = matchGrade(gradeRaw);
        return {
          _rowId: i,
          name,
          phone,
          grade,
          group: matchGroup(grade, groupRaw),
          skip: !name, // صف من غير اسم يتجاهل تلقائيًا (المستخدم يقدر يفعّله يدوي لو حابب)
        };
      });

      setRows(parsed);
    } catch (err) {
      setToast({ msg: "تعذّرت قراءة الملف — تأكد إنه Excel أو CSV أو Word صحيح", type: "error" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateRow = (rowId, field, value) => {
    setRows(prev => prev.map(r => {
      if (r._rowId !== rowId) return r;
      const next = { ...r, [field]: value };
      if (field === "grade") next.group = matchGroup(value, ""); // إعادة ضبط المجموعة عند تغيير الصف
      return next;
    }));
  };

  const toggleSkip = (rowId) => {
    setRows(prev => prev.map(r => r._rowId === rowId ? { ...r, skip: !r.skip } : r));
  };

  const confirmImport = () => {
    const toAdd = rows.filter(r => !r.skip && r.name.trim());
    if (toAdd.length === 0) {
      setToast({ msg: "مفيش أي طالب لاستيراده", type: "error" });
      return;
    }
    const newStudents = toAdd.map(r => ({
      id: genSID(),
      name: r.name.trim(),
      grade: r.grade,
      group: r.group,
      phone: r.phone || "",
      parentName: "",
      parentPhone: "",
      joinDate: new Date().toISOString().split("T")[0],
      status: "active",
      paid: 0,
      totalFees: 2400,
      score: 0,
      present: 0,
      absent: 0,
      late: 0,
      total: 0,
      weak: [],
    }));
    onImport(newStudents);
  };

  const activeCount = rows ? rows.filter(r => !r.skip && r.name.trim()).length : 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-3xl z-10">
          <span className="text-white font-black text-base">📥 استيراد طلاب من ملف</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {!rows && (
            <>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-xs text-blue-300 space-y-1">
                <div className="font-bold">📋 الملف المطلوب</div>
                <div>ملف Excel (.xlsx)، CSV، أو Word (.docx).</div>
                <div>Excel/CSV: أول صف فيه عناوين الأعمدة، وبعدها صف لكل طالب.</div>
                <div>Word: جدول (اسم / هاتف) أو حتى سطر لكل طالب زي "أحمد محمد 01012345678".</div>
                <div>الاسم إجباري — الهاتف، الصف، المجموعة اختياريين وتقدري تعدّليهم في المعاينة قبل الحفظ.</div>
              </div>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-700/60 hover:border-blue-500/50 rounded-2xl p-10 text-center cursor-pointer transition-colors">
                <div className="text-5xl mb-3">📁</div>
                <div className="text-slate-300 font-medium">{busy ? "⏳ جاري القراءة..." : "اضغط لاختيار الملف (Excel / CSV / Word)"}</div>
                {fileName && <div className="text-slate-600 text-xs mt-1">{fileName}</div>}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.docx" className="hidden" onChange={handleFile} disabled={busy} />
            </>
          )}

          {rows && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">{rows.length} صف في الملف — <span className="text-emerald-400 font-bold">{activeCount}</span> هيتضاف</div>
                <button onClick={() => { setRows(null); setFileName(""); }} className="text-xs text-blue-400">اختيار ملف تاني</button>
              </div>
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {rows.map(r => (
                  <div key={r._rowId} className={`rounded-xl p-3 border flex items-center gap-2 flex-wrap ${r.skip ? "bg-slate-900/40 border-slate-800 opacity-50" : "bg-slate-800/60 border-slate-700/40"}`}>
                    <button onClick={() => toggleSkip(r._rowId)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 ${r.skip ? "bg-slate-700 text-slate-500" : "bg-emerald-500/25 text-emerald-300"}`}
                      title={r.skip ? "مستبعد — دوس للتفعيل" : "هيتضاف — دوس للاستبعاد"}>
                      {r.skip ? "✕" : "✓"}
                    </button>
                    <div className="flex-1 min-w-[140px]">
                      <input value={r.name} onChange={e => updateRow(r._rowId, "name", e.target.value)}
                        placeholder="اسم الطالب"
                        className="w-full bg-slate-900/60 border border-slate-700/40 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"/>
                    </div>
                    <div className="w-28 shrink-0">
                      <input value={r.phone} onChange={e => updateRow(r._rowId, "phone", e.target.value)}
                        placeholder="الهاتف"
                        className="w-full bg-slate-900/60 border border-slate-700/40 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"/>
                    </div>
                    <div className="w-32 shrink-0">
                      <select value={r.grade} onChange={e => updateRow(r._rowId, "grade", e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-700/40 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
                        {GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="w-20 shrink-0">
                      <select value={r.group} onChange={e => updateRow(r._rowId, "group", e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-700/40 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
                        {(GROUPS_MAP[r.grade] || ["A"]).map(g => <option key={g} value={g}>مج. {g}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Btn variant="ghost" size="lg" className="flex-1" onClick={onClose}>إلغاء</Btn>
                <Btn variant="primary" size="lg" className="flex-1" disabled={activeCount === 0} onClick={confirmImport}>
                  ✓ استيراد {activeCount} طالب
                </Btn>
              </div>
            </>
          )}
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    </div>
  );
}
