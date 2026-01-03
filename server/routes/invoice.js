// routes/invoice.js
import express from "express";
import Invoice from "../models/Invoice.js";

const router = express.Router();

// ---- Utility: YYYY-MM-DD -> "YYYYMMDD"
const yyyymmdd = (dStr) => String(dStr).slice(0, 10).replaceAll("-", "");

// ---- Build GL rows from a SALES invoice (same logic as your FE)
function glFromSalesInvoice(inv) {
  const rows = [];
  const day = yyyymmdd(inv.date);
  const ref = inv.referenceNo || inv.invoiceNo || `INV-${day}`;
  const display = inv.jeDisplay || `AR-${day}-0001`;

  let sub = 0;
  let tax = 0;

  for (const l of inv.lines || []) {
    const qty = +l.qty || 0;
    const price = +l.unitPrice || 0;
    const disc = (+l.discountPct || 0) / 100;
    const t = (+l.taxPct || 0) / 100;

    const net = Math.max(0, qty * price * (1 - disc));
    const lineTax = net * t;

    if (net > 0 && l.account) {
      rows.push({
        date: inv.date,
        account: String(l.account), // revenue
        memo: l.description || inv.memo || "",
        debit: 0,
        credit: +net,
        reference: ref,
        jeNumber: display,
        source: "AR",
        locked: true,
      });
      sub += net;
      tax += lineTax;
    }
  }

  if (tax > 0) {
    rows.push({
      date: inv.date,
      account: String(inv.taxAccount || "2300"),
      memo: "Sales tax / VAT",
      debit: 0,
      credit: +tax,
      reference: ref,
      jeNumber: display,
      source: "AR",
      locked: true,
    });
  }

  const gross = sub + tax;
  if (gross > 0) {
    rows.push({
      date: inv.date,
      account: String(inv.arAccount || "1200"),
      memo: `AR — ${inv.customer || ""}`,
      debit: +gross,
      credit: 0,
      reference: ref,
      jeNumber: display,
      source: "AR",
      locked: true,
    });
  }

  return rows;
}

/**
 * OPTIONAL: inject a GL service capable of persisting rows.
 * Replace this stub with your actual integration (e.g., db insert or HTTP call).
 */
async function createGLEntries(rows) {
  // TODO: wire to your GL persistence layer.
  // For now just log:
  console.log("[GL] Posting rows:", rows.length);
}

// ---------------------------- ROUTES ----------------------------

// GET /api/invoices?search=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=50
router.get("/", async (req, res, next) => {
  try {
    const { search = "", status, from, to, page = 1, limit = 50 } = req.query;

    const q = {};
    if (status) q.status = status;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to) q.date.$lte = new Date(to);
    }
    if (search) {
      q.$text = { $search: String(search) };
    }

    // Fallback search if no text index
    const find = search
      ? {
          ...q,
          $or: [
            { invoiceNo: new RegExp(search, "i") },
            { referenceNo: new RegExp(search, "i") },
            { jeDisplay: new RegExp(search, "i") },
            { customer: new RegExp(search, "i") },
            { memo: new RegExp(search, "i") },
          ],
        }
      : q;

    const docs = await Invoice.find(find)
      .sort({ date: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Invoice.countDocuments(find);

    res.json({
      data: docs.map((d) => d.toPublic()),
      page: Number(page),
      limit: Number(limit),
      total,
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/invoices/:id
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc.toPublic());
  } catch (e) {
    next(e);
  }
});

// POST /api/invoices  (create)
router.post("/", async (req, res, next) => {
  try {
    const payload = req.body || {};
    const created = await Invoice.create(payload);
    res.status(201).json(created.toPublic());
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: "invoiceNo already exists" });
    }
    next(e);
  }
});

// PUT /api/invoices/:id  (update)
router.put("/:id", async (req, res, next) => {
  try {
    const payload = req.body || {};
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    // Only allow edits if not posted (typical rule — adjust as you wish)
    if (doc.status === "posted") {
      return res.status(400).json({ error: "Cannot edit a posted invoice" });
    }

    Object.assign(doc, payload);
    await doc.save();
    res.json(doc.toPublic());
  } catch (e) {
    next(e);
  }
});

// DELETE /api/invoices/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    // Optional policy: prevent delete if posted
    if (doc.status === "posted") {
      return res.status(400).json({ error: "Cannot delete a posted invoice (void instead)" });
    }
    await doc.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/invoices/:id/post  (mark as posted + create GL rows)
router.post("/:id/post", async (req, res, next) => {
  try {
    const doc = await Invoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    if (doc.status === "posted") return res.json(doc.toPublic());

    // Build & persist GL
    const glRows = glFromSalesInvoice(doc);
    if (!glRows.length) return res.status(400).json({ error: "No GL rows to post" });

    await createGLEntries(glRows);

    doc.status = "posted";
    await doc.save();

    res.json({ invoice: doc.toPublic(), glRowsPosted: glRows.length });
  } catch (e) {
    next(e);
  }
});

export default router;
