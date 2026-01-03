// server/models/BankAccount.js
const BankAccountSchema = new mongoose.Schema({
  orgId:String, code:String, name:String, currency:String,
  glControlAccountCode:String, active:Boolean
}, { timestamps:true });
module.exports = mongoose.model('BankAccount', BankAccountSchema);

// server/models/BankTxn.js
const BankTxnSchema = new mongoose.Schema({
  orgId:String, bankAccountId:String, date:Date, description:String,
  amount: mongoose.Schema.Types.Decimal128, // +in / -out
  source: { type:String, enum:['IMPORT','MANUAL'] },
  matched: { type:Boolean, default:false },
  link: { type: String }, // linked doc id (payment, deposit, etc.)
}, { timestamps:true });
module.exports = mongoose.model('BankTxn', BankTxnSchema);
