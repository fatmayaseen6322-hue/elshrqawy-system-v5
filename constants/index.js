// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

// الصفوف الافتراضية الأساسية (ثابتة دايمًا، مبنية في الكود)
const BASE_GRADES = [
  "أولى إعدادي","ثانية إعدادي","ثالثة إعدادي",
  "أولى ثانوي","ثانية ثانوي","ثالثة ثانوي"
];
const BASE_GROUPS_MAP = {
  "أولى إعدادي":["A","B"], "ثانية إعدادي":["A","B"], "ثالثة إعدادي":["A"],
  "أولى ثانوي":["A","B"], "ثانية ثانوي":["A"], "ثالثة ثانوي":["A","B"]
};

// الصفوف اللي بتضيفها المستخدمة بنفسها من واجهة التطبيق (مخزّنة في
// localStorage عشان تفضل موجودة حتى بعد تحديث الصفحة). بتتحفظ في نفس
// مكان باقي بيانات التطبيق.
const CUSTOM_GRADES_KEY = "app_custom_grades";
const CUSTOM_GROUPS_KEY = "app_custom_groups";

function loadCustomGrades() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_GRADES_KEY) || "[]"); }
  catch { return []; }
}
function loadCustomGroups() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_GROUPS_KEY) || "{}"); }
  catch { return {}; }
}

// ملاحظة مهمة: دول `let` مقصود (مش `const`) — عشان لما يتضاف صف جديد
// عن طريق addCustomGrade()، كل مكان في التطبيق بيستورد GRADES_LIST أو
// GROUPS_MAP هيشوف القيمة الجديدة تلقائيًا في أول render جاي ليه (زي ما
// بيحصل بالظبط مع أي متغيّر آخر في الموديول)، من غير الحاجة لإعادة تحميل
// الصفحة كلها.
export let GRADES_LIST = [...BASE_GRADES, ...loadCustomGrades()];
export let GROUPS_MAP  = { ...BASE_GROUPS_MAP, ...loadCustomGroups() };

/**
 * إضافة صف جديد للنظام كله دفعة واحدة. بترجع true لو اتضاف فعلاً،
 * أو false لو الاسم فاضي أو موجود بالفعل (وفي الحالة دي بنسيبه زي ما هو
 * من غير تكرار).
 */
export function addCustomGrade(name, groups = ["A"]) {
  const clean = String(name || "").trim();
  if (!clean || GRADES_LIST.includes(clean)) return false;

  const custom = loadCustomGrades();
  custom.push(clean);
  localStorage.setItem(CUSTOM_GRADES_KEY, JSON.stringify(custom));

  const customGroups = loadCustomGroups();
  customGroups[clean] = groups;
  localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(customGroups));

  GRADES_LIST = [...GRADES_LIST, clean];
  GROUPS_MAP  = { ...GROUPS_MAP, [clean]: groups };
  return true;
}

export const TODAY = new Date().toISOString().split("T")[0];

export const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"
];

export const SIDEBAR_NAV = [
  {key:"attendance", icon:"✅", label:"الحضور"},
  {key:"finance",    icon:"💰", label:"المصاريف"},
  {key:"exams",      icon:"📝", label:"الامتحانات"},
  {key:"dashboard",  icon:"🗼", label:"المراقبة"},
  {key:"addStudent", icon:"➕", label:"إضافة طالب"},
  {key:"students",   icon:"👥", label:"الطلاب"},
  {key:"whatsapp",   icon:"💬", label:"الواتس"},
  {key:"block",      icon:"🚫", label:"بلوك"},
];
