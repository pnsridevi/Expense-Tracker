import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const router = express.Router();

//Register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const emailchk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailchk.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be atleast  characters" });
  }

  try {
    const userfound = await pool.query("select * from users where email = $1", [
      email,
    ]);
    if (userfound.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "insert into users(name,email,password_hash) values ($1,$2,$3) returning Id, name, email",
      [name, email, hash],
    );
    const user = result.rows[0];

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "15min",
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

//Login

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Request body:", req.body);

  try {
    const userfound = await pool.query("select * from users where email = $1", [
      email,
    ]);
    if (!userfound.rows.length) {
      return res
        .status(401)
        .json({ error: "Email does not exist. Please register" });
    }

    const user = userfound.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "180min",
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

export default router;
