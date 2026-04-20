import Anthropic from "@anthropic-ai/sdk";
import pool from "../config/db.js";

const client = new Anthropic();

// ─── DB Helpers ─────────────────────────────────────────────

/**
 * Fetches all categories and their subcategories from DB.
 * Returns a flat list Haiku can reason over.
 */
async function fetchCategoryList() {
  const result = await pool.query(`
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      c.type AS category_type,
      s.id   AS sub_category_id,
      s.name AS sub_category_name
    FROM categories c
    LEFT JOIN sub_categories s ON s.category_id = c.id
    ORDER BY c.name, s.name
  `);
  return result.rows;
}

/**
 * Given last4 or upi_id returned by Haiku, find the matching
 * payment_source row for this user.
 * Returns payment_source_id (UUID) or null if no match.
 */
export async function matchPaymentSource(userId, { last4, upiId }) {
  if (last4) {
    const result = await pool.query(
      `SELECT id FROM payment_sources
       WHERE user_id = $1 AND last4 = $2 AND is_active = true
       LIMIT 1`,
      [userId, last4],
    );
    return result.rows[0]?.id || null;
    
  }

  if (upiId) {
    const result = await pool.query(
      `SELECT id FROM payment_sources
       WHERE user_id = $1 AND upi_id ILIKE $2 AND is_active = true
       LIMIT 1`,
      [userId, upiId],
    );
    return result.rows[0]?.id || null;
  }

  return null;
}

// ─── Prompt Builder ──────────────────────────────────────────

function buildPrompt(cleanedEmailBody, categoryList) {
  const categoryText = categoryList
    .map((row) => {
      const sub = row.sub_category_name
        ? ` > ${row.sub_category_name} (sub_category_id: ${row.sub_category_id})`
        : " (no subcategory)";
      return `- ${row.category_name} [${row.category_type}] (category_id: ${row.category_id})${sub}`;
    })
    .join("\n");

  return `You are a financial transaction parser. Extract the transaction from the bank/payment email below and return a JSON object.

CATEGORY LIST (use exact IDs from this list):
${categoryText}

EMAIL:
${cleanedEmailBody}

INSTRUCTIONS:
- Extract the single most important transaction from this email.
- Pick the best matching category_id and sub_category_id from the list above using the exact UUIDs.
- For payment source: extract last4 (4-digit card ending number) OR upi_id if present. Set the other to null. Do not invent these values.
- For transaction_date: return as YYYY-MM-DD. If only month/day visible, assume current year.
- For amount: return as a number with up to 2 decimal places. No currency symbols.
- For description: write a short human-readable label, e.g. "Swiggy food delivery", "HDFC credit card EMI".

RESPOND WITH ONLY VALID JSON. No explanation, no markdown, no backticks. Exactly this shape:

{
  "amount": 1200.00,
  "transaction_date": "2025-04-04",
  "description": "Swiggy food delivery",
  "category_id": "<uuid>",
  "sub_category_id": "<uuid or null>",
  "last4": "1234",
  "upi_id": null
}

If you cannot extract a valid transaction (promotional email, no amount found), return:
{ "amount": null }`;
}

// ─── Haiku API Call ──────────────────────────────────────────

async function callHaiku(prompt) {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json|```/g, "").trim();

  return JSON.parse(cleaned);
}

// ─── Main Export ─────────────────────────────────────────────

/**
 * Full pipeline: fetch categories → build prompt → call Haiku →
 * insert transaction → return inserted id.
 *
 * @param {string} cleanedBody  - PII-stripped email body from piiStripper
 * @param {string} userId       - UUID of the matched user
 * @param {string} rawEmailId   - UUID of the raw_emails row
 * @returns {Promise<string|null>} - Inserted transaction UUID, or null if unparseable
 */
export async function parseAndInsert(cleanedBody, userId, rawEmailId) {
  const categoryList = await fetchCategoryList();
  const prompt = buildPrompt(cleanedBody, categoryList);
  const parsed = await callHaiku(prompt);

  // Haiku signals "nothing useful" by returning { amount: null }
  if (!parsed.amount) {
    console.log(`[Haiku] No transaction found in email — skipping insert.`);
    return null;
  }

  console.log(`[Haiku] Parsed:`, parsed);

  const paymentSourceId = await matchPaymentSource(userId, {
    last4: parsed.last4 || null,
    upiId: parsed.upi_id || null,
  });

  const result = await pool.query(
    `INSERT INTO transactions
      (user_id, payment_source_id, category_id, sub_category_id,
       entry_mode, description, amount, transaction_date, status, raw_email_id)
     VALUES ($1,$2,$3,$4,'email_parsed',$5,$6,$7,'pending',$8)
     RETURNING id`,
    [
      userId,
      paymentSourceId,
      parsed.category_id,
      parsed.sub_category_id || null,
      parsed.description,
      parsed.amount,
      parsed.transaction_date,
      rawEmailId,
    ],
  );

  const insertedId = result.rows[0].id;
  console.log(`[Haiku] Inserted transaction id: ${insertedId}`);
  return insertedId;
}
