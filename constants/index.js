// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════
export const GRADES_LIST = [
  "أولى إعدادي","ثانية إعدادي","ثالثة إعدادي",
  "أولى ثانوي","ثانية ثانوي","ثالثة ثانوي"
];

export const GROUPS_MAP = {
  "أولى إعدادي":["A","B"], "ثانية إعدادي":["A","B"], "ثالثة إعدادي":["A"],
  "أولى ثانوي":["A","B"], "ثانية ثانوي":["A"], "ثالثة ثانوي":["A","B"]
};

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
