// server/routes/purchaseInvoices.js
import express from "express";
import { StockMove } from "../models/Inventory.js";         // create moves so Inventory pages have rows now
import PurchaseInvoice from "../models/PurchaseInvoice.js"
const router = express.Router();

/* --------------------------- helpers --------------------------- */

// Try to pull a SKU out of a line.
// Priority: line.sku (if you later add it) -> first token of description like ABC-001.
function pickSkuFromLine(l = {}) {
  if (l.sku && String(l.sku).trim()) return String(l.sku).trim();
  const s = String(l.description || "");
  const token = s.split(/\s+/)[0];
  // allow letters/numbers/dash/underscore (adjust as you need)
  return /^[A-Za-z0-9._-]{3,}$/.test(token) ? token : "";
}

function lineNet(l) {
  const qty = +l.qty || 0;
  const price = +l.unitPrice || 0;
  const disc = (+l.discountPct || 0) / 100;
  return Math.max(0, qty * price * (1 - disc));
}

function glFromPurchaseInvoiceServer(doc) {
  const rows = [];
  const invDirectives = []; // collected for server-side StockMove creation

  const dateISO = new Date(doc.date).toISOString().slice(0, 10);
  const ref = doc.referenceNo || doc.billNo || "";
  const je = doc.jeDisplay || "";
  const apAccount = String(doc.apAccount || doc._apAccount || "2000");
  const inputVat = String(doc.inputVatAccount || doc._inputVatAccount || "1300");

  let subtotal = 0, taxTotal = 0;

  for (const l of doc.lines || []) {
    const net = lineNet(l);
    const t = (+l.taxPct || 0) / 100;
    const tax = net * t;

    if (net > 0 && l.account) {
      // 🔹 Append INV directive to the memo so the client auto-sync can also post
      const sku = pickSkuFromLine(l);
      const wh = l.warehouseCode || "MAIN";
      const unitCost = (+l.unitPrice || 0);

      const baseMemo = l.description || doc.memo || "";
      const invKV = sku
        ? ` INV: sku=${sku}; qty=${+l.qty || 1}; dir=in; wh=${wh}; cost=${unitCost}`
        : ""; // if we couldn't infer a SKU, skip it

      rows.push({
        date: dateISO,
        account: String(l.account),
        memo: `${baseMemo}${invKV}`.trim(),
        debit: +net,
        credit: 0,
        reference: ref,
        jeNumber: je,
        source: "AP",
        locked: true,
      });

      if (sku) {
        invDirectives.push({
          date: dateISO,
          reference: ref,
          itemSku: sku,
          qty: +l.qty || 1,
          uom: (l.uom || "pcs"),
          unitCost,
          toWhCode: wh,
          memo: baseMemo || `Auto from PI ${ref}`,
        });
      }

      subtotal += net;
      taxTotal += tax;
    }
  }

  if (taxTotal > 0) {
    rows.push({
      date: dateISO,
      account: inputVat,
      memo: "Input tax / VAT",
      debit: +taxTotal,
      credit: 0,
      reference: ref,
      jeNumber: je,
      source: "AP",
      locked: true,
    });
  }

  const gross = subtotal + taxTotal;
  if (gross > 0) {
    rows.push({
      date: dateISO,
      account: apAccount,
      memo: `AP — ${doc.vendor || ""}`,
      debit: 0,
      credit: +gross,
      reference: ref,
      jeNumber: je,
      source: "AP",
      locked: true,
    });
  }

  return { rows, invDirectives };
}

// Generate a simple move number MOVE-YYYYMMDD-#### per invoice/ref (in-memory seq)
const seqCache = new Map();
function nextSeq(key, dateISO) {
  const d = (dateISO || "").replace(/-/g, "");
  const k = `${key}:${d}`;
  const n = (seqCache.get(k) || 0) + 1;
  seqCache.set(k, n);
  return `MOVE-${d}-${String(n).padStart(4, "0")}`;
}

// Idempotency key for moves created from an invoice line
function moveKeyFrom(invId, ref, itemSku, qty, toWhCode) {
  return [String(invId), ref || "", itemSku || "", String(qty || 0), toWhCode || ""].join("|");
}

/* --------- LIST (with basic paging & filters) --------- */
// GET /api/purchasing/invoices?search=&status=&from=&to=&page=1&limit=20
router.get("/", async (req, res, next) => {
  try {
    const {
      search = "",
      status,
      from,
      to,
      page = 1,
      limit = 50,
    } = req.query;

    const q = { type: "Purchase" };
    if (status) q.status = status;

    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to) q.date.$lte = new Date(to);
    }

    if (search) {
      const s = String(search);
      q.$or = [
        { billNo: { $regex: s, $options: "i" } },
        { referenceNo: { $regex: s, $options: "i" } },
        { vendor: { $regex: s, $options: "i" } },
        { memo: { $regex: s, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.min(250, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * lim;

    const [items, total] = await Promise.all([
      PurchaseInvoice.find(q).sort({ date: -1, createdAt: -1 }).skip(skip).limit(lim),
      PurchaseInvoice.countDocuments(q),
    ]);

    res.json({
      items: items.map((d) => d.toPublic()),
      total,
      page: pageNum,
      limit: lim,
    });
  } catch (err) {
    next(err);
  }
});

/* --------- CREATE --------- */
router.post("/", async (req, res, next) => {
  try {
    const payload = req.body || {};
    const inv = new PurchaseInvoice({
      type: "Purchase",
      date: payload.date,
      currency: payload.currency || "DKK",
      billNo: payload.billNo,
      referenceNo: payload.referenceNo || payload.reference,
      jeDisplay: payload.jeDisplay || "",
      vendor: payload.vendor || payload.party,
      vendorRef: payload.vendorRef || "",
      apAccount: payload.apAccount || "2000",
      inputVatAccount: payload.inputVatAccount || "1300",
      status: payload.status || "draft",
      memo: payload.memo || payload.headerMemo || "",
      lines: Array.isArray(payload.lines) ? payload.lines : [],
    });
    await inv.validate();
    await inv.save();
    res.status(201).json({ ok: true, bill: inv.toPublic() });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.billNo) {
      return res.status(400).json({ ok: false, error: "duplicate_bill_no" });
    }
    next(err);
  }
});

/* --------- READ ONE --------- */
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await PurchaseInvoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
    res.json(doc.toPublic());
  } catch (err) {
    next(err);
  }
});

/* --------- UPDATE --------- */
router.put("/:id", async (req, res, next) => {
  try {
    const payload = req.body || {};
    const doc = await PurchaseInvoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });

    doc.set({
      date: payload.date ?? doc.date,
      currency: payload.currency ?? doc.currency,
      billNo: payload.billNo ?? doc.billNo,
      referenceNo: payload.referenceNo ?? payload.reference ?? doc.referenceNo,
      jeDisplay: payload.jeDisplay ?? doc.jeDisplay,
      vendor: payload.vendor ?? payload.party ?? doc.vendor,
      vendorRef: payload.vendorRef ?? doc.vendorRef,
      apAccount: payload.apAccount ?? doc.apAccount,
      inputVatAccount: payload.inputVatAccount ?? doc.inputVatAccount,
      status: payload.status ?? doc.status,
      memo: payload.memo ?? payload.headerMemo ?? doc.memo,
      lines: Array.isArray(payload.lines) ? payload.lines : doc.lines,
    });

    await doc.validate();
    await doc.save();
    res.json({ ok: true, bill: doc.toPublic() });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.billNo) {
      return res.status(400).json({ ok: false, error: "duplicate_bill_no" });
    }
    next(err);
  }
});

/* --------- DELETE --------- */
router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await PurchaseInvoice.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* --------- POST (GL rows + Inventory StockMoves) --------- */
router.post("/:id/post", async (req, res, next) => {
  try {
    const doc = await PurchaseInvoice.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });

    const { rows, invDirectives } = glFromPurchaseInvoiceServer({
      ...doc.toObject(),
      _apAccount: doc.apAccount,
      _inputVatAccount: doc.inputVatAccount,
    });

    // 🔸 Create StockMove per INV directive (idempotent on (invoiceId, ref, sku, qty, toWh))
    for (const d of invDirectives) {
      const key = moveKeyFrom(doc._id, d.reference, d.itemSku, d.qty, d.toWhCode);
      // Try to find existing posted move for the same invoice/line combo
      const exists = await StockMove.findOne({
        reference: d.reference,
        itemSku: d.itemSku,
        qty: d.qty,
        toWhCode: d.toWhCode,
        status: "posted",
      }).lean();

      if (exists) continue;

      const move = new StockMove({
        moveNo: nextSeq(doc.billNo || doc._id, d.date),
        date: d.date,
        reference: d.reference,
        memo: d.memo,
        itemSku: d.itemSku,
        qty: d.qty,
        uom: d.uom || "pcs",
        unitCost: d.unitCost || 0,
        toWhCode: d.toWhCode || "MAIN",
        status: "posted", // directly posted for purchases
        participants: {
          preparedBy: { name: "Purchasing", at: new Date() },
          postedBy:   { name: "Purchasing", at: new Date() },
        },
        links: { sourceDocs: [String(doc.billNo || doc._id)] },
      });

      await move.validate();
      await move.save();
    }

    // Mark PI as posted
    if (doc.status !== "posted") {
      doc.status = "posted";
      await doc.save();
    }

    // Return GL rows with INV memos (client can also ingest these if needed)
    res.json({ ok: true, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
