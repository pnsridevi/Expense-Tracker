/**
 * extractor.js
 *
 * Loose-parse approach — extracts each field independently from the raw
 * email body. No sentence-level regex. Each extractor only looks for its
 * own field and doesn't care what surrounds it.
 *
 * Flow:
 *   1. Preliminary checks  — is this actually a transaction alert?
 *   2. detectBank()        — keyword scan on subject + body
 *   3. detectTxnType()     — keyword scan for debit/credit/upi/atm etc.
 *   4. extractAmount()     — find Rs./INR followed by digits
 *   5. extractDate()       — find any date-shaped string
 *   6. extractLast4()      — find ending/XX + 4 digits
 *   7. extractUpiId()      — find known UPI VPA domain patterns
 *   8. detectMerchant()    — keyword scan directly on body (no position needed)
 *
 * Returns: { amount, rawDate, last4, upiId, merchant, transactionType, bank }
 * or null if preliminary checks decide this is not a transaction alert.
 *
 * Called from index.js BEFORE PII stripping — UPI IDs and card digits
 * must still be present in the raw body.
 */

import { MERCHANT_MAP } from "./merchantLookup.js";

// ─── 1. Preliminary checks ────────────────────────────────────────────────────

/**
 * Keywords that strongly indicate a genuine transaction alert.
 * At least one must be present for the email to pass.
 */
const TRANSACTION_KEYWORDS = [
  "debited", "credited", "debit", "credit",
  "withdrawn", "spent", "charged", "transferred",
  "payment", "transaction", "purchase",
];

/**
 * Keywords that indicate noise we must skip entirely.
 * Checked before anything else — first match rejects the email.
 *
 * Organised by category so it's easy to add more later as you
 * encounter new email types in real usage.
 *
 * IMPORTANT — keep phrases specific enough to avoid killing real alerts:
 *   BAD : "balance"   → would kill "Rs.500 debited, available balance Rs.2000"
 *   GOOD: "available balance" or "closing balance" (statement context only)
 */
const NOISE_KEYWORDS = [

  // ── Reversal / refund — deferred to contra logic ─────────────────────────
  // These are real financial events but need special contra handling.
  // Skip for now; they'll be addressed in the contra phase.
  "has been reversed",
  "has been refunded",
  "reversal of",
  "refund of",
  "chargeback",
  "disputed transaction",

  // ── OTP / security alerts ─────────────────────────────────────────────────
  // These sometimes contain amounts ("otp for rs.500 transaction") but
  // the transaction itself hasn't happened yet — it's a verification step.
  "one time password",
  "do not share",
  "never share your otp",
  "your otp is",
  "otp for",
  "otp:",
  "transaction password",
  "ipin",
  "grid value",

  // ── Promotional / marketing ───────────────────────────────────────────────
  // Banks embed Rs. amounts in offers ("get cashback of rs.500") which
  // would pass the amount gate — so these must be caught here.
  "cashback offer",
  "reward points",
  "pre-approved",
  "you are eligible",
  "special offer",
  "exclusive offer",
  "limited time offer",
  "upgrade your card",
  "upgrade your account",
  "apply now",
  "opt out",
  "opt-out",
  "to unsubscribe",
  "manage your preferences",
  "email preferences",
  "this is a marketing",
  "promotional email",
  "you have won",
  "congratulations! you",   // specific enough — avoids killing "congratulations your txn"
  "lucky draw",
  "festive offer",
  "get up to",              // "get up to rs.1000 cashback" pattern
  "earn up to",
  "save up to",

  // ── Balance / account summary alerts ─────────────────────────────────────
  // Banks send periodic balance updates — these contain amounts but are
  // not individual transactions.
  "monthly statement",
  "account statement",
  "mini statement",
  "e-statement",
  "passbook",
  "closing balance",
  "opening balance",
  "total outstanding",
  "minimum amount due",
  "payment due date",
  "due date:",
  "billing cycle",
  "credit card statement",
  "your statement is ready",
  "view your statement",

  // ── Loan / EMI reminders ──────────────────────────────────────────────────
  // These are reminders, not actual debit events. The real debit will
  // come as a separate transaction alert when it actually hits.
  "emi due",
  "emi reminder",
  "loan emi reminder",
  "your emi of",
  "upcoming emi",
  "emi is due",
  "please pay your",
  "auto debit scheduled",   // scheduled ≠ happened
  "standing instruction scheduled",

  // ── KYC / compliance / account management ────────────────────────────────
  "kyc",
  "know your customer",
  "update your pan",
  "update your aadhaar",
  "account will be blocked",
  "account suspended",
  "re-kyc",
  "your account has been activated",
  "welcome to",             // welcome emails from bank
  "account opening",
  "your application",
  "your request",

  // ── Cheque / instrument alerts ────────────────────────────────────────────
  // Cheque bounce and clearance notices — not the same as a transaction
  // completing. A bounced cheque especially should not be recorded.
  "cheque bounce",
  "cheque has been returned",
  "cheque dishonoured",
  "cheque deposited",       // pending clearance, not confirmed credit
  "instrument presented",
  "ecs returned",
  "nach returned",
  "mandate rejected",

  // ── Locker / safe deposit ─────────────────────────────────────────────────
  "locker renewal",
  "safe deposit",
  "locker charges",

  // ── Card management ───────────────────────────────────────────────────────
  // Card issuance and limit change emails sometimes mention amounts
  // (new limit, annual fee waiver amount) — not transactions.
  "card has been dispatched",
  "card is on its way",
  "card limit",
  "credit limit enhanced",
  "credit limit increased",
  "annual fee waived",
  "joining fee",
  "renewal fee",
  "card blocked",
  "card hotlisted",
  "new card issued",
  "pin generated",
  "pin changed",

  // ── Fixed deposit / investment confirmations ──────────────────────────────
  // FD booking confirmation is not a spend transaction — it's a debit
  // that creates an asset. Deferred to future handling.
  // NOTE: if you want to track FD bookings as transactions later,
  // remove these from noise and handle them explicitly.
  "fd booked",
  "fixed deposit booked",
  "fd maturity",
  "fd renewal",
  "fd receipt",

  // ── Generic bank communication noise ─────────────────────────────────────
  "dear valued customer",   // almost always non-transactional
  "we noticed that",        // fraud warning / advisory emails
  "security alert",         // login alerts, not transactions
  "new login detected",
  "signed in from",
  "net banking login",
  "mobile banking login",
  "internet banking",       // risky — but "internet banking transfer" is caught
                            // by transaction keywords first in practice
  "feedback",
  "rate us",
  "survey",
  "we would love to hear",
];

/**
 * Runs all preliminary checks.
 * Returns an object { pass: bool, reason: string }.
 *
 * Checks in order:
 *   a) Noise keyword in SUBJECT            → reject (high confidence)
 *   b) Noise keyword in BODY              → reject (specific phrases only)
 *   c) No recognised bank name            → reject
 *   d) No transaction action keyword      → reject
 *   e) No currency amount anywhere        → reject
 *
 * Why split subject vs body?
 * Promotional emails reveal themselves in the subject line almost always.
 * Scanning the full body for short noise words is risky — a real
 * transaction alert can say "avail offer on next purchase" at the bottom.
 * The subject is safer to scan aggressively. Body scanning uses the same
 * list but the phrases are specific enough that false positives against
 * genuine alerts are very unlikely.
 */
export function preliminaryCheck(subject, body) {
  const lowerSubject = subject.toLowerCase();
  const lowerBody    = body.toLowerCase();
  const combined     = lowerSubject + " " + lowerBody;

  // a) Noise in subject — promotional emails almost always show here
  for (const kw of NOISE_KEYWORDS) {
    if (lowerSubject.includes(kw)) {
      return { pass: false, reason: `Noise keyword in subject: "${kw}"` };
    }
  }

  // b) Noise in body — same list, phrases are specific enough to be safe
  for (const kw of NOISE_KEYWORDS) {
    if (lowerBody.includes(kw)) {
      return { pass: false, reason: `Noise keyword in body: "${kw}"` };
    }
  }

  // c) Must belong to a known bank
  const bank = detectBank(subject, body);
  if (bank === "UNKNOWN") {
    return { pass: false, reason: "No recognised bank name found" };
  }

  // d) Must have at least one transaction action word
  const hasTxnKeyword = TRANSACTION_KEYWORDS.some((kw) =>
    combined.includes(kw)
  );
  if (!hasTxnKeyword) {
    return { pass: false, reason: "No transaction action keyword found" };
  }

  // e) Must have a currency amount
  const hasAmount = /(?:rs\.?|inr)\s*[\d,]+\.?\d*/i.test(combined);
  if (!hasAmount) {
    return { pass: false, reason: "No currency amount found" };
  }

  return { pass: true, reason: null };
}

// ─── 2. Bank detector ─────────────────────────────────────────────────────────

/**
 * Hardcoded bank keyword scan. Bank names never change — safe to hardcode.
 * Checks subject first (usually more reliable), then body.
 */
export function detectBank(subject = "", body = "") {
  const combined = (subject + " " + body).toLowerCase();
  if (/hdfc/i.test(combined)) return "HDFC";
  if (/icici/i.test(combined)) return "ICICI";
  if (/\bsbi\b|state bank of india/i.test(combined)) return "SBI";
  if (/\baxis\b/i.test(combined)) return "AXIS";
  if (/kotak/i.test(combined)) return "KOTAK";
  if (/\bpnb\b|punjab national/i.test(combined)) return "PNB";
  if (/\bbob\b|bank of baroda/i.test(combined)) return "BOB";
  if (/yes bank/i.test(combined)) return "YES";
  if (/idfc/i.test(combined)) return "IDFC";
  if (/federal bank/i.test(combined)) return "FEDERAL";
  return "UNKNOWN";
}

// ─── 3. Transaction type detector ────────────────────────────────────────────

/**
 * Infers the transaction type from keyword scanning.
 * Order matters — more specific checks before generic ones.
 */
function detectTxnType(text) {
  const t = text.toLowerCase();

  if (/\batm\b.*(?:withdrawn?|cash)/i.test(t)) return "atm_withdrawal";

  // UPI checks before generic debit/credit
  if (/\bupi\b/i.test(t) || /\bvpa\b/i.test(t)) {
    if (/credit|received/i.test(t)) return "upi_credit";
    return "upi_debit";
  }

  if (/neft|imps|rtgs/i.test(t)) return "neft_imps";
  if (/netbanking|net banking/i.test(t)) return "netbanking";

  if (/credit card/i.test(t)) {
    if (/credit|received/i.test(t) && !/debited|spent|charged/i.test(t))
      return "credit_received";
    return "credit_card";
  }

  if (/debit card/i.test(t)) return "debit_card";

  // Generic fallback
  if (/credited|received/i.test(t)) return "credit_received";
  if (/debited|spent|charged|withdrawn/i.test(t)) return "debit";

  return "unknown";
}

// ─── 4. Amount extractor ──────────────────────────────────────────────────────

/**
 * Finds the first Rs./INR amount in the text.
 * Handles: Rs.1200, Rs. 1,200.50, INR 3000, Rs1200
 * Returns raw string like "1200.50" — normalizer converts to number.
 */
function extractAmount(text) {
  const m = text.match(/(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i);
  if (!m) return null;
  // Strip commas — normalizer expects clean decimal string
  return m[1].replace(/,/g, "");
}

// ─── 5. Date extractor ───────────────────────────────────────────────────────

/**
 * Tries to find any date-shaped string anywhere in the text.
 * Patterns ordered from most specific to least specific.
 * Returns the raw matched string — normalizer.js handles format conversion.
 *
 * Supported formats (same as normalizer.js):
 *   DD-MM-YY / DD-MM-YYYY         → 07-04-26, 07-04-2026
 *   DD/MM/YYYY                    → 08/04/2026
 *   DD Mon, YYYY / DD Mon YYYY    → 08 Apr, 2026 / 08 Apr 2026
 *   DD-Mon-YY / DD-Mon-YYYY       → 07-Apr-26 / 07-Apr-2026
 *   DDMonYY / DDMonYYYY           → 07Apr26 / 07Apr2026
 */
function extractDate(text) {
  const patterns = [
    // DD-Mon-YYYY or DD-Mon-YY  (07-Apr-2026)
    /\b(\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2,4})\b/i,
    // DD Mon, YYYY or DD Mon YYYY  (08 Apr, 2026)
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec),?\s+\d{4})\b/i,
    // DDMonYY or DDMonYYYY  (07Apr26)
    /\b(\d{2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2,4})\b/i,
    // DD-MM-YYYY or DD-MM-YY  (07-04-2026)
    /\b(\d{2}-\d{2}-\d{2,4})\b/,
    // DD/MM/YYYY  (08/04/2026)
    /\b(\d{2}\/\d{2}\/\d{4})\b/,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }

  return null;
}

// ─── 6. Last4 extractor ───────────────────────────────────────────────────────

/**
 * Finds card/account last 4 digits.
 * Handles: "ending 2343", "ending in 1234", "XX1234", "XXXX2343", "x-2343"
 */
function extractLast4(text) {
  const m = text.match(
    /(?:ending(?:\s+in)?\s*|XX+[-\s]?|x[-\s]?|(?:debited\s+from\s+)?(?:account|a\/c|acct)[\s#]*(?:no\.?\s*)?)(\d{4})\b/i
  );
  return m ? m[1] : null;
}

// ─── 7. UPI ID extractor ─────────────────────────────────────────────────────

/**
 * Finds a UPI VPA by looking for known UPI provider domains.
 * Called on RAW body before PII stripping — the real VPA must still be present.
 */
function extractUpiId(text) {
  const m = text.match(
    /\b([\w.\-+]+@(?:okicici|okhdfcbank|okaxis|oksbi|ybl|upi|paytm|apl|ikwik|waicici|wahdfc|idfcbank|indus|aubank|rbl|kotak|axisbank|hdfcbank|sbi|icici|federal|sc|hsbc|citi|yes|pnb|bob|boi|union|canara|idbi|bandhan|airtel|jio|freecharge|mobikwik|phonepe|gpay|amazonpay|amazonpe))\b/i
  );
  return m ? m[1].toLowerCase() : null;
}

// ─── 8. Merchant detector ────────────────────────────────────────────────────

/**
 * Scans the full body text directly against MERCHANT_MAP keywords.
 * No merchant name extraction needed — we check if any keyword
 * from the map appears anywhere in the text.
 *
 * Returns { category, subCategory } or null.
 *
 * Note: more specific keywords (e.g. "swiggy") are safer than generic
 * ones (e.g. "hotel"). Generic keywords are listed later in MERCHANT_MAP
 * so specific ones win on first-match basis.
 */
function detectMerchant(text) {
  const lower = text.toLowerCase();

  for (const entry of MERCHANT_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { category: entry.category, subCategory: entry.subCategory };
      }
    }
  }

  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Loose-parse an email into structured transaction fields.
 *
 * @param {string} subject  - Email subject (raw)
 * @param {string} body     - Email body RAW, before PII stripping
 * @returns {{ amount, rawDate, last4, upiId, merchant, transactionType, bank } | null}
 *   null → preliminary checks failed, caller should skip (not fall back to Haiku)
 */
export function extractFromEmail(subject, body) {
  // Collapse whitespace so multi-line emails behave like single-line
  const normalizedBody = body.replace(/\s+/g, " ").trim();
  const combined = subject + " " + normalizedBody;

  // ── Preliminary checks ──────────────────────────────────────────────────────
  const check = preliminaryCheck(subject, normalizedBody);
  if (!check.pass) {
    console.log(`[Extractor] Skipping email — ${check.reason}`);
    return null;
  }

  // ── Field extraction (all independent, all tolerant of missing context) ─────
  const bank          = detectBank(subject, normalizedBody);
  const transactionType = detectTxnType(combined);
  const amount        = extractAmount(combined);
  const rawDate       = extractDate(combined);
  const last4         = extractLast4(combined);
  const upiId         = extractUpiId(normalizedBody); // raw body only — pre-PII
  const merchant      = detectMerchant(combined);

  // amount is the only hard requirement —
  // date falls back to receivedAt in normalizer, everything else can be null
  if (!amount) {
    console.log("[Extractor] Amount not found even after preliminary check — skipping.");
    return null;
  }

  console.log(`[Extractor] Extracted — bank=${bank} type=${transactionType} amount=${amount}`);

  return {
    amount,
    rawDate,
    last4,
    upiId,
    merchant,      // { category, subCategory } | null
    transactionType,
    bank,
  };
}
