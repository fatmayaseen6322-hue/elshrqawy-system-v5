// ══════════════════════════════════════════════════════════════
// exportStudentsWord.js
// تصدير كشف الطلاب (الاسم + رقم التليفون) كملف Word حقيقي (.docx)
// كل صف (grade) بيتحط في ورقة مستقلة: اسم الصف فوق، والجدول تحته.
// بيجمع كل مجموعات الصف (A/B) في نفس الورقة، مرتبين حسب المجموعة.
// ══════════════════════════════════════════════════════════════
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  PageBreak, ShadingType,
} from "docx";
import { GRADES_LIST } from "../constants/index.js";

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" };
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

function headerCell(text) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: CELL_BORDERS,
    shading: { type: ShadingType.CLEAR, fill: "1E3A8A" },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 22, rtl: true })],
    })],
  });
}

function dataCell(text, bold = false) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: CELL_BORDERS,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [new TextRun({ text: text || "—", bold, size: 22, rtl: true })],
    })],
  });
}

// بناء جدول صف واحد (اسم + رقم تليفون) لمجموعة من الطلاب
function buildStudentsTable(list) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [headerCell("اسم الطالب"), headerCell("رقم التليفون")],
    }),
    ...list.map((s, i) => new TableRow({
      children: [
        dataCell(s.name, true),
        dataCell(s.phone || s.parentPhone || ""),
      ],
    })),
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/**
 * تصدير كشوف كل الصفوف (كل صف في ورقة لوحده) كملف Word واحد.
 * @param {Array} students - كل الطلاب
 * @param {string} centerName - اسم المركز (اختياري) يظهر أعلى كل ورقة
 */
export async function exportStudentsWord(students = [], centerName = "نظام الشرقاوي") {
  const gradesWithStudents = GRADES_LIST.filter(
    g => (students || []).some(s => s.grade === g)
  );
  if (gradesWithStudents.length === 0) return false;

  const children = [];

  gradesWithStudents.forEach((grade, idx) => {
    // ترتيب طلاب الصف حسب المجموعة ثم الاسم
    const gradeStudents = (students || [])
      .filter(s => s.grade === grade)
      .sort((a, b) => (a.group || "").localeCompare(b.group || "") || (a.name || "").localeCompare(b.name || "", "ar"));

    if (idx > 0) {
      // فاصل ورقة قبل كل صف جديد (ما عدا الأول)
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: centerName, bold: true, size: 20, color: "64748B", rtl: true })],
    }));

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: grade, bold: true, size: 40, color: "1E3A8A", rtl: true })],
    }));

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `عدد الطلاب: ${gradeStudents.length}`, size: 20, color: "64748B", rtl: true })],
    }));

    // لو الصف عنده أكتر من مجموعة، اعرض عنوان فرعي لكل مجموعة داخل نفس الورقة
    const groups = [...new Set(gradeStudents.map(s => s.group || "A"))].sort();
    if (groups.length > 1) {
      groups.forEach((grp, gi) => {
        const grpStudents = gradeStudents.filter(s => (s.group || "A") === grp);
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { before: gi > 0 ? 200 : 0, after: 100 },
          children: [new TextRun({ text: `مجموعة ${grp}`, bold: true, size: 24, color: "334155", rtl: true })],
        }));
        children.push(buildStudentsTable(grpStudents));
      });
    } else {
      children.push(buildStudentsTable(gradeStudents));
    }
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: "portrait" } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `كشف_الطلاب_${new Date().toISOString().split("T")[0]}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
