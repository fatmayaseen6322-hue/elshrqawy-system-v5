// ══════════════════════════════════════════════════════════════
// INITIAL DATA
// ══════════════════════════════════════════════════════════════
export const INIT_STUDENTS = [
  {id:"SHR-001",name:"أحمد محمد السيد",    grade:"ثالثة ثانوي", group:"A",phone:"01012345678",parentName:"محمد السيد",  parentPhone:"01098765432",joinDate:"2024-09-01",status:"active",paid:1800,totalFees:2400,score:78,present:28,absent:4, late:2,total:34,weak:["الجبر","المعادلات"]},
  {id:"SHR-002",name:"سارة علي محمود",     grade:"ثانية إعدادي",group:"A",phone:"01155667788",parentName:"علي محمود",   parentPhone:"01233445566",joinDate:"2024-09-01",status:"active",paid:2400,totalFees:2400,score:95,present:30,absent:1, late:0,total:31,weak:[]},
  {id:"SHR-003",name:"محمد عبدالله حسن",   grade:"ثالثة ثانوي", group:"A",phone:"01099887766",parentName:"عبدالله حسن", parentPhone:"01122334455",joinDate:"2024-10-01",status:"active",paid:600, totalFees:2400,score:52,present:18,absent:12,late:4,total:34,weak:["الجبر","الهندسة"]},
  {id:"SHR-004",name:"فاطمة خالد إبراهيم", grade:"أولى ثانوي",  group:"B",phone:"01234567890",parentName:"خالد إبراهيم",parentPhone:"01344556677",joinDate:"2024-09-15",status:"active",paid:1200,totalFees:2400,score:68,present:24,absent:5, late:3,total:32,weak:["الهندسة"]},
  {id:"SHR-005",name:"عمر يوسف عادل",      grade:"ثالثة ثانوي", group:"B",phone:"01122334455",parentName:"يوسف عادل",   parentPhone:"01455667788",joinDate:"2024-09-01",status:"active",paid:2400,totalFees:2400,score:88,present:31,absent:0, late:1,total:32,weak:["المعادلات"]},
  {id:"SHR-006",name:"نور أحمد سامي",      grade:"ثانية إعدادي",group:"B",phone:"01566778899",parentName:"أحمد سامي",   parentPhone:"01677889900",joinDate:"2024-11-01",status:"temp",  paid:0,  totalFees:2400,score:38,present:16,absent:14,late:3,total:33,weak:["الجبر","الهندسة"]},
  {id:"SHR-007",name:"كريم محمود فارس",    grade:"أولى إعدادي", group:"A",phone:"01677889900",parentName:"محمود فارس",  parentPhone:"01788990011",joinDate:"2024-09-01",status:"active",paid:1800,totalFees:2400,score:82,present:29,absent:2, late:1,total:32,weak:[]},
  {id:"SHR-008",name:"مريم حسن علي",       grade:"ثالثة ثانوي", group:"A",phone:"01788990011",parentName:"حسن علي",     parentPhone:"01899001122",joinDate:"2024-09-01",status:"active",paid:2400,totalFees:2400,score:91,present:32,absent:0, late:0,total:32,weak:[]},
];

// ملاحظة: لا يوجد INIT_PAYMENTS هنا عمداً.
// سجل دفعات كل طالب يُخزَّن داخل student.payments (مصفوفة مرفقة بكل طالب).
// هذا منفصل تماماً عن INIT_FIN_RECORDS بالأسفل (انظر توضيح الفصل هناك).

export const INIT_SETTINGS = {
  centerName: "مركز الشرقاوي التعليمي",
  adminPhone: "01000000000",
  // كلمات المرور مشفّرة بـ SHA-256 — القيم الافتراضية:
  //   admin    → "admin123"
  //   cashier  → "cash123"
  //   teacher  → "teach123"
  // لتغييرها: الإعدادات → كلمة مرور الدور المطلوب
  password:        "sha256:703e1ba45df97a88dc8e7c27ac29ff2c9490055cac02d10a27ecd49560408cf7",
  cashierPassword: "sha256:d716e892f84b4963347e3bfbae7e946b2a333d01a1f215debabe8be4d1d1a1d6",
  teacherPassword: "sha256:5d284a8fa5b70176873cfc553d6da0008c212cb8c3f8ca8097e7f347d68bf3d2",
  logo: null,
  bg: null,
  waNumbers: [
    {id:1,number:"01012345678",type:"admin",  label:"إدارة السنتر"},
    {id:2,number:"01098765432",type:"teacher",label:"أ. محمود"},
  ],
  notifs: {autoNotifs:true,absenceAlert:true,feesAlert:true,autoSave:true,scoreAlert:true},
  gradeFees: {
    "أولى إعدادي":400,"ثانية إعدادي":400,"ثالثة إعدادي":450,
    "أولى ثانوي":500,"ثانية ثانوي":500,"ثالثة ثانوي":600
  },
  financePassword: "1234",
  financePasswordEnabled: true,
  receivers: [
    {id:1,name:"أ. محمود",active:true},
    {id:2,name:"أ. سارة", active:true},
    {id:3,name:"المحاسب", active:true},
    {id:4,name:"الإدارة", active:true},
  ],
};

// ══════════════════════════════════════════════════════════════
// توضيح الفصل بين سجلّي الدفعات في النظام (مهم لتجنّب الالتباس):
//
// 1) student.payments  →  "سجل دفعات الطالب الشخصي"
//    - يعيش داخل كل طالب في مصفوفة students (يُحدَّث عبر setStudents).
//    - يُكتب فقط من شاشة "ملف الطالب" في StudentsModule (StudentPaySubmodule).
//    - الغرض: عرض تاريخ دفعات هذا الطالب بالتحديد + تحديث s.paid الإجمالي.
//    - لا علاقة له بمن استلم الدفعة أو في أي شهر/سنة تحديداً تم تخصيصها.
//
// 2) INIT_FIN_RECORDS (finRecords)  →  "سجل الخزينة / المحاسبة الشهري"
//    - مصفوفة مستقلة تعيش في App.jsx (finRecords / setFinRecords) وتُمرَّر
//      إلى FinanceModule و DashboardModule و SettingsModule (النسخ الاحتياطي).
//    - تُكتب فقط من FinanceModule (شاشة "إدارة المصاريف" الشهرية).
//    - كل سجل مرتبط بشهر/سنة/مجموعة/مستلم (receiverId) محدد — أي هي
//      "إيصال محاسبي" رسمي يُستخدم في حساب التحصيل الشهري ولوحة التحكم.
//
// الخلاصة: الاثنان يسجّلان "دفعات" لكنهما مصدران مختلفان لغرضين مختلفين:
// الأول تاريخ شخصي للطالب، والثاني سجل محاسبي شهري للسنتر. لا يجب توحيدهما
// تلقائياً لأن غياب أحدهما (مثلاً دفعة نقدية سُجّلت في ملف الطالب لكن لم
// تُرحَّل لسجل الخزينة) هو بالضبط ما تكتشفه تقارير المطابقة المالية.
// ══════════════════════════════════════════════════════════════
export const INIT_FIN_RECORDS = [
  {id:"FIN-101",studentId:"SHR-001",studentName:"أحمد محمد السيد",  grade:"ثالثة ثانوي",group:"A",month:5,year:2025,amount:600,receiverId:1,receiverName:"أ. محمود",timestamp:"2025-05-02 09:15",note:""},
  {id:"FIN-102",studentId:"SHR-003",studentName:"محمد عبدالله حسن", grade:"ثالثة ثانوي",group:"A",month:5,year:2025,amount:600,receiverId:2,receiverName:"أ. سارة", timestamp:"2025-05-05 10:30",note:""},
  {id:"FIN-103",studentId:"SHR-008",studentName:"مريم حسن علي",     grade:"ثالثة ثانوي",group:"A",month:5,year:2025,amount:600,receiverId:1,receiverName:"أ. محمود",timestamp:"2025-05-02 09:20",note:""},
  {id:"FIN-104",studentId:"SHR-002",studentName:"سارة علي محمود",   grade:"ثانية إعدادي",group:"A",month:5,year:2025,amount:400,receiverId:3,receiverName:"المحاسب", timestamp:"2025-05-03 11:00",note:""},
];

export const WEB_EXAMS = [
  {id:"e1",name:"امتحان الجبر الشهري",date:"2025-05-15",grade:"ثالثة ثانوي",group:"A",lesson:"المعادلات التربيعية",unit:"الوحدة الثالثة",
   results:[{studentId:"SHR-001",score:88,max:100},{studentId:"SHR-003",score:55,max:100},{studentId:"SHR-008",score:94,max:100}],
   cheating:[{studentId:"SHR-003",violation:"تشابه إجابات",time:"10:23 ص",count:2}]},
  {id:"e2",name:"كويز الهندسة",date:"2025-05-22",grade:"ثالثة ثانوي",group:"B",lesson:"المثلثات",unit:"الوحدة الثانية",
   results:[{studentId:"SHR-005",score:88,max:100}],cheating:[]},
];

export const CENTER_EXAMS = [
  {id:"c1",name:"امتحان نصف الترم",   grade:"ثالثة ثانوي",group:"A",date:"2025-05-20",sheets:32,status:"needs_correction",corrector:""},
  {id:"c2",name:"امتحان الشهر الثالث",grade:"ثانية إعدادي",group:"A",date:"2025-05-18",sheets:28,status:"needs_review",    corrector:"أ. محمود",correctionDate:"2025-05-21"},
];

export const EXAM_QS = [
  {id:"q1",text:"ما حل المعادلة: 2x + 6 = 14",         options:["x=3","x=4","x=5","x=6"],     correct:1,topic:"الجبر",     marks:10},
  {id:"q2",text:"مساحة الدائرة نصف قطرها 7 = ؟",       options:["154","144","134","164"],       correct:0,topic:"الهندسة",  marks:10},
  {id:"q3",text:"sin(90°) = ؟",                         options:["0","0.5","1","-1"],           correct:2,topic:"المثلثات", marks:10},
  {id:"q4",text:"جذر 144 = ؟",                          options:["11","12","13","14"],           correct:1,topic:"الجبر",     marks:10},
  {id:"q5",text:"حل: x² - 5x + 6 = 0",                options:["x=1,6","x=2,3","x=3,4","x=1,5"],correct:1,topic:"المعادلات",marks:10},
];
