// server/routes/stock_move.js
import express from "express";
import Stock_Move from "../models/Stock_Move.js";

const router = express.Router();

/* ------------ Helpers ------------ */
const ok = (res, data) =>
  res.json(Array.isArray(data) || (data && data.items) ? data : data ?? []);

const bad = (res, msg = "bad_request", code = 400) =>
  res.status(code).json({ ok: false, error: msg });

/* --- ID generators (mirror client/server style) --- */
function pad(n, w = 4) {
  const s = String(n);
  return s.length >= w ? s : "0".repeat(w - s.length) + s;
}
function rand4() { return pad(Math.floor(Math.random() * 10000), 4); }
function yyyymmdd(d = new Date()) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  return `${y}${m}${day}`;
}
function generateItemNo(sku = "", desc = "") {
  const stem =
    (sku || desc || "ITEM")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "ITEM";
  return `ITEM-${stem}-${rand4()}`;
}
function generateMoveNo() {
  return `MOV-${yyyymmdd()}-${rand4()}`;
}

/** Ensure itemNo/moveNo are present on a move payload */
function stampIds(move) {
  if (!move || typeof move !== "object") return move;
  if (!move.itemNo) move.itemNo = generateItemNo(move.itemSku || "", move.desc || move.memo || "");
  if (!move.moveNo) move.moveNo = generateMoveNo();
  return move;
}

/** Coerce numeric fields (qty, unitCost) safely */
function normalizeNumbers(move = {}) {
  const num = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  move.qty = num(move.qty, 0);
  move.unitCost = num(move.unitCost, 0);
  return move;
}

/** Normalize supplier fields so they are always clean & present */
function normalizeSupplier(move = {}) {
  const trim = (s) => String(s || "").trim().replace(/\s+/g, " ");
  const supplierName =
    trim(move.fromName) ||
    trim(move.supplierName) || // from manual form
    "";

  if (supplierName) move.fromName = supplierName;

  // Ensure fromWhCode exists (short code based on name when absent)
  if (!move.fromWhCode || !String(move.fromWhCode).trim()) {
    const code = supplierName ? supplierName.toUpperCase().slice(0, 40) : "";
    if (code) move.fromWhCode = code;
  } else {
    move.fromWhCode = trim(move.fromWhCode);
  }

  if (move.toWhCode) move.toWhCode = trim(move.toWhCode);

  return move;
}

/** Prepare payload before write */
function prepareMove(move) {
  return normalizeNumbers(normalizeSupplier(stampIds({ ...(move || {}) })));
}

/** Basic business validation */
function validateMove(move) {
  if (!move.itemSku && !move.itemNo) return "itemSku_required";
  // At least one side should be provided (issue or receipt)
  if (!move.fromWhCode && !move.toWhCode) return "from_or_to_required";
  // Qty must be a number (can be zero; your UI handles >0 for creation already)
  if (!Number.isFinite(Number(move.qty))) return "qty_invalid";
  return null;
}

/* Build paging + filters */
function buildQuery({ search, status, from, to }) {
  const q = {};
  if (status) q.status = status;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(to);
  }
  if (search) {
    const s = String(search);
    q.$or = [
      { reference:  { $regex: s, $options: "i" } },
      { itemSku:    { $regex: s, $options: "i" } },
      { itemNo:     { $regex: s, $options: "i" } },
      { moveNo:     { $regex: s, $options: "i" } },
      { fromWhCode: { $regex: s, $options: "i" } },
      { fromName:   { $regex: s, $options: "i" } }, // search by supplier name
      { toWhCode:   { $regex: s, $options: "i" } },
      { memo:       { $regex: s, $options: "i" } },
    ];
  }
  return q;
}

/* =========================================================
   LIST — GET /api/stock-moves?search=&status=&from=&to=&page=&limit=
   Returns { items, total, page, limit }
   ========================================================= */
router.get("/", async (req, res, next) => {
  try {
    const { search = "", status, from, to, page = 1, limit = 100 } = req.query;
    const q = buildQuery({ search, status, from, to });

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.min(500, Math.max(1, Number(limit) || 100));
    const skip = (pageNum - 1) * lim;

    const [items, total] = await Promise.all([
      Stock_Move.find(q).sort({ date: -1, createdAt: -1 }).skip(skip).limit(lim),
      Stock_Move.countDocuments(q),
    ]);

    ok(res, {
      items: items.map((d) => {
        const pub = d.toPublic();
        return {
          ...pub,
          // Ensure qty is numeric in API output (defensive)
          qty: Number(pub.qty || 0),
          fromDisplay: pub.fromName || pub.fromWhCode || "",
        };
      }),
      total,
      page: pageNum,
      limit: lim,
    });
  } catch (e) { next(e); }
});

/* READ ONE — GET /api/stock-moves/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await Stock_Move.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    const pub = doc.toPublic();
    res.json({ ...pub, qty: Number(pub.qty || 0), fromDisplay: pub.fromName || pub.fromWhCode || "" });
  } catch (e) { next(e); }
});

/* CREATE — POST /api/stock-moves
   Accepts a single move object or an array of move objects. */
router.post("/", async (req, res, next) => {
  try {
    const payload = req.body ?? {};

    // Bulk create support
    if (Array.isArray(payload)) {
      const prepared = payload.map((p) => prepareMove(p));
      // Validate all before save
      for (const p of prepared) {
        const err = validateMove(p);
        if (err) return bad(res, err, 400);
      }
      const docs = prepared.map((p) =>
        new Stock_Move({
          ...p,
          status: p.status || "draft",
        })
      );
      for (const d of docs) await d.validate();
      await Stock_Move.insertMany(docs);
      return res.status(201).json(docs.map((d) => {
        const pub = d.toPublic();
        return { ...pub, qty: Number(pub.qty || 0), fromDisplay: pub.fromName || pub.fromWhCode || "" };
      }));
    }

    const data = prepareMove(payload);
    const err = validateMove(data);
    if (err) return bad(res, err, 400);

    const d = new Stock_Move({
      ...data,
      status: data.status || "draft",
    });
    await d.validate();
    await d.save();

    const pub = d.toPublic();
    res.status(201).json({ ...pub, qty: Number(pub.qty || 0), fromDisplay: pub.fromName || pub.fromWhCode || "" });
  } catch (e) { next(e); }
});

/* UPDATE — PUT /api/stock-moves/:id
   Auto-stamps missing ids, normalizes supplier & numbers. */
router.put("/:id", async (req, res, next) => {
  try {
    const doc = await Stock_Move.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);

    const updates = prepareMove(req.body || {});
    const err = validateMove({ ...doc.toObject(), ...updates });
    if (err) return bad(res, err, 400);

    doc.set(updates);
    await doc.validate();
    await doc.save();

    const pub = doc.toPublic();
    res.json({ ...pub, qty: Number(pub.qty || 0), fromDisplay: pub.fromName || pub.fromWhCode || "" });
  } catch (e) { next(e); }
});

/* DELETE — DELETE /api/stock-moves/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await Stock_Move.findByIdAndDelete(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* POST (status->posted) — POST /api/stock-moves/:id/post */
router.post("/:id/post", async (req, res, next) => {
  try {
    const doc = await Stock_Move.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);

    const name = (req.body && req.body.postedBy) || "System";

    // Stamp/normalize IDs and supplier before posting
    if (!doc.itemNo) doc.itemNo = generateItemNo(doc.itemSku || "", doc.memo || "");
    if (!doc.moveNo) doc.moveNo = generateMoveNo();

    // Allow late supplier fixes via payload
    if (req.body && (req.body.fromName || req.body.supplierName || req.body.fromWhCode)) {
      normalizeSupplier(Object.assign(doc, {
        fromName: req.body.fromName ?? doc.fromName,
        supplierName: req.body.supplierName ?? undefined,
        fromWhCode: req.body.fromWhCode ?? doc.fromWhCode,
      }));
    }

    // *** Ensure qty/unitCost are numeric at post time ***
    normalizeNumbers(doc);
    if (!Number.isFinite(Number(doc.qty))) doc.qty = 0;

    // Validate essential posting preconditions
    const err = validateMove(doc);
    if (err) return bad(res, err, 400);

    if (doc.status !== "posted") {
      doc.status = "posted";
      doc.participants = doc.participants || {};
      doc.participants.postedBy = { name, at: new Date() };
    }
    await doc.save();

    // Return ok; Items page aggregates posted qty from the moves list
    res.json({ ok: true, id: String(doc._id), qty: Number(doc.qty || 0) });
  } catch (e) { next(e); }
});

export default router;
