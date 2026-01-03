// server/routes/item.js  (ESM)
import { Router } from "express";
import Item from "../models/Item.js";
import StockMove from "../models/Stock_Move.js";

const router = Router();

/* ------------------------------ filters ------------------------------ */
function buildFilter(q = {}) {
  const filter = {};
  if (q.status) filter.status = q.status;

  if (q.search) {
    const s = String(q.search).trim();
    filter.$or = [
      { sku:        { $regex: s, $options: "i" } },
      { name:       { $regex: s, $options: "i" } },
      { itemNo:     { $regex: s, $options: "i" } },
      { description:{ $regex: s, $options: "i" } },
    ];
  }
  return filter;
}

/* ------------------------------------------
   Helper: aggregate posted on-hand per SKU
   ------------------------------------------ */
async function postedOnHandForSkus(skus = []) {
  if (!Array.isArray(skus) || skus.length === 0) {
    return { map: new Map(), perSkuLatest: new Map() };
  }

  const pipeline = [
    { $match: { status: "posted", itemSku: { $in: skus } } },
    {
      $addFields: {
        qtyNum:       { $toDouble: { $ifNull: ["$qty", 0] } },
        hasTo:        { $gt: [ { $strLenCP: { $ifNull: ["$toWhCode",   ""] } }, 0 ] },
        hasFrom:      { $gt: [ { $strLenCP: { $ifNull: ["$fromWhCode", ""] } }, 0 ] },
        hasFromName:  { $gt: [ { $strLenCP: { $ifNull: ["$fromName",   ""] } }, 0 ] },
        moveTime:     { $ifNull: ["$date", { $ifNull: ["$createdAt", { $ifNull: ["$updatedAt", "$_id"] }] }] },
        supplierDisplay: { $ifNull: ["$fromName", "$fromWhCode"] },
      }
    },
    {
      $addFields: {
        addPart: { $cond: ["$hasTo", "$qtyNum", 0] },
        subPart: {
          $cond: [
            { $or: [
              { $and: ["$hasFrom", { $not: ["$hasTo"] }] },                // pure issue
              { $and: ["$hasFrom", "$hasTo", { $not: ["$hasFromName"] }] } // internal transfer (not supplier)
            ]},
            "$qtyNum",
            0
          ]
        }
      }
    },
    { $addFields: { signedQty: { $subtract: ["$addPart", "$subPart"] } } },
    { $sort: { moveTime: -1, _id: -1 } },
    {
      $group: {
        _id: "$itemSku",
        onHand:          { $sum: "$signedQty" },
        lastSupplierName:{ $first: "$supplierDisplay" },
        lastMoveAt:      { $first: "$moveTime" },
      }
    }
  ];

  const rows = await StockMove.aggregate(pipeline);
  const map = new Map();
  const perSkuLatest = new Map();
  for (const r of rows) {
    map.set(r._id, Number.isFinite(r.onHand) ? r.onHand : 0);
    perSkuLatest.set(r._id, {
      lastSupplierName: r.lastSupplierName || "",
      lastMoveAt: r.lastMoveAt || null,
    });
  }
  return { map, perSkuLatest };
}


/* GET /api/inventory/items */
router.get("/", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || "50", 10)));
    const skip  = (page - 1) * limit;

    const filter = buildFilter(req.query);

    const [items, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);

    if (items.length) {
      const skus = items.map(i => i.sku).filter(Boolean);
      const { map: onHandMap, perSkuLatest } = await postedOnHandForSkus(skus);

      for (const it of items) {
        const sku = it.sku || "";
        const latest = perSkuLatest.get(sku) || {};
        it.onHand = Number(onHandMap.get(sku) || 0);
        it.lastSupplierName = latest.lastSupplierName || "";
        it.lastMoveAt = latest.lastMoveAt || null;
      }
    }

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ read one ---------------------------- */
/* GET /api/inventory/items/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await Item.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Item not found" });

    if (doc?.sku) {
      const { map, perSkuLatest } = await postedOnHandForSkus([doc.sku]);
      const latest = perSkuLatest.get(doc.sku) || {};
      doc.onHand = Number(map.get(doc.sku) || 0);
      doc.lastSupplierName = latest.lastSupplierName || "";
      doc.lastMoveAt = latest.lastMoveAt || null;
    }

    res.json(doc);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ create ------------------------------ */
/* POST /api/inventory/items */
router.post("/", async (req, res, next) => {
  try {
    const body = {
      sku: req.body.sku, // required by schema
      name: req.body.name,
      uom: req.body.uom,
      status: req.body.status,
      description: req.body.description,
      attributes: req.body.attributes,
      itemNo: req.body.itemNo, // optional, model can auto-generate
    };
    const doc = await Item.create(body);
    res.status(201).json(doc);
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err.keyPattern || err.keyValue || {})[0] || "key";
      return res.status(409).json({ error: `Duplicate ${key}` });
    }
    next(err);
  }
});

/* ------------------------------- update ----------------------------- */
/* PUT /api/inventory/items/:id */
router.put("/:id", async (req, res, next) => {
  try {
    const updates = {
      sku: req.body.sku,
      name: req.body.name,
      uom: req.body.uom,
      status: req.body.status,
      description: req.body.description,
      attributes: req.body.attributes,
      itemNo: req.body.itemNo,
    };
    const doc = await Item.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ error: "Item not found" });
    res.json(doc);
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err.keyPattern || err.keyValue || {})[0] || "key";
      return res.status(409).json({ error: `Duplicate ${key}` });
    }
    next(err);
  }
});

/* ------------------------------- delete ----------------------------- */
/* DELETE /api/inventory/items/:id */
router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await Item.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Item not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;