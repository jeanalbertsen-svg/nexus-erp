// server/models/Item.js
import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, unique: true, index: true },
    name: { type: String, required: false, trim: true, default: "" },
    uom: { type: String, required: false, trim: true, default: "pcs" },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    // Human-friendly number like ITEM-20251010-0001 (auto)
    itemNo: { type: String, required: false, trim: true, unique: true, sparse: true },

    // Optional extras
    description: { type: String, default: "" },
    attributes: { type: Object, default: {} },

    // Useful inventory fields (kept optional)
    cost: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    onHand: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* --------- auto-number helper (daily sequence) --------- */
const CounterSchema = new mongoose.Schema(
  { _id: String, value: { type: Number, default: 0 } },
  { versionKey: false }
);
const Counter =
  mongoose.models._counters || mongoose.model("_counters", CounterSchema);

function yyyymmdd(d = new Date()) {
  const iso = new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD
  return iso.replaceAll("-", "");
}

ItemSchema.pre("save", async function autoItemNo(next) {
  try {
    // only assign once, and only for new docs
    if (!this.isNew || this.itemNo) return next();

    // createdAt is not guaranteed yet in pre('save'), use now
    const key = `ITEM-${yyyymmdd(Date.now())}`;
    const c = await Counter.findByIdAndUpdate(
      key,
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );
    const seq = String(c.value).padStart(4, "0");
    this.itemNo = `${key}-${seq}`;
    next();
  } catch (err) {
    next(err);
  }
});

/* --------- exports (ESM) --------- */
export const Item =
  mongoose.models.Item || mongoose.model("Item", ItemSchema);

export default Item;
