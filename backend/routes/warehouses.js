import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM warehouses ORDER BY name").all());
});

const whSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  location: z.string().trim().optional().default(""),
});

router.post("/", validateBody(whSchema), (req, res) => {
  const { name, location } = req.validated;
  const info = db.prepare("INSERT INTO warehouses (name, location) VALUES (?, ?)").run(name, location);
  res.status(201).json({ id: info.lastInsertRowid, name, location });
});

// NOTE: category endpoints moved to routes/categories.js (mounted at /api/categories).

export default router;
