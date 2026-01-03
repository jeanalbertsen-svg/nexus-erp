// server/models/common.js
const opts = { timestamps: true };
const money = { amount: { type: mongoose.Schema.Types.Decimal128, required: true }, currency: { type: String, required: true } };
module.exports = { opts, money };
