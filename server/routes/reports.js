// server/routes/reports.js
import { Router } from "express";
import GeneralLedger from "../models/GeneralLedger.js";

const router = Router();

/* ------------------ Helpers ------------------ */
const toStart = (d) => new Date(`${d}T00:00:00.000Z`);
const toEnd   = (d) => new Date(`${d}T23:59:59.999Z`);

const inferCategoryFromNumber = (num) => {
  const s = String(num || "");
  const f = s[0];
  if (f === "1") return "ASSET";
  if (f === "2") return "LIABILITY";
  if (f === "3") return "EQUITY";
  if (f === "4") return "REVENUE";
  if (["5","6","7","8","9"].includes(f)) return "EXPENSE";
  return "OTHER";
};

// For TB polarity (show debit-vs-credit columns cleanly at the end date)
const splitDebitCreditFromNet = (net) => {
  return net >= 0
    ? { debit: net, credit: 0 }
    : { debit: 0, credit: -net };
};

/* =========================================================
   TRIAL BALANCE
   - Query: GET /api/reports/trial-balance?end=YYYY-MM-DD[&start=YYYY-MM-DD]
   - If start provided, you'll also get opening + movement for the period.
   ========================================================= */
router.get("/trial-balance", async (req, res) => {
  try {
    const end = (req.query.end || new Date().toISOString().slice(0,10)).slice(0,10);
    const start = (req.query.start || "").slice(0,10);

    // sums up to end (inclusive)
    const uptoEnd = await GeneralLedger.aggregate([
      { $match: { date: { $lte: toEnd(end) } } },
      { $group: {
          _id: "$account",
          debit: { $sum: "$debit" },
          credit:{ $sum: "$credit" }
      }},
    ]);

    // sums before start (opening), only if start provided
    let openingMap = new Map();
    if (start) {
      const beforeStart = await GeneralLedger.aggregate([
        { $match: { date: { $lt: toStart(start) } } },
        { $group: {
            _id: "$account",
            debit: { $sum: "$debit" },
            credit:{ $sum: "$credit" }
        }},
      ]);
      openingMap = new Map(
        beforeStart.map(r => [String(r._id), Number(r.debit || 0) - Number(r.credit || 0)])
      );
    }

    // compose rows
    const rows = uptoEnd.map((r) => {
      const account = String(r._id);
      const endNet  = Number(r.debit || 0) - Number(r.credit || 0); // debit-positive
      const openNet = openingMap.get(account) ?? null;
      const moveNet = openNet !== null ? (endNet - openNet) : null;

      const cat = inferCategoryFromNumber(account);
      const endSplit = splitDebitCreditFromNet(endNet);

      return {
        account,
        category: cat,
        end: { debit: endSplit.debit, credit: endSplit.credit, net: endNet },
        opening: openNet !== null ? splitDebitCreditFromNet(openNet) : null,
        movement: moveNet !== null ? splitDebitCreditFromNet(moveNet) : null,
      };
    }).sort((a,b) => a.account.localeCompare(b.account));

    // Totals at end date
    const totalNet = rows.reduce((s, r) => s + r.end.net, 0);
    const totals = {
      end: splitDebitCreditFromNet(totalNet),
      opening: openingMap.size ? splitDebitCreditFromNet(
        Array.from(openingMap.values()).reduce((s,n)=>s+n,0)
      ) : null,
      movement: openingMap.size ? splitDebitCreditFromNet(
        rows.reduce((s, r) => s + (r.movement?.debit || 0) - (r.movement?.credit || 0), 0)
      ) : null,
    };

    res.json({ asOf: end, from: start || null, rows, totals });
  } catch (e) {
    res.status(500).json({ error: e.message || "Trial Balance failed" });
  }
});

/* =========================================================
   PROFIT & LOSS
   - Query: GET /api/reports/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD
   - Includes only Revenue (4xxxx) and Expense (5-9xxxx) accounts.
   ========================================================= */
router.get("/pnl", async (req, res) => {
  try {
    const start = (req.query.start || new Date().toISOString().slice(0,10)).slice(0,10);
    const end   = (req.query.end   || new Date().toISOString().slice(0,10)).slice(0,10);

    const rows = await GeneralLedger.aggregate([
      { $match: {
          date: { $gte: toStart(start), $lte: toEnd(end) },
          // Only Revenue & Expense
          account: { $regex: /^[4-9]\d*/ }
      }},
      { $group: {
          _id: "$account",
          debit: { $sum: "$debit" },
          credit:{ $sum: "$credit" }
      }},
      { $sort: { _id: 1 } }
    ]);

    const detailed = rows.map(r => {
      const account = String(r._id);
      const cat = inferCategoryFromNumber(account);
      const net = Number(r.credit||0) - Number(r.debit||0); // P&L: revenue positive, expense negative
      return { account, category: cat, debit: r.debit || 0, credit: r.credit || 0, net };
    });

    const revenue = detailed
      .filter(r => r.category === "REVENUE")
      .reduce((s, r) => s + r.net, 0); // already credit - debit => positive
    const expense = detailed
      .filter(r => r.category === "EXPENSE")
      .reduce((s, r) => s + r.net, 0); // expenses come out negative here

    const netIncome = revenue + expense; // expense negative

    res.json({
      from: start, to: end,
      rows: detailed,
      totals: { revenue, expense, netIncome }
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "P&L failed" });
  }
});

/* =========================================================
   CASH REPORT (simple direct method on cash accounts)
   - Query: GET /api/reports/cash?start=YYYY-MM-DD&end=YYYY-MM-DD[&cash=1000,1010,1100]
   - Shows opening, inflow, outflow, net change, ending per cash account.
   - "Cash" means Assets accounts you pass (default 1000,1010,1100).
   ========================================================= */
router.get("/cash", async (req, res) => {
  try {
    const start = (req.query.start || new Date().toISOString().slice(0,10)).slice(0,10);
    const end   = (req.query.end   || new Date().toISOString().slice(0,10)).slice(0,10);
    const cashList = (req.query.cash || "1000,1010,1100")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // OPENING per account (sum < start): assets increase on debit
    const opening = await GeneralLedger.aggregate([
      { $match: { date: { $lt: toStart(start) }, account: { $in: cashList } } },
      { $group: { _id: "$account", debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
    ]);
    const openingMap = new Map(
      opening.map(r => [String(r._id), Number(r.debit||0) - Number(r.credit||0)])
    );

    // MOVEMENTS in range
    const period = await GeneralLedger.aggregate([
      { $match: { date: { $gte: toStart(start), $lte: toEnd(end) }, account: { $in: cashList } } },
      { $group: { _id: "$account", inflow: { $sum: "$debit" }, outflow: { $sum: "$credit" } } },
      { $sort: { _id: 1 } },
    ]);

    const rows = cashList.map(acct => {
      const p = period.find(x => String(x._id) === acct);
      const open = openingMap.get(acct) || 0;
      const inflow = Number(p?.inflow || 0);
      const outflow = Number(p?.outflow || 0);
      const change = inflow - outflow;       // asset cash increases on debit
      const ending = open + change;

      return { account: acct, opening: open, inflow, outflow, netChange: change, ending };
    });

    // Grand totals
    const totals = rows.reduce((t, r) => ({
      opening: t.opening + r.opening,
      inflow:  t.inflow  + r.inflow,
      outflow: t.outflow + r.outflow,
      netChange: t.netChange + r.netChange,
      ending: t.ending + r.ending,
    }), { opening:0, inflow:0, outflow:0, netChange:0, ending:0 });

    res.json({ from: start, to: end, cashAccounts: cashList, rows, totals });
  } catch (e) {
    res.status(500).json({ error: e.message || "Cash report failed" });
  }
});

export default router;
