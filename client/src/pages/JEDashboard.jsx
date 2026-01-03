import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Paper, Stack, Typography, Button, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Autocomplete, Tooltip, IconButton, Divider, Grid, ToggleButton,
  ToggleButtonGroup, InputAdornment, Box, TableContainer, Link
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { alpha } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DescriptionIcon from "@mui/icons-material/Description";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import SearchIcon from "@mui/icons-material/Search";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/* ---------- Brand palette (same as invoice) ---------- */
const BRAND = {
  name: "Acta Venture Partners Aps",
  address: "Ravnsborg Tværgade 1, 1. 2200 København N• CVR 44427508",
  logoUrl: "/ACTA_logo.png",
  primary: "#0E4C92",
  primaryLight: "#315d93ff",
  primaryBorder: "#324870ff",
  primaryDark: "#0E4C92",
};

/* ---------- Currency / date helpers ---------- */
const fmtKr = (n) => (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const normalizeAmount = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const extractAccountNumber = (raw) => {
  if (!raw) return "";
  const m = String(raw).match(/^\s*(\d{3,})/);
  return m?.[1] || String(raw);
};
const yyyymmdd = (dStr) => {
  const d = new Date(dStr || new Date());
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0");
  return `${y}${m}${day}`;
};

/* ---------- JE/Ref number + People helpers (persisted per day) ---------- */
const generateJeNumberBase = (dateStr) => {
  const dayKey = yyyymmdd(dateStr);
  const storeKey = `app.je.seq.${dayKey}`;
  let seq = 0;
  try {
    const prev = localStorage.getItem(storeKey);
    seq = prev ? Number(prev) : 0;
    if (seq === 0) {
      seq = 1;
      localStorage.setItem(storeKey, String(seq));
    }
  } catch {}
  return `JE-${dayKey}-${String(seq).padStart(4, "0")}`;
};

const getDailyJeNo = (dayISO) => {
  try { return localStorage.getItem(`app.daily.jeNo.${dayISO}`) || ""; } catch { return ""; }
};
const setDailyJeNo = (dayISO, jeNo) => {
  try { localStorage.setItem(`app.daily.jeNo.${dayISO}`, jeNo || ""); } catch {}
};

const getDailyUniqueTail = (dayISO) => {
  const key = `app.daily.seq.${dayISO}`;
  let n = 0;
  try { n = Number(localStorage.getItem(key) || "0"); n += 1; localStorage.setItem(key, String(n)); } catch {}
  return String(n).padStart(2, "0");
};

const generateRefNumber = (dateStr) => {
  const dayKey = yyyymmdd(dateStr);
  const storeKey = `app.ref.seq.${dayKey}`;
  let seq = 0;
  try {
    const prev = localStorage.getItem(storeKey);
    seq = prev ? Number(prev) : 0;
    seq += 1;
    localStorage.setItem(storeKey, String(seq));
  } catch {}
  return `REF-${dayKey}-${String(seq).padStart(4, "0")}`;
};

const emptyPeople = { prepared:{name:"",at:null}, approved:{name:"",at:null}, posted:{name:"",at:null} };
const getDailyPeople = (dayISO) => {
  try {
    const raw = localStorage.getItem(`app.daily.people.${dayISO}`);
    return raw ? JSON.parse(raw) : { ...emptyPeople };
  } catch { return { ...emptyPeople }; }
};
const setDailyPeople = (dayISO, obj) => {
  try { localStorage.setItem(`app.daily.people.${dayISO}`, JSON.stringify(obj || {})); } catch {}
};

/* ---------- Print (PDF) helper (same structure as invoice) ---------- */
function printHtml(title, html) {
  const docHtml = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${String(title).replace(/</g,"&lt;")}</title>
<style>
  :root{
    --bg:#ffffff; --fg:#000000;
    --muted:#56657a; --line:${BRAND.primaryBorder};
    --brand:${BRAND.primary}; --th-bg:${BRAND.primaryLight}; --th-fg:#ffffff;
  }
  *{ box-sizing:border-box; }
  html,body{ background:var(--bg); color:var(--fg); }
  body{ font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; margin:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 10mm 12mm; }

  .container{ width:100%; max-width:100%; margin:0; }
  h1,h2,h3{ margin:12px 0 6px; }
  .small{ font-size: 11px; }
  .muted{ color:var(--muted); }
  .right{ text-align:right; }
  .num{ text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
  .hdr{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
  .brand{ display:flex; align-items:center; gap:10px; }
  .brand .name{ font-weight:700; color:var(--brand); }
  .date{ font-weight:600; }

  table.report{ width:100%; border-collapse:collapse; margin-top:6px; table-layout:fixed; }
  table.report th, table.report td{ border-bottom:0.6pt solid var(--line); padding:8px; vertical-align:top; }
  table.report thead th{ background:var(--th-bg); color:var(--th-fg); text-align:left; }
  table.report tfoot td{ border-top:0.9pt solid var(--line); font-weight:600; }
  table.report tfoot td:first-child, table.report tfoot td:nth-child(2){ text-align:right; }

  /* Journal Single columns */
  table.report.je-one colgroup col:nth-child(1){ width:17%; }
  table.report.je-one colgroup col:nth-child(2){ width:23%; }
  table.report.je-one colgroup col:nth-child(3){ width:36%; }
  table.report.je-one colgroup col:nth-child(4){ width:12%; }
  table.report.je-one colgroup col:nth-child(5){ width:12%; }

  /* Journal Daily columns */
  table.report.je-day colgroup col:nth-child(1){ width:12%; }
  table.report.je-day colgroup col:nth-child(2){ width:18%; }
  table.report.je-day colgroup col:nth-child(3){ width:18%; }
  table.report.je-day colgroup col:nth-child(4){ width:12%; }
  table.report.je-day colgroup col:nth-child(5){ width:20%; }
  table.report.je-day colgroup col:nth-child(6){ width:20%; }
  table.report.je-day colgroup col:nth-child(7){ width:10%; }
  table.report.je-day colgroup col:nth-child(8){ width:10%; }

  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, td, th { break-inside: avoid; page-break-inside: avoid; }
  table { page-break-inside: auto; }
  .no-break { break-inside: avoid; page-break-inside: avoid; }
  .totals-block { break-inside: avoid; page-break-inside: avoid; }

  @media print { .rounded{ border:none !important; border-radius:0 !important; padding:0; } }
</style>
</head>
<body>
<div class="container rounded">
${html}
</div>
<script>
  window.addEventListener('load', () => {
    const tryPrint = () => { try { window.print(); } catch(e){} };
    const imgs = Array.from(document.images);
    if (imgs.length === 0) return tryPrint();
    let left = imgs.length;
    imgs.forEach(img => {
      if (img.complete) { if(--left===0) tryPrint(); }
      else {
        img.addEventListener('load', () => { if(--left===0) tryPrint(); });
        img.addEventListener('error', () => { if(--left===0) tryPrint(); });
      }
    });
    setTimeout(tryPrint, 700);
  });
</script>
</body>
</html>`.trim();

  try {
    const blob = new Blob([docHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) return;
    const iframe = document.createElement("iframe");
    iframe.style.position="fixed"; iframe.style.right="0"; iframe.style.bottom="0";
    iframe.style.width="0"; iframe.style.height="0"; iframe.style.border="0";
    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      finally { setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 500); }
    };
    iframe.src = url;
    document.body.appendChild(iframe);
  } catch (e) { console.error("Print failed", e); }
}

/* =========================================================
   Chart of Accounts Suggestions (trimmed)
   ========================================================= */
const NAME_SUGGESTIONS = {
  ASSET: { "Cash & Cash Equivalents": ["1000 Cash","1010 Petty Cash","1100 Bank","1400 Short-Term Investments"], },
  LIABILITY: { "Accounts Payable": ["2000 Accounts Payable"] },
  EQUITY: { "Paid-in Capital": ["3000 Share Capital"] },
  REVENUE: { "Product Revenue": ["4000 Sales Revenue"], "Other Income": ["4200 Rental Income"] },
  EXPENSE: { "COGS / Cost of Sales": ["5000 Cost of Goods Sold (COGS)"], Payroll: ["5100 Salaries & Wages"], Facilities: ["5200 Rent Expense"], Operations: ["6300 Bank Charges","6400 IT / Software Expense"], },
};

const NAME_META = {
  "1000 Cash": "Cash on hand and in bank accounts",
  "4200 Rental Income": "Income from renting property or equipment",
  "5200 Rent Expense": "Payments for office or building rent",
  "6400 IT / Software Expense": "Software subscriptions and IT systems",
};

/* ---------- Categorization helpers ---------- */
const CAT_TITLES = { ASSET:"Assets", LIABILITY:"Liabilities", EQUITY:"Equity", REVENUE:"Revenue", EXPENSE:"Expenses" };
const catTitle = (c) => CAT_TITLES[c] || c || "";
const SUGGESTION_INDEX = (() => {
  const idx = new Map();
  Object.entries(NAME_SUGGESTIONS).forEach(([cat, subs]) => {
    Object.entries(subs).forEach(([subtype, labels]) =>
      labels.forEach((label) => {
        const num = label.split(" ")[0];
        if (!idx.has(num)) idx.set(num, { category: cat, subtype });
      })
    );
  });
  return idx;
})();
const inferCategoryFromNumber = (num) => {
  const s = String(num || ""); const f = s[0];
  if (f === "1") return "ASSET";
  if (f === "2") return "LIABILITY";
  if (f === "3") return "EQUITY";
  if (f === "4") return "REVENUE";
  if (["5","6","7","8","9"].includes(f)) return "EXPENSE";
  return "EXPENSE";
};

/* =========================================================
   Counter-Account Suggestion Matrix (rules)
   ========================================================= */
const COUNTER_RULES = {
  debit: {
    EXPENSE:   ["ASSET", "LIABILITY"],
    ASSET:     ["ASSET", "LIABILITY", "EQUITY"],
    LIABILITY: ["ASSET", "EXPENSE"],
    EQUITY:    ["ASSET", "LIABILITY"],
    REVENUE:   ["ASSET", "LIABILITY"],
  },
  credit: {
    REVENUE:   ["ASSET", "LIABILITY"],
    LIABILITY: ["ASSET", "EXPENSE"],
    ASSET:     ["EXPENSE", "ASSET"],
    EQUITY:    ["ASSET"],
    EXPENSE:   ["ASSET", "LIABILITY"],
  },
};

/* ---------- utils for editor ---------- */
const normalizeAmountSafe = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const cleanMoney = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const toFixed2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const computeBase = ({ amount, fxRateEntry = 1, fxRate }) => toFixed2(amount * ((fxRate ?? fxRateEntry) || 1));
const normalizeRow = (row = {}, entryFx = 1, entryCurr = "DKK") => {
  const account = extractAccountNumber(row.account || "");
  const debit = Math.max(0, cleanMoney(row.debit));
  const credit = Math.max(0, cleanMoney(row.credit));
  const fxRate = Number.isFinite(Number(row.fxRate)) ? Number(row.fxRate) : null;
  const amount = debit > 0 ? debit : credit;
  const baseAmount = computeBase({ amount, fxRateEntry: entryFx, fxRate });
  return { account, memo: (row.memo || "").trim(), debit: credit > 0 ? 0 : debit, credit: debit > 0 ? 0 : credit, currency: (row.currency || entryCurr || "DKK").toUpperCase(), fxRate, baseAmount };
};
const totalsBy = (rows = []) =>
  rows.reduce((acc, r) => ({
    debit: acc.debit + cleanMoney(r.debit),
    credit: acc.credit + cleanMoney(r.credit),
    baseDebit: acc.baseDebit + (cleanMoney(r.debit) > 0 ? cleanMoney(r.baseAmount) : 0),
    baseCredit: acc.baseCredit + (cleanMoney(r.credit) > 0 ? cleanMoney(r.baseAmount) : 0),
  }), { debit: 0, credit: 0, baseDebit: 0, baseCredit: 0 });

/* ---------- HTML renderers (match invoice styling) ---------- */
function renderSingleJEHTML(entry, optionByNumber = new Map()) {
  const currency = entry?.currency?.code || "DKK";
  const fmt = (n) => (n ?? 0).toLocaleString("da-DK", { style: "currency", currency });
  const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  const jeDisplay = (entry?.jeNumber || "").replace(/-\d{2}$/, "") || "-";
  const date = String(entry?.date || "").slice(0, 10);
  const ref = entry?.reference || "-";
  const status = (entry?.status || "draft").toUpperCase();

  const ppl = entry?.participants || {};
  const prepared = ppl.preparedBy || {};
  const approved = ppl.approvedBy || {};
  const posted   = ppl.postedBy   || {};

  const lines = Array.isArray(entry?.lines) ? entry.lines : [];
  let td = 0, tc = 0;

  const rows = lines.map((l) => {
    const number = String(l.account || "");
    const opt = optionByNumber.get(number) || {};
    const name = opt?.label ? String(opt.label).split(" • ")[1] : opt?.name || "";
    const desc = (l.memo || "").trim() || opt?.description || "";
    const d = +l.debit || 0, c = +l.credit || 0;
    td += d; tc += c;
    return `
      <tr>
        <td>${number || "-"}</td>
        <td>${name || "-"}</td>
        <td>${(desc || "-").replace(/</g, "&lt;")}</td>
        <td class="num">${d ? fmt(d) : ""}</td>
        <td class="num">${c ? fmt(c) : ""}</td>
      </tr>
    `;
  }).join("");

  const peopleBlock = `
    <div class="grid no-break" style="margin:8px 0 0; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;">
      <div>
        <div class="small muted">Prepared by</div>
        <div>
          ${prepared.name || "—"}
          ${prepared.at ? `<span class="small muted"> — ${fmtDT(prepared.at)}</span>` : ""}
        </div>
      </div>
      <div>
        <div class="small muted">Approved by</div>
        <div>
          ${approved.name || "—"}
          ${approved.at ? `<span class="small muted"> — ${fmtDT(approved.at)}</span>` : ""}
        </div>
      </div>
      <div>
        <div class="small muted">Posted by</div>
        <div>
          ${posted.name || "—"}
          ${posted.at ? `<span class="small muted"> — ${fmtDT(posted.at)}</span>` : ""}
        </div>
      </div>
    </div>
  `;

  return `
    <div class="hdr">
      <div class="brand">
        <img src="${BRAND.logoUrl}" alt="" height="32"/>
        <div>
          <div class="name">${BRAND.name}</div>
          <div class="small muted">${BRAND.address}</div>
        </div>
      </div>
      <div class="right">
        <h2>Journal Entry</h2>
        <div class="small muted">JE No.</div>
        <div><strong>${jeDisplay}</strong></div>
      </div>
    </div>

    <div class="grid no-break" style="margin-bottom:10px; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px;">
      <div><div class="small muted">Date</div><div>${date || "-"}</div></div>
      <div><div class="small muted">Reference</div><div>${ref}</div></div>
      <div><div class="small muted">Status</div><div>${status}</div></div>
      <div><div class="small muted">Currency</div><div>${currency}</div></div>
    </div>

    ${peopleBlock}

    <table class="report je-one">
      <colgroup><col/><col/><col/><col/><col/></colgroup>
      <thead>
        <tr><th>Account No.</th><th>Account Name</th><th>Description</th><th>Debit</th><th>Credit</th></tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5" class="small muted">No lines.</td></tr>`}</tbody>
      <tfoot class="totals-block">
        <tr><td colspan="3" class="right">Total</td><td class="num">${fmt(td)}</td><td class="num">${fmt(tc)}</td></tr>
      </tfoot>
    </table>

    <p class="small muted no-break" style="margin-top:10px">
      Header memo: ${(entry?.memo || "—").replace(/</g,"&lt;")}
    </p>
  `;
}

function renderDailyJournalHTML({
  date,
  entries,
  optionByNumber = new Map(),
  dailyJeNo = "",
  dailyPeople = {},
}) {
  const fmt = (n) => n.toLocaleString("da-DK", { style: "currency", currency: "DKK" });
  const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  const rows = (entries || []).flatMap((e) => {
    const d = String(e?.date || "").slice(0, 10);
    const je = dailyJeNo || (e?.jeNumber || "").replace(/-\d{2}$/, "");
    const ref = e?.reference || "";
    const memo = e?.memo || "";
    return (e?.lines || []).map((l) => {
      const number = String(l.account || "");
      const opt = optionByNumber.get(number) || {};
      const name = opt?.label ? String(opt.label).split(" • ")[1] : opt?.name || "";
      const desc = (l.memo || "").trim() || memo || opt?.description || "";
      return { d, je, ref, number, name, desc, debit: +l.debit || 0, credit: +l.credit || 0 };
    });
  });

  const totals = rows.reduce(
    (s, r) => ({ d: s.d + r.debit, c: s.c + r.credit }),
    { d: 0, c: 0 }
  );

  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${r.d}</td>
        <td>${r.je}</td>
        <td>${r.ref}</td>
        <td>${r.number}</td>
        <td>${r.name || "-"}</td>
        <td>${(r.desc || "-").replace(/</g, "&lt;")}</td>
        <td class="num">${r.debit ? fmt(r.debit) : ""}</td>
        <td class="num">${r.credit ? fmt(r.credit) : ""}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="small muted">No lines for this day.</td></tr>`;

  const peopleBlock = `
    <div class="grid no-break" style="margin:8px 0 0; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px;">
      <div>
        <div class="small muted">JE No. (shared)</div>
        <div>${dailyJeNo || "—"}</div>
      </div>
      <div>
        <div class="small muted">Prepared by</div>
        <div>
          ${dailyPeople?.prepared?.name || "—"}
          ${dailyPeople?.prepared?.at ? `<span class="small muted"> — ${fmtDT(dailyPeople.prepared.at)}</span>` : ""}
        </div>
      </div>
      <div>
        <div class="small muted">Approved by</div>
        <div>
          ${dailyPeople?.approved?.name || "—"}
          ${dailyPeople?.approved?.at ? `<span class="small muted"> — ${fmtDT(dailyPeople.approved.at)}</span>` : ""}
        </div>
      </div>
      <div>
        <div class="small muted">Posted by</div>
        <div>
          ${dailyPeople?.posted?.name || "—"}
          ${dailyPeople?.posted?.at ? `<span class="small muted"> — ${fmtDT(dailyPeople.posted.at)}</span>` : ""}
        </div>
      </div>
    </div>`;

  return `
    <div class="hdr">
      <div class="brand">
        <img src="${BRAND.logoUrl}" alt="" height="36"/>
        <div>
          <div class="name">${BRAND.name}</div>
          <div class="small muted">${BRAND.address}</div>
        </div>
      </div>
      <div class="right">
        <div class="small muted">Purchase BILL: ${dailyJeNo || "-"}</div>
        <h2 style="margin: 4px 0 0">Daily Standard Journal</h2>
        <div class="date">${date}</div>
      </div>
    </div>

    ${peopleBlock}

    <table class="report je-day" style="margin-top:8px">
      <colgroup><col/><col/><col/><col/><col/><col/><col/><col/></colgroup>
      <thead>
        <tr>
          <th>Date</th><th>JE No.</th><th>Reference</th>
          <th>Acct No.</th><th>Account Name</th><th>Description</th>
          <th>Debit</th><th>Credit</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <td colspan="6" class="right">Total</td>
          <td class="num">${fmt(totals.d)}</td>
          <td class="num">${fmt(totals.c)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

/* ================= Canonical mapping ================= */
const toCanonicalEntry = (e) => {
  const lines = Array.isArray(e?.lines) ? e.lines : [];
  return {
    _id: e?._id || e?.id,
    jeNumber: e?.jeNumber || "",
    date: e?.date,
    status: e?.status || "draft",
    reference: e?.reference || "",
    memo: e?.memo || "",
    currency: e?.currency || { code: "DKK", rate: 1 },
    lines: lines.map((l) => ({ account: String(l.account || ""), memo: l.memo || "", debit: +l.debit || 0, credit: +l.credit || 0 })),
    participants: e?.participants || {
      preparedBy: { name: e?.preparedByName || e?.preparedBy || "", at: e?.preparedAt || null },
      approvedBy: { name: e?.approvedByName || e?.approvedBy || "", at: e?.approvedAt || null },
      postedBy:   { name: e?.postedByName   || e?.postedBy   || "", at: e?.postedAt   || null },
    },
    preparedAt: e?.preparedAt || null,
    approvedAt: e?.approvedAt || null,
    postedAt:   e?.postedAt   || null,
    headerId: e?.headerId || "",
  };
};

/* ------------ filtering helpers for editor ------------- */
const resolveType = (num, optionByNumber) => {
  const n = String(num || "");
  const meta = optionByNumber?.get(n);
  return (meta?.category) || inferCategoryFromNumber(n);
};
const filterByCounterRules = ({ startAccountNumber, startSide, mergedOptions, optionByNumber, showAll }) => {
  if (showAll || !startAccountNumber) return mergedOptions;
  const startType = resolveType(startAccountNumber, optionByNumber);
  const allowed = COUNTER_RULES?.[startSide]?.[startType];
  if (!allowed) return mergedOptions;
  return mergedOptions.filter((o) => allowed.includes(o.category));
};

/* ------------ LineEditorTable ------------- */
function LineEditorTable({
  rows, onChange, accountsOptions, optionByNumber,
  fxMode = "entry", entryCurrency = "DKK", entryFx = 1,
  headerTone = "brand",
  headerBgOverride,
  headerFgOverride,
}) {
  const theme = useTheme();
  const grid = theme.palette.divider;

  // ALWAYS blue (unless explicitly overridden)
  const ALWAYS_BLUE  = "#136de2ff";
  const ALWAYS_WHITE = "#ffffff";

  const headerBg = headerBgOverride || ALWAYS_BLUE;
  const headerFg = headerFgOverride || ALWAYS_WHITE;

  // subtle zebra that doesn't depend on theme mode
  const zebra = alpha(ALWAYS_BLUE, 0.06);

  const update = (idx, patch) => {
    const next = rows.slice();
    next[idx] = normalizeRow({ ...next[idx], ...patch }, entryFx, entryCurrency);
    const acc = String(next[idx].account || "");
    if (!next[idx].memo && acc) {
      const meta = optionByNumber.get(acc) || {};
      next[idx].memo = meta.description || (meta.label ? meta.label.split(" • ")[1] : "");
    }
    onChange(next);
  };

  const addRow = () =>
    onChange([
      ...rows,
      { account: "", memo: "", debit: 0, credit: 0, currency: entryCurrency, fxRate: null },
    ]);

  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  const PREFERRED_NUMBERS = {
    CASHLIKE: new Set(["1000", "1010", "1100"]),
    AP: new Set(["2000"]),
    AR: new Set(["1200"]),
    EQUITYIN: new Set(["3000"]),
  };
  const NAME_PATTERNS = {
    CASHLIKE: /(cash|bank|checking|konto)/i,
    AP: /(accounts?\s*payable|leverandørgæld|kreditor)/i,
    AR: /(accounts?\s*receivable|debitor)/i,
    DEFERRED_REV: /(deferred\s*rev|udskudt\s*indtægt)/i,
  };
  const preferredBucketsFor = (startType, side) => {
    if (side === "debit") {
      switch (startType) {
        case "EXPENSE":   return ["CASHLIKE", "AP"];
        case "ASSET":     return ["CASHLIKE", "AP", "EQUITYIN"];
        case "LIABILITY": return ["CASHLIKE"];
        case "EQUITY":    return ["CASHLIKE", "AP"];
        case "REVENUE":   return ["CASHLIKE"];
        default:          return ["CASHLIKE"];
      }
    } else if (side === "credit") {
      switch (startType) {
        case "REVENUE":   return ["AR", "CASHLIKE"];
        case "LIABILITY": return ["EXPENSE", "ASSET"];
        case "ASSET":     return ["EXPENSE", "ASSET"];
        case "EQUITY":    return ["CASHLIKE"];
        case "EXPENSE":   return ["CASHLIKE", "AP"];
        default:          return ["CASHLIKE"];
      }
    }
    return [];
  };
  const scoreCounterOption = (opt, buckets) => {
    const number = String(opt.number || "");
    const label = `${opt.label || ""} ${opt.description || ""}`;
    const hits = [];
    if (buckets.includes("CASHLIKE")) { if (PREFERRED_NUMBERS.CASHLIKE.has(number)) hits.push(10); if (NAME_PATTERNS.CASHLIKE.test(label)) hits.push(6); }
    if (buckets.includes("AP")) { if (PREFERRED_NUMBERS.AP.has(number)) hits.push(9); if (NAME_PATTERNS.AP.test(label)) hits.push(5); }
    if (buckets.includes("AR")) { if (PREFERRED_NUMBERS.AR.has(number)) hits.push(9); if (NAME_PATTERNS.AR.test(label)) hits.push(5); }
    if (buckets.includes("EXPENSE") && opt.category === "EXPENSE") hits.push(4);
    if (buckets.includes("ASSET") && opt.category === "ASSET") hits.push(3);
    if (/deferred/i.test(label) && buckets.includes("DEFERRED_REV")) hits.push(4);
    return hits.length ? Math.max(...hits) : 0;
  };
  const filteredOptionsForRow = (idx) => {
    try {
      const me = rows[idx] || {};
      const others = rows.filter((_, i) => i !== idx);
      const withAmount = others.filter((r) => (r.debit > 0) !== (r.credit > 0));
      if (withAmount.length !== 1 || me.account) return accountsOptions;
      const first = withAmount[0];
      const startSide = first.debit > 0 ? "debit" : "credit";
      const startAcc = String(first.account || "");
      return filterByCounterRules({
        startAccountNumber: startAcc,
        startSide,
        mergedOptions: accountsOptions,
        optionByNumber,
        showAll: false,
      });
    } catch {
      return accountsOptions;
    }
  };
  const counterOptionsForThisRow = (row) => {
    const accNo = String(row.account || "");
    if (!accNo) return [];
    const side = row.debit > 0 ? "debit" : row.credit > 0 ? "credit" : null;
    if (!side) return [];
    const startType = resolveType(accNo, optionByNumber);
    const allowedCats = COUNTER_RULES?.[side]?.[startType];
    if (!allowedCats || !allowedCats.length) return [];
    const base = accountsOptions.filter((o) => allowedCats.includes(o.category));
    const buckets = preferredBucketsFor(startType, side);
    const withScore = base.map((o) => ({ ...o, __score: scoreCounterOption(o, buckets) }));
    const suggested = withScore.filter((o) => o.__score > 0).sort((a, b) => b.__score - a.__score);
    const others = withScore.filter((o) => o.__score === 0);
    const tag = (o, g) => ({ ...o, rankGroup: g });
    return [...suggested.map((o) => tag(o, "Suggested first")), ...others.map((o) => tag(o, "Also plausible"))];
  };
  const applyCounterToOpposite = (idx, counterNumber) => {
    const current = rows[idx] || {};
    const amount = current.debit > 0 ? current.debit : current.credit;
    const isDebit = current.debit > 0;
    const oppositeIsDebit = !isDebit;
    const next = rows.slice();
    let targetIdx = next.findIndex((r, i) => {
      if (i === idx) return false;
      const rIsDebit = r.debit > 0;
      const hasOppSide = rIsDebit === oppositeIsDebit;
    const amountMatches = (r.debit || r.credit) ? (r.debit || r.credit) === amount : true;
      const noAccount = !r.account;
      return hasOppSide && amountMatches && noAccount;
    });
    if (targetIdx === -1) {
      const newRow = normalizeRow(
        {
          account: counterNumber,
          memo: "",
          debit: oppositeIsDebit ? amount : 0,
          credit: oppositeIsDebit ? 0 : amount,
          currency: entryCurrency,
          fxRate: null,
        },
        entryFx,
        entryCurrency
      );
      next.splice(idx + 1, 0, newRow);
    } else {
      next[targetIdx] = normalizeRow({ ...next[targetIdx], account: counterNumber }, entryFx, entryCurrency);
    }
    onChange(next);
  };

  return (
    <Stack spacing={1}>
      <Table
        size="small"
        sx={{
          "& th, & td": { borderColor: grid },
          "& thead th": {
            bgcolor: headerBg,
            color: headerFg,
            borderBottom: `2px solid ${headerBg}`,
            whiteSpace: "nowrap",
            fontSize: 13,
          },
          "& td": { fontSize: 13 },
          "& tbody tr:nth-of-type(odd)": { bgcolor: zebra },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell width={fxMode === "line" ? "28%" : "36%"}>Account</TableCell>
            <TableCell width={fxMode === "line" ? "24%" : "30%"}>Memo</TableCell>
            <TableCell align="right" width="12%">Debit</TableCell>
            <TableCell align="right" width="12%">Credit</TableCell>
            {fxMode === "line" && <TableCell width="10%">Currency</TableCell>}
            {fxMode === "line" && <TableCell width="10%">FX rate</TableCell>}
            <TableCell align="center" width="6%"></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, idx) => {
            const side = r.debit > 0 ? "debit" : r.credit > 0 ? "credit" : undefined;
            const counterOpts = counterOptionsForThisRow(r);
            return (
              <TableRow key={idx}>
                <TableCell>
                  <Stack spacing={0.75}>
                    <Autocomplete
                      size="small"
                      options={filteredOptionsForRow(idx)}
                      groupBy={(o) => o.groupKey}
                      getOptionLabel={(o) =>
                        o ? `${o.label}${o.description ? " — " + o.description : ""}` : ""
                      }
                      value={
                        r.account
                          ? filteredOptionsForRow(idx).find((o) => o.number === String(r.account)) || null
                          : null
                      }
                      onChange={(_, v) => update(idx, { account: v?.number || "" })}
                      renderInput={(params) => <TextField {...params} placeholder="e.g., 5200 • Rent Expense" />}
                    />
                    <Autocomplete
                      size="small"
                      options={counterOpts}
                      groupBy={(o) => o.rankGroup || "Also plausible"}
                      getOptionLabel={(o) =>
                        o ? `${o.label}${o.description ? " — " + o.description : ""}` : ""
                      }
                      value={null}
                      onChange={(_, v) => v && applyCounterToOpposite(idx, v.number)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Counter (balanced suggestions)"
                          placeholder={
                            side
                              ? `Choose ${side === "debit" ? "credit" : "debit"} side`
                              : "Enter a debit or credit amount to see suggestions"
                          }
                          size="small"
                        />
                      )}
                      disabled={!side || !r.account}
                      noOptionsText={
                        !side
                          ? "Enter a debit or credit amount"
                          : "No counter suggestions"
                      }
                    />
                  </Stack>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    value={r.memo || ""}
                    onChange={(e) => update(idx, { memo: e.target.value })}
                    placeholder="Line memo"
                    fullWidth
                  />
                </TableCell>

                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    inputProps={{ min: 0, step: "0.01" }}
                    value={r.debit || ""}
                    onChange={(e) => update(idx, { debit: e.target.value, credit: 0 })}
                  />
                </TableCell>

                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    inputProps={{ min: 0, step: "0.01" }}
                    value={r.credit || ""}
                    onChange={(e) => update(idx, { credit: e.target.value, debit: 0 })}
                  />
                </TableCell>

                {fxMode === "line" && (
                  <TableCell>
                    <TextField
                      size="small"
                      value={r.currency || entryCurrency}
                      onChange={(e) =>
                        update(idx, { currency: (e.target.value || entryCurrency).toUpperCase() })
                      }
                      placeholder={entryCurrency}
                    />
                  </TableCell>
                )}

                {fxMode === "line" && (
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ min: 0, step: "0.0001" }}
                      value={r.fxRate ?? ""}
                      onChange={(e) => update(idx, { fxRate: e.target.value })}
                      placeholder={String(entryFx || 1)}
                    />
                  </TableCell>
                )}

                <TableCell align="center">
                  <IconButton size="small" onClick={() => removeRow(idx)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}

          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={fxMode === "line" ? 7 : 5} align="center">
                <Typography variant="body2" color="text.secondary">
                  No lines yet — add at least 2 rows (one debit, one or more credits).
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Button startIcon={<AddCircleOutlineIcon />} onClick={addRow}>
          Add line
        </Button>
      </Stack>
    </Stack>
  );
}

/* === JournalEntryDoc (single JE view; same structure as invoice preview) === */
function JournalEntryDoc({ entry, optionByNumber=new Map(), companyName="ACTA"}){
  const theme = useTheme();
  const txtSec = theme.palette.text.secondary;
  const grid = theme.palette.divider;
  const theadBg = theme.palette.primary.main;
  const theadFg = theme.palette.getContrastText(theadBg);
  const zebra = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.03);
  const currency = entry?.currency?.code || "DKK";
  const fmt = (n) => (n ?? 0).toLocaleString("da-DK", { style: "currency", currency });

  const jeDisplay = (entry?.jeNumber || "").replace(/-\d{2}$/, "") || "—";
  const lines = Array.isArray(entry?.lines) ? entry.lines : [];
  const rows = lines.map((l) => {
    const number = String(l.account || "");
    const opt = optionByNumber.get(number) || {};
    const name = opt?.label ? String(opt.label).split(" • ")[1] : opt?.name || "";
    const description = (l.memo || "").trim() || opt?.description || "";
    return { number, name, description, debit: +l.debit || 0, credit: +l.credit || 0 };
  });
  const totals = rows.reduce((acc,r)=>({ d: acc.d + r.debit, c: acc.c + r.credit }), { d:0, c:0 });

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow:"hidden" }}>
      <Box sx={{ px:2, pt:2, pb:1 }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item xs>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: ".01em", color: theme.palette.primary.main }}>{companyName}</Typography>
            <Typography variant="body2" sx={{ color: txtSec }}>Journal Entry — View</Typography>
          </Grid>
          <Grid item><Chip size="small" color={entry?.status==="posted"?"success":entry?.status==="approved"?"info":"default"} label={(entry?.status || "draft").toUpperCase()} /></Grid>
        </Grid>

        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={12} md={3}><Typography variant="caption" color={txtSec}>JE No.</Typography><Typography variant="body2" fontWeight={700}>{jeDisplay}</Typography></Grid>
          <Grid item xs={12} md={3}><Typography variant="caption" color={txtSec}>Date</Typography><Typography variant="body2">{String(entry?.date||"").slice(0,10) || "—"}</Typography></Grid>
          <Grid item xs={12} md={3}><Typography variant="caption" color={txtSec}>Reference</Typography><Typography variant="body2">{entry?.reference || "—"}</Typography></Grid>
          <Grid item xs={12} md={3}><Typography variant="caption" color={txtSec}>Currency</Typography><Typography variant="body2">{currency}</Typography></Grid>
        </Grid>
      </Box>

      <TableContainer sx={{ borderTop: `1px solid ${grid}` }}>
        <Table size="small" sx={{
          "& th, & td": { borderColor: grid },
          "& thead th": { bgcolor: theadBg, color: theadFg, borderBottom: `2px solid ${theadBg}`, whiteSpace: "nowrap", fontSize: 13 },
          "& td": { fontSize: 13 },
          "& tbody tr:nth-of-type(odd)": { bgcolor: zebra },
        }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 140 }}>Account No.</TableCell>
              <TableCell sx={{ width: 260 }}>Account Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right" sx={{ width: 140 }}>Debit</TableCell>
              <TableCell align="right" sx={{ width: 140 }}>Credit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length ? rows.map((r, idx)=>(
              <TableRow key={idx}>
                <TableCell sx={{ fontWeight: 700 }}>{r.number || "—"}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{r.name || "—"}</TableCell>
                <TableCell><Typography variant="body2">{r.description || "—"}</Typography></TableCell>
                <TableCell align="right">{r.debit ? fmt(r.debit) : ""}</TableCell>
                <TableCell align="right">{r.credit ? fmt(r.credit) : ""}</TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2" color={txtSec}>No lines</Typography></TableCell></TableRow>
            )}
            <TableRow>
              <TableCell /><TableCell />
              <TableCell align="right"><Typography variant="body2" fontWeight={800}>Total</Typography></TableCell>
              <TableCell align="right"><Typography variant="body2" fontWeight={800}>{fmt(totals.d)}</Typography></TableCell>
              <TableCell align="right"><Typography variant="body2" fontWeight={800}>{fmt(totals.c)}</Typography></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ px:2, py:1.25, borderTop: `1px solid ${grid}`, display:"flex", justifyContent:"space-between", color: txtSec }}>
        <Typography variant="caption">© {new Date().getFullYear()} {companyName}. Confidential.</Typography>
      </Box>
    </Paper>
  );
}
/* --- Daily Standard Journal (inline preview + actions) --- */
function StandardJournalDoc({
  headerTitle = "Daily Standard Journal",
  headerDate,
  entries = [],
  optionByNumber = new Map(),
  companyName = "ACTA",
  dailyJeNo,
  dailyPeople,
  onChangePeople,
  onOpen,
  onApproveAll,
  onPostAll,
  onExportPdf,
  preparedOptions = [],
  approvedOptions = [],
  postedOptions = [],
  peopleLoading = false,
}) {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const theadBg = theme.palette.primary.main;
  const theadFg = theme.palette.getContrastText(theadBg);
  const currency = "DKK";
  const fmt = (n) => (n ?? 0).toLocaleString("da-DK", { style: "currency", currency });
  const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  const rows = entries.flatMap((e) => {
    const dateStr = String(e?.date || "").slice(0, 10);
    const displayJe = dailyJeNo || (e?.jeNumber || "").replace(/-\d{2}$/, "");
    const ref = e?.reference || "";
       const memo = e?.memo || "";
    return (e?.lines || []).map((l) => {
      const number = String(l.account || "");
      const opt = optionByNumber.get(number) || {};
      const name = opt?.label ? String(opt.label).split(" • ")[1] : opt?.name || "";
      const desc = (l.memo || "").trim() || memo || opt?.description || "";
      return { date: dateStr, jeNumber: displayJe, reference: ref, entryMemo: memo, account: number, name, desc, debit: +l.debit || 0, credit: +l.credit || 0 };
    });
  });

  const totals = rows.reduce((s,r)=>({ d: s.d + r.debit, c: s.c + r.credit }), { d:0, c:0 });
  const balanced = Math.abs(totals.d - totals.c) < 0.005 && totals.d > 0;

  return (
    <Paper variant="outlined" sx={{ overflow:"hidden", borderRadius: 2 }}>
      <Box sx={{ p:2, borderBottom: `2px solid ${grid}` }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{companyName}</Typography>
            <Typography variant="body2" color="text.secondary">{headerTitle} — {headerDate || "—"}</Typography>
          </Box>
          <Chip size="small" color={balanced ? "success" : "warning"} label={balanced ? "Balanced" : `Out by ${fmt(Math.abs(totals.d - totals.c))}`} sx={{ mr: 1 }}/>
          <Button size="small" variant="outlined" onClick={onOpen}>View</Button>
          <Button size="small" variant="outlined" onClick={onApproveAll}>Approve All</Button>
          <Button size="small" variant="contained" onClick={onPostAll}>Post All</Button>
          <Button size="small" startIcon={<PictureAsPdfIcon />} onClick={onExportPdf}>PDF</Button>
        </Stack>

        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">JE No. (shared for the day)</Typography>
            <Typography variant="body2" fontWeight={700}>{dailyJeNo || "—"}</Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">Prepared by</Typography>
            <Autocomplete
              size="small"
              options={preparedOptions}
              value={dailyPeople?.prepared?.name || ""}
              onChange={(_, v)=>onChangePeople?.({ prepared:{ name: v || "" } })}
              renderInput={(p)=><TextField {...p} placeholder="Select" />}
              loading={peopleLoading}
              noOptionsText={peopleLoading ? "Loading…" : "No options"}
            />
            <Typography variant="caption" color="text.secondary">
              {dailyPeople?.prepared?.at ? `at ${fmtDT(dailyPeople.prepared.at)}` : "—"}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">Approved by</Typography>
            <Autocomplete
              size="small"
              options={approvedOptions}
              value={dailyPeople?.approved?.name || ""}
              onChange={(_, v)=>onChangePeople?.({ approved:{ name: v || "" } })}
              renderInput={(p)=><TextField {...p} placeholder="Select" />}
              loading={peopleLoading}
              noOptionsText={peopleLoading ? "Loading…" : "No options"}
            />
            <Typography variant="caption" color="text.secondary">
              {dailyPeople?.approved?.at ? `at ${fmtDT(dailyPeople.approved.at)}` : "—"}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">Posted by</Typography>
            <Autocomplete
              size="small"
              options={postedOptions}
              value={dailyPeople?.posted?.name || ""}
              onChange={(_, v)=>onChangePeople?.({ posted:{ name: v || "" } })}
              renderInput={(p)=><TextField {...p} placeholder="Select" />}
              loading={peopleLoading}
              noOptionsText={peopleLoading ? "Loading…" : "No options"}
            />
            <Typography variant="caption" color="text.secondary">
              {dailyPeople?.posted?.at ? `at ${fmtDT(dailyPeople.posted.at)}` : "—"}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <TableContainer>
        <Table size="small" sx={{
          "& th, & td": { borderColor: grid },
          "& thead th": { bgcolor: theadBg, color: theadFg, fontSize: 12 },
          "& td": { fontSize: 12 },
        }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 96 }}>Date</TableCell>
              <TableCell sx={{ width: 160 }}>JE No.</TableCell>
              <TableCell sx={{ width: 160 }}>Reference</TableCell>
              <TableCell sx={{ width: 110 }}>Acct No.</TableCell>
              <TableCell sx={{ width: 260 }}>Account Name</TableCell>
              <TableCell>Description / Line memo</TableCell>
              <TableCell align="right" sx={{ width: 140 }}>Debit</TableCell>
              <TableCell align="right" sx={{ width: 140 }}>Credit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length ? rows.map((r,i)=>(
              <TableRow key={i}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.jeNumber}</TableCell>
                <TableCell>{r.reference}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{r.account}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{r.name || "—"}</TableCell>
                <TableCell><Typography variant="body2">{r.desc || r.entryMemo || "—"}</Typography></TableCell>
                <TableCell align="right">{r.debit ? fmt(r.debit) : ""}</TableCell>
                <TableCell align="right">{r.credit ? fmt(r.credit) : ""}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">No lines</Typography>
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell colSpan={6} align="right">
                <Typography variant="body2" fontWeight={800}>Total</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={800}>
                  {fmt(totals.d)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={800}>
                  {fmt(totals.c)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ p:1.25, borderTop:`1px solid ${grid}`, color:"text.secondary", display:"flex", justifyContent:"space-between" }}>
        <Typography variant="caption">© {new Date().getFullYear()} {companyName}. Confidential.</Typography>
      </Box>
    </Paper>
  );
}

/* === Totals preview ======================================= */
function TotalsPreview({ draft, useAdvanced }) {
  const previewLines = useAdvanced
    ? (draft.lines || []).map((r)=>normalizeRow(r, draft?.currency?.rate || 1, draft?.currency?.code || "DKK", draft.baseCurrency))
    : (() => {
        const amt = Number.isFinite(Number(draft.amount)) ? Number(draft.amount) : 0;
        const debit = draft.debitAccount ? String(draft.debitAccount) : "";
        const credit = draft.creditAccount ? String(draft.creditAccount) : "";
        const lines = amt > 0 && debit && credit ? [
          { account: debit, memo: draft.memo || "", debit: amt, credit: 0 },
          { account: credit, memo: draft.memo || "", debit: 0, credit: amt },
        ] : [];
        return lines.map((r)=>normalizeRow(r, draft?.currency?.rate || 1, draft?.currency?.code || "DKK", draft.baseCurrency));
      })();

  const t = totalsBy(previewLines);
  const diffEntry = t.debit - t.credit;
  const diffBase = t.baseDebit - t.baseCredit;

  return (
    <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center">
      <Typography variant="body2">Total Debit: <strong>{fmtKr(t.debit)}</strong></Typography>
      <Typography variant="body2">Total Credit: <strong>{fmtKr(t.credit)}</strong></Typography>
      <Typography variant="body2">Base Debit/Credit: <strong>{fmtKr(t.baseDebit)}</strong> / <strong>{fmtKr(t.baseCredit)}</strong></Typography>
      <Chip
        size="small"
        color={diffEntry === 0 && diffBase === 0 && t.debit > 0 ? "success" : "warning"}
        label={diffEntry === 0 && diffBase === 0 ? "Balanced (entry & base)" : `Out by ${fmtKr(Math.max(Math.abs(diffEntry), Math.abs(diffBase)))}`}
      />
    </Stack>
  );
}


/* === Inline JE Form (shows shared display JE No) === */
function InlineJEForm({
  draft,
  setDraft,
  useAdvanced,
  setUseAdvanced,
  mergedOptions,
  optionByNumber,
  canSaveDraft,
  onSave,
  typedUserName,
  setTypedUserName,
  dailyJeNoForForm,
  preparedOptions = [],
  peopleLoading = false,
}) {
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const filteredDebitOptions = useMemo(() => {
    return filterByCounterRules({
      startAccountNumber: draft.creditAccount,
      startSide: 'credit',
      mergedOptions,
      optionByNumber,
      showAll: showAllAccounts,
    });
  }, [draft.creditAccount, mergedOptions, optionByNumber, showAllAccounts]);

  const filteredCreditOptions = useMemo(() => {
    return filterByCounterRules({
      startAccountNumber: draft.debitAccount,
      startSide: 'debit',
      mergedOptions,
      optionByNumber,
      showAll: showAllAccounts,
    });
  }, [draft.debitAccount, mergedOptions, optionByNumber, showAllAccounts]);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Journal Entry — Form</Typography>

        {/* Header fields */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="JE No. (shared for selected day)"
              value={dailyJeNoForForm || draft.jeNumber || ""}
              size="small"
              InputProps={{ readOnly: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              type="date"
              label="Date"
              InputLabelProps={{ shrink: true }}
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Reference (auto if empty)"
              value={draft.reference}
              onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
              size="small"
              fullWidth
              placeholder="e.g., REF-20250131-0007"
            />
          </Grid>

          {/* People */}
          <Grid item xs={12} md={4}>
            <Typography variant="caption" color="text.secondary">
              Prepared by
            </Typography>
            <Autocomplete
              size="small"
              options={preparedOptions}
              value={typedUserName || ""}
              onChange={(_, v) => setTypedUserName(v || "")}
              renderInput={(p) => <TextField {...p} placeholder="Select your name" />}
              loading={peopleLoading}
              noOptionsText={peopleLoading ? "Loading…" : "No options"}
            />
            <Typography variant="caption" color="text.secondary">
              Saved on Save as “Prepared by” with timestamp
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="caption" color="text.secondary">
              Approved by
            </Typography>
            <TextField size="small" fullWidth disabled placeholder="Will be set on approval" />
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="caption" color="text.secondary">
              Posted by
            </Typography>
            <TextField size="small" fullWidth disabled placeholder="Will be set on posting" />
          </Grid>
        </Grid>

        {/* Lines */}
        <Divider />
        {useAdvanced ? (
          <LineEditorTable
            rows={draft.lines || []}
            onChange={(rows) => setDraft((d) => ({ ...d, lines: rows }))}
            accountsOptions={mergedOptions}
            optionByNumber={optionByNumber}
            fxMode={draft.fxMode}
            entryCurrency={draft?.currency?.code || "DKK"}
            entryFx={draft?.currency?.rate || 1}
            headerTone="brand"
            headerBgOverride="#05397ed4"
            headerFgOverride="#ffffff"
          />
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Stack spacing={0.5}>
                <Autocomplete
                  size="small"
                  options={filteredDebitOptions}
                  groupBy={(o) => o.groupKey}
                  getOptionLabel={(o) =>
                    o ? `${o.label}${o.description ? " — " + o.description : ""}` : ""
                  }
                  value={
                    draft.debitAccount
                      ? filteredDebitOptions.find((o) => o.number === String(draft.debitAccount)) ||
                        null
                      : null
                  }
                  onChange={(_, v) => setDraft((d) => ({ ...d, debitAccount: v?.number || "" }))}
                  renderInput={(params) => (
                    <TextField {...params} label="Debit account" placeholder="e.g., 5200 • Rent Expense" />
                  )}
                />
                <Typography variant="caption" color="text.secondary">
                  {draft.creditAccount
                    ? `Filtered by rules for a CREDIT to ${resolveType(
                        draft.creditAccount,
                        optionByNumber
                      )}.`
                    : "Pick either side first; the other side will be filtered."}
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Stack spacing={0.5}>
                <Autocomplete
                  size="small"
                  options={filteredCreditOptions}
                  groupBy={(o) => o.groupKey}
                  getOptionLabel={(o) =>
                    o ? `${o.label}${o.description ? " — " + o.description : ""}` : ""
                  }
                  value={
                    draft.creditAccount
                      ? filteredCreditOptions.find((o) => o.number === String(draft.creditAccount)) ||
                        null
                      : null
                  }
                  onChange={(_, v) => setDraft((d) => ({ ...d, creditAccount: v?.number || "" }))}
                  renderInput={(params) => (
                    <TextField {...params} label="Credit account" placeholder="e.g., 1000 • Cash" />
                  )}
                />
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    {draft.debitAccount
                      ? `Filtered by rules for a DEBIT to ${resolveType(
                          draft.debitAccount,
                          optionByNumber
                        )}.`
                      : "Pick either side first; the other side will be filtered."}
                  </Typography>
                  <Link
                    component="button"
                    type="button"
                    onClick={() => setShowAllAccounts((s) => !s)}
                    sx={{ fontSize: 12 }}
                  >
                    {showAllAccounts ? "Hide extras (use rules)" : "Show all accounts"}
                  </Link>
                </Stack>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Amount (kr)"
                type="number"
                size="small"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                sx={{ minWidth: 200 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Header memo (optional)"
                size="small"
                fullWidth
                value={draft.memo || ""}
                onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
              />
            </Grid>
          </Grid>
        )}

        <TotalsPreview draft={draft} useAdvanced={useAdvanced} />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button startIcon={<SaveIcon />} variant="contained" disabled={!canSaveDraft} onClick={onSave}>
            Save
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
/* ============================== MAIN ============================== */
export default function JEDashboard({
  entries = [],
  accounts = [],
  onCreate,
  onUpdate,
  onDelete,
  onApprove,
  onPost,
  onView,
  onExportCSV,
  StandardDocComponent,
}) {
  /* options for accounts UI */
  const suggestionOptions = useMemo(() => {
    const flat = [];
    Object.entries(NAME_SUGGESTIONS).forEach(([, subs]) => {
      Object.entries(subs).forEach(([subtype, arr]) =>
        arr.forEach((label) => {
          const [number, ...rest] = label.split(" ");
          const name = rest.join(" ");
          flat.push({ number: String(number), name, description: NAME_META[label] || subtype });
        })
      );
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
      .map((o) => ({
        number: o.number,
        label: `${o.number} • ${o.name}`,
        description: o.description || "",
        category: o.category,
        subtype: o.subtype,
        groupKey: `${catTitle(o.category)} • ${o.subtype}`,
      }))
      .sort((a, b) => Number(a.number) - Number(b.number));
  }, [suggestionOptions, accounts]);

  const optionByNumber = useMemo(() => new Map(mergedOptions.map((o) => [o.number, o])), [mergedOptions]);

  /* draft state */
  const [useAdvanced, setUseAdvanced] = useState(true);
  const [draft, setDraft] = useState({
    date: todayISO(),
    reference: "",
    memo: "",
    debitAccount: "",
    creditAccount: "",
    amount: "",
    status: "draft",
    offsetAccount: "",
    lines: [],
    jeNumber: "",
        summary: "",
    baseCurrency: "DKK",
    fxMode: "entry",
    autoReverse: false,
    currency: { code: "DKK", rate: 1 },
    headerId: "",
  });
  const [editingId, setEditingId] = useState(null);

  // 👇 NEW: show/hide inline form
  const [inlineOpen, setInlineOpen] = useState(false);

  // persistent user name (Prepared by)
  const [typedUserName, setTypedUserName] = useState(() => {
    try {
      return localStorage.getItem("app.userName") || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("app.userName", typedUserName || "");
    } catch {}
  }, [typedUserName]);

  // --- People dropdowns (fetch from API base) ---
  const API_BASE = import.meta.env?.VITE_API_URL || window.__API_BASE__ || "http://localhost:4000";

  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setPeopleLoading(true);
        const r = await fetch(`${API_BASE}/api/persons`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setPeople(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load people", e);
        setPeople([]);
      } finally {
        setPeopleLoading(false);
      }
    })();
  }, [API_BASE]);

  const peopleAllNames = useMemo(() => people.map((p) => p.name), [people]);
  const preparers = useMemo(
    () => people.filter((p) => p.roles?.includes("prepare")).map((p) => p.name),
    [people]
  );
  const approvers = useMemo(
    () => people.filter((p) => p.roles?.includes("approve")).map((p) => p.name),
    [people]
  );
  const posters = useMemo(
    () => people.filter((p) => p.roles?.includes("post")).map((p) => p.name),
    [people]
  );

  // Journal day + shared display JE No
  const [journalDate, setJournalDate] = useState(todayISO());
  const [dailyJeNo, setDailyJeNoState] = useState(() => getDailyJeNo(todayISO()));
  const [dailyPeople, setDailyPeopleState] = useState(() => getDailyPeople(todayISO()));

  useEffect(() => {
    let display = getDailyJeNo(journalDate);
    if (!display) {
      display = generateJeNumberBase(journalDate); // base (no tail)
      setDailyJeNo(journalDate, display);
    }
    setDailyJeNoState(display);
    setDailyPeopleState(getDailyPeople(journalDate));
  }, [journalDate]);

  const ensureDailyJeDisplay = () => {
    let display = getDailyJeNo(journalDate);
    if (!display) {
      display = generateJeNumberBase(journalDate);
      setDailyJeNo(journalDate, display);
      setDailyJeNoState(display);
    }
    return display;
  };

  // Build simple 2-line from draft when not advanced
  const buildLinesFromDraft = (d) => {
    const amt = normalizeAmount(d.amount);
    const debitAcc = extractAccountNumber(d.debitAccount);
    const creditAcc = extractAccountNumber(d.creditAccount);
    if (!(amt > 0 && debitAcc && creditAcc)) return [];
    const debitMeta = optionByNumber.get(debitAcc) || {};
    const creditMeta = optionByNumber.get(creditAcc) || {};
    const debitDesc =
      (d.memo || "").trim() ||
      debitMeta.description ||
      (debitMeta.label ? debitMeta.label.split(" • ")[1] : "");
    const creditDesc =
      (d.memo || "").trim() ||
      creditMeta.description ||
      (creditMeta.label ? creditMeta.label.split(" • ")[1] : "");
    return [
      { account: String(debitAcc), memo: debitDesc, debit: amt, credit: 0 },
      { account: String(creditAcc), memo: creditDesc, debit: 0, credit: amt },
    ];
  };

  // auto-ref + summary; show the shared display JE no. in the form
  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      const tempLines = buildLinesFromDraft(next);
      if (!next.reference || next.reference.toLowerCase() === "nothing") {
        next.reference = generateRefNumber(next.date);
      }
      next.jeNumber = ensureDailyJeDisplay(); // display only (no tail)
      next.summary = tempLines
        .map(
          (l) =>
            `${l.debit > 0 ? "Debit" : "Credit"} ${l.account}: ${fmtKr(
              Math.max(l.debit, l.credit)
            )}`
        )
        .join("; ");
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.date, draft.debitAccount, draft.creditAccount, draft.amount, optionByNumber, journalDate]);

  const canSaveDraft = useMemo(() => {
    if (!draft.date) return false;
    const rows = useAdvanced
      ? (draft.lines || [])
          .map((r) =>
            normalizeRow(
              r,
              draft?.currency?.rate || 1,
              draft?.currency?.code || "DKK",
              draft.baseCurrency
            )
          )
          .filter((r) => r.account && (r.debit > 0 || r.credit > 0))
      : buildLinesFromDraft(draft).map((r) =>
          normalizeRow(
            r,
            draft?.currency?.rate || 1,
            draft?.currency?.code || "DKK",
            draft.baseCurrency
          )
        );
    if (rows.length < 2) return false;
    const t = totalsBy(rows);
    return (
      t.debit > 0 &&
      Math.abs(t.debit - t.credit) < 0.005 &&
      Math.abs(t.baseDebit - t.baseCredit) < 0.005
    );
  }, [draft, useAdvanced]);

  const openNewInline = () => {
    setEditingId(null);
    setUseAdvanced(true);
    setInlineOpen(true); // 👈 open the form
    setDraft({
      date: journalDate,
      reference: "",
      memo: "",
      debitAccount: "",
      creditAccount: "",
      amount: "",
      status: "draft",
      offsetAccount: "",
      lines: [],
      jeNumber: ensureDailyJeDisplay(),
      summary: "",
      baseCurrency: "DKK",
      fxMode: "entry",
      autoReverse: false,
      currency: { code: "DKK", rate: 1 },
      headerId: draft.headerId || "",
    });
  };

  const openEditInline = (entry) => {
    setEditingId(entry._id || entry.id);
    setInlineOpen(true); // 👈 open the form

    const e = toCanonicalEntry(entry);
    const lines = e.lines || [];
    const looksAdvanced =
      lines.length !== 2 ||
      lines.filter((l) => l.debit > 0).length !== 1 ||
      lines.filter((l) => l.credit > 0).length !== 1;
    setUseAdvanced(looksAdvanced);

    let debitAccount = "",
      creditAccount = "",
      amount = 0;
    if (lines.length >= 2) {
      const dLine = lines.find((l) => l.debit > 0) || {};
      const cLine = lines.find((l) => l.credit > 0) || {};
      debitAccount = String(dLine.account || "");
      creditAccount = String(cLine.account || "");
      amount = dLine.debit || cLine.credit || 0;
    }
    setDraft({
      date: String(e.date).slice(0, 10),
      reference: e.reference || "",
      memo: e.memo || "",
      debitAccount,
      creditAccount,
      amount: amount || "",
      status: e.status || "draft",
      offsetAccount: "",
      lines,
      jeNumber: ensureDailyJeDisplay(),
      summary: e.memo || "",
      baseCurrency: "DKK",
      fxMode: "entry",
      autoReverse: false,
      currency: e.currency || { code: "DKK", rate: 1 },
      headerId: e.headerId || "",
    });
  };

  // CREATE/UPDATE (save draft). Persist unique jeNumber by adding per-day tail.
  const saveDraft = async () => {
    const normalizedLines = (useAdvanced ? draft.lines || [] : buildLinesFromDraft(draft))
      .map((r) =>
        normalizeRow(
          r,
          draft?.currency?.rate || 1,
          draft?.currency?.code || "DKK",
          draft.baseCurrency
        )
      )
      .filter((r) => r.account && (r.debit > 0 || r.credit > 0));

    const display = ensureDailyJeDisplay();
    const uniqueTail = getDailyUniqueTail(journalDate);
    const fullJeNumber = `${display}-${uniqueTail}`;

    const nowIso = new Date().toISOString();
    const payload = {
      date: draft.date,
      reference: draft.reference?.trim() || generateRefNumber(draft.date),
      memo: draft.memo || "",
      status: "draft",
      currency: draft.currency || { code: "DKK", rate: 1 },
      baseCurrency: draft.baseCurrency || "DKK",
      fxMode: draft.fxMode || "entry",
      autoReverse: !!draft.autoReverse,
      participants: {
        preparedBy: { name: (typedUserName || "").trim(), at: nowIso },
        approvedBy: { name: "", at: null },
        postedBy: { name: "", at: null },
      },
      preparedAt: nowIso,
      lines: normalizedLines,
      jeNumber: fullJeNumber,
      preparedByName: (typedUserName || "").trim(),
      preparedBy: (typedUserName || "").trim(),
      summary: draft.summary || "",
    };

    try {
      if (editingId) {
        await onUpdate?.(editingId, payload);
      } else {
        await onCreate?.(payload);
      }
      // 👇 hide the form after successful save
      setInlineOpen(false);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save JE", err);
      alert(err?.message || "Failed to save Journal Entry");
    }
  };

  /* ---------- Single JE view dialog ---------- */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);
  const viewDocRef = useRef(null);

  const handleExportPdfView = () => {
    if (!viewEntry) return;
    const canonical = toCanonicalEntry(viewEntry);
    const html = renderSingleJEHTML(canonical, optionByNumber);
    const name = (canonical?.jeNumber || "JournalEntry")
      .replace(/-\d{2}$/, "")
      .replace(/[^\w.-]+/g, "_");
    printHtml(name, html);
  };

  // --- Daily Standard Journal PDF export ---
  const dayExportRef = useRef(null);
  const handleExportPdfDaily = async () => {
    const html = renderDailyJournalHTML({
      date: journalDate,
      entries: standardEntries.map(toCanonicalEntry),
      optionByNumber,
      dailyJeNo,
      dailyPeople,
    });

    // Opens a new window with A4 CSS and triggers print
    printHtml(`Daily_Standard_Journal_${journalDate}`, html);
  };

  /* ---------- Daily Standard Journal view dialog ---------- */
  const [dayOpen, setDayOpen] = useState(false);

  /* ---------- Search & Filter ---------- */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const norm = (v) => (v ?? "").toString().toLowerCase();

  const filteredEntries = useMemo(() => {
    const q = norm(search);
    return (entries || []).filter((e) => {
      if (statusFilter !== "all" && (e?.status || "draft") !== statusFilter) return false;
      if (!q) return true;
      const dateStr = String(e?.date || "").slice(0, 10);
      const s = [
        dateStr,
        e?.jeNumber,
        e?.reference,
        e?.memo,
        e?.status,
        e?.participants?.preparedBy?.name,
        e?.participants?.approvedBy?.name,
        e?.participants?.postedBy?.name,
        ...(e?.lines || []).map((l) => `${l?.account || ""} ${l?.memo || ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return s.includes(q);
    });
  }, [entries, search, statusFilter]);

  // Only entries for the selected Journal day
  const standardEntries = useMemo(
    () => filteredEntries.filter((e) => String(e?.date || "").slice(0, 10) === journalDate),
    [filteredEntries, journalDate]
  );

  // People change handler (names only; timestamps set on Approve/Post)
  const handleChangeDailyPeople = (patch) => {
    const next = {
      prepared: { ...(dailyPeople?.prepared || {}), ...(patch.prepared || {}) },
      approved: { ...(dailyPeople?.approved || {}), ...(patch.approved || {}) },
      posted: { ...(dailyPeople?.posted || {}), ...(patch.posted || {}) },
    };
    setDailyPeopleState(next);
    setDailyPeople(journalDate, next);
  };

  // --- POPUP dialogs for Approve/Post name selection ---
  const [approveDlgOpen, setApproveDlgOpen] = useState(false);
  const [postDlgOpen, setPostDlgOpen] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [posterName, setPosterName] = useState("");

  const openApproveDialog = () => {
    setApproverName(
      dailyPeople?.approved?.name || dailyPeople?.prepared?.name || typedUserName || ""
    );
    setApproveDlgOpen(true);
  };

  const openPostDialog = () => {
    setPosterName(
      dailyPeople?.posted?.name || dailyPeople?.approved?.name || typedUserName || ""
    );
    setPostDlgOpen(true);
  };

  const handleApproveConfirm = async () => {
    const name = (approverName || "").trim();
    if (!name) {
      alert("Please choose an approver.");
      return;
    }
    const at = new Date().toISOString();
    try {
      for (const e of standardEntries) {
        if ((e?.status || "draft") === "draft") {
          await onApprove?.(e._id || e.id, {
            approvedByName: name,
            approvedBy: name,
            approvedAt: at,
          });
        }
      }
      const next = { ...dailyPeople, approved: { name, at } };
      setDailyPeopleState(next);
      setDailyPeople(journalDate, next);
      setApproveDlgOpen(false);
    } catch (err) {
      alert(err?.message || "Failed to approve all");
    }
  };

  const handlePostConfirm = async () => {
    const name = (posterName || "").trim();
    if (!name) {
      alert("Please choose a poster.");
      return;
    }
    const at = new Date().toISOString();
    try {
      for (const e of standardEntries) {
        if ((e?.status || "draft") === "approved") {
          await onPost?.(e._id || e.id, {
            postedByName: name,
            postedBy: name,
            postedAt: at,
          });
        }
      }
      const next = { ...dailyPeople, posted: { name, at } };
      setDailyPeopleState(next);
      setDailyPeople(journalDate, next);
      setPostDlgOpen(false);
    } catch (err) {
      alert(err?.message || "Failed to post all");
    }
  };

  return (
    <Stack spacing={2}>
      {/* Top actions / filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNewInline}>
          New entry
        </Button>
        <TextField
          type="date"
          size="small"
          label="Journal day"
          InputLabelProps={{ shrink: true }}
          value={journalDate}
          onChange={(e) => setJournalDate(e.target.value)}
          sx={{ minWidth: 170 }}
        />
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          size="small"
          color="primary"
          exclusive
          value={statusFilter}
          onChange={(_, v) => v && setStatusFilter(v)}
        >
          <ToggleButton value="all">ALL</ToggleButton>
          <ToggleButton value="draft">DRAFT</ToggleButton>
          <ToggleButton value="approved">APPROVED</ToggleButton>
          <ToggleButton value="posted">POSTED</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Inline create/edit form */}
      {inlineOpen && (
        <>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              size="small"
              onClick={() => {
                setInlineOpen(false);
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
          </Stack>
          <InlineJEForm
            draft={draft}
            setDraft={setDraft}
            useAdvanced={useAdvanced}
            setUseAdvanced={setUseAdvanced}
            mergedOptions={mergedOptions}
            optionByNumber={optionByNumber}
            canSaveDraft={canSaveDraft}
            onSave={saveDraft}
            typedUserName={typedUserName}
            setTypedUserName={setTypedUserName}
            dailyJeNoForForm={dailyJeNo}
            preparedOptions={preparers.length ? preparers : peopleAllNames}
            peopleLoading={peopleLoading}
          />
        </>
      )}

    {/* Daily Standard Journal (inline preview + actions) */}
    {standardEntries.length > 0 && (
      <StandardJournalDoc
        headerTitle="Daily Standard Journal"
        headerDate={journalDate}
        entries={standardEntries.map(toCanonicalEntry)}
        optionByNumber={optionByNumber}
        companyName="ACTA"
        dailyJeNo={dailyJeNo}
        dailyPeople={dailyPeople}
        onChangePeople={handleChangeDailyPeople}
        onOpen={() => setDayOpen(true)}
        onApproveAll={openApproveDialog}
        onPostAll={openPostDialog}
        onExportPdf={handleExportPdfDaily}
        preparedOptions={preparers.length ? preparers : peopleAllNames}
        approvedOptions={approvers.length ? approvers : peopleAllNames}
        postedOptions={posters.length ? posters : peopleAllNames}
        peopleLoading={peopleLoading}
      />
    )}

    {/* ▼▼ Single journal entries for the selected day (now under the daily doc) ▼▼ */}
    <Typography variant="h6">
      Single Journal Entries — {journalDate}
    </Typography>
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>JE No. (stored)</TableCell>
            <TableCell>Reference</TableCell>
            <TableCell>Memo</TableCell>
            <TableCell align="right">Lines</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell align="right">View / Edit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(standardEntries.length ? standardEntries : []).map((entry) => {
            const id = entry._id || entry.id;
            return (
              <TableRow key={id}>
                <TableCell>{String(entry?.date || "").slice(0, 10)}</TableCell>
                <TableCell>{entry?.jeNumber?.replace(/-\d{2}$/, "") || "—"}</TableCell>
                <TableCell>{entry?.reference || "—"}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {entry?.memo || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">{entry?.lines?.length || 0}</TableCell>
                <TableCell align="center">
                  {entry?.status === "posted" ? (
                    <Chip
                      icon={<CheckCircleIcon color="success" />}
                      label="Posted"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  ) : entry?.status === "approved" ? (
                    <Chip
                      icon={<DoneAllIcon color="info" />}
                      label="Approved"
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  ) : (
                    <Chip label="Draft" size="small" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="View">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setViewEntry(toCanonicalEntry(entry));
                          setViewOpen(true);
                        }}
                      >
                        <DescriptionIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditInline(entry)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
          {standardEntries.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                <Typography variant="body2" color="text.secondary">
                  No entries for this day.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>

      {/* Single JE View dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Journal Entry</DialogTitle>
        <DialogContent dividers>
          {viewEntry?.memo && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Memo:</strong> {viewEntry.memo}
            </Typography>
          )}
          <div ref={viewDocRef}>
            <JournalEntryDoc
              entry={toCanonicalEntry(viewEntry || {})}
              optionByNumber={optionByNumber}
              companyName="ACTA"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<PictureAsPdfIcon />} onClick={handleExportPdfView}>
            Export PDF
          </Button>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Daily Standard Journal — full dialog */}
      <Dialog open={dayOpen} onClose={() => setDayOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Daily Standard Journal — {journalDate}</DialogTitle>
        <DialogContent dividers>
          <Box ref={dayExportRef}>
            <StandardJournalDoc
              headerTitle="Daily Standard Journal"
              headerDate={journalDate}
              entries={standardEntries.map(toCanonicalEntry)}
              optionByNumber={optionByNumber}
              companyName="ACTA"
              dailyJeNo={dailyJeNo}
              dailyPeople={dailyPeople}
              onChangePeople={handleChangeDailyPeople}
              onOpen={() => {}}
              onApproveAll={openApproveDialog}
              onPostAll={openPostDialog}
              onExportPdf={handleExportPdfDaily}
              preparedOptions={preparers.length ? preparers : peopleAllNames}
              approvedOptions={approvers.length ? approvers : peopleAllNames}
              postedOptions={posters.length ? posters : peopleAllNames}
              peopleLoading={peopleLoading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={openApproveDialog}>
            Approve All
          </Button>
          <Button variant="contained" onClick={openPostDialog}>
            Post All
          </Button>
          <Button startIcon={<PictureAsPdfIcon />} onClick={handleExportPdfDaily}>
            Export PDF
          </Button>
          <Button onClick={() => setDayOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Approve All — picker */}
      <Dialog open={approveDlgOpen} onClose={() => setApproveDlgOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Select approver</DialogTitle>
        <DialogContent dividers>
          <Autocomplete
            size="small"
            options={approvers.length ? approvers : peopleAllNames}
            value={approverName}
            onChange={(_, v) => setApproverName(v || "")}
            renderInput={(p) => <TextField {...p} placeholder="Choose a name" label="Approved by" />}
            loading={peopleLoading}
            noOptionsText={peopleLoading ? "Loading…" : "No options"}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            This will set “Approved by” and timestamp on all DRAFT entries for {journalDate}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDlgOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleApproveConfirm}>Confirm</Button>
        </DialogActions>
      </Dialog>

      {/* Post All — picker */}
      <Dialog open={postDlgOpen} onClose={() => setPostDlgOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Select poster</DialogTitle>
        <DialogContent dividers>
          <Autocomplete
            size="small"
            options={posters.length ? posters : peopleAllNames}
            value={posterName}
            onChange={(_, v) => setPosterName(v || "")}
            renderInput={(p) => <TextField {...p} placeholder="Choose a name" label="Posted by" />}
            loading={peopleLoading}
            noOptionsText={peopleLoading ? "Loading…" : "No options"}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            This will set “Posted by” and timestamp on all APPROVED entries for {journalDate}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPostDlgOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePostConfirm}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

