// server/routes/inventory.js
import express from "express";
import { Item, Warehouse, StockMove, Adjustment } from "../models/Inventory.js";

const router = express.Router();

/* ------------ Small utils ------------ */
const ok = (res, data) => res.json(data);
const bad = (res, msg = "bad_request", code = 400) =>
  res.status(code).json({ ok: false, error: msg });

function parsePager(req, { maxLimit = 250, defLimit = 50 } = {}) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number(req.query.limit) || defLimit)
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildDateFilter(from, to, field = "date") {
  if (!from && !to) return {};
  const f = {};
  if (from) f.$gte = new Date(from);
  if (to) f.$lte = new Date(to);
  return { [field]: f };
}

function toPager({ items = [], total = 0, page = 1, limit = 50 }) {
  return { items, total, page, limit };
}

/* Small helpers for adjustments created from stock moves */
function inferDirectionFromMove(move) {
  const hasTo = !!(move.toWhCode || move.toWhId);
  const hasFrom = !!(move.fromWhCode || move.fromWhId);

  if (hasTo && !hasFrom) return "increase"; // pure receipt
  if (hasFrom && !hasTo) return "decrease"; // pure issue
  // transfer: treat as increase in destination by convention
  if (hasTo) return "increase";
  if (hasFrom) return "decrease";
  return "adjust";
}

function buildAdjNoFromMove(move) {
  if (!move?.moveNo) return "";
  // MOVE-20251124-0001 → ADJ-20251124-0001
  return String(move.moveNo).replace(/^MOV/i, "ADJ");
}

/* =========================================================
   ITEMS
   GET /api/inventory/items?search=&page=&limit=
   ========================================================= */
router.get("/items", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePager(req);
    const s = String(req.query.search || "").trim();
    const q = {};
    if (s) {
      q.$or = [
        { sku: { $regex: s, $options: "i" } },
        { name: { $regex: s, $options: "i" } },
        { description: { $regex: s, $options: "i" } },
        { categories: { $elemMatch: { $regex: s, $options: "i" } } },
      ];
    }

    const [items, total] = await Promise.all([
      Item.find(q)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Item.countDocuments(q),
    ]);

    ok(res, toPager({ items, total, page, limit }));
  } catch (e) {
    next(e);
  }
});

router.get("/items/:id", async (req, res, next) => {
  try {
    const doc = await Item.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

router.post("/items", async (req, res, next) => {
  try {
    const d = new Item(req.body || {});
    await d.validate();
    await d.save();
    res.status(201).json(d);
  } catch (e) {
    next(e);
  }
});

router.put("/items/:id", async (req, res, next) => {
  try {
    const doc = await Item.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    doc.set(req.body || {});
    await doc.validate();
    await doc.save();
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

router.delete("/items/:id", async (req, res, next) => {
  try {
    const doc = await Item.findByIdAndDelete(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   STOCK MOVES
   GET /api/inventory/stock-moves?search=&status=&from=&to=&page=&limit=
   ========================================================= */
router.get("/stock-moves", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePager(req);
    const s = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const { from, to } = req.query;

    const q = {
      ...(status ? { status } : {}),
      ...buildDateFilter(from, to, "date"),
    };

    if (s) {
      q.$or = [
        { moveNo: { $regex: s, $options: "i" } },
        { reference: { $regex: s, $options: "i" } },
        { memo: { $regex: s, $options: "i" } },
        { itemSku: { $regex: s, $options: "i" } },
        { fromWhCode: { $regex: s, $options: "i" } },
        { toWhCode: { $regex: s, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      StockMove.find(q)
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockMove.countDocuments(q),
    ]);

    ok(res, toPager({ items, total, page, limit }));
  } catch (e) {
    next(e);
  }
});

router.get("/stock-moves/:id", async (req, res, next) => {
  try {
    const doc = await StockMove.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

router.post("/stock-moves", async (req, res, next) => {
  try {
    const payload = req.body || {};
    const d = new StockMove({
      ...payload,
      // UI may send 'approved' – model only allows draft/posted/cancelled
      status: payload.status === "posted" ? "posted" : "draft",
    });
    await d.validate();
    await d.save();
    res.status(201).json(d);
  } catch (e) {
    next(e);
  }
});

router.put("/stock-moves/:id", async (req, res, next) => {
  try {
    const doc = await StockMove.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    const patch = { ...(req.body || {}) };
    if (
      patch.status &&
      !["draft", "posted", "cancelled"].includes(patch.status)
    )
      delete patch.status;
    doc.set(patch);
    await doc.validate();
    await doc.save();
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

router.delete("/stock-moves/:id", async (req, res, next) => {
  try {
    const doc = await StockMove.findByIdAndDelete(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

// POST (status->posted) + auto Adjustment sync
router.post("/stock-moves/:id/post", async (req, res, next) => {
  try {
    const doc = await StockMove.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);

    const postedByName = (req.body && req.body.postedBy) || "System";

    // 1) Post the move itself
    if (doc.status !== "posted") {
      doc.status = "posted";
      doc.participants = doc.participants || {};
      doc.participants.postedBy = { name: postedByName, at: new Date() };
      await doc.save();
    }

    // 2) Create / update corresponding Adjustment (mirror)
    const qty = Number(doc.qty || 0);
    if (Number.isFinite(qty) && qty !== 0 && doc.itemSku) {
      const direction = inferDirectionFromMove(doc);
      const baseQty = Math.abs(qty);
      const warehouseCode =
        doc.toWhCode || doc.fromWhCode || doc.warehouseCode || "";

      // signed qtyDelta: negative for decrease
      const qtyDelta =
        direction === "decrease" ? -Math.abs(baseQty) : Math.abs(baseQty);

      const refKey = doc.moveNo || doc.reference || String(doc._id);

      // try to find existing adjustment linked to this move (by reference)
      let adj = await Adjustment.findOne({ reference: refKey });

      if (!adj) {
        adj = new Adjustment({
          date: doc.date || new Date(),
          adjNo: buildAdjNoFromMove(doc),
          reference: refKey,
          itemId: doc.itemId || undefined,
          itemSku: doc.itemSku,
          warehouseCode,
          whCode: warehouseCode, // mirror, helpful for UI filters
          qtyDelta,
          uom: doc.uom || "pcs",
          unitCost: doc.unitCost || 0,
          direction,
          memo: doc.memo || "",
          reason: `Auto from Stock Move ${doc.moveNo || ""}`,
          status: "posted",
          participants: {
            preparedBy: doc.participants?.preparedBy || undefined,
            approvedBy: doc.participants?.approvedBy || undefined,
            postedBy: { name: postedByName, at: new Date() },
          },
        });
      } else {
        // update existing if move changes and is re-posted
        adj.date = doc.date || adj.date;
        adj.itemId = doc.itemId || adj.itemId;
        adj.itemSku = doc.itemSku;
        adj.warehouseCode = warehouseCode;
        adj.whCode = warehouseCode;
        adj.qtyDelta = qtyDelta;
        adj.uom = doc.uom || adj.uom || "pcs";
        adj.unitCost = doc.unitCost || adj.unitCost || 0;
        adj.direction = direction;
        adj.memo = doc.memo || adj.memo;
        adj.reason =
          adj.reason || `Auto from Stock Move ${doc.moveNo || ""}`;
        adj.status = "posted";
        adj.participants = adj.participants || {};
        adj.participants.postedBy = {
          name: postedByName,
          at: new Date(),
        };
      }

      await adj.validate();
      await adj.save();
    }

    ok(res, { ok: true, id: doc._id });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   ADJUSTMENTS
   GET /api/inventory/adjustments?search=&status=&from=&to=&page=&limit=
   ========================================================= */
router.get("/adjustments", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePager(req);
    const s = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const { from, to } = req.query;

    const q = {
      ...(status ? { status } : {}),
      ...buildDateFilter(from, to, "date"),
    };

    if (s) {
      q.$or = [
        { adjNo: { $regex: s, $options: "i" } },
        { reference: { $regex: s, $options: "i" } },
        { memo: { $regex: s, $options: "i" } },
        { reason: { $regex: s, $options: "i" } },
        { itemSku: { $regex: s, $options: "i" } },
        { warehouseCode: { $regex: s, $options: "i" } },
        { whCode: { $regex: s, $options: "i" } }, // support both field names
      ];
    }

    const [items, total] = await Promise.all([
      Adjustment.find(q)
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Adjustment.countDocuments(q),
    ]);

    ok(res, toPager({ items, total, page, limit }));
  } catch (e) {
    next(e);
  }
});

router.get("/adjustments/:id", async (req, res, next) => {
  try {
    const doc = await Adjustment.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

router.post("/adjustments", async (req, res, next) => {
  try {
    const payload = req.body || {};
    // allow UI to send qty instead of qtyDelta
    const patched = {
      ...payload,
    };
    if (
      patched.qtyDelta == null &&
      typeof patched.qty !== "undefined"
    ) {
      patched.qtyDelta = Number(patched.qty) || 0;
    }
    const d = new Adjustment({
      ...patched,
      status: patched.status === "posted" ? "posted" : "draft",
    });
    await d.validate();
    await d.save();
    res.status(201).json(d);
  } catch (e) {
    next(e);
  }
});

router.put("/adjustments/:id", async (req, res, next) => {
  try {
    const doc = await Adjustment.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    const patch = { ...(req.body || {}) };
    if (
      patch.status &&
      !["draft", "posted", "cancelled"].includes(patch.status)
    )
      delete patch.status;

    if (
      patch.qtyDelta == null &&
      typeof patch.qty !== "undefined"
    ) {
      patch.qtyDelta = Number(patch.qty) || 0;
    }

    doc.set(patch);
    await doc.validate();
    await doc.save();
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

// POST (status->posted)
router.post("/adjustments/:id/post", async (req, res, next) => {
  try {
    const doc = await Adjustment.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    const name = (req.body && req.body.postedBy) || "System";
    if (doc.status !== "posted") {
      doc.status = "posted";
      doc.participants = doc.participants || {};
      doc.participants.postedBy = { name, at: new Date() };
      await doc.save();
    }
    ok(res, { ok: true, id: doc._id });
  } catch (e) {
    next(e);
  }
});

/* =========================================================
   WAREHOUSES
   GET /api/inventory/warehouses?search=&page=&limit=
   ========================================================= */
router.get("/warehouses", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePager(req);
    const s = String(req.query.search || "").trim();
    const q = {};
    if (s) {
      q.$or = [
        { code: { $regex: s, $options: "i" } },
        { name: { $regex: s, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Warehouse.find(q)
        .sort({ code: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Warehouse.countDocuments(q),
    ]);

    ok(res, toPager({ items, total, page, limit }));
  } catch (e) {
    next(e);
  }
});

router.get("/warehouses/:id", async (req, res, next) => {
  try {
    const doc = await Warehouse.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

router.post("/warehouses", async (req, res, next) => {
  try {
    const d = new Warehouse(req.body || {});
    await d.validate();
    await d.save();
    res.status(201).json(d);
  } catch (e) {
    next(e);
  }
});

router.put("/warehouses/:id", async (req, res, next) => {
  try {
    const doc = await Warehouse.findById(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    doc.set(req.body || {});
    await doc.validate();
    await doc.save();
    ok(res, doc);
  } catch (e) {
    next(e);
  }
});

router.delete("/warehouses/:id", async (req, res, next) => {
  try {
    const doc = await Warehouse.findByIdAndDelete(req.params.id);
    if (!doc) return bad(res, "not_found", 404);
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
