// server/routes/accounts.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import Account from "../models/account.js";

const router = Router();

/** Ensure :id is a valid Mongo ObjectId to avoid cast errors */
const ensureId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  next();
};

// GET /api/accounts  (optional filter: ?active=true)
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active === "true") filter.active = true;

    // lean() for perf; sort ascending by account number
    const rows = await Account.find(filter).sort({ number: 1 }).lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// GET /api/accounts/:id
router.get("/:id", ensureId, async (req, res, next) => {
  try {
    const doc = await Account.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (e) {
    next(e);
  }
});

// POST /api/accounts
router.post("/", async (req, res, next) => {
  try {
    // Derive statement from type if not provided
    const STATEMENT_BY_TYPE = {
      ASSET: "Balance Sheet",
      LIABILITY: "Balance Sheet",
      EQUITY: "Balance Sheet",
      REVENUE: "Income Statement",
      EXPENSE: "Income Statement",
    };

    const body = { ...req.body };
    if (!body.statement && body.type) {
      body.statement = STATEMENT_BY_TYPE[body.type] || body.statement;
    }

    const doc = await Account.create(body);
    res.status(201).json(doc);
  } catch (e) {
    // Duplicate number handling (unique index)
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Account number already exists" });
    }
    next(e);
  }
});

// PUT /api/accounts/:id  (full update)
router.put("/:id", ensureId, async (req, res, next) => {
  try {
    const doc = await Account.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Account number already exists" });
    }
    next(e);
  }
});

// PATCH /api/accounts/:id  (partial update)
router.patch("/:id", ensureId, async (req, res, next) => {
  try {
    const doc = await Account.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Account number already exists" });
    }
    next(e);
  }
});

// DELETE /api/accounts/:id  -> 204 No Content
router.delete("/:id", ensureId, async (req, res, next) => {
  try {
    const doc = await Account.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
