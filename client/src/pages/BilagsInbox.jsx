import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Paper, Stack, Typography, TextField, Button, Chip, Divider, Table, TableHead, TableRow,
  TableCell, TableBody, Box, Alert, Tooltip, Checkbox, FormControlLabel, IconButton,
  Accordion, AccordionSummary, AccordionDetails, Select, MenuItem, InputLabel, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, Link
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RouteIcon from "@mui/icons-material/AltRoute";
import CheckIcon from "@mui/icons-material/CheckCircle";
import SendIcon from "@mui/icons-material/Send";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import MailIcon from "@mui/icons-material/MarkEmailRead";
import InsightsIcon from "@mui/icons-material/Insights";
import TuneIcon from "@mui/icons-material/Tune";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import mermaid from "mermaid/dist/mermaid.esm.mjs";

import {
  API_BASE,
  bilags,
  createJournal,
  approveJournal,
  postJournal,
  createStockMove,
  postStockMove,
} from "../api.js";

/* -------------------------------------------------------------------------- */
/*                                BRAND CONFIG                                */
/* -------------------------------------------------------------------------- */
/** Ensure ACTA_logo.png is in client/public/ so it serves from /ACTA_logo.png */
const BRAND = {
  name: "Acta Venture Partners Aps",
  address: "Ravnsborg Tværgade 1, 1. 2200 København N • CVR 44427508",
  logoUrl: "/ACTA_logo.png",
  primary: "#0E4C92",
  primaryLight: "#315d93ff",
  primaryBorder: "#324870ff",
};

/* -------------------------------------------------------------------------- */
/*                           PRINT/PDF TEMPLATE (PRO)                         */
/* -------------------------------------------------------------------------- */
/** HTML window-print helper (opens a tab & calls print) */
function printHtml(title, html) {
  const docHtml = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${String(title).replace(/</g,"&lt;")}</title>
<style>
  :root{
    --bg:#ffffff; --fg:#0b1650;
    --muted:#56657a; --line:${BRAND.primaryBorder};
    --brand:${BRAND.primary}; --th-bg:${BRAND.primaryLight}; --th-fg:#ffffff;
  }
  *{ box-sizing:border-box; }
  html,body{ background:var(--bg); color:var(--fg); }
  body{
    font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    margin:0; -webkit-print-color-adjust: exact; print-color-adjust: exact;
    text-rendering: optimizeLegibility;
  }
  @page { size: A4; margin: 10mm 12mm; }
  .page{ width:186mm; margin:0 auto; background:#fff; }
  h1,h2,h3{ margin:12px 0 6px; }
  .small{ font-size:11px; color:var(--muted); }
  .muted{ color:var(--muted); }
  .right{ text-align:right; }

  .num{
    text-align:right;
    font-variant-numeric: tabular-nums;
    white-space:nowrap;
    word-break: keep-all;
    overflow-wrap: normal;
  }

  .hdr{
    display:grid; grid-template-columns: 1fr 1fr;
    column-gap:16px; row-gap:6px; align-items:start; margin-bottom:12px;
  }
  .brand{ display:flex; align-items:center; gap:10px; }
  .brand .name{ font-weight:700; color:var(--brand); font-size:14px; }
  .invoice-title{ margin:0 0 8px 0; letter-spacing:0.5px; font-size:18px; }

  .meta-block{ margin-top:1px; }
  .meta{
    display:grid; grid-template-columns:max-content 1fr;
    column-gap:10px; row-gap:1px; align-items:baseline;
  }
  .meta .k{ font-weight:600; color:var(--muted); }
  .meta .v{ text-align:right; }

  .supplier-card{
    display:grid; grid-template-columns:max-content 1fr;
    column-gap:10px; row-gap:4px; padding:10px 12px;
    border:0.6pt solid var(--line); border-radius:6px; background:#fff; margin-top:6px;
  }
  .supplier-card .k{ font-weight:600; color:var(--muted); }
  .no-break{ break-inside: avoid; page-break-inside: avoid; }

  table{ width:100%; border-collapse:collapse; }
  table.report th, table.report td{
    border-bottom:0.6pt solid var(--line); padding:10px 8px; vertical-align:top;
  }
  table.report thead th{ background:var(--th-bg); color:var(--th-fg); text-align:left; font-weight:700; }
  th, td{ word-break:normal; overflow-wrap:normal; }
  td.desc{ overflow-wrap:anywhere; word-break:break-word; }

  table.inv thead th:nth-child(1), table.inv tbody td:nth-child(1){ text-align:left; }
  table.inv thead th:nth-child(n+2), table.inv tbody td:nth-child(n+2){ text-align:right; }

  table.report tfoot td{ border-bottom:none; }
  table.report tfoot tr td{ padding-top:8px; }
  table.report tfoot tr.grand-total td{
    border-top:0.9pt solid var(--line); font-weight:700; padding-top:12px;
  }
</style>
</head>
<body>
  <div class="page">
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
      finally { setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 600); }
    };
    iframe.src = url;
    document.body.appendChild(iframe);
  } catch (e) { console.error("Print failed", e); }
}

/* ------------------------- external script loaders ------------------------- */
const _scriptLoadCache = new Map();
async function loadScriptOnce(src, timeoutMs = 15000) {
  if (_scriptLoadCache.has(src)) return _scriptLoadCache.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const t = setTimeout(() => reject(new Error(`Timed out loading: ${src}`)), timeoutMs);
    s.async = true; s.src = src; s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error(`Failed to load: ${src}`)); };
    document.head.appendChild(s);
  });
  _scriptLoadCache.set(src, p);
  return p;
}
async function ensureHtml2Pdf() {
  if (window.html2pdf) return;
  await loadScriptOnce("https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js");
}

/* ---------------------- Compose the professional inner HTML ---------------------- */
function renderManualHTML({
  mSubject, mSupplierName, mSupplierEmail, mSupplierPhone, mSupplierAddress, mSupplierVAT,
  mInvoiceNo, mOrderNo, mDate, mCurrency, mTaxMode, mTaxRate, mLines, totals
}) {
  const esc = (s) => String(s || "").replace(/</g, "&lt;");
  const rows = (mLines || []).map((l) => {
    const qty = Number(l.qty || 0);
    const unit = Number(l.unitPrice || 0);
    const tPct = l.taxRate === "" ? Number(mTaxRate || 0) : Number(l.taxRate || 0);
    const rate = tPct / 100;
    const net = mTaxMode === "inclusive" ? qty * unit / (1 + rate) : qty * unit;
    const tax = net * rate;
    const lineTotal = net + tax;
    return `
      <tr>
        <td class="desc">${esc(l.desc || "-")}</td>
        <td class="num">${esc(l.category || "-")}</td>
        <td class="num">${qty.toFixed(2)}</td>
        <td class="num">${esc(l.uom || "ea")}</td>
        <td class="num">${unit.toFixed(2)}</td>
        <td class="num">${net.toFixed(2)}</td>
        <td class="num">${tax.toFixed(2)}</td>
        <td class="num">${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join("") || `<tr><td colspan="8" class="small muted">No lines.</td></tr>`;

  return `
  <div class="hdr">
    <div class="brand">
      <img src="${new URL(BRAND.logoUrl, location.origin)}" alt="Logo" height="36" crossorigin="anonymous"/>
      <div>
        <div class="name">${BRAND.name}</div>
        <div class="small muted">${BRAND.address}</div>
      </div>
    </div>

    <div class="meta-block right">
      <h1 class="invoice-title">${esc(mSubject || "Manual Document")}</h1>
      <div class="meta">
        <div class="k">Invoice No</div><div class="v num">${esc(mInvoiceNo || "-")}</div>
        <div class="k">Order No</div><div class="v num">${esc(mOrderNo || "-")}</div>
        <div class="k">Date</div><div class="v num">${esc(mDate)}</div>
        <div class="k">Currency</div><div class="v">${esc(mCurrency || "DKK")}</div>
        <div class="k">Tax Mode</div><div class="v">${esc(mTaxMode || "-")}</div>
        <div class="k">Tax Rate</div><div class="v num">${esc(mTaxRate != null ? `${mTaxRate}%` : "-")}</div>
      </div>
    </div>
  </div>

  <div class="supplier-card no-break">
    <div><span class="k">Supplier: </span><span class="v">${esc(mSupplierName || "--")}</span></div>
    <div><span class="k">Email: </span><span class="v">${esc(mSupplierEmail || "--")}</span></div>
    <div><span class="k">Phone: </span><span class="v">${esc(mSupplierPhone || "--")}</span></div>
    <div><span class="k">Address: </span><span class="v">${esc(mSupplierAddress || "--")}</span></div>
    <div><span class="k">VAT: </span><span class="v">${esc(mSupplierVAT || "--")}</span></div>
  </div>

  <table class="report inv" style="margin-top:16px;">
    <colgroup>
      <col style="width:36%"><col style="width:10%"><col style="width:8%"><col style="width:8%">
      <col style="width:12%"><col style="width:10%"><col style="width:8%"><col style="width:12%">
    </colgroup>
    <thead>
      <tr><th>Description</th><th>Cat.</th><th>Qty</th><th>UoM</th><th>Unit</th><th>Net</th><th>Tax</th><th>Line Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="7" class="right muted">Subtotal</td><td class="num">${Number(totals.subtotal||0).toFixed(2)} ${esc(mCurrency||"DKK")}</td></tr>
      <tr><td colspan="7" class="right muted">Tax</td><td class="num">${Number(totals.tax||0).toFixed(2)} ${esc(mCurrency||"DKK")}</td></tr>
      <tr class="grand-total"><td colspan="7" class="right">Total</td><td class="num">${Number(totals.totalInc||0).toFixed(2)} ${esc(mCurrency||"DKK")}</td></tr>
    </tfoot>
  </table>`;
}

function buildPrintableHtml(title, innerHtml) {
  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${String(title).replace(/</g,"&lt;")}</title>
</head>
<body>
${printStylesAndShell(innerHtml)}
<script>window.addEventListener('load',()=>{try{window.print();}catch(e){}});</script>
</body>
</html>`.trim();
}

function printStylesAndShell(innerHtml){
  return `
<style>
  :root{
    --bg:#ffffff; --fg:#0b1650;
    --muted:#56657a; --line:${BRAND.primaryBorder};
    --brand:${BRAND.primary}; --th-bg:${BRAND.primaryLight}; --th-fg:#ffffff;
  }
  *{ box-sizing:border-box; }
  html,body{ background:var(--bg); color:var(--fg); }
  body{ font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; margin:0;
        -webkit-print-color-adjust: exact; print-color-adjust: exact; text-rendering: optimizeLegibility; }
  @page { size: A4; margin: 10mm 12mm; }
  .page{ width:186mm; margin:0 auto; background:#fff; }
  h1,h2,h3{ margin:12px 0 6px; }
  .small{ font-size:11px; color:var(--muted); }
  .muted{ color:var(--muted); }
  .right{ text-align:right; }
  .num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; word-break:keep-all; overflow-wrap:normal; }
  .hdr{ display:grid; grid-template-columns:1fr 1fr; column-gap:16px; row-gap:6px; align-items:start; margin-bottom:12px; }
  .brand{ display:flex; align-items:center; gap:10px; }
  .brand .name{ font-weight:700; color:var(--brand); font-size:14px; }
  .invoice-title{ margin:0 0 8px 0; letter-spacing:0.5px; font-size:18px; }
  .meta-block{ margin-top:2px; }
  .meta{ display:grid; grid-template-columns:max-content 1fr; column-gap:10px; row-gap:4px; align-items:baseline; }
  .meta .k{ font-weight:600; color:var(--muted); } .meta .v{ text-align:right; }
  .supplier-card{ display:grid; grid-template-columns:max-content 1fr; column-gap:10px; row-gap:4px; padding:10px 12px; border:0.6pt solid var(--line); border-radius:6px; background:#fff; margin-top:6px; }
  .supplier-card .k{ font-weight:600; color:var(--muted); }
  .no-break{ break-inside:avoid; page-break-inside:avoid; }
  table{ width:100%; border-collapse:collapse; }
  table.report th, table.report td{ border-bottom:0.6pt solid var(--line); padding:10px 8px; vertical-align:top; }
  table.report thead th{ background:var(--th-bg); color:var(--th-fg); text-align:left; font-weight:700; }
  th, td{ word-break:normal; overflow-wrap:normal; }
  td.desc{ overflow-wrap:anywhere; word-break:break-word; }
  table.inv thead th:nth-child(1), table.inv tbody td:nth-child(1){ text-align:left; }
  table.inv thead th:nth-child(n+2), table.inv tbody td:nth-child(n+2){ text-align:right; }
  table.report tfoot td{ border-bottom:none; }
  table.report tfoot tr td{ padding-top:8px; }
  table.report tfoot tr.grand-total td{ border-top:0.9pt solid var(--line); font-weight:700; padding-top:12px; }
</style>
<div class="page">${innerHtml}</div>`.trim();
}

/* ------------------------- Raster PDF (legacy) ------------------------- */
async function renderProfessionalPdfBlob(innerHtml, filenameHint = "document") {
  await ensureHtml2Pdf();

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = "793.7px";
  holder.style.background = "#fff";
  holder.innerHTML = printStylesAndShell(innerHtml);
  document.body.appendChild(holder);

  try {
    if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }
    await Promise.all(
      [...holder.querySelectorAll("img")].map(img =>
        img.complete ? Promise.resolve() :
        new Promise(res => { img.onload = img.onerror = res; })
      )
    );

    const src = holder.querySelector(".page") || holder;
    const worker = window.html2pdf()
      .set({
        filename: `${filenameHint}.pdf`,
        margin: [10, 12, 10, 12],
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 3,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: 793.7,
          letterRendering: false,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ".no-break" },
      })
      .from(src);

    return await worker.outputPdf("blob");
  } finally {
    holder.remove();
  }
}

/* ------------------------- jsPDF (vector) loader ------------------------- */
async function ensureJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF && window.jspdfAutoTable) return;
  await loadScriptOnce("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  await loadScriptOnce("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js");
  if (!window.jspdf || !window.jspdf.jsPDF) {
    if (window.jsPDF) window.jspdf = { jsPDF: window.jsPDF };
  }
}

/* ------------------------- Render Vector PDF (jsPDF) ------------------------- */
async function renderVectorPdfBlob(doc, filenameHint = "document") {
  await ensureJsPdf();
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = { l: 12, r: 12, t: 10, b: 10 };
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin.l - margin.r;
  let y = margin.t;

  const brandColor = "#0E4C92";
  const muted = "#56657a";

  // Logo (optional)
  if (BRAND.logoUrl) {
    try {
      const absUrl = new URL(BRAND.logoUrl, location.origin).toString();
      const img = await fetch(absUrl, { mode: "cors" }).then(r => r.blob());
      const reader = new FileReader();
      const p = new Promise(res => { reader.onload = () => res(reader.result); });
      reader.readAsDataURL(img);
      const dataUrl = await p;
      pdf.addImage(dataUrl, "PNG", margin.l, y, 40, 12, undefined, "FAST");
    } catch {}
  }

  // Brand text
  pdf.setTextColor(brandColor);
  pdf.setFont(undefined, "bold"); pdf.setFontSize(12);
  const brandNameX = margin.l + 42;
  pdf.text(BRAND.name || "", brandNameX, y + 5);
  pdf.setFont(undefined, "normal"); pdf.setFontSize(9); pdf.setTextColor(muted);
  pdf.text(BRAND.address || "", brandNameX, y + 10);

  // Title + meta
  const rightX = pageWidth - margin.r;
  pdf.setTextColor(0); pdf.setFont(undefined, "bold"); pdf.setFontSize(15);
  pdf.text(doc.mSubject || "Manual Document", rightX, y + 5, { align: "right" });

  pdf.setFontSize(9); pdf.setFont(undefined, "normal"); pdf.setTextColor(muted);
  const metaLines = [
    ["Invoice No", doc.mInvoiceNo || "-"],
    ["Order No", doc.mOrderNo || "-"],
    ["Date", doc.mDate || "-"],
    ["Currency", doc.mCurrency || "DKK"],
    ["Tax Mode", doc.mTaxMode || "-"],
    ["Tax Rate", (doc.mTaxRate != null ? `${doc.mTaxRate}%` : "-")],
  ];
  metaLines.forEach((kv, i) => {
    const [k, v] = kv;
    const yy = y + 10 + (i + 1) * 4.7;
    pdf.text(k, rightX - 55, yy, { align: "left" });
    pdf.setFont(undefined, "bold"); pdf.setTextColor(0);
    pdf.text(String(v), rightX, yy, { align: "right" });
    pdf.setFont(undefined, "normal"); pdf.setTextColor(muted);
  });

  y += 20;

  // Supplier box
  const boxY = y + 2;
  pdf.setDrawColor("#324870"); pdf.setLineWidth(0.2);
  pdf.roundedRect(margin.l, boxY, contentWidth, 22, 2, 2);
  pdf.setTextColor(muted); pdf.setFontSize(9); pdf.setFont(undefined, "bold");
  const col1X = margin.l + 3, col2X = margin.l + 25;
  [
    ["Supplier:", doc.mSupplierName || "--"],
    ["Email:", doc.mSupplierEmail || "--"],
    ["Phone:", doc.mSupplierPhone || "--"],
    ["Address:", doc.mSupplierAddress || "--"],
    ["VAT:", doc.mSupplierVAT || "--"],
  ].forEach((kv, i) => {
    pdf.text(kv[0], col1X, boxY + 5 + i * 4.3);
    pdf.setFont(undefined, "normal"); pdf.setTextColor(0);
    pdf.text(String(kv[1]), col2X, boxY + 5 + i * 4.3);
    pdf.setFont(undefined, "bold"); pdf.setTextColor(muted);
  });
  y = boxY + 22 + 4;

  // Table rows
  const defRate = Number.isFinite(Number(doc.mTaxRate)) ? Number(doc.mTaxRate) : 25;
  const bodyRows = (doc.mLines || []).map((l) => {
    const qty = Number(l.qty || 0);
    const unit = Number(l.unitPrice || 0);
    const ratePct = l.taxRate === "" ? defRate : Number(l.taxRate || 0);
    const rate = ratePct / 100;
    const net = doc.mTaxMode === "inclusive" ? (qty * unit) / (1 + rate) : qty * unit;
    const tax = net * rate;
    const lineTotal = net + tax;
    return [
      String(l.desc || "-"),
      String(l.category || "-"),
          qty.toFixed(2),
      String(l.uom || "ea"),
      unit.toFixed(2),
      net.toFixed(2),
      tax.toFixed(2),
      lineTotal.toFixed(2),
    ];
  });

  // Build the table (vector text, no rasterization)
  const head = [["Description", "Cat.", "Qty", "UoM", "Unit", "Net", "Tax", "Line Total"]];
  pdf.autoTable({
    head,
    body: bodyRows.length ? bodyRows : [["—", "—", "0.00", "ea", "0.00", "0.00", "0.00", "0.00"]],
    startY: y,
    styles: { fontSize: 9, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: [49, 93, 147], textColor: 255 },
    columnStyles: {
      0: { halign: "left" },   // Description
      1: { halign: "right" },  // Cat.
      2: { halign: "right" },  // Qty
      3: { halign: "right" },  // UoM
      4: { halign: "right" },  // Unit
      5: { halign: "right" },  // Net
      6: { halign: "right" },  // Tax
      7: { halign: "right" },  // Line Total
    },
    // approximate the same widths as the HTML colgroup (36%,10%,8%,8%,12%,10%,8%,12%)
    didParseCell: (data) => {
      const widths = [0.36, 0.10, 0.08, 0.08, 0.12, 0.10, 0.08, 0.12].map(
        (p) => p * contentWidth
      );
      if (data.section !== "head" && data.section !== "body") return;
      const idx = data.column.index;
      data.cell.styles.cellWidth = widths[idx];
    },
  });

  // Totals
  const afterTableY = pdf.autoTable.previous ? pdf.autoTable.previous.finalY : y;
  const totals = doc.totals || { subtotal: 0, tax: 0, totalInc: 0 };
  const cur = doc.mCurrency || "DKK";

  const totalsRightX = margin.l + contentWidth;
  const rowGap = 5;

  pdf.setFontSize(9);
  pdf.setTextColor(muted);
  pdf.text("Subtotal", totalsRightX - 55, afterTableY + rowGap, { align: "right" });
  pdf.setTextColor(0);
  pdf.setFont(undefined, "bold");
  pdf.text(`${Number(totals.subtotal || 0).toFixed(2)} ${cur}`, totalsRightX, afterTableY + rowGap, { align: "right" });

  pdf.setFont(undefined, "normal");
  pdf.setTextColor(muted);
  pdf.text("Tax", totalsRightX - 55, afterTableY + rowGap * 2, { align: "right" });
  pdf.setTextColor(0);
  pdf.setFont(undefined, "bold");
  pdf.text(`${Number(totals.tax || 0).toFixed(2)} ${cur}`, totalsRightX, afterTableY + rowGap * 2, { align: "right" });

  pdf.setFont(undefined, "normal");
  pdf.setTextColor(muted);
  pdf.text("Total", totalsRightX - 55, afterTableY + rowGap * 3 + 1.5, { align: "right" });
  pdf.setDrawColor("#324870");
  pdf.setLineWidth(0.3);
  pdf.line(totalsRightX - 55, afterTableY + rowGap * 3 - 1.5, totalsRightX, afterTableY + rowGap * 3 - 1.5);
  pdf.setTextColor(0);
  pdf.setFont(undefined, "bold");
  pdf.text(`${Number(totals.totalInc || 0).toFixed(2)} ${cur}`, totalsRightX, afterTableY + rowGap * 3 + 1.5, { align: "right" });

  // Done
  return pdf.output("blob");
}
/* -------------------------------------------------------------------------- */
/*                               SHARED UTILITIES                             */
/* -------------------------------------------------------------------------- */
const fmtMoney = (v, c = "DKK") =>
  Number(v || 0).toLocaleString("da-DK", { style: "currency", currency: c });
const sumDebit = (lines) => (lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
const sumCredit = (lines) => (lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);

const generateInvoiceNo = () => {
  const d = new Date(); const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0"); const rnd = Math.floor(Math.random() * 900 + 100);
  return `INV-${y}${m}-${rnd}`;
};
const generateOrderNo = () => {
  const d = new Date(); const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0"); const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${y}${m}-${rnd}`;
};
const generateSku = (desc = "") => {
  const base = String(desc || "ITEM").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "ITEM";
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${rnd}`;
};
const defaultUomForCategory = (cat) => (cat === "inventory" ? "pcs" : "ea");
const isoDateOnly = (d) => {
  if (!d) return new Date().toISOString().slice(0, 10);
  try {
    const dt = new Date(d);
    if (Number.isNaN(+dt)) return new Date().toISOString().slice(0, 10);
    return dt.toISOString().slice(0, 10);
  } catch { return new Date().toISOString().slice(0, 10); }
};

/* ---------- Preview journal ---------- */
function buildPreviewJournal(doc) {
  const tot = Number(doc?.extracted?.totals?.totalInc ?? doc?.extracted?.total ?? 0) || 0;
  const memo = doc?.source?.subject || "BackOffice Proposal";
  const looksInventory =
    (doc?.extracted?.lines || []).some((l) => l.sku || l.category === "inventory") ||
    /module|converter|cable|monitor|ssd|ram|keyboard|microphone|sensor|pcb|psu/i.test(memo);
  if (!tot) return null;
  return {
    lines: looksInventory
      ? [
          { account: "1000", memo: "Payment", debit: 0, credit: tot },
          { account: "1400", memo: "Inventory receipt (preview)", debit: tot, credit: 0 },
        ]
      : [
          { account: "1000", memo: "Payment", debit: 0, credit: tot },
          { account: "5500", memo: "Expense (preview)", debit: tot, credit: 0 },
        ],
    note: looksInventory ? "Inventory preview" : "Expense preview",
  };
}

/* ---------- Mermaid ---------- */
function Mermaid({ chart }) {
  const [svgMarkup, setSvgMarkup] = useState("");
  useEffect(() => {
    let disposed = false;
    if (!chart) { setSvgMarkup(""); return () => {}; }
    const safePre = `<pre style="white-space:pre-wrap">${String(chart).replace(/</g, "&lt;")}</pre>`;
    try {
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose", fontFamily: "inherit" });
      Promise.resolve(mermaid.render(`diag_${Date.now()}`, chart))
        .then(({ svg }) => { if (!disposed) setSvgMarkup(svg); })
        .catch(() => { if (!disposed) setSvgMarkup(safePre); });
    } catch { if (!disposed) setSvgMarkup(safePre); }
    return () => { disposed = true; };
  }, [chart]);
  return <div dangerouslySetInnerHTML={{ __html: svgMarkup }} />;
}

/* =========================== Component =========================== */
export default function BilagsInbox() {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Email options
  const [emailSubject, setEmailSubject] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailIncludeSeen, setEmailIncludeSeen] = useState(true);
  const [emailLimit, setEmailLimit] = useState(50);
  const [ocrVendor, setOcrVendor] = useState("auto");
  const [ocrLang, setOcrLang] = useState("eng,dan");
  const [fetchMeta, setFetchMeta] = useState(null);
  const [busy, setBusy] = useState({ email: false, test: false, ocr: false, llm: false, manual: false });
  const [signoffOpen, setSignoffOpen] = useState(false);
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);

  // Manual entry form state
  const [mExpanded, setMExpanded] = useState(false);
  const [mSubject, setMSubject] = useState("Manual");
  const [mSupplierName, setMSupplierName] = useState("");
  const [mSupplierEmail, setMSupplierEmail] = useState("");
  const [mSupplierPhone, setMSupplierPhone] = useState("");
  const [mSupplierAddress, setMSupplierAddress] = useState("");
  const [mSupplierVAT, setMSupplierVAT] = useState("");
  const [mInvoiceNo, setMInvoiceNo] = useState("");
  const [mOrderNo, setMOrderNo] = useState("");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mCurrency, setMCurrency] = useState("DKK");
  const [mTaxMode, setMTaxMode] = useState("exclusive");
  const [mTaxRate, setMTaxRate] = useState(25);
  const [mLines, setMLines] = useState([{ sku: "", desc: "", qty: 1, uom: "ea", unitPrice: 0, category: "expense", taxRate: "" }]);

  const autoFilledFromRef = useRef(null);
  const diagram = `stateDiagram-v2
  [*] --> RECEIVED
  RECEIVED --> PARSED
  PARSED --> READY
  READY --> ROUTED
  ROUTED --> POSTED
  POSTED --> [*]`;

  /* ---------- Load ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pager = await bilags.listDocs({ status: "RECEIVED,PARSED,READY,ROUTED,POSTED", limit: 200 });
      const items = Array.isArray(pager.items) ? pager.items : [];
      setList(items);
      if (!selected && items.length) setSelected(items[0]);
    } catch (e) { setError(String(e.message || e)); }
    finally { setLoading(false); }
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  /* ---------- Auto-fill form from extracted doc ---------- */
  useEffect(() => {
    if (!selected?._id) return;
    if (autoFilledFromRef.current === selected._id) return;
    const ex = selected.extracted || {};
    if (!ex || Object.keys(ex).length === 0) return;

    const sup = ex.supplier || {};
    const nums = ex.numbers || {};
    const tax = ex.tax || {};
    const dateGuess = ex.date || ex?.dates?.invoice || ex?.dates?.document || selected.createdAt;

    setMSubject(selected.source?.subject ?? ex.subject ?? mSubject ?? "");
    setMSupplierName(sup.name || "");
    setMSupplierEmail(sup.email || "");
    setMSupplierPhone(sup.phone || "");
    setMSupplierAddress(sup.address || "");
    setMSupplierVAT(sup.vat || sup.VAT || "");
    setMInvoiceNo(nums.invoiceNo || "");
    setMOrderNo(nums.orderNo || "");
    setMDate(isoDateOnly(dateGuess));
    setMCurrency(ex.currency || "DKK");
    if (tax.mode) setMTaxMode(tax.mode);
    if (tax.defaultRate) setMTaxRate(Number(tax.defaultRate));

    const lines = Array.isArray(ex.lines) ? ex.lines : [];
    if (lines.length > 0) {
      setMLines(
        lines.map((l, i) => ({
          sku: l.sku || "",
          desc: l.desc || `Line ${i + 1}`,
          qty: Number(l.qty ?? 1) || 1,
          uom: l.uom || (l.category ? defaultUomForCategory(l.category) : "ea"),
          unitPrice: Number(l.unitPrice ?? l.lineNet ?? 0) || 0,
          category: l.category || (l.sku ? "inventory" : "expense"),
          taxRate: typeof l.taxRate === "number" ? Number(l.taxRate) : "",
        }))
      );
    } else {
      const totalNet = Number(ex?.totals?.subtotal ?? 0);
      if (totalNet > 0) {
        setMLines([{ sku: "", desc: "Total", qty: 1, uom: "ea", unitPrice: totalNet, category: "expense", taxRate: tax.defaultRate || "" }]);
      }
    }

    setMExpanded(true);
    autoFilledFromRef.current = selected._id;
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { autoFilledFromRef.current = null; }, [list]);

  /* ----------------- Attachments-only policy ----------------- */
  const ATTACH_ONLY = true;
  const hasAttachments = (doc) => {
    const a = Array.isArray(doc?.files) ? doc.files : [];
    const b = Array.isArray(doc?.source?.files) ? doc.source.files : [];
    return (a.length + b.length) > 0;
  };

  /* ----------------- Core actions ----------------- */
  const normalizedSubject = (s) => {
    const t = String(s || "").trim();
    return t.toLowerCase() === "back office" ? "" : t;
  };

  const fetchEmails = useCallback(async (opts = {}) => {
    setBusy((b) => ({ ...b, email: true }));
    setError("");
    setOkMsg("");
    setFetchMeta(null);
    try {
      const body = {
        subject: normalizedSubject(opts.subject ?? emailSubject),
        fromContains: String(opts.fromContains ?? emailFrom).trim(),
        includeSeen: opts.includeSeen ?? emailIncludeSeen,
        limit: Number(opts.limit ?? emailLimit) || 50,
        attachmentsOnly: ATTACH_ONLY,
        requireAttachment: ATTACH_ONLY,
        ignoreBody: ATTACH_ONLY,
        preferAttachments: ATTACH_ONLY,
      };
      const r = await bilags.emailFetch(body);
      const meta = r?.meta ?? r ?? {};
      setFetchMeta({
        imported: r?.imported ?? 0,
        scanned: meta.scanned ?? 0,
        parsed: meta.parsed ?? 0,
        skippedNoMatch: meta.skippedNoMatch ?? 0,
        skippedNoFiles: meta.skippedNoFiles ?? 0,
        skippedDuplicate: meta.skippedDuplicate ?? 0,
      });
      await load();
      setOkMsg(`Imported ${r?.imported ?? 0} document(s).`);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy((b) => ({ ...b, email: false }));
    }
  }, [emailSubject, emailFrom, emailIncludeSeen, emailLimit, load]);

  const testIMAP = useCallback(async () => {
    setBusy((b) => ({ ...b, test: true }));
    setError("");
    setOkMsg("");
    try {
      const r = await bilags.emailTest();
      setOkMsg(`IMAP OK — unseen: ${r.unseen}, total: ${r.total}`);
    } catch (e) {
      setError(`IMAP test failed: ${String(e.message || e)}`);
    } finally {
      setBusy((b) => ({ ...b, test: false }));
    }
  }, []);

  const onRoute = useCallback(async (doc) => {
    setError("");
    setOkMsg("");
    try {
      await bilags.route(doc._id);
      const updated = await bilags.getDoc(doc._id);
      setSelected(updated);
      await load();
      setOkMsg("Proposal built.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [load]);

  const onCreateAndPost = useCallback(async (doc) => {
    setError("");
    setOkMsg("");
    try {
      const prop = doc?.proposal;
      if (!prop?.journal) throw new Error("No proposal available. Click Build Proposal first.");
      const je = await createJournal({
        date: prop.journal.date,
        reference: prop.journal.reference,
        memo: prop.journal.memo,
        lines: prop.journal.lines,
        status: "approved",
      });
      const jeId = je?._id || je?.id;

      const smIds = [];
      for (const sm of prop.stockMoves || []) {
        const created = await createStockMove({
          ...sm,
          participants: { preparedBy: { name: "BackOffice", at: new Date() } },
          status: "approved",
        });
        smIds.push(created._id || created.id);
      }

      if (jeId) {
        await approveJournal(jeId, {});
        await postJournal(jeId, {});
      }
      for (const id of smIds) await postStockMove(id, { postedBy: "BackOffice" });

      await bilags.link(doc._id, {
        journalId: jeId || null,
        stockMoveIds: smIds,
        posted: true,
        user: "BackOffice",
      });
      const updated = await bilags.getDoc(doc._id);
      setSelected(updated);
      await load();
      setOkMsg("Drafts posted and document linked.");
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [load]);

  const onUpload = useCallback(async (input) => {
    const files = input?.files;
    if (!files?.length) return;
    setUploading(true);
    setError("");
    setOkMsg("");
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      await bilags.ingest(form);
      input.value = "";
      await load();
      setOkMsg("Upload complete.");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setUploading(false);
    }
  }, [load]);

  const runOCR = useCallback(async () => {
    if (!selected) return setError("Select a document first.");
    if (ATTACH_ONLY && !hasAttachments(selected)) {
      setError("This email has no attachments. Attach a file to run OCR/extraction.");
      return;
    }
    setBusy((b) => ({ ...b, ocr: true }));
    setError("");
    try {
      await bilags.ocr(selected._id, { ocrVendor, ocrLang, attachmentsOnly: ATTACH_ONLY });
      const updated = await bilags.getDoc(selected._id);
      setSelected(updated);
      setOkMsg("OCR completed.");
    } catch (e) { setError(String(e.message || e)); }
    finally { setBusy((b) => ({ ...b, ocr: false })); }
  }, [selected, ocrVendor, ocrLang]);

  const runLLMExtract = useCallback(async () => {
    if (!selected) return setError("Select a document first.");
    if (ATTACH_ONLY && !hasAttachments(selected)) {
      setError("This email has no attachments. Attach a file to run LLM extraction.");
      return;
    }
    setBusy((b) => ({ ...b, llm: true }));
    setError("");
    try {
      await bilags.llmExtract(selected._id, {
        forceReOcr: false,
        attachmentsOnly: ATTACH_ONLY,
        preferAttachments: ATTACH_ONLY,
        ignoreBody: ATTACH_ONLY,
      });
      const updated = await bilags.getDoc(selected._id);
      setSelected(updated);
      setOkMsg("LLM extraction complete.");
    } catch (e) { setError(String(e.message || e)); }
    finally { setBusy((b) => ({ ...b, llm: false })); }
  }, [selected]);

  /* -------------- Derived UI data -------------- */
  const rows = useMemo(() => (Array.isArray(list) ? list : []), [list]);

  // Files (both doc.files and source.files)
  const allFiles = useMemo(() => {
    const filesA = Array.isArray(selected?.files) ? selected.files : [];
    const filesB = Array.isArray(selected?.source?.files) ? selected.source.files : [];
    return [...filesA, ...filesB];
  }, [selected]);

  const firstFileUrl = useMemo(() => {
    const f = allFiles?.[0];
    if (!f) return null;
    const url = f.url || f.storedAs || f.path;
    return url ? `${API_BASE}${url}` : null;
  }, [allFiles]);

  const journalLines =
    selected?.proposal?.journal?.lines || buildPreviewJournal(selected)?.lines || [];
  const debitSum = sumDebit(journalLines);
  const creditSum = sumCredit(journalLines);

  // Manual lines helpers
  const onAddManualLine = () =>
    setMLines((ls) => [...ls, { sku: "", desc: "", qty: 1, uom: "ea", unitPrice: 0, category: "expense", taxRate: "" }]);

  const onDelManualLine = (idx) => setMLines((ls) => ls.filter((_, i) => i !== idx));

  const onChangeManualLine = (idx, field, value) =>
    setMLines((ls) =>
      ls.map((r, i) =>
        i === idx
          ? {
              ...r,
              [field]:
                field === "qty" || field === "unitPrice" || field === "taxRate"
                  ? (value === "" ? "" : Number(value))
                  : value,
              ...(field === "category" && !r.uom ? { uom: defaultUomForCategory(value) } : {}),
            }
          : r
      )
    );

  const autoSkuFor = (idx) =>
    setMLines((ls) =>
      ls.map((r, i) => (i === idx ? { ...r, sku: r.sku || generateSku(r.desc) } : r))
    );
  const autoUomFor = (idx) =>
    setMLines((ls) =>
      ls.map((r, i) => (i === idx ? { ...r, uom: r.uom || defaultUomForCategory(r.category || "expense") } : r))
    );

  // Totals preview
  const previewTotals = useMemo(() => {
    const defRate = Number.isFinite(Number(mTaxRate)) ? Number(mTaxRate) : 25;
    let subtotal = 0, tax = 0, totalInc = 0;
    for (const ln of mLines) {
      const qty = Number(ln.qty) || 0;
      const unit = Number(ln.unitPrice) || 0;
      const ratePct = ln.taxRate === "" ? defRate : Number(ln.taxRate) || 0;
      const rate = ratePct / 100;
      if (mTaxMode === "inclusive") {
        const gross = qty * unit;
        const net = rate > 0 ? gross / (1 + rate) : gross;
        subtotal += net; tax += gross - net; totalInc += gross;
      } else {
        const net = qty * unit; const t = net * rate;
        subtotal += net; tax += t; totalInc += net + t;
      }
    }
    return { subtotal: +subtotal.toFixed(2), tax: +tax.toFixed(2), totalInc: +totalInc.toFixed(2) };
  }, [mLines, mTaxMode, mTaxRate]);

  /* ---------- Manual: Print + Insert (professional) ---------- */
  const buildManualDocForPrint = () => ({
    mSubject, mSupplierName, mSupplierEmail, mSupplierPhone, mSupplierAddress, mSupplierVAT,
    mInvoiceNo, mOrderNo, mDate, mCurrency, mTaxMode, mTaxRate, mLines, totals: previewTotals,
  });

  const makeDocTitle = (doc) => {
    const parts = [
      doc.mSupplierName || "Supplier",
      doc.mInvoiceNo ? `INV ${doc.mInvoiceNo}` : (doc.mOrderNo ? `ORD ${doc.mOrderNo}` : (doc.mSubject || "Manual")),
      doc.mDate || new Date().toISOString().slice(0, 10),
    ];
    return parts.filter(Boolean).join(" — ").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 140);
  };

  const handleSavePdfOnly = () => {
    const doc = buildManualDocForPrint();
    const html = renderManualHTML(doc);
    const title = makeDocTitle(doc);
    printHtml(title, html);
  };

  const submitManual = async () => {
    setBusy((b) => ({ ...b, manual: true }));
    setError("");
    setOkMsg("");
    try {
      // Build the JSON payload only (no PDF generation here)
      const body = {
        subject: mSubject,
        supplierName: mSupplierName,
        supplierEmail: mSupplierEmail,
        supplierPhone: mSupplierPhone,
        supplierAddress: mSupplierAddress,
        supplierVAT: mSupplierVAT,
        invoiceNo: mInvoiceNo,
        orderNo: mOrderNo,
        date: mDate,
        currency: mCurrency,
        taxMode: mTaxMode,
        taxRate: Number(mTaxRate),
        lines: mLines.map((l, idx) => ({
          sku: l.sku || generateSku(l.desc || `LINE-${idx + 1}`),
          desc: l.desc || `Line ${idx + 1}`,
          qty: Number(l.qty) || 0,
          uom: l.uom || defaultUomForCategory(l.category || "expense"),
          unitPrice: Number(l.unitPrice) || 0,
          category: l.category || (l.sku ? "inventory" : "expense"),
          ...(l.taxRate !== "" ? { taxRate: Number(l.taxRate) } : {}),
        })),
      };

      // Create the manual doc (no PDF creation/attachment)
      const created = await fetch(`${API_BASE}/api/bilags/docs/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((res) =>
        res.ok ? res.json() : res.json().then((j) => Promise.reject(new Error(j.error || res.statusText)))
      );

      // Refresh UI and select the created doc
      const refreshed = await bilags.getDoc(created?._id);
      setSelected(refreshed);
      await load();

      // Reset manual form
      setMExpanded(false);
      setMLines([{ sku: "", desc: "", qty: 1, uom: "ea", unitPrice: 0, category: "expense", taxRate: "" }]);

      setOkMsg("Manual document created and inserted (no PDF saved).");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy((b) => ({ ...b, manual: false }));
    }
  };
    

  /* =========================== UI =========================== */
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h5" sx={{ flex: 1 }}>
          Back-Office Inbox
        </Typography>

        <Chip size="small" color="info" label="Attachments-only extraction" />

        <Button
          size="small"
          variant="contained"
          startIcon={<NoteAddIcon />}
          onClick={() => setMExpanded(true)}
          sx={{ textTransform: "none" }}
        >
          Manual Entry
        </Button>

        <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {/* Global alerts */}
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {okMsg && <Alert severity="success" onClose={() => setOkMsg("")}>{okMsg}</Alert>}

      {/* Fetch status */}
      {fetchMeta && (
        <Alert severity="info" onClose={() => setFetchMeta(null)}>
          Imported {fetchMeta.imported}. Scanned {fetchMeta.scanned}, parsed {fetchMeta.parsed}, skipped (no match) {fetchMeta.skippedNoMatch}, (no files) {fetchMeta.skippedNoFiles}, (duplicate) {fetchMeta.skippedDuplicate}.
        </Alert>
      )}

      {/* Action bar */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
          <TextField
            id="email-subject"
            name="emailSubject"
            size="small"
            label="Subject contains (blank = all)"
            placeholder="e.g. invoice, receipt"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            sx={{ minWidth: 240 }}
          />
          <TextField
            id="email-from"
            name="emailFrom"
            size="small"
            label="From contains (optional)"
            placeholder="e.g. supplier.com"
            value={emailFrom}
            onChange={(e) => setEmailFrom(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <FormControlLabel
            label="Include seen"
            htmlFor="email-include-seen"
            control={
              <Checkbox
                id="email-include-seen"
                name="emailIncludeSeen"
                checked={emailIncludeSeen}
                onChange={(e) => setEmailIncludeSeen(e.target.checked)}
              />
            }
          />
          <TextField
            id="email-limit"
            name="emailLimit"
            size="small"
            type="number"
            label="Limit"
            value={emailLimit}
            onChange={(e) => setEmailLimit(e.target.value)}
            sx={{ width: 110 }}
          />

          <Tooltip title="Pull emails and create docs ONLY if they have PDF/image/text attachments (email body ignored)">
            <span>
              <Button startIcon={<MailIcon />} onClick={() => fetchEmails()} disabled={busy.email}>
                {busy.email ? "Importing…" : "Import"}
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Quick IMAP connectivity check (unseen count)">
            <span>
              <Button startIcon={<InsightsIcon />} variant="text" onClick={testIMAP} disabled={busy.test}>
                {busy.test ? "Testing…" : "Test IMAP"}
              </Button>
            </span>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {/* OCR options */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="ocr-vendor-label">OCR</InputLabel>
            <Select
              labelId="ocr-vendor-label"
              id="ocr-vendor"
              name="ocrVendor"
              label="OCR"
              value={ocrVendor}
              onChange={(e) => setOcrVendor(e.target.value)}
            >
              <MenuItem value="auto">auto</MenuItem>
              <MenuItem value="tesseract">tesseract</MenuItem>
              <MenuItem value="ocrspace">ocrspace</MenuItem>
            </Select>
          </FormControl>
          <TextField
            id="ocr-lang"
            name="ocrLang"
            size="small"
            label="Lang"
            value={ocrLang}
            onChange={(e) => setOcrLang(e.target.value)}
            sx={{ width: 140 }}
          />

          {/* Optional local upload */}
          <Button component="label" variant="text" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload files"}
            <input id="local-upload" name="localUpload" hidden type="file" multiple onChange={(e) => onUpload(e.target)} />
          </Button>
        </Stack>
      </Paper>

      {/* Manual entry */}
      <Accordion expanded={mExpanded} onChange={(_, ex) => setMExpanded(ex)} sx={{ borderRadius: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Manual Entry (Create PDF + Insert to Inbox)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {/* Supplier */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Supplier Contact</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField id="m-supplier-name" name="supplierName" label="Supplier Name" value={mSupplierName} onChange={(e) => setMSupplierName(e.target.value)} fullWidth />
                <TextField id="m-supplier-email" name="supplierEmail" label="Email" value={mSupplierEmail} onChange={(e) => setMSupplierEmail(e.target.value)} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
                <TextField id="m-supplier-phone" name="supplierPhone" label="Phone" value={mSupplierPhone} onChange={(e) => setMSupplierPhone(e.target.value)} fullWidth />
                <TextField id="m-supplier-vat" name="supplierVAT" label="VAT" value={mSupplierVAT} onChange={(e) => setMSupplierVAT(e.target.value)} fullWidth />
              </Stack>
              <TextField id="m-supplier-address" name="supplierAddress" sx={{ mt: 1 }} label="Address" value={mSupplierAddress} onChange={(e) => setMSupplierAddress(e.target.value)} fullWidth multiline minRows={2} />
            </Paper>

            {/* Header / numbers */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Header</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField id="m-subject" name="subject" label="Subject" value={mSubject} onChange={(e) => setMSubject(e.target.value)} fullWidth />
                <TextField
                  id="m-invoice-no"
                  name="invoiceNo"
                  label="Invoice No."
                  value={mInvoiceNo}
                  onChange={(e) => setMInvoiceNo(e.target.value)}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <IconButton size="small" onClick={() => setMInvoiceNo((v) => v || generateInvoiceNo())} title="Auto-generate">
                        <AutoFixHighIcon fontSize="small" />
                      </IconButton>
                    ),
                  }}
                />
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
                <TextField
                  id="m-order-no"
                  name="orderNo"
                  label="Order No."
                  value={mOrderNo}
                  onChange={(e) => setMOrderNo(e.target.value)}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <IconButton size="small" onClick={() => setMOrderNo((v) => v || generateOrderNo())} title="Auto-generate">
                        <AutoFixHighIcon fontSize="small" />
                      </IconButton>
                    ),
                  }}
                />
                <TextField id="m-date" name="date" label="Date (YYYY-MM-DD)" value={mDate} onChange={(e) => setMDate(e.target.value)} fullWidth />
                <TextField id="m-currency" name="currency" label="Currency" value={mCurrency} onChange={(e) => setMCurrency(e.target.value)} fullWidth />
              </Stack>
            </Paper>

            {/* Tax controls */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Tax</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <FormControl fullWidth>
                  <InputLabel id="tax-mode-label">Tax Mode</InputLabel>
                  <Select
                    labelId="tax-mode-label"
                    id="tax-mode"
                    name="taxMode"
                    label="Tax Mode"
                    value={mTaxMode}
                    onChange={(e) => setMTaxMode(e.target.value)}
                  >
                    <MenuItem value="exclusive">Exclusive (add VAT on top)</MenuItem>
                    <MenuItem value="inclusive">Inclusive (unit includes VAT)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  id="tax-rate"
                  name="taxRate"
                  label="Default Tax Rate (%)"
                  type="number"
                  value={mTaxRate}
                  onChange={(e) => setMTaxRate(e.target.value)}
                  fullWidth
                />
              </Stack>
            </Paper>

            {/* Lines grid */}
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Lines</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={120}>SKU</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell width={130}>Category</TableCell>
                    <TableCell align="right" width={80}>Qty</TableCell>
                    <TableCell width={80}>UoM</TableCell>
                    <TableCell align="right" width={120}>Unit Price</TableCell>
                    <TableCell align="right" width={90}>Tax %</TableCell>
                    <TableCell align="center" width={90}>Auto</TableCell>
                    <TableCell align="right" width={120}>Line (preview)</TableCell>
                    <TableCell width={48}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mLines.map((ln, i) => {
                    const qty = Number(ln.qty) || 0;
                    const unit = Number(ln.unitPrice) || 0;
                    const ratePct = ln.taxRate === "" ? Number(mTaxRate) || 0 : Number(ln.taxRate) || 0;
                    const rate = ratePct / 100;
                    const linePreview = mTaxMode === "inclusive" ? qty * unit : (qty * unit) * (1 + rate);
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <TextField
                            id={`line-${i}-sku`}
                            name={`lines[${i}].sku`}
                            size="small"
                            value={ln.sku}
                            onChange={(e) => onChangeManualLine(i, "sku", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            id={`line-${i}-desc`}
                            name={`lines[${i}].desc`}
                            size="small"
                            value={ln.desc}
                            fullWidth
                            onChange={(e) => onChangeManualLine(i, "desc", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <InputLabel id={`line-${i}-cat-label`}>Category</InputLabel>
                            <Select
                              labelId={`line-${i}-cat-label`}
                              id={`line-${i}-cat`}
                              name={`lines[${i}].category`}
                              label="Category"
                              value={ln.category || "expense"}
                              onChange={(e) => onChangeManualLine(i, "category", e.target.value)}
                            >
                              <MenuItem value="inventory">inventory</MenuItem>
                              <MenuItem value="service">service</MenuItem>
                              <MenuItem value="expense">expense</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            id={`line-${i}-qty`}
                            name={`lines[${i}].qty`}
                            size="small"
                            type="number"
                            value={ln.qty}
                            onChange={(e) => onChangeManualLine(i, "qty", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            id={`line-${i}-uom`}
                            name={`lines[${i}].uom`}
                            size="small"
                            value={ln.uom}
                            onChange={(e) => onChangeManualLine(i, "uom", e.target.value)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            id={`line-${i}-unitPrice`}
                            name={`lines[${i}].unitPrice`}
                            size="small"
                            type="number"
                            value={ln.unitPrice}
                            onChange={(e) => onChangeManualLine(i, "unitPrice", e.target.value)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            id={`line-${i}-taxRate`}
                            name={`lines[${i}].taxRate`}
                            size="small"
                            type="number"
                            placeholder={`${mTaxRate}`}
                            value={ln.taxRate}
                            onChange={(e) => onChangeManualLine(i, "taxRate", e.target.value)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Auto SKU from description">
                              <IconButton aria-label="auto-sku" size="small" onClick={() => autoSkuFor(i)}>
                                <AutoFixHighIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Auto UoM from category">
                              <IconButton aria-label="auto-uom" size="small" onClick={() => autoUomFor(i)}>
                                <AutoFixHighIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{linePreview.toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <IconButton aria-label="delete-line" onClick={() => onDelManualLine(i)} size="small">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Button startIcon={<AddIcon />} onClick={onAddManualLine}>Add line</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} align="right"><b>Subtotal</b></TableCell>
                    <TableCell align="right"><b>{previewTotals.subtotal.toFixed(2)} {mCurrency}</b></TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} align="right"><b>Tax</b></TableCell>
                    <TableCell align="right"><b>{previewTotals.tax.toFixed(2)} {mCurrency}</b></TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} align="right"><b>Total (inc.)</b></TableCell>
                    <TableCell align="right"><b>{previewTotals.totalInc.toFixed(2)} {mCurrency}</b></TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

              <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleSavePdfOnly}>
                  Save as PDF
                </Button>
                <Button variant="contained" startIcon={<SendIcon />} onClick={submitManual} disabled={busy.manual}>
                  Insert
                </Button>

              </Stack>
            </Paper>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {/* LEFT: List */}
        <Paper sx={{ p: 2, borderRadius: 3, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Documents</Typography>
          <Divider sx={{ mb: 1 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Supplier Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>VAT</TableCell>
                <TableCell>Invoice No.</TableCell>
                <TableCell>Order No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Tax Mode</TableCell>
                <TableCell align="right">Tax %</TableCell>
                <TableCell align="right">Total (inc.)</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rows || []).map((d) => {
                const ex = d?.extracted || {};
                const sup = ex.supplier || {};
                const nums = ex.numbers || {};
                const tax = ex.tax || {};
                const tot = Number(ex?.totals?.totalInc ?? ex?.total ?? 0);
                const code = ex.currency || "DKK";
                const dateStr = ex.date || ex?.dates?.invoice || d?.date || d?.createdAt;

                return (
                  <TableRow
                    key={d._id}
                    hover
                    selected={selected?._id === d._id}
                    onClick={() => setSelected(d)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>{d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}</TableCell>
                    <TableCell>{d.source?.subject ?? ex.subject ?? "—"}</TableCell>
                    <TableCell>{sup.name || "—"}</TableCell>
                    <TableCell>{sup.email || "—"}</TableCell>
                    <TableCell>{sup.phone || "—"}</TableCell>
                    <TableCell>{sup.vat || sup.VAT || "—"}</TableCell>
                    <TableCell>{nums.invoiceNo || "—"}</TableCell>
                    <TableCell>{nums.orderNo || "—"}</TableCell>
                    <TableCell>{dateStr ? new Date(dateStr).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{code}</TableCell>
                    <TableCell>{tax.mode || "—"}</TableCell>
                    <TableCell align="right">{tax.defaultRate ?? "—"}</TableCell>
                    <TableCell align="right">{fmtMoney(tot, code)}</TableCell>
                    <TableCell><Chip size="small" label={d.status || "—"} /></TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} align="center">
                    <Box sx={{ py: 2, color: "text.secondary" }}>
                      {loading ? "Loading…" : "No documents."}
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* RIGHT: Details */}
        <Paper sx={{ p: 2, borderRadius: 3, flex: 1.2, minWidth: 420 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Details</Typography>
          <Divider sx={{ mb: 1 }} />

          {selected ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={`Type: ${selected.type || "—"}`} />
                <Chip size="small" label={`Status: ${selected.status || "—"}`} />
                <Chip size="small" label={`Supplier: ${selected.extracted?.supplier?.name || "—"}`} />
                <Chip size="small" label={`Invoice: ${selected.extracted?.numbers?.invoiceNo || "—"}`} />
                <Chip size="small" label={`Order: ${selected.extracted?.numbers?.orderNo || "—"}`} />
                {selected.extracted?.numbers?.poNo && <Chip size="small" label={`PO: ${selected.extracted.numbers.poNo}`} />}
                <Chip size="small" label={`Currency: ${selected.extracted?.currency || "DKK"}`} />
                {selected.extracted?.tax?.mode && <Chip size="small" label={`Tax: ${selected.extracted.tax.mode}${selected.extracted.tax.defaultRate ? ` @ ${selected.extracted.tax.defaultRate}%` : ""}`} />}
                <Chip
                  size="small"
                  label={`Total: ${fmtMoney(
                    Number(selected?.extracted?.totals?.totalInc ?? selected?.extracted?.total ?? 0),
                    selected?.extracted?.currency || "DKK"
                  )}`}
                />
              </Stack>

              {/* Totals */}
              <Table size="small" sx={{ maxWidth: 420 }}>
                <TableBody>
                  <TableRow>
                    <TableCell>Subtotal</TableCell>
                    <TableCell align="right">{fmtMoney(Number(selected?.extracted?.totals?.subtotal || 0), selected?.extracted?.currency || "DKK")}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Tax</TableCell>
                    <TableCell align="right">{fmtMoney(Number(selected?.extracted?.totals?.tax || 0), selected?.extracted?.currency || "DKK")}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total (inc.)</TableCell>
                    <TableCell align="right">{fmtMoney(Number(selected?.extracted?.totals?.totalInc || selected?.extracted?.total || 0), selected?.extracted?.currency || "DKK")}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Files table */}
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Files</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Filename</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Size</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell align="right">Open</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(allFiles || []).map((f, i) => {
                    const url = f.url || f.storedAs || f.path;
                    return (
                      <TableRow key={i}>
                        <TableCell>{f.originalname || f.filename || f.name || (url ? url.split("/").pop() : "—")}</TableCell>
                        <TableCell>{f.mimetype || f.type || "—"}</TableCell>
                        <TableCell align="right">{typeof f.size === "number" ? `${(f.size/1024).toFixed(1)} KB` : "—"}</TableCell>
                        <TableCell>{f.isSource ? "email" : "inbox"}</TableCell>
                        <TableCell align="right">
                          {url ? (
                            <Link href={`${API_BASE}${url}`} target="_blank" rel="noreferrer">Open</Link>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!allFiles || allFiles.length === 0) && (
                    <TableRow><TableCell colSpan={5} align="center"><Box sx={{ py: 1, color: "text.secondary" }}>No files.</Box></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>

              <Typography variant="subtitle2" sx={{ mt: 1 }}>Lines</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>SKU</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Cat.</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>UoM</TableCell>
                    <TableCell align="right">Unit</TableCell>
                    <TableCell align="right">Net</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Line Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(selected.extracted?.lines || []).map((ln, i) => (
                    <TableRow key={i}>
                      <TableCell>{ln.sku || "—"}</TableCell>
                      <TableCell>{ln.desc || "—"}</TableCell>
                      <TableCell>{ln.category || "—"}</TableCell>
                      <TableCell align="right">{ln.qty ?? "—"}</TableCell>
                      <TableCell>{ln.uom || "—"}</TableCell>
                      <TableCell align="right">{Number(ln.unitPrice ?? 0).toFixed(2)}</TableCell>
                      <TableCell align="right">{Number(ln.lineNet ?? 0).toFixed(2)}</TableCell>
                      <TableCell align="right">{Number(ln.taxAmount ?? 0).toFixed(2)}</TableCell>
                      <TableCell align="right">{Number(ln.lineTotal ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {(selected.extracted?.lines || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Box sx={{ py: 1, color: "text.secondary" }}>No lines extracted yet.</Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <Divider sx={{ my: 1 }} />

              {/* Journal summary + actions */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
                <Chip size="small" color={selected?.proposal ? "success" : "default"} label={selected?.proposal ? "Proposal" : "Preview"} />
                <Chip size="small" label={`Debit: ${fmtMoney(debitSum, selected?.extracted?.currency || "DKK")}`} />
                <Chip size="small" label={`Credit: ${fmtMoney(creditSum, selected?.extracted?.currency || "DKK")}`} />
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Re-run OCR on this document (honors vendor/lang) — attachments only">
                    <span><Button startIcon={<InsightsIcon />} onClick={runOCR} disabled={busy.ocr}>{busy.ocr ? "Running OCR…" : "OCR Extract"}</Button></span>
                  </Tooltip>
                  <Tooltip title="Strict LLM extraction with totals reconciliation — attachments only">
                    <span><Button startIcon={<TuneIcon />} onClick={runLLMExtract} disabled={busy.llm}>{busy.llm ? "Extracting…" : "LLM Extract"}</Button></span>
                  </Tooltip>
                  <Button startIcon={<RouteIcon />} variant="outlined" onClick={() => onRoute(selected)}>Build Proposal</Button>
                  <Button startIcon={<CheckIcon />} variant="contained" onClick={() => onCreateAndPost(selected)} disabled={!selected.proposal || selected.status === "POSTED"}>
                    Create Drafts & Post
                  </Button>
                  {selected.links?.journalId && <Chip size="small" icon={<SendIcon />} label={`JE: ${String(selected.links.journalId).slice(-6)}`} />}
                </Stack>
              </Stack>

              {/* Proposed journal */}
              {selected.proposal && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2">Proposed Journal</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Account</TableCell>
                        <TableCell>Memo</TableCell>
                        <TableCell align="right">Debit</TableCell>
                        <TableCell align="right">Credit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selected.proposal.journal?.lines?.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>{l.account}</TableCell>
                          <TableCell>{l.memo}</TableCell>
                          <TableCell align="right">{Number(l.debit || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{Number(l.credit || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {selected.proposal.stockMoves?.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>Proposed Stock Moves</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Item</TableCell>
                            <TableCell align="right">Qty</TableCell>
                            <TableCell>UoM</TableCell>
                            <TableCell align="right">Unit Cost</TableCell>
                            <TableCell>To</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selected.proposal.stockMoves.map((m, i) => (
                            <TableRow key={i}>
                              <TableCell>{m.date}</TableCell>
                              <TableCell>{m.itemSku}</TableCell>
                              <TableCell align="right">{m.qty}</TableCell>
                              <TableCell>{m.uom}</TableCell>
                              <TableCell align="right">{Number(m.unitCost || 0).toFixed(2)}</TableCell>
                              <TableCell>{m.toWhCode}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </>
              )}

              {/* File preview (PDF/Image) */}
              {firstFileUrl ? (
                <Box sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2, overflow: "hidden", height: 900, position: "relative" }}>
                  <iframe
                    title="preview"
                    src={encodeURI(`${firstFileUrl}#toolbar=1&navpanes=0&zoom=page-width`)}
                    style={{ width: "100%", height: "100%", border: 0 }}
                    referrerPolicy="no-referrer"
                    allow="fullscreen"
                  />
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                  <PictureAsPdfIcon fontSize="small" /> No preview file
                </Box>
              )}
            </Stack>
          ) : (
            <Box sx={{ py: 3, color: "text.secondary" }}>Select a document to see details</Box>
          )}
        </Paper>
      </Stack>

      {/* Sign-off dialog (optional) */}
      <Dialog open={signoffOpen} onClose={() => setSignoffOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Process Sign-off</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            Please review the state diagram below and confirm the flow is correctly understood.
          </Typography>
          <Box sx={{ p: 1, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1, mb: 2 }}>
            <Mermaid chart={diagram} />
          </Box>
          <FormControlLabel
            htmlFor="signoff-confirm"
            control={
              <Checkbox
                id="signoff-confirm"
                name="confirmUnderstood"
                checked={confirmUnderstood}
                onChange={(e) => setConfirmUnderstood(e.target.checked)}
              />
            }
            label="I have reviewed the diagram and the process is correctly understood."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignoffOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setSignoffOpen(false)} disabled={!confirmUnderstood}>
            Confirm & Record Sign-off
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


