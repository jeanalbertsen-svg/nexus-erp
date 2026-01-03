// models/Invoice.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const LineSchema = new Schema(
  {
    description: { type: String, trim: true, default: "" },
    account: { type: String, trim: true, default: "" }, // revenue account, e.g. "4000"
    qty: { type: Number, min: 0, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
    discountPct: { type: Number, min: 0, max: 100, default: 0 },
    taxPct: { type: Number, min: 0, max: 100, default: 25 },
  },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    type: { type: String, enum: ["Sales"], default: "Sales", index: true }, // only sales for now
    date: { type: Date, required: true, index: true },
    currency: { type: String, default: "DKK" },

    // Document identity
    invoiceNo: { type: String, required: true, unique: true, index: true },
    referenceNo: { type: String, trim: true, default: "" },
    jeDisplay: { type: String, trim: true, default: "" },

    // Counterparty
    customer: { type: String, required: true, trim: true, index: true },
    customerRef: { type: String, trim: true, default: "" },

    // Accounting meta
    arAccount: { type: String, default: "1200" },   // Accounts Receivable
    taxAccount: { type: String, default: "2300" },  // Output VAT / taxes
    status: { type: String, enum: ["draft", "posted", "void"], default: "draft", index: true },

    // Content
    memo: { type: String, default: "" },
    lines: { type: [LineSchema], default: [] },

    // Server-computed totals (redundant but fast for queries)
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
InvoiceSchema.pre("validate", function recomputeTotals(next) {
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

InvoiceSchema.methods.toPublic = function () {
  const doc = this.toObject({ versionKey: false });
  return doc;
};

export default model("Invoice", InvoiceSchema);

