  /**
   * emailParser/index.js
   *
   * Main entry point. Called from imapService.js BEFORE calling Haiku.
   *
   * Pipeline:
   *   1. extractFromEmail()  — loose field extraction + preliminary checks
   *                            merchant keyword scan is done inside here now
   *   2. normalizeFields()   — amount + date to DB-ready formats
   *   3. resolveIds()        — category names → DB UUIDs
   *
   * Returns a structured result ready for DB insertion, or null if:
   *   - Preliminary checks rejected the email (promo, OTP, noise)
   *   - Amount could not be extracted (hard requirement)
   *   - Normalization failed on amount
   *
   * Category/subcategory may be null — that is acceptable.
   * The user classifies manually in the Review Transactions UI.
   * Date falling back to receivedAt is also acceptable.
   *
   * Note: merchantLookup.js is now used directly inside extractor.js.
   * index.js no longer calls lookupMerchant() separately — the extractor
   * returns merchant as { category, subCategory } | null already.
   *
   * ─── Shape of a successful return value ──────────────────────────────
   * {
   *   amount:           number,       // e.g. 549.28
   *   transactionDate:  string,       // "YYYY-MM-DD"
   *   description:      string,       // human-readable label
   *   category_id:      string|null,  // UUID or null
   *   sub_category_id:  string|null,  // UUID or null
   *   last4:            string|null,  // "2343" or null
   *   upiId:            string|null,  // "abc@upi" or null (pre-strip value)
   *   transactionType:  string,       // "upi_debit", "debit_card", etc.
   *   bank:             string,       // "HDFC", "ICICI", etc.
   * }
   * ─────────────────────────────────────────────────────────────────────
   */

  import { extractFromEmail } from "./extractor.js";
  import { normalizeFields } from "./normalizer.js";
  import { resolveIds } from "./classifier.js";

  // ─── Description builder ──────────────────────────────────────────────────────

  /**
   * Builds a short human-readable label from extracted fields.
   * This is what appears in the Review Transactions UI.
   *
   * Priority:
   *   1. If a merchant category was matched, use that category name
   *   2. Otherwise fall back to bank + transaction type
   */
  function buildDescription({ merchant, transactionType, bank }) {
    const typeLabel = {
      upi_debit:       "UPI payment",
      upi_credit:      "UPI received",
      debit_card:      "Debit card purchase",
      credit_card:     "Credit card purchase",
      netbanking:      "NetBanking transfer",
      neft_imps:       "NEFT/IMPS transfer",
      atm_withdrawal:  "ATM withdrawal",
      credit_received: "Credit received",
      debit:           "Bank debit",
      unknown:         "Bank transaction",
    }[transactionType] || "Transaction";

    // merchant here is { category, subCategory } | null
    // We use the category name as a readable label if available
    if (merchant?.category) {
      const label = merchant.subCategory
        ? `${merchant.category} — ${merchant.subCategory}`
        : merchant.category;
      return `${label} (${typeLabel})`;
    }

    return `${bank} ${typeLabel}`;
  }

  // ─── Main export ──────────────────────────────────────────────────────────────

  /**
   * Try to parse a bank alert email using the custom loose parser.
   *
   * @param {string} subject     - Email subject (raw)
   * @param {string} rawBody     - Email body BEFORE PII stripping
   * @param {Date}   receivedAt  - Timestamp from IMAP envelope
   * @returns {Promise<object|null>}
   *   Parsed result ready for DB insertion, or null.
   *
   *   null has two meanings for the caller (imapService.js):
   *     - Preliminary check failed  → do NOT fall back to Haiku, skip entirely
   *     - Amount missing after check passed → fall back to Haiku
   *
   *   To distinguish these, extractor.js logs the reason.
   *   For now the caller treats both as "skip or fallback" — good enough.
   */
  export async function parseEmail(subject, rawBody, receivedAt) {

    // ── Step 1: Extract ─────────────────────────────────────────────────────────
    // Runs preliminary checks internally. Returns null if noise/promo detected.
    const extracted = extractFromEmail(subject, rawBody);

    if (!extracted) {
      // Reason already logged inside extractFromEmail
      return null;
    }

    console.log(
      `[EmailParser] Extracted — bank=${extracted.bank} ` +
      `type=${extracted.transactionType} amount=${extracted.amount}`
    );

    // ── Step 2: Normalize ───────────────────────────────────────────────────────
    // Converts raw amount string and raw date string to DB-ready types.
    // Date falls back to receivedAt if not found in email.
    const { amount, transactionDate } = normalizeFields(extracted, receivedAt);

    if (!amount) {
      console.warn(
        "[EmailParser] Amount normalization failed — falling back to Haiku.",
        { rawAmount: extracted.amount }
      );
      return null;
    }

    // transactionDate will always be set here — normalizeFields falls back
    // to receivedAt, so we don't need a null check on it.

    // ── Step 3: Resolve category UUIDs ─────────────────────────────────────────
    // extracted.merchant is already { category, subCategory } | null
    // from the keyword scan done inside extractor.js.
    let category_id    = null;
    let sub_category_id = null;

    if (extracted.merchant) {
      const resolved = await resolveIds(
        extracted.merchant.category,
        extracted.merchant.subCategory
      );
      if (resolved) {
        category_id    = resolved.category_id;
        sub_category_id = resolved.sub_category_id;
      }
    } else {
      console.log(
        "[EmailParser] No merchant keyword matched — " +
        "category will be null, user classifies in Review UI."
      );
    }

    // ── Build final result ──────────────────────────────────────────────────────
    return {
      amount,
      transactionDate,
      description:    buildDescription(extracted),
      category_id,
      sub_category_id,
      last4:          extracted.last4,
      upiId:          extracted.upiId,
      transactionType: extracted.transactionType,
      bank:           extracted.bank,
    };
  }
