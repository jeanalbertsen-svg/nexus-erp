// routes/finance.js
// Express router for Finance Documents → GL postings
import express from "express";
import { FinanceDocument, GLEntry } from "../models/Finance.js";

const router = express.Router();

/* ---------- small helpers ---------- */
const safeNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const yyyymmdd = (iso) => String(iso || "").slice(0, 10).replaceAll("-", "");

/** Build GL rows from a FinanceDocument (UI-friendly + locked) */
function toGLEntries(doc) {
  const dateKey = yyyymmdd(doc.date);
  const tail = String(doc._id || "").slice(-3).padStart(3, "0");

  return (doc.lines || []).map((l) => {
    const account = String(l.account || "");
    return {
      date: doc.date,
      account,
      memo: l.memo || doc.memo || "",
      debit: safeNumber(l.debit),
      credit: safeNumber(l.credit),

      // Fields GL UI expects
      reference: doc.reference || `${account}-${dateKey}-${tail}`,
      jeNumber: doc.jeNumber || "",
      journalId: doc._id,
      source: "Finance",
      locked: true,

      // linkage/meta
      sourceId: doc._id,
      sourceType: "FinanceDocument",
      docType: doc.docType,
      docNo: doc.docNo || "",
      counterparty: doc.counterparty || "",
    };
  });
}

/* =========================================================
   GET /api/finance/documents
   Optional query: ?type=Invoice|Purchase%20Invoice  &date=YYYY-MM-DD
   ========================================================= */
router.get("/documents", async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.docType = req.query.type;
    if (req.query.date) filter.date = req.query.date;

    const docs = await FinanceDocument.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Massage for GLDashboard-inspired table rows
    const rows = docs.map((d) => ({
      id: d._id.toString(),
      date: d.date,
      type: d.docType,
      docNo: d.docNo || d.reference || "",
      counterparty: d.counterparty || "",
      amount: (d.lines || []).reduce((s, l) => s + safeNumber(l.debit), 0),
      status: d.status || "draft",
      jeNumber: d.jeNumber || "",
      _raw: {
        date: d.date,
        reference: d.reference,
        memo: d.memo,
        status: d.status,
        lines: d.lines,
        participants: d.participants,
        summary: d.summary,
        jeNumber: d.jeNumber,
      },
    }));

    res.json(rows);
  } catch (err) {
    console.error("GET /documents failed", err);
    res.status(500).json({ error: "Failed to list finance documents" });
  }
});

/* =========================================================
   POST /api/finance
   Body: { date, docType, docNo, counterparty, memo, jeNumberHint, summary, lines, status?, reference?, participants? }
   ========================================================= */
router.post("/", async (req, res) => {
  try {
    const {
      date,
      docType,
      docNo,
      counterparty = "",
      memo = "",
      jeNumberHint = "",
      summary = "",
      lines = [],
      status = "draft",
      reference = "",
      participants = {},
    } = req.body || {};

    if (!date || !docType || !Array.isArray(lines) || lines.length === 0) {
      return res
        .status(400)
        .json({ error: "Missing required fields (date, docType, lines)." });
    }

    if (!FinanceDocument.isBalanced(lines)) {
      return res
        .status(400)
        .json({ error: "Lines are not balanced (debits must equal credits)." });
    }

    const doc = await FinanceDocument.create({
      date,
      docType,
      docNo,
      counterparty,
      memo,
      lines,
      summary,
      status,
      jeNumber: jeNumberHint || "",
      reference,
      participants: {
        preparedBy: participants?.preparedBy || undefined,
        approvedBy: participants?.approvedBy || undefined,
        postedBy: participants?.postedBy || undefined,
      },
      preparedAt:
        participants?.preparedBy?.at || (participants?.preparedBy?.name ? new Date() : null),
    });

    res.status(201).json({ id: doc._id.toString(), ...doc.toObject() });
  } catch (err) {
    console.error("POST /api/finance failed", err);
    res.status(500).json({ error: "Failed to create finance document" });
  }
});

/* =========================================================
   PATCH /api/finance/:id  (edit drafts/approved; not posted)
   ========================================================= */
router.patch("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await FinanceDocument.findById(id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    if (doc.status === "posted") {
      return res.status(400).json({ error: "Cannot edit a posted document." });
    }

    const {
      date,
      docType,
      docNo,
      counterparty = "",
      memo = "",
      summary = "",
      lines = [],
      status,
      reference = "",
      jeNumberHint = "",
      participants = {},
    } = req.body || {};

    if (!FinanceDocument.isBalanced(lines)) {
      return res
        .status(400)
        .json({ error: "Lines are not balanced (debits must equal credits)." });
    }

    Object.assign(doc, {
      date: date ?? doc.date,
      docType: docType ?? doc.docType,
      docNo: docNo ?? doc.docNo,
      counterparty,
      memo,
      summary,
      lines,
      reference,
      jeNumber: jeNumberHint || doc.jeNumber || "",
      status: status || doc.status,
      participants: {
        ...doc.participants,
        preparedBy: participants?.preparedBy ?? doc.participants?.preparedBy,
        approvedBy: participants?.approvedBy ?? doc.participants?.approvedBy,
        postedBy: participants?.postedBy ?? doc.participants?.postedBy,
      },
    });

    await doc.save();
    res.json({ id: doc._id.toString(), ...doc.toObject() });
  } catch (err) {
    console.error("PATCH /api/finance/:id failed", err);
    res.status(500).json({ error: "Failed to update finance document" });
  }
});

/* =========================================================
   POST /api/finance/:id/approve  (idempotent; not after posted)
   ========================================================= */
router.post("/:id/approve", async (req, res) => {
  try {
    const id = req.params.id;
    const { approvedByName = "", approvedAt } = req.body || {};
    const doc = await FinanceDocument.findById(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    if (doc.status === "posted") {
      return res.json({ id: doc._id.toString(), status: doc.status });
    }

    doc.status = "approved";
    doc.participants = doc.participants || {};
    doc.participants.approvedBy = {
      ...(doc.participants.approvedBy || {}),
      name: approvedByName || doc.participants?.approvedBy?.name || "",
      at: approvedAt ? new Date(approvedAt) : new Date(),
    };
    doc.approvedAt = doc.participants.approvedBy.at;

    await doc.save();
    res.json({ id: doc._id.toString(), status: doc.status });
  } catch (err) {
    console.error("POST /:id/approve failed", err);
    res.status(500).json({ error: "Failed to approve document" });
  }
});

/* =========================================================
   POST /api/finance/:id/post
   - Validates balance
   - Writes GL entries (locked)
   - Marks status=posted (idempotent for already posted)
   ========================================================= */
router.post("/:id/post", async (req, res) => {
  const session = await FinanceDocument.startSession();
  session.startTransaction();
  try {
    const id = req.params.id;
    const { postedByName = "", postedAt } = req.body || {};

    const doc = await FinanceDocument.findById(id).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Not found" });
    }

    if (!FinanceDocument.isBalanced(doc.lines)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Lines are not balanced (debits must equal credits)." });
    }

    if (doc.status === "posted") {
      await session.commitTransaction();
      session.endSession();
      return res.json({ id: doc._id.toString(), status: doc.status });
    }

    const glRows = toGLEntries(doc);
    if (!glRows.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "No lines to post to GL." });
    }

    await GLEntry.insertMany(glRows, { session });

    // mark posted
    doc.status = "posted";
    doc.participants = doc.participants || {};
    doc.participants.postedBy = {
      ...(doc.participants.postedBy || {}),
      name: postedByName || doc.participants?.postedBy?.name || "",
      at: postedAt ? new Date(postedAt) : new Date(),
    };
    doc.postedAt = doc.participants.postedBy.at;

    await doc.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ id: doc._id.toString(), status: doc.status, glRows: glRows.length });
  } catch (err) {
    console.error("POST /:id/post failed", err);
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    res.status(500).json({ error: "Failed to post document to GL" });
  }
});

/* =========================================================
   DELETE /api/finance/:id
   - If posted, also removes related GL rows
   ========================================================= */
router.delete("/:id", async (req, res) => {
  const session = await FinanceDocument.startSession();
  session.startTransaction();
  try {
    const id = req.params.id;
    const doc = await FinanceDocument.findById(id).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Not found" });
    }

    await GLEntry.deleteMany({ sourceId: doc._id }).session(session);
    await doc.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /:id failed", err);
    try {
      await session.abortTransaction();
      session.endSession();
    } catch {}
    res.status(500).json({ error: "Failed to delete document" });
  }
});

/* =========================================================
   (Optional) GET /api/finance/gl  — debug browser
   Query: date? account? sourceId?
   ========================================================= */
router.get("/gl", async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.account) filter.account = req.query.account;
    if (req.query.sourceId) filter.sourceId = req.query.sourceId;

    const rows = await GLEntry.find(filter).sort({ createdAt: -1 }).lean();
    res.json(rows);
  } catch (err) {
    console.error("GET /gl failed", err);
    res.status(500).json({ error: "Failed to list GL entries" });
  }
});

export default router;
