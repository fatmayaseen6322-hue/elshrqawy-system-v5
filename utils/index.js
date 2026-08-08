import { MONTHS_AR } from "../constants/index.js";

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

// ── تشفير كلمات المرور (SHA-256 + salt ثابت للتطبيق) ────────
// لا نخزّن كلمة المرور كنص عادي — نخزّن hash فقط.
// hashPwd: تأخذ نص → تُرجع Promise<string> (hex)
// checkPwd: تأخذ نص + hash محفوظ → تُرجع Promise<boolean>
const PWD_SALT = "elshrqawy_v9_salt_2025";
export async function hashPwd(plain) {
  try {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(PWD_SALT + plain));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // fallback بسيط لو SubtleCrypto مش متاح (بيئات قديمة جداً)
    return "plain:" + plain;
  }
}
export async function checkPwd(plain, storedHash) {
  if (!storedHash) return false;
  // دعم كلمات المرور القديمة (plain text) أثناء فترة الانتقال
  if (!storedHash.startsWith("sha256:") && !storedHash.startsWith("plain:")) {
    return plain === storedHash;
  }
  if (storedHash.startsWith("plain:")) return plain === storedHash.slice(6);
  const computed = await hashPwd(plain);
  return "sha256:" + computed === storedHash;
}
export async function hashPwdStored(plain) {
  const h = await hashPwd(plain);
  return "sha256:" + h;
}
export const pct  = (a, b) => b === 0 ? 0 : Math.round(a / b * 100);
export const fmt  = n => (n || 0).toLocaleString("ar-EG") + " ج";
export const fmtM = n => (n || 0).toLocaleString("ar-EG");
export const scC  = v => v >= 85 ? "#10b981" : v >= 65 ? "#3b82f6" : v >= 50 ? "#f59e0b" : "#ef4444";
export const scL  = v => v >= 85 ? "ممتاز"  : v >= 65 ? "جيد"    : v >= 50 ? "مقبول"  : "ضعيف";

// ── Safe localStorage helpers ──────────────────────────────────
export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed !== null && parsed !== undefined) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ── حالة البلوك (مصدر واحد يُستخدم في كل الموديولات) ───────────
// طالب "بلوك" = اتنقل يدويًا (blocked) أو حالته "موقوف" (inactive).
// لازم يتشال من كل القوائم/العمليات النشطة (طلاب، حضور، مصاريف،
// داشبورد) لحد ما يترجع من صفحة "بلوك" — بياناته القديمة (finRecords/
// attRecords) فضلت زي ما هي في كل الأحوال، إحنا بس بنفلترها من العرض.
export function isBlocked(s) {
  return !!(s && (s.blocked === true || s.status === "inactive"));
}

// كل فترات البلوك لطالب واحد: [{ start:"YYYY-MM-DD", end:"YYYY-MM-DD"|null }]
// end=null يعني لسه بلوك (ما رجعش لحد دلوقتي).
export function getBlockPeriods(s) {
  return ((s && s.blockHistory) || [])
    .filter(h => h && h.blockDate)
    .map(h => ({ start: h.blockDate, end: h.unblockDate || null }));
}

// هل شهر معيّن (month: 1-12, year) بيتقاطع مع أي فترة بلوك لهذا الطالب؟
// بتُستخدم عشان شهور البلوك ما تتحسبش "متأخر سداد" لا وقت البلوك ولا
// بعد الرجوع — الفترة اللي كان فيها بلوك تفضل تبان "بلوك" مش دَين.
export function isMonthBlocked(s, month, year) {
  const periods = getBlockPeriods(s);
  if (!periods.length) return false;
  const mm = String(month).padStart(2, "0");
  const monthStart = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return periods.some(p => monthStart <= (p.end || "9999-12-31") && p.start <= monthEnd);
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // إصلاح #18: كان الفشل (Quota exceeded / private mode) يُتجاهل بصمت
    // تامة، فالمستخدم يحس إنه حفظ بينما البيانات فعلياً ضايعة. نسجّل
    // تحذيراً في الكونسول على الأقل ونرجّع false ليقدر المستدعي يتصرف.
    console.warn(`lsSet: فشل حفظ "${key}" في localStorage`, e);
    return false;
  }
}

// ── Safe ID generators (timestamp + counter + random) ──────────
// إصلاح #16: كانت 4 دوال (genSID/genRID/genFinId/genExamId) مكررة بنفس
// المنطق بالضبط بفروق طفيفة في الطول والـ prefix — أي تحسين مستقبلي
// كان لازم يتكرر 4 مرات ومن المحتمل يتم نسيان نسخة. دلوقتي مصدر واحد.
//
// إصلاح #17: الاعتماد على Date.now() + Math.random() فقط كان يسمح
// (نادراً لكن فعلياً) بتصادم لو تم توليد ID-ين في نفس المللي-ثانية
// (مثلاً داخل حلقة for سريعة لإنشاء بيانات تجريبية بالجملة). إضافة
// عدّاد تسلسلي (_idCounter) لكل عملية توليد يضمن عدم تكرار جزء من الـ ID
// حتى لو الطابع الزمني والعشوائية تطابقا تماماً.
let _idCounter = 0;
function genId(prefix, randLen = 4) {
  const ts = Date.now().toString(36).toUpperCase();
  const seq = (_idCounter++ % 1296).toString(36).padStart(2, "0").toUpperCase(); // 2 خانات = حتى 1296 قيمة فريدة لكل مللي-ثانية
  const rand = Math.random().toString(36).slice(2, 2 + randLen).toUpperCase();
  return `${prefix}-${ts}${seq}${rand}`;
}

export const genSID    = () => genId("SHR", 3);

// ── رقم كود الطالب: 11 رقم بالكامل، يبدأ دايمًا بـ 01 ──────────
// بيتولّد رقم عشوائي 9 خانات ويتأكد إنه مش متكرر مع أكواد موجودة فعلاً.
export function genStudentId(existingIds = []) {
  const idsSet = new Set(existingIds || []);
  let id;
  do {
    const rand = Math.floor(Math.random() * 1e9).toString().padStart(9, "0");
    id = "01" + rand;
  } while (idsSet.has(id));
  return id;
}
export const genRID    = () => genId("R", 2);
export const genFinId  = () => genId("FIN", 2);
export const genExamId = () => genId("E", 2);

export const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

export function printThermal(rec, centerName) {
  if (!rec || !centerName) return;
  const monthName = MONTHS_AR[rec.month - 1] || "";
  const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>@page{size:80mm auto;margin:4mm}body{font-family:Tahoma,sans-serif;font-size:11px;text-align:center;direction:rtl;}h2{font-size:13px;margin:2px 0;}p{margin:1px 0;}hr{border:none;border-top:1px dashed #000;margin:4px 0;}.row{display:flex;justify-content:space-between;font-size:11px;}</style></head><body><h2>${centerName}</h2><p>إيصال مصاريف</p><hr/><div class="row"><span>الطالب:</span><span>${rec.studentName}</span></div><div class="row"><span>الصف:</span><span>${rec.grade} - مج.${rec.group}</span></div><div class="row"><span>الشهر:</span><span>${monthName} ${rec.year}</span></div><div class="row"><span>المبلغ:</span><span>${rec.amount} ج</span></div><div class="row"><span>المستلم:</span><span>${rec.receiverName}</span></div><div class="row"><span>التوقيت:</span><span>${rec.timestamp}</span></div><hr/><p>شكراً لثقتكم</p><script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script></body></html>`;
  // إصلاح #10: المنطق القديم كان `!window.print && !window.open` وهذا
  // مضلل وعملياً معكوس — window.print() غير مُستخدم هنا أبداً (هو فقط
  // داخل سكريبت الصفحة المطبوعة الجديدة، وله window خاص بها مختلف تماماً).
  // الاعتماد الفعلي الوحيد في هذا السكوب هو window.open، وهو ما يُستخدم
  // في كل المحاولات (المباشرة، fallback تاوري، fallback blob) أدناه.
  if (!window.open) return; // Android WebView أو بيئة بدون نوافذ: لا توجد طريقة للطباعة
  try {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); return; }
  } catch { /* Tauri CSP blocks window.open("","_blank") — fall through */ }
  // Tauri fallback: blob URL in new window
  try {
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    // إصلاح #19: كان revokeObjectURL يُستدعى بعد setTimeout ثابت (10 ثواني)
    // بدون أي ضمان إن النافذة الجديدة خلصت تحميل المحتوى — لو الطابعة بطيئة
    // أو فتح النافذة تأخر، الـ blob ممكن يُلغى قبل ما المحتوى يكتمل تحميله.
    // نفضّل الاستماع لـ load event الحقيقي على النافذة الجديدة (نفس blob
    // origin، فلا قيود cross-origin)، ونستخدم timeout أطول كحماية احتياطية
    // فقط في حالة عدم توفر الوصول لـ w (نادر، حسب المتصفح/البيئة).
    if (w) {
      try {
        w.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      } catch {
        setTimeout(() => URL.revokeObjectURL(url), 30000); // احتياطي أطول بدل 10 ثوانٍ
      }
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } catch { /* ignore */ }
}

export function speak(text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-EG";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch { /* ignore speech errors */ }
}

// إصلاح #7: دالة موحدة لتحويل رقم محلي لصيغة wa.me — كانت مكررة في 4 ملفات
// بمنطق هش (`replace(/^0/, "20")`) بدون أي تحقق: لو الرقم مش موجود، أو
// مكتوب بالفعل بكود دولة، أو فيه مسافات/شرطات، كان بيولّد رابط واتساب غلط بصمت.
export function waLink(phone, extra = "") {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, ""); // يشيل مسافات/شرطات/+ إلخ
  if (!digits) return null;
  // لو الرقم بدأ بكود الدولة فعلاً (20) لا نضيفه مرة ثانية
  const withCountry = digits.startsWith("20") ? digits : digits.replace(/^0/, "20");
  return `https://wa.me/${withCountry}${extra}`;
}

// ══════════════════════════════════════════════════════════════
// PRINT REPORT — طباعة تقرير A4 احترافي (إضافة #2)
// يقبل: title (العنوان)، rows (مصفوفة صفوف)، cols (أسماء الأعمدة)،
//        centerName، subtitle
// ══════════════════════════════════════════════════════════════
export function printReport({ title, subtitle, cols, rows, centerName, footer }) {
  const cn = centerName || "مركز تعليمي";
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}`;
  const tableRows = (rows || []).map(row =>
    `<tr>${row.map(cell => `<td>${cell ?? "—"}</td>`).join("")}</tr>`
  ).join("");
  const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Tahoma, sans-serif; font-size: 11px; direction: rtl; color: #1e293b; }
  .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 12px; }
  .header h1 { font-size: 18px; color: #1e40af; margin: 0 0 4px; }
  .header .sub { font-size: 12px; color: #64748b; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #1e40af; color: #fff; padding: 7px 8px; text-align: right; font-weight: bold; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style></head><body>
<div class="header"><h1>${cn}</h1><div class="sub">${title}${subtitle ? " — " + subtitle : ""}</div></div>
<div class="meta"><span>التاريخ: ${dateStr}</span><span>عدد السجلات: ${rows?.length ?? 0}</span></div>
<table><thead><tr>${(cols||[]).map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table>
${footer ? `<div class="footer">${footer}</div>` : ""}
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
</body></html>`;
  if (!window.open) return;
  try {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); return; }
  } catch { /* Tauri fallback */ }
  try {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      try { w.addEventListener("load", () => URL.revokeObjectURL(url), { once: true }); }
      catch { setTimeout(() => URL.revokeObjectURL(url), 30000); }
    } else { setTimeout(() => URL.revokeObjectURL(url), 30000); }
  } catch { /* ignore */ }
}
