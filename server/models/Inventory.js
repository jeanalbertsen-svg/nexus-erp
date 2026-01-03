// server/models/Inventory.js
import mongoose from "mongoose";

/* ---------- Reusable sub-schemas ---------- */
const ParticipantSchema = new mongoose.Schema(
  { name: { type: String, default: "" }, at: { type: Date, default: null } },
  { _id: false }
);

const MoneySchema = new mongoose.Schema(
  {
    currency: { type: String, default: "DKK" },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const AuditSchema = new mongoose.Schema(
  {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  { _id: false }
);

/* =========================================================
   Item
   ========================================================= */
const ItemSchema = new mongoose.Schema(
  {
    // 👇 UI sends this (doc number). Keep as optional for traceability/search
    itemNo: { type: String, default: "", index: true },

    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: { type: String, required: true, index: true, trim: true },
    description: { type: String, default: "" },

    // UI defaults to "pcs"
    uom: { type: String, default: "pcs" },
    cost: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
    onHand: { type: Number, default: 0 }, // cached rollup

    categories: { type: [String], default: [] },
    barcode: { type: String, default: "" },

    audit: { type: AuditSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false }
);

ItemSchema.pre("validate", function (next) {
  if (!this.sku?.trim()) return next(new Error("SKU is required"));
  if (!this.name?.trim()) return next(new Error("Name is required"));
  if (!(this.cost >= 0)) return next(new Error("Cost must be ≥ 0"));
  if (!(this.price >= 0)) return next(new Error("Price must be ≥ 0"));
  next();
});

ItemSchema.pre("save", function (next) {
  this.audit = this.audit || {};
  this.audit.updatedAt = new Date();
  this.audit.version = Number(this.audit.version || 1) + 1;
  next();
});

/* =========================================================
   Warehouse
   ========================================================= */
const WarehouseSchema = new mongoose.Schema(
  {
    // (optional) legacy / internal doc number ref
    itemNo: { type: String, default: "", index: true },

    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true, // e.g. "MAIN"
    },
    name: { type: String, required: true, trim: true },

    // 🌟 NEW: match UI fields
    type: {
      type: String,
      trim: true,
      default: "General", // UI uses this concept
    },
    location: {
      type: String,
      trim: true,
      default: "", // e.g. "Copenhagen, DK"
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // legacy / optional
    address: { type: String, default: "" },

    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    audit: { type: AuditSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false }
);

WarehouseSchema.pre("validate", function (next) {
  if (!this.code?.trim())
    return next(new Error("Warehouse code is required"));
  if (!this.name?.trim())
    return next(new Error("Warehouse name is required"));
  next();
});

WarehouseSchema.pre("save", function (next) {
  this.audit = this.audit || {};
  this.audit.updatedAt = new Date();
  this.audit.version = Number(this.audit.version || 1) + 1;
  next();
});

/* =========================================================
   Stock Move (Transfer / Receipt / Issue)
   ========================================================= */
const StockMoveSchema = new mongoose.Schema(
  {
    // 👇 UI sends this (doc number). Optional but useful
    itemNo: { type: String, default: "", index: true },

    moveNo: { type: String, default: "", index: true }, // e.g. "MOVE-YYYYMMDD-0001"
    date: { type: Date, required: true, index: true },
    reference: { type: String, default: "", index: true },
    memo: { type: String, default: "" },

    // item by ref or denormalized SKU (keep both to ease joins/search)
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      index: true,
      default: null,
    },
    itemSku: { type: String, index: true, default: "" },

    // warehouses: allow by id ref and/or code
    fromWhId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
      default: null,
    },
    fromWhCode: { type: String, index: true, default: "" },
    toWhId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
      default: null,
    },
    toWhCode: { type: String, index: true, default: "" },

    qty: { type: Number, required: true }, // UI enforces > 0
    unitCost: { type: Number, default: 0, min: 0 }, // optional valuation hint
    extended: { type: MoneySchema, default: () => ({}) },

    // 🔧 add "approved" to match UI flow
    status: {
      type: String,
      enum: ["draft", "approved", "posted", "cancelled"],
      default: "draft",
      index: true,
    },

    participants: {
      preparedBy: { type: ParticipantSchema, default: () => ({}) },
      approvedBy: { type: ParticipantSchema, default: () => ({}) },
      postedBy: { type: ParticipantSchema, default: () => ({}) },
    },

    links: {
      sourceDocs: { type: [String], default: [] }, // PO/DO numbers etc.
      attachments: { type: [String], default: [] },
    },

    audit: { type: AuditSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false }
);

StockMoveSchema.pre("validate", function (next) {
  if (!this.date) return next(new Error("Date is required"));
  const hasItem = !!(this.itemId || (this.itemSku && this.itemSku.trim()));
  if (!hasItem)
    return next(new Error("Item is required (itemId or itemSku)"));
  const hasDirection = !!(
    this.fromWhId ||
    this.fromWhCode ||
    this.toWhId ||
    this.toWhCode
  );
  if (!hasDirection)
    return next(new Error("From or To warehouse is required"));
  if (!(Number.isFinite(this.qty) && Number(this.qty) !== 0)) {
    return next(new Error("Quantity must be non-zero"));
  }
  next();
});

StockMoveSchema.pre("save", function (next) {
  // compute extended amount for convenience
  const total =
    Math.abs(Number(this.qty || 0)) *
    Math.max(0, Number(this.unitCost || 0));
  this.extended = this.extended || {};
  this.extended.currency = this.extended.currency || "DKK";
  this.extended.amount = total;

  this.audit = this.audit || {};
  this.audit.updatedAt = new Date();
  this.audit.version = Number(this.audit.version || 1) + 1;
  next();
});

/* =========================================================
   Inventory Adjustment
   ========================================================= */
const AdjustmentSchema = new mongoose.Schema(
  {
    // 👇 UI sends these
    itemNo: { type: String, default: "", index: true },
    adjNo: { type: String, default: "", index: true },
    reference: { type: String, default: "", index: true }, // UI sends "reference"

    date: { type: Date, required: true, index: true },
    reason: { type: String, default: "" },
    memo: { type: String, default: "" },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      index: true,
      default: null,
    },
    itemSku: { type: String, index: true, default: "" },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
      default: null,
    },
    warehouseCode: { type: String, index: true, default: "" },

    qtyDelta: { type: Number, required: true }, // positive = add, negative = subtract
    unitCost: { type: Number, default: 0, min: 0 },
    extended: { type: MoneySchema, default: () => ({}) },

    // 🔧 add "approved" to match UI flow
    status: {
      type: String,
      enum: ["draft", "approved", "posted", "cancelled"],
      default: "draft",
      index: true,
    },

    participants: {
      preparedBy: { type: ParticipantSchema, default: () => ({}) },
      approvedBy: { type: ParticipantSchema, default: () => ({}) },
      postedBy: { type: ParticipantSchema, default: () => ({}) },
    },

    links: {
      sourceDocs: { type: [String], default: [] },
      attachments: { type: [String], default: [] },
    },

    audit: { type: AuditSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false }
);

AdjustmentSchema.pre("validate", function (next) {
  if (!this.date) return next(new Error("Date is required"));
  const hasItem = !!(this.itemId || (this.itemSku && this.itemSku.trim()));
  if (!hasItem)
    return next(new Error("Item is required (itemId or itemSku)"));
  const hasWh = !!(
    this.warehouseId ||
    (this.warehouseCode && this.warehouseCode.trim())
  );
  if (!hasWh) return next(new Error("Warehouse is required"));
  if (
    !(
      Number.isFinite(this.qtyDelta) &&
      Number(this.qtyDelta) !== 0
    )
  ) {
    return next(new Error("Qty Delta must be non-zero"));
  }
  next();
});

AdjustmentSchema.pre("save", function (next) {
  const total =
    Math.abs(Number(this.qtyDelta || 0)) *
    Math.max(0, Number(this.unitCost || 0));
  this.extended = this.extended || {};
  this.extended.currency = this.extended.currency || "DKK";
  this.extended.amount = total;

  this.audit = this.audit || {};
  this.audit.updatedAt = new Date();
  this.audit.version = Number(this.audit.version || 1) + 1;
  next();
});

/* ---------- Model exports (reuse if already compiled) ---------- */
export const Item =
  mongoose.models.Item || mongoose.model("Item", ItemSchema);
export const Warehouse =
  mongoose.models.Warehouse ||
  mongoose.model("Warehouse", WarehouseSchema);
export const StockMove =
  mongoose.models.StockMove ||
  mongoose.model("StockMove", StockMoveSchema);
export const Adjustment =
  mongoose.models.Adjustment ||
  mongoose.model("Adjustment", AdjustmentSchema);

export default { Item, Warehouse, StockMove, Adjustment };
