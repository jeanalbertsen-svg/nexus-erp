// server/models/Customer.js (very small MVP)
const CustomerSchema = new mongoose.Schema({ orgId:String, code:String, name:String, active:Boolean }, { timestamps:true });
module.exports = mongoose.model('Customer', CustomerSchema);

// server/models/ARInvoice.js
const ARLine = new mongoose.Schema({ item:String, desc:String, qty:Number, price:mongoose.Schema.Types.Decimal128, accountCode:String, taxRate:Number }, { _id:false });
const ARInvoiceSchema = new mongoose.Schema({
  orgId:String, number:String, date:Date, dueDate:Date, customerId:String,
  currency:String, lines:[ARLine],
  totals:{ subtotal:mongoose.Schema.Types.Decimal128, tax:mongoose.Schema.Types.Decimal128, grand:mongoose.Schema.Types.Decimal128 },
  status:{ type:String, enum:['DRAFT','POSTED','PARTIAL','PAID','VOID'], default:'DRAFT' },
  applied: { type: mongoose.Schema.Types.Decimal128, default: 0 }
}, { timestamps:true });
module.exports = mongoose.model('ARInvoice', ARInvoiceSchema);

// server/models/ARPayment.js
const ARPaymentSchema = new mongoose.Schema({
  orgId:String, number:String, date:Date, customerId:String, method:String, bankAccount:String,
  amount: mongoose.Schema.Types.Decimal128,
  allocations: [{ invoiceId:String, amount: mongoose.Schema.Types.Decimal128 }], // many-to-many
  status:{ type:String, enum:['DRAFT','POSTED','VOID'], default:'DRAFT' }
}, { timestamps:true });
module.exports = mongoose.model('ARPayment', ARPaymentSchema);
