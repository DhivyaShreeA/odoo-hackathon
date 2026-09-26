import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT c.*, COUNT(p.id) AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id
         ORDER BY c.name`
      )
      .all()
  );
});

const catSchema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters") });

router.post("/", validateBody(catSchema), (req, res) => {
  const { name } = req.validated;
  try {
    const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    res.status(201).json({ id: info.lastInsertRowid, name });
  } catch {
    res.status(409).json({ error: "Category already exists" });
  }
});

router.delete("/:id", (req, res) => {
  const inUse = db.prepare("SELECT COUNT(*) c FROM products WHERE category_id = ?").get(req.params.id).c;
  if (inUse > 0) {
    return res.status(409).json({ error: "Category is assigned to products and can't be deleted" });
  }
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ message: "Category deleted" });
});

export default router;
