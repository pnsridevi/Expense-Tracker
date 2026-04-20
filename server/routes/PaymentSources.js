import express from "express";
import pool from "../config/db.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();
//Get payment sources from Payment sources table
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "select * from payment_sources where user_id=$1 and is_active = true order by created_at ASC",
      [req.userId],
    );
    res.json({ sources: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

//post a new payment method for the user in the payment sources table

router.post("/", verifyToken, async (req, res) => {
  const { source_type, provider, last4, upi_id, nickname } = req.body;

  if (!source_type || !provider || !nickname) {
    return res
      .status(400)
      .json({ error: "source_type, provider, nickname are required" });
  }
  if (
    (source_type === "credit_card" || source_type === "debit_card") &&
    !last4
  ) {
    return res.status(400).json({ error: "last4 required for card" });
  }
  if (source_type === "upi" && !upi_id) {
    return res.status(400).json({ error: "upi_id required for UPI" });
  }
  try {
    const result = await pool.query(
      "insert into payment_sources (user_id,source_type,provider,last4,upi_id,nickname) values ($1,$2,$3,$4,$5,$6) returning *",
      [
        req.userId,
        source_type,
        provider,
        last4 || null,
        upi_id || null,
        nickname,
      ],
    );
    res.status(201).json({ source: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

//delete a payment source from the table for the user

router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "delete from payment_sources where id=$1 and user_id=$2 returning *",
      [id, req.userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Source not found" });
    }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
