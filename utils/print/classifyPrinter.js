// ══════════════════════════════════════════════════════════════
// classifyPrinter.js
// يصنف الطابعة (thermal / system / pdf) من اسمها
// ══════════════════════════════════════════════════════════════

// أنماط أسماء الطابعات الحرارية الشائعة في السوق المصري والعربي
const THERMAL_PATTERNS = [
  /pos/i,
  /thermal/i,
  /receipt/i,
  /80\s*mm/i,
  /58\s*mm/i,
  /76\s*mm/i,
  /epson\s*tm/i,       // Epson TM-T88, TM-T20
  /star\s*(tsp|sp|mp)/i,
  /citizen\s*ct/i,
  /bixolon/i,
  /rongta/i,
  /xprinter/i,
  /zjiang/i,
  /gprinter/i,
  /sewoo/i,
  /apr/i,              // APR Thermal — شائعة في مصر
  /sna/i,
  /kpos/i,
];

const VIRTUAL_PATTERNS = [
  /pdf/i,
  /fax/i,
  /onenote/i,
  /xps/i,
  /microsoft\s*print/i,
  /adobe/i,
  /cutepdf/i,
  /foxit/i,
  /bullzip/i,
];

/**
 * يصنف الطابعة حسب اسمها
 * @param {string} name — اسم الطابعة كما يظهر في النظام
 * @returns {"thermal"|"system"|"pdf"}
 */
export function classifyPrinter(name = "") {
  if (THERMAL_PATTERNS.some(p => p.test(name))) return "thermal";
  if (VIRTUAL_PATTERNS.some(p => p.test(name)))  return "pdf";
  return "system";
}

/**
 * يحول قائمة أسماء خام لكائنات طابعة مصنفة
 * @param {string[]} names
 * @returns {{ name: string, type: "thermal"|"system"|"pdf" }[]}
 */
export function buildPrinterList(names = []) {
  return names.map(name => ({ name, type: classifyPrinter(name) }));
}
