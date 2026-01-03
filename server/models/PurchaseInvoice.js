// server/models/PurchaseInvoice.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const LineSchema = new Schema(
  {
    description: { type: String, trim: true, default: "" },
    account: { type: String, trim: true, default: "" }, // expense/COGS, e.g. "5000"
    qty: { type: Number, min: 0, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
    discountPct: { type: Number, min: 0, max: 100, default: 0 },
    taxPct: { type: Number, min: 0, max: 100, default: 25 },

    // NEW: to drive inventory receives from purchases
    itemSku: { type: String, trim: true, default: "" },        // e.g. "SKU-001"
    warehouseCode: { type: String, trim: true, default: "" },  // e.g. "MAIN"
  },
  { _id: false }
);

const PurchaseInvoiceSchema = new Schema(
  {
    type: { type: String, enum: ["Purchase"], default: "Purchase", index: true },

    date: { type: Date, required: true, index: true },
    currency: { type: String, default: "DKK" },

    billNo: { type: String, required: true, unique: true, index: true },
    referenceNo: { type: String, trim: true, default: "" },
    jeDisplay: { type: String, trim: true, default: "" },

    vendor: { type: String, required: true, trim: true, index: true },
    vendorRef: { type: String, trim: true, default: "" },

    apAccount: { type: String, default: "2000" },
    inputVatAccount: { type: String, default: "1300" },
    status: { type: String, enum: ["draft", "posted", "void"], default: "draft", index: true },

    memo: { type: String, default: "" },
    lines: { type: [LineSchema], default: [] },

    totals: {
      subTotal: { type: Number, default: 0 },
      taxTotal: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

/** Helpers */
function calcLineNet(l) {
  const q = Number(l.qty) || 0;
  const p = Number(l.unitPrice) || 0;
  const d = (Number(l.discountPct) || 0) / 100;
  return Math.max(0, q * p * (1 - d));
}

/** Pre-validate: recompute totals */
PurchaseInvoiceSchema.pre("validate", function recomputeTotals(next) {
  const inv = this;
  let sub = 0;
  let tax = 0;
  for (const l of inv.lines || []) {
    const net = calcLineNet(l);
    const t = (Number(l.taxPct) || 0) / 100;
    sub += net;
    tax += net * t;
  }
  inv.totals.subTotal = Number(sub.toFixed(2));
  inv.totals.taxTotal = Number(tax.toFixed(2));
  inv.totals.grandTotal = Number((sub + tax).toFixed(2));
  return next();
});

PurchaseInvoiceSchema.methods.toPublic = function () {
  const doc = this.toObject({ versionKey: false });
  return {
    id: String(doc._id),
    type: "Purchase",
    date: doc.date,
    currency: doc.currency,
    docNo: doc.billNo,
    reference: doc.referenceNo,
    jeDisplay: doc.jeDisplay,
    party: doc.vendor,
    headerMemo: doc.memo,
    total: doc.totals?.grandTotal ?? 0,
    lines: doc.lines || [], // includes itemSku/warehouseCode now
    _apAccount: doc.apAccount,
    _inputVatAccount: doc.inputVatAccount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

export default model("PurchaseInvoice", PurchaseInvoiceSchema);
