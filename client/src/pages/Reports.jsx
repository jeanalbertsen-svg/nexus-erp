// client/src/pages/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Stack,
  Typography,
  Tabs,
  Tab,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Grid,
  Divider,
  Alert,
  TableContainer,
  Toolbar,
  IconButton,
  Tooltip,
  Skeleton,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useTheme, alpha } from "@mui/material/styles";
import { getTrialBalance, getPnL, getCashReport, getChartOfAccounts } from "../api";

/* -------------------- Formatting -------------------- */
const fmt = (n) =>
  (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });

/* -------------------- COA-range helpers -------------------- */
const isAsset = (n) => {
  const x = Number(n);
  return x >= 1000 && x <= 1999;
};
const isLiability = (n) => {
  const x = Number(n);
  return x >= 2000 && x <= 2999;
};
const isEquity = (n) => {
  const x = Number(n);
  return x >= 3000 && x <= 3999;
};
const isRevenue = (n) => {
  const x = Number(n);
  return x >= 4000 && x <= 4999;
};
const isExpense = (n) => {
  const x = Number(n);
  return x >= 5000 && x <= 9999;
};
const isCurrentAsset = (n) => Number(n) < 1500;
const isCurrentLiability = (n) => Number(n) < 2500;

/* -------------------- Dates -------------------- */
const toISO = (d) => String(d || "").slice(0, 10);
const inRange = (date, start, end) => {
  const d = toISO(date);
  return (!start || d >= start) && (!end || d <= end);
};

/* -------------------- Balance Sheet builder -------------------- */
function buildBalanceSheet(tb, nameMap = {}) {
  if (!tb?.rows) return { lines: [], totals: { A: 0, L: 0, E: 0, diff: 0 } };

  const lines = [];
  for (const r of tb.rows) {
    const acc = String(r.account);
    const dr = Number(r.end?.debit) || 0;
    const cr = Number(r.end?.credit) || 0;

    let section = null;
    let amount = 0;

    if (isAsset(acc)) {
      section = isCurrentAsset(acc) ? "Current Assets" : "Non-current Assets";
      amount = dr - cr; // assets normal debit
    } else if (isLiability(acc)) {
      section = isCurrentLiability(acc)
        ? "Current Liabilities"
        : "Non-current Liabilities";
      amount = cr - dr; // liabilities normal credit
    } else if (isEquity(acc)) {
      section = "Equity";
      amount = cr - dr; // equity normal credit
    } else {
      continue;
    }
    if (Math.abs(amount) < 1e-8) continue;

    const name =
      r.name ||
      r.accountName ||
      nameMap[acc] ||
      "";

    lines.push({ section, account: acc, name, amount });
  }

  const A = lines
    .filter((l) => l.section.includes("Assets"))
    .reduce((s, l) => s + l.amount, 0);
  const L = lines
    .filter((l) => l.section.includes("Liabilities"))
    .reduce((s, l) => s + l.amount, 0);
  const E = lines
    .filter((l) => l.section === "Equity")
    .reduce((s, l) => s + l.amount, 0);

  return {
    lines: lines.sort((a, b) => Number(a.account) - Number(b.account)),
    totals: { A, L, E, diff: A - (L + E) },
  };
}

/* -------------------- CSV helper -------------------- */
function csvDownload(filename, header, rows) {
  const csv = [header.join(",")]
    .concat(rows.map((r) => r.map((x) => String(x)).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ======================================================================
   LOCAL GL -> REPORT AGGREGATION (bridges Finance/GL to Reports)
   ====================================================================== */
const readLocalGlRows = () => {
  try {
    return JSON.parse(localStorage.getItem("gl.rows") || "[]");
  } catch {
    return [];
  }
};

const sumObj = (a = {}, b = {}) => ({
  debit: (a.debit || 0) + (b.debit || 0),
  credit: (a.credit || 0) + (b.credit || 0),
});

function buildLocalTrialBalance(glRows, { start, end }) {
  const byAcc = new Map();
  const up = (acc, key, add) => {
    const cur = byAcc.get(acc) || {
      account: acc,
      opening: { debit: 0, credit: 0 },
      movement: { debit: 0, credit: 0 },
      end: { debit: 0, credit: 0 },
    };
    cur[key] = sumObj(cur[key], add);
    // recalc end each step
    cur.end = {
      debit: cur.opening.debit + cur.movement.debit,
      credit: cur.opening.credit + cur.movement.credit,
    };
    byAcc.set(acc, cur);
  };

  for (const r of glRows) {
    const acc = String(r.account || "");
    if (!acc) continue;
    const dr = +r.debit || 0;
    const cr = +r.credit || 0;
    const d = toISO(r.date);

    if (start && d < start) {
      up(acc, "opening", { debit: dr, credit: cr });
    } else if (inRange(d, start, end)) {
      up(acc, "movement", { debit: dr, credit: cr });
    } else {
      // after end: ignore for TB in this period
    }
  }

  const rows = Array.from(byAcc.values()).sort((a, b) => +a.account - +b.account);
  return {
    rows,
    from: start,
    to: end,
    asOf: end,
    totals: {
      opening: rows.reduce(
        (s, r) => ({
          debit: s.debit + (r.opening.debit || 0),
          credit: s.credit + (r.opening.credit || 0),
        }),
        { debit: 0, credit: 0 }
      ),
      movement: rows.reduce(
        (s, r) => ({
          debit: s.debit + (r.movement.debit || 0),
          credit: s.credit + (r.movement.credit || 0),
        }),
        { debit: 0, credit: 0 }
      ),
      end: rows.reduce(
        (s, r) => ({
          debit: s.debit + (r.end.debit || 0),
          credit: s.credit + (r.end.credit || 0),
        }),
        { debit: 0, credit: 0 }
      ),
    },
  };
}

function mergeTrialBalance(api, local) {
  if (!api && !local) return null;
  const by = new Map();

  const addAll = (src, tag = "api") => {
    if (!src?.rows) return;
    for (const r of src.rows) {
      const acc = String(r.account);
      const cur =
        by.get(acc) || {
          account: acc,
          opening: { debit: 0, credit: 0 },
          movement: { debit: 0, credit: 0 },
          end: { debit: 0, credit: 0 },
        };
      cur.opening = sumObj(cur.opening, r.opening || { debit: 0, credit: 0 });
      cur.movement = sumObj(cur.movement, r.movement || { debit: 0, credit: 0 });
      cur.end = sumObj(cur.end, r.end || { debit: 0, credit: 0 });
      by.set(acc, cur);
    }
  };

  addAll(api, "api");
  addAll(local, "local");

  const rows = Array.from(by.values()).sort((a, b) => +a.account - +b.account);
  return {
    rows,
    from: api?.from || local?.from,
    to: api?.to || local?.to,
    asOf: api?.asOf || local?.asOf,
    totals: {
      opening: rows.reduce(
        (s, r) => ({ debit: s.debit + r.opening.debit, credit: s.credit + r.opening.credit }),
        { debit: 0, credit: 0 }
      ),
      movement: rows.reduce(
        (s, r) => ({ debit: s.debit + r.movement.debit, credit: s.credit + r.movement.credit }),
        { debit: 0, credit: 0 }
      ),
      end: rows.reduce(
        (s, r) => ({ debit: s.debit + r.end.debit, credit: s.credit + r.end.credit }),
        { debit: 0, credit: 0 }
      ),
    },
  };
}

function buildLocalPnL(glRows, { start, end }) {
  const byAcc = new Map();
  for (const r of glRows) {
    const acc = String(r.account || "");
    if (!acc || !inRange(r.date, start, end)) continue;
    if (!isRevenue(acc) && !isExpense(acc)) continue;

    const dr = +r.debit || 0;
    const cr = +r.credit || 0;

    const cur =
      byAcc.get(acc) || {
        account: acc,
        name: "",
        category: isRevenue(acc) ? "Revenue" : "Expense",
        debit: 0,
        credit: 0,
        net: 0,
      };
    cur.debit += dr;
    cur.credit += cr;
    cur.net = cur.credit - cur.debit; // Rev positive, Exp negative
    byAcc.set(acc, cur);
  }

  const rows = Array.from(byAcc.values()).sort((a, b) => +a.account - +b.account);
  const totals = {
    netIncome: rows.reduce((s, r) => s + r.net, 0),
  };
  return { rows, from: start, to: end, totals };
}

function mergePnL(api, local) {
  if (!api && !local) return null;
  const by = new Map();
  const addAll = (src) => {
    if (!src?.rows) return;
    for (const r of src.rows) {
      const acc = String(r.account);
      const cur =
        by.get(acc) || {
          account: acc,
          name: r.name || "",
          category: r.category || (isRevenue(acc) ? "Revenue" : "Expense"),
          debit: 0,
          credit: 0,
          net: 0,
        };
      cur.debit += +r.debit || 0;
      cur.credit += +r.credit || 0;
      cur.net += +r.net || (+r.credit || 0) - (+r.debit || 0);
      by.set(acc, cur);
    }
  };
  addAll(api);
  addAll(local);
  const rows = Array.from(by.values()).sort((a, b) => +a.account - +b.account);
  return {
    rows,
    from: api?.from || local?.from,
    to: api?.to || local?.to,
    totals: { netIncome: rows.reduce((s, r) => s + r.net, 0) },
  };
}

function buildLocalCash(glRows, { start, end, cashAccounts }) {
  const targets = new Set(
    String(cashAccounts || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const byAcc = new Map();
  const ensure = (acc) =>
    byAcc.get(acc) ||
    byAcc.set(acc, { account: acc, opening: 0, inflow: 0, outflow: 0, netChange: 0, ending: 0 }).get(acc);

  for (const r of glRows) {
    const acc = String(r.account || "");
    if (!acc || (targets.size && !targets.has(acc))) continue;
    const d = toISO(r.date);
    const dr = +r.debit || 0;
    const cr = +r.credit || 0;
    const row = ensure(acc);

    if (start && d < start) {
      row.opening += dr - cr; // asset cash: dr increases, cr decreases
    } else if (inRange(d, start, end)) {
      row.inflow += dr;
      row.outflow += cr;
    }
  }

  for (const r of byAcc.values()) {
    r.netChange = r.inflow - r.outflow;
    r.ending = r.opening + r.netChange;
  }

  const rows = Array.from(byAcc.values()).sort((a, b) => +a.account - +b.account);
  const totals = {
    opening: rows.reduce((s, r) => s + r.opening, 0),
    inflow: rows.reduce((s, r) => s + r.inflow, 0),
    outflow: rows.reduce((s, r) => s + r.outflow, 0),
    netChange: rows.reduce((s, r) => s + r.netChange, 0),
    ending: rows.reduce((s, r) => s + r.ending, 0),
  };

  return { rows, from: start, to: end, cashAccounts: Array.from(targets), totals };
}

function mergeCash(api, local) {
  if (!api && !local) return null;
  const by = new Map();
  const addAll = (src, which) => {
    if (!src?.rows) return;
    for (const r of src.rows) {
      const acc = String(r.account);
      const cur =
        by.get(acc) || {
          account: acc,
          opening: 0,
          inflow: 0,
          outflow: 0,
          netChange: 0,
          ending: 0,
        };
      cur.opening += +r.opening || 0;
      cur.inflow += +r.inflow || 0;
      cur.outflow += +r.outflow || 0;
      cur.netChange += +r.netChange || (+r.inflow || 0) - (+r.outflow || 0);
      cur.ending += +r.ending || cur.opening + cur.netChange;
      by.set(acc, cur);
    }
  };
  addAll(api, "api");
  addAll(local, "local");

  const rows = Array.from(by.values()).sort((a, b) => +a.account - +b.account);
  const totals = {
    opening: rows.reduce((s, r) => s + r.opening, 0),
    inflow: rows.reduce((s, r) => s + r.inflow, 0),
    outflow: rows.reduce((s, r) => s + r.outflow, 0),
    netChange: rows.reduce((s, r) => s + r.netChange, 0),
    ending: rows.reduce((s, r) => s + r.ending, 0),
  };
  const cashAccounts = Array.from(
    new Set([...(api?.cashAccounts || []), ...(local?.cashAccounts || [])])
  );
  return {
    rows,
    from: api?.from || local?.from,
    to: api?.to || local?.to,
    cashAccounts,
    totals,
  };
}

/* ======================================================================
   Analytics + AI-style News Notes helpers
   ====================================================================== */

function buildAnalytics(tb, pnl, cash, bs) {
  if (!tb && !pnl && !cash && !bs) return null;

  // Revenue / Expenses / Net Income
  let revenue = 0;
  let expenses = 0;
  if (pnl?.rows) {
    pnl.rows.forEach((r) => {
      const net =
        typeof r.net === "number"
          ? r.net
          : (+r.credit || 0) - (+r.debit || 0);
      if (r.category === "Revenue") {
        revenue += net;
      } else if (r.category === "Expense") {
        // net is negative for expenses in our builder, flip sign to get positive "cost"
        expenses += Math.abs(net);
      }
    });
  }
  const netIncome =
    typeof pnl?.totals?.netIncome === "number"
      ? pnl.totals.netIncome
      : revenue - expenses;

  // Balance sheet structure
  let currentAssets = 0;
  let nonCurrentAssets = 0;
  let currentLiabilities = 0;
  let nonCurrentLiabilities = 0;

  if (bs?.lines) {
    bs.lines.forEach((l) => {
      if (l.section === "Current Assets") currentAssets += l.amount || 0;
      if (l.section === "Non-current Assets") nonCurrentAssets += l.amount || 0;
      if (l.section === "Current Liabilities") currentLiabilities += l.amount || 0;
      if (l.section === "Non-current Liabilities")
        nonCurrentLiabilities += l.amount || 0;
    });
  }

  const assets = bs?.totals?.A ?? currentAssets + nonCurrentAssets;
  const liabilities = bs?.totals?.L ?? currentLiabilities + nonCurrentLiabilities;
  const equity = bs?.totals?.E ?? 0;

  const currentRatio =
    currentLiabilities !== 0 ? currentAssets / currentLiabilities : null;
  const debtToEquity =
    equity !== 0 ? liabilities / equity : null;

  // Cash
  const cashOpening = cash?.totals?.opening ?? 0;
  const cashInflow = cash?.totals?.inflow ?? 0;
  const cashOutflow = cash?.totals?.outflow ?? 0;
  const cashEnding = cash?.totals?.ending ?? 0;
  const cashNetChange = cashInflow - cashOutflow;

  // Rough cash coverage vs. period expenses
  const cashCoverage =
    expenses > 0 ? cashEnding / expenses : null; // "periods" of expenses covered

  return {
    revenue,
    expenses,
    netIncome,
    assets,
    liabilities,
    equity,
    currentAssets,
    currentLiabilities,
    currentRatio,
    debtToEquity,
    cashOpening,
    cashInflow,
    cashOutflow,
    cashEnding,
    cashNetChange,
    cashCoverage,
  };
}

function buildAiNewsNotes(analytics) {
  if (!analytics) return [];

  const {
    revenue,
    expenses,
    netIncome,
    currentRatio,
    debtToEquity,
    cashInflow,
    cashOutflow,
    cashEnding,
    cashNetChange,
  } = analytics;

  const notes = [];

  // 1) Profitability headline
  if (revenue || expenses || netIncome) {
    const profitable = netIncome > 0;
    const margin =
      revenue > 0 ? (netIncome / revenue) * 100 : null;

    notes.push({
      id: "profitability",
      tag: profitable ? "Profitability" : "Turnaround",
      title: profitable
        ? "Profitable period – time to lock in a stronger margin"
        : "Loss-making period – focus on margin and cost structure",
      summary: profitable
        ? `Your net income for this period is ${fmt(
            netIncome
          )}. That means the business is generating a surplus that can be reinvested or used to build a cash buffer${
            margin !== null ? `, with an estimated margin of ${margin.toFixed(1)}%.` : "."
          }`
        : `Your net income for this period is ${fmt(
            netIncome
          )}, indicating a loss. This is a signal to review pricing, volume, and fixed cost structure.`,
      actions: profitable
        ? [
            "Review pricing and product mix to see where margins are strongest, then prioritize those lines.",
            "Allocate a fixed percentage of monthly profit directly into a strategic reserve or investment budget.",
            "Set quarterly profitability targets (percent margin, not just absolute DKK) and track them on the dashboard.",
          ]
        : [
            "Identify top 5 cost lines and set a reduction target (e.g. 5–10%) over the next quarter.",
            "Re-evaluate low-margin products or services; consider price adjustment or phase-out.",
            "Simulate break-even scenarios in your budgeting tool to understand required revenue to return to profit.",
          ],
    });
  }

  // 2) Liquidity / cash-management headline
  if (cashInflow || cashOutflow || cashEnding) {
    const cashTight = cashNetChange < 0 || cashEnding < 0;
    notes.push({
      id: "cash",
      tag: "Liquidity & Cash",
      title: cashTight
        ? "Cash flow under pressure – protect runway"
        : "Positive cash flow – strengthen your runway",
      summary: cashTight
        ? `Net cash movement for the period is ${fmt(
            cashNetChange
          )}, with an ending balance of ${fmt(
            cashEnding
          )}. Outflows are currently outweighing inflows, so short-term liquidity should be monitored closely.`
        : `Net cash movement for the period is ${fmt(
            cashNetChange
          )}, and you close with ${fmt(
            cashEnding
          )}. This is a good opportunity to set clear policies for how surplus cash should be used or reserved.`,
      actions: cashTight
        ? [
            "Delay non-critical investments and focus cash on core revenue-generating activities.",
            "Negotiate payment terms with suppliers and aim to align cash outflows with incoming customer payments.",
            "Implement weekly cash reporting so management always knows the minimum 4–8 week cash runway.",
          ]
        : [
            "Define a target minimum cash buffer (e.g. 2–3 months of fixed costs) and track progress against it.",
            "Evaluate options for low-risk short-term placement of excess cash or pre-payment of high-cost debt.",
            "Set up a simple policy: e.g. 'X% of positive cash flow is reserved for growth projects each quarter.'",
          ],
    });
  }

  // 3) Balance sheet / structure headline
  if (currentRatio !== null || debtToEquity !== null) {
    const safeLiquidity = currentRatio !== null && currentRatio >= 1.5;
    const higherLeverage = debtToEquity !== null && debtToEquity > 1.5;

    let title = "Balance sheet structure – monitor risk and flexibility";
    if (safeLiquidity && !higherLeverage) {
      title = "Solid balance sheet – room to plan for growth";
    } else if (!safeLiquidity && higherLeverage) {
      title = "Tight liquidity and higher leverage – de-risk the balance sheet";
    }

    const ratioDescParts = [];
    if (currentRatio !== null) {
      ratioDescParts.push(
        `Current ratio (Current Assets / Current Liabilities) is approx. ${currentRatio.toFixed(
          2
        )}.`
      );
    }
    if (debtToEquity !== null) {
      ratioDescParts.push(
        `Debt-to-equity is around ${debtToEquity.toFixed(2)}.`
      );
    }

    notes.push({
      id: "structure",
      tag: "Capital Structure",
      title,
      summary:
        ratioDescParts.join(" ") ||
        "Key structure ratios are available. Use them to understand how flexible and robust your balance sheet is.",
      actions: [
        "Define target ranges for key ratios (current ratio, debt-to-equity) that fit your industry and risk appetite.",
        "If leverage is high, consider slowing new borrowing and prioritising repayment of expensive debt.",
        "If liquidity is weak, explore options such as credit lines, equity injection, or asset-light models for new projects.",
      ],
    });
  }

  return notes;
}
/* -------------------- Main -------------------- */
export default function Reports() {
  const theme = useTheme();
  const divider = theme.palette.divider;
  const headBg = theme.palette.primary.main;
  const headFg = theme.palette.getContrastText(headBg);
  const zebra = alpha(
    theme.palette.primary.main,
    theme.palette.mode === "dark" ? 0.06 : 0.03
  );

  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState(0);

  // Dates
  const [start, setStart] = useState(today.slice(0, 8) + "01");
  const [end, setEnd] = useState(today);

  // --- Account names (COA) ---
  const [nameMap, setNameMap] = useState({});
  const [coaError, setCoaError] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        setCoaError(null);
        const coa = await getChartOfAccounts(); // [{number,name,...}]
        const map = Object.fromEntries(
          (Array.isArray(coa) ? coa : []).map((a) => [String(a.number), a.name || ""])
        );
        setNameMap(map);
      } catch (e) {
        setNameMap({});
        setCoaError("Failed to load account names");
      }
    })();
  }, []);

  /* --------- Local GL rows bridge (Finance/GL -> Reports) --------- */
  const [localGlRows, setLocalGlRows] = useState(() => readLocalGlRows());

  useEffect(() => {
    const onAdded = (e) => {
      const added = Array.isArray(e?.detail) ? e.detail : [];
      if (!added.length) return;
      setLocalGlRows((prev) => [...prev, ...added]);
    };
    const onStorage = (ev) => {
      if (ev.key === "gl.rows") {
        setLocalGlRows(readLocalGlRows());
      }
    };
    window.addEventListener("gl:rows-added", onAdded);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("gl:rows-added", onAdded);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Trial Balance
  const [tb, setTb] = useState(null);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbError, setTbError] = useState(null);
  const loadTB = async () => {
    try {
      setTbLoading(true);
      setTbError(null);
      const api = await getTrialBalance({ start, end });
      const local = buildLocalTrialBalance(localGlRows, { start, end });
      setTb(mergeTrialBalance(api, local));
    } catch (e) {
      // even if API fails, fall back to local
      try {
        const local = buildLocalTrialBalance(localGlRows, { start, end });
        setTb(mergeTrialBalance(null, local));
      } catch {
        setTb(null);
      }
      setTbError("Failed to load Trial Balance");
    } finally {
      setTbLoading(false);
    }
  };

  // P&L
  const [pnl, setPnl] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlError, setPnlError] = useState(null);
  const loadPnL = async () => {
    try {
      setPnlLoading(true);
      setPnlError(null);
      const api = await getPnL({ start, end });
      const local = buildLocalPnL(localGlRows, { start, end });
      setPnl(mergePnL(api, local));
    } catch (e) {
      try {
        const local = buildLocalPnL(localGlRows, { start, end });
        setPnl(mergePnL(null, local));
      } catch {
        setPnl(null);
      }
      setPnlError("Failed to load Profit & Loss");
    } finally {
      setPnlLoading(false);
    }
  };

  // Cash
  const [cash, setCash] = useState(null);
  const [cashList, setCashList] = useState("1000,1010,1100");
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState(null);
  const loadCash = async () => {
    try {
      setCashLoading(true);
      setCashError(null);
      const api = await getCashReport({ start, end, cash: cashList });
      const local = buildLocalCash(localGlRows, { start, end, cashAccounts: cashList });
      setCash(mergeCash(api, local));
    } catch (e) {
      try {
        const local = buildLocalCash(localGlRows, { start, end, cashAccounts: cashList });
        setCash(mergeCash(null, local));
      } catch {
        setCash(null);
      }
      setCashError("Failed to load Cash report");
    } finally {
      setCashLoading(false);
    }
  };

  // initial + reactive fetch
  useEffect(() => {
    loadTB();
    loadPnL();
    loadCash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-run when period, cash list, or local GL rows change
  useEffect(() => {
    loadTB();
    loadPnL();
    loadCash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, cashList, localGlRows.length]);

  /* ---------- Derived TB totals (handles blank API totals) ---------- */
  const tbTotals = useMemo(() => {
    if (!tb?.rows?.length)
      return {
        end: { debit: 0, credit: 0 },
        open: { debit: 0, credit: 0 },
        move: { debit: 0, credit: 0 },
      };

    const sum = tb.rows.reduce(
      (acc, r) => {
        acc.end.debit += +r?.end?.debit || 0;
        acc.end.credit += +r?.end?.credit || 0;
        acc.open.debit += +r?.opening?.debit || 0;
        acc.open.credit += +r?.opening?.credit || 0;
        acc.move.debit += +r?.movement?.debit || 0;
        acc.move.credit += +r?.movement?.credit || 0;
        return acc;
      },
      {
        end: { debit: 0, credit: 0 },
        open: { debit: 0, credit: 0 },
        move: { debit: 0, credit: 0 },
      }
    );

    const api = tb?.totals;
    const apiLooksValid =
      api &&
      (Number(api?.end?.debit || 0) !== 0 ||
        Number(api?.end?.credit || 0) !== 0 ||
        Number(api?.opening?.debit || 0) !== 0 ||
        Number(api?.opening?.credit || 0) !== 0 ||
        Number(api?.movement?.debit || 0) !== 0 ||
        Number(api?.movement?.credit || 0) !== 0);

    return apiLooksValid
      ? {
          end: {
            debit: +api.end.debit || 0,
            credit: +api.end.credit || 0,
          },
          open: {
            debit: +api.opening?.debit || 0,
            credit: +api.opening?.credit || 0,
          },
          move: {
            debit: +api.movement?.debit || 0,
            credit: +api.movement?.credit || 0,
          },
        }
      : sum;
  }, [tb]);

  // Derived Balance Sheet (with account names)
  const bs = useMemo(() => buildBalanceSheet(tb, nameMap), [tb, nameMap]);

  // Analytics & AI notes
  const analytics = useMemo(
    () => buildAnalytics(tb, pnl, cash, bs),
    [tb, pnl, cash, bs]
  );
  const aiNotes = useMemo(() => buildAiNewsNotes(analytics), [analytics]);
  const anyLoading = tbLoading || pnlLoading || cashLoading;

  // Detail view for AI News Notes
  const [aiDetailOpen, setAiDetailOpen] = useState(false);

  const handleRefresh = () => {
    if (tab === 0 || tab === 2) loadTB();
    else if (tab === 1) loadPnL();
    else loadCash();
  };

  const handleExport = () => {
    if (tab === 0 && tb) {
      csvDownload(
        "trial_balance.csv",
        [
          "Account",
          "Name",
          "End Debit",
          "End Credit",
          "Open Dr",
          "Open Cr",
          "Move Dr",
          "Move Cr",
        ],
        tb.rows.map((r) => [
          `"${r.account}"`,
          `"${(nameMap[r.account] || r.name || "").replace(/"/g, '""')}"`,
          (r.end?.debit || 0).toFixed(2).replace(".", ","),
          (r.end?.credit || 0).toFixed(2).replace(".", ","),
          (r.opening?.debit || 0).toFixed(2).replace(".", ","),
          (r.opening?.credit || 0).toFixed(2).replace(".", ","),
          (r.movement?.debit || 0).toFixed(2).replace(".", ","),
          (r.movement?.credit || 0).toFixed(2).replace(".", ","),
        ])
      );
    } else if (tab === 1 && pnl) {
      csvDownload(
        "profit_and_loss.csv",
        ["Account", "Name", "Category", "Debit", "Credit", "Net"],
        pnl.rows.map((r) => [
          `"${r.account}"`,
          `"${(nameMap[r.account] || r.name || "").replace(/"/g, '""')}"`,
          `"${r.category}"`,
          (r.debit || 0).toFixed(2).replace(".", ","),
          (r.credit || 0).toFixed(2).replace(".", ","),
          (r.net || 0).toFixed(2).replace(".", ","),
        ])
      );
    } else if (tab === 2 && bs) {
      const rows = [
        ...bs.lines.map((l) => [
          `"${l.section}"`,
          `"${l.account}"`,
          `"${(l.name || "").replace(/"/g, '""')}"`,
          (l.amount || 0).toFixed(2).replace(".", ","),
        ]),
        ["TOTAL", "", "Assets", (bs.totals.A || 0).toFixed(2).replace(".", ",")],
        ["TOTAL", "", "Liabilities", (bs.totals.L || 0).toFixed(2).replace(".", ",")],
        ["TOTAL", "", "Equity", (bs.totals.E || 0).toFixed(2).replace(".", ",")],
        [
          "CHECK",
          "",
          "Assets - (Liabilities + Equity)",
          (bs.totals.diff || 0).toFixed(2).replace(".", ","),
        ],
      ];
      csvDownload("balance_sheet.csv", ["Section", "Account", "Name", "Amount"], rows);
    } else if (tab === 3 && cash) {
      csvDownload(
        "cash_report.csv",
        ["Account", "Name", "Opening", "Inflow", "Outflow", "Net Change", "Ending"],
        cash.rows.map((r) => [
          `"${r.account}"`,
          `"${(nameMap[r.account] || "").replace(/"/g, '""')}"`,
          (r.opening || 0).toFixed(2).replace(".", ","),
          (r.inflow || 0).toFixed(2).replace(".", ","),
          (r.outflow || 0).toFixed(2).replace(".", ","),
          (r.netChange || 0).toFixed(2).replace(".", ","),
          (r.ending || 0).toFixed(2).replace(".", ","),
        ])
      );
    }
  };

  const ToolbarCard = (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        borderColor: divider,
        bgcolor: "background.paper",
      }}
    >
      <Toolbar disableGutters sx={{ gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle1" sx={{ px: 1, mr: 1 }}>
          Reporting period
        </Typography>
        <TextField
          label="Start"
          type="date"
          size="small"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 170 }}
        />
        <TextField
          label="End"
          type="date"
          size="small"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 170 }}
        />

        {tab === 3 && (
          <TextField
            label="Cash accounts (CSV)"
            size="small"
            value={cashList}
            onChange={(e) => setCashList(e.target.value)}
            sx={{ minWidth: 260 }}
          />
        )}

        <Stack direction="row" sx={{ ml: "auto" }}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export CSV">
            <IconButton onClick={handleExport}>
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </Paper>
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h5" sx={{ color: theme.palette.primary.main, fontWeight: 800 }}>
          Reports
        </Typography>
        <Tooltip title="Balance Sheet uses end-of-period balances.">
          <InfoOutlinedIcon fontSize="small" color="action" />
        </Tooltip>
      </Stack>

      {ToolbarCard}
      {coaError && <Alert severity="warning">{coaError}</Alert>}

      {/* ONE outer Paper for all tabs. Balance Sheet stays inside this single box */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 2, overflow: "hidden", borderColor: divider }}
      >
        {/* Financial overview + AI news notes */}
        {(analytics || anyLoading) && (
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{
              p: 2,
              borderBottom: `1px solid ${divider}`,
              bgcolor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === "dark" ? 0.08 : 0.03
              ),
            }}
          >
            <Box flex={1} minWidth={0}>
              <FinancialOverview analytics={analytics} loading={anyLoading} />
            </Box>
            <Box
              flex={1}
              minWidth={0}
              maxWidth={{ xs: "100%", md: 630 }} // 50% wider than before
            >
              <AiNewsNotesPanel
                analytics={analytics}
                notes={aiNotes}
                onViewDetails={() => setAiDetailOpen(true)}
              />
            </Box>
          </Stack>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          sx={{
            px: 1,
            borderBottom: `1px solid ${divider}`,
            position: "sticky",
            top: 0,
            zIndex: 1,
            bgcolor: "background.paper",
            "& .MuiTab-root.Mui-selected": { color: theme.palette.primary.main },
            "& .MuiTabs-indicator": { bgcolor: theme.palette.primary.main },
          }}
        >
          <Tab label="Trial Balance" />
          <Tab label="Profit & Loss" />
          <Tab label="Balance Sheet" />
          <Tab label="Cash" />
        </Tabs>

        {/* ---------- Trial Balance ---------- */}
        {tab === 0 && (
          <SectionWrap
            loading={tbLoading}
            error={tbError}
            empty={!tb?.rows?.length}
            emptyText="No trial balance rows for the selected period."
          >
            {tb && (
              <Stack spacing={2} p={2}>
                <SummaryChips
                  items={[
                    { label: "End Debit", value: fmt(tbTotals.end.debit), color: "success" },
                    { label: "End Credit", value: fmt(tbTotals.end.credit), color: "error" },
                  ]}
                />
                <Typography variant="body2" color="text.secondary">
                  As of {tb.asOf}
                  {tb.from ? ` (from ${tb.from})` : ""}
                </Typography>

                <ThemedTable
                  headBg={headBg}
                  headFg={headFg}
                  zebra={zebra}
                  divider={divider}
                  head={
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      {tb.from && (
                        <>
                          <TableCell align="right">Open Dr</TableCell>
                          <TableCell align="right">Open Cr</TableCell>
                          <TableCell align="right">Move Dr</TableCell>
                          <TableCell align="right">Move Cr</TableCell>
                        </>
                      )}
                    </TableRow>
                  }
                  body={
                    <>
                      {tb.rows.map((r) => (
                        <TableRow key={r.account}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{r.account}</TableCell>
                          <TableCell>{nameMap[r.account] || r.name || "-"}</TableCell>
                          <TableCell align="right">{fmt(r.end.debit)}</TableCell>
                          <TableCell align="right">{fmt(r.end.credit)}</TableCell>
                          {tb.from && (
                            <>
                              <TableCell align="right">{fmt(r.opening?.debit || 0)}</TableCell>
                              <TableCell align="right">{fmt(r.opening?.credit || 0)}</TableCell>
                              <TableCell align="right">{fmt(r.movement?.debit || 0)}</TableCell>
                              <TableCell align="right">{fmt(r.movement?.credit || 0)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                        <TableCell />
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(tbTotals.end.debit)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(tbTotals.end.credit)}
                        </TableCell>
                        {tb.from && (
                          <>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {fmt(tbTotals.open.debit)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {fmt(tbTotals.open.credit)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {fmt(tbTotals.move.debit)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {fmt(tbTotals.move.credit)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    </>
                  }
                />
              </Stack>
            )}
          </SectionWrap>
        )}

        {/* ---------- Profit & Loss ---------- */}
        {tab === 1 && (
          <SectionWrap
            loading={pnlLoading}
            error={pnlError}
            empty={!pnl?.rows?.length}
            emptyText="No P&L rows for the selected period."
          >
            {pnl && (
              <Stack spacing={2} p={2}>
                <SummaryChips
                  items={[
                    { label: "Net Income", value: fmt(pnl.totals?.netIncome || 0) },
                  ]}
                />
                <Typography variant="body2" color="text.secondary">
                  {pnl.from} → {pnl.to}
                </Typography>

                <ThemedTable
                  headBg={headBg}
                  headFg={headFg}
                  zebra={zebra}
                  divider={divider}
                  head={
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="right">Net (Rev - Exp)</TableCell>
                    </TableRow>
                  }
                  body={
                    <>
                      {pnl.rows.map((r) => (
                        <TableRow key={r.account}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {r.account}{" "}
                            <Chip size="small" label={r.category} variant="outlined" sx={{ ml: 1 }} />
                          </TableCell>
                          <TableCell>{nameMap[r.account] || r.name || "-"}</TableCell>
                          <TableCell align="right">{fmt(r.debit)}</TableCell>
                          <TableCell align="right">{fmt(r.credit)}</TableCell>
                          <TableCell align="right">{fmt(r.net)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Totals</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(pnl.totals.netIncome)}
                        </TableCell>
                      </TableRow>
                    </>
                  }
                />
              </Stack>
            )}
          </SectionWrap>
        )}

        {/* ---------- Balance Sheet (ONE BOX, two columns inside) ---------- */}
        {tab === 2 && (
          <SectionWrap
            loading={tbLoading && !tb}
            error={tbError}
            empty={!bs?.lines?.length}
            emptyText="No balance sheet accounts for the selected period."
          >
            {tb && (
              <Stack p={2} spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  As of {tb.asOf} (built from Trial Balance)
                </Typography>

                {Math.abs(bs.totals.diff) > 1e-6 && (
                  <Alert severity="warning">
                    Balance check mismatch: Assets {fmt(bs.totals.A)} vs Liabilities + Equity{" "}
                    {fmt(bs.totals.L + bs.totals.E)} (Δ {fmt(bs.totals.diff)}).
                  </Alert>
                )}

                <Grid container spacing={2}>
                  {/* Assets (left column) */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
                      Assets
                    </Typography>

                    {/* non-current first */}
                    <Subsection
                      title="Non-current Assets"
                      rows={bs.lines.filter((l) => l.section === "Non-current Assets")}
                      headBg={headBg}
                      headFg={headFg}
                      zebra={zebra}
                      divider={divider}
                    />
                    <Divider sx={{ my: 2 }} />
                    <Subsection
                      title="Current Assets"
                      rows={bs.lines.filter((l) => l.section === "Current Assets")}
                      headBg={headBg}
                      headFg={headFg}
                      zebra={zebra}
                      divider={divider}
                    />
                    <Divider sx={{ my: 2 }} />
                    <RowTotal label="Total Assets" amount={bs.totals.A} />
                  </Grid>

                  {/* Liabilities & Equity (right column) */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
                      Liabilities
                    </Typography>

                    <Subsection
                      title="Current Liabilities"
                      rows={bs.lines.filter((l) => l.section === "Current Liabilities")}
                      headBg={headBg}
                      headFg={headFg}
                      zebra={zebra}
                      divider={divider}
                    />
                    <Divider sx={{ my: 2 }} />
                    <Subsection
                      title="Non-current Liabilities"
                      rows={bs.lines.filter((l) => l.section === "Non-current Liabilities")}
                      headBg={headBg}
                      headFg={headFg}
                      zebra={zebra}
                      divider={divider}
                    />

                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
                      Equity
                    </Typography>
                    <Subsection
                      title=""
                      rows={bs.lines.filter((l) => l.section === "Equity")}
                      headBg={headBg}
                      headFg={headFg}
                      zebra={zebra}
                      divider={divider}
                    />
                    <Divider sx={{ my: 2 }} />
                    <RowTotal label="Total Liabilities & Equity" amount={bs.totals.L + bs.totals.E} />
                  </Grid>
                </Grid>
              </Stack>
            )}
          </SectionWrap>
        )}

        {/* ---------- Cash ---------- */}
        {tab === 3 && (
          <SectionWrap
            loading={cashLoading}
            error={cashError}
            empty={!cash?.rows?.length}
            emptyText="No cash activity for the selected period."
          >
            {cash && (
              <Stack spacing={2} p={2}>
                <SummaryChips
                  items={[
                    { label: "Opening", value: fmt(cash.totals?.opening || 0) },
                    { label: "Inflow", value: fmt(cash.totals?.inflow || 0) },
                    { label: "Outflow", value: fmt(cash.totals?.outflow || 0) },
                    { label: "Ending", value: fmt(cash.totals?.ending || 0) },
                  ]}
                />
                <Typography variant="body2" color="text.secondary">
                  {cash.from} → {cash.to} • Accounts:{" "}
                  {cash.cashAccounts
                    .map((a) => `${a}${nameMap[a] ? ` • ${nameMap[a]}` : ""}`)
                    .join(", ")}
                </Typography>

                <ThemedTable
                  headBg={headBg}
                  headFg={headFg}
                  zebra={zebra}
                  divider={divider}
                  head={
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Opening</TableCell>
                      <TableCell align="right">Inflow</TableCell>
                      <TableCell align="right">Outflow</TableCell>
                      <TableCell align="right">Net Change</TableCell>
                      <TableCell align="right">Ending</TableCell>
                    </TableRow>
                  }
                  body={
                    <>
                      {cash.rows.map((r) => (
                        <TableRow key={r.account}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{r.account}</TableCell>
                          <TableCell>{nameMap[r.account] || "-"}</TableCell>
                          <TableCell align="right">{fmt(r.opening)}</TableCell>
                          <TableCell align="right">{fmt(r.inflow)}</TableCell>
                          <TableCell align="right">{fmt(r.outflow)}</TableCell>
                          <TableCell align="right">{fmt(r.netChange)}</TableCell>
                          <TableCell align="right">
                            <b>{fmt(r.ending)}</b>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                        <TableCell />
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(cash.totals.opening)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(cash.totals.inflow)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(cash.totals.outflow)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(cash.totals.netChange)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {fmt(cash.totals.ending)}
                        </TableCell>
                      </TableRow>
                    </>
                  }
                />
              </Stack>
            )}
          </SectionWrap>
        )}
      </Paper>

      {/* Detail "view page" for AI News Notes with bars + plan of actions */}
      <AiNewsNotesDetailView
        open={aiDetailOpen}
        onClose={() => setAiDetailOpen(false)}
        analytics={analytics}
        notes={aiNotes}
      />
    </Stack>
  );
}
/* -------------------- Presentational bits (theme-aligned) -------------------- */
function SectionWrap({ loading, error, empty, emptyText, children }) {
  if (loading)
    return (
      <Stack p={2} spacing={2}>
        <Skeleton variant="rounded" height={50} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (empty)
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        {emptyText}
      </Alert>
    );
  return children;
}

function SummaryChips({ items }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {items.map((it, i) => (
        <Chip
          key={i}
          label={`${it.label}: ${it.value}`}
          color={it.color}
          variant={it.color ? "filled" : "outlined"}
          sx={{ fontWeight: 600 }}
        />
      ))}
    </Stack>
  );
}

/** Framed table by default. Pass framed={false} to make it borderless (for inner BS sections). */
function ThemedTable({ head, body, headBg, headFg, zebra, divider, framed = true }) {
  return (
    <TableContainer
      sx={{
        borderRadius: framed ? 2 : 0,
        border: framed ? `1px solid ${divider}` : "none",
        maxHeight: 520,
      }}
    >
      <Table
        size="small"
        stickyHeader
        sx={{
          "& th, & td": { borderColor: divider },
          "& thead th": {
            bgcolor: headBg,
            color: headFg,
            borderBottom: `2px solid ${headBg}`,
            fontSize: 14, // normal header size
            fontWeight: 600,
            whiteSpace: "nowrap",
          },
          "& td": { fontSize: 14 }, // normal body size
          "& tbody tr:nth-of-type(odd)": { bgcolor: zebra },
        }}
      >
        <TableHead>
          <TableRow>{head.props.children}</TableRow>
        </TableHead>
        <TableBody>{body.props.children}</TableBody>
      </Table>
    </TableContainer>
  );
}

function Subsection({ title, rows, headBg, headFg, zebra, divider }) {
  const subtotal = (rows || []).reduce((s, r) => s + (r.amount || 0), 0);
  return (
    <Stack spacing={1}>
      {title ? (
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      ) : null}
      <ThemedTable
        headBg={headBg}
        headFg={headFg}
        zebra={zebra}
        divider={divider}
        framed={false}  // Borderless inner table so everything sits in ONE outer card
        head={
          <TableRow>
            <TableCell sx={{ width: 120 }}>Account</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right" sx={{ width: 160 }}>
              Amount (DKK)
            </TableCell>
          </TableRow>
        }
        body={
          <>
            {(rows || []).map((r) => (
              <TableRow key={r.account}>
                <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.account}</TableCell>
                <TableCell>{r.name || "-"}</TableCell>
                <TableCell align="right">{fmt(r.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell />
              <TableCell sx={{ fontWeight: 700 }}>Subtotal</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {fmt(subtotal)}
              </TableCell>
            </TableRow>
          </>
        }
      />
    </Stack>
  );
}

function RowTotal({ label, amount }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
      <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700 }}>{fmt(amount)}</Typography>
    </Stack>
  );
}

/* -------------------- Financial overview mini-charts -------------------- */

function clampRatio(r) {
  if (!Number.isFinite(r) || r < 0) return 0;
  if (r > 2) return 2; // cap at 200% to avoid super long bars
  return r;
}

function MetricBar({ label, primary, secondary, tertiary, unit = "DKK", hint }) {
  // primary, secondary, tertiary are numbers (can be 0)
  const maxBase = Math.max(
    Math.abs(primary || 0),
    Math.abs(secondary || 0),
    Math.abs(tertiary || 0),
    1
  );

  const pct = (v) => `${(clampRatio(Math.abs(v) / maxBase) * 100).toFixed(0)}%`;

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              overflow: "hidden",
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
            }}
          >
            <Box
              sx={{
                height: "100%",
                width: pct(primary),
                borderRadius: 999,
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.8),
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ minWidth: 90, textAlign: "right" }}>
            {unit === "DKK" ? fmt(primary) : primary.toFixed(2)}
          </Typography>
        </Stack>

        {secondary !== undefined && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box
              sx={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                overflow: "hidden",
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.03)",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: pct(secondary),
                  borderRadius: 999,
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.7),
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ minWidth: 90, textAlign: "right" }}>
              {unit === "DKK" ? fmt(secondary) : secondary.toFixed(2)}
            </Typography>
          </Stack>
        )}

        {tertiary !== undefined && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box
              sx={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                overflow: "hidden",
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: pct(tertiary),
                  borderRadius: 999,
                  bgcolor: (theme) => alpha(theme.palette.info.main, 0.7),
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ minWidth: 90, textAlign: "right" }}>
              {unit === "DKK" ? fmt(tertiary) : tertiary.toFixed(2)}
            </Typography>
          </Stack>
        )}
      </Stack>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Stack>
  );
}

function FinancialOverview({ analytics, loading }) {
  if (loading && !analytics) {
    return (
      <Stack spacing={1}>
        <Skeleton variant="text" width={140} />
        <Skeleton variant="rounded" height={100} />
      </Stack>
    );
  }

  if (!analytics) {
    return (
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">Financial snapshot</Typography>
        <Typography variant="body2" color="text.secondary">
          Load a period to see revenue, cost, cash and balance sheet structure visualised here.
        </Typography>
      </Stack>
    );
  }

  const {
    revenue,
    expenses,
    netIncome,
    cashInflow,
    cashOutflow,
    cashEnding,
    assets,
    liabilities,
    equity,
    currentRatio,
    debtToEquity,
  } = analytics;

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Financial snapshot
      </Typography>
      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <MetricBar
            label="Revenue vs. Expenses vs. Net income"
            primary={revenue || 0}
            secondary={expenses || 0}
            tertiary={netIncome || 0}
            hint="Gives a quick sense of how much of your top-line converts into profit."
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <MetricBar
            label="Cash inflow vs. outflow vs. ending balance"
            primary={cashInflow || 0}
            secondary={cashOutflow || 0}
            tertiary={cashEnding || 0}
            hint="Shows whether cash is building up or being consumed over the period."
          />
        </Grid>
        <Grid item xs={18} md={6}>
          <MetricBar
            label="Assets vs. Liabilities & Equity"
            primary={assets || 0}
            secondary={(liabilities || 0) + (equity || 0)}
            hint="In a balanced sheet, these should be aligned. Gaps indicate classification issues."
          />
        </Grid>
        <Grid item xs={14} md={6}>
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Key ratios
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {currentRatio !== null && (
                <Chip
                  size="small"
                  label={`Current ratio: ${currentRatio.toFixed(2)}x`}
                  color={currentRatio >= 1.5 ? "success" : currentRatio >= 1 ? "warning" : "error"}
                  variant="outlined"
                />
              )}
              {debtToEquity !== null && (
                <Chip
                  size="small"
                  label={`Debt/Equity: ${debtToEquity.toFixed(2)}x`}
                  color={debtToEquity <= 1 ? "success" : debtToEquity <= 2 ? "warning" : "error"}
                  variant="outlined"
                />
              )}
              {currentRatio === null && debtToEquity === null && (
                <Typography variant="body2" color="text.secondary">
                  Ratios will appear once both balance sheet and P&L are available.
                </Typography>
              )}
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
/* -------------------- AI-style News Notes panel + detail view -------------------- */

function AiNewsNotesPanel({ analytics, notes, onViewDetails }) {
  if (!analytics && !notes?.length) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3,
          height: "100%",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          AI News Notes
        </Typography>
        <Typography variant="body1" color="text.secondary">
          When reports are loaded, this panel will generate strategy ideas based on your
          profitability, liquidity and balance sheet.
        </Typography>
      </Paper>
    );
  }

  const effectiveNotes = notes || [];

  if (!effectiveNotes.length) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        height: "100%",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            System Strategic Insights
          </Typography>
          <Chip size="small" label="Strategy ideas" variant="outlined" />
        </Stack>
        {typeof onViewDetails === "function" && (
          <Button size="small" variant="contained" onClick={onViewDetails}>
            View
          </Button>
        )}
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Generated from the latest reporting period to surface operational 
        priorities and practical actions supporting management decisions, 
        budgeting alignment, and improved execution.
      </Typography>

      <Stack spacing={1.75} sx={{ mt: 0.5 }}>
        {effectiveNotes.map((n) => (
          <Stack
            key={n.id}
            spacing={0.75}
            sx={{
              p: 2, // larger cards
              borderRadius: 2,
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.02)",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              {n.tag && (
                <Chip
                  size="small"
                  label={n.tag}
                  color="primary"
                  variant="outlined"
                />
              )}
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {n.title}
              </Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary">
              {n.summary}
            </Typography>
            {Array.isArray(n.actions) && n.actions.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {n.actions.slice(0, 3).map((a, idx) => (
                  <li key={idx}>
                    <Typography variant="body2" color="text.secondary">
                      {a}
                    </Typography>
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

/* ----- Detail view with graphical bars and constructive plan of actions ----- */

function ActionScoreBar({ label, value }) {
  const clamped = Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0));
  const width = `${(clamped / 10) * 100}%`;

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2">{label}</Typography>
      <Box
        sx={{
          height: 10,
          borderRadius: 999,
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width,
            borderRadius: 999,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.9),
          }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        Score: {clamped.toFixed(1)} / 10
      </Typography>
    </Stack>
  );
}

function computeStrategyScores(note, analytics) {
  const {
    netIncome = 0,
    cashNetChange = 0,
    currentRatio = null,
    debtToEquity = null,
  } = analytics || {};

  let impact = 7;
  let urgency = 6;
  let effort = 5;

  if (note.id === "profitability") {
    impact = 9;
    effort = 6;
    urgency = netIncome < 0 ? 9 : 7;
  } else if (note.id === "cash") {
    impact = 8;
    urgency = cashNetChange < 0 ? 9 : 7;
    effort = 5;
  } else if (note.id === "structure") {
    impact = 7;
    urgency =
      currentRatio !== null && currentRatio < 1
        ? 9
        : debtToEquity !== null && debtToEquity > 2
        ? 8
        : 6;
    effort = 7;
  }

  return { impact, urgency, effort };
}

function AiNewsNotesDetailView({ open, onClose, analytics, notes }) {
  const effectiveNotes = notes || [];

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            System Strategic Insights – Strategy Planner
          </Typography>
          <Button onClick={onClose}>Close</Button>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {effectiveNotes.length === 0 ? (
          <Typography variant="body1">
            No strategy suggestions available yet. Load a period with financial data to generate AI News Notes.
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Each strategy card below includes a simple impact / urgency / effort score to help you prioritise
              and turn the recommendations into an actionable plan.
            </Typography>
            {effectiveNotes.map((n) => {
              const scores = computeStrategyScores(n, analytics);
              return (
                <Paper
                  key={n.id}
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2 }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {n.tag && (
                        <Chip size="small" label={n.tag} color="primary" variant="outlined" />
                      )}
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {n.title}
                      </Typography>
                    </Stack>
                    <Typography variant="body1" color="text.secondary">
                      {n.summary}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Stack spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Priority scores
                          </Typography>
                          <ActionScoreBar label="Impact on results" value={scores.impact} />
                          <ActionScoreBar label="Urgency" value={scores.urgency} />
                          <ActionScoreBar label="Implementation effort" value={scores.effort} />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Stack spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Constructive plan of actions
                          </Typography>
                          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                            {(n.actions || []).slice(0, 5).map((a, idx) => (
                              <li key={idx}>
                                <Typography variant="body2" color="text.secondary">
                                  {a}
                                </Typography>
                              </li>
                            ))}
                          </ul>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="body2" sx={{ flexGrow: 1, ml: 1 }} color="text.secondary">
          Tip: Start with high-impact, high-urgency, low-effort items.
        </Typography>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
