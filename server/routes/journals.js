// server/routes/journals.js
import express from "express";
import Journal from "../models/journal.js";
import GeneralLedger from "../models/GeneralLedger.js";

const router = express.Router();

/* ---------- LIST ---------- */
router.get("/", async (req, res) => {
  try {
    const { status, headerId, search } = req.query;
    const q = {};
    if (status && status !== "all") q.status = status;
    if (headerId) q.headerId = headerId;

    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      q.$or = [
        { jeNumber: rx }, { reference: rx }, { memo: rx },
        { "participants.preparedBy.name": rx },
        { "participants.approvedBy.name": rx },
        { "participants.postedBy.name": rx },
        { "lines.memo": rx }, { "lines.account": rx },
      ];
    }

    const rows = await Journal.find(q).sort({ date: -1, createdAt: -1 }).lean();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to fetch journal entries" });
  }
});

/* ---------- READ ---------- */
router.get("/:id", async (req, res) => {
  try {
    const doc = await Journal.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to fetch entry" });
  }
});

/* ---------- CREATE ---------- */
router.post("/", async (req, res) => {
  try {
    const data = req.body || {};
    data.status ??= "draft";
    data.participants ??= {};
    data.participants.preparedBy ??= { name: "", at: null };
    data.participants.approvedBy ??= { name: "", at: null };
    data.participants.postedBy   ??= { name: "", at: null };

    const doc = await Journal.create(data);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ error: e.message || "Create failed" });
  }
});

/* ---------- UPDATE (draft only) ---------- */
router.put("/:id", async (req, res) => {
  try {
    const current = await Journal.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Not found" });
    if (current.status !== "draft") {
      return res
        .status(409)
        .json({ error: `Only draft entries can be edited (current: ${current.status}).` });
    }
    Object.assign(current, req.body || {});
    await current.save();
    res.json(current);
  } catch (e) {
    res.status(400).json({ error: e.message || "Update failed" });
  }
});

/* ---------- DELETE (draft only) ---------- */
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Journal.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    if (doc.status !== "draft") {
      return res
        .status(409)
        .json({ error: `Only draft entries can be deleted (current: ${doc.status}).` });
    }
    await doc.deleteOne();
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message || "Delete failed" });
  }
});

/* ---------- APPROVE ---------- */
router.post("/:id/approve", async (req, res) => {
  try {
    const { name = "" } = req.body || {};
    const je = await Journal.findById(req.params.id);
    if (!je) return res.status(404).json({ error: "Not found" });

    if (je.status !== "draft") {
      return res.status(409).json({ error: `Cannot approve ${je.status} entry.` });
    }

    const debit  = je.lines.reduce((s, l) => s + Number(l.debit  || 0), 0);
    const credit = je.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (debit <= 0 || Math.abs(debit - credit) > 0.005) {
      return res.status(400).json({ error: "Entry not balanced." });
    }

    je.status = "approved";
    je.participants.approvedBy = { name, at: new Date() };
    await je.save();

    res.json(je);
  } catch (e) {
    res.status(500).json({ error: e.message || "Approve failed" });
  }
});

/* ---------- POST (explode JE -> GL) ---------- */
router.post("/:id/post", async (req, res) => {
  try {
    const { name = "" } = req.body || {};
    const je = await Journal.findById(req.params.id);
    if (!je) return res.status(404).json({ error: "Not found" });

    if (je.status !== "approved") {
      return res
        .status(409)
        .json({ error: `Only approved entries can be posted (current: ${je.status}).` });
    }

    const lines = Array.isArray(je.lines) ? je.lines : [];
    if (lines.length < 2) {
      return res.status(400).json({ error: "Cannot post — at least 2 lines required." });
    }

    // idempotency: remove prior GL rows for this JE
    await GeneralLedger.deleteMany({ journalId: je._id });

    // explode every JE line into a GL row (debit/credit preserved)
    const glRows = lines.map((l) => ({
      date: je.date,
      reference: je.reference || "",
      jeNumber: je.jeNumber || "",
      journalNo: je.jeNumber || "",        // legacy alias
      account: String(l.account),
      memo: l.memo || je.memo || "",
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      source: "JE",
      journalId: je._id,
      locked: true,
    }));

    // write all GL rows
    const inserted = await GeneralLedger.insertMany(glRows, { ordered: true });

    // flip JE status → posted
    je.status = "posted";
    je.participants.postedBy = { name, at: new Date() };
    await je.save();

    res.json({ journal: je, glCount: inserted.length });
  } catch (e) {
    res.status(500).json({ error: e.message || "Post failed" });
  }
});

export default router;
