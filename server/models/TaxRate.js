// server/models/TaxRate.js
const TaxRateSchema = new mongoose.Schema({
  orgId:String, code:String, name:String, rate:Number, // e.g., 0.25
  accountCodeCollected:String, // liability
  accountCodePaid:String       // recovery (AP)
}, { timestamps:true });
module.exports = mongoose.model('TaxRate', TaxRateSchema);
