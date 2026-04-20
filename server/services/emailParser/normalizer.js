/**
 * normalizer.js
 *
 * Takes the raw extracted fields and converts them to DB-ready values:
 *   amount   → NUMERIC(12,2) as a JS number
 *   rawDate  → "YYYY-MM-DD" string, or falls back to receivedAt
 *
 * All supported date formats:
 *   DD-MM-YY          → HDFC UPI, SBI UPI style (07-04-26)
 *   DD-MM-YYYY        → Axis, Kotak style (07-04-2026)
 *   DD Mon, YYYY      → HDFC debit card (08 Apr, 2026)
 *   DD Mon YYYY       → Kotak debit card (08 Apr 2026)
 *   DD-Mon-YY         → ICICI style (07-Apr-26)
 *   DD-Mon-YYYY       → ICICI/Axis style (07-Apr-2026)
 *   DDMonYY           → SBI style (07Apr26)
 *   DDMonYYYY         → SBI style (07Apr2026)
 *   DD/MM/YYYY        → SBI POS style
 */

const MONTH_MAP = {
  jan: "01", feb: "02", mar: "03", apr: "04",
  may: "05", jun: "06", jul: "07", aug: "08",
  sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Converts a 2-digit year to 4-digit, assuming 2000s.
 * "26" → "2026", "99" → "2099" (edge case, acceptable for now)
 */
function expandYear(yy) {
  return yy.length === 2 ? `20${yy}` : yy;
}

/**
 * Parses a raw date string from the extractor into "YYYY-MM-DD".
 * Returns null if the string is null or unrecognised.
 *
 * @param {string|null} rawDate
 * @returns {string|null}
 */
export function normalizeDate(rawDate) {
  if (!rawDate) return null;

  const s = rawDate.trim();

  // DD-MM-YY or DD-MM-YYYY   →  07-04-26 / 07-04-2026
  let m = s.match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if (m) {
    return `${expandYear(m[3])}-${m[2]}-${m[1]}`;
  }

  // DD/MM/YYYY               →  08/04/2026
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  // DDMonYY or DDMonYYYY     →  07Apr26 / 07Apr2026
  m = s.match(/^(\d{2})([A-Za-z]{3})(\d{2,4})$/);
  if (m) {
    const mon = MONTH_MAP[m[2].toLowerCase()];
    if (mon) return `${expandYear(m[3])}-${mon}-${m[1]}`;
  }

  // DD-Mon-YY or DD-Mon-YYYY →  07-Apr-26 / 07-Apr-2026
  m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const mon = MONTH_MAP[m[2].toLowerCase()];
    if (mon) return `${expandYear(m[3])}-${mon}-${m[1]}`;
  }

  // DD Mon, YYYY  or  DD Mon YYYY   →  08 Apr, 2026 / 08 Apr 2026
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})$/);
  if (m) {
    const mon = MONTH_MAP[m[2].toLowerCase()];
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
  }

  // Unrecognised
  return null;
}

/**
 * Converts a raw amount string like "1,200.50" or "1200" to a JS number.
 * Returns null if the string is null or produces NaN.
 *
 * @param {string|null} rawAmount
 * @returns {number|null}
 */
export function normalizeAmount(rawAmount) {
  if (!rawAmount) return null;
  // Remove commas, then parse
  const cleaned = rawAmount.replace(/,/g, "");
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Convenience wrapper: normalises both fields and falls back the date
 * to receivedAt (a JS Date) when rawDate is null or unparseable.
 *
 * @param {object} extracted   - Output from extractor.js
 * @param {Date}   receivedAt  - Email received timestamp (from IMAP)
 * @returns {{ amount: number|null, transactionDate: string|null }}
 */
export function normalizeFields(extracted, receivedAt) {
  const amount = normalizeAmount(extracted.amount);

  let transactionDate = normalizeDate(extracted.rawDate);

  if (!transactionDate && receivedAt) {
    // Fall back to the date the email was received
    const d = new Date(receivedAt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    transactionDate = `${yyyy}-${mm}-${dd}`;
  }

  return { amount, transactionDate };
}