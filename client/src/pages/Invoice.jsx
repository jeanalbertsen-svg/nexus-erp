// client/src/pages/Invoice.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Stack, Typography, Button, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, Autocomplete, Grid, Chip, Divider, InputAdornment,
  IconButton, Box, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Collapse
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import VisibilityIcon from "@mui/icons-material/Visibility";

/* ---------- Brand palette (blue theme) ---------- */
const BRAND = {
  name: "Acta Venture Partners Aps",
  address: "Ravnsborg Tværgade 1, 1. 2200 København N• CVR 44427508",
  logoUrl: "/ACTA_logo.png",
  primary: "#0E4C92",
  primaryLight: "#315d93ff",
  primaryBorder: "#324870ff",
  primaryDark: "#0E4C92",
};

/* ---------- Currency helpers ---------- */
const fmtKr = (n) => (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const yyyymmdd = (d) => (d || "").slice(0, 10).replaceAll("-", "");

/* ---------- Sales-only Daily report HTML ---------- */
function renderSalesDailyReportHTML(date, sales) {
  const sum = (arr) => arr.reduce((s, d) => s + (+d.total || 0), 0);
  const salesRows = sales.length
    ? sales.map((s) => `<tr><td>${s.docNo}</td><td>${s.party || "-"}</td><td class="num">${fmtKr(s.total)}</td></tr>`).join("")
    : `<tr><td colspan="3" class="small muted">None.</td></tr>`;

  return `
  <div class="hdr">
    <div class="brand">
      <img src="${BRAND.logoUrl}" alt="" height="36"/>
      <div>
        <div class="name">${BRAND.name}</div>
        <div class="small muted">${BRAND.address}</div>
      </div>
    </div>
    <div class="right"><div class="date">${date}</div></div>
  </div>

  <h3>Sales Invoices</h3>
  <table class="report">
    <colgroup><col/><col/><col/></colgroup>
    <thead>
      <tr><th>Doc No.</th><th>Customer</th><th>Total</th></tr>
    </thead>
    <tbody>${salesRows}</tbody>
    <tfoot>
      <tr><td colspan="2">Sales total</td><td class="num">${fmtKr(sum(sales))}</td></tr>
    </tfoot>
  </table>
  `;
}

/* ---------- Print (PDF) ---------- */
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
  @media (prefers-color-scheme: dark){
    :root{ --bg:#ffffff; --fg:#000000; --muted:#56657a; --line:${BRAND.primaryBorder}; --brand:${BRAND.primary}; --th-bg:${BRAND.primaryLight}; --th-fg:#ffffff; }
  }
  *{ box-sizing:border-box; }
  html,body{ background:var(--bg); color:var(--fg); }
  body{ font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; margin:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 10mm 12mm; }
  .container{ width:100%; max-width:100%; margin:0; }
  h1,h2,h3{ margin:12px 0 6px; }
  .muted{ color:var(--muted); }
  .right{ text-align:right; }
  .num{ text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
  .hdr{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
  .brand{ display:flex; align-items:center; gap:10px; }
  .brand .name{ font-weight:700; color:var(--brand); }
  .date{ font-weight:600; }
  table.report{ width:100%; border-collapse:collapse; margin-top:6px; table-layout:fixed; }
  table.report colgroup col:nth-child(1){ width:46%; }
  table.report colgroup col:nth-child(2){ width:34%; }
  table.report colgroup col:nth-child(3){ width:20%; }
  table.report th, table.report td{ border-bottom:0.6pt solid var(--line); padding:8px; vertical-align:top; }
  table.report thead th{ background:var(--th-bg); color:var(--th-fg); text-align:left; }
  table.report thead th:nth-child(3), table.report tbody td:nth-child(3), table.report tfoot td:nth-child(3){ text-align:right; }
  table.report tfoot td{ border-top:0.9pt solid var(--line); font-weight:600; }
  table.report tfoot td:first-child, table.report tfoot td:nth-child(2){ text-align:right; }
  table.report.inv{ width:100%; border-collapse:collapse; table-layout:fixed; }
  table.report.inv colgroup col:nth-child(1){ width:38%; }
  table.report.inv colgroup col:nth-child(2){ width:10%; }
  table.report.inv colgroup col:nth-child(3){ width:18%; }
  table.report.inv colgroup col:nth-child(4){ width:12%; }
  table.report.inv colgroup col:nth-child(5){ width:10%; }
  table.report.inv colgroup col:nth-child(6){ width:12%; }
  table.report.inv th, table.report.inv td{ border-bottom:0.6pt solid var(--line); padding:8px; vertical-align:top; }
  table.report.inv thead th:nth-child(1), table.report.inv tbody td:nth-child(1){ text-align:left; }
  table.report.inv thead th:nth-child(n+2), table.report.inv tbody td:nth-child(n+2){ text-align:right; }
  table.report.inv thead th{ background:var(--th-bg); color:var(--th-fg); }
  table.report.inv tbody td, table.report.inv tfoot td{ color:#000000; }
  table.report.inv tfoot td{ border-top:0.9pt solid var(--line); font-weight:600; }
  .rounded{ border:none !important; border-radius:0 !important; padding:0; }
  @media print { body{ margin:0; } }
</style>
</head>
<body>
<div class="container rounded">
${html}
</div>
<script>
  window.addEventListener('load', () => { try { window.print(); } catch(e){} });
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

/* -------------------------------------------------------
   Minimal COA (kept GL-aligned)
------------------------------------------------------- */
const NAME_SUGGESTIONS = {
  ASSET: {
    "Cash & Bank": ["1000 Cash","1010 Petty Cash","1100 Bank"],
    "Accounts Receivable": ["1200 Accounts Receivable"],
    "Tax (Input/VAT receivable)": ["1300 Prepaid Expenses"],
  },
  LIABILITY: {
    "Accounts Payable": ["2000 Accounts Payable"],
    "Taxes Payable (Output/VAT)": ["2300 Taxes Payable"],
  },
  REVENUE: { "Product/Service": ["4000 Sales Revenue","4100 Service Revenue"] },
  EXPENSE: { "COGS & Ops": ["5000 Cost of Goods Sold (COGS)","5200 Rent Expense","6400 IT / Software Expense"] },
  EQUITY: { "Paid-in Capital": ["3000 Share Capital"] },
};
const NAME_META = {
  "1000 Cash": "Cash on hand",
  "1010 Petty Cash": "Small cash on premises",
  "1100 Bank": "Operating bank",
  "1200 Accounts Receivable": "Customer balances",
  "1300 Prepaid Expenses": "Prepaid/Recoverable (Input VAT)",
  "2000 Accounts Payable": "Vendor balances",
  "2300 Taxes Payable": "Output VAT / Taxes payable",
  "4000 Sales Revenue": "Sales of goods",
  "4100 Service Revenue": "Service income",
  "5000 Cost of Goods Sold (COGS)": "Direct costs of goods sold",
  "5200 Rent Expense": "Premises rent",
  "6400 IT / Software Expense": "Software subscriptions & IT",
};
const CAT_TITLES = { ASSET:"Assets", LIABILITY:"Liabilities", EQUITY:"Equity", REVENUE:"Revenue", EXPENSE:"Expenses" };
const catTitle = (c) => CAT_TITLES[c] || c || "";

/* -------------------------------------------------------
   Description templates (SALES ONLY)
------------------------------------------------------- */
const DESCRIPTION_TEMPLATES = {
  SALES: [
    { label: "Product sale", account: "4000", taxPct: 25 },
    { label: "Consulting hours", account: "4100", unitPrice: 1000, taxPct: 25 },
    { label: "Service fee", account: "4100", taxPct: 25 },
    { label: "Subscription revenue", account: "4100", taxPct: 25 },
    { label: "Training session", account: "4100", taxPct: 25 },
  ],
};

const extractAccountNumber = (raw) => {
  if (!raw) return "";
  const m = String(raw).match(/^\s*(\d{3,})/);
  return m?.[1] || String(raw);
};
const inferCategoryFromNumber = (num) => {
  const s = String(num || ""); const f = s[0];
  if (f === "1") return "ASSET";
  if (f === "2") return "LIABILITY";
  if (f === "3") return "EQUITY";
  if (f === "4") return "REVENUE";
  return "EXPENSE";
};

/* ------- Local storage–backed sequences ------- */
const seqKey = (scope, day) => `accta.seq.${scope}.${day}`;
const nextSeq = (scope, day) => {
  try {
    const k = seqKey(scope, day);
    const n = Number(localStorage.getItem(k) || "0") + 1;
    localStorage.setItem(k, String(n));
    return n;
  } catch { return Math.floor(Math.random()*9000)+1000; }
};
const ensureDisplayJeNo = (prefix, day) => {
  try {
    const k = `accta.je.display.${prefix}.${day}`;
    let v = localStorage.getItem(k);
    if (!v) {
      const first = String(nextSeq(`je.${prefix}`, day)).padStart(4,"0");
      v = `${prefix}-${day}-${first}`;
      localStorage.setItem(k, v);
    }
    return v;
  } catch { return `${prefix}-${day}-0001`; }
};

const buildMergedOptions = (accounts = []) => {
  const idx = new Map();
  Object.entries(NAME_SUGGESTIONS).forEach(([cat, subs]) => {
    Object.entries(subs).forEach(([subtype, labels]) =>
      labels.forEach((label) => {
        const [number, ...rest] = label.split(" ");
        const name = rest.join(" ");
        if (!idx.has(number)) {
          idx.set(number, {
            number,
            name,
            description: NAME_META[label] || subtype,
            category: cat,
            subtype,
          });
        }
      })
    );
  });
  for (const a of accounts) {
    const num = String(a.number);
    const cur = idx.get(num);
    idx.set(num, {
      number: num,
      name: a.name || cur?.name || "",
      description: a.description || cur?.description || "",
      category: cur?.category || inferCategoryFromNumber(num),
      subtype: cur?.subtype || "Other",
    });
  }
  return Array.from(idx.values())
    .map((o) => ({
      ...o,
      label: `${o.number} • ${o.name}`,
      groupKey: `${catTitle(o.category)} • ${o.subtype}`,
    }))
    .sort((a,b) => Number(a.number) - Number(b.number));
};

/* -------------------------------------------------------
   Shared Line Table (Sales uses REVENUE)
------------------------------------------------------- */
function InvoiceLines({ rows, onChange, mergedOptions, accountType = "REVENUE", descriptionOptions = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const headBg  = alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12);
  const headBor = alpha(theme.palette.primary.main, isDark ? 0.50 : 0.30);

  const update = (i, patch) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([
      ...rows,
      { description: "", account: "", qty: 1, unitPrice: 0, discountPct: 0, taxPct: 25 },
    ]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));

  const filtered = useMemo(
    () => mergedOptions.filter((o) => o.category === accountType),
    [mergedOptions, accountType]
  );

  const asTemplate = (val) => {
    if (!val) return null;
    if (typeof val === "string") return { label: val };
    return val;
  };

  return (
    <Stack spacing={1}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ "& th": { backgroundColor: headBg, borderColor: headBor } }}>
            <TableCell width="36%"><strong>Description</strong></TableCell>
            <TableCell width="30%"><strong>Account</strong></TableCell>
            <TableCell align="right" width="8%"><strong>Qty</strong></TableCell>
            <TableCell align="right" width="12%"><strong>Unit price</strong></TableCell>
            <TableCell align="right" width="7%"><strong>Disc %</strong></TableCell>
            <TableCell align="right" width="7%"><strong>Tax %</strong></TableCell>
            <TableCell align="right" width="12%"><strong>Line total</strong></TableCell>
            <TableCell align="center" width="6%"></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, idx) => {
            const qty = +r.qty || 0;
            const price = +r.unitPrice || 0;
            const disc = (+r.discountPct || 0) / 100;
            const net = Math.max(0, qty * price * (1 - disc));

            return (
              <TableRow key={idx}>
                <TableCell>
                  <Autocomplete
                    size="small"
                    freeSolo
                    options={descriptionOptions}
                    getOptionLabel={(opt) => typeof opt === "string" ? opt : (opt?.label || "")}
                    value={r.description || null}
                    onChange={(_, val) => {
                      const tpl = asTemplate(val);
                      const patch = { description: tpl?.label || "" };
                      if (!r.account && tpl?.account) patch.account = tpl.account;
                      if (!r.unitPrice && tpl?.unitPrice != null) patch.unitPrice = tpl.unitPrice;
                      if (r.taxPct == null && tpl?.taxPct != null) patch.taxPct = tpl.taxPct;
                      update(idx, patch);
                    }}
                    onInputChange={(_, val, reason) => {
                      if (reason === "input") update(idx, { description: val });
                    }}
                    renderInput={(p) => <TextField {...p} placeholder="Select or type a description…" />}
                  />
                </TableCell>

                <TableCell>
                  <Autocomplete
                    size="small"
                    options={filtered}
                    groupBy={(o)=>o.groupKey}
                    getOptionLabel={(o)=>o ? `${o.label}${o.description ? " — " + o.description : ""}` : ""}
                    value={r.account ? filtered.find(o=>o.number===String(r.account)) || null : null}
                    onChange={(_,v)=>update(idx,{account:v?.number||""})}
                    renderInput={(p)=><TextField {...p} placeholder="4000 • Sales Revenue" />}
                  />
                </TableCell>

                <TableCell align="right">
                  <TextField size="small" type="number" value={r.qty} onChange={(e) => update(idx, { qty: e.target.value })} inputProps={{ min: 0, step: "0.01", style: { textAlign: "right" } }} />
                </TableCell>

                <TableCell align="right">
                  <TextField size="small" type="number" value={r.unitPrice} onChange={(e) => update(idx, { unitPrice: e.target.value })} inputProps={{ min: 0, step: "0.01", style: { textAlign: "right" } }} />
                </TableCell>

                <TableCell align="right">
                  <TextField size="small" type="number" value={r.discountPct} onChange={(e) => update(idx, { discountPct: e.target.value })} inputProps={{ min: 0, max: 100, step: "0.1", style: { textAlign: "right" } }} />
                </TableCell>

                <TableCell align="right">
                  <TextField size="small" type="number" value={r.taxPct} onChange={(e) => update(idx, { taxPct: e.target.value })} inputProps={{ min: 0, max: 100, step: "0.1", style: { textAlign: "right" } }} />
                </TableCell>

                <TableCell align="right" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {fmtKr(net)}
                </TableCell>

                <TableCell align="center">
                  <IconButton size="small" color="primary" onClick={() => remove(idx)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length===0 && (
            <TableRow>
              <TableCell colSpan={8} align="center">
                <Typography variant="body2" color="text.secondary">No lines yet — add an item.</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Button startIcon={<AddIcon/>} color="primary" variant="outlined" onClick={add}>Add line</Button>
    </Stack>
  );
}

/* -------------------------------------------------------
   GL builder — SALES ONLY
------------------------------------------------------- */
const glFromSalesInvoice = ({ inv, arAccount="1200", taxLiabilityAccount="2300" }) => {
  const rows=[]; const date=inv.date; const day=yyyymmdd(date);
  const ref = inv.referenceNo || `INV-${day}-${String(inv.autoSeq).padStart(4,"0")}`;
  const jeDisplay = inv.jeDisplay || ensureDisplayJeNo("AR", day);

  let subtotal=0, taxTotal=0;
  for (const l of inv.lines||[]) {
    const qty=+l.qty||0, price=+l.unitPrice||0, disc=(+l.discountPct||0)/100, t=(+l.taxPct||0)/100;
    const net=Math.max(0, qty*price*(1-disc)); const tax=net*t;
    if (net>0 && l.account){
      rows.push({ date, account:String(l.account), memo:l.description||inv.memo||"", debit:0, credit:+net, reference:ref, jeNumber:jeDisplay, source:"AR", locked:true });
      subtotal+=net; taxTotal+=tax;
    }
  }
  if (taxTotal>0){
    rows.push({ date, account:String(taxLiabilityAccount), memo:"Sales tax / VAT", debit:0, credit:+taxTotal, reference:ref, jeNumber:jeDisplay, source:"AR", locked:true });
  }
  const gross=subtotal+taxTotal;
  if (gross>0){
    rows.push({ date, account:String(arAccount), memo:`AR — ${inv.customer||""}`, debit:+gross, credit:0, reference:ref, jeNumber:jeDisplay, source:"AR", locked:true });
  }
  return rows;
};

/* ---------- Renderer: Sales invoice layout ---------- */
function renderInvoiceHTML(doc) {
  const fmt = (n) => fmtKr(+n || 0);

  let sub=0, tax=0;
  const rows = (doc.lines||[]).map((l) => {
    const qty = +l.qty || 0, price = +l.unitPrice || 0, disc = (+l.discountPct||0)/100, t=(+l.taxPct||0)/100;
    const net = Math.max(0, qty*price*(1-disc)); sub += net; tax += net*t;
    return `
      <tr>
        <td>${(l.description||"").replace(/</g,"&lt;")}</td>
        <td class="num">${qty.toFixed(2)}</td>
        <td class="num">${fmt(price)}</td>
        <td class="num">${((+l.discountPct)||0).toFixed(1)}</td>
        <td class="num">${((+l.taxPct)||0).toFixed(1)}</td>
        <td class="num">${fmt(net)}</td>
      </tr>
    `;
  }).join("");

  const total = sub + tax;

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
        <h2>Invoice</h2>
        <div class="small muted">Document No.</div>
        <div><strong>${doc.docNo || "-"}</strong></div>
      </div>
    </div>

    <div class="grid no-break" style="margin-bottom:10px">
      <div>
        <div class="small muted">Date</div>
        <div>${String(doc.date||"").slice(0,10)}</div>
      </div>
      <div>
        <div class="small muted">JE No.</div>
        <div>${doc.jeDisplay || "-"}</div>
      </div>
      <div>
        <div class="small muted">Reference</div>
        <div>${doc.reference || "-"}</div>
      </div>
      <div>
        <div class="small muted">Customer</div>
        <div>${doc.party || "-"}</div>
      </div>
    </div>

    <table class="report inv">
      <colgroup><col/><col/><col/><col/><col/><col/></colgroup>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit price</th>
          <th>Disc %</th>
          <th>Tax %</th>
          <th>Line total</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6" class="small muted">No lines.</td></tr>`}</tbody>
      <tfoot class="totals-block">
        <tr><td colspan="5" class="right">Subtotal</td><td class="num">${fmt(sub)}</td></tr>
        <tr><td colspan="5" class="right">Sales tax / VAT</td><td class="num">${fmt(tax)}</td></tr>
        <tr><td colspan="5" class="right">Total</td><td class="num">${fmt(total)}</td></tr>
      </tfoot>
    </table>

    <p class="small muted no-break" style="margin-top:10px">
      Notes: ${(doc.headerMemo||"").replace(/</g,"&lt;") || "—"}
    </p>
  `;
}

/* -------------------------------------------------------
   Sales Invoice Form
------------------------------------------------------- */
function SalesInvoiceForm({ mergedOptions, onAddGlMany, onAddMany, onRecordCreated, initialDoc, onSaveEdit }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const headBor = alpha(theme.palette.primary.main, isDark ? 0.50 : 0.30);
  const paperBor = headBor;

  const [inv, setInv] = useState(() => initialDoc ? {
    date: initialDoc.date, invoiceNo: initialDoc.docNo, referenceNo: initialDoc.reference,
    jeDisplay: initialDoc.jeDisplay, customer: initialDoc.party, memo: initialDoc.headerMemo,
    lines: initialDoc.lines||[], arAccount: "1200", taxAccount: "2300", autoSeq: 0, customerRef: ""
  } : {
    date: todayISO(), invoiceNo: "", referenceNo: "", jeDisplay: "",
    customer: "", customerRef: "", memo: "", currency: "DKK",
    lines: [], arAccount: "1200", taxAccount: "2300", autoSeq: 0,
  });

  const isEditing = !!initialDoc;

  useEffect(() => {
    if (isEditing) return;
    const day = yyyymmdd(inv.date);
    const seq = nextSeq("INV", day);
    setInv(v => ({
      ...v,
      autoSeq: seq,
      invoiceNo: v.invoiceNo || `INV-${day}-${String(seq).padStart(4,"0")}`,
      referenceNo: v.referenceNo || `INV-${day}-${String(seq).padStart(4,"0")}`,
      jeDisplay: ensureDisplayJeNo("AR", day),
    }));
  }, [inv.date, isEditing]);

  const totals = useMemo(() => {
    let sub=0, tax=0;
    for (const l of inv.lines) {
      const qty=+l.qty||0, price=+l.unitPrice||0, disc=(+l.discountPct||0)/100, t=(+l.taxPct||0)/100;
      const net = Math.max(0, qty*price*(1-disc)); sub += net; tax += net*t;
    }
    return { sub, tax, gross: sub+tax };
  }, [inv.lines]);

  const canSave = inv.date && inv.customer && inv.lines.length>0 && totals.gross>0;

  const doPersistGL = async (glRows) => {
    const addMany =
      onAddGlMany || onAddMany || (async (rows) => {
        const key = "gl.rows";
        const prev = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify([...prev, ...rows]));
        window.dispatchEvent(new CustomEvent("gl:rows-added", { detail: rows }));
      });
    await addMany(glRows);
  };

  const handlePost = async () => {
    const glRows = glFromSalesInvoice({
      inv,
      arAccount: extractAccountNumber(inv.arAccount || "1200"),
      taxLiabilityAccount: extractAccountNumber(inv.taxAccount || "2300"),
    });
    if (!glRows.length) return alert("Nothing to post.");
    await doPersistGL(glRows);

    const doc = {
      id: initialDoc?.id,
      type: "Sales",
      date: inv.date,
      docNo: inv.invoiceNo,
      reference: inv.referenceNo,
      jeDisplay: inv.jeDisplay,
      party: inv.customer,
      total: totals.gross,
      headerMemo: inv.memo,
      lines: inv.lines,
    };
    if (isEditing) {
      onSaveEdit?.(doc);
      alert("Sales invoice updated.");
    } else {
      onRecordCreated?.(doc);
      alert("Sales invoice posted to GL.");
      setInv(v => ({ ...v, lines: [], customer:"", customerRef:"", memo:"" }));
    }
  };

  return (
    <Paper variant="outlined" sx={{ p:2, borderRadius:2, borderColor: paperBor }}>
      <Typography variant="h6" sx={{ mb:1, color: theme.palette.primary.main }}>{isEditing ? "Edit Sales Invoice" : "Sales Invoice"}</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}><TextField label="Invoice No." size="small" fullWidth value={inv.invoiceNo} InputProps={{readOnly:true}}/></Grid>
        <Grid item xs={12} md={3}><TextField label="Date" type="date" size="small" fullWidth InputLabelProps={{shrink:true}} value={inv.date} onChange={(e)=>setInv(v=>({...v, date:e.target.value}))}/></Grid>
        <Grid item xs={12} md={6}><TextField label="Customer" size="small" fullWidth value={inv.customer} onChange={(e)=>setInv(v=>({...v, customer:e.target.value}))}/></Grid>

        <Grid item xs={12} md={4}><TextField label="Reference No." size="small" fullWidth value={inv.referenceNo} InputProps={{readOnly:true}}/></Grid>
        <Grid item xs={12} md={4}><TextField label="JE No. (display)" size="small" fullWidth value={inv.jeDisplay} InputProps={{readOnly:true}}/></Grid>
        <Grid item xs={12} md={4}><TextField label="Customer Ref" size="small" fullWidth value={inv.customerRef} onChange={(e)=>setInv(v=>({...v, customerRef:e.target.value}))}/></Grid>

        <Grid item xs={12} md={6}>
          <Autocomplete
            size="small"
            options={mergedOptions.filter(o=>o.number==="1200" || o.category==="ASSET")}
            getOptionLabel={(o)=>o ? `${o.label}` : ""}
            value={mergedOptions.find(o=>o.number===String(extractAccountNumber(inv.arAccount))) || null}
            onChange={(_,v)=>setInv(s=>({ ...s, arAccount: v?.number || "1200" }))}
            renderInput={(p)=><TextField {...p} label="AR Account" />}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Autocomplete
            size="small"
            options={mergedOptions.filter(o=>o.number==="2300" || o.category==="LIABILITY")}
            getOptionLabel={(o)=>o ? `${o.label}` : ""}
            value={mergedOptions.find(o=>o.number===String(extractAccountNumber(inv.taxAccount))) || null}
            onChange={(_,v)=>setInv(s=>({ ...s, taxAccount: v?.number || "2300" }))}
            renderInput={(p)=><TextField {...p} label="Tax (output VAT) account" />}
          />
        </Grid>
        <Grid item xs={12}><TextField label="Header memo (optional)" size="small" fullWidth value={inv.memo} onChange={(e)=>setInv(v=>({...v, memo:e.target.value}))}/></Grid>
      </Grid>

      <Divider sx={{ my:2 }}/>
      <InvoiceLines
        rows={inv.lines}
        onChange={(rows)=>setInv(v=>({...v, lines:rows}))}
        mergedOptions={mergedOptions}
        accountType="REVENUE"
        descriptionOptions={DESCRIPTION_TEMPLATES.SALES}
      />

      <Stack direction="row" justifyContent="flex-end" spacing={3} sx={{ mt: 2 }}>
        <Typography variant="body2">Subtotal: <strong>{fmtKr(totals.sub)}</strong></Typography>
        <Typography variant="body2">Tax: <strong>{fmtKr(totals.tax)}</strong></Typography>
        <Chip color="primary" label={`Total ${fmtKr(totals.gross)}`} />
      </Stack>

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
        <Button variant="contained" color="primary" disabled={!canSave} onClick={handlePost}>{isEditing ? "Save Changes" : "Post to GL"}</Button>
      </Stack>
    </Paper>
  );
}

/* -------------------------------------------------------
   SALES DAILY REPORT component
------------------------------------------------------- */
function DailyReport({ docs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const paperBor = alpha(theme.palette.primary.main, isDark ? 0.50 : 0.30);

  const [date, setDate] = useState(todayISO());
  const dayDocs = useMemo(() => docs.filter(d => String(d.date).slice(0,10) === date), [docs, date]);
  const sales = dayDocs.filter(d=>d.type==="Sales");
  const html = renderSalesDailyReportHTML(date, sales);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: paperBor }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ color: theme.palette.primary.main, display: "flex", alignItems: "center", gap: 1 }}>
          Daily Sales Report
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField type="date" size="small" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
        <Button startIcon={<PictureAsPdfIcon />} color="primary" variant="outlined" onClick={() => printHtml(`Daily Sales Report ${date}`, html)}>Save as PDF</Button>
      </Stack>
      <Divider sx={{ mb: 0.5 }} />
      <div
        dangerouslySetInnerHTML={{
          __html:
            `<style>
              :root{ --brand:${BRAND.primary}; --th-bg:${BRAND.primaryLight}; --th-fg:#0b2b55; --line:${BRAND.primaryBorder}; --muted:#56657a; --fg:#0b1650; --bg:#ffffff; }
              .hdr{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
              .brand{ display:flex; gap:10px; align-items:center; }
              .brand .name{ font-weight:700; color:var(--brand); }
              table.report{ width:100%; border-collapse:collapse; table-layout:fixed; }
              table.report colgroup col:nth-child(1){ width:46%; }
              table.report colgroup col:nth-child(2){ width:34%; }
              table.report colgroup col:nth-child(3){ width:20%; }
              th,td{ border-bottom:1px solid var(--line); padding:8px; vertical-align:top; }
              thead th{ background:var(--th-bg); color:var(--th-fg); text-align:left; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              tr, td, th { break-inside: avoid; page-break-inside: avoid; }
              table { page-break-inside: auto; }
              thead th:nth-child(3), tbody td:nth-child(3), tfoot td:nth-child(3){ text-align:right; }
              tfoot td{ border-top:2px solid var(--line); font-weight:600; }
              tfoot td:first-child, tfoot td:nth-child(2){ text-align:right; }
              .right{text-align:right}
              .num{ text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
              .small{ font-size:11px; color:var(--muted); }
            </style>` + html
        }}
      />
    </Paper>
  );
}

/* -------------------------------------------------------
   Helpers: persisted docs (sales)
------------------------------------------------------- */
function usePersistedDocs(key) {
  const [docs, setDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  const persistDocs = (next) => {
    setDocs(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };
  const addDoc = (doc) => persistDocs([{ id: crypto.randomUUID?.() || String(Date.now()), ...doc }, ...docs]);
  const updateDoc = (id, patch) => persistDocs(docs.map(d => d.id === id ? { ...d, ...patch } : d));
  const deleteDoc = (id) => persistDocs(docs.filter(d=>d.id !== id));
  return { docs, persistDocs, addDoc, updateDoc, deleteDoc };
}

/* -------------------------------------------------------
   SALES PAGE (only)
------------------------------------------------------- */
function SalesInvoicesPage({ accounts = [], onAddGlMany, onAddMany }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const headBg  = alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12);
  const headBor = alpha(theme.palette.primary.main, isDark ? 0.50 : 0.30);
  const paperBor = headBor;
  const mergedOptions = useMemo(() => buildMergedOptions(accounts), [accounts]);

  const { docs, addDoc, updateDoc, deleteDoc } = usePersistedDocs("accta.docs.sales");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = (search||"").toLowerCase();
    if (!q) return docs;
    return docs.filter(d => [d.type, d.docNo, d.reference, d.jeDisplay, d.party, d.date, d.headerMemo].join(" ").toLowerCase().includes(q));
  }, [docs, search]);

  const shouldShowForm = showForm || !!edit;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowForm(s=>!s)}>
          {shouldShowForm ? "Hide Sales Invoice Form" : "New Sales Invoice"}
        </Button>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Search sales invoices…" value={search} onChange={(e)=>setSearch(e.target.value)} InputProps={{ startAdornment:(<InputAdornment position="start"><SearchIcon color="primary"/></InputAdornment>) }} />
      </Stack>

      <Collapse in={shouldShowForm} unmountOnExit>
        {edit ? (
          <SalesInvoiceForm
            mergedOptions={mergedOptions}
            onAddGlMany={onAddGlMany}
            onAddMany={onAddMany}
            initialDoc={edit.doc}
            onSaveEdit={(doc)=>{ updateDoc(edit.doc.id, doc); setEdit(null); }}
          />
        ) : (
          <SalesInvoiceForm
            mergedOptions={mergedOptions}
            onAddGlMany={onAddGlMany}
            onAddMany={onAddMany}
            onRecordCreated={(doc)=>{ addDoc(doc); setShowForm(false); }}
          />
        )}
      </Collapse>

      {/* Sales daily report */}
      <DailyReport docs={docs} />

      {/* Posted SALES documents table */}
      <Paper variant="outlined" sx={{ borderColor: paperBor }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { backgroundColor: headBg, borderColor: headBor } }}>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Doc No.</strong></TableCell>
              <TableCell><strong>Reference</strong></TableCell>
              <TableCell><strong>JE No. (display)</strong></TableCell>
              <TableCell><strong>Customer</strong></TableCell>
              <TableCell align="right"><strong>Total</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.type}</TableCell>
                <TableCell>{String(d.date).slice(0, 10)}</TableCell>
                <TableCell>{d.docNo}</TableCell>
                <TableCell>{d.reference}</TableCell>
                <TableCell>{d.jeDisplay}</TableCell>
                <TableCell>{d.party || "—"}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtKr(d.total)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="View"><IconButton size="small" color="primary" onClick={() => setView(d)}><VisibilityIcon /></IconButton></Tooltip>
                  <Tooltip title="Save as PDF"><IconButton size="small" color="primary" onClick={() => printHtml(`${d.type} ${d.docNo}`, renderInvoiceHTML(d))}><PictureAsPdfIcon /></IconButton></Tooltip>
                  <Tooltip title="Edit"><IconButton size="small" color="primary" onClick={() => { setEdit({ mode: d.type, doc: d }); setShowForm(true); }}><EditIcon /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" color="primary" onClick={() => { if (confirm(`Delete ${d.type} ${d.docNo}? This does not reverse GL postings.`)) deleteDoc(d.id); }}><DeleteOutlineIcon /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">No sales documents yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Viewer */}
      <Dialog open={!!view} onClose={() => setView(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: theme.palette.primary.main }}>{view?.type} — {view?.docNo}</DialogTitle>
        <DialogContent dividers>
          <div
            dangerouslySetInnerHTML={{
              __html:
                `<style>
                  :root{ --brand:${BRAND.primary}; --th-bg:${BRAND.primaryLight}; --th-fg:#0b2b55; --line:${BRAND.primaryBorder}; --muted:#56657a; --fg:#0b1650; --bg:#ffffff; }
                  .preview-surface{ padding:0; border-radius:8px; }
                  table.report.inv{ width:100%; border-collapse:collapse; table-layout:fixed; }
                  table.report.inv colgroup col:nth-child(1){ width:38%; }
                  table.report.inv colgroup col:nth-child(2){ width:10%; }
                  table.report.inv colgroup col:nth-child(3){ width:18%; }
                  table.report.inv colgroup col:nth-child(4){ width:12%; }
                  table.report.inv colgroup col:nth-child(5){ width:10%; }
                  table.report.inv colgroup col:nth-child(6){ width:12%; }
                  table.report.inv th, table.report.inv td{ border-bottom:1px solid var(--line); padding:8px; vertical-align:top; }
                  table.report.inv thead th{ background:var(--th-bg); color:var(--th-fg); text-align:left; }
                  thead { display: table-header-group; }
                  tfoot { display: table-footer-group; }
                  tr, td, th { break-inside: avoid; page-break-inside: avoid; }
                  table { page-break-inside: auto; }
                  table.report.inv thead th:nth-child(1), table.report.inv tbody td:nth-child(1){ text-align:left; }
                  table.report.inv thead th:nth-child(n+2), table.report.inv tbody td:nth-child(n+2){ text-align:right; }
                  .right{text-align:right} .num{ text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; } .small{font-size:11px;color:var(--muted)}
                </style>
                <div class="preview-surface">` + renderInvoiceHTML(view || {}) + `</div>`
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => printHtml(`${view?.type} ${view?.docNo}`, renderInvoiceHTML(view))} startIcon={<PictureAsPdfIcon />} variant="outlined" color="primary">Save as PDF</Button>
          <Button onClick={() => setView(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

/* -------------------------------------------------------
   MAIN EXPORT — sales only
------------------------------------------------------- */
export default function InvoicesApp({ accounts = [], onAddGlMany, onAddMany }) {
  return <SalesInvoicesPage accounts={accounts} onAddGlMany={onAddGlMany} onAddMany={onAddMany} />;
}

/* Optional named export for router usage */
export { SalesInvoicesPage };
