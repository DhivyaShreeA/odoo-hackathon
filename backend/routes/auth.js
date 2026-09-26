import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import db from "../db.js";
import { validateBody } from "../middleware/validate.js";
import { JWT_SECRET } from "../middleware/auth.js";
import { sendOtpEmail } from "../mailer.js";

const router = Router();

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

router.post("/signup", validateBody(signupSchema), (req, res) => {
  const { name, email, password } = req.validated;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name, email, password_hash);

  const token = jwt.sign({ id: info.lastInsertRowid, email, name }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: { id: info.lastInsertRowid, name, email } });
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

router.post("/login", validateBody(loginSchema), (req, res) => {
  const { email, password } = req.validated;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// --- OTP password reset: the code is actually emailed via SMTP (see mailer.js).
// If real SMTP credentials aren't configured in .env, it falls back to a live
// Ethereal test inbox — still a genuine email send, with a preview link
// returned so you can open the received message. ---
const requestOtpSchema = z.object({ email: z.string().trim().email("Enter a valid email") });

router.post("/forgot-password", validateBody(requestOtpSchema), async (req, res) => {
  const { email } = req.validated;
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) return res.status(404).json({ error: "No account with that email" });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 5 * 60 * 1000; // 5 min
  db.prepare("UPDATE users SET otp = ?, otp_expires_at = ? WHERE id = ?").run(otp, expires, user.id);

  try {
    const { previewUrl, usingEthereal } = await sendOtpEmail(email, otp);
    res.json({
      message: usingEthereal
        ? "OTP sent — no SMTP configured yet, so this is a live test-inbox preview"
        : "OTP sent to your email",
      previewUrl: previewUrl || undefined,
      expiresInSeconds: 300,
    });
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    res.status(500).json({ error: "Could not send the OTP email. Please try again in a moment." });
  }
});

const resetSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

router.post("/reset-password", validateBody(resetSchema), (req, res) => {
  const { email, otp, newPassword } = req.validated;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || user.otp !== otp || Date.now() > user.otp_expires_at) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }
  const password_hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, otp = NULL, otp_expires_at = NULL WHERE id = ?").run(
    password_hash,
    user.id
  );
  res.json({ message: "Password reset successful" });
});

export default router;
