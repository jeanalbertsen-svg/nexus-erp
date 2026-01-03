// server/seed/seed_coa.js
import "dotenv/config";
import mongoose from "mongoose";
import Account from "../models/account.js";

// Use the same env var name as your server:
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nexus_erp";

/* ----------------------- helpers & constants ----------------------- */
const STATEMENT_BY_TYPE = {
  ASSET: "Balance Sheet",
  LIABILITY: "Balance Sheet",
  EQUITY: "Balance Sheet",
  REVENUE: "Income Statement",
  EXPENSE: "Income Statement",
};

const INDUSTRY_TEMPLATES = {
  Baseline: [
    // ---- ASSETS ----
    { number: "1000", name: "Cash", type: "ASSET", subtype: "Cash & Cash Equivalents", description: "Operating cash in fund bank accounts", statement: "Balance Sheet" },
    { number: "1010", name: "Subscriptions Receivable", type: "ASSET", subtype: "Accounts Receivable", description: "Called but unpaid capital from LPs", statement: "Balance Sheet" },
    { number: "1020", name: "Interest & Dividends Receivable", type: "ASSET", subtype: "Accounts Receivable", description: "Accrued portfolio interest/dividends", statement: "Balance Sheet" },
    { number: "1100", name: "Investments at Fair Value", type: "ASSET", subtype: "Investments", description: "Portfolio investments measured at fair value", statement: "Balance Sheet" },
    { number: "1110", name: "Cost Basis of Investments", type: "ASSET", subtype: "Investments", description: "Historical cost of investments (tracking)", statement: "Balance Sheet" },
    { number: "1120", name: "Unrealized Appreciation (Contra)", type: "ASSET", subtype: "Contra Assets", description: "FV uplift vs. cost (contra to cost)", statement: "Balance Sheet" },
    { number: "1130", name: "Unrealized Depreciation (Contra)", type: "ASSET", subtype: "Contra Assets", description: "FV markdown vs. cost (contra to cost)", statement: "Balance Sheet" },
    { number: "1200", name: "Due from GP / Manager", type: "ASSET", subtype: "Other Current Assets", description: "Amounts receivable from GP/Manager", statement: "Balance Sheet" },
    { number: "1210", name: "Other Receivables", type: "ASSET", subtype: "Other Current Assets", description: "Miscellaneous receivables", statement: "Balance Sheet" },
    { number: "1300", name: "Prepaid Expenses", type: "ASSET", subtype: "Prepaid & Other Current", description: "Payments made in advance for future services", statement: "Balance Sheet" },
    { number: "1400", name: "Short-Term Investments", type: "ASSET", subtype: "Investments", description: "Investments easily convertible to cash", statement: "Balance Sheet" },
    { number: "1500", name: "Equipment", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Machinery and tools used in operations", statement: "Balance Sheet" },
    { number: "1510", name: "Furniture & Fixtures", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Office furniture and fixtures", statement: "Balance Sheet" },
    { number: "1600", name: "Vehicles", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Company-owned cars and trucks", statement: "Balance Sheet" },
    { number: "1700", name: "Buildings", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Company-owned real estate buildings", statement: "Balance Sheet" },
    { number: "1800", name: "Land", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Company-owned land property", statement: "Balance Sheet" },
    { number: "1900", name: "Accumulated Depreciation", type: "ASSET", subtype: "Contra Assets", description: "Total depreciation of fixed assets", statement: "Balance Sheet" },
    // ---- LIABILITIES ----
    { number: "2000", name: "Accounts Payable", type: "LIABILITY", subtype: "Accounts Payable", description: "Trade payables and invoices due", statement: "Balance Sheet" },
    { number: "2010", name: "Accrued Expenses", type: "LIABILITY", subtype: "Accrued Liabilities", description: "Incurred expenses not yet billed", statement: "Balance Sheet" },
    { number: "2020", name: "Management Fees Payable", type: "LIABILITY", subtype: "Accrued Liabilities", description: "Accrued management fees owed to Manager", statement: "Balance Sheet" },
    { number: "2300", name: "Taxes Payable", type: "LIABILITY", subtype: "Taxes Payable", description: "Taxes owed to the government", statement: "Balance Sheet" },
    { number: "2400", name: "Unearned Revenue", type: "LIABILITY", subtype: "Deferred Revenue", description: "Customer payments received before delivery", statement: "Balance Sheet" },
    { number: "2500", name: "Short-Term Loans", type: "LIABILITY", subtype: "Short-term Debt", description: "Loans due within one year", statement: "Balance Sheet" },
    { number: "2600", name: "Bank Loan Payable", type: "LIABILITY", subtype: "Long-term Debt", description: "Outstanding balance of bank loans", statement: "Balance Sheet" },
    { number: "2700", name: "Bonds Payable", type: "LIABILITY", subtype: "Long-term Debt", description: "Company-issued bonds outstanding", statement: "Balance Sheet" },
    { number: "2800", name: "Lease Obligations", type: "LIABILITY", subtype: "Leases", description: "Future lease payments owed", statement: "Balance Sheet" },
    // ---- EQUITY ----
    { number: "3000", name: "Share Capital", type: "EQUITY", subtype: "Paid-in Capital", description: "Owner or shareholder investments", statement: "Balance Sheet" },
    { number: "3200", name: "Additional Paid-In Capital", type: "EQUITY", subtype: "Paid-in Capital", description: "Contributions beyond par value of shares", statement: "Balance Sheet" },
    { number: "3300", name: "Retained Earnings", type: "EQUITY", subtype: "Retained Earnings", description: "Accumulated profits not distributed as dividends", statement: "Balance Sheet" },
    { number: "3400", name: "Dividends / Owner’s Draw", type: "EQUITY", subtype: "Distributions / Draws", description: "Funds paid to owners or shareholders", statement: "Balance Sheet" },
    { number: "3500", name: "Treasury Stock", type: "EQUITY", subtype: "Treasury Stock", description: "Repurchased company stock", statement: "Balance Sheet" },
    // ---- REVENUE ----
    { number: "4000", name: "Sales Revenue", type: "REVENUE", subtype: "Product Revenue", description: "Income from sale of goods", statement: "Income Statement" },
    { number: "4100", name: "Service Revenue", type: "REVENUE", subtype: "Service Revenue", description: "Income from providing services", statement: "Income Statement" },
    { number: "4200", name: "Rental Income", type: "REVENUE", subtype: "Other Income", description: "Income from renting property or equipment", statement: "Income Statement" },
    { number: "4300", name: "Interest Income", type: "REVENUE", subtype: "Investment Income", description: "Interest earned on investments or deposits", statement: "Income Statement" },
    { number: "4030", name: "FX Gain (Loss)", type: "REVENUE", subtype: "Gains / (Losses)", description: "Foreign currency transaction gains or losses", statement: "Income Statement" },
    // ---- EXPENSES ----
    { number: "5000", name: "Cost of Goods Sold (COGS)", type: "EXPENSE", subtype: "COGS / Cost of Sales", description: "Direct costs of producing goods sold", statement: "Income Statement" },
    { number: "5100", name: "Salaries & Wages", type: "EXPENSE", subtype: "Payroll", description: "Employee compensation", statement: "Income Statement" },
    { number: "5200", name: "Rent Expense", type: "EXPENSE", subtype: "Facilities", description: "Payments for office or building rent", statement: "Income Statement" },
    { number: "5300", name: "Utilities Expense", type: "EXPENSE", subtype: "Facilities", description: "Electricity, water, gas, and related utilities", statement: "Income Statement" },
    { number: "5400", name: "Office Supplies", type: "EXPENSE", subtype: "Operations", description: "Stationery and consumables for office use", statement: "Income Statement" },
    { number: "5500", name: "Insurance Expense", type: "EXPENSE", subtype: "G&A", description: "Premiums for business insurance policies", statement: "Income Statement" },
    { number: "5600", name: "Marketing & Advertising", type: "EXPENSE", subtype: "Sales & Marketing", description: "Promotional and advertising costs", statement: "Income Statement" },
    { number: "5700", name: "Travel Expense", type: "EXPENSE", subtype: "Sales & Marketing", description: "Costs of business travel", statement: "Income Statement" },
    { number: "5800", name: "Professional Fees", type: "EXPENSE", subtype: "G&A", description: "Legal, consulting, or professional services", statement: "Income Statement" },
    { number: "5900", name: "Training & Development", type: "EXPENSE", subtype: "G&A", description: "Employee training and development costs", statement: "Income Statement" },
    { number: "6000", name: "Depreciation Expense", type: "EXPENSE", subtype: "G&A", description: "Expense allocation for asset depreciation", statement: "Income Statement" },
    { number: "6100", name: "Legal Expenses", type: "EXPENSE", subtype: "G&A", description: "Fees paid to lawyers and legal firms", statement: "Income Statement" },
    { number: "6200", name: "Audit & Accounting Fees", type: "EXPENSE", subtype: "G&A", description: "External audit and accounting service fees", statement: "Income Statement" },
    { number: "6300", name: "Bank Charges", type: "EXPENSE", subtype: "Operations", description: "Service fees charged by banks", statement: "Income Statement" },
    { number: "6400", name: "IT / Software Expense", type: "EXPENSE", subtype: "Operations", description: "Cost of software subscriptions and IT services", statement: "Income Statement" },
    { number: "6500", name: "Miscellaneous Expenses", type: "EXPENSE", subtype: "Other", description: "Other minor or irregular expenses", statement: "Income Statement" },
    { number: "6600", name: "Interest Expense", type: "EXPENSE", subtype: "Financing", description: "Interest paid on loans", statement: "Income Statement" },
    { number: "6700", name: "Foreign Exchange Loss", type: "EXPENSE", subtype: "Financing", description: "Losses from currency exchange differences", statement: "Income Statement" },
  ],
};

/* ----------------------------- CLI args ---------------------------- */
function parseArgs(argv) {
  const args = { industry: "Baseline", wipe: false, includeBaseline: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--wipe") args.wipe = true;
    else if (a === "--industry" && argv[i + 1]) args.industry = argv[++i];
    else if (a === "--no-baseline") args.includeBaseline = false;
  }
  return args;
}

/* ----------------------------- runner ------------------------------ */
async function run() {
  const { industry, wipe, includeBaseline } = parseArgs(process.argv);

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to", MONGO_URI);

  // Ensure indexes (esp. unique number) before upserts
  await Account.init();

  if (wipe) {
    await Account.deleteMany({});
    console.log("🧹 Cleared existing accounts.");
  }

  let template = [];
  if (industry === "Baseline") {
    template = INDUSTRY_TEMPLATES.Baseline || [];
  } else {
    template = [
      ...(includeBaseline ? (INDUSTRY_TEMPLATES.Baseline || []) : []),
      ...(INDUSTRY_TEMPLATES[industry] || []),
    ];
  }

  if (!template.length) {
    console.error(`No template found for "${industry}".`);
    process.exit(2);
  }

  let added = 0, updated = 0, failed = 0;

  for (const raw of template) {
    const number = String(raw.number).trim();
    const name = String(raw.name).trim();
    const type = raw.type;
    const subtype = raw.subtype || "";
    const description = String(raw.description || `${name} account`);
    const statement = raw.statement || STATEMENT_BY_TYPE[type] || "";

    try {
      const res = await Account.updateOne(
        { number },
        { $set: { number, name, type, subtype, description, statement, active: true } },
        { upsert: true }
      );

      if (res.upsertedCount > 0) added += 1;
      else if (res.modifiedCount > 0) updated += 1;
    } catch (e) {
      failed += 1;
      console.error(`❌ ${number} - ${name}: ${e.message}`);
    }
  }

  const count = await Account.countDocuments();
  console.log(`🎯 Seed "${industry}" complete → Added ${added}, Updated ${updated}, Failed ${failed}. Total: ${count}`);

  await mongoose.disconnect();
  console.log("👋 Disconnected.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
