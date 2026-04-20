import express from "express";
import { fetchEmails } from "../services/imapService.js";
import verifyToken from "../middleware/auth.js";
import pool from "../config/db.js";

const router = express.Router();

// Manual trigger — POST /api/emails/fetch
router.post("/fetch", verifyToken, async (req, res) => {
  try {
    const result = await fetchEmails();
    res.json({
      success: true,
      message: `Fetched ${result.fetched} new email(s).`,
    });
  } catch (err) {
    console.error("[Route] Email fetch error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch emails.",
      error: err.message,
    });
  }
});

// List failed emails — GET /api/emails/failed
router.get("/failed", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, sender, subject, received_at, error_note 
             FROM raw_emails 
             WHERE user_id = $1 AND processed = false
             ORDER BY received_at DESC`,
      [req.user.id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch failed emails." });
  }
});

export default router;
