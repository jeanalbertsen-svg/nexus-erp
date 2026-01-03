// server/models/Account.js
import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    number: { type: String, required: true }, // removed index:true to avoid duplicate index warning
    name:   { type: String, required: true },
    type:   { type: String, required: true, enum: ["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"] },
    subtype: { type: String },
    statement: { type: String, enum: ["Balance Sheet","Income Statement"], default: "Balance Sheet" },
    description: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique index
accountSchema.index({ number: 1 }, { unique: true });

// 👇 Reuse compiled model during dev/nodemon reloads
export default mongoose.models.Account || mongoose.model("Account", accountSchema);

