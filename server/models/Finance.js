// models/Finance.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

/* =========================================================
   GL Entry (target collection for postings)
   ========================================================= */
const glEntrySchema = new Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    account: { type: String, required: true, index: true },
    memo: { type: String, default: "" },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },

    // ✅ fields your GL UI expects
    reference: { type: String, default: "" },   // Ref No.
    jeNumber: { type: String, default: "" },    // e.g. JE-20250930-0001 (or hint)
    journalId: { type: Schema.Types.ObjectId }, // source doc _id (locks row in UI)
    source: { type: String, default: "" },      // "Finance" | "JE" | "Manual"
    locked: { type: Boolean, default: false },  // non-editable in UI

    // linkage/meta
    sourceId: { type: Schema.Types.ObjectId, index: true }, // same as journalId for Finance
    sourceType: { type: String, default: "FinanceDocument" },
    docType: { type: String, default: "" },
    docNo: { type: String, default: "" },
    counterparty: { type: String, default: "" },
  },
  { timestamps: true }
);

// helpful indexes
glEntrySchema.index({ date: 1, account: 1 });
glEntrySchema.index({ sourceId: 1, createdAt: -1 });
glEntrySchema.index({ jeNumber: 1 });

export const GLEntry = model("GLEntry", glEntrySchema);

/* =========================================================
   FinanceDocument
   ========================================================= */
const financeLineSchema = new Schema(
  {
    account: { type: String, required: true }, // "1000", "5200", etc.
    memo: { type: String, default: "" },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
  },
  { _id: false }
);

const participantSchema = new Schema(
  { name: { type: String, default: "" }, at: { type: Date, default: null } },
  { _id: false }
);

const financeDocumentSchema = new Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    docType: {
      type: String,
      enum: ["Invoice", "Purchase Invoice", "Other"],
      required: true,
    },
    docNo: { type: String, default: "" },
    counterparty: { type: String, default: "" },
    memo: { type: String, default: "" },
    summary: { type: String, default: "" },

    // stored hint / display values (not guaranteed unique)
    jeNumber: { type: String, default: "" }, // we keep the hint here too
    reference: { type: String, default: "" },

    status: {
      type: String,
      enum: ["draft", "approved", "posted"],
      default: "draft",
      index: true,
    },

    participants: {
      preparedBy: { type: participantSchema, default: () => ({}) },
      approvedBy: { type: participantSchema, default: () => ({}) },
      postedBy: { type: participantSchema, default: () => ({}) },
    },

    preparedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    postedAt: { type: Date, default: null },

    lines: { type: [financeLineSchema], default: [] },
  },
  { timestamps: true }
);

/* ---------- helpers ---------- */
financeDocumentSchema.statics.isBalanced = function isBalanced(lines = []) {
  const sum = (a, k) =>
    (Array.isArray(a) ? a : []).reduce((s, r) => s + (Number(r?.[k]) || 0), 0);
  const d = sum(lines, "debit");
  const c = sum(lines, "credit");
  return Math.abs(d - c) < 0.00001 && d > 0 && c > 0;
};

export const FinanceDocument = model("FinanceDocument", financeDocumentSchema);
