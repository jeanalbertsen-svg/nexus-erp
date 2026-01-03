// client/src/pages/Inventory_Adjustments.jsx
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
  Autocomplete,
  Box,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SendIcon from "@mui/icons-material/Send";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FilterListIcon from "@mui/icons-material/FilterList";
import EditIcon from "@mui/icons-material/Edit";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  listAdjustments,
  createAdjustment,
  deleteAdjustment,
  postAdjustment,
  listWarehouses,
  listPersons,
  updateAdjustment,
  listItems, // 🔹 NEW: get items + onHand for suggestions
} from "../api.js";

/* ---------- helpers (same as StockMove) ---------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  const s = String(d || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? s : dt.toISOString().slice(0, 10);
};
const sameDay = (a, b) => fmtDate(a) === fmtDate(b);
const asItems = (x) =>
  Array.isArray(x?.items) ? x.items : Array.isArray(x) ? x : [];

// daily sequences in localStorage
const yyyymmdd = (iso) => (iso || todayISO()).replaceAll("-", "");
const seqKey = (prefix, dateISO) => `inv.seq.${prefix}.${yyyymmdd(dateISO)}`;
const nextSeq = (prefix, dateISO) => {
  const k = seqKey(prefix, dateISO);
  let n = 0;
  try {
    n = Number(localStorage.getItem(k) || "0");
  } catch {}
  n += 1;
  try {
    localStorage.setItem(k, String(n));
  } catch {}
  return n;
};
const docNo = (prefix, dateISO) =>
  `${prefix}-${yyyymmdd(dateISO)}-${String(nextSeq(prefix, dateISO)).padStart(
    4,
    "0"
  )}`;

// preview the *next* number without incrementing
const peekDocNo = (prefix, dateISO) => {
  const k = seqKey(prefix, dateISO);
  let n = 0;
  try {
    n = Number(localStorage.getItem(k) || "0");
  } catch {}
  const next = n + 1;
  return `${prefix}-${yyyymmdd(dateISO)}-${String(next).padStart(4, "0")}`;
};

/* ---------- helpers for direction / qty derived from delta ---------- */
const deriveDirection = (row) => {
  if (row.direction) return row.direction;
  if (typeof row.qtyDelta === "number") {
    return row.qtyDelta >= 0 ? "increase" : "decrease";
  }
  return "";
};

const deriveQtyAbs = (row) => {
  const q = Number(row.qty || 0);
  if (q !== 0) return Math.abs(q);
  const qd = Number(row.qtyDelta || 0);
  if (!qd) return 0;
  return Math.abs(qd);
};

/* ---------- recognise auto-created adjustments from Stock Moves ---------- */
// Example pattern: "Auto from Stock Move MOV-20251124-0001"
const isFromStockMove = (r) =>
  String(r.reason || "").toLowerCase().startsWith("auto from stock move");

/* "AI-ish" helpers for auto-suggested reason + memo */
const buildSmartReason = (draft) => {
  const dirWord = draft.direction === "decrease" ? "Decrease" : "Increase";
  const wh = draft.whCode || "stock";
  const qty = Number(draft.qty || 0);
  const uom = draft.uom || "pcs";
  if (!qty) return `${dirWord} inventory in ${wh}`;
  return `${dirWord} ${qty} ${uom} in ${wh}`;
};

const buildSmartMemo = (draft) => {
  const dateTxt = fmtDate(draft.date || todayISO());
  const sku = draft.itemSku || "auto-sku";
  return `AI-suggested adjustment for ${sku} on ${dateTxt}`;
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

export default function InventoryAdjustments() {
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [people, setPeople] = useState([]);
  const [items, setItems] = useState([]); // 🔹 NEW: items with onHand
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // For stock-move rows: remember which ones the user has actually posted
  const [manualPosted, setManualPosted] = useState(() => new Set());

  // Filters + preview
  const [filters, setFilters] = useState({
    dateFrom: todayISO(),
    dateTo: todayISO(),
    whCode: "",
    search: "",
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(null);

  // toasts
  const [toast, setToast] = useState({ open: false, kind: "success", msg: "" });
  const showOk = (msg) => setToast({ open: true, kind: "success", msg });
  const showErr = (msg) => setToast({ open: true, kind: "error", msg });

  // form state (single warehouse + direction)
  const [adj, setAdj] = useState({
    date: todayISO(),
    itemSku: "",
    qty: 1,
    uom: "pcs",
    unitCost: 0,
    whCode: "",
    direction: "increase",
    reason: "",
    preparedBy: "",
    approvedBy: "",
    memo: "",
  });

  // people inputs for freeSolo fields
  const [preparedByInput, setPreparedByInput] = useState("");
  const [approvedByInput, setApprovedByInput] = useState("");

  // UI-effective status:
  const uiStatus = (row) => {
    const id = row._id || row.id;
    if (isFromStockMove(row)) {
      if (manualPosted.has(id)) return "posted";
      return "draft";
    }
    return row.status || "draft";
  };

  // auto preview (do not consume sequence)
  const previewAdjNo = useMemo(
    () => peekDocNo("ADJ", adj.date || todayISO()),
    [adj.date, rows.length, busy]
  );

  const canCreate =
    adj.date && Number(adj.qty) > 0 && adj.whCode && adj.direction;

  const refetch = async () => {
    setLoading(true);
    try {
      const [adjPager, whPager, ppl, itemPager] = await Promise.all([
        listAdjustments().catch(() => ({ items: [] })),
        listWarehouses().catch(() => ({ items: [] })),
        listPersons().catch(() => []),
        listItems().catch(() => ({ items: [] })), // 🔹 load items
      ]);
      setRows(asItems(adjPager));
      const whs = asItems(whPager);
      setWarehouses(
        whs.length ? whs : [{ code: "MAIN" }, { code: "SHIP" }, { code: "WIP" }]
      );
      setPeople(asItems(ppl));
      setItems(asItems(itemPager));
    } catch (e) {
      showErr(`Failed to load data: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  const whOptions = useMemo(
    () =>
      asItems(warehouses).map((w) => {
        const code = w.code || w.name || "";
        return { code, label: code };
      }),
    [warehouses]
  );

  const personNames = useMemo(
    () => asItems(people).map((p) => p.name).filter(Boolean),
    [people]
  );

  // 🔹 Item map & options for suggestions (sku + name + onHand)
  const itemMap = useMemo(() => {
    const map = {};
    asItems(items).forEach((it) => {
      if (!it?.sku) return;
      map[it.sku] = it;
    });
    return map;
  }, [items]);

  const itemOptions = useMemo(
    () =>
      asItems(items).map((it) => {
        const labelParts = [it.sku || "", it.name || ""].filter(Boolean);
        let label = labelParts.join(" – ");
        if (typeof it.onHand === "number") {
          label += ` (On hand: ${it.onHand})`;
        }
        return {
          sku: it.sku,
          name: it.name,
          onHand: it.onHand,
          label,
        };
      }),
    [items]
  );

  const selectedItem = useMemo(
    () => itemMap[(adj.itemSku || "").trim()] || null,
    [itemMap, adj.itemSku]
  );

  // Filtered rows for Daily Report + totals
  const filteredRows = useMemo(() => {
    const dfISO = fmtDate(filters.dateFrom);
    const dtISO = fmtDate(filters.dateTo);
    const df = dfISO ? new Date(dfISO) : null;
    const dt = dtISO ? new Date(dtISO) : null;
    const wh = (filters.whCode || "").toLowerCase();
    const q = (filters.search || "").toLowerCase();

    return rows.filter((r) => {
      const d = new Date(fmtDate(r.date));
      const inDate =
        (!df || d >= new Date(fmtDate(df))) &&
        (!dt || d <= new Date(fmtDate(dt)));
      const inWh =
        !wh ||
        String(r.whCode || r.warehouseCode || "")
          .toLowerCase()
          .includes(wh);
      const inQuery =
        !q ||
        String(r.reason || "").toLowerCase().includes(q) ||
        String(r.memo || "").toLowerCase().includes(q) ||
        String(r.adjNo || "").toLowerCase().includes(q);
      return inDate && inWh && inQuery;
    });
  }, [rows, filters]);

  const reportTotals = useMemo(() => {
    const qty = filteredRows.reduce((s, r) => s + deriveQtyAbs(r), 0);
    const value = filteredRows.reduce((s, r) => {
      const qtyEff = deriveQtyAbs(r);
      return s + qtyEff * Number(r.unitCost || 0);
    }, 0);
    return { qty, value };
  }, [filteredRows]);

  const onCreate = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      const dateISO = adj.date || todayISO();

      const qtyAbs = Math.abs(Number(adj.qty) || 0);
      const qtyDelta = adj.direction === "decrease" ? -qtyAbs : qtyAbs;

      if (!qtyDelta) {
        showErr("Qty Delta must be non-zero.");
        setBusy(false);
        return;
      }

      const effectiveSku =
        (adj.itemSku || "").trim() || docNo("ADJITM", dateISO);

      const smartBase = {
        ...adj,
        date: dateISO,
        itemSku: effectiveSku,
        qty: qtyAbs,
      };
      const reason = (adj.reason || "").trim() || buildSmartReason(smartBase);
      const memo = (adj.memo || "").trim() || buildSmartMemo(smartBase);

      const payload = {
        ...adj,
        itemSku: effectiveSku,
        warehouseCode: adj.whCode,
        adjNo: docNo("ADJ", dateISO),
        qty: qtyAbs,
        qtyDelta,
        unitCost: Number(adj.unitCost) || 0,
        status: "approved",
        whCode: adj.whCode,
        direction: adj.direction,
        reason,
        memo,
        participants: {
          preparedBy: adj.preparedBy
            ? { name: adj.preparedBy, at: new Date() }
            : undefined,
          approvedBy: adj.approvedBy
            ? { name: adj.approvedBy, at: new Date() }
            : undefined,
        },
      };

      const created = await createAdjustment(payload);
      setRows((r) => [created || payload, ...r]);

      setAdj((s) => ({
        ...s,
        itemSku: effectiveSku,
        qty: 1,
        unitCost: 0,
        memo: "",
        reason: "",
      }));

      showOk("Adjustment created");

      // 🔹 After adjustments are posted, backend updates stock; Warehouses page
      // reads totals via its own APIs – this keeps things automatically in sync.
      await refetch();
    } catch (e) {
      showErr(`Create failed: ${e.message || e}`);
      console.error("createAdjustment failed", e);
    } finally {
      setBusy(false);
    }
  };

  // ✅ ADJUSTED: smarter delete that also removes local rows and handles not_found
  const onDelete = async (row) => {
    const id = row?._id || row?.id;
    setBusy(true);
    try {
      if (id) {
        try {
          await deleteAdjustment(id);
        } catch (e) {
          const msg = String(e?.message || e || "");
          // If backend says not_found, we still remove it locally
          if (!msg.toLowerCase().includes("not_found")) {
            throw e;
          }
        }
      }
      setRows((prev) =>
        prev.filter((r) => (r._id || r.id) !== id)
      );
      showOk("Adjustment deleted");
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
      await postAdjustment(id, { postedBy: "Inventory" });
      setManualPosted((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      showOk("Adjustment posted");
      await refetch();
    } catch (e) {
      showErr(`Post failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const onPostByDate = async () => {
    const target = filters.dateFrom || todayISO();
    const toPost = rows.filter((r) => {
      const same = sameDay(r.date, target);
      const status = uiStatus(r);
      return same && status !== "posted";
    });

    if (!toPost.length) {
      showErr("No unposted adjustments for that date.");
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        toPost.map((r) =>
          postAdjustment(r._id || r.id, {
            postedBy: "Inventory (daily batch)",
          })
        )
      );
      setManualPosted((prev) => {
        const next = new Set(prev);
        toPost.forEach((row, idx) => {
          if (results[idx]?.status === "fulfilled") {
            next.add(row._id || row.id);
          }
        });
        return next;
      });

      const okCount = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - okCount;
      showOk(`Posted ${okCount} adjustment(s). ${fail ? `${fail} failed.` : ""}`);
      await refetch();
    } catch (e) {
      showErr(`Batch post failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Edit dialog handlers ---------- */
  const openEdit = (row) => {
    const dir = deriveDirection(row) || "increase";
    const qtyEff = deriveQtyAbs(row) || 1;
    setEditDraft({
      id: row._id || row.id,
      date: fmtDate(row.date),
      itemSku: row.itemSku || "",
      qty: qtyEff,
      uom: row.uom || "pcs",
      unitCost: row.unitCost ?? 0,
      whCode: row.whCode || row.warehouseCode || "",
      direction: dir,
      reason: row.reason || "",
      memo: row.memo || "",
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditDraft(null);
  };

  const onEditSave = async () => {
    if (!editDraft?.id) return;
    setBusy(true);
    try {
      const dateISO = editDraft.date || todayISO();
      const qtyAbs = Math.abs(Number(editDraft.qty) || 0);
      const qtyDelta =
        editDraft.direction === "decrease" ? -qtyAbs : qtyAbs;

      if (!qtyDelta) {
        showErr("Qty Delta must be non-zero.");
        setBusy(false);
        return;
      }

      const payload = {
        date: dateISO,
        itemSku: (editDraft.itemSku || "").trim(),
        qty: qtyAbs,
        qtyDelta,
        uom: editDraft.uom || "pcs",
        unitCost: Number(editDraft.unitCost) || 0,
        whCode: editDraft.whCode,
        warehouseCode: editDraft.whCode,
        direction: editDraft.direction,
        reason:
          (editDraft.reason || "").trim() || buildSmartReason(editDraft),
        memo: (editDraft.memo || "").trim() || buildSmartMemo(editDraft),
      };

      await updateAdjustment(editDraft.id, payload);
      showOk("Adjustment updated");
      closeEdit();
      await refetch();
    } catch (e) {
      showErr(`Update failed: ${e.message || e}`);
      console.error("updateAdjustment failed", e);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- PDF export (unchanged) ---------- */
  const exportPdf = async () => {
    if (!filteredRows.length) {
      showErr("No rows in the current report.");
      return;
    }

    const BRAND = {
      orgName: "Acta Venture Partners Aps",
      subline:
        "Ravnsborg Tværgade 1, 1. 2200 København N • CVR 44427508",
      primary: [14, 76, 146],
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

    const headerY = M.t;
    let logoDrawn = false;
    try {
      const logoData = await loadImageDataURL("/ACTA_logo.png");
      doc.addImage(logoData, "PNG", M.l, headerY - 2, 30, 30);
      logoDrawn = true;
    } catch {
      doc.setFillColor(...BRAND.primary);
      doc.roundedRect(M.l, headerY - 2, 30, 30, 4, 4, "F");
    }

    doc.setTextColor(...BRAND.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(BRAND.orgName, M.l + 40, headerY + 12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(8);
    doc.text(BRAND.subline, M.l + 40, headerY + 28);

    const metaW = 200;
    const metaH = 78;
    const metaX = M.l + contentW - metaW;
    const metaY = headerY - 8;
    doc.setDrawColor(...BRAND.border);
    doc.setFillColor(255, 255, 255);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.primary);
    doc.setFontSize(11);
    doc.text("Adjustments Daily Report", metaX + 14, metaY + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.text);
    const dateLine = `${filters.dateFrom || "—"}${
      filters.dateTo && filters.dateTo !== filters.dateFrom
        ? ` → ${filters.dateTo}`
        : ""
    }`;
    const rowsMeta = [
      ["Date", dateLine],
      ["Warehouse", filters.whCode || "All"],
    ];
    let ly = metaY + 34;
    rowsMeta.forEach(([k, v]) => {
      doc.setTextColor(...BRAND.muted);
      doc.text(k, metaX + 14, ly);
      doc.setTextColor(...BRAND.text);
      doc.text(String(v), metaX + metaW - 14, ly, {
        align: "right",
      });
      ly += 14;
    });

    const infoY = headerY + 56;
    const startTableY = Math.max(infoY + 64, metaY + metaH + 16);

    autoTable(doc, {
      startY: startTableY,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: { top: 5, right: 7, bottom: 5, left: 7 },
        textColor: BRAND.text,
        lineWidth: 0,
      },
      headStyles: {
        fillColor: BRAND.th,
        textColor: 255,
        fontStyle: "bold",
        cellPadding: { top: 6, right: 7, bottom: 6, left: 7 },
      },
      alternateRowStyles: { fillColor: BRAND.zebra },
      columnStyles: {
        3: { halign: "right", cellWidth: 60 },
        4: { halign: "right", cellWidth: 76 },
      },
      head: [
        [
          "Description",
          "Adj No.",
          "Direction",
          "Qty",
          "Unit Cost",
          "Warehouse",
          "Reason",
          "Status",
        ],
      ],
      body: filteredRows.map((r) => {
        const dir = deriveDirection(r);
        const qtyEff = deriveQtyAbs(r);
        const status = uiStatus(r);
        return [
          r.memo || "—",
          r.adjNo || r.reference || "—",
          (dir || "").toUpperCase(),
          qtyEff.toLocaleString(),
          Number(r.unitCost || 0).toFixed(2),
          r.whCode || r.warehouseCode || "—",
          r.reason || "—",
          String(status || "draft").toUpperCase(),
        ];
      }),
      didDrawPage: (data) => {
        const y = Math.min(
          H - M.b - 78,
          (data.cursor?.y || startTableY) + 20
        );
        const labelW = 78;
        const valueW = 110;
        const rightX = M.l + contentW - (labelW + valueW + 2);

        doc.setDrawColor(...BRAND.primaryBorder);
        doc.setLineWidth(0.5);
        doc.line(rightX, y, M.l + contentW, y);

        const row = (label, value, bold = false, blue = false, dy = 12) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(bold ? 10.5 : 9);
          doc.setTextColor(...(blue ? BRAND.primary : BRAND.text));
          doc.text(label, rightX + labelW, y + dy, { align: "right" });
          doc.text(value, rightX + labelW + 2 + valueW, y + dy, {
            align: "right",
          });
          return dy + 20;
        };
        let dy = 12;
        dy = row("Subtotal", `${reportTotals.value.toFixed(2)}`, false, false, dy);
        dy = row(
          "Total Qty",
          `${reportTotals.qty.toLocaleString()}`,
          false,
          false,
          dy
        );
        doc.setDrawColor(...BRAND.primaryBorder);
        doc.setLineWidth(0.5);
        doc.line(rightX, y + dy - 10, M.l + contentW, y + dy - 10);
        row("Total", `${reportTotals.value.toFixed(2)}`, true, true, dy + 6);

        const footerY = H - M.b + 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.muted);
        const pageLabel = `${data.pageNumber}/${doc.internal.getNumberOfPages()}`;
        doc.text("Generated by ACTA ERP", M.l, footerY);
        doc.text(pageLabel, M.l + contentW, footerY, { align: "right" });
      },
    });

    const single =
      filters.dateFrom &&
      (!filters.dateTo || filters.dateTo === filters.dateFrom);
    const fname = single
      ? `adjustments-report-${filters.dateFrom}.pdf`
      : `adjustments-report-${filters.dateFrom || "from"}_${
          filters.dateTo || "to"
        }.pdf`;
    doc.save(fname);
    showOk("PDF saved");
  };

  /* ----------------- UI ----------------- */
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        Inventory Adjustments
      </Typography>

      {/* Create form */}
      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          New Adjustment
        </Typography>

        {/* Row 1: date, auto adj no, item, qty, uom, cost */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            type="date"
            label="Date"
            InputLabelProps={{ shrink: true }}
            value={adj.date}
            onChange={(e) =>
              setAdj((s) => ({ ...s, date: e.target.value }))
            }
          />
          <TextField
            size="small"
            label="Adjustment No (auto)"
            value={previewAdjNo}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 210 }}
          />

          {/* 🔹 Item selector with AI-ish suggestions: sku + name + total on hand */}
          <Autocomplete
            size="small"
            options={itemOptions}
            freeSolo
            value={
              itemOptions.find((o) => o.sku === adj.itemSku) ||
              (adj.itemSku
                ? {
                    sku: adj.itemSku,
                    label: adj.itemSku,
                    name: "",
                    onHand: undefined,
                  }
                : null)
            }
            onChange={(_, v) => {
              const sku =
                (v && v.sku) ||
                (typeof v === "string" ? v : "") ||
                "";
              const item = itemMap[sku];
              setAdj((s) => ({
                ...s,
                itemSku: sku,
              }));
            }}
            onInputChange={(_, value) => {
              setAdj((s) => ({ ...s, itemSku: value || "" }));
            }}
            getOptionLabel={(o) => o?.label || ""}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Item SKU / Name *"
                placeholder="Search item by SKU or name"
              />
            )}
            sx={{ minWidth: 220 }}
          />

          <TextField
            size="small"
            type="number"
            label="Qty *"
            value={adj.qty}
            onChange={(e) =>
              setAdj((s) => ({ ...s, qty: e.target.value }))
            }
            inputProps={{ min: 0, step: "0.01" }}
          />
          <TextField
            size="small"
            label="UoM"
            value={adj.uom}
            onChange={(e) =>
              setAdj((s) => ({ ...s, uom: e.target.value }))
            }
          />
          <TextField
            size="small"
            type="number"
            label="Unit Cost"
            value={adj.unitCost}
            onChange={(e) =>
              setAdj((s) => ({ ...s, unitCost: e.target.value }))
            }
            inputProps={{ min: 0, step: "0.01" }}
          />
        </Stack>

        {/* 🔹 Item name + total on hand (read-only, auto from selected item) */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          sx={{ mt: 1 }}
        >
          <TextField
            size="small"
            label="Item Name (from catalog)"
            value={selectedItem?.name || ""}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 260 }}
          />
          <TextField
            size="small"
            label="Total On Hand (current)"
            value={
              typeof selectedItem?.onHand === "number"
                ? selectedItem.onHand
                : ""
            }
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 200 }}
          />
        </Stack>

        {/* Row 2: warehouse, direction, reason, prepared/approved (Flow manager suggestion) */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          sx={{ mt: 1 }}
        >
          <Autocomplete
            size="small"
            options={whOptions}
            getOptionLabel={(o) => o?.label || ""}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            value={whOptions.find((o) => o.code === adj.whCode) || null}
            onChange={(_, v) =>
              setAdj((s) => ({ ...s, whCode: v?.code || "" }))
            }
            renderInput={(p) => <TextField {...p} label="Warehouse *" />}
            sx={{ minWidth: 240 }}
          />

          <Autocomplete
            size="small"
            options={[
              { label: "Increase", value: "increase" },
              { label: "Decrease", value: "decrease" },
            ]}
            getOptionLabel={(o) => o?.label || ""}
            isOptionEqualToValue={(o, v) => o.value === v.value}
            value={
              adj.direction
                ? {
                    label:
                      adj.direction === "increase"
                        ? "Increase"
                        : "Decrease",
                    value: adj.direction,
                  }
                : null
            }
            onChange={(_, v) =>
              setAdj((s) => ({ ...s, direction: v?.value || "" }))
            }
            renderInput={(p) => <TextField {...p} label="Direction *" />}
            sx={{ minWidth: 180 }}
          />

          <TextField
            size="small"
            label="Reason (AI will suggest if empty)"
            value={adj.reason}
            onChange={(e) =>
              setAdj((s) => ({ ...s, reason: e.target.value }))
            }
            sx={{ minWidth: 220 }}
          />

          {/* 🔹 Flow manager suggestions – Prepared By / Approved By use person list */}
          <Autocomplete
            freeSolo
            size="small"
            options={personNames}
            inputValue={preparedByInput}
            onInputChange={(_, v) => {
              setPreparedByInput(v);
              setAdj((s) => ({ ...s, preparedBy: v }));
            }}
            onChange={(_, v) => {
              const val = typeof v === "string" ? v : v || "";
              setPreparedByInput(val);
              setAdj((s) => ({ ...s, preparedBy: val }));
            }}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Flow Manager / Prepared By"
                placeholder="Search by name"
              />
            )}
            sx={{ minWidth: 220 }}
          />
          <Autocomplete
            freeSolo
            size="small"
            options={personNames}
            inputValue={approvedByInput}
            onInputChange={(_, v) => {
              setApprovedByInput(v);
              setAdj((s) => ({ ...s, approvedBy: v }));
            }}
            onChange={(_, v) => {
              const val = typeof v === "string" ? v : v || "";
              setApprovedByInput(val);
              setAdj((s) => ({ ...s, approvedBy: val }));
            }}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Approver (optional)"
                placeholder="Search by name"
              />
            )}
            sx={{ minWidth: 220 }}
          />
        </Stack>

        <TextField
          multiline
          minRows={2}
          fullWidth
          sx={{ mt: 1 }}
          size="small"
          label="Memo (AI will suggest if empty)"
          value={adj.memo}
          onChange={(e) =>
            setAdj((s) => ({ ...s, memo: e.target.value }))
          }
        />
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={onCreate}
            disabled={!canCreate || busy}
          >
            Add Adjustment
          </Button>
        </Stack>
      </Paper>

      {/* Daily Report Filters & Actions */}
      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 1 }}
        >
          <FilterListIcon fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Daily Adjustments Report
          </Typography>
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateFrom: e.target.value }))
            }
          />
          <TextField
            size="small"
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={filters.dateTo}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateTo: e.target.value }))
            }
          />
          <TextField
            size="small"
            label="Warehouse"
            value={filters.whCode}
            onChange={(e) =>
              setFilters((f) => ({ ...f, whCode: e.target.value }))
            }
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            label="Search (reason / memo / no.)"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            sx={{ minWidth: 260 }}
          />
          <Box flex={1} />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setPreviewOpen(true)}>
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
              title="Post all unposted adjustments for the From date"
            >
              Post All (date)
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* List */}
      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Recent Adjustments
          </Typography>
          <Chip
            size="small"
            label={loading ? "Loading…" : `${filteredRows.length} rows`}
          />
        </Stack>
        <Divider sx={{ mb: 1 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Date</strong>
              </TableCell>
              <TableCell>
                <strong>Adj No.</strong>
              </TableCell>
              <TableCell>
                <strong>Direction</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Qty</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Unit Cost</strong>
              </TableCell>
              <TableCell>
                <strong>Warehouse</strong>
              </TableCell>
              <TableCell>
                <strong>Reason</strong>
              </TableCell>
              <TableCell>
                <strong>Status</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Actions</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((r) => {
              const dir = deriveDirection(r);
              const qtyEff = deriveQtyAbs(r);
              const status = uiStatus(r);
              const isPosted = status === "posted";

              return (
                <TableRow key={r._id || r.id}>
                  <TableCell>{fmtDate(r.date)}</TableCell>
                  <TableCell>{r.adjNo || r.reference || "—"}</TableCell>
                  <TableCell>
                    {dir
                      ? dir.charAt(0).toUpperCase() + dir.slice(1)
                      : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {qtyEff.toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    {Number(r.unitCost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {r.whCode || r.warehouseCode || "—"}
                  </TableCell>
                  <TableCell>{r.reason || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={
                        status === "posted"
                          ? "success"
                          : status === "approved"
                          ? "primary"
                          : "default"
                      }
                      label={status}
                    />
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
                        disabled={busy || isPosted}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<SendIcon fontSize="small" />}
                        onClick={() => onPost(r._id || r.id)}
                        disabled={busy || isPosted}
                        sx={{ minWidth: 80 }}
                      >
                        Post
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<DeleteOutlineIcon fontSize="small" />}
                        onClick={() => onDelete(r)}
                        disabled={busy}
                        sx={{ minWidth: 80 }}
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
                    No adjustments for current filters.
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Adjustments Report Preview</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Date: {filters.dateFrom}{" "}
            {filters.dateTo && filters.dateTo !== filters.dateFrom
              ? `→ ${filters.dateTo}`
              : ""}{" "}
            • Warehouse: {filters.whCode || "All"} • Search:{" "}
            {filters.search || "—"}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Description</strong>
                </TableCell>
                <TableCell>
                  <strong>Adj No.</strong>
                </TableCell>
                <TableCell>
                  <strong>Direction</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Qty</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Unit Cost</strong>
                </TableCell>
                <TableCell>
                  <strong>Warehouse</strong>
                </TableCell>
                <TableCell>
                  <strong>Reason</strong>
                </TableCell>
                <TableCell>
                  <strong>Status</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((r) => {
                const dir = deriveDirection(r);
                const qtyEff = deriveQtyAbs(r);
                const status = uiStatus(r);
                return (
                  <TableRow key={(r._id || r.id) + "-pv"}>
                    <TableCell>{r.memo || "—"}</TableCell>
                    <TableCell>{r.adjNo || r.reference || "—"}</TableCell>
                    <TableCell>
                      {(dir || "").toUpperCase() || "—"}
                    </TableCell>
                    <TableCell align="right">
                      {qtyEff.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      {Number(r.unitCost || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {r.whCode || r.warehouseCode || "—"}
                    </TableCell>
                    <TableCell>{r.reason || "—"}</TableCell>
                    <TableCell>
                      {String(status || "draft").toUpperCase()}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={3}>
                  <strong>Totals</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{reportTotals.qty.toLocaleString()}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{reportTotals.value.toFixed(2)}</strong>
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button
            onClick={exportPdf}
            startIcon={<PictureAsPdfIcon />}
            variant="contained"
            color="secondary"
          >
            Save PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onClose={closeEdit}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Adjustment</DialogTitle>
        <DialogContent dividers>
          {editDraft && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField
                  size="small"
                  type="date"
                  label="Date"
                  InputLabelProps={{ shrink: true }}
                  value={editDraft.date}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      date: e.target.value,
                    }))
                  }
                />
                <TextField
                  size="small"
                  label="Item SKU"
                  value={editDraft.itemSku}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      itemSku: e.target.value,
                    }))
                  }
                  sx={{ minWidth: 180 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Qty"
                  value={editDraft.qty}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      qty: e.target.value,
                    }))
                  }
                  inputProps={{ min: 0, step: "0.01" }}
                />
                <TextField
                  size="small"
                  label="UoM"
                  value={editDraft.uom}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      uom: e.target.value,
                    }))
                  }
                />
                <TextField
                  size="small"
                  type="number"
                  label="Unit Cost"
                  value={editDraft.unitCost}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      unitCost: e.target.value,
                    }))
                  }
                  inputProps={{ min: 0, step: "0.01" }}
                />
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField
                  size="small"
                  label="Warehouse"
                  value={editDraft.whCode}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      whCode: e.target.value,
                    }))
                  }
                  sx={{ minWidth: 180 }}
                />
                <Autocomplete
                  size="small"
                  options={[
                    { label: "Increase", value: "increase" },
                    { label: "Decrease", value: "decrease" },
                  ]}
                  getOptionLabel={(o) => o?.label || ""}
                  isOptionEqualToValue={(o, v) => o.value === v.value}
                  value={
                    editDraft.direction
                      ? {
                          label:
                            editDraft.direction === "increase"
                              ? "Increase"
                              : "Decrease",
                          value: editDraft.direction,
                        }
                      : null
                  }
                  onChange={(_, v) =>
                    setEditDraft((s) => ({
                      ...s,
                      direction: v?.value || "increase",
                    }))
                  }
                  renderInput={(p) => (
                    <TextField {...p} label="Direction" />
                  )}
                  sx={{ minWidth: 180 }}
                />
                <TextField
                  size="small"
                  label="Reason"
                  value={editDraft.reason}
                  onChange={(e) =>
                    setEditDraft((s) => ({
                      ...s,
                      reason: e.target.value,
                    }))
                  }
                  sx={{ minWidth: 260 }}
                />
              </Stack>
              <TextField
                multiline
                minRows={2}
                fullWidth
                size="small"
                label="Memo"
                value={editDraft.memo}
                onChange={(e) =>
                  setEditDraft((s) => ({
                    ...s,
                    memo: e.target.value,
                  }))
                }
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button
            onClick={onEditSave}
            variant="contained"
            disabled={busy}
          >
            Save
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
