// server/models/Stock_Move.js
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/* ---------- Reusable sub-schemas ---------- */
const ParticipantSchema = new Schema(
  {
    name: { type: String, default: "" },
    at:   { type: Date,   default: null },
  },
  { _id: false }
);

const MoneySchema = new Schema(
  {
    currency: { type: String, default: "DKK" },
    amount:   { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const AuditSchema = new Schema(
  {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    version:   { type: Number, default: 1 },
  },
  { _id: false }
);

/* =========================================================
   Stock Move (Transfer / Receipt / Issue)
   ========================================================= */
const StockMoveSchema = new Schema(
  {
    // Numbers (all optional; can be generated client- or server-side)
    moveNo:  { type: String, default: "", index: true }, // e.g. "MOVE-YYYYMMDD-0001"
    itemNo:  { type: String, default: "", index: true }, // e.g. "ITEM-YYYYMMDD-0001"  <-- NEW

    date:       { type: Date,   required: true, index: true },
    reference:  { type: String, default: "", index: true },
    memo:       { type: String, default: "" },

    // item by ref or denormalized SKU (keep both to ease joins/search)
    itemId:     { type: Schema.Types.ObjectId, ref: "Item", index: true, default: null },
    itemSku:    { type: String, index: true, required: true, trim: true },

    // warehouses: allow by id ref and/or code
    fromWhId:   { type: Schema.Types.ObjectId, ref: "Warehouse", index: true, default: null },
    fromWhCode: { type: String, index: true, default: "" },
    toWhId:     { type: Schema.Types.ObjectId, ref: "Warehouse", index: true, default: null },
    toWhCode:   { type: String, index: true, default: "" },

    qty:        { type: Number, required: true },     // non-zero
    uom:        { type: String, default: "pcs" },
    unitCost:   { type: Number, default: 0, min: 0 }, // optional valuation hint
    extended:   { type: MoneySchema, default: () => ({}) },

    status:     { type: String, enum: ["draft", "approved", "posted", "cancelled"], default: "draft", index: true },

    participants: {
      preparedBy: { type: ParticipantSchema, default: () => ({}) },
      approvedBy: { type: ParticipantSchema, default: () => ({}) },
      postedBy:   { type: ParticipantSchema, default: () => ({}) },
    },

    links: {
      sourceDocs: { type: [String], default: [] }, // PO/DO numbers etc.
      attachments:{ type: [String], default: [] },
    },

    audit:      { type: AuditSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false }
);

StockMoveSchema.index({ reference: 1, itemSku: 1, date: -1 });
StockMoveSchema.index({ fromWhCode: 1, toWhCode: 1 });

StockMoveSchema.pre("validate", function (next) {
  if (!this.date) return next(new Error("Date is required"));
  if (!this.itemSku?.trim()) return next(new Error("Item SKU is required"));
  const hasDirection = !!(this.fromWhId || this.fromWhCode || this.toWhId || this.toWhCode);
  if (!hasDirection) return next(new Error("From or To warehouse is required"));
  if (!(Number.isFinite(this.qty) && Number(this.qty) !== 0)) {
    return next(new Error("Quantity must be non-zero"));
  }
  next();
});

StockMoveSchema.pre("save", function (next) {
  this.audit = this.audit || {};
  this.audit.updatedAt = new Date();
  this.audit.version = Number(this.audit.version || 1) + 1;
  // quick extended amount helper if not set
  if (!this.extended || typeof this.extended.amount !== "number") {
    const amt = Math.abs(Number(this.qty || 0)) * Number(this.unitCost || 0);
    this.extended = { currency: "DKK", amount: Number(amt.toFixed(2)) };
  }
  next();
});

StockMoveSchema.methods.toPublic = function () {
  const d = this.toObject({ versionKey: false });
  return {
    id: String(d._id),
    moveNo: d.moveNo,
    itemNo: d.itemNo,          // <-- expose Item No
    date: d.date,
    reference: d.reference,
    memo: d.memo,
    itemSku: d.itemSku,
    fromWhCode: d.fromWhCode,
    toWhCode: d.toWhCode,
    qty: d.qty,
    uom: d.uom,
    unitCost: d.unitCost,
    status: d.status,
    participants: d.participants,
    extended: d.extended,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

const Stock_Move = models.Stock_Move || model("Stock_Move", StockMoveSchema);
export default Stock_Move;
