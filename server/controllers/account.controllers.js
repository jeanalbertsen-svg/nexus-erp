import Account from "../models/account.js";

const STATEMENT_BY_TYPE = {
  ASSET: "Balance Sheet",
  LIABILITY: "Balance Sheet",
  EQUITY: "Balance Sheet",
  REVENUE: "Income Statement",
  EXPENSE: "Income Statement",
};
const SUBTYPES = {
  ASSET: ["Cash & Cash Equivalents", "Accounts Receivable", "Investments", "Inventory", "Prepaid & Other Current", "Other Current Assets","Property, Plant & Equipment","Intangibles","Contra Assets"],
  LIABILITY: ["Accounts Payable","Accrued Liabilities","Taxes Payable","Deferred Revenue","Short-term Debt","Long-term Debt","Leases"],
  EQUITY: ["Paid-in Capital","Retained Earnings","Distributions / Draws","Treasury Stock","Partners’ Capital"],
  REVENUE: ["Product Revenue","Service Revenue","Recurring / Subscriptions","Investment Income","Other Income","Gains / (Losses)"],
  EXPENSE: ["COGS / Cost of Sales","Payroll","Facilities","Operations","G&A","Sales & Marketing","R&D","Financing","Other"],
};

function derive({ type, subtype, statement }) {
  const T = (type || "").toUpperCase();
  return {
    type: T,
    subtype: subtype || (SUBTYPES[T] ? SUBTYPES[T][0] : undefined),
    statement: statement || STATEMENT_BY_TYPE[T],
  };
}

export async function listAccounts(req, res, next) {
  try {
    const q = {};
    if (req.query.active !== undefined) q.active = req.query.active === "true";
    const docs = await Account.find(q).sort({ number: 1 });
    res.json(docs);
  } catch (e) { next(e); }
}

export async function createAccount(req, res, next) {
  try {
    const { number, name, type, subtype, statement, description, active = true } = req.body;
    const d = derive({ type, subtype, statement });

    const doc = await Account.create({
      number: String(number).trim(),
      name: String(name).trim(),
      type: d.type,
      subtype: d.subtype,
      statement: d.statement,
      description: description ?? "",
      active,
    });

    res.status(201).json(doc);
    return doc;
  } catch (e) { next(e); }
}

export async function updateAccount(req, res, next) {
  try {
    const { id } = req.params;
    const { number, name, type, subtype, statement, description, active } = req.body;
    const d = derive({ type, subtype, statement });

    const doc = await Account.findByIdAndUpdate(
      id,
      {
        $set: {
          number: String(number).trim(),
          name: String(name).trim(),
          type: d.type,
          subtype: d.subtype,
          statement: d.statement,
          description: description ?? "",
          active: active ?? true,
        }
      },
      { new: true, runValidators: true }
    );

    res.json(doc);
    return doc;
  } catch (e) { next(e); }
}

export async function deleteAccount(req, res, next) {
  try {
    const { id } = req.params;
    await Account.findByIdAndDelete(id);
    res.status(204).end();
    return true;
  } catch (e) { next(e); }
}
