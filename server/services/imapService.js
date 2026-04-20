import Imap from "node-imap";
import { simpleParser } from "mailparser";
import pool from "../config/db.js";
import { stripPII } from "./piiStripper.js";
import { parseAndInsert, matchPaymentSource } from "./haikuParser.js";
import { parseEmail } from "./emailParser/index.js";

// ─── Helpers ────────────────────────────────────────────────

function openInbox(imap, cb) {
  imap.openBox("INBOX", false, cb);
}

async function findUserByEmail(email) {
  const result = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
}

async function isAlreadyProcessed(gmailMessageId) {
  const result = await pool.query(
    "SELECT id FROM raw_emails WHERE gmail_message_id = $1",
    [gmailMessageId],
  );
  return result.rows.length > 0;
}

async function insertRawEmail({
  userId,
  gmailMessageId,
  sender,
  subject,
  body,
  receivedAt,
}) {
  const result = await pool.query(
    `INSERT INTO raw_emails 
            (user_id, gmail_message_id, sender, subject, body, received_at, processed)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id`,
    [userId, gmailMessageId, sender, subject, body, receivedAt],
  );
  return result.rows[0].id;
}

export async function markProcessed(rawEmailId, errorNote = null) {
  await pool.query(
    `UPDATE raw_emails 
         SET processed = $1, processed_at = NOW(), error_note = $2
         WHERE id = $3`,
    [errorNote === null, errorNote, rawEmailId],
  );
}

// ─── Main fetch function ─────────────────────────────────────

export function fetchEmails() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      openInbox(imap, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.search(["ALL"], async (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            console.log("[IMAP] No new emails found.");
            imap.end();
            return resolve({ fetched: 0 });
          }

          console.log(`[IMAP] Found ${results.length} new email(s).`);

          const fetch = imap.fetch(results, { bodies: "", markSeen: true });
          const emailPromises = [];

          fetch.on("message", (msg, seqno) => {
            const emailPromise = new Promise((res) => {
              let buffer = "";
              let attributes = null;

              msg.on("body", (stream) => {
                stream.on("data", (chunk) => {
                  buffer += chunk.toString("utf8");
                });
              });

              msg.once("attributes", (attrs) => {
                attributes = attrs;
              });

              msg.once("end", async () => {
                try {
                  const parsed = await simpleParser(buffer);

                  const gmailMessageId =
                    attributes?.envelope?.messageId ||
                    parsed.messageId ||
                    `unknown-${Date.now()}-${seqno}`;

                  const senderEmail =
                    parsed.from?.value?.[0]?.address?.toLowerCase();
                  if (!senderEmail) {
                    console.warn(
                      `[IMAP] Skipping email ${seqno} - no sender found`,
                    );
                    return res(null);
                  }

                  const alreadyProcessed =
                    await isAlreadyProcessed(gmailMessageId);
                  if (alreadyProcessed) {
                    console.log(`[IMAP] Skipping duplicate: ${gmailMessageId}`);
                    return res(null);
                  }

                  const user = await findUserByEmail(senderEmail);
                  if (!user) {
                    console.warn(
                      `[IMAP] No user found for email: ${senderEmail}`,
                    );
                    return res(null);
                  }

                  const body = parsed.text || parsed.html || "";
                  const subject = parsed.subject || "";
                  const receivedAt = parsed.date || new Date();

                  const emailData = {
                    userId: user.id,
                    gmailMessageId,
                    sender: senderEmail,
                    subject,
                    body,
                    receivedAt,
                  };

                  const rawEmailId = await insertRawEmail(emailData);
                  console.log(
                    `[IMAP] Inserted raw_email id: ${rawEmailId} for user: ${senderEmail}`,
                  );

                  // ── Parsing pipeline ──────────────────────────────────────
                  // Primary: custom regex parser (fast, free, no API call)
                  // Fallback: Haiku (only if custom parser returns null)
                  //
                  // NOTE: custom parser receives RAW body — it needs the real
                  // UPI IDs and card digits before PII stripping.
                  // Haiku receives PII-STRIPPED body — never send raw PII to API.
                  // ─────────────────────────────────────────────────────────

                  try {
                    let transactionId = null;

                    // ── Step 1: Try custom parser ─────────────────────────
                    const customResult = await parseEmail(subject, body, receivedAt);

                    if (customResult) {
                      // Custom parser succeeded — insert directly
                      console.log("[IMAP] Custom parser succeeded — inserting transaction.");

                      const paymentSourceId = await matchPaymentSource(user.id, {
                        last4: customResult.last4,
                        upiId: customResult.upiId,
                      });
                      console.log("[IMAP] matched paymentSourceId:", customResult.last4, "for last4:", customResult.last4);
                      const insertResult = await pool.query(
                        `INSERT INTO transactions
                          (user_id, payment_source_id, category_id, sub_category_id,
                           entry_mode, description, amount, transaction_date, status, raw_email_id)
                         VALUES ($1,$2,$3,$4,'email_parsed',$5,$6,$7,'pending',$8)
                         RETURNING id`,
                        [
                          user.id,
                          paymentSourceId,
                          customResult.category_id,
                          customResult.sub_category_id,
                          customResult.description,
                          customResult.amount,
                          customResult.transactionDate,
                          rawEmailId,
                        ],
                      );

                      transactionId = insertResult.rows[0].id;
                      console.log(`[IMAP] Custom parser inserted transaction id: ${transactionId}`);

                    } else {
                      // ── Step 2: Fall back to Haiku ───────────────────────
                      // Custom parser returned null — either preliminary checks
                      // rejected the email (noise/promo) or amount was not found.
                      // Strip PII now before sending to external API.
                      console.log("[IMAP] Custom parser returned null — falling back to Haiku.");

                      const cleanedBody = stripPII(body);
                      transactionId = await parseAndInsert(cleanedBody, user.id, rawEmailId);
                    }

                    // ── Mark raw_email as processed ───────────────────────
                    if (transactionId) {
                      await markProcessed(rawEmailId);
                      console.log(`[IMAP] Transaction inserted and email marked processed.`);
                    } else {
                      await markProcessed(rawEmailId, "No transaction found");
                      console.log(`[IMAP] No transaction extracted — marked with note.`);
                    }

                  } catch (parseErr) {
                    console.error(
                      `[IMAP] Parse/insert failed for raw_email ${rawEmailId}:`,
                      parseErr.message,
                    );
                    await markProcessed(rawEmailId, parseErr.message);
                  }

                  res({ rawEmailId, senderEmail });

                } catch (err) {
                  console.error(
                    `[IMAP] Error processing email ${seqno}:`,
                    err.message,
                  );
                  res(null);
                }
              });
            });

            emailPromises.push(emailPromise);
          });

          fetch.once("error", (err) => {
            console.error("[IMAP] Fetch error:", err);
            reject(err);
          });

          fetch.once("end", async () => {
            const results = await Promise.all(emailPromises);
            const successful = results.filter(Boolean).length;
            console.log(`[IMAP] Done. Processed ${successful} email(s).`);
            imap.end();
            resolve({ fetched: successful });
          });
        });
      });
    });

    imap.once("error", (err) => {
      console.error("[IMAP] Connection error:", err.message);
      reject(err);
    });

    imap.once("end", () => {
      console.log("[IMAP] Connection closed.");
    });

    imap.connect();
  });
}