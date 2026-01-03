// server/models/GeneralLedger.js
import mongoose from "mongoose";

const generalLedgerSchema = new mongoose.Schema(
  {
    date:      { type: Date, required: true, index: true },
    reference: { type: String, default: "", index: true }, // Ref No.
    jeNumber:  { type: String, default: "", index: true }, // JE No. (NOT UNIQUE)
    journalNo: { type: String, default: "", index: true }, // legacy alias

    account:   { type: String, required: true, index: true },
    memo:      { type: String, default: "" },
    debit:     { type: Number, default: 0 },
    credit:    { type: Number, default: 0 },

    source:    { type: String, default: "Manual", index: true },
    journalId: { type: mongoose.Schema.Types.Mixed, index: true },
    locked:    { type: Boolean, default: false },
    balance:   { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false, strict: true }
);

generalLedgerSchema.pre("validate", function (next) {
  if (!this.jeNumber && this.journalNo) this.jeNumber = this.journalNo;
  if (!this.journalNo && this.jeNumber) this.journalNo = this.jeNumber;
  next();
});

generalLedgerSchema.index({ journalId: 1, reference: 1, jeNumber: 1 });

export default mongoose.models.GeneralLedger ||
  mongoose.model("GeneralLedger", generalLedgerSchema);
