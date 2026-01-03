// client/src/pages/Inventory_Warehouses.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Stack,
  Typography,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Divider,
  Box,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FilterListIcon from "@mui/icons-material/FilterList";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

import {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  listStockMoves, // 🔹 use inventory movements to power "AI" suggestions
} from "../api.js";

/* ---------- helpers ---------- */
const asItems = (x) =>
  Array.isArray(x?.items) ? x.items : Array.isArray(x) ? x : [];

// Professional type suggestions
const TYPE_OPTIONS = [
  "Main",
  "Store",
  "3PL",
  "Production",
  "Returns",
  "Virtual",
  "Transit",
];

// Professional name suggestions
const NAME_OPTIONS = [
  "Main Warehouse",
  "Central DC",
  "Webshop Warehouse",
  "Production Warehouse",
  "Returns Center",
  "Transit Hub",
  "Service Stock",
];

const emptyWarehouse = {
  code: "",
  name: "",
  type: "",
  location: "",
  notes: "",
  isActive: true,
};

// Simple code suggestion (always visible even before user types)
function suggestCode(name = "", location = "") {
  const baseSource = (name || location || "").toUpperCase();
  const cleaned = baseSource.replace(/[^A-Z0-9]/g, "");
  if (cleaned) return cleaned.slice(0, 8);
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `WH${rand}`;
}

// Build an “AI-style” smart note suggestion from movement stats
function buildNoteSuggestion(base = {}, stat = null) {
  const { name, type, location, code } = base;
  const label = name || code || "this warehouse";
  const typeLabel = type || "warehouse";
  const locLabel = location || "the network";

  if (!stat) {
    return `New ${typeLabel} in ${locLabel}. Use this location for inbound and outbound stock handling, cycle counting, and secure storage of key items.`;
  }

  const { inQty = 0, outQty = 0, managerName, topSkus = [] } = stat;
  const parts = [];

  parts.push(
    `${label} operates as a ${typeLabel.toLowerCase()} in ${locLabel}, handling approximately ${inQty} units inbound and ${outQty} units outbound over the last 30 days.`
  );

  if (topSkus.length) {
    if (topSkus.length === 1) {
      parts.push(`Key item in the flow: ${topSkus[0]}.`);
    } else {
      parts.push(
        `Key items in the flow: ${topSkus[0]} and ${topSkus[1]}.`
      );
    }
  }

  if (managerName) {
    parts.push(
      `Primary flow coordination is handled by ${managerName}, who is responsible for monitoring movements, resolving discrepancies, and keeping stock levels updated.`
    );
  } else {
    parts.push(
      `Assign a responsible warehouse manager to monitor movements, resolve discrepancies, and keep stock levels updated.`
    );
  }

  parts.push(
    `Use this warehouse for planned receipts, order picking, and regular inventory checks to maintain accurate stock visibility.`
  );

  return parts.join(" ");
}

export default function InventoryWarehouses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Movement-based stats per warehouse (30d)
  const [statsLoading, setStatsLoading] = useState(false);
  const [whStats, setWhStats] = useState({}); // { [code]: { inQty, outQty, managerName, topSkus } }

  // filters
  const [filters, setFilters] = useState({
    search: "",
    showInactive: false,
  });

  // create form – code is pre-filled on first load
  const [draft, setDraft] = useState(() => ({
    ...emptyWarehouse,
    code: suggestCode(),
  }));

  // edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(null);

  // delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    id: null,
    code: "",
  });

  // toasts
  const [toast, setToast] = useState({
    open: false,
    kind: "success",
    msg: "",
  });
  const showOk = (msg) => setToast({ open: true, kind: "success", msg });
  const showErr = (msg) => setToast({ open: true, kind: "error", msg });

  const canCreate = !!draft.code.trim() && !!draft.name.trim() && !busy;

  const refetchWarehouses = async () => {
    setLoading(true);
    try {
      const pager = await listWarehouses().catch(() => ({ items: [] }));
      const list = asItems(pager)
        .slice()
        .sort((a, b) =>
          String(a.code || "").localeCompare(String(b.code || ""))
        );
      setRows(list);
    } catch (e) {
      showErr(`Failed to load warehouses: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const refetchStats = async () => {
    setStatsLoading(true);
    try {
      // Last 30 days of movements (limited)
      const pager = await listStockMoves({
        limit: 1000,
      }).catch(() => ({ items: [] }));
      const moves = asItems(pager);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const byWh = {}; // { [whCode]: { inQty, outQty, managers: {name:count}, skus: {sku:count} } }

      for (const m of moves) {
        if (!m) continue;

        const date = m.date ? new Date(m.date) : null;
        if (date && date < cutoff) continue;

        const qty = Math.abs(Number(m.qty || 0)) || 0;
        if (!qty) continue;

        const preparedBy =
          m.participants?.preparedBy?.name ||
          m.participants?.approvedBy?.name ||
          m.participants?.postedBy?.name ||
          "";
        const sku = (m.itemSku || "").trim();

        // Inbound to "toWhCode"
        if (m.toWhCode) {
          const code = String(m.toWhCode).toUpperCase();
          if (!byWh[code]) {
            byWh[code] = {
              inQty: 0,
              outQty: 0,
              managers: {},
              skus: {},
            };
          }
          byWh[code].inQty += qty;
          if (preparedBy) {
            byWh[code].managers[preparedBy] =
              (byWh[code].managers[preparedBy] || 0) + 1;
          }
          if (sku) {
            byWh[code].skus[sku] = (byWh[code].skus[sku] || 0) + qty;
          }
        }

        // Outbound from "fromWhCode"
        if (m.fromWhCode) {
          const code = String(m.fromWhCode).toUpperCase();
          if (!byWh[code]) {
            byWh[code] = {
              inQty: 0,
              outQty: 0,
              managers: {},
              skus: {},
            };
          }
          byWh[code].outQty += qty;
          if (preparedBy) {
            byWh[code].managers[preparedBy] =
              (byWh[code].managers[preparedBy] || 0) + 1;
          }
          if (sku) {
            byWh[code].skus[sku] = (byWh[code].skus[sku] || 0) + qty;
          }
        }
      }

      // Compress into final stats object
      const stats = {};
      for (const [code, s] of Object.entries(byWh)) {
        const managerName = Object.entries(s.managers || {})
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name)[0];

        const topSkus = Object.entries(s.skus || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([sku]) => sku);

        stats[code] = {
          inQty: s.inQty || 0,
          outQty: s.outQty || 0,
          managerName: managerName || "",
          topSkus,
        };
      }

      setWhStats(stats);
    } catch (e) {
      console.error("Failed to load stock move stats", e);
      // keep UI usable even if stats fail
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    refetchWarehouses();
    refetchStats();
  }, []);

  const filteredRows = useMemo(() => {
    const q = (filters.search || "").toLowerCase();

    const base = rows.filter((r) => {
      const matchesQuery =
        !q ||
        String(r.code || "").toLowerCase().includes(q) ||
        String(r.name || "").toLowerCase().includes(q) ||
        String(r.location || "").toLowerCase().includes(q);
      const matchesActive =
        filters.showInactive || r.isActive === undefined || r.isActive;
      return matchesQuery && matchesActive;
    });

    return base.slice().sort((a, b) =>
      String(a.code || "").localeCompare(String(b.code || ""))
    );
  }, [rows, filters]);

  const activeCount = useMemo(
    () => rows.filter((r) => r.isActive !== false).length,
    [rows]
  );
  const inactiveCount = useMemo(
    () => rows.filter((r) => r.isActive === false).length,
    [rows]
  );

  // Global 30d flow across all warehouses
  const totalsFlow = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    Object.values(whStats).forEach((s) => {
      inSum += s.inQty || 0;
      outSum += s.outQty || 0;
    });
    return { inSum, outSum };
  }, [whStats]);

  const resetDraft = () =>
    setDraft({
      ...emptyWarehouse,
      // New suggested code immediately visible after Clear
      code: suggestCode(),
    });

  /* ---------- CREATE ---------- */
  const onCreate = async () => {
    if (!canCreate) return;

    const exists = rows.some(
      (w) =>
        String(w.code || "").toUpperCase() ===
        draft.code.trim().toUpperCase()
    );
    if (exists) {
      showErr(`Warehouse code "${draft.code.trim()}" already exists.`);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        type: draft.type.trim() || "General",
        location: draft.location.trim(),
        notes: draft.notes.trim(),
        isActive: !!draft.isActive,
      };

      const created = await createWarehouse(payload);

      const newRow = {
        ...payload,
        ...(created || {}),
      };

      setRows((prev) => [newRow, ...prev]);
      resetDraft();
      showOk("Warehouse created");

      refetchWarehouses();
      refetchStats(); // keep flow chips in sync
    } catch (e) {
      showErr(`Create failed: ${e.message || e}`);
      console.error("createWarehouse failed", e);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- EDIT ---------- */
  const openEdit = (row) => {
    setEditDraft({
      id: row._id || row.id,
      code: row.code || "",
      name: row.name || "",
      type: row.type || "",
      location: row.location || "",
      notes: row.notes || "",
      isActive: row.isActive !== false,
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditDraft(null);
  };

  const onEditSave = async () => {
    if (!editDraft?.id) return;
    if (!editDraft.code.trim() || !editDraft.name.trim()) {
      showErr("Code and Name are required.");
      return;
    }

    const duplicate = rows.some((w) => {
      const id = w._id || w.id;
      if (id === editDraft.id) return false;
      return (
        String(w.code || "").toUpperCase() ===
        editDraft.code.trim().toUpperCase()
      );
    });
    if (duplicate) {
      showErr(
        `Another warehouse already uses code "${editDraft.code.trim()}".`
      );
      return;
    }

    setBusy(true);
    try {
      const payload = {
        code: editDraft.code.trim().toUpperCase(),
        name: editDraft.name.trim(),
        type: editDraft.type.trim() || "General",
        location: editDraft.location.trim(),
        notes: editDraft.notes.trim(),
        isActive: !!editDraft.isActive,
      };

      const updated = await updateWarehouse(editDraft.id, payload);

      const updatedRow = {
        ...(rows.find((r) => (r._id || r.id) === editDraft.id) || {}),
        ...payload,
        ...(updated || {}),
      };

      setRows((prev) =>
        prev.map((r) =>
          (r._id || r.id) === editDraft.id ? updatedRow : r
        )
      );

      showOk("Warehouse updated");
      closeEdit();

      refetchWarehouses();
      refetchStats();
    } catch (e) {
      showErr(`Update failed: ${e.message || e}`);
      console.error("updateWarehouse failed", e);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- DELETE ---------- */
  const askDelete = (id, code) => {
    setDeleteConfirm({
      open: true,
      id,
      code: code || "",
    });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, id: null, code: "" });
  };

  const onDelete = async () => {
    const { id } = deleteConfirm;
    if (!id) return;

    setBusy(true);
    try {
      await deleteWarehouse(id);
      showOk("Warehouse deleted");
      setRows((prev) => prev.filter((w) => (w._id || w.id) !== id));
      refetchWarehouses();
      refetchStats();
    } catch (e) {
      showErr(`Delete failed: ${e.message || e}`);
      console.error("deleteWarehouse failed", e);
    } finally {
      setBusy(false);
      closeDeleteConfirm();
    }
  };

  /* ----------------- UI ----------------- */
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        Warehouses
      </Typography>

      {/* Create form */}
      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          New Warehouse
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          {/* CODE – pre-filled and independent from Name */}
          <TextField
            size="small"
            label="Code *"
            value={draft.code}
            onChange={(e) =>
              setDraft((s) => ({
                ...s,
                code: e.target.value.toUpperCase(),
              }))
            }
            onBlur={(e) => {
              const val = e.target.value.trim().toUpperCase();
              if (!val) {
                // If user clears it, generate a fresh one
                setDraft((s) => ({
                  ...s,
                  code: suggestCode(s.name, s.location),
                }));
              }
            }}
            sx={{ minWidth: 140 }}
            helperText="Code is suggested but you can override it"
          />

          {/* NAME – suggestions only, no code auto-link */}
          <Autocomplete
            size="small"
            options={NAME_OPTIONS}
            freeSolo
            value={draft.name}
            onChange={(_, value) => {
              const val = value || "";
              setDraft((s) => ({ ...s, name: val }));
            }}
            onInputChange={(_, value) => {
              const val = value || "";
              setDraft((s) => ({ ...s, name: val }));
            }}
            sx={{ minWidth: 220 }}
            renderInput={(params) => (
              <TextField {...params} label="Name *" />
            )}
          />

          {/* TYPE – suggestions + free text */}
          <Autocomplete
            size="small"
            options={TYPE_OPTIONS}
            freeSolo
            value={draft.type}
            onChange={(_, value) =>
              setDraft((s) => ({ ...s, type: value || "" }))
            }
            onInputChange={(_, value) =>
              setDraft((s) => ({ ...s, type: value || "" }))
            }
            sx={{ minWidth: 180 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Type"
                placeholder="Main / Store / 3PL"
              />
            )}
          />

          {/* LOCATION – normal text input */}
          <TextField
            size="small"
            label="Location"
            placeholder="City, Country"
            value={draft.location}
            onChange={(e) =>
              setDraft((s) => ({ ...s, location: e.target.value }))
            }
            sx={{ minWidth: 220 }}
          />

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={draft.isActive}
                onChange={(e) =>
                  setDraft((s) => ({ ...s, isActive: e.target.checked }))
                }
              />
            }
            label="Active"
          />
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          sx={{ mt: 1 }}
        >
          <TextField
            multiline
            minRows={2}
            fullWidth
            size="small"
            label="Notes (optional)"
            value={draft.notes}
            onChange={(e) =>
              setDraft((s) => ({ ...s, notes: e.target.value }))
            }
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AutoFixHighIcon />}
            sx={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}
            onClick={() => {
              const stat =
                whStats[String(draft.code || "").toUpperCase()] || null;
              const suggestion = buildNoteSuggestion(draft, stat);
              setDraft((s) => ({ ...s, notes: suggestion }));
            }}
          >
            Suggest note
          </Button>
        </Stack>

        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1}
          sx={{ mt: 1 }}
        >
          <Button
            variant="text"
            size="small"
            onClick={resetDraft}
            disabled={busy}
          >
            Clear
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={onCreate}
            disabled={!canCreate || busy}
          >
            Add Warehouse
          </Button>
        </Stack>
      </Paper>

      {/* Filters + global flow summary */}
      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 1 }}
        >
          <FilterListIcon fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Warehouse Directory
          </Typography>
          <Box flex={1} />
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            label={
              statsLoading
                ? "Calculating flow…"
                : `30d In: +${totalsFlow.inSum} units`
            }
          />
          <Chip
            size="small"
            variant="outlined"
            color="secondary"
            label={
              statsLoading
                ? "…"
                : `30d Out: -${totalsFlow.outSum} units`
            }
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Search (code / name / location)"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            sx={{ minWidth: 260 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filters.showInactive}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    showInactive: e.target.checked,
                  }))
                }
              />
            }
            label="Show inactive"
          />
          <Box flex={1} />
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={`Active: ${activeCount}`}
            />
            <Chip
              size="small"
              color="default"
              variant="outlined"
              label={`Inactive: ${inactiveCount}`}
            />
            <Chip
              size="small"
              label={
                loading
                  ? "Loading…"
                  : `${filteredRows.length} warehouse${
                      filteredRows.length === 1 ? "" : "s"
                    }`
              }
            />
          </Stack>
        </Stack>
      </Paper>

      {/* List */}
      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Divider sx={{ mb: 1 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Code</strong>
              </TableCell>
              <TableCell>
                <strong>Name</strong>
              </TableCell>
              <TableCell>
                <strong>Type</strong>
              </TableCell>
              <TableCell>
                <strong>Location</strong>
              </TableCell>
              <TableCell>
                <strong>Status</strong>
              </TableCell>
              <TableCell>
                <strong>Flow (30d)</strong>
              </TableCell>
              <TableCell>
                <strong>Flow Manager</strong>
              </TableCell>
              <TableCell>
                <strong>Notes</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Actions</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((r) => {
              const id = r._id || r.id;
              const isActive = r.isActive !== false;
              const codeKey = String(r.code || "").toUpperCase();
              const stat = whStats[codeKey] || {
                inQty: 0,
                outQty: 0,
                managerName: "",
              };

              return (
                <TableRow
                  key={id}
                  hover
                  onDoubleClick={() => openEdit(r)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{r.code || "—"}</TableCell>
                  <TableCell>{r.name || "—"}</TableCell>
                  <TableCell>{r.type || "General"}</TableCell>
                  <TableCell>{r.location || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={isActive ? "success" : "default"}
                      label={isActive ? "Active" : "Inactive"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      +{stat.inQty || 0} / -{stat.outQty || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {stat.managerName || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 260 }} title={r.notes || ""}>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.notes || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon fontSize="small" />}
                        onClick={() => openEdit(r)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<DeleteOutlineIcon fontSize="small" />}
                        onClick={() => askDelete(id, r.code)}
                        disabled={busy}
                        sx={{ minWidth: 90 }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Box sx={{ py: 2, color: "text.secondary" }}>
                    No warehouses found.
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={closeEdit} maxWidth="md" fullWidth>
        <DialogTitle>Edit Warehouse</DialogTitle>
        <DialogContent dividers>
          {editDraft && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                {/* CODE – independent from Name */}
                <TextField
                  size="small"
                  label="Code *"
                  value={editDraft.code}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  onBlur={(e) => {
                    const val = e.target.value.trim().toUpperCase();
                    if (!val) {
                      setEditDraft((s) => ({
                        ...s,
                        code: suggestCode(s.name, s.location),
                      }));
                    }
                  }}
                  sx={{ minWidth: 140 }}
                />

                {/* NAME – suggestions only */}
                <Autocomplete
                  size="small"
                  options={NAME_OPTIONS}
                  freeSolo
                  value={editDraft.name}
                  onChange={(_, value) => {
                    const val = value || "";
                    setEditDraft((s) => ({ ...s, name: val }));
                  }}
                  onInputChange={(_, value) => {
                    const val = value || "";
                    setEditDraft((s) => ({ ...s, name: val }));
                  }}
                  sx={{ minWidth: 220 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Name *" />
                  )}
                />

                {/* TYPE – suggestions + free text */}
                <Autocomplete
                  size="small"
                  options={TYPE_OPTIONS}
                  freeSolo
                  value={editDraft.type}
                  onChange={(_, value) =>
                    setEditDraft((s) => ({ ...s, type: value || "" }))
                  }
                  onInputChange={(_, value) =>
                    setEditDraft((s) => ({ ...s, type: value || "" }))
                  }
                  sx={{ minWidth: 180 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Type" />
                  )}
                />

                {/* LOCATION */}
                <TextField
                  size="small"
                  label="Location"
                  value={editDraft.location}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      location: e.target.value,
                    }))
                  }
                  sx={{ minWidth: 220 }}
                />
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={editDraft.isActive}
                    onChange={(e) =>
                      setEditDraft((s) => ({
                        ...s,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                }
                label="Active"
              />
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                sx={{ mt: 1 }}
              >
                <TextField
                  multiline
                  minRows={2}
                  fullWidth
                  size="small"
                  label="Notes"
                  value={editDraft.notes}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      notes: e.target.value,
                    }))
                  }
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AutoFixHighIcon />}
                  sx={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}
                  onClick={() => {
                    const codeKey = String(editDraft.code || "").toUpperCase();
                    const stat = whStats[codeKey] || null;
                    const suggestion = buildNoteSuggestion(editDraft, stat);
                    setEditDraft((s) => ({ ...s, notes: suggestion }));
                  }}
                >
                  Suggest note
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onEditSave} variant="contained" disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirm.open}
        onClose={closeDeleteConfirm}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Warehouse</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            Are you sure you want to delete warehouse{" "}
            <strong>{deleteConfirm.code || deleteConfirm.id}</strong>?<br />
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteConfirm} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            color="error"
            variant="contained"
            disabled={busy}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toasts */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() =>
          setToast((t) => ({
            ...t,
            open: false,
          }))
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() =>
            setToast((t) => ({
              ...t,
              open: false,
            }))
          }
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
