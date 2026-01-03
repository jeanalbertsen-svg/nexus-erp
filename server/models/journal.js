// models/journal.js
import mongoose from "mongoose";

const LineSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, index: true }, // e.g. "1000"
    memo: { type: String, default: "" },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ParticipantSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    at:   { type: Date,   default: null },
  },
  { _id: false }
);

const JournalSchema = new mongoose.Schema(
  {
    jeNumber:   { type: String, required: true, unique: true, index: true }, // "JE-YYYYMMDD-0001"
    date:       { type: Date,   required: true, index: true },
    reference:  { type: String, default: "" },
    memo:       { type: String, default: "" },

    status:     { type: String, enum: ["draft", "approved", "posted", "reversed"], default: "draft", index: true },

    currency:   { code: { type: String, default: "DKK" }, rate: { type: Number, default: 1 } },
    baseCurrency: { type: String, default: "DKK" },
    fxMode:     { type: String, enum: ["entry", "line"], default: "entry" },
    autoReverse:{ type: Boolean, default: false },

    // optional “header”/group id if you’re chaining multiple entries under one logical header
    headerId:   { type: String, default: "" },

    lines:      { type: [LineSchema], default: [] },

    participants: {
      preparedBy: { type: ParticipantSchema, default: () => ({}) },
      approvedBy: { type: ParticipantSchema, default: () => ({}) },
      postedBy:   { type: ParticipantSchema, default: () => ({}) },
    },

    links: {
      sourceDocs: { type: [String], default: [] },
      attachments:{ type: [String], default: [] },
      reversalOf: { type: String, default: null },
      recurrence: { rule: { type: String, default: null } },
    },

    audit: {
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      version:   { type: Number, default: 1 },
    },
  },
  { timestamps: true, versionKey: false }
);

// Validate: at least 2 non-zero lines & balanced
JournalSchema.pre("validate", function(next) {
  const lines = Array.isArray(this.lines) ? this.lines : [];
  const nonZero = lines.filter(l => Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0);
  if (nonZero.length < 2) return next(new Error("Entry must contain at least 2 non-zero lines."));
  const debit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (debit <= 0 || Math.abs(debit - credit) > 0.005)
    return next(new Error("Entry must be balanced (total debit = total credit > 0)."));
  next();
});

// Maintain audit fields
JournalSchema.pre("save", function(next) {
  this.audit = this.audit || {};
  this.audit.updatedAt = new Date();
  this.audit.version = Number(this.audit.version || 1) + 1;
  next();
});

export default mongoose.models.Journal || mongoose.model("Journal", JournalSchema);

