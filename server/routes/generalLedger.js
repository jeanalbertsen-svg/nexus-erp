// server/routes/generalLedger.js
import { Router } from "express";
import GeneralLedger from "../models/GeneralLedger.js"; // ✅ exact case

const router = Router();

// GET /api/gl
router.get("/", async (req, res) => {
  const { start, end, q, sort } = req.query;
  const filter = {};
  if (start) filter.date = { ...(filter.date || {}), $gte: new Date(start) };
  if (end)   filter.date = { ...(filter.date || {}), $lte: new Date(end) };
  if (q) {
    filter.$or = [
      { account: { $regex: q, $options: "i" } },
      { memo: { $regex: q, $options: "i" } },
    ];
  }

  const sortObj =
    sort === "date-desc" ? { date: -1 } :
    sort === "amount-desc" ? { debit: -1, credit: -1 } :
    { date: 1 };

  const rows = await GeneralLedger.find(filter).sort(sortObj).lean();
  res.json(rows);
});

// POST /api/gl
router.post("/", async (req, res) => {
  const doc = await GeneralLedger.create(req.body);
  res.status(201).json(doc);
});

// PUT /api/gl/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const doc = await GeneralLedger.findByIdAndUpdate(id, req.body, { new: true });
  res.json(doc);
});

// DELETE /api/gl/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await GeneralLedger.findByIdAndDelete(id);
  res.status(204).end();
});

export default router;
