// client/src/pages/GLDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Stack, Typography, Button, TextField,
  Chip, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Tooltip, Autocomplete, InputAdornment,
  ToggleButton, ToggleButtonGroup, Switch, FormControlLabel,
  TableSortLabel, Box
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";

/* =========================================================
   Chart of Accounts Suggestions
   ========================================================= */
const NAME_SUGGESTIONS = {
  ASSET: {
    "Cash & Cash Equivalents": ["1000 Cash","1010 Petty Cash","1100 Bank","1400 Short-Term Investments"],
    "Accounts Receivable": ["1100 Accounts Receivable","1020 Interest & Dividends Receivable"],
    "Investments": ["1100 Investments at Fair Value","1110 Cost Basis of Investments","1120 Unrealized Appreciation (Contra)","1130 Unrealized Depreciation (Contra)"],
    "Inventory": ["1200 Inventory","1200 Raw Materials Inventory","1210 WIP Inventory","1220 Finished Goods Inventory"],
    "Prepaid & Other Current": ["1300 Prepaid Expenses"],
    "Other Current Assets": ["1210 Other Receivables","1205 Due from GP / Manager"],
    "Property, Plant & Equipment": ["1500 Equipment","1510 Furniture & Fixtures","1600 Vehicles","1700 Buildings","1800 Land","1900 Accumulated Depreciation"],
    "Intangibles": ["1550 Capitalized Software","1560 Goodwill","1570 Other Intangibles"],
    "Contra Assets": ["1900 Accumulated Depreciation","1910 Allowance for Doubtful Accounts"]
  },
  LIABILITY: {
    "Accounts Payable": ["2000 Accounts Payable"],
    "Accrued Liabilities": ["2010 Accrued Expenses","2020 Management Fees Payable","2030 Custody & Admin Fees Payable"],
    "Taxes Payable": ["2300 Taxes Payable"],
    "Deferred Revenue": ["2400 Unearned Revenue"],
    "Short-term Debt": ["2500 Short-Term Loans"],
    "Long-term Debt": ["2600 Bank Loan Payable","2700 Bonds Payable"],
    "Leases": ["2800 Lease Obligations"],
  },
  EQUITY: {
    "Paid-in Capital": ["3000 Share Capital","3200 Additional Paid-In Capital","3100 Capital Contributions"],
    "Retained Earnings": ["3300 Retained Earnings","3310 Net Change in Unrealized Gain/Loss"],
    "Distributions / Draws": ["3200 Capital Distributions","3400 Dividends / Owner’s Draw"],
    "Treasury Stock": ["3500 Treasury Stock"],
    "Partners’ Capital": ["3001 Partners’ Capital – LPs","3010 Partners’ Capital – GP"]
  },
  REVENUE: {
    "Product Revenue": ["4000 Sales Revenue"],
    "Service Revenue": ["4100 Service Revenue"],
    "Recurring / Subscriptions": ["4015 Subscription Revenue","4400 Management Fees Income"],
    "Investment Income": ["4020 Dividend & Interest Income","4300 Interest Income"],
    "Other Income": ["4200 Rental Income"],
    "Gains / (Losses)": [
      "4040 Realized Gains (Losses) on Investments",
      "4010 Unrealized Gains (Losses) on Investments",
      "4030 FX Gain (Loss)"
    ]
  },
  EXPENSE: {
    "COGS / Cost of Sales": ["5000 Cost of Goods Sold (COGS)","5001 COGS"],
    "Payroll": ["5100 Salaries & Wages"],
    "Facilities": ["5200 Rent Expense","5300 Utilities Expense"],
    "Operations": [
      "6300 Bank Charges",
      "6400 IT / Software Expense",
      "6500 Miscellaneous Expenses",
      "2810 Lease Expense"
    ],
    "G&A": [
      "6100 Legal Expenses",
      "6200 Audit & Accounting Fees",
      "5800 Professional Fees",
      "5900 Training & Development",
      "6000 Depreciation Expense",
      "5500 Insurance Expense"
    ],
    "Sales & Marketing": ["5600 Marketing & Advertising","5700 Travel Expense"],
    "R&D": ["5150 R&D Expense","5160 Product Development"],
    "Financing": ["6600 Interest Expense","6700 Foreign Exchange Loss"],
    "Other": [
      "5070 Other Fund Operating Expenses",
      "5060 Deal Expenses (Non-capitalized)",
      "5050 Organizational & Offering Costs"
    ]
  }
};

const NAME_META = {
  "1000 Cash": "Cash on hand and in bank accounts",
  "1010 Petty Cash": "Small cash kept on premises for minor expenses",
  "1100 Bank": "Operating bank account balances",
  "1100 Accounts Receivable": "Amounts due from customers/clients",
  "1400 Short-Term Investments": "Investments easily convertible to cash",
  "1500 Equipment": "Machinery and tools used in operations",
  "1510 Furniture & Fixtures": "Office furniture and fixtures",
  "1900 Accumulated Depreciation": "Total depreciation of fixed assets (contra-asset)",
  "2000 Accounts Payable": "Trade payables and invoices due",
  "2010 Accrued Expenses": "Incurred expenses not yet billed",
  "2300 Taxes Payable": "Taxes owed to the government",
  "2400 Unearned Revenue": "Customer payments received before delivery",
  "2600 Bank Loan Payable": "Outstanding balance of bank loans",
  "3000 Share Capital": "Owner/shareholder invested capital",
  "3200 Additional Paid-In Capital": "Contributions beyond par value of shares",
  "3300 Retained Earnings": "Accumulated profits not distributed as dividends",
  "4000 Sales Revenue": "Income from sale of goods",
  "4100 Service Revenue": "Income from providing services",
  "4300 Interest Income": "Interest earned from deposits or investments",
  "5000 Cost of Goods Sold (COGS)": "Direct costs of producing goods sold",
  "5100 Salaries & Wages": "Employee compensation",
  "5200 Rent Expense": "Payments for office or building rent",
  "5600 Marketing & Advertising": "Promotional and advertising costs",
  "6100 Legal Expenses": "Fees paid to lawyers and legal firms",
  "6200 Audit & Accounting Fees": "External audit and accounting service fees",
  "6400 IT / Software Expense": "Software subscriptions and IT systems",
};

/* ---------- Categorization helpers ---------- */
const CAT_TITLES = { ASSET:"Assets", LIABILITY:"Liabilities", EQUITY:"Equity", REVENUE:"Revenue", EXPENSE:"Expenses" };
const catTitle = (c) => CAT_TITLES[c] || c || "";

const SUGGESTION_INDEX = (() => {
  const idx = new Map();
  Object.entries(NAME_SUGGESTIONS).forEach(([cat, subs]) => {
    Object.entries(subs).forEach(([subtype, labels]) => {
      labels.forEach((label) => {
        const num = label.split(" ")[0];
        if (!idx.has(num)) idx.set(num, { category: cat, subtype });
      });
    });
  });
  return idx;
})();

const inferCategoryFromNumber = (num) => {
  const s = String(num || "");
  const f = s[0];
  if (f === "1") return "ASSET";
  if (f === "2") return "LIABILITY";
  if (f === "3") return "EQUITY";
  if (f === "4") return "REVENUE";
  if (["5","6","7","8","9"].includes(f)) return "EXPENSE";
  return "EXPENSE";
};

const CATEGORY_ORDER = ["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"];
const catSortKey = (c) => {
  const i = CATEGORY_ORDER.indexOf(c);
  return i === -1 ? 99 : i;
};

const catChipColor = (cat) => {
  switch (cat) {
    case "ASSET": return "success";
    case "LIABILITY": return "warning";
    case "EQUITY": return "info";
    case "REVENUE": return "primary";
    case "EXPENSE": return "error";
    default: return "default";
  }
};

/* ---------- utils ---------- */
const fmtKr = (n) => (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
export const extractAccountNumber = (raw) => {
  if (!raw) return "";
  const match = String(raw).match(/^\s*(\d{3,})/);
  return match?.[1] || String(raw);
};
const normalizeAmount = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const yyyymmdd = (d) => {
  const s = String(d || "").slice(0,10);
  if (!s) return "";
  const [Y,M,D] = [s.slice(0,4), s.slice(5,7), s.slice(8,10)];
  return `${Y}${M}${D}`;
};
const fallbackRefFromRow = (r) => {
  if (!r?.date || !r?.account) return "";
  const tail = (r?._id || r?.journalId || "").toString().slice(-3).padStart(3,"0");
  return `${String(r.account)}-${yyyymmdd(r.date)}-${tail}`;
};
const fallbackJeFromRow = (r) => {
  if (!r?.date) return "";
  const tail = (r?.jeNumber || r?.journalNo || r?._id || r?.journalId || "").toString().slice(-4).padStart(4,"0");
  return `JE-${yyyymmdd(r.date)}-${tail}`;
};

/* ---------- helpers for ingest robustness ---------- */
const deriveOffsetAccount = (lines = []) => {
  if (!Array.isArray(lines)) return "";
  if (lines.length >= 2) return String(lines[1]?.account || "");
  return "";
};
const buildRefFallback = (je) => {
  const date = String(je?.date || new Date().toISOString().slice(0,10)).slice(0,10);
  const ymd = `${date.slice(0,4)}${date.slice(5,7)}${date.slice(8,10)}`;
  const lines = Array.isArray(je?.lines) ? je.lines : [];
  const primary = String(lines[0]?.account || "UNK");
  const tail = String(je?._id || je?.id || "000").slice(-3).padStart(3,"0");
  return `${primary}-${ymd}-${tail}`;
};
const isPosted = (je) => {
  const s = (je?.status || "").toString().toLowerCase();
  return s === "posted" || s === "post" || s === "completed";
};

/* =========================================================
   JE -> GL transformation
   ========================================================= */
export const journalToGlRows = (je) => {
  if (!je || !Array.isArray(je.lines) || !je.lines.length) return [];
  const line = je.lines[0] || {};
  const debit = normalizeAmount(line.debit);
  const credit = normalizeAmount(line.credit);
  const amount = Math.max(debit, credit);
  if (!amount) return [];
  if (!je.offsetAccount) {
    console.warn("Posted JE missing offsetAccount; skipping offset row.", je);
  }
  const common = {
    date: String(je.date || new Date().toISOString().slice(0,10)).slice(0,10),
    memo: je.memo || line.memo || "",
    reference: je.reference || "",
    jeNumber: je.jeNumber || "",
    journalId: je._id || je.id || undefined,
    source: "JE",
    locked: true,
  };
  if (debit > 0) {
    return [
      { ...common, account: String(line.account), debit, credit: 0 },
      je.offsetAccount ? { ...common, account: String(je.offsetAccount), debit: 0, credit: debit } : null,
    ].filter(Boolean);
  } else {
    return [
      { ...common, account: String(line.account), debit: 0, credit },
      je.offsetAccount ? { ...common, account: String(je.offsetAccount), debit: credit, credit: 0 } : null,
    ].filter(Boolean);
  }
};

/* ============================ Dates / Presets ============================ */
const isoToday = () => new Date().toISOString().slice(0,10);
const startOfMonth = (d) => { const dt = new Date(d || isoToday()); dt.setDate(1); return dt.toISOString().slice(0,10); };
const startOfYear = (d) => { const dt = new Date(d || isoToday()); dt.setMonth(0,1); return dt.toISOString().slice(0,10); };
const startOfQuarter = (d) => { const dt = new Date(d || isoToday()); const q = Math.floor(dt.getMonth()/3)*3; dt.setMonth(q,1); return dt.toISOString().slice(0,10); };

/* =========================================================
   Inventory sync helpers (tag parsing + idempotency + invoices)
   ========================================================= */
const INV_TAG_JSON = /INV\s*\{([^}]*)\}/i; // matches: INV{ "sku":"...", ... }
const INV_TAG_KV   = /INV\s*:\s*([^]+)$/i; // matches: INV: key=val; key=val ...

const parseInventoryDirective = (text = "") => {
  const s = String(text || "");
  if (!s.toUpperCase().includes("INV")) return null;

  // JSON-like: INV{ ... }
  const jm = s.match(INV_TAG_JSON);
  if (jm) {
    try {
      const parsed = JSON.parse(`{${jm[1]}}`);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {}
  }

  // key=val format: INV: a=1; b=2; c=foo
  const km = s.match(INV_TAG_KV);
  if (km) {
    const body = km[1].split(/[;|,]/).map((x) => x.trim()).filter(Boolean);
    const out = {};
    for (const pair of body) {
      const [k, ...rest] = pair.split("=");
      if (!k) continue;
      const v = rest.join("=").trim();
      if (v) out[k.trim()] = v;
    }
    if (Object.keys(out).length) return out;
  }
  return null;
};

const INV_SYNC_LS = "inv.synced.keys";
const getSyncedSet = () => {
  try { return new Set(JSON.parse(localStorage.getItem(INV_SYNC_LS) || "[]")); } catch { return new Set(); }
};
const setSyncedSet = (set) => {
  try { localStorage.setItem(INV_SYNC_LS, JSON.stringify(Array.from(set))); } catch {}
};
// include amount hash so we can sync the same ref when amounts differ (rare)
const buildSyncKey = (r, extra = "") =>
  [String(r.date).slice(0,10), r.reference || r.jeNumber || r.journalNo || "", String(r.account), String(r.debit||0), String(r.credit||0), extra].join("|");

// naive patterns for invoice numbers seen in the UI
const SALES_INV_RE = /^INV-\d{8}-\d{3,}$/i;
const PURCH_INV_RE = /^(BILL|AP)-\d{8}-\d{3,}$/i;

/* =========================================================
   Component
   ========================================================= */
export default function GLDashboard({
  rows = [],
  accounts = [],
  onAdd,
  onAddMany,
  onUpdate,
  onDelete,
  onExportCSV,
  StandardDocComponent,
  postedJournal,

  // Inventory API (optional but recommended)
  inventoryApi, // { createStockMove(payload), postStockMove(id, patch?) }

  // NEW: invoice resolvers (optional)
  invoiceResolvers, // { getSalesByRef: async (ref) => invoice|null, getPurchaseByRef: async (ref) => invoice|null }
}) {
  /* build account options (suggestions ⨁ DB) */
  const suggestionOptions = useMemo(() => {
    const flat = [];
    Object.entries(NAME_SUGGESTIONS).forEach(([, subs]) => {
      Object.entries(subs).forEach(([subtype, arr]) => {
        arr.forEach((label) => {
          const [number, ...rest] = label.split(" ");
          const name = rest.join(" ");
          flat.push({ number: String(number), name, description: NAME_META[label] || subtype });
        });
      });
    });
    return flat;
  }, []);

  const mergedOptions = useMemo(() => {
    const byNo = new Map(suggestionOptions.map((o) => [o.number, o]));
    for (const a of accounts) {
      const num = String(a.number);
      const base = byNo.get(num) || { number: num, name: "" };
      const mapped = SUGGESTION_INDEX.get(num);
      const category = mapped?.category || inferCategoryFromNumber(num);
      const subtype = mapped?.subtype || "Other";
      byNo.set(num, {
        ...base,
        number: num,
        name: a.name || base.name || "",
        description: a.description || base.description || "",
        category,
        subtype,
      });
    }
    return Array.from(byNo.values())
      .map((o) => {
        const mapped = SUGGESTION_INDEX.get(o.number);
        const category = o.category || mapped?.category || inferCategoryFromNumber(o.number);
        const subtype  = o.subtype  || mapped?.subtype  || "Other";
        return {
          number: o.number,
          label: `${o.number} • ${o.name}`,
          description: o.description || "",
          category,
          subtype,
          groupKey: `${catTitle(category)} • ${subtype}`,
        };
      })
      .sort((a, b) => Number(a.number) - Number(b.number));
  }, [suggestionOptions, accounts]);

  const optionByNumber = useMemo(() => new Map(mergedOptions.map((o) => [o.number, o])), [mergedOptions]);
  const getCatSubForAccount = (raw) => {
    const num = extractAccountNumber(raw || "");
    const opt = optionByNumber.get(num);
    if (opt && opt.category && opt.subtype) return { category: opt.category, subtype: opt.subtype };
    const mapped = SUGGESTION_INDEX.get(num);
    return { category: mapped?.category || inferCategoryFromNumber(num), subtype: mapped?.subtype || "Other" };
  };
  const resolveAccountDisplay = (raw) => {
    if (!raw) return { label: "", description: "" };
    const num = extractAccountNumber(raw);
    const opt = optionByNumber.get(num);
    return opt ? { label: opt.label, description: opt.description || "" } : { label: String(raw), description: "" };
  };

  /* ---------- local & demo rows (from localStorage) ---------- */
  const [ingestedTemp, setIngestedTemp] = useState([]);
  const [localRows, setLocalRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gl.rows") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    const onAdded = (e) => {
      const added = Array.isArray(e?.detail) ? e.detail : [];
      if (!added.length) return;
      setLocalRows((prev) => [...prev, ...added]);
    };
    const onStorage = (ev) => {
      if (ev.key === "gl.rows") {
        try { setLocalRows(JSON.parse(ev.newValue || "[]")); } catch {}
      }
    };
    window.addEventListener("gl:rows-added", onAdded);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("gl:rows-added", onAdded);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const mergeDedupRows = (a = [], b = []) => {
    const seen = new Set();
    const out = [];
    const push = (r) => {
      const key = [
        r.journalId || "",
        r.jeNumber || r.journalNo || "",
        r.reference || "",
        r.date || "",
        r.account || "",
        r.debit || 0,
        r.credit || 0,
      ].join("|");
      if (!seen.has(key)) { seen.add(key); out.push(r); }
    };
    a.forEach(push); b.forEach(push);
    return out;
  };

  const data = useMemo(
    () => mergeDedupRows(mergeDedupRows(rows, localRows), ingestedTemp),
    [rows, localRows, ingestedTemp]
  );

  /* ingest posted JE -> GL (kept) */
  useEffect(() => {
    let cancelled = false;
    const ingest = async () => {
      if (!postedJournal) return;
      if (!isPosted(postedJournal) && postedJournal.status !== "posted") return;
      const lines = Array.isArray(postedJournal.lines) ? postedJournal.lines : [];
      if (lines.length === 0) return;

      const safeRef = (postedJournal.reference && /\d{3,}-\d{8}-\d{3}/.test(postedJournal.reference))
        ? postedJournal.reference : buildRefFallback(postedJournal);
      const safeJeNo = postedJournal.jeNumber ||
        `JE-${String(postedJournal.date || new Date().toISOString().slice(0,10)).replaceAll("-","")}-${String(postedJournal._id || postedJournal.id || "0").slice(-4).padStart(4,"0")}`;
      const safeOffset = postedJournal.offsetAccount || deriveOffsetAccount(lines);
      const preparedJE = { ...postedJournal, reference: safeRef, jeNumber: safeJeNo, offsetAccount: safeOffset, lines };

      const already = data.some(
        (r) =>
          (preparedJE._id && r.journalId === preparedJE._id) ||
          (!!preparedJE.reference && r.reference === preparedJE.reference) ||
          (!!preparedJE.jeNumber && (r.jeNumber === preparedJE.jeNumber || r.journalNo === preparedJE.jeNumber))
      );
      if (already) return;

      const glRows = journalToGlRows(preparedJE);
      if (!glRows.length) return;

      try {
        if (onAddMany) {
          await onAddMany(glRows);
        } else if (onAdd) {
          for (const row of glRows) {
            if (cancelled) return;
            const entry = { ...row, debit: normalizeAmount(row.debit), credit: normalizeAmount(row.credit) };
            await onAdd(entry);
          }
        } else {
          setIngestedTemp((cur) => mergeDedupRows(cur, glRows));
        }
      } catch (e) {
        console.error("Failed to ingest posted JE into GL:", e);
        setIngestedTemp((cur) => mergeDedupRows(cur, glRows));
      }
    };
    ingest();
    return () => { cancelled = true; };
  }, [postedJournal?._id, postedJournal?.reference, postedJournal?.jeNumber, postedJournal?.status, data, onAdd, onAddMany]);

  /* =========================================================
     NEW: Auto-sync GL -> Inventory Stock Moves
     Priority:
       1) Memo/Ref INV: tag (manual override)
       2) Invoice-based sync (Ref No -> invoice lines)
     ========================================================= */

  // 2a. Resolve invoice by reference number based on pattern or account type
  const detectInvoiceKind = (row) => {
    const ref = String(row?.reference || "").trim();
    if (SALES_INV_RE.test(ref)) return "sales";
    if (PURCH_INV_RE.test(ref)) return "purchase";
    // fallback: revenue -> sales, AP/COGS -> purchase (very rough)
    const acc = String(row?.account || "");
    if (/^4\d{3}$/.test(acc)) return "sales";
    if (/^(1200|2000|5\d{3})$/.test(acc)) return "purchase";
    return null;
  };

  const fetchInvoiceForRow = async (row) => {
    const kind = detectInvoiceKind(row);
    if (!kind) return null;
    const ref = String(row?.reference || "").trim();
    if (!ref) return null;
    try {
      if (kind === "sales" && invoiceResolvers?.getSalesByRef) {
        return await invoiceResolvers.getSalesByRef(ref);
      }
      if (kind === "purchase" && invoiceResolvers?.getPurchaseByRef) {
        return await invoiceResolvers.getPurchaseByRef(ref);
      }
    } catch (e) {
      console.error("[INV SYNC] invoice resolver failed:", e);
    }
    return null;
  };

  // 2b. Build and post stock moves from an invoice payload
  const createMovesFromInvoice = async (row, invoice, kind) => {
    if (!inventoryApi?.createStockMove || !invoice) return;

    const ref = String(row.reference || row.jeNumber || row.journalNo || "");
    const date = String(row.date || isoToday()).slice(0, 10);
    const whDefault = invoice?.warehouseCode || invoice?.warehouse || "MAIN";
    const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];

    for (const ln of lines) {
      const itemSku = ln.sku || ln.itemSku || ln.item?.sku;
      const qty = Math.abs(Number(ln.qty ?? ln.quantity ?? 0)) || 0;
      const unitCost =
        Number(ln.unitCost ?? ln.cost ?? (kind === "purchase" ? ln.price : ln.cogs) ?? 0) || 0;

      if (!itemSku || !qty) continue;

      const dir = kind === "sales" ? "out" : "in";
      const fromWhCode = dir === "out" ? (ln.fromWh || whDefault) : undefined;
      const toWhCode   = dir === "in"  ? (ln.toWh   || whDefault) : undefined;

      const movePayload = {
        date,
        reference: ref,
        moveNo: "",
        itemSku,
        qty,
        uom: ln.uom || "pcs",
        unitCost,
        fromWhCode,
        toWhCode,
        status: "approved",
        memo: `${kind === "sales" ? "Sales" : "Purchase"} invoice ${invoice.number || invoice.invoiceNo || ref}`,
        participants: {
          preparedBy: { name: "GL Sync" },
          approvedBy: { name: "GL Sync" },
        },
      };

      const perLineKey = buildSyncKey(row, `${itemSku}:${qty}:${unitCost}:${fromWhCode || ""}:${toWhCode || ""}`);
      const synced = getSyncedSet();
      if (synced.has(perLineKey)) continue;

      try {
        const created = await inventoryApi.createStockMove(movePayload);
        const id = created?._id || created?.id;
        if (id && inventoryApi.postStockMove) {
          await inventoryApi.postStockMove(id, { postedBy: "GL Sync" });
        }
        synced.add(perLineKey);
        setSyncedSet(synced);
      } catch (e) {
        console.error("[INV SYNC] create/post move failed:", e, movePayload);
      }
    }
  };

  // 1) Direct memo/ref tag sync
  const trySyncInventoryFromTags = async (row) => {
    if (!inventoryApi?.createStockMove) return false;
    const directive =
      parseInventoryDirective(row?.memo || "") ||
      parseInventoryDirective(row?.reference || "");
    if (!directive) return false;

    const key = buildSyncKey(row);
    const synced = getSyncedSet();
    if (synced.has(key)) return true;

    const dir = String(directive.dir || directive.direction || "").toLowerCase();
    const itemSku = directive.sku || directive.item || directive.itemSku;
    const qty = Math.abs(Number(directive.qty ?? directive.quantity ?? 0)) || 0;
    const unitCost = Number(directive.cost ?? directive.unitCost ?? 0) || 0;
    const wh = directive.wh || directive.warehouse || "";
    const fromWhCode = dir === "out" ? (directive.fromWh || directive.from || wh || "MAIN") : undefined;
    const toWhCode   = dir === "in"  ? (directive.toWh   || directive.to   || wh || "MAIN") : undefined;

    if (!itemSku || !qty || !(fromWhCode || toWhCode)) return false;

    const payload = {
      date: String(row.date || isoToday()).slice(0,10),
      reference: row.reference || row.jeNumber || row.journalNo || "",
      moveNo: "",
      itemSku,
      qty,
      uom: directive.uom || "pcs",
      unitCost,
      fromWhCode,
      toWhCode,
      status: "approved",
      memo: directive.memo || (dir === "out" ? "Auto from GL (sale)" : "Auto from GL (purchase)"),
      participants: {
        preparedBy: { name: directive.preparedBy || "GL Sync" },
        approvedBy: { name: directive.approvedBy || "GL Sync" },
      },
    };

    try {
      const created = await inventoryApi.createStockMove(payload);
      const id = created?._id || created?.id;
      if (id && inventoryApi.postStockMove) {
        await inventoryApi.postStockMove(id, { postedBy: "GL Sync" });
      }
      synced.add(key);
      setSyncedSet(synced);
      return true;
    } catch (e) {
      console.error("[INV SYNC] tag-based move failed:", e);
      return false;
    }
  };

  // 2) Invoice-driven sync (if memo tags not present)
  const trySyncInventoryFromInvoice = async (row) => {
    if (!inventoryApi?.createStockMove) return;
    const ref = String(row?.reference || "").trim();
    if (!ref || !(invoiceResolvers?.getSalesByRef || invoiceResolvers?.getPurchaseByRef)) return;

    // idempotency at row-level for invoice based attempts
    const key = buildSyncKey(row, "inv-lookup");
    const synced = getSyncedSet();
    if (synced.has(key)) return;

    const kind = detectInvoiceKind(row);
    if (!kind) return;

    try {
      const invoice = await fetchInvoiceForRow(row);
      if (!invoice) {
        // avoid hammering resolvers if ref unknown; mark as checked once
        synced.add(key); setSyncedSet(synced);
        return;
      }
      await createMovesFromInvoice(row, invoice, kind);
      synced.add(key); setSyncedSet(synced);
    } catch (e) {
      console.error("[INV SYNC] invoice-based sync error:", e);
    }
  };

  // scan any new/changed rows and attempt sync
  useEffect(() => {
    (async () => {
      for (const r of data) {
        try {
          const done = await trySyncInventoryFromTags(r);
          if (!done) await trySyncInventoryFromInvoice(r);
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, inventoryApi?.createStockMove, inventoryApi?.postStockMove, invoiceResolvers?.getSalesByRef, invoiceResolvers?.getPurchaseByRef]);

  /* CRUD state */
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ date: isoToday(), account: "", memo: "", debit: "", credit: "" });
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const isBalancedSingle = (debit, credit) => {
    const d = normalizeAmount(debit); const c = normalizeAmount(credit);
    return (d > 0 && c === 0) || (c > 0 && d === 0);
  };
  const canSaveNew  = Boolean(newRow.date && newRow.account && isBalancedSingle(newRow.debit, newRow.credit));
  const canSaveEdit = draft ? Boolean(draft.date && draft.account && isBalancedSingle(draft.debit, draft.credit)) : false;

  const handleAdd = async () => {
    if (!canSaveNew) return;
    const entry = {
      date: newRow.date, account: String(newRow.account), memo: newRow.memo || "",
      debit: normalizeAmount(newRow.debit) || 0, credit: normalizeAmount(newRow.credit) || 0, source: "Manual",
    };
    await onAdd?.(entry);
    try { await trySyncInventoryFromTags(entry); } catch {}
    setAdding(false);
    setNewRow({ date: isoToday(), account: "", memo: "", debit: "", credit: "" });
  };

  const startEdit = (id, row) => {
    if (row.locked || row.source === "JE" || row.journalId) return;
    setEditingId(id);
    setDraft({ date: row.date, account: String(row.account), memo: row.memo || "", debit: row.debit || "", credit: row.credit || "" });
  };
  const cancelEdit = () => { setEditingId(null); setDraft(null); };
  const saveEdit = async (id) => {
    if (!canSaveEdit) return;
    const entry = {
      date: draft.date, account: String(draft.account), memo: draft.memo || "",
      debit: normalizeAmount(draft.debit) || 0, credit: normalizeAmount(draft.credit) || 0,
    };
    await onUpdate?.(id, entry);
  };
  const remove = async (id, row) => {
    if (row?.locked || row?.source === "JE" || row?.journalId) return;
    await onDelete?.(id);
  };

  /* ---------- Filters ---------- */
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subtypeFilter, setSubtypeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [datePreset, setDatePreset] = useState("MTD");
  const [fromDate, setFromDate] = useState(startOfMonth(isoToday()));
  const [toDate, setToDate] = useState(isoToday());
  const [showRunning, setShowRunning] = useState(false);
  const [dateSortAsc, setDateSortAsc] = useState(true);

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const today = isoToday();
    if (preset === "ALL")   { setFromDate(""); setToDate(""); return; }
    if (preset === "MTD")   { setFromDate(startOfMonth(today)); setToDate(today); return; }
    if (preset === "QTD")   { setFromDate(startOfQuarter(today)); setToDate(today); return; }
    if (preset === "YTD")   { setFromDate(startOfYear(today)); setToDate(today); return; }
    if (preset === "CUSTOM"){ return; }
  };

  const allSubtypesFor = useMemo(() => {
    if (categoryFilter === "all") {
      const s = new Set(); Object.values(NAME_SUGGESTIONS).forEach((subs) => { Object.keys(subs).forEach((st) => s.add(st)); });
      return Array.from(s).sort();
    }
    return Object.keys(NAME_SUGGESTIONS[categoryFilter] || {}).sort();
  }, [categoryFilter]);

  const preFiltered = useMemo(() => {
    let rowsArr = [...data];
    if (fromDate) rowsArr = rowsArr.filter((r) => String(r.date).slice(0,10) >= fromDate);
    if (toDate)   rowsArr = rowsArr.filter((r) => String(r.date).slice(0,10) <= toDate);
    if (selectedAccounts.length) {
      const setNums = new Set(selectedAccounts.map(String));
      rowsArr = rowsArr.filter((r) => setNums.has(extractAccountNumber(r.account)));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      rowsArr = rowsArr.filter((r) => {
        const acc = resolveAccountDisplay(r.account).label.toLowerCase();
        const memo = (r.memo || "").toLowerCase();
        const ref  = (r.reference || "").toLowerCase();
        const je   = (r.jeNumber || r.journalNo || "").toLowerCase();
        const num  = String(r.account || "").toLowerCase();
        const amt  = (r.debit || r.credit || "").toString();
        return acc.includes(q) || memo.includes(q) || ref.includes(q) || je.includes(q) || num.includes(q) || amt.includes(q);
      });
    }
    rowsArr.sort((a,b) => {
      const aa = String(a.date).slice(0,10);
      const bb = String(b.date).slice(0,10);
      return dateSortAsc ? aa.localeCompare(bb) : bb.localeCompare(aa);
    });
    return rowsArr;
  }, [data, fromDate, toDate, selectedAccounts, query, dateSortAsc, optionByNumber]);

  const categorizedData = useMemo(
    () => (preFiltered || []).map((r) => ({ ...r, ...getCatSubForAccount(r.account), _category: getCatSubForAccount(r.account).category, _subtype: getCatSubForAccount(r.account).subtype })),
    [preFiltered, optionByNumber]
  );

  const filteredData = useMemo(
    () => categorizedData.filter((r) => (categoryFilter === "all" || r._category === categoryFilter) && (!subtypeFilter || r._subtype === subtypeFilter)),
    [categorizedData, categoryFilter, subtypeFilter]
  );

  /* ---------- Sections & totals ---------- */
  const groupedSections = useMemo(() => {
    const groups = new Map();
    for (const r of filteredData) {
      const key = `${r._category}__${r._subtype}`;
      if (!groups.has(key)) groups.set(key, { category:r._category, subtype:r._subtype, rows:[], debitTotal:0, creditTotal:0 });
      const g = groups.get(key);
      g.rows.push(r); g.debitTotal += Number(r.debit || 0); g.creditTotal += Number(r.credit || 0);
    }
    const out = Array.from(groups.values());
    out.sort((a,b) => { const c = catSortKey(a.category) - catSortKey(b.category); return c !== 0 ? c : a.subtype.localeCompare(b.subtype); });
    return out;
  }, [filteredData]);

  const totals = useMemo(() => {
    let d=0,c=0; for (const r of filteredData) { d += Number(r.debit || 0); c += Number(r.credit || 0); }
    return { debit:d, credit:c, net:d-c };
  }, [filteredData]);

  /* ---------- Helpers to remove “default/demo” rows ---------- */
  const clearLocal = () => {
    try { localStorage.setItem("gl.rows", "[]"); } catch {}
    setLocalRows([]);
  };

  const deleteFiltered = async () => {
    const deletableIds = [];
    const keepLocal = [];
    for (const r of filteredData) {
      const locked = !!r.locked || r.source === "JE" || !!r.journalId;
      if (!locked && r._id) {
        deletableIds.push(r._id);
      }
    }
    for (const id of deletableIds) {
      try { await onDelete?.(id); } catch(e) { console.error("delete failed", e); }
    }
    const filteredKeys = new Set(
      filteredData
        .filter((r) => !r._id && !r.journalId && !(r.locked || r.source === "JE"))
        .map((r) => [r.date, String(r.account), r.memo || "", Number(r.debit||0), Number(r.credit||0)].join("|"))
    );
    for (const lr of localRows) {
      const key = [lr.date, String(lr.account), lr.memo || "", Number(lr.debit||0), Number(lr.credit||0)].join("|");
      if (!filteredKeys.has(key)) keepLocal.push(lr);
    }
    setLocalRows(keepLocal);
    try { localStorage.setItem("gl.rows", JSON.stringify(keepLocal)); } catch {}
  };

  /* ---------- Column widths ---------- */
  const COLGROUP = (
    <colgroup>
      <col style={{ width: 110 }} />
      <col style={{ width: 180 }} />
      <col style={{ width: 210 }} />
      <col style={{ width: 320 }} />
      <col style={{ width: "auto" }} />
      <col style={{ width: 140 }} />
      <col style={{ width: 140 }} />
      <col style={{ width: 120 }} />
    </colgroup>
  );

  /* ---------- Render ---------- */
  return (
    <Stack spacing={2}>
      {/* Title + Export + Clear buttons + Add */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="h5">General Ledger</Typography>
          <Chip size="small" label={`${filteredData.length} entries`} />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={`Debet ${fmtKr(totals.debit)}`} color="success" variant="outlined" />
          <Chip label={`Kredit ${fmtKr(totals.credit)}`} color="error" variant="outlined" />
          <Chip label={`Saldo ${fmtKr(totals.net)}`} color={totals.net === 0 ? "default" : totals.net > 0 ? "success" : "error"} />
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => onExportCSV?.(filteredData)}>EXPORTÉR CSV</Button>
          <Tooltip title="Delete all currently visible (filtered) rows that are deletable">
            <Button color="error" variant="outlined" onClick={deleteFiltered}>DELETE FILTERED</Button>
          </Tooltip>
          <Tooltip title="Clear local demo entries (created by forms)">
            <Button variant="outlined" onClick={clearLocal}>CLEAR LOCAL</Button>
          </Tooltip>
          {StandardDocComponent && (
            <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={() => {}}>
              STANDARD DOC
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            ADD ENTRY
          </Button>
        </Stack>
      </Stack>

      {/* Toolbar */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }} justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="overline" color="text.secondary">CATEGORY</Typography>
              {["all","ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"].map((cat) => (
                <Chip
                  key={cat}
                  label={cat === "all" ? "All" : catTitle(cat)}
                  color={categoryFilter === cat ? "primary" : "default"}
                  onClick={() => { setCategoryFilter(cat); setSubtypeFilter(""); }}
                  size="small" sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Stack>
            <TextField
              size="small"
              placeholder="Search memo, ref, FD No., account…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ minWidth: 260 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Stack>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }} justifyContent="space-between">
            <Autocomplete
              size="small" sx={{ minWidth: 240 }} options={Object.keys(NAME_SUGGESTIONS[categoryFilter] || {}).sort()}
              value={subtypeFilter} onChange={(_, v) => setSubtypeFilter(v || "")}
              renderInput={(p) => <TextField {...p} label="Subtype" placeholder="e.g., Payroll, Facilities…" />}
            />
            <Autocomplete
              multiple size="small" sx={{ minWidth: 320, flexGrow: 1 }}
              options={mergedOptions} isOptionEqualToValue={(o, v) => o?.number === v?.number}
              getOptionLabel={(o) => (o ? o.label : "")}
              value={mergedOptions.filter((o) => selectedAccounts.includes(o.number))}
              onChange={(_, v) => setSelectedAccounts(v.map((x) => x.number))}
              renderInput={(params) => <TextField {...params} label="Accounts" placeholder="Filter accounts" />}
            />
            <ToggleButtonGroup size="small" value={datePreset} exclusive onChange={(_, v) => v && applyPreset(v)}>
              <ToggleButton value="ALL">All</ToggleButton>
              <ToggleButton value="MTD">MTD</ToggleButton>
              <ToggleButton value="QTD">QTD</ToggleButton>
              <ToggleButton value="YTD">YTD</ToggleButton>
              <ToggleButton value="CUSTOM">Custom</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={3}>
              <TextField label="From" type="date" size="small" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setDatePreset("CUSTOM"); }} InputLabelProps={{ shrink: true }} />
              <TextField label="To" type="date" size="small" value={toDate} onChange={(e) => { setToDate(e.target.value); setDatePreset("CUSTOM"); }} InputLabelProps={{ shrink: true }} />
            </Stack>
            <FormControlLabel control={<Switch checked={showRunning} onChange={(e) => setShowRunning(e.target.checked)} />} label="Running balance" />
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Showing <strong>{filteredData.length}</strong> of {data.length} entries
            {categoryFilter !== "all" ? ` • Category: ${catTitle(categoryFilter)}` : ""}
            {subtypeFilter ? ` • Subtype: ${subtypeFilter}` : ""}
            {selectedAccounts.length ? ` • ${selectedAccounts.length} account(s)` : ""}
          </Typography>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ p: 4, borderRadius: 5 }}>
        <Box sx={{ "& table": { tableLayout: "fixed" }, "& th, & td": { verticalAlign: "middle", height: 40 }, "& td:nth-of-type(2), & td:nth-of-type(3)": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }, "& td:nth-of-type(6), & td:nth-of-type(7), & td:nth-of-type(8)": { fontVariantNumeric: "tabular-nums" } }}>
          <Table size="small">
            {COLGROUP}
            <TableHead>
              <TableRow>
                <TableCell sortDirection={dateSortAsc ? "asc" : "desc"}>
                  <TableSortLabel active direction={dateSortAsc ? "asc" : "desc"} onClick={() => setDateSortAsc((s) => !s)}>Date</TableSortLabel>
                </TableCell>
                <TableCell>FD No.</TableCell>
                <TableCell>Ref No.</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Debit (kr)</TableCell>
                <TableCell align="right">Credit (kr)</TableCell>
                {showRunning && <TableCell align="right">Balance</TableCell>}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {/* Add row */}
              {adding && (
                <TableRow>
                  <TableCell><TextField type="date" size="small" value={newRow.date} onChange={(e) => setNewRow((r) => ({ ...r, date: e.target.value }))} InputLabelProps={{ shrink: true }} /></TableCell>
                  <TableCell /><TableCell />
                  <TableCell sx={{ minWidth: 320 }}>
                    <Autocomplete
                      size="small" options={mergedOptions} groupBy={(o) => o.groupKey}
                      isOptionEqualToValue={(opt, val) => opt?.number === val?.number}
                      getOptionLabel={(o) => (o ? `${o.label}${o.description ? " — " + o.description : ""}` : "")}
                      value={newRow.account ? mergedOptions.find((o) => o.number === newRow.account) || null : null}
                      onChange={(_, v) => setNewRow((r) => ({ ...r, account: v?.number || "", memo: r.memo || (v?.description || "") }))}
                      renderInput={(params) => <TextField {...params} label="Account" placeholder="1000 • Cash" />}
                    />
                  </TableCell>
                  <TableCell><TextField size="small" value={newRow.memo} onChange={(e) => setNewRow((r) => ({ ...r, memo: e.target.value }))} placeholder='Memo (e.g., INV: sku=SKU-001; qty=2; dir=out; wh=MAIN; cost=50)' fullWidth /></TableCell>
                  <TableCell align="right"><TextField size="small" type="number" value={newRow.debit} onChange={(e) => setNewRow((r) => ({ ...r, debit: e.target.value, credit: e.target.value ? "" : r.credit }))} inputProps={{ style: { textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace" } }} /></TableCell>
                  <TableCell align="right"><TextField size="small" type="number" value={newRow.credit} onChange={(e) => setNewRow((r) => ({ ...r, credit: e.target.value, debit: e.target.value ? "" : r.debit }))} inputProps={{ style: { textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace" } }} /></TableCell>
                  {showRunning && <TableCell align="right" />}
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Save"><span><IconButton disabled={!canSaveNew} onClick={handleAdd}><SaveIcon /></IconButton></span></Tooltip>
                    <Tooltip title="Cancel"><IconButton onClick={() => setAdding(false)}><CloseIcon /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              )}

              {/* Sections */}
              {groupedSections.map((g) => {
                let running = 0;
                return (
                  <React.Fragment key={`${g.category}__${g.subtype}`}>
                    <TableRow>
                      <TableCell colSpan={showRunning ? 9 : 8} sx={{ bgcolor: "action.hover" }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Chip label={catTitle(g.category)} size="small" color={catChipColor(g.category)} variant="outlined" />
                          <Typography variant="subtitle2">{g.subtype}</Typography>
                          <Typography variant="caption" color="text.secondary">{g.rows.length} entr{g.rows.length === 1 ? "y" : "ies"}</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>

                    {g.rows.map((r, i) => {
                      const accInfo = resolveAccountDisplay(r.account);
                      const isEditing = editingId === r._id;
                      const locked = !!r.locked || r.source === "JE" || !!r.journalId;
                      const fromJE = r.source === "JE" || !!r.journalId;
                      const displayJe  = r.jeNumber || r.journalNo || fallbackJeFromRow(r);
                      const displayRef = r.reference || fallbackRefFromRow(r);
                      if (showRunning) running += Number(r.debit || 0) - Number(r.credit || 0);

                      return (
                        <TableRow key={r._id || displayJe || displayRef || `${r.date}-${i}`} hover>
                          <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{String(r.date).slice(0,10)}</TableCell>
                          <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                            {displayJe ? (
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Typography variant="body2">{displayJe}</Typography>
                                {fromJE && <Chip size="small" label="From JE" color="info" variant="outlined" />}
                              </Stack>
                            ) : (fromJE && <Chip size="small" label="From JE" color="info" variant="outlined" />)}
                          </TableCell>
                          <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{displayRef ? <Typography variant="body2">{displayRef}</Typography> : ""}</TableCell>
                          <TableCell sx={{ minWidth: 320 }}>
                            {isEditing ? (
                              <Autocomplete
                                size="small" options={mergedOptions} groupBy={(o) => o.groupKey}
                                isOptionEqualToValue={(opt, val) => opt?.number === val?.number}
                                getOptionLabel={(o) => (o ? `${o.label}${o.description ? " — " + o.description : ""}` : "")}
                                value={draft?.account ? mergedOptions.find((o) => o.number === draft.account) || null : null}
                                onChange={(_, v) => setDraft((d) => ({ ...d, account: v?.number || "", memo: (d?.memo ?? "") || (v?.description || "") }))}
                                renderInput={(params) => <TextField {...params} label="Account" />}
                              />
                            ) : (accInfo.label)}
                          </TableCell>
                          <TableCell>{isEditing ? (<TextField size="small" value={draft?.memo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))} />) : (r.memo || accInfo.description)}</TableCell>
                          <TableCell align="right" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{r.debit ? fmtKr(r.debit) : ""}</TableCell>
                          <TableCell align="right" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{r.credit ? fmtKr(r.credit) : ""}</TableCell>
                          {showRunning && (<TableCell align="right" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtKr(running)}</TableCell>)}
                          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                            {locked ? (
                              <Tooltip title={fromJE ? "Locked (from Journal Entry)" : "Locked"}>
                                <span><IconButton disabled><EditIcon /></IconButton><IconButton disabled><DeleteIcon /></IconButton></span>
                              </Tooltip>
                            ) : isEditing ? (
                              <>
                                <Tooltip title="Save"><span><IconButton disabled={!canSaveEdit} onClick={() => saveEdit(r._id)}><SaveIcon /></IconButton></span></Tooltip>
                                <Tooltip title="Cancel"><IconButton onClick={cancelEdit}><CloseIcon /></IconButton></Tooltip>
                              </>
                            ) : (
                              <>
                                <Tooltip title="Edit"><IconButton onClick={() => startEdit(r._id, r)}><EditIcon /></IconButton></Tooltip>
                                <Tooltip title="Delete"><IconButton color="error" onClick={() => remove(r._id, r)}><DeleteIcon /></IconButton></Tooltip>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Section subtotal */}
                    <TableRow>
                      <TableCell colSpan={5} align="right"><Typography variant="body2" fontWeight={600}>Subtotal — {g.subtype}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={600}>{fmtKr(g.debitTotal)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={600}>{fmtKr(g.creditTotal)}</Typography></TableCell>
                      {showRunning && (<TableCell align="right"><Typography variant="body2" fontWeight={600}>{fmtKr(g.debitTotal - g.creditTotal)}</Typography></TableCell>)}
                      <TableCell />
                    </TableRow>
                  </React.Fragment>
                );
              })}

              {/* Totals */}
              <TableRow>
                <TableCell colSpan={5} align="right"><Typography variant="body2" fontWeight={700}>Total (filtered)</Typography></TableCell>
                <TableCell align="right"><Typography variant="body2" fontWeight={700}>{fmtKr(totals.debit)}</Typography></TableCell>
                <TableCell align="right"><Typography variant="body2" fontWeight={700}>{fmtKr(totals.credit)}</Typography></TableCell>
                {showRunning && (<TableCell align="right"><Typography variant="body2" fontWeight={700}>{fmtKr(totals.net)}</Typography></TableCell>)}
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        <Button sx={{ mt: 2 }} onClick={() => setAdding(true)} startIcon={<AddIcon />}>
          Add Entry
        </Button>
      </Paper>
    </Stack>
  );
}

/* ------------------------------
   Inline tests (only run in Jest/Vitest)
---------------------------------*/
if (typeof describe === "function") {
  describe("extractAccountNumber", () => {
    it("parses leading 3+ digits (with optional spaces)", () => {
      expect(extractAccountNumber("1000 Cash")).toBe("1000");
      expect(extractAccountNumber("   1234 Something")).toBe("1234");
    });
    it("returns raw string when there is no leading number", () => {
      expect(extractAccountNumber("Misc")).toBe("Misc");
    });
    it("handles falsy values gracefully", () => {
      expect(extractAccountNumber("")).toBe("");
      expect(extractAccountNumber(null)).toBe("");
      expect(extractAccountNumber(undefined)).toBe("");
    });
  });
}
