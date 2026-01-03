// client/src/pages/Inventory_ItemDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Stack, Typography, Button, Box, Chip, Divider, Table, TableHead,
  TableRow, TableCell, TableBody, TextField, IconButton, Tooltip, CircularProgress,
  Snackbar, Alert, Checkbox, FormControlLabel, MenuItem, Select, InputLabel,
  FormControl, TablePagination, Drawer, Grid, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SyncIcon from "@mui/icons-material/Sync";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LaunchIcon from "@mui/icons-material/Launch";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SouthIcon from "@mui/icons-material/South";  // Issue
import NorthIcon from "@mui/icons-material/North";  // Receive
import CloseIcon from "@mui/icons-material/Close";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";

import {
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  listStockMoves,
  deleteStockMove,
  createStockMove,
  postStockMove,
  listWarehouses,
} from "../api.js";

/* ---------------- helpers ---------------- */
const asItems = (x) => (Array.isArray(x?.items) ? x.items : Array.isArray(x) ? x : []);
const fmtNum  = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");
const nowHuman = () => new Date().toLocaleString();
const todayISO = () => new Date().toISOString().slice(0, 10);
const qtyColor = (n) => (n < 0 ? "error" : n === 0 ? "default" : "success");

/** Professional "Daily Journal"-style PDF (header/meta/blue title/ruled table/total row). */
function exportInventoryPDF(filename, rows) {
  // A4 landscape
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  // Brand + layout
  const BRAND = {
    org: "Acta Venture Partners Aps",
    addr: "Ravnsborg Tværgade 1, 1. 2200 København N • CVR 44427508",
    primary: [14, 76, 146],
    text: [33, 37, 41],
    gray: [110, 120, 140],
    th: [49, 93, 147],
    border: [210, 215, 223],
    zebra: [248, 250, 253],
  };

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // margins + extra right inset to bring content in from the edge
  const M = { l: 36, r: 36, t: 44, b: 44 };
  const RIGHT_INSET = 22; // <-- bring "Total" and page number inside a bit
  const RIGHT_X = W - M.r - RIGHT_INSET;

  const CONTENT_W = W - M.l - M.r;

  // helpers
  const nowStr = new Date().toLocaleString();
  const dateISO = new Date().toISOString().slice(0, 10);
  const sumOnHand = rows.reduce((s, r) => s + Number(r.onHand || 0), 0);
  const clamp = (s, n) => {
    const v = String(s || "");
    return v.length > n ? v.slice(0, n - 1) + "…" : v;
  };
  const perWhShort = (list, maxChars = 68) => {
    const s = (list || [])
      .map(p => `${p.wh}:${Number(p.qty || 0).toLocaleString()}`)
      .join("  •  ");
    return clamp(s, maxChars);
  };

  // header
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...BRAND.gray);
  doc.text(nowStr, M.l, M.t - 16);
  doc.text(`Inventory_Items_${dateISO}`, W / 2, M.t - 16, { align: "center" });

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...BRAND.primary);
  doc.text(BRAND.org, M.l, M.t);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...BRAND.gray);
  doc.text(BRAND.addr, M.l, M.t + 11);

  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...BRAND.text);
  doc.text("Inventory Items", RIGHT_X, M.t, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...BRAND.gray);
  doc.text(dateISO, RIGHT_X, M.t + 11, { align: "right" });
  doc.text(`Report No: INV-${dateISO}-001`, RIGHT_X, M.t + 22, { align: "right" });

  // section title (plain)
  const sectionY = M.t + 32;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...BRAND.text);
  doc.text("On-hand by Item (with Supplier & Per-Warehouse)", M.l, sectionY);

  // table
  const startY = sectionY + 14;

  // widths sum ≈ content width
  const widths = { date: 60, sku: 115, itemNo: 135, name: 160, supplier: 110, onhand: 60, perwh: 112 };

  autoTable(doc, {
    startY,
    theme: "grid",
    head: [[ "Date", "SKU", "Item No", "Name", "Supplier", "On-hand", "Per-Warehouse" ]],
    body: rows.map(r => ([
      r.lastMoveAt ? String(r.lastMoveAt).slice(0,10) : "",
      clamp(r.itemSku, 26),
      clamp(r.itemNo, 24),
      clamp(r.name, 34),
      clamp(r.lastSupplierName, 18),
      Number(r.onHand || 0).toLocaleString(),
      perWhShort(r.perWh, 56),
    ])),
    styles: {
      font: "helvetica",
      fontSize: 7.9,
      cellPadding: { top: 3.5, right: 5, bottom: 3.5, left: 5 },
      lineColor: BRAND.border,
      lineWidth: 0.45,
      textColor: BRAND.text,
      overflow: "line",
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND.th,
      textColor: 255,
      fontStyle: "bold",
      lineWidth: 0.45,
      lineColor: BRAND.border,
      fontSize: 8.6,
    },
    alternateRowStyles: { fillColor: BRAND.zebra },
    columnStyles: {
      0: { cellWidth: widths.date },
      1: { cellWidth: widths.sku },
      2: { cellWidth: widths.itemNo },
      3: { cellWidth: widths.name },
      4: { cellWidth: widths.supplier },
      5: { cellWidth: widths.onhand, halign: "right" },
      6: { cellWidth: widths.perwh },
    },
    didDrawPage: (data) => {
      // footer – page number also pulled inside using RIGHT_X
      const footerY = H - M.b + 14;
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...BRAND.gray);
      doc.text("Generated by ACTA ERP", M.l, footerY);
      doc.text(`${data.pageNumber}/${doc.internal.getNumberOfPages()}`, RIGHT_X, footerY, { align: "right" });
    }
  });

  // totals pulled inside using RIGHT_X
  const tb = doc.lastAutoTable.finalY + 5;
  doc.setDrawColor(...BRAND.border).setLineWidth(0.55);
  doc.line(RIGHT_X - 150, tb, RIGHT_X, tb);  // top rule above totals
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...BRAND.text);
  doc.text("Total", RIGHT_X - 88, tb + 12, { align: "right" });
  doc.text(sumOnHand.toLocaleString(), RIGHT_X - 6, tb + 12, { align: "right" });

  doc.save(filename);
}

/** Aggregate posted moves into on-hand by item & warehouse (supplier-safe) */
function buildOnHand(moves = []) {
  const isWarehouse = (code) => {
    const s = String(code || "").trim();
    return s && /^[A-Z0-9_-]{2,10}$/.test(s) && s === s.toUpperCase();
  };
  const byItem = new Map(); // sku -> { total, byWh: Map(wh->qty), lastMoveAt, supplier }
  for (const m of moves) {
    const sku = m.itemSku || m.sku || m.item || "";
    if (!sku) continue;
    const qty = Number(m.qty) || 0;
    const hasTo = !!(m.toWhCode && String(m.toWhCode).trim());
    const hasFrom = !!(m.fromWhCode && String(m.fromWhCode).trim());
    const fromIsWarehouse = hasFrom && isWarehouse(m.fromWhCode);
    const entry = byItem.get(sku) || { total: 0, byWh: new Map(), lastMoveAt: null, supplier: "" };

    // Signed qty
    const addPart = hasTo ? qty : 0;
    const subPart = fromIsWarehouse ? qty : 0;
    const signed = addPart - (hasTo ? (fromIsWarehouse ? qty : 0) : subPart);
    entry.total += signed;

    if (hasTo && isWarehouse(m.toWhCode)) {
      entry.byWh.set(m.toWhCode, (entry.byWh.get(m.toWhCode) || 0) + qty);
    }
    if (fromIsWarehouse) {
      entry.byWh.set(m.fromWhCode, (entry.byWh.get(m.fromWhCode) || 0) - qty);
    }

    // Latest supplier comes from the *From* side name when available; fallback to code.
    const supplierDisplay = (m.fromName && String(m.fromName).trim()) || (m.fromWhCode || "");
    const t = new Date(m.date || m.postedAt || m.createdAt || m.updatedAt || Date.now()).getTime();
    if (!entry.lastMoveAt || t > entry.lastMoveAt) {
      entry.lastMoveAt = t;
      entry.supplier = supplierDisplay; // keep the latest one
    }
    byItem.set(sku, entry);
  }

  const rows = [];
  for (const [sku, v] of byItem.entries()) {
    const perWh = [...v.byWh.entries()]
      .filter(([, q]) => q)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([wh, qty]) => ({ wh, qty }));
    rows.push({
      itemSku: sku,
      onHand: v.total,
      perWh,
      lastMoveAt: v.lastMoveAt ? new Date(v.lastMoveAt).toISOString() : null,
      lastSupplierName: v.supplier || ""
    });
  }
  rows.sort((a, b) => a.itemSku.localeCompare(b.itemSku));
  return rows;
}

/* ---------------- page ---------------- */
export default function InventoryItemDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [items, setItems] = useState([]);             // item master data (server may include lastSupplierName, onHand)
  const [postedMoves, setPostedMoves] = useState([]); // posted stock moves only
  const [warehouses, setWarehouses] = useState([]);

  // filters
  const [search, setSearch] = useState("");
  const [whFilter, setWhFilter] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");

  // selection
  const [selectedSkus, setSelectedSkus] = useState(new Set());
  const [alsoDeleteMoves, setAlsoDeleteMoves] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // inline edit state
  const [editDrafts, setEditDrafts] = useState({});
  const [busyRow, setBusyRow] = useState(null);

  // details drawer
  const [detailSku, setDetailSku] = useState(null);

  // quick move dialog
  const [moveDlg, setMoveDlg] = useState({ open: false, type: "receive", sku: "", qty: 1, wh: "", memo: "" });
  const closeMoveDlg = () => setMoveDlg(s => ({ ...s, open: false }));

  // toast
  const [toast, setToast] = useState({ open: false, kind: "success", msg: "" });
  const showOk  = (msg) => setToast({ open: true, kind: "success", msg });
  const showErr = (msg) => setToast({ open: true, kind: "error", msg });

  // paging & sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRpp] = useState(10);
  const [sort, setSort] = useState({ field: "itemSku", dir: "asc" });

  const refetch = async () => {
    setLoading(true);
    try {
      const [itemsRes, movesRes, whRes] = await Promise.all([
        listInventoryItems().catch(() => ({ items: [] })),
        listStockMoves({ status: "posted", limit: 5000 }).catch(() => ({ items: [] })),
        listWarehouses().catch(() => ({ items: [] })),
      ]);
      setItems(asItems(itemsRes));
      const moves = asItems(movesRes).filter((m) => (m.status || "").toLowerCase() === "posted");
      setPostedMoves(moves);
      setWarehouses(asItems(whRes).map(w => w.code || w.name).filter(Boolean));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refetch(); }, []);

  const onHandRows = useMemo(() => buildOnHand(postedMoves), [postedMoves]);

  // helper maps
  const bySkuItem = useMemo(() => new Map(items.map(i => [i.sku, i])), [items]);
  const bySkuOnHand = useMemo(() => new Map(onHandRows.map(r => [r.itemSku, r])), [onHandRows]);

  // merge enriched rows (ensure supplier filled from client calc if server missed it)
  const mergedRows = useMemo(() => {
    const skus = new Set([...bySkuItem.keys(), ...bySkuOnHand.keys()]);
    const rows = [];
    for (const sku of skus) {
      const it = bySkuItem.get(sku) || {};
      const oh = bySkuOnHand.get(sku) || { onHand: 0, perWh: [], lastMoveAt: null, lastSupplierName: "" };
      rows.push({
        itemSku: sku,
        _id: it._id || null,
        name: it.name || it.description || sku,
        itemNo: it.itemNo || `ITEM-${sku}`,
        uom: it.uom || "pcs",
        onHand: Number(oh.onHand || it.onHand || 0),
        perWh: oh.perWh || [],
        lastMoveAt: oh.lastMoveAt || it.lastMoveAt || null,
        lastSupplierName: it.lastSupplierName || oh.lastSupplierName || ""
      });
    }
    return rows;
  }, [bySkuItem, bySkuOnHand]);

  // warehouses (for filter)
  const allWhCodes = useMemo(() => {
    const set = new Set(warehouses);
    for (const r of onHandRows) r.perWh.forEach(p => set.add(p.wh));
    return Array.from(set).sort();
  }, [onHandRows, warehouses]);

  // filtering
  const filtered = useMemo(() => {
    return mergedRows.filter(r => {
      const matchesSearch =
        !search ||
        r.itemSku.toLowerCase().includes(search.toLowerCase()) ||
        (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.itemNo || "").toLowerCase().includes(search.toLowerCase());
      const matchesWh = !whFilter || (r.perWh || []).some(p => p.wh === whFilter);
      const qty = Number(r.onHand || 0);
      const matchesMin = (minQty === "" || qty >= Number(minQty));
      const matchesMax = (maxQty === "" || qty <= Number(maxQty));
      return matchesSearch && matchesWh && matchesMin && matchesMax;
    });
  }, [mergedRows, search, whFilter, minQty, maxQty]);

  // sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { field, dir } = sort;
    arr.sort((a, b) => {
      const av = a[field], bv = b[field];
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sort]);

  // pagination
  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  /* actions */
  const syncMissingItems = async () => {
    setSyncing(true);
    try {
      const existing = new Set(items.map(i => i.sku));
      const missing = onHandRows.map(r => r.itemSku).filter(sku => sku && !existing.has(sku));
      for (const sku of missing) {
        await createInventoryItem({ sku, name: sku, uom: "pcs", status: "active" });
      }
      await refetch();
      showOk("Items synced.");
    } catch (e) {
      showErr(e?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (sku) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  };
  const allSelected = paged.length > 0 && paged.every(r => selectedSkus.has(r.itemSku));
  const toggleSelectAll = () => {
    setSelectedSkus(prev => {
      if (allSelected) {
        const n = new Set(prev); paged.forEach(r => n.delete(r.itemSku)); return n;
      }
      const n = new Set(prev); paged.forEach(r => n.add(r.itemSku)); return n;
    });
  };

  const startEdit = (row) => {
    if (!row?._id) { showErr("No Item record yet. Click Sync Items first."); return; }
    setEditDrafts(d => ({ ...d, [row.itemSku]: { _id: row._id, name: row.name || "", itemNo: row.itemNo || "", uom: row.uom || "pcs" } }));
  };
  const cancelEdit = (sku) => setEditDrafts(d => { const c = { ...d }; delete c[sku]; return c; });
  const saveRow = async (sku) => {
    const draft = editDrafts[sku]; if (!draft?._id) return;
    setBusyRow(sku);
    try {
      await updateInventoryItem(draft._id, { sku, name: draft.name, itemNo: draft.itemNo, uom: draft.uom });
      await refetch(); cancelEdit(sku); showOk("Item updated.");
    } catch (e) { showErr(e?.message || "Update failed"); } finally { setBusyRow(null); }
  };

  const deleteMovesForSku = async (sku) => {
    const toDelete = postedMoves.filter((m) => (m.itemSku || m.sku) === sku);
    for (const m of toDelete) { try { await deleteStockMove(m._id || m.id); } catch {} }
  };

  const deleteOneRow = async (row) => {
    if (!row?._id && !alsoDeleteMoves) { showErr("This SKU has no Item record. Enable 'Also delete posted moves' to remove entirely."); return; }
    if (!window.confirm(`Delete "${row.itemSku}"?\n\n- Item record: ${row._id ? "YES" : "NO"}\n- Also delete posted moves: ${alsoDeleteMoves ? "YES" : "NO"}`)) return;
    setBusyRow(row.itemSku);
    try {
      if (row._id) await deleteInventoryItem(row._id);
      if (alsoDeleteMoves) await deleteMovesForSku(row.itemSku);
      await refetch(); setSelectedSkus(s => { const n = new Set(s); n.delete(row.itemSku); return n; });
      showOk("Row deleted.");
    } catch (e) { showErr(e?.message || "Delete failed"); } finally { setBusyRow(null); }
  };

  const bulkDelete = async () => {
    if (selectedSkus.size === 0) return showErr("Select at least one row to delete.");
    const list = [...selectedSkus];
    if (!window.confirm(`Delete ${list.length} selected SKU(s)?\n\nAlso delete posted moves: ${alsoDeleteMoves ? "YES" : "NO"}`)) return;
    setBulkDeleting(true);
    try {
      for (const sku of list) {
        const row = mergedRows.find(r => r.itemSku === sku);
        if (row?._id) { try { await deleteInventoryItem(row._id); } catch {} }
        if (alsoDeleteMoves) { await deleteMovesForSku(sku); }
      }
      await refetch(); setSelectedSkus(new Set()); showOk("Selected rows deleted.");
    } catch (e) {
      showErr(e?.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  // quick receive/issue
  const quickMove = async () => {
    const { type, sku, qty, wh, memo } = moveDlg;
    if (!sku || !qty || !wh) return;
    try {
      const payload = {
        date: todayISO(),
        qty: Math.abs(Number(qty)),
        uom: "pcs",
        unitCost: 0,
        itemSku: sku,
        itemNo: `ITEM-${sku}`,
        memo: memo || (type === "receive" ? "Quick Receive" : "Quick Issue"),
        status: "approved",
        fromWhCode: type === "issue"   ? wh : "",
        toWhCode:   type === "receive" ? wh : "",
      };
      const created = await createStockMove(payload);
      await postStockMove(created._id || created.id, { postedBy: "Quick Action" });
      showOk(`Quick ${type} posted`);
      closeMoveDlg();
      await refetch();
    } catch (e) { showErr(e?.message || "Quick move failed"); }
  };

  /* ---------- UI ---------- */
  return (
    <Stack spacing={2}>
      {/* Header + KPIs */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Inventory2Icon />
        <Typography variant="h5">Inventory Items</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="Search SKU, name or item no…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5 }} /> }}
          sx={{ minWidth: 280 }}
        />
        <Tooltip title="Reload">
          <span>
            <IconButton onClick={refetch} disabled={loading} color="primary">
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Ensure every SKU seen in moves has an Item master">
          <span>
            <Button startIcon={<SyncIcon />} onClick={syncMissingItems} disabled={syncing || loading} variant="outlined">
              Sync Items
            </Button>
          </span>
        </Tooltip>
        <Button startIcon={<LaunchIcon />} onClick={() => navigate("/inventory/stock-moves")} variant="contained">
          Open Stock Moves
        </Button>
      </Stack>

      {/* KPI bar */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Items</Typography>
          <Typography variant="h6">{mergedRows.length.toLocaleString()}</Typography>
        </Paper>
        <Paper sx={{ p: 1.25, borderRadius: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Total On-hand</Typography>
          <Typography variant="h6">
            {fmtNum(mergedRows.reduce((s, r) => s + Number(r.onHand || 0), 0))}
          </Typography>
        </Paper>
        <Paper sx={{ p: 1.25, borderRadius: 2, flex: 2 }}>
          <Typography variant="caption" color="text.secondary">Actions</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => exportInventoryPDF(`Inventory_Standard_${todayISO()}.pdf`, sorted)}
            >
              Export PDF
            </Button>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Warehouse</InputLabel>
              <Select
                label="Warehouse"
                value={whFilter}
                onChange={(e)=>{ setWhFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value=""><em>All</em></MenuItem>
                {allWhCodes.map(w => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              size="small" type="number" label="Min Qty" value={minQty}
              onChange={(e)=>{ setMinQty(e.target.value); setPage(0); }}
              sx={{ width: 110 }}
            />
            <TextField
              size="small" type="number" label="Max Qty" value={maxQty}
              onChange={(e)=>{ setMaxQty(e.target.value); setPage(0); }}
              sx={{ width: 110 }}
            />
          </Stack>
        </Paper>
      </Stack>

      {/* Bulk actions */}
      <Paper sx={{ p: 1.25, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <Chip label={`Selected: ${selectedSkus.size}`} size="small" />
          <FormControlLabel
            control={<Checkbox checked={alsoDeleteMoves} onChange={(e)=>setAlsoDeleteMoves(e.target.checked)} color="primary" />}
            label="Also delete posted moves"
          />
          <Tooltip title={selectedSkus.size ? `Delete ${selectedSkus.size} selected` : "Select rows to enable"}>
            <span>
              <Button
                color="primary"
                variant="contained"
                startIcon={<DeleteIcon />}
                onClick={bulkDelete}
                disabled={bulkDeleting || selectedSkus.size === 0}
              >
                {bulkDeleting ? "Deleting…" : `Bulk Delete`}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ p: 0, borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && selectedSkus.size > 0}
                  onChange={toggleSelectAll}
                  color="primary"
                />
              </TableCell>
              <TableCell onClick={()=>setSort(s=>({ field:"itemSku", dir: s.field==="itemSku" && s.dir==="asc" ? "desc":"asc" }))} sx={{ cursor: "pointer" }}>
                <strong>Item SKU</strong>
              </TableCell>
              <TableCell onClick={()=>setSort(s=>({ field:"name", dir: s.field==="name" && s.dir==="asc" ? "desc":"asc" }))} sx={{ cursor: "pointer" }}>
                <strong>Name</strong>
              </TableCell>
              <TableCell onClick={()=>setSort(s=>({ field:"itemNo", dir: s.field==="itemNo" && s.dir==="asc" ? "desc":"asc" }))} sx={{ cursor: "pointer" }}>
                <strong>Item No</strong>
              </TableCell>
              <TableCell align="right" onClick={()=>setSort(s=>({ field:"onHand", dir: s.field==="onHand" && s.dir==="asc" ? "desc":"asc" }))} sx={{ cursor: "pointer" }}>
                <strong>On-hand</strong>
              </TableCell>
              <TableCell><strong>Per-Warehouse</strong></TableCell>
              <TableCell onClick={()=>setSort(s=>({ field:"lastMoveAt", dir: s.field==="lastMoveAt" && s.dir==="asc" ? "desc":"asc" }))} sx={{ cursor: "pointer" }}>
                <strong>Last Move</strong>
              </TableCell>
              <TableCell><strong>Supplier</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((r) => {
              const editing = !!editDrafts[r.itemSku];
              const draft = editDrafts[r.itemSku] || {};
              const isSelected = selectedSkus.has(r.itemSku);

              return (
                <TableRow key={r.itemSku} hover selected={isSelected}>
                  <TableCell padding="checkbox">
                    <Checkbox color="primary" checked={isSelected} onChange={() => toggleSelect(r.itemSku)} />
                  </TableCell>

                  <TableCell sx={{ fontFamily: "monospace" }}>{r.itemSku}</TableCell>

                  <TableCell sx={{ minWidth: 220 }}>
                    {editing ? (
                      <TextField
                        size="small"
                        fullWidth
                        value={draft.name}
                        onChange={(e) => setEditDrafts((d) => ({ ...d, [r.itemSku]: { ...d[r.itemSku], name: e.target.value } }))}
                      />
                    ) : r.name}
                  </TableCell>

                  <TableCell sx={{ minWidth: 160 }}>
                    {editing ? (
                      <Stack direction="row" spacing={1}>
                        <TextField
                          size="small"
                          value={draft.itemNo}
                          onChange={(e) => setEditDrafts((d) => ({ ...d, [r.itemSku]: { ...d[r.itemSku], itemNo: e.target.value } }))}
                        />
                        <TextField
                          size="small"
                          sx={{ width: 84 }}
                          label="UoM"
                          value={draft.uom}
                          onChange={(e) => setEditDrafts((d) => ({ ...d, [r.itemSku]: { ...d[r.itemSku], uom: e.target.value } }))}
                        />
                      </Stack>
                    ) : r.itemNo}
                  </TableCell>

                  <TableCell align="right">
                    <Chip
                      size="small"
                      color={qtyColor(Number(r.onHand))}
                      label={fmtNum(r.onHand)}
                      variant={Number(r.onHand) === 0 ? "outlined" : "filled"}
                    />
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                      {r.perWh.length === 0 ? (
                        <Chip size="small" label="—" />
                      ) : r.perWh.map((w) => (
                        <Chip key={w.wh} size="small" variant="outlined" label={`${w.wh}: ${fmtNum(w.qty)}`} />
                      ))}
                    </Stack>
                  </TableCell>

                  <TableCell>{r.lastMoveAt ? fmtDate(r.lastMoveAt) : "—"}</TableCell>
                  <TableCell>
                    {r.lastSupplierName
                      ? <Chip size="small" color="secondary" variant="outlined" label={r.lastSupplierName} />
                      : "—"}
                  </TableCell>

                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="View details">
                        <IconButton size="small" color="primary" onClick={()=>setDetailSku(r.itemSku)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Quick receive">
                        <span>
                          <IconButton size="small" color="primary" onClick={()=>setMoveDlg({ open: true, type:"receive", sku: r.itemSku, qty: 1, wh: "", memo: "" })}>
                            <NorthIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Quick issue">
                        <span>
                          <IconButton size="small" color="primary" onClick={()=>setMoveDlg({ open: true, type:"issue", sku: r.itemSku, qty: 1, wh: "", memo: "" })}>
                            <SouthIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      {!editing ? (
                        <Tooltip title={r._id ? "Edit" : "Create item first (Sync Items)"}>
                          <span>
                            <IconButton color="primary" size="small" onClick={() => startEdit(r)} disabled={!r._id || busyRow === r.itemSku}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <>
                          <Tooltip title="Save">
                            <span>
                              <IconButton color="primary" size="small" onClick={() => saveRow(r.itemSku)} disabled={busyRow === r.itemSku}>
                                {busyRow === r.itemSku ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton size="small" onClick={() => cancelEdit(r.itemSku)} disabled={busyRow === r.itemSku}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}

                      <Tooltip title="Delete row">
                        <span>
                          <IconButton color="primary" size="small" onClick={() => deleteOneRow(r)} disabled={busyRow === r.itemSku}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Box sx={{ py: 2, color: "text.secondary" }}>No items match the current filters.</Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e)=>{ setRpp(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      {/* Details Drawer — compact, organized, includes Supplier */}
      <Drawer
        anchor="right"
        open={!!detailSku}
        onClose={()=>setDetailSku(null)}
        PaperProps={{ sx: { width: { xs: "100vw", sm: 480, md: 560 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Item Details</Typography>
            <IconButton onClick={()=>setDetailSku(null)}><CloseIcon /></IconButton>
          </Stack>

          {(() => {
            const row = mergedRows.find(r => r.itemSku === detailSku) || {};
            const recentMoves = postedMoves
              .filter(m => (m.itemSku || m.sku) === detailSku)
              .sort((a,b)=>new Date(b.date)-new Date(a.date))
              .slice(0, 12);

            const supplierFromMove = (m) =>
              (m.fromName && String(m.fromName).trim()) || (m.fromWhCode || "—");

            return (
              <>
                {/* Header card */}
                <Card
                  sx={{
                    mb: 2,
                    borderRadius: 2,
                    background: (t) => `linear-gradient(90deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
                    color: "primary.contrastText",
                  }}
                >
                  <CardContent>
                    <Typography variant="caption" sx={{ opacity: 0.95 }}>
                      {row.itemSku || "—"}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, mb: 1 }}>
                      {row.name || "—"}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      <Chip size="small" label={`On-hand: ${fmtNum(row.onHand)} ${row.uom || ""}`} sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "inherit" }} />
                      {row.itemNo && <Chip size="small" label={`Item No: ${row.itemNo}`} sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "inherit" }} />}
                      {row.lastSupplierName && <Chip size="small" color="secondary" label={`Supplier: ${row.lastSupplierName}`} sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "inherit" }} />}
                      {row.lastMoveAt && <Chip size="small" label={`Last Move: ${fmtDate(row.lastMoveAt)}`} sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "inherit" }} />}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Two-column facts */}
                <Grid container spacing={1.2} sx={{ mb: 1.5 }}>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">SKU</Typography>
                      <Typography variant="body1" sx={{ fontFamily: "monospace" }}>{row.itemSku || "—"}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Item No</Typography>
                      <Typography variant="body1">{row.itemNo || "—"}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Supplier</Typography>
                      <Typography variant="body1">{row.lastSupplierName || "—"}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">On-hand</Typography>
                      <Typography variant="body1">{fmtNum(row.onHand)} {row.uom || ""}</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Per-warehouse */}
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Per-Warehouse</Typography>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", mb: 1.5 }}>
                  {(row.perWh || []).length === 0 ? <Chip size="small" label="—" /> :
                    row.perWh.map(w => <Chip key={w.wh} size="small" variant="outlined" label={`${w.wh}: ${fmtNum(w.qty)}`} />)}
                </Stack>

                {/* Recent moves */}
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Recent Posted Moves</Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Move No</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell>From (Supplier)</TableCell>
                        <TableCell>To</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentMoves.map(m => (
                        <TableRow key={m._id || m.id}>
                          <TableCell>{fmtDate(m.date)}</TableCell>
                          <TableCell>{m.moveNo || "—"}</TableCell>
                          <TableCell align="right">{fmtNum(m.qty)}</TableCell>
                          <TableCell>{(m.fromName && String(m.fromName).trim()) || (m.fromWhCode || "—")}</TableCell>
                          <TableCell>{m.toWhCode || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {recentMoves.length === 0 && (
                        <TableRow><TableCell colSpan={5} align="center">No moves yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Paper>
              </>
            );
          })()}
        </Box>
      </Drawer>

      {/* Quick Receive/Issue Dialog */}
      <Dialog open={moveDlg.open} onClose={closeMoveDlg}>
        <DialogTitle>{moveDlg.type === "receive" ? "Quick Receive" : "Quick Issue"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField margin="dense" fullWidth label="SKU" value={moveDlg.sku} InputProps={{ readOnly: true }} />
          <TextField
            margin="dense" fullWidth type="number" label="Quantity" value={moveDlg.qty}
            onChange={(e)=>setMoveDlg(s=>({ ...s, qty: e.target.value }))}
            inputProps={{ min: 0, step: "0.01" }}
          />
          <FormControl margin="dense" fullWidth>
            <InputLabel>Warehouse</InputLabel>
            <Select
              label="Warehouse"
              value={moveDlg.wh}
              onChange={(e)=>setMoveDlg(s=>({ ...s, wh: e.target.value }))}
            >
              {allWhCodes.map(w => <MenuItem key={w} value={w}>{w}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField margin="dense" fullWidth label="Memo (optional)" value={moveDlg.memo} onChange={(e)=>setMoveDlg(s=>({ ...s, memo: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMoveDlg}>Cancel</Button>
          <Button variant="contained" onClick={quickMove}>
            {moveDlg.type === "receive" ? "Receive & Post" : "Issue & Post"}
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
