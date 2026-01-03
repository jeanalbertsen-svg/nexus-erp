// client/src/pages/Inventory.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper, Stack, Box, Typography, Button, Divider, IconButton,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody, Chip,
  Autocomplete, Tooltip, Grid, InputAdornment, CircularProgress
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

// Process icons
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import InventoryIcon from "@mui/icons-material/Inventory";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import MoveDownIcon from "@mui/icons-material/MoveDown";
import UpdateIcon from "@mui/icons-material/Update";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";

/* ---------------- Utils ---------------- */
const money = (n) =>
  (Number(n) || 0).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = (n) => (Number(n) || 0).toLocaleString("da-DK");
const todayISO = () => new Date().toISOString().slice(0, 10);
const yyyymmdd = (dStr) => {
  const d = new Date(dStr || new Date());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};
/* ---- daily sequence helpers (persisted in localStorage) ---- */
const nextSeqFor = (prefix, dateISO) => {
  const key = `inv.seq.${prefix}.${yyyymmdd(dateISO)}`;
  let n = 0;
  try {
    n = Number(localStorage.getItem(key) || "0");
    n += 1;
    localStorage.setItem(key, String(n));
  } catch {}
  return n;
};
const generateDocNo = (prefix, dateISO) =>
  `${prefix}-${yyyymmdd(dateISO)}-${String(nextSeqFor(prefix, dateISO)).padStart(4, "0")}`;
const generateRef = (prefix, dateISO) => generateDocNo(prefix, dateISO);

/* >>> itemNo & SKU generators */
const generateItemNo = (dateISO) => generateDocNo("ITEM", dateISO);
const generateSku = (dateISO) => generateDocNo("SKU", dateISO);

/* ---------------------- Columns ---------------------- */
const COLS = {
  items: [
    { key: "itemNo", label: "Item No.", width: 160 },
    { key: "sku", label: "SKU", width: 140 },
    { key: "name", label: "Name" },
    { key: "uom", label: "UoM", width: 80 },
    { key: "onHand", label: "On Hand", width: 120, align: "right", fmt: qtyFmt },
    { key: "cost", label: "Cost", width: 120, align: "right", fmt: money },
    { key: "price", label: "Price", width: 120, align: "right", fmt: money },
    {
      key: "isActive",
      label: "Active",
      width: 90,
      render: (v) => (
        <Chip size="small" label={v ? "Yes" : "No"} color={v ? "success" : "default"} />
      ),
    },
  ],

  "stock-moves": [
    { key: "date", label: "Date", width: 120, render: (v) => String(v).slice(0, 10) },
    { key: "itemNo", label: "Item No.", width: 160 },
    { key: "moveNo", label: "Move No.", width: 160 },
    { key: "reference", label: "Reference", width: 160 },
    { key: "itemSku", label: "Item (SKU)" },
    { key: "qty", label: "Qty", width: 100, align: "right", fmt: qtyFmt },
    { key: "unitCost", label: "Unit Cost", width: 120, align: "right", fmt: money },
    { key: "fromWhCode", label: "From", width: 120 },
    { key: "toWhCode", label: "To", width: 120 },
    {
      key: "status",
      label: "Status",
      width: 110,
      render: (v) => (
        <Chip
          size="small"
          icon={v === "posted" ? <CheckCircleIcon /> : undefined}
          label={String(v || "draft").toUpperCase()}
          color={v === "posted" ? "success" : v === "approved" ? "info" : "default"}
          variant={v === "posted" ? "filled" : "outlined"}
        />
      ),
    },
  ],

  adjustments: [
    { key: "date", label: "Date", width: 120, render: (v) => String(v).slice(0, 10) },
    { key: "itemNo", label: "Item No.", width: 160 },
    { key: "adjNo", label: "Adj No.", width: 160 },
    { key: "reference", label: "Reference", width: 160 },
    { key: "itemSku", label: "Item (SKU)" },
    { key: "warehouseCode", label: "Warehouse", width: 140 },
    { key: "qtyDelta", label: "Δ Qty", width: 110, align: "right", fmt: qtyFmt },
    { key: "unitCost", label: "Unit Cost", width: 120, align: "right", fmt: money },
    { key: "reason", label: "Reason" },
    {
      key: "status",
      label: "Status",
      width: 110,
      render: (v) => (
        <Chip
          size="small"
          icon={v === "posted" ? <CheckCircleIcon /> : undefined}
          label={String(v || "draft").toUpperCase()}
          color={v === "posted" ? "success" : v === "approved" ? "info" : "default"}
          variant={v === "posted" ? "filled" : "outlined"}
        />
      ),
    },
  ],

  warehouses: [
    { key: "itemNo", label: "Item No.", width: 160 },
    { key: "code", label: "Code", width: 140 },
    { key: "name", label: "Name" },
    {
      key: "isDefault",
      label: "Default",
      width: 100,
      render: (v) => (
        <Chip size="small" label={v ? "Yes" : "No"} color={v ? "success" : "default"} />
      ),
    },
    {
      key: "isActive",
      label: "Active",
      width: 100,
      render: (v) => (
        <Chip size="small" label={v ? "Yes" : "No"} color={v ? "success" : "default"} />
      ),
    },
  ],
};

const HEAD = {
  items: { title: "Items / Products", add: "New Item" },
  "stock-moves": { title: "Stock Moves", add: "New Move" },
  adjustments: { title: "Stock Adjustments", add: "New Adjustment" },
  warehouses: { title: "Warehouses", add: "New Warehouse" },
};

/* ------------------------ Section defaults ------------------------ */
const defaultBySection = {
  items: () => ({
    itemNo: generateItemNo(todayISO()),
    sku: generateSku(todayISO()), // << auto SKU
    name: "",
    description: "",
    uom: "pcs",
    cost: 0,
    price: 0,
    onHand: 0,
    isActive: true,
  }),
  "stock-moves": () => ({
    itemNo: generateItemNo(todayISO()),
    date: todayISO(),
    reference: "",
    moveNo: "",
    itemId: null,
    itemSku: "",
    qty: 0,
    uom: "pcs",
    unitCost: 0,
    fromWhId: null,
    fromWhCode: "",
    toWhId: null,
    toWhCode: "",
    status: "draft",
    memo: "",
    participants: {
      preparedBy: { name: "", at: null },
      approvedBy: { name: "", at: null },
      postedBy: { name: "", at: null },
    },
  }),
  adjustments: () => ({
    itemNo: generateItemNo(todayISO()),
    date: todayISO(),
    reference: "",
    adjNo: "",
    itemId: null,
    itemSku: "",
    warehouseId: null,
    warehouseCode: "",
    qtyDelta: 0,
    unitCost: 0,
    reason: "",
    status: "draft",
    memo: "",
    participants: {
      preparedBy: { name: "", at: null },
      approvedBy: { name: "", at: null },
      postedBy: { name: "", at: null },
    },
  }),
  warehouses: () => ({
    itemNo: generateItemNo(todayISO()),
    code: "",
    name: "",
    isDefault: false,
    isActive: true,
  }),
};

/* ----------------------- Minimal validation ---------------------- */
function validate(section, obj) {
  if (section === "items") {
    if (!obj.itemNo?.trim()) throw new Error("Item No is required");
    if (!obj.sku?.trim()) throw new Error("SKU is required");
    if (!obj.name?.trim()) throw new Error("Name is required");
  } else if (section === "stock-moves") {
    if (!obj.itemNo?.trim()) throw new Error("Item No is required");
    if (!obj.date) throw new Error("Date is required");
    if (!(obj.itemSku?.trim() || obj.itemId)) throw new Error("Item SKU (or itemId) is required");
    if (!Number(obj.qty)) throw new Error("Qty must be > 0");
    if (!obj.fromWhCode && !obj.toWhCode && !obj.fromWhId && !obj.toWhId) {
      throw new Error("Specify From and/or To warehouse");
    }
  } else if (section === "adjustments") {
    if (!obj.itemNo?.trim()) throw new Error("Item No is required");
    if (!obj.date) throw new Error("Date is required");
    if (!(obj.itemSku?.trim() || obj.itemId)) throw new Error("Item SKU (or itemId) is required");
    if (!(obj.warehouseCode?.trim() || obj.warehouseId)) throw new Error("Warehouse Code (or warehouseId) is required");
    if (!Number(obj.qtyDelta)) throw new Error("Qty Delta must be non-zero");
  } else if (section === "warehouses") {
    if (!obj.itemNo?.trim()) throw new Error("Item No is required");
    if (!obj.code?.trim()) throw new Error("Warehouse code is required");
    if (!obj.name?.trim()) throw new Error("Warehouse name is required");
  }
}

/* ---------- Process Step card (styled to match “glass” vibe) ---------- */
function StepCard({ n, icon, title, hint, actionLabel, onAction }) {
  return (
    <Paper
      elevation={0}
      sx={{
        minWidth: 220,
        p: 2,
        borderRadius: 3,
        background: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,.03)" : "#fff"),
        border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.15)}`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box
          sx={{
            width: 28, height: 28, borderRadius: "50%",
            bgcolor: (t) => t.palette.primary.main, color: "#fff",
            fontWeight: 700, fontSize: 13, display: "grid", placeItems: "center"
          }}
        >
          {n}
        </Box>
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box sx={{ color: (t) => t.palette.primary.main }}>{icon}</Box>
        <Typography variant="body2" color="text.secondary">{hint}</Typography>
      </Box>
      {onAction && (
        <Button size="small" variant="outlined" onClick={onAction}>
          {actionLabel || "Open"}
        </Button>
      )}
    </Paper>
  );
}

/* ============================= Component ============================== */
export default function InventoryPage({ section = "items", api }) {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");

  /* People */
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
  const preparers = useMemo(() => people.filter((p) => p.roles?.includes("prepare")).map((p) => p.name), [people]);
  const approvers = useMemo(() => people.filter((p) => p.roles?.includes("approve")).map((p) => p.name), [people]);
  const posters = useMemo(() => people.filter((p) => p.roles?.includes("post")).map((p) => p.name), [people]);

  const cols = COLS[section] || [];
  const head = HEAD[section] || { title: "Inventory", add: "New" };

  /* ------------------------------- Load ------------------------------- */
  const load = async () => {
    try {
      setLoading(true);
      const listFn = api?.list;
      if (!listFn) {
        setRows([]);
        return;
      }
      const resp = await listFn();
      const data = Array.isArray(resp) ? resp : resp?.data || [];
      setRows(data);
    } catch (e) {
      console.error("[Inventory] load failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [section]);

  /* ----------------------------- Filtering ---------------------------- */
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, filter]);
  /* --------------------------- CRUD helpers --------------------------- */
  const openNew = () => {
    const base = defaultBySection[section]?.() || {};
    // ensure section-specific doc numbers happen at creation
    if (section === "stock-moves") {
      const date = base.date || todayISO();
      base.moveNo = base.moveNo || generateDocNo("MOVE", date);
      base.reference = base.reference || generateRef("MOVE", date);
    } else if (section === "adjustments") {
      const date = base.date || todayISO();
      base.adjNo = base.adjNo || generateDocNo("ADJ", date);
      base.reference = base.reference || generateRef("ADJ", date);
    } else if (section === "items") {
      base.sku = base.sku || generateSku(todayISO());
    }
    setEditing(base);
    setDlgOpen(true);
  };

  const openEdit = (row) => {
    const e = { ...row };
    // backfill numbers for legacy rows
    if (!e.itemNo) e.itemNo = generateItemNo((e.date || "").slice(0, 10) || todayISO());
    if (section === "items" && !e.sku) e.sku = generateSku(todayISO());

    const date = (e.date || "").slice(0, 10) || todayISO();
    if (section === "stock-moves") {
      if (!e.moveNo) e.moveNo = generateDocNo("MOVE", date);
      if (!e.reference) e.reference = generateRef("MOVE", date);
      e.participants = e.participants || {
        preparedBy: { name: e.preparedByName || "" },
        approvedBy: { name: e.approvedByName || "" },
        postedBy: { name: e.postedByName || "" },
      };
    } else if (section === "adjustments") {
      if (!e.adjNo) e.adjNo = generateDocNo("ADJ", date);
      if (!e.reference) e.reference = generateRef("ADJ", date);
      e.participants = e.participants || {
        preparedBy: { name: e.preparedByName || "" },
        approvedBy: { name: e.approvedByName || "" },
        postedBy: { name: e.postedByName || "" },
      };
    }
    setEditing(e);
    setDlgOpen(true);
  };

  const removeRow = async (idOrRow) => {
    if (!api?.remove) return;
    const id = typeof idOrRow === "string" ? idOrRow : idOrRow?._id || idOrRow?.id;
    if (!id) return;
    if (!window.confirm("Delete this record?")) return;
    await api.remove(id);
    await load();
  };

  const postRow = async (row) => {
    if (!api?.post) return;
    const id = row?._id || row?.id;
    if (!id) return;
    await api.post(id, { postedBy: "UI" });
    await load();
  };

  const save = async () => {
    try {
      const e = editing || {};
      validate(section, e);
      const hasId = !!(e._id || e.id);
      const nowIso = new Date().toISOString();

      let payload = { ...e };
      if (section === "stock-moves") {
        let participants = e.participants || {};
        if (!hasId && participants?.preparedBy?.name) {
          participants = { ...participants, preparedBy: { name: participants.preparedBy.name, at: nowIso } };
        }
        if (e.status === "approved" && participants?.approvedBy?.name && !participants?.approvedBy?.at) {
          participants.approvedBy.at = nowIso;
        }
        if (e.status === "posted" && participants?.postedBy?.name && !participants?.postedBy?.at) {
          participants.postedBy.at = nowIso;
        }

        payload = {
          itemNo: e.itemNo || generateItemNo(e.date || todayISO()),
          date: e.date,
          reference: e.reference || generateRef("MOVE", e.date || todayISO()),
          moveNo: e.moveNo || generateDocNo("MOVE", e.date || todayISO()),
          itemId: e.itemId || undefined,
          itemSku: e.itemSku?.trim() || undefined,
          qty: Number(e.qty) || 0,
          uom: e.uom || "pcs",
          unitCost: Number(e.unitCost) || 0,
          fromWhId: e.fromWhId || undefined,
          fromWhCode: e.fromWhCode?.trim() || undefined,
          toWhId: e.toWhId || undefined,
          toWhCode: e.toWhCode?.trim() || undefined,
          status: e.status || "draft",
          memo: e.memo || "",
          participants,
          preparedByName: participants?.preparedBy?.name || "",
          approvedByName: participants?.approvedBy?.name || "",
          postedByName: participants?.postedBy?.name || "",
          preparedAt: participants?.preparedBy?.at || undefined,
          approvedAt: participants?.approvedBy?.at || undefined,
          postedAt: participants?.postedBy?.at || undefined,
        };
      } else if (section === "adjustments") {
        let participants = e.participants || {};
        if (!hasId && participants?.preparedBy?.name) {
          participants = { ...participants, preparedBy: { name: participants.preparedBy.name, at: nowIso } };
        }
        if (e.status === "approved" && participants?.approvedBy?.name && !participants?.approvedBy?.at) {
          participants.approvedBy.at = nowIso;
        }
        if (e.status === "posted" && participants?.postedBy?.name && !participants?.postedBy?.at) {
          participants.postedBy.at = nowIso;
        }

        payload = {
          itemNo: e.itemNo || generateItemNo(e.date || todayISO()),
          date: e.date,
          reference: e.reference || generateRef("ADJ", e.date || todayISO()),
          adjNo: e.adjNo || generateDocNo("ADJ", e.date || todayISO()),
          itemId: e.itemId || undefined,
          itemSku: e.itemSku?.trim() || undefined,
          warehouseId: e.warehouseId || undefined,
          warehouseCode: e.warehouseCode?.trim() || undefined,
          qtyDelta: Number(e.qtyDelta) || 0,
          unitCost: Number(e.unitCost) || 0,
          reason: e.reason || "",
          status: e.status || "draft",
          memo: e.memo || "",
          participants,
          preparedByName: participants?.preparedBy?.name || "",
          approvedByName: participants?.approvedBy?.name || "",
          postedByName: participants?.postedBy?.name || "",
          preparedAt: participants?.preparedBy?.at || undefined,
          approvedAt: participants?.approvedBy?.at || undefined,
          postedAt: participants?.postedBy?.at || undefined,
        };
      } else if (section === "items") {
        payload = {
          itemNo: e.itemNo || generateItemNo(todayISO()),
          sku: e.sku?.trim() || generateSku(todayISO()),
          name: e.name?.trim(),
          description: e.description || "",
          uom: e.uom || "pcs",
          cost: Number(e.cost) || 0,
          price: Number(e.price) || 0,
          onHand: Number(e.onHand) || 0,
          isActive: !!e.isActive,
        };
      } else if (section === "warehouses") {
        payload = {
          itemNo: e.itemNo || generateItemNo(todayISO()),
          code: e.code?.trim(),
          name: e.name?.trim(),
          isDefault: !!e.isDefault,
          isActive: !!e.isActive,
        };
      }

      if (hasId) {
        if (api?.update) await api.update(e._id || e.id, payload);
      } else {
        if (api?.create) await api.create(payload);
      }

      setDlgOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      alert(err?.message || "Validation / Save failed");
    }
  };

  /* ----------------------------- CSV Export --------------------------- */
  const exportCSV = () => {
    const colsToUse = cols;
    const header = colsToUse.map((c) => `"${c.label}"`).join(",");
    const lines = filtered.map((r) =>
      colsToUse
        .map((c) => {
          const raw = r[c.key];
          const v = c.render
            ? (c.fmt ? c.fmt(raw, r) : raw ?? "")
            : c.fmt
            ? c.fmt(raw, r)
            : raw ?? "";
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${section}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* -------------------------------- UI -------------------------------- */
  return (
    <Stack spacing={2}>
      {/* Inventory Management Process */}
      <Paper
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,.03)" : "#fff"),
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.15)}`,
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Inventory Management Process</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(8, minmax(220px,1fr))",
            gap: 1.5,
            overflowX: { xs: "auto", md: "visible" },
            pb: { xs: 1, md: 0 },
          }}
        >
          <StepCard
            n={1}
            icon={<LocalShippingIcon />}
            title="Goods are Delivered"
            hint="Receive inbound stock"
            actionLabel="New Receipt"
            onAction={() => navigate("/inventory/stock-moves")}
          />
          <StepCard
            n={2}
            icon={<FactCheckIcon />}
            title="Reviewed & Stored"
            hint="Sort and put-away to warehouse"
            actionLabel="Record Move"
            onAction={() => navigate("/inventory/stock-moves")}
          />
          <StepCard
            n={3}
            icon={<InventoryIcon />}
            title="Levels Monitored"
            hint="Track on-hand by SKU & wh"
            actionLabel="View Items"
            onAction={() => navigate("/inventory/items")}
          />
          <StepCard
            n={4}
            icon={<ShoppingCartIcon />}
            title="Orders Placed"
            hint="Create purchase requisitions"
            actionLabel="Go Purchasing"
            onAction={() => navigate("/purchasing")}
          />
          <StepCard
            n={5}
            icon={<TaskAltIcon />}
            title="Orders Approved"
            hint="Approve supplier orders"
            actionLabel="Approve POs"
            onAction={() => navigate("/purchasing/purchase-orders")}
          />
          <StepCard
            n={6}
            icon={<MoveDownIcon />}
            title="Goods Issued"
            hint="Pick/issue to jobs or sales"
            actionLabel="Issue Stock"
            onAction={() => navigate("/inventory/stock-moves")}
          />
          <StepCard
            n={7}
            icon={<UpdateIcon />}
            title="Levels Updated"
            hint="Post moves/adjustments"
            actionLabel="Post Moves"
            onAction={() => navigate("/inventory/stock-moves")}
          />
          <StepCard
            n={8}
            icon={<TrendingDownIcon />}
            title="Low Stock → Buy"
            hint="Reorder via purchasing"
            actionLabel="Create RFQ"
            onAction={() => navigate("/purchasing/rfqs")}
          />
        </Box>
      </Paper>

      {/* Header bar */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
        >
          <Typography variant="h6" sx={{ flex: 1 }}>
            {head.title}
          </Typography>

          <TextField
            size="small"
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ width: { xs: "100%", sm: 300 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: filter ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setFilter("")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />

          <Tooltip title="Export visible rows to CSV">
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportCSV}>
              Export
            </Button>
          </Tooltip>

          <Tooltip title={head.add}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
              {head.add}
            </Button>
          </Tooltip>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              minWidth: 960,
              "& thead th": {
                position: "sticky",
                top: 0,
                zIndex: 1,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                borderBottom: (t) => `1px solid ${t.palette.divider}`,
                backdropFilter: "saturate(140%) blur(2px)",
              },
              "& tbody tr:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
            }}
          >
            <TableHead>
              <TableRow>
                {cols.map((c) => (
                  <TableCell key={c.key} align={c.align} sx={{ width: c.width }}>
                    {c.label}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ width: 160 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={cols.length + 1} align="center">
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">Loading…</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                filtered.map((r, idx) => (
                  <TableRow
                    key={r._id || r.id || idx}
                    sx={{
                      "& td": { borderColor: (t) => alpha(t.palette.divider, 0.9) },
                      ...(r.status === "posted"
                        ? { bgcolor: (t) => alpha(t.palette.success.main, t.palette.mode === "dark" ? 0.06 : 0.04) }
                        : null),
                    }}
                  >
                    {cols.map((c) => (
                      <TableCell key={c.key} align={c.align}>
                        {c.render
                          ? c.render(r[c.key], r)
                          : c.fmt
                          ? c.fmt(r[c.key], r)
                          : r[c.key] ?? ""}
                      </TableCell>
                    ))}
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {api?.post && r.status !== "posted" && (
                          <Tooltip title="Post">
                            <span>
                              <IconButton size="small" onClick={() => postRow(r)}>
                                <CheckCircleIcon color="success" fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {(api?.update || api?.get) && (
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(r)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {api?.remove && (
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => removeRow(r)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={cols.length + 1} align="center">
                    <Typography color="text.secondary">No records</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Create / Edit dialog */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editing?.id || editing?._id ? "Edit" : "Create"} — {head.title}
        </DialogTitle>
        <DialogContent dividers>
          {/* ITEMS FORM */}
          {section === "items" && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Item Details</Typography>

              <TextField
                label="Item No."
                value={editing?.itemNo || ""}
                onChange={(e) => setEditing((s) => ({ ...s, itemNo: e.target.value }))}
                helperText="Auto-generated; editable"
                fullWidth
              />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SKU"
                    value={editing?.sku || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, sku: e.target.value }))}
                    placeholder="Auto-generated; editable"
                    helperText="Internal product code for your operations"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Name"
                    value={editing?.name || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Item name"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Description"
                    value={editing?.description || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))}
                    multiline
                    minRows={2}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="UoM"
                    value={editing?.uom || "pcs"}
                    onChange={(e) => setEditing((s) => ({ ...s, uom: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Cost"
                    type="number"
                    inputProps={{ min: 0, step: "0.01", style: { textAlign: "right" } }}
                    value={editing?.cost ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, cost: Number(e.target.value) }))}
                    fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start">kr</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Price"
                    type="number"
                    inputProps={{ min: 0, step: "0.01", style: { textAlign: "right" } }}
                    value={editing?.price ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, price: Number(e.target.value) }))}
                    fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start">kr</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="On Hand (optional seed)"
                    type="number"
                    inputProps={{ step: "1", style: { textAlign: "right" } }}
                    value={editing?.onHand ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, onHand: Number(e.target.value) }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={["true", "false"]}
                    value={String(!!editing?.isActive)}
                    onChange={(_, v) => setEditing((s) => ({ ...s, isActive: v === "true" }))}
                    renderInput={(p) => <TextField {...p} label="Active" fullWidth />}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}

          {/* STOCK MOVES FORM */}
          {section === "stock-moves" && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Header</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Date"
                    type="date"
                    value={(editing?.date || "").slice(0, 10)}
                    onChange={(e) => {
                      const date = e.target.value;
                      setEditing((s) => ({
                        ...s,
                        date,
                        moveNo: s?.id || s?._id ? s.moveNo : (s.moveNo || generateDocNo("MOVE", date)),
                        reference: s?.id || s?._id ? s.reference : (s.reference || generateRef("MOVE", date)),
                      }));
                    }}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Move No."
                    value={editing?.moveNo || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, moveNo: e.target.value }))}
                    helperText="Auto-generated; editable"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Reference"
                    value={editing?.reference || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, reference: e.target.value }))}
                    helperText="Auto-generated if empty"
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Divider />

              <Typography variant="subtitle2" color="text.secondary">Move Details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Item SKU (or set itemId)"
                    value={editing?.itemSku || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, itemSku: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Qty"
                    type="number"
                    inputProps={{ step: "1", style: { textAlign: "right" } }}
                    value={editing?.qty ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, qty: Number(e.target.value) }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Unit Cost"
                    type="number"
                    inputProps={{ min: 0, step: "0.01", style: { textAlign: "right" } }}
                    value={editing?.unitCost ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, unitCost: Number(e.target.value) }))}
                    fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start">kr</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="From Warehouse Code"
                    value={editing?.fromWhCode || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, fromWhCode: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="To Warehouse Code"
                    value={editing?.toWhCode || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, toWhCode: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Memo"
                    value={editing?.memo || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, memo: e.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Line Total:
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {money((Number(editing?.qty) || 0) * (Number(editing?.unitCost) || 0))}
                </Typography>
              </Stack>

              <Divider />

              <Typography variant="subtitle2" color="text.secondary">Workflow</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={preparers.length ? preparers : peopleAllNames}
                    loading={peopleLoading}
                    value={editing?.participants?.preparedBy?.name || ""}
                    onChange={(_, v) =>
                      setEditing((s) => ({
                        ...s,
                        participants: {
                          ...(s.participants || {}),
                          preparedBy: { ...(s.participants?.preparedBy || {}), name: v || "" },
                        },
                      }))
                    }
                    renderInput={(p) => <TextField {...p} label="Prepared by" placeholder="Select" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={approvers.length ? approvers : peopleAllNames}
                    loading={peopleLoading}
                    value={editing?.participants?.approvedBy?.name || ""}
                    onChange={(_, v) =>
                      setEditing((s) => ({
                        ...s,
                        participants: {
                          ...(s.participants || {}),
                          approvedBy: { ...(s.participants?.approvedBy || {}), name: v || "" },
                        },
                      }))
                    }
                    renderInput={(p) => <TextField {...p} label="Approved by" placeholder="Select" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={posters.length ? posters : peopleAllNames}
                    loading={peopleLoading}
                    value={editing?.participants?.postedBy?.name || ""}
                    onChange={(_, v) =>
                      setEditing((s) => ({
                        ...s,
                        participants: {
                          ...(s.participants || {}),
                          postedBy: { ...(s.participants?.postedBy || {}), name: v || "" },
                        },
                      }))
                    }
                    renderInput={(p) => <TextField {...p} label="Posted by" placeholder="Select" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={["draft", "approved", "posted"]}
                    value={editing?.status || "draft"}
                    onChange={(_, v) => setEditing((s) => ({ ...s, status: v || "draft" }))}
                    renderInput={(p) => <TextField {...p} label="Status" fullWidth />}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}

          {/* ADJUSTMENTS FORM */}
          {section === "adjustments" && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Header</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Date"
                    type="date"
                    value={(editing?.date || "").slice(0, 10)}
                    onChange={(e) => {
                      const date = e.target.value;
                      setEditing((s) => ({
                        ...s,
                        date,
                        adjNo: s?.id || s?._id ? s.adjNo : (s.adjNo || generateDocNo("ADJ", date)),
                        reference: s?.id || s?._id ? s.reference : (s.reference || generateRef("ADJ", date)),
                      }));
                    }}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Adj No."
                    value={editing?.adjNo || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, adjNo: e.target.value }))}
                    helperText="Auto-generated; editable"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Reference"
                    value={editing?.reference || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, reference: e.target.value }))}
                    helperText="Auto-generated if empty"
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Divider />

              <Typography variant="subtitle2" color="text.secondary">Adjustment Details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Item SKU (or set itemId)"
                    value={editing?.itemSku || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, itemSku: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Warehouse Code (or set warehouseId)"
                    value={editing?.warehouseCode || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, warehouseCode: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Qty Delta"
                    type="number"
                    inputProps={{ step: "1", style: { textAlign: "right" } }}
                    value={editing?.qtyDelta ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, qtyDelta: Number(e.target.value) }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Unit Cost"
                    type="number"
                    inputProps={{ min: 0, step: "0.01", style: { textAlign: "right" } }}
                    value={editing?.unitCost ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, unitCost: Number(e.target.value) }))}
                    fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start">kr</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ height: "100%", display: "flex", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ width: "100%", textAlign: "right" }}>
                      Line Total:&nbsp;<strong>{money((Number(editing?.qtyDelta) || 0) * (Number(editing?.unitCost) || 0))}</strong>
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Reason"
                    value={editing?.reason || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, reason: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Memo"
                    value={editing?.memo || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, memo: e.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              </Grid>

              <Divider />

              <Typography variant="subtitle2" color="text.secondary">Workflow</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={preparers.length ? preparers : peopleAllNames}
                    loading={peopleLoading}
                    value={editing?.participants?.preparedBy?.name || ""}
                    onChange={(_, v) =>
                      setEditing((s) => ({
                        ...s,
                        participants: {
                          ...(s.participants || {}),
                          preparedBy: { ...(s.participants?.preparedBy || {}), name: v || "" },
                        },
                      }))
                    }
                    renderInput={(p) => <TextField {...p} label="Prepared by" placeholder="Select" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={approvers.length ? approvers : peopleAllNames}
                    loading={peopleLoading}
                    value={editing?.participants?.approvedBy?.name || ""}
                    onChange={(_, v) =>
                      setEditing((s) => ({
                        ...s,
                        participants: {
                          ...(s.participants || {}),
                          approvedBy: { ...(s.participants?.approvedBy || {}), name: v || "" },
                        },
                      }))
                    }
                    renderInput={(p) => <TextField {...p} label="Approved by" placeholder="Select" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={posters.length ? posters : peopleAllNames}
                    loading={peopleLoading}
                    value={editing?.participants?.postedBy?.name || ""}
                    onChange={(_, v) =>
                      setEditing((s) => ({
                        ...s,
                        participants: {
                          ...(s.participants || {}),
                          postedBy: { ...(s.participants?.postedBy || {}), name: v || "" },
                        },
                      }))
                    }
                    renderInput={(p) => <TextField {...p} label="Posted by" placeholder="Select" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={["draft", "approved", "posted"]}
                    value={editing?.status || "draft"}
                    onChange={(_, v) => setEditing((s) => ({ ...s, status: v || "draft" }))}
                    renderInput={(p) => <TextField {...p} label="Status" fullWidth />}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}

          {/* WAREHOUSES FORM */}
          {section === "warehouses" && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Warehouse</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Code"
                    value={editing?.code || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, code: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Name"
                    value={editing?.name || ""}
                    onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={["true", "false"]}
                    value={String(!!editing?.isDefault)}
                    onChange={(_, v) => setEditing((s) => ({ ...s, isDefault: v === "true" }))}
                    renderInput={(p) => <TextField {...p} label="Default" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={["true", "false"]}
                    value={String(!!editing?.isActive)}
                    onChange={(_, v) => setEditing((s) => ({ ...s, isActive: v === "true" }))}
                    renderInput={(p) => <TextField {...p} label="Active" fullWidth />}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
