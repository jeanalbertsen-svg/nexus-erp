// server/models/Vendor.js
const VendorSchema = new mongoose.Schema({ orgId:String, code:String, name:String, active:Boolean }, { timestamps:true });
module.exports = mongoose.model('Vendor', VendorSchema);

// server/models/APBill.js + APPayment.js very similar to AR but vendor-facing
