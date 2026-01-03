// client/src/pages/Inventory_StockMove.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Stack, Typography, Button, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, Divider, Autocomplete, Box,
  Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SendIcon from "@mui/icons-material/Send";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FilterListIcon from "@mui/icons-material/FilterList";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  listStockMoves,
  createStockMove,
  deleteStockMove,
  postStockMove,
  listWarehouses,
  listPersons,
} from "../api.js";

/* ---------- helpers ---------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  const s = String(d || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? s : dt.toISOString().slice(0, 10);
};
const sameDay = (a, b) => fmtDate(a) === fmtDate(b);
const asItems = (x) => (Array.isArray(x?.items) ? x.items : Array.isArray(x) ? x : []);

// daily sequences in localStorage
const yyyymmdd = (iso) => (iso || todayISO()).replaceAll("-", "");
const seqKey = (prefix, dateISO) => `inv.seq.${prefix}.${yyyymmdd(dateISO)}`;
const nextSeq = (prefix, dateISO) => {
  const k = seqKey(prefix, dateISO);
  let n = 0; try { n = Number(localStorage.getItem(k) || "0"); } catch {}
  n += 1; try { localStorage.setItem(k, String(n)); } catch {}
  return n;
};
const docNo = (prefix, dateISO) =>
  `${prefix}-${yyyymmdd(dateISO)}-${String(nextSeq(prefix, dateISO)).padStart(4,"0")}`;

// preview the *next* number without incrementing
const peekDocNo = (prefix, dateISO) => {
  const k = seqKey(prefix, dateISO);
  let n = 0; try { n = Number(localStorage.getItem(k) || "0"); } catch {}
  const next = n + 1;
  return `${prefix}-${yyyymmdd(dateISO)}-${String(next).padStart(4,"0")}`;
};

/* load /ACTA_logo.png from public as dataURL for jsPDF */
const loadImageDataURL = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

export default function InventoryStockMove() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Daily report filters + preview
  const [filters, setFilters] = useState({
    dateFrom: todayISO(),
    dateTo: todayISO(),
    itemQuery: "",
    fromWh: "",
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  // toasts
  const [toast, setToast] = useState({ open: false, kind: "success", msg: "" });
  const showOk = (msg) => setToast({ open: true, kind: "success", msg });
  const showErr = (msg) => setToast({ open: true, kind: "error", msg });

  // form state
  const [move, setMove] = useState({
    date: todayISO(),
    qty: 1,
    uom: "pcs",
    unitCost: 0,
    fromWhCode: "",
    toWhCode: "",
    preparedBy: "",
    approvedBy: "",
    memo: "",
  });

  // people inputs for freeSolo fields
  const [preparedByInput, setPreparedByInput] = useState("");
  const [approvedByInput, setApprovedByInput] = useState("");

  // auto previews (do not consume sequence)
  const previewItemNo  = useMemo(() => peekDocNo("ITEM", move.date || todayISO()), [move.date, rows.length, busy]);
  const previewItemSku = useMemo(() => peekDocNo("SKU",  move.date || todayISO()), [move.date, rows.length, busy]);

  const canCreate =
    move.date &&
    Number(move.qty) > 0 &&
    (move.fromWhCode || move.toWhCode);

  const refetch = async () => {
    setLoading(true);
    try {
      const [movesPager, whPager, ppl] = await Promise.all([
        listStockMoves().catch(() => ({ items: [] })),
        listWarehouses().catch(() => ({ items: [] })),
        listPersons().catch(() => []),
      ]);
      setRows(asItems(movesPager));
      const whs = asItems(whPager);
      setWarehouses(whs.length ? whs : [{ code: "MAIN" }, { code: "SHIP" }, { code: "WIP" }]);
      setPeople(asItems(ppl));
    } catch (e) {
      showErr(`Failed to load data: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refetch(); }, []);

  const whOptions = useMemo(
    () => asItems(warehouses).map(w => {
      const code = w.code || w.name || "";
      return { code, label: code };
    }),
    [warehouses]
  );

  const personNames = useMemo(
    () => asItems(people).map(p => p.name).filter(Boolean),
    [people]
  );

  // Filtered rows for Daily Report + totals
  const filteredRows = useMemo(() => {
    const dfISO = fmtDate(filters.dateFrom);
    const dtISO = fmtDate(filters.dateTo);
    const df = dfISO ? new Date(dfISO) : null;
    const dt = dtISO ? new Date(dtISO) : null;
    const q = (filters.itemQuery || "").toLowerCase();
    const fw = (filters.fromWh || "").toLowerCase();

    return rows.filter(r => {
      const d = new Date(fmtDate(r.date));
      const inDate =
        (!df || d >= new Date(fmtDate(df))) &&
        (!dt || d <= new Date(fmtDate(dt)));
      const inItem =
        !q ||
        (String(r.itemNo || "").toLowerCase().includes(q)) ||
        (String(r.itemSku || "").toLowerCase().includes(q));
      const inFrom =
        !fw || String(r.fromWhCode || "").toLowerCase().includes(fw);
      return inDate && inItem && inFrom;
    });
  }, [rows, filters]);

  const reportTotals = useMemo(() => {
    const qty = filteredRows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const value = filteredRows.reduce(
      (s, r) => s + (Number(r.qty || 0) * Number(r.unitCost || 0)),
      0
    );
    return { qty, value };
  }, [filteredRows]);

  const onCreate = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      const dateISO = move.date || todayISO();

      const payload = {
        ...move,
        itemNo: docNo("ITEM", dateISO),
        itemSku: docNo("SKU", dateISO),
        moveNo: docNo("MOVE", dateISO),
        qty: Number(move.qty) || 0,
        unitCost: Number(move.unitCost) || 0,
        status: "approved",
        participants: {
          preparedBy: move.preparedBy ? { name: move.preparedBy, at: new Date() } : undefined,
          approvedBy: move.approvedBy ? { name: move.approvedBy, at: new Date() } : undefined,
        },
      };

      const created = await createStockMove(payload);
      setRows((r) => [created || payload, ...r]);

      setMove((s) => ({
        ...s,
        qty: 1,
        unitCost: 0,
        memo: "",
      }));

      showOk("Stock move created");
      await refetch();
    } catch (e) {
      showErr(`Create failed: ${e.message || e}`);
      console.error("createStockMove failed", e);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id) => {
    if (!id) return;
    setBusy(true);
    try {
      await deleteStockMove(id);
      showOk("Move deleted");
      await refetch();
    } catch (e) {
      showErr(`Delete failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onPost = async (id) => {
    if (!id) return;
    setBusy(true);
    try {
      await postStockMove(id, { postedBy: "Inventory" });
      showOk("Move posted");
      await refetch();
    } catch (e) {
      showErr(`Post failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  // Post every unposted move for the selected 'dateFrom' (one-time posting for that date)
  const onPostByDate = async () => {
    const target = filters.dateFrom || todayISO();
    const toPost = rows.filter(r => sameDay(r.date, target) && r.status !== "posted");
    if (!toPost.length) { showErr("No unposted moves for that date."); return; }
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        toPost.map(r => postStockMove(r._id || r.id, { postedBy: "Inventory (daily batch)" }))
      );
      const ok = results.filter(r => r.status === "fulfilled").length;
      const fail = results.length - ok;
      showOk(`Posted ${ok} move(s). ${fail ? `${fail} failed.` : ""}`);
      await refetch();
    } catch (e) {
      showErr(`Batch post failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Professional receipt-style PDF export (clean table, logo, smaller font) ---------- */
  const exportPdf = async () => {
    if (!filteredRows.length) { showErr("No rows in the current report."); return; }

    const BRAND = {
      orgName: "Acta Venture Partners Aps",
      subline: "Ravnsborg Tværgade 1, 1. 2200 København N • CVR 44427508",
      primary: [14, 76, 146],       // #0E4C92
      primaryBorder: [50, 72, 112],
      text: [30, 34, 40],
      muted: [110, 120, 140],
      zebra: [248, 250, 253],
      border: [214, 222, 235],
      th: [49, 93, 147],
    };

    const doc = new jsPDF({ unit: "pt" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = { l: 64, r: 64, t: 52, b: 54 };
    const contentW = W - M.l - M.r;

    // Header (left: LOGO + brand)
    const headerY = M.t;
    let logoDrawn = false;
    try {
      const logoData = await loadImageDataURL("/ACTA_logo.png"); // place file at client/public/ACTA_logo.png
      doc.addImage(logoData, "PNG", M.l, headerY - 2, 30, 30);
      logoDrawn = true;
    } catch {
      // fallback: blue square if logo missing
      doc.setFillColor(...BRAND.primary);
      doc.roundedRect(M.l, headerY - 2, 30, 30, 4, 4, "F");
    }

    doc.setTextColor(...BRAND.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11); // smaller
    doc.text(BRAND.orgName, M.l + (logoDrawn ? 40 : 40), headerY + 12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(8); // smaller
    doc.text(BRAND.subline, M.l + (logoDrawn ? 40 : 40), headerY + 28);

    // Right meta card
    const metaW = 180;
    const metaH = 78; // slightly shorter
    const metaX = M.l + contentW - metaW;
    const metaY = headerY - 8;
    doc.setDrawColor(...BRAND.border);
    doc.setFillColor(255, 255, 255);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.primary);
    doc.setFontSize(11);
    doc.text("Daily Report", metaX + 14, metaY + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.text);
    const dateLine = `${filters.dateFrom || "—"}${
      filters.dateTo && filters.dateTo !== filters.dateFrom ? ` → ${filters.dateTo}` : ""
    }`;
    const rowsMeta = [
      ["Date", dateLine],
      ["From", filters.fromWh || "All"],
    ];
    let ly = metaY + 34;
    rowsMeta.forEach(([k, v]) => {
      doc.setTextColor(...BRAND.muted);
      doc.text(k, metaX + 14, ly);
      doc.setTextColor(...BRAND.text);
      doc.text(String(v), metaX + metaW - 14, ly, { align: "right", maxWidth: metaW - 270 });
      ly += 14;
    });

    // Info band
    const infoY = headerY + 56;

    // Choose a start below whichever is lower: info band or meta card → no overlap
    const startTableY = Math.max(infoY + 64, metaY + metaH + 16);

    // Clean "plain" table (no grid lines), zebra rows, bold header
    autoTable(doc, {
      startY: startTableY,
      theme: "plain",               // <-- removes borders/lines
      styles: {
        font: "helvetica",
        fontSize: 9,               // slightly smaller
        cellPadding: { top: 5, right: 7, bottom: 5, left: 7 },
        textColor: BRAND.text,
        lineWidth: 0               // no lines at all
      },
      headStyles: {
        fillColor: BRAND.th,
        textColor: 255,
        fontStyle: "bold",
        cellPadding: { top: 6, right: 7, bottom: 6, left: 7 }
      },
      alternateRowStyles: { fillColor: BRAND.zebra },
      columnStyles: {
        4: { halign: "left", cellWidth: 65 }, // Qty
        5: { halign: "left", cellWidth: 76 }, // Unit Cost
      },
      head: [[ "Description", "Move No.", "Item No.", "SKU", "Qty", "Unit Cost"]],
      body: filteredRows.map(r => [
        r.memo || r.itemSku || r.itemNo || "—",
        r.moveNo || r.reference || "—",
        r.itemNo || "—",
        r.itemSku || "—",
        Number(r.qty || 0).toLocaleString(),
        (Number(r.unitCost || 0)).toFixed(2),
        r.fromWhCode || "—",
        r.toWhCode || "—",
        String(r.status || "draft").toUpperCase(),
      ]),
      didDrawPage: (data) => {
        // Totals (right-aligned card look without borders)
        const y = Math.min(H - M.b - 78, (data.cursor?.y || startTableY) + 20);
        const labelW = 78;
        const valueW = 110;
        const rightX = M.l + contentW - (labelW + valueW + 2);

        // subtle divider
        doc.setDrawColor(...BRAND.primaryBorder);
        doc.setLineWidth(0.5);
        doc.line(rightX, y, M.l + contentW, y);

        const row = (label, value, bold = false, blue = false, dy = 12) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(bold ? 10.5 : 9);
          doc.setTextColor(...(blue ? BRAND.primary : BRAND.text));
          doc.text(label, rightX + labelW, y + dy, { align: "right" });
          doc.text(value, rightX + labelW + 2 + valueW, y + dy, { align: "right" });
          return dy + 20;
        };
        let dy = 12;
        dy = row("Subtotal", `${reportTotals.value.toFixed(2)}`, false, false, dy);
        dy = row("Total Qty", `${reportTotals.qty.toLocaleString()}`, false, false, dy);
        doc.setDrawColor(...BRAND.primaryBorder);
        doc.setLineWidth(0.5);
        doc.line(rightX, y + dy - 10, M.l + contentW, y + dy - 10);
        row("Total", `${reportTotals.value.toFixed(2)}`, true, true, dy + 6);

        // Footer with page number
        const footerY = H - M.b + 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.muted);
        const pageLabel = `${data.pageNumber}/${doc.internal.getNumberOfPages()}`;
        doc.text("Generated by ACTA ERP", M.l, footerY);
        doc.text(pageLabel, M.l + contentW, footerY, { align: "right" });
      }
    });

    const single = filters.dateFrom && (!filters.dateTo || filters.dateTo === filters.dateFrom);
    const fname = single
      ? `daily-report-${filters.dateFrom}.pdf`
      : `daily-report-${filters.dateFrom || "from"}_${filters.dateTo || "to"}.pdf`;
    doc.save(fname);
    showOk("PDF saved");
  };

  /* ----------------- UI ----------------- */
  return (
    <Stack spacing={2}>
      <Typography variant="h5">Stock Moves</Typography>

      {/* Create form */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>New Move</Typography>

        {/* Row 1: date, auto item no, auto SKU, qty, uom, cost */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small" type="date" label="Date" InputLabelProps={{ shrink: true }}
            value={move.date} onChange={e => setMove(s => ({ ...s, date: e.target.value }))}
          />
          <TextField
            size="small"
            label="Item No (auto)"
            value={previewItemNo}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 230 }}
          />
          <TextField
            size="small"
            label="SKU (auto)"
            value={previewItemSku}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 230 }}
          />
          <TextField
            size="small" type="number" label="Qty *" value={move.qty}
            onChange={e => setMove(s => ({ ...s, qty: e.target.value }))}
            inputProps={{ min: 0, step: "0.01" }}
          />
          <TextField size="small" label="UoM" value={move.uom}
            onChange={e => setMove(s => ({ ...s, uom: e.target.value }))} />
          <TextField
            size="small" type="number" label="Unit Cost" value={move.unitCost}
            onChange={e => setMove(s => ({ ...s, unitCost: e.target.value }))}
            inputProps={{ min: 0, step: "0.01" }}
          />
        </Stack>

        {/* Row 2: From, To, Prepared/Approved */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
          <Autocomplete
            size="small"
            options={whOptions}
            getOptionLabel={(o) => o?.label || ""}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            value={whOptions.find(o => o.code === move.fromWhCode) || null}
            onChange={(_, v) => setMove(s => ({ ...s, fromWhCode: v?.code || "" }))}
            renderInput={(p) => <TextField {...p} label="From (optional)" />}
            sx={{ minWidth: 240 }}
          />
          <Autocomplete
            size="small"
            options={whOptions}
            getOptionLabel={(o) => o?.label || ""}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            value={whOptions.find(o => o.code === move.toWhCode) || null}
            onChange={(_, v) => setMove(s => ({ ...s, toWhCode: v?.code || "" }))}
            renderInput={(p) => <TextField {...p} label="To (optional)" />}
            sx={{ minWidth: 240 }}
          />

          <Autocomplete
            freeSolo
            size="small"
            options={personNames}
            inputValue={preparedByInput}
            onInputChange={(_, v) => { setPreparedByInput(v); setMove(s => ({ ...s, preparedBy: v })); }}
            onChange={(_, v) => {
              const val = typeof v === "string" ? v : (v || "");
              setPreparedByInput(val);
              setMove(s => ({ ...s, preparedBy: val }));
            }}
            renderInput={(p) => <TextField {...p} label="Prepared By" />}
            sx={{ minWidth: 220 }}
          />
          <Autocomplete
            freeSolo
            size="small"
            options={personNames}
            inputValue={approvedByInput}
            onInputChange={(_, v) => { setApprovedByInput(v); setMove(s => ({ ...s, approvedBy: v })); }}
            onChange={(_, v) => {
              const val = typeof v === "string" ? v : (v || "");
              setApprovedByInput(val);
              setMove(s => ({ ...s, approvedBy: val }));
            }}
            renderInput={(p) => <TextField {...p} label="Approved By (optional)" />}
            sx={{ minWidth: 220 }}
          />
        </Stack>

        <TextField
          multiline minRows={2} fullWidth sx={{ mt: 1 }}
          size="small" label="Memo (optional)"
          value={move.memo} onChange={(e) => setMove(s => ({ ...s, memo: e.target.value }))}
        />
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={onCreate}
            disabled={!canCreate || busy}
          >
            Add Move
          </Button>
        </Stack>
      </Paper>

      {/* Daily Report Filters & Actions */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <FilterListIcon fontSize="small" />
          <Typography variant="subtitle1">Daily Report</Typography>
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small" type="date" label="From"
            InputLabelProps={{ shrink: true }}
            value={filters.dateFrom}
            onChange={(e)=>setFilters(f=>({...f, dateFrom:e.target.value}))}
          />
          <TextField
            size="small" type="date" label="To"
            InputLabelProps={{ shrink: true }}
            value={filters.dateTo}
            onChange={(e)=>setFilters(f=>({...f, dateTo:e.target.value}))}
          />
          <TextField
            size="small" label="Item / SKU contains"
            value={filters.itemQuery}
            onChange={(e)=>setFilters(f=>({...f, itemQuery:e.target.value}))}
            sx={{ minWidth: 220 }}
          />
          <TextField
            size="small" label="From (warehouse)"
            value={filters.fromWh}
            onChange={(e)=>setFilters(f=>({...f, fromWh:e.target.value}))}
            sx={{ minWidth: 180 }}
          />
          <Box flex={1} />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={()=>setPreviewOpen(true)}>
              Preview
            </Button>
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={exportPdf}
              color="primary"
            >
              Save PDF
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={onPostByDate}
              disabled={busy}
              title="Post all unposted moves for the From date"
            >
              Post All (date)
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* List */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Recent Moves</Typography>
          <Chip size="small" label={loading ? "Loading…" : `${filteredRows.length} rows`} />
        </Stack>
        <Divider sx={{ mb: 1 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Move No.</strong></TableCell>
              <TableCell><strong>Item No.</strong></TableCell>
              <TableCell><strong>Item SKU</strong></TableCell>
              <TableCell align="right"><strong>Qty</strong></TableCell>
              <TableCell align="right"><strong>Unit Cost</strong></TableCell>
              <TableCell><strong>From</strong></TableCell>
              <TableCell><strong>To</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((r) => (
              <TableRow key={r._id || r.id}>
                <TableCell>{fmtDate(r.date)}</TableCell>
                <TableCell>{r.moveNo || r.reference || "—"}</TableCell>
                <TableCell>{r.itemNo || "—"}</TableCell>
                <TableCell>{r.itemSku || "—"}</TableCell>
                <TableCell align="right">{Number(r.qty || 0).toLocaleString()}</TableCell>
                <TableCell align="right">{Number(r.unitCost || 0).toFixed(2)}</TableCell>
                <TableCell>{r.fromWhCode || "—"}</TableCell>
                <TableCell>{r.toWhCode || "—"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={r.status === "posted" ? "success" : r.status === "approved" ? "primary" : "default"}
                    label={r.status || "draft"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {/* Blue buttons */}
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<SendIcon fontSize="small" />}
                      onClick={() => onPost(r._id || r.id)}
                      disabled={r.status === "posted" || busy}
                      sx={{ minWidth: 90 }}
                    >
                      Post
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      onClick={() => onDelete(r._id || r.id)}
                      disabled={busy}
                      sx={{ minWidth: 90 }}
                    >
                      Delete
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Box sx={{ py: 2, color: "text.secondary" }}>No stock moves for current filters.</Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={()=>setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Daily Report Preview</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Date: {filters.dateFrom} {filters.dateTo && filters.dateTo !== filters.dateFrom ? `→ ${filters.dateTo}` : ""} •{" "}
            Item contains: {filters.itemQuery || "—"} • From: {filters.fromWh || "All"}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Move No.</strong></TableCell>
                <TableCell><strong>Item No.</strong></TableCell>
                <TableCell><strong>SKU</strong></TableCell>
                <TableCell align="right"><strong>Qty</strong></TableCell>
                <TableCell align="right"><strong>Unit Cost</strong></TableCell>
                <TableCell><strong>From</strong></TableCell>
                <TableCell><strong>To</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map(r => (
                <TableRow key={(r._id||r.id)+"-pv"}>
                  <TableCell>{r.memo || r.itemSku || r.itemNo || "—"}</TableCell>
                  <TableCell>{r.moveNo || r.reference || "—"}</TableCell>
                  <TableCell>{r.itemNo || "—"}</TableCell>
                  <TableCell>{r.itemSku || "—"}</TableCell>
                  <TableCell align="right">{Number(r.qty || 0).toLocaleString()}</TableCell>
                  <TableCell align="right">{Number(r.unitCost || 0).toFixed(2)}</TableCell>
                  <TableCell>{r.fromWhCode || "—"}</TableCell>
                  <TableCell>{r.toWhCode || "—"}</TableCell>
                  <TableCell>{String(r.status || "draft").toUpperCase()}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4}><strong>Totals</strong></TableCell>
                <TableCell align="right"><strong>{reportTotals.qty.toLocaleString()}</strong></TableCell>
                <TableCell align="right"><strong>{reportTotals.value.toFixed(2)}</strong></TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setPreviewOpen(false)}>Close</Button>
          <Button onClick={exportPdf} startIcon={<PictureAsPdfIcon />} variant="contained" color="secondary">
            Save PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toasts */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.kind === "error" ? "error" : "success"}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
