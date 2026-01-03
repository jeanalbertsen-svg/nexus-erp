// server/models/Document.js
import mongoose from "mongoose";

const FileRef = new mongoose.Schema({
  name: String,
  mime: String,
  size: Number,
  path: String,        // stored on disk by multer for this MVP
}, { _id: false });

const LineSchema = new mongoose.Schema({
  desc: String, sku: String, qty: Number, uom: String,
  unitPrice: Number, lineTotal: Number, category: { type: String, enum: ["expense","inventory","fixedAsset","unknown"], default: "unknown" }
}, { _id: false });

const DocSchema = new mongoose.Schema({
  source: {
    channel: { type: String, enum: ["email","upload"], default: "upload" },
    subject: String, from: String, receivedAt: Date,
  },
  files: [FileRef],
  type: { type: String, enum: ["order","delivery","invoice","other"], default: "other", index: true },
  language: { type: String, enum: ["da","en","unknown"], default: "unknown" },
  status: { type: String, enum: ["RECEIVED","CLASSIFIED","PARSED","NEEDS_REVIEW","READY","ROUTED","POSTED","ERROR"], default: "RECEIVED", index: true },

  extracted: {
    supplier: { name: String, vat: String, email: String },
    numbers: { invoiceNo: String, orderNo: String, deliveryNo: String },
    dates: { issue: Date, due: Date, delivery: Date },
    currency: { type: String, default: "DKK" },
    net: Number, vat: Number, total: Number,
    payment: { method: String, iban: String, cardLast4: String },
    lines: [LineSchema],
    rawText: String,
    confidence: Number
  },

  // server-side proposal for drafts (what to create on approval)
  proposal: {
    journal: { date: String, reference: String, memo: String, lines: [{ account: String, debit: Number, credit: Number, memo: String }] },
    stockMoves: [{ date: String, itemSku: String, qty: Number, uom: String, unitCost: Number, toWhCode: String, memo: String }],
  },

  links: {
    journalId: String,
    stockMoveIds: [String],
  },

  audit: [{ at: Date, by: String, action: String, meta: Object }],
}, { timestamps: true });

export default mongoose.models.Document || mongoose.model("Document", DocSchema);
