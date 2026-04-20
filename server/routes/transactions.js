import express from "express";
import pool from "../config/db.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

//GET all categories

router.get("/categories", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "select * from categories order by type, name asc",
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error - GET categories" });
  }
});

//GET subcategories by categories id

router.get("/categories/:id/subcategories", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `select * from sub_categories where category_id = $1 order by name asc`,
      [id],
    );
    res.json({ subcategories: result.rows });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error - GET subcategories" });
  }
});

// POST a new transaction (manual + email parsed)

router.post("/", verifyToken, async (req, res) => {
  const {
    payment_source_id,
    category_id,
    sub_category_id,
    description,
    amount,
    transaction_date,
    entry_mode,
    // raw_email_id
  } = req.body;

  if (!category_id || !amount || !transaction_date || !entry_mode) {
    return res.status(400).json({
      error: "category_id, amount, transaction_date, entry_mode are required",
    });
  }
  try {
    const resolvedStatus = entry_mode === "manual" ? "approved" : "pending";
    const result = await pool.query(
      `INSERT INTO TRANSACTIONS 
        (user_id, payment_source_id, category_id, sub_category_id, entry_mode, description, amount, transaction_date, status)
        values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9) RETURNING *`,
      [
        req.userId,
        payment_source_id || null,
        category_id,
        sub_category_id || null,
        entry_mode,
        description || null,
        amount,
        transaction_date,
        resolvedStatus,
        //raw_email_id || null
        // 1. Add raw_email_id to INSERT columns
        // 2. Add $10 to VALUES
      ],
    );
    res.status(201).json({ transaction: result.rows[0] });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error - POST transaction" });
  }
});
//GET all transactions for the user

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
  t.id, 
  t.amount, 
  TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date, 
  t.description, 
  t.status, 
  t.entry_mode,
  t.category_id,         
  t.sub_category_id,     
  t.payment_source_id,   
  c.name as category, 
  c.type as type,
  sc.name as sub_category,
  ps.nickname as payment_source 
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
  LEFT JOIN payment_sources ps ON t.payment_source_id = ps.id
  WHERE t.user_id = $1 AND t.status='approved'
  ORDER BY t.transaction_date DESC`,
      [req.userId],
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error - fetch all transactions" });
  }
});
// Get all pending transactions 

router.get("/pending", verifyToken, async(req,res) => {
  try {
    const result = await pool.query( 
     `SELECT 
        t.id, 
        t.amount, 
        TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date, 
        t.description, 
        t.status, 
        t.entry_mode,
        t.category_id,         
        t.sub_category_id,     
        t.payment_source_id,   
        c.name as category, 
        c.type as type,
        sc.name as sub_category,
        ps.nickname as payment_source 
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
      LEFT JOIN payment_sources ps ON t.payment_source_id = ps.id
      WHERE t.user_id = $1 AND t.status = 'pending'
      ORDER BY t.created_at DESC`,
      [req.userId]
     );
      res.json({ transactions: result.rows });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error - GET pending transactions" });
  }
});

// PUT - Edit a transaction

router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    payment_source_id,
    category_id,
    sub_category_id,
    description,
    amount,
    transaction_date,
  } = req.body;

  if (!category_id || !amount || !transaction_date) {
    return res
      .status(400)
      .json({ error: "category_id, amount, transaction_date are required" });
  }

  try {
    const result = await pool.query(
      `UPDATE transactions SET payment_source_id = $1,
        category_id = $2, sub_category_id = $3, description =$4, 
        amount = $5, transaction_date = $6::date WHERE id = $7 and user_id = $8 RETURNING *`,
      [
        payment_source_id || null,
        category_id,
        sub_category_id || null,
        description || null,
        amount,
        transaction_date,
        id,
        req.userId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Transaction not found" });
    }
    res.json({ transaction: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error - PUT transaction" });
  }
});

//Approve a pending transaction. 
router.patch("/:id/approve", verifyToken, async(req,res) => {
  const {id} = req.params;
  const {
    category_id, 
    sub_category_id,
    description,
    amount,
    transaction_date,
  } = req.body;

  try {
    const current = await pool.query(
      `SELECT * FROM transactions WHERE id = $1 and user_id = $2`, [id, req.userId]
    );
    if(current.rows.length === 0){
      return res.status(404).json({ error: "Transaction not found" });
    }
    const t = current.rows[0];

    const result = await pool.query(
       `UPDATE transactions SET
        status           = 'approved',
        category_id      = $1,
        sub_category_id  = $2,
        description      = $3,
        amount           = $4,
        transaction_date = $5::date
      WHERE id = $6 AND user_id = $7
      RETURNING *`,
      [
        category_id      || t.category_id,
        sub_category_id  !== undefined ? (sub_category_id || null) : t.sub_category_id,
        description      || t.description,
        amount           || t.amount,
        transaction_date || t.transaction_date,
        id,
        req.userId,
      ]
    );
     res.json({ transaction: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error - approve transaction" });
  }
});

// Patch - reject a transaction

router.patch("/:id/reject", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE transactions SET status = 'rejected'
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json({ transaction: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error - reject transaction" });
  }
});

//DELETE a transaction

router.delete(`/:id`, verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM transactions where id=$1 and user_id=$2 RETURNING *`,
      [id, req.userId],
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Transaction not found" });
    }
    res.json({ message: "Transaction deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error - DELETE transaction" });
  }
});

export default router;
