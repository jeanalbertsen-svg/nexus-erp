// PART 1/5 — Imports + Theme (mobile-safe, no horizontal scroll, best-practice density)
// Notes applied:
// ✅ removed duplicate Paper import + added TableContainer correctly
// ✅ CssBaseline global overrides: prevent iOS text autosize, stop horizontal overflow, smooth scroll
// ✅ MuiPaper/MuiDialog: prevent children forcing horizontal overflow
// ✅ MuiTableContainer default: overflowX auto (tables never break mobile)
// ✅ MuiDrawer: iOS momentum scrolling inside drawer

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CssBaseline,
  Box,
  Divider,
  Paper,
  Stack,
  Chip,
  Grid,
  Alert,
  AlertTitle,
  TextField,
  useMediaQuery,
  ListSubheader,
  Collapse,
  Button,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  TableContainer,
} from "@mui/material";
import { createTheme, ThemeProvider, useTheme, styled } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TuneIcon from "@mui/icons-material/Tune";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import BookIcon from "@mui/icons-material/Book";
import BalanceIcon from "@mui/icons-material/Balance";
import StorefrontIcon from "@mui/icons-material/Storefront";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import DataObjectIcon from "@mui/icons-material/DataObject";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import InboxIcon from "@mui/icons-material/Inbox";
import InsightsIcon from "@mui/icons-material/Insights";

/* === Pages === */
import GLDashboard from "./pages/GLDashboard.jsx";
import JEDashboard from "./pages/JEDashboard.jsx";
import TrialBalance from "./pages/TrialBalance.jsx";
import Reports from "./pages/Reports.jsx";
import BalanceSheet from "./pages/BalanceSheet.jsx";
import ChartOfAccounts from "./pages/ChartOfAccounts.jsx";
import Invoices from "./pages/Invoice.jsx";
import PurchaseInvoicesPage from "./pages/PurchaseInvoice.jsx";

/* === Inventory pages === */
import InventoryStockMove from "./pages/Inventory_StockMove.jsx";
import InventoryItem from "./pages/Inventory_Item.jsx";
import InventoryAdjustments from "./pages/Inventory_Adjustments.jsx";
import InventoryWarehouses from "./pages/Inventory_Warehouses.jsx";

/* === Admin: Back-Office Inbox (email ingest) === */
import BilagsInbox from "./pages/BilagsInbox.jsx";

/* 🌟 Admin – Project Management */
import AdminProjectManagement from "./pages/AdminProjectManagement.jsx";

/* 🌟 Login page */
import Login from "./pages/Login.jsx";

/* === API === */
import {
  getAccounts,
  getGL,
  createGLEntry,
  updateGLEntry,
  deleteGLEntry,
  getJournalEntries,
  createJournal,
  updateJournal,
  deleteJournal,
  approveJournal,
  postJournal,

  // Purchasing (Supplier) Invoices API
  listPurchaseInvoices,
  getPurchaseInvoice,
  createPurchaseInvoice,
  updatePurchaseInvoice,
  deletePurchaseInvoice,
  postPurchaseInvoice,

  // Inventory API (items / moves / warehouses)
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,

  listStockMoves,
  createStockMove,
  deleteStockMove,
  postStockMove,

  // 🌟 Admin / Project Management API
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from "./api.js";

/* ---------- COLORS ---------- */
const HEADER_BG = "#0c193fff";
const NAV_HILITE = "rgba(6, 20, 46, 0.86)";
const NAV_HILITE_HOVER = "rgba(2, 7, 15, 0.72)";

/* ---------- THEME ---------- */
const MODE_LS_KEY = "app.theme.mode";
const AUTH_LS_KEY = "erp.auth.user";

function buildTheme(mode = "light") {
  const isDark = mode === "dark";

  return createTheme({
    spacing: 6,

    palette: {
      mode,
      primary: { main: "#0E4C92" },
      secondary: { main: "#2DBE89" },
      background: { default: isDark ? "#0b0f16" : "#f0f3fb" },
      text: {
        primary: isDark ? "#EDEDED" : "#0e1320",
        secondary: isDark ? "#B5B5B5" : "#5b6474",
      },
      divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
    },

    shape: { borderRadius: 10 },

    typography: {
      htmlFontSize: 13,
      fontSize: 12,
      h5: { fontSize: "1.15rem", fontWeight: 600 },
      h6: { fontSize: "1.0rem", fontWeight: 600 },
      subtitle1: { fontSize: "0.9rem" },
      body1: { fontSize: "0.85rem" },
      body2: { fontSize: "0.8rem" },
      caption: { fontSize: "0.72rem" },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            WebkitTextSizeAdjust: "100%",
            textSizeAdjust: "100%",
            overflowX: "hidden",
            height: "100%",
            backgroundColor: "#020309", // ✅ fallback, prevents white
          },
          body: {
            margin: 0,
            height: "100%",
            overflowX: "hidden",
            backgroundColor: "#020309", // ✅ fallback, prevents white
            overscrollBehaviorX: "none",
          },
          "#root": {
            minHeight: "100%",
            width: "100%",
            overflowX: "hidden",
            maxWidth: "none !important",
            margin: "0 !important",

            // ✅ CRITICAL: prevents "white strip" bug caused by zoom/transform
            transform: "none !important",
            zoom: "1 !important",

            backgroundColor: "#020309", // ✅ fallback, prevents white
          },
          img: { maxWidth: "100%", height: "auto" },
        },
      },

      MuiTextField: { defaultProps: { size: "small" } },
      MuiButton: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: {
            minHeight: 30,
            padding: "3px 10px",
            fontSize: "0.78rem",
            borderRadius: 8,
            textTransform: "none",
          },
        },
      },
      MuiChip: { styleOverrides: { root: { height: 22, fontSize: "0.72rem" } } },
      MuiIconButton: { defaultProps: { size: "small" } },

      MuiListItemButton: { styleOverrides: { root: { paddingTop: 6, paddingBottom: 6 } } },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 32, color: "#114b8dff" } } },

      MuiToolbar: { styleOverrides: { root: { minHeight: 48 } } },

      // ✅ Tables never force page overflow (mobile ERP best practice)
      MuiTableContainer: {
        styleOverrides: {
          root: {
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          },
        },
      },

      // ✅ Prevent nested content from forcing horizontal overflow
      MuiPaper: { styleOverrides: { root: { minWidth: 0 } } },
      MuiDialog: { styleOverrides: { paper: { maxWidth: "100%", margin: 12 } } },

      // ✅ Better drawer scroll on iOS
      MuiDrawer: {
        styleOverrides: {
          paper: { WebkitOverflowScrolling: "touch" },
        },
      },
    },
  });
}

// Desktop drawer fixed width; mobile uses responsive width in Shell
const drawerWidth = 240;

/* ---------- UTIL ---------- */
const fmtKr = (n) =>
  (n ?? 0).toLocaleString("da-DK", {
    style: "currency",
    currency: "DKK",
  });

const monthKey = (dateStr) => String(dateStr || "").slice(0, 7); // YYYY-MM
const isRevenueAcc = (acc) => /^4\d{3}$/.test(String(acc));
const isExpenseAcc = (acc) => /^(5|6|7|8|9)\d{3}$/.test(String(acc));
const isCashLike = (acc) => ["1000", "1010", "1100"].includes(String(acc));
const isAR = (acc) => String(acc) === "1200";
const isAP = (acc) => String(acc) === "2000";
// PART 2/5 — Charts + Nav model + helpers (same logic, kept as-is)

function LineChartBasic({ data = [], xKey, yKeys = [], colors = [] }) {
  const w = 600,
    h = 240,
    pad = 36;
  const keys = yKeys.length ? yKeys : Object.keys(data[0] || {}).filter((k) => k !== xKey);
  const cols = colors.length ? colors : ["#2DBE89", "#FF7043", "#0E4C92"];
  const maxY = Math.max(1, ...data.flatMap((d) => keys.map((k) => Math.max(0, Number(d[k]) || 0))));
  const x = (i) => pad + (data.length > 1 ? (i * (w - 2 * pad)) / (data.length - 1) : 0);
  const y = (v) => h - pad - (v / maxY) * (h - 2 * pad);
  const grid = Array.from({ length: 5 }, (_, i) => y(((i + 1) * maxY) / 5));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" role="img" aria-label="Line chart">
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      {grid.map((gy, i) => (
        <line key={i} x1={pad} x2={w - pad} y1={gy} y2={gy} stroke="#e0e0e0" strokeDasharray="3 3" />
      ))}
      <line x1={pad} x2={pad} y1={pad} y2={h - pad} stroke="#999" />
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="#999" />
      {keys.map((k, idx) => {
        const d = data
          .map((row, i) => {
            const cmd = i === 0 ? "M" : "L";
            return `${cmd} ${x(i)} ${y(Math.max(0, Number(row[k]) || 0))}`;
          })
          .join(" ");
        return <path key={k} d={d} fill="none" stroke={cols[idx % cols.length]} strokeWidth="2" />;
      })}
      {data.map((row, i) => (
        <text key={i} x={x(i)} y={h - pad + 14} fontSize="10" textAnchor="middle">
          {String(row[xKey] || "")}
        </text>
      ))}
    </svg>
  );
}

function BarChartBasic({ data = [], xKey, bars = [], colors = [] }) {
  const w = 600,
    h = 240,
    pad = 36;
  const keys = bars.length ? bars : Object.keys(data[0] || {}).filter((k) => k !== xKey);
  const cols = colors.length ? colors : ["#0E4C92", "#EC407A", "#2DBE89"];
  const maxY = Math.max(1, ...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)));
  const slot = (w - 2 * pad) / (data.length || 1);
  const barW = Math.max(6, Math.min(28, slot / Math.max(1, keys.length + 0.5)));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" role="img" aria-label="Bar chart">
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      <line x1={pad} x2={pad} y1={pad} y2={h - pad} stroke="#999" />
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="#999" />
      {data.map((row, i) => {
        const xCenter = pad + i * slot + slot / 2;
        const totalBarWidth = keys.length * barW + (keys.length - 1) * 4;
        const x0 = xCenter - totalBarWidth / 2;
        return keys.map((k, j) => {
          const v = Math.max(0, Number(row[k]) || 0);
          const bh = (v * (h - 2 * pad)) / Math.max(1, maxY);
          const x = x0 + j * (barW + 4);
          const y = h - pad - bh;
          return <rect key={`${i}-${k}`} x={x} y={y} width={barW} height={bh} rx="2" fill={cols[j % cols.length]} />;
        });
      })}
      {data.map((row, i) => (
        <text key={i} x={pad + i * slot + slot / 2} y={h - pad + 14} fontSize="10" textAnchor="middle">
          {String(row[xKey] || "")}
        </text>
      ))}
    </svg>
  );
}

/* ---------- NAV MODEL ---------- */
const TOP = [
  { key: "overview", label: "Overview", icon: <DashboardIcon /> },
  { key: "sales", label: "Sales", icon: <StorefrontIcon /> },
  { key: "purchasing", label: "Purchasing", icon: <ShoppingCartIcon /> },
  { key: "inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { key: "finance", label: "Finance", icon: <AccountBalanceIcon /> },
  { key: "reports", label: "Reports & BI", icon: <AssessmentIcon /> },
  { key: "admin", label: "Admin / Settings", icon: <SettingsIcon /> },
];

const SECOND = {
  sales: [
    { key: "quotations", label: "Quotations", icon: <AssignmentIcon /> },
    { key: "sales-orders", label: "Sales Orders", icon: <PlaylistAddCheckIcon /> },
    { key: "deliveries", label: "Deliveries", icon: <LocalShippingIcon /> },
    { key: "invoices", label: "Invoices (Sales)", icon: <ReceiptLongIcon /> },
    { key: "returns", label: "Returns / Credit Notes", icon: <PriceChangeIcon /> },
    { key: "price-lists", label: "Price Lists", icon: <PriceChangeIcon /> },
    { key: "customers", label: "Customers", icon: <StorefrontIcon /> },
  ],
  purchasing: [
    { key: "requisitions", label: "Requisitions", icon: <AssignmentIcon /> },
    { key: "rfqs", label: "RFQs", icon: <AssignmentIcon /> },
    { key: "purchase-orders", label: "Purchase Orders", icon: <PlaylistAddCheckIcon /> },
    { key: "receipts", label: "Receipts", icon: <LocalShippingIcon /> },
    { key: "supplier-invoices", label: "Supplier Invoices", icon: <ReceiptLongIcon /> },
    { key: "suppliers", label: "Suppliers", icon: <StorefrontIcon /> },
  ],
  inventory: [
    { key: "items", label: "Items / Products", icon: <Inventory2Icon /> },
    { key: "stock-moves", label: "Stock Moves", icon: <SwapHorizIcon /> },
    { key: "adjustments", label: "Adjustments", icon: <TuneIcon /> },
    { key: "warehouses", label: "Warehouses", icon: <WarehouseIcon /> },
  ],
  finance: [
    { key: "journal", label: "Journal", icon: <BookIcon /> },
    { key: "gl", label: "General Ledger", icon: <BookIcon /> },
    { key: "trial", label: "Trial Balance", icon: <BalanceIcon /> },
    { key: "coa", label: "Chart Of Accounts", icon: <BookIcon /> },
    { key: "ar", label: "Accounts Receivable", icon: <ReceiptLongIcon /> },
    { key: "ap", label: "Accounts Payable", icon: <ReceiptLongIcon /> },
    { key: "bank-cash", label: "Bank & Cash", icon: <AccountBalanceIcon /> },
    { key: "tax", label: "Tax & Compliance", icon: <AssignmentIcon /> },
    { key: "closing", label: "Closing & Periods", icon: <AssignmentIcon /> },
  ],
  admin: [
    { key: "inbox", label: "Back-Office Inbox", icon: <InboxIcon /> },
    { key: "projects", label: "Project Management", icon: <AssignmentIcon /> },
    { key: "company", label: "Company & Fiscal Year", icon: <AssignmentIcon /> },
    { key: "users", label: "Users & Roles", icon: <SettingsIcon /> },
    { key: "workflows", label: "Approval Workflows", icon: <SettingsIcon /> },
    { key: "templates", label: "Document Templates", icon: <AssignmentIcon /> },
    { key: "integrations", label: "Integrations & APIs", icon: <SettingsIcon /> },
    { key: "master-data", label: "Master Data", icon: <SettingsIcon /> },
  ],
};

function sectionFromPath(pathname) {
  const [, sec] = pathname.split("/");
  if (!sec) return "overview";
  if (TOP.some((t) => t.key === sec)) return sec;

  if (["gl", "journal", "trial", "coa", "finance", "reports", "inventory"].includes(sec)) {
    return sec === "reports" ? "reports" : sec === "inventory" ? "inventory" : "finance";
  }

  if (["company", "users", "workflows", "templates", "integrations", "master-data", "inbox", "projects"].includes(sec)) {
    return "admin";
  }
  return "overview";
}

/* ---------- GL→Inventory auto-sync helpers ---------- */
const INV_TAG_JSON = /INV\s*\{([^}]*)\}/i;
const INV_TAG_KV = /INV\s*:\s*([^\r\n]+)/i;

function parseInventoryDirective(text = "") {
  const s = String(text || "");
  if (!s.toUpperCase().includes("INV")) return null;

  const jm = s.match(INV_TAG_JSON);
  if (jm) {
    try {
      return JSON.parse(`{${jm[1]}}`);
    } catch {
      // ignore JSON parse error
    }
  }

  const km = s.match(INV_TAG_KV);
  if (km) {
    const out = {};
    km[1]
      .split(/[;|,]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [k, ...rest] = pair.split("=");
        const v = rest.join("=").trim();
        const keyTrim = (k || "").trim();
        if (keyTrim && v) out[keyTrim] = v;
      });
    if (Object.keys(out).length) return out;
  }
  return null;
}

const INV_SYNC_LS = "inv.synced.keys";
const getSyncedSet = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(INV_SYNC_LS) || "[]"));
  } catch {
    return new Set();
  }
};
const setSyncedSet = (set) => {
  try {
    localStorage.setItem(INV_SYNC_LS, JSON.stringify([...set]));
  } catch {
    // ignore
  }
};
const buildSyncKey = (r) =>
  [
    String(r.date).slice(0, 10),
    r.reference || r.jeNumber || r.journalNo || "",
    String(r.account),
    String(r.debit || 0),
    String(r.credit || 0),
  ].join("|");

/* ---------- AI Business Health helper ---------- */
function buildBusinessHealthNews(health) {
  if (!health) return null;

  const {
    overallScore = 0,
    profitabilityScore = 0,
    liquidityScore = 0,
    collectionsScore = 0,
    payablesScore = 0,
    dataQualityScore = 0,
  } = health;

  const kpis = [
    { key: "profitabilityScore", label: "Profitability" },
    { key: "liquidityScore", label: "Liquidity (Cash vs A/P)" },
    { key: "collectionsScore", label: "Collections (A/R)" },
    { key: "payablesScore", label: "Payables discipline" },
    { key: "dataQualityScore", label: "Data quality" },
  ];

  const sorted = [...kpis].sort((a, b) => (health[a.key] || 0) - (health[b.key] || 0));
  const worst = sorted[0];
  const second = sorted[1];
  const best = sorted[sorted.length - 1];

  const headline =
    overallScore >= 75
      ? "Business health is strong – focus on scaling what already works."
      : overallScore >= 50
      ? "Business health is moderate – address weak spots before scaling."
      : "Business health is under pressure – stabilise core finances first.";

  const summary = `Overall business health for Acta Venture Partners is estimated at ${overallScore.toFixed(
    0
  )}%. The weakest area right now is ${worst.label.toLowerCase()}, followed by ${second.label.toLowerCase()}. The strongest area is ${best.label.toLowerCase()}, which you can leverage as a foundation for improvement.`;

  const priorities = [
    `Stabilise ${worst.label.toLowerCase()} first. This is currently the lowest-scoring KPI and should be treated as your primary focus in the next 30–60 days.`,
    `Address ${second.label.toLowerCase()} as the second priority. Improving this will visibly strengthen your monthly reporting and cash picture.`,
    `Protect and build on ${best.label.toLowerCase()}. Use this strength as a platform when communicating with investors, banks and key stakeholders.`,
  ];

  const ranking = sorted.map((kpi) => ({
    key: kpi.key,
    label: kpi.label,
    score: health[kpi.key] || 0,
  }));

  return { headline, summary, priorities, ranking };
}

/* Map each KPI to the most relevant ERP module route */
const KPI_MODULE_ROUTES = {
  profitabilityScore: { label: "Open Reports (P&L & KPIs)", path: "/reports" },
  liquidityScore: { label: "Open Balance Sheet (Liquidity)", path: "/reports/balance-sheet" },
  collectionsScore: { label: "Open Sales Invoices (A/R)", path: "/sales/invoices" },
  payablesScore: { label: "Open Supplier Invoices (A/P)", path: "/purchasing/supplier-invoices" },
  dataQualityScore: { label: "Open Journal & GL", path: "/finance/journal" },
};
// PART 3/5 — Shell state + drawer + header (mobile-safe drawer + no overflow traps)
// Notes applied:
// ✅ AppBar title block kept optional (yours commented); safe-area top already there
// ✅ DrawerContent scroll: iOS momentum + minWidth 0
// ✅ Drawer on mobile: also adds safe-area bottom padding inside drawer

function Shell({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const themeMUI = useTheme();

  const isDesktop = useMediaQuery(themeMUI.breakpoints.up("md"));
  const isPhone = useMediaQuery(themeMUI.breakpoints.down("sm"));
   // 👇 ADD THIS EXACTLY HERE
  const drawerScrollRef = useRef(null);

  /* Theme */
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(MODE_LS_KEY) || (prefersDark ? "dark" : "light");
    } catch {
      return prefersDark ? "dark" : "light";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(MODE_LS_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const appTheme = useMemo(() => buildTheme(mode), [mode]);

  /* State */
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [accounts, setAccounts] = useState([]);
  const [glRows, setGLRows] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);

  const [localGL, setLocalGL] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("gl.rows") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const onAdded = (e) => {
      const added = Array.isArray(e?.detail) ? e.detail : [];
      if (added.length) setLocalGL((prev) => [...prev, ...added]);
    };
    const onStorage = (ev) => {
      if (ev.key === "gl.rows") {
        try {
          setLocalGL(JSON.parse(ev.newValue || "[]"));
        } catch {
          // ignore
        }
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
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    };
    (a || []).forEach(push);
    (b || []).forEach(push);
    return out;
  };

  const glAll = useMemo(() => mergeDedupRows(glRows, localGL), [glRows, localGL]);

  /* API calls */
  const refetchAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("getAccounts failed", e);
    }
  };
  const refetchGL = async () => {
    try {
      const data = await getGL();
      setGLRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("getGL failed", e);
    }
  };
  const refetchJournals = async () => {
    try {
      const data = await getJournalEntries();
      setJournalEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("getJournalEntries failed", e);
    }
  };

  /* GL CRUD */
  const addGl = async (entry) => {
    await createGLEntry(entry);
    await refetchGL();
  };
  const updGl = async (id, entry) => {
    if (!id) return;
    await updateGLEntry(id, entry);
    await refetchGL();
  };
  const delGl = async (id) => {
    if (!id) return;
    await deleteGLEntry(id);
    await refetchGL();
  };

  /* JE handlers */
  const onCreateJE = async (payload) => {
    const res = await createJournal(payload);
    await refetchJournals();
    return res;
  };
  const onUpdateJE = async (id, payload) => {
    await updateJournal(id, payload);
    await refetchJournals();
  };
  const onDeleteJE = async (id) => {
    await deleteJournal(id);
    await refetchJournals();
  };
  const onApproveJE = async (id, patch = {}) => {
    await approveJournal(id, patch);
    await refetchJournals();
  };
  const onPostJE = async (id, patch = {}) => {
    await postJournal(id, patch);
    await Promise.all([refetchJournals(), refetchGL()]);
  };

  /* Initial loads & route-based refresh */
  useEffect(() => {
    refetchAccounts();
    refetchGL();
    refetchJournals();
  }, []);

  useEffect(() => {
    if (
      ["/", "/finance/finance-docs", "/finance", "/reports", "/finance/gl", "/finance/journal", "/inventory", "/admin/inbox"].some(
        (p) => location.pathname.startsWith(p)
      )
    ) {
      refetchGL();
      refetchJournals();
    }
  }, [location.pathname]);

  /* 🔗 Admin Inbox navigation bridge */
  useEffect(() => {
    const onNavInbox = (e) => {
      const docId = e?.detail?.docId || null;
      navigate("/admin/inbox", { state: { focusDocId: docId } });
      setMobileOpen(false);
    };
    window.addEventListener("bilags:navigate-inbox", onNavInbox);
    return () => window.removeEventListener("bilags:navigate-inbox", onNavInbox);
  }, [navigate]);

  /* ---------- Drawer UI ---------- */
  const activeSection = sectionFromPath(location.pathname);
  const [openGroups, setOpenGroups] = useState(() => ({ [activeSection]: true }));
  useEffect(() => {
    setOpenGroups((g) => ({ ...g, [activeSection]: true }));
  }, [activeSection]);

  const navItemSX = {
    py: 0.5,
    "& .MuiListItemIcon-root": { minWidth: 34 },
    "& .MuiListItemText-primary": { fontSize: "0.9rem" },
    "&.Mui-selected": {
      bgcolor: NAV_HILITE,
      color: "#fff",
      "& .MuiListItemIcon-root": { color: "#fff" },
      "&:hover": { bgcolor: NAV_HILITE_HOVER },
    },
  };

  // ✅ Mobile-friendly drawer width
  const mobileDrawerWidth = isPhone ? "86vw" : "78vw";
  const mobileDrawerMaxWidth = 360;
  useEffect(() => {
  // ✅ always show the top of the menu (Overview + Sales)
  if (drawerScrollRef.current) {
    drawerScrollRef.current.scrollTop = 0;
  }
}, [location.pathname, mobileOpen, isDesktop]);
  const DrawerContent = (
    <Box
      ref={drawerScrollRef}
      sx={{
        flex: 1,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        pb: "calc(env(safe-area-inset-bottom) + 8px)",
      }}
      >
      <Toolbar />
      <Divider />

      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          pb: "calc(env(safe-area-inset-bottom) + 8px)",
        }}
      >
        <List sx={{ py: 0 }}>
          {TOP.map((t) => {
            const isActive = activeSection === t.key;
            return (
              <Box key={t.key}>
                <ListItemButton
                  sx={navItemSX}
                  selected={isActive}
                  onClick={() => {
                    const target = t.key === "overview" ? "/" : `/${t.key}`;
                    if (isActive) {
                      setOpenGroups((g) => ({ ...g, [t.key]: !g[t.key] }));
                    } else {
                      navigate(target);
                      setOpenGroups((g) => ({ ...g, [t.key]: true }));
                    }
                    setMobileOpen(false);
                  }}
                >
                  <ListItemIcon>{t.icon}</ListItemIcon>
                  <ListItemText primary={t.label} />
                  {openGroups[t.key] ? (
                    <ExpandLess sx={{ color: "primary.main" }} />
                  ) : (
                    <ExpandMore sx={{ color: "primary.main" }} />
                  )}
                </ListItemButton>

                <Collapse in={!!openGroups[t.key]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {(SECOND[t.key] || []).map((s) => {
                      const base = t.key === "overview" ? "/" : `/${t.key}`;
                      const path = s.key ? `${base}/${s.key}` : base;
                      const selected = location.pathname === path || (path === "/" && location.pathname === "/");

                      return (
                        <ListItemButton
                          key={`${t.key}-${s.key}`}
                          sx={{ pl: 6, ...navItemSX }}
                          selected={selected}
                          onClick={() => {
                            navigate(path);
                            setMobileOpen(false);
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>{s.icon}</ListItemIcon>
                          <ListItemText primary={s.label} />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>

        <Box sx={{ flexGrow: 1 }} />
        <Divider />

        <List subheader={<ListSubheader disableSticky>Quick</ListSubheader>}>
          <ListItemButton
            sx={navItemSX}
            onClick={() => {
              navigate("/finance/journal");
              setMobileOpen(false);
            }}
          >
            <ListItemIcon>
              <BookIcon />
            </ListItemIcon>
            <ListItemText primary="New Journal Entry" />
          </ListItemButton>
        </List>

        <Box sx={{ pb: 2 }} />
      </Box>
    </Box>
  );

  /* ---------- APP-WIDE GL → INVENTORY SYNC ---------- */
  const _yyyymmdd = (iso) => (iso || new Date().toISOString().slice(0, 10)).replaceAll("-", "");
  const _nextSeq = (prefix, dateISO) => {
    const k = `inv.seq.${prefix}.${_yyyymmdd(dateISO)}`;
    let n = 0;
    try {
      n = Number(localStorage.getItem(k) || "0");
    } catch {
      // ignore
    }
    n += 1;
    try {
      localStorage.setItem(k, String(n));
    } catch {
      // ignore
    }
    return n;
  };
  const _docNo = (prefix, dateISO) =>
    `${prefix}-${_yyyymmdd(dateISO)}-${String(_nextSeq(prefix, dateISO)).padStart(4, "0")}`;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const r of glRows) {
        if (cancelled) return;

        const directive = parseInventoryDirective(r?.memo || "") || parseInventoryDirective(r?.reference || "");
        if (!directive) continue;

        const key = buildSyncKey(r);
        const synced = getSyncedSet();
        if (synced.has(key)) continue;

        const dir = String(directive.dir || directive.direction || "").toLowerCase();
        const itemSku = directive.sku || directive.item || directive.itemSku;
        const qty = Math.abs(Number(directive.qty ?? directive.quantity ?? 0)) || 0;
        const unitCost = Number(directive.cost ?? directive.unitCost ?? 0) || 0;
        const wh = directive.wh || directive.warehouse || "";

        let fromWhCode = directive.fromWh || directive.from || null;
        let toWhCode = directive.toWh || directive.to || null;
        if (!fromWhCode && !toWhCode && wh) {
          if (dir === "out") fromWhCode = wh;
          else if (dir === "in") toWhCode = wh;
        }

        if (!itemSku || !qty || (!fromWhCode && !toWhCode)) continue;

        try {
          const dateISO = String(r.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
          const moveNo = _docNo("MOVE", dateISO);
          const reference = r.reference || r.jeNumber || r.journalNo || _docNo("REF", dateISO);
          const itemNo = _docNo("ITEM", dateISO);

          const now = new Date().toISOString();
          const created = await createStockMove({
            itemNo,
            moveNo,
            reference,
            date: dateISO,
            itemSku,
            qty,
            uom: directive.uom || "pcs",
            unitCost,
            fromWhCode: fromWhCode || undefined,
            toWhCode: toWhCode || undefined,
            status: "approved",
            memo: directive.memo || (dir === "out" ? "Auto from GL (sale)" : "Auto from GL (purchase)"),
            participants: {
              preparedBy: { name: directive.preparedBy || "GL Sync", at: now },
              approvedBy: { name: directive.approvedBy || "GL Sync", at: now },
            },
          });

          const id = created?._id || created?.id;
          if (id) {
            await postStockMove(id, { postedBy: "GL Sync" });
            const s = getSyncedSet();
            s.add(key);
            setSyncedSet(s);
          }
        } catch (e) {
          console.warn("[INV SYNC] create/post stock move failed:", e);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [glRows]);

  /* ---------- Invoice resolvers (GL ↔ Invoices link) ---------- */
  const invoiceResolvers = {
    getSalesByRef: async (_refNo) => null,
    getPurchaseByRef: async (refNo) => {
      try {
        const list = await listPurchaseInvoices();
        const hit = (Array.isArray(list) ? list : []).find(
          (x) => x?.invoiceNo === refNo || x?.number === refNo || x?.refNo === refNo
        );
        if (!hit) return null;
        if ((!hit.lines || !hit.lines.length) && getPurchaseInvoice) {
          const full = await getPurchaseInvoice(hit._id || hit.id);
          return full || hit;
        }
        return hit;
      } catch (e) {
        console.error("getPurchaseByRef failed", e);
        return null;
      }
    },
  };

  /* Dashboard data — uses glAll (API ⨁ local) */
  const glMonth = useMemo(() => glAll.filter((r) => monthKey(r.date) === selectedMonth), [glAll, selectedMonth]);

  const totals = useMemo(() => {
    const debit = glMonth.reduce((s, r) => s + (r.debit || 0), 0);
    const credit = glMonth.reduce((s, r) => s + (r.credit || 0), 0);
    return { debit, credit, balance: debit - credit };
  }, [glMonth]);

  const cashBalance = useMemo(
    () => glMonth.filter((r) => isCashLike(r.account)).reduce((s, r) => s + (r.debit || 0) - (r.credit || 0), 0),
    [glMonth]
  );
  const arBalance = useMemo(
    () => glMonth.filter((r) => isAR(r.account)).reduce((s, r) => s + (r.debit || 0) - (r.credit || 0), 0),
    [glMonth]
  );
  const apBalance = useMemo(
    () => glMonth.filter((r) => isAP(r.account)).reduce((s, r) => s + (r.credit || 0) - (r.debit || 0), 0),
    [glMonth]
  );

  const mtdRevenue = useMemo(
    () => glMonth.filter((r) => isRevenueAcc(r.account)).reduce((s, r) => s + (r.credit || 0) - (r.debit || 0), 0),
    [glMonth]
  );
  const mtdExpenses = useMemo(
    () => glMonth.filter((r) => isExpenseAcc(r.account)).reduce((s, r) => s + (r.debit || 0) - (r.credit || 0), 0),
    [glMonth]
  );
  const mtdNet = useMemo(() => mtdRevenue - mtdExpenses, [mtdRevenue, mtdExpenses]);

  const pendingJEs = useMemo(
    () => (journalEntries || []).filter((j) => (j.status || "draft") !== "posted").length,
    [journalEntries]
  );

  /* ---------- AI Business Health scoring (KPI Bars) ---------- */
  const businessHealth = useMemo(() => {
    const revenue = mtdRevenue;
    const net = mtdNet;

    let profitabilityScore = 50;
    if (revenue <= 0 && net <= 0) profitabilityScore = 40;
    else if (revenue > 0) {
      const margin = net / revenue;
      profitabilityScore = 50 + margin * 200;
    }

    const ap = Math.max(0, apBalance);
    const cashCoverage = ap > 0 ? cashBalance / ap : 1;
    let liquidityScore = 60 + (cashCoverage - 1) * 25;

    const ar = Math.max(0, arBalance);
    const arToRevenue = revenue > 0 ? ar / revenue : 0;
    let collectionsScore = 70;
    if (arToRevenue > 1.2) collectionsScore = 40;
    else if (arToRevenue > 0.6) collectionsScore = 55;

    const exp = Math.max(1, mtdExpenses);
    const apToExp = apBalance / exp;
    let payablesScore = 70;
    if (apToExp > 1.5) payablesScore = 50;
    else if (apToExp > 1.0) payablesScore = 60;

    let dataQualityScore = 90;
    if (Math.abs(totals.balance) > 1) dataQualityScore -= 20;
    if (pendingJEs > 5) dataQualityScore -= 10;

    const clamp = (v) => Math.max(0, Math.min(100, v));
    profitabilityScore = clamp(profitabilityScore);
    liquidityScore = clamp(liquidityScore);
    collectionsScore = clamp(collectionsScore);
    payablesScore = clamp(payablesScore);
    dataQualityScore = clamp(dataQualityScore);

    const overallScore = (profitabilityScore + liquidityScore + collectionsScore + payablesScore + dataQualityScore) / 5;

    return { overallScore, profitabilityScore, liquidityScore, collectionsScore, payablesScore, dataQualityScore };
  }, [mtdRevenue, mtdNet, cashBalance, arBalance, apBalance, mtdExpenses, totals.balance, pendingJEs]);

  const businessHealthNews = useMemo(() => buildBusinessHealthNews(businessHealth), [businessHealth]);
  const [bhDialogOpen, setBhDialogOpen] = useState(false);

  /* CSV export */
  const exportGL = (rows, filename = "general_ledger.csv") => {
    const header = ["Date", "Account", "Description", "Debit (kr)", "Credit (kr)", "Reference", "JE No."];
    const lines = (rows ?? glAll).map((r) =>
      [
        String(r.date).slice(0, 10),
        `"${String(r.account || "").replace(/"/g, '""')}"`,
        `"${String(r.memo || "").replace(/"/g, '""')}"`,
        (r.debit || 0).toFixed(2).replace(".", ","),
        (r.credit || 0).toFixed(2).replace(".", ","),
        `"${String(r.reference || "").replace(/"/g, '""')}"`,
        `"${String(r.jeNumber || r.journalNo || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", minHeight: "100dvh", overflowX: "hidden", width: "100%" }}>
        <AppBar
          position="fixed"
          sx={{
            zIndex: (t) => t.zIndex.drawer + 1,
            bgcolor: HEADER_BG,
            color: "#fff",
          }}
        >
          <Toolbar
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "nowrap",
              minHeight: { xs: 52, md: 56 },
              px: { xs: 1, md: 2 },
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => setMobileOpen(true)}
                sx={{ mr: 0.5, display: { md: "none" } }}
                aria-label="Open navigation menu"
              >
                <MenuIcon />
              </IconButton>
            </Box>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" } }} alignItems="center">
                <Chip label={`Debet ${fmtKr(totals.debit)}`} size="small" color="success" />
                <Chip label={`Kredit ${fmtKr(totals.credit)}`} size="small" color="error" />
                <Chip label={`Saldo ${fmtKr(totals.balance)}`} size="small" />
              </Stack>

              <Stack direction="row" spacing={0.5} sx={{ display: { xs: "flex", md: "none" } }} alignItems="center">
                <Chip
                  size="small"
                  variant="outlined"
                  sx={{
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.35)",
                    maxWidth: "42vw",
                    "& .MuiChip-label": {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  }}
                  label={`MTD: ${fmtKr(mtdNet)}`}
                />
                <Tooltip title="View priorities">
                  <IconButton color="inherit" onClick={() => setBhDialogOpen(true)} aria-label="Open performance priorities">
                    <InsightsIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Tooltip title="Notifications">
                <IconButton color="inherit" aria-label="Notifications">
                  <NotificationsIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
                <IconButton
                  color="inherit"
                  onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
                  aria-label="Toggle light/dark mode"
                >
                  {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
                </IconButton>
              </Tooltip>

              {onLogout && (
                <Button
                  color="inherit"
                  size="small"
                  sx={{ textTransform: "none", ml: 0.5, display: { xs: "none", sm: "inline-flex" } }}
                  onClick={onLogout}
                >
                  Logout
                </Button>
              )}
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Drawer */}
        {isDesktop ? (
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: drawerWidth,
                boxSizing: "border-box",
              },
            }}
            open
          >
            {DrawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                width: mobileDrawerWidth,
                maxWidth: mobileDrawerMaxWidth,
                boxSizing: "border-box",
              },
            }}
          >
            {DrawerContent}
          </Drawer>
        )}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { md: `calc(100% - ${drawerWidth}px)` },
            bgcolor: (t) => t.palette.background.default,
            paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "hidden",
          }}
        >
          <Toolbar />

          <Box
            sx={{
              mx: "auto",
              width: "100%",
              maxWidth: 1200,
              px: { xs: 1, sm: 2, md: 3 },
              py: { xs: 1, sm: 2 },
              minWidth: 0,
            }}
          >
            {(() => {
              function ModuleCard({ icon, title, subtitle, action, onClick, kpi }) {
                return (
                  <Paper
                    elevation={0}
                    sx={(t) => ({
                      p: 1.25,
                      borderRadius: 3,
                      border: `1px solid ${t.palette.divider}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      height: "100%",
                      background: t.palette.mode === "dark" ? "rgba(255,255,255,.03)" : "#fff",
                      minWidth: 0,
                    })}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box
                        sx={(t) => ({
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          bgcolor: t.palette.primary.main,
                          color: "#fff",
                          flex: "0 0 auto",
                        })}
                      >
                        {icon}
                      </Box>
                      <Typography variant="subtitle1" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {title}
                      </Typography>
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                      {subtitle}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
                      {kpi ? <Chip size="small" label={kpi} /> : <span />}
                      <Button size="small" variant="outlined" onClick={onClick}>
                        {action}
                      </Button>
                    </Stack>
                  </Paper>
                );
              }

              const GlassCard = styled(Paper)(({ theme }) => ({
                padding: theme.spacing(1.25),
                borderRadius: theme.shape.borderRadius * 1.2,
                background:
                  theme.palette.mode === "dark"
                    ? "linear-gradient(180deg, rgba(20,28,40,.8) 0%, rgba(12,19,33,.7) 100%)"
                    : "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: theme.shadows[3],
                minWidth: 0,
              }));

              function Panel({ title, action, children, sx }) {
                return (
                  <GlassCard sx={{ ...sx }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ minWidth: 0 }}>
                        {title}
                      </Typography>
                      <Box sx={{ flex: "0 0 auto" }}>{action}</Box>
                    </Stack>
                    {children}
                  </GlassCard>
                );
              }

              function StatCard({ icon, label, value, delta, positive }) {
                return (
                  <GlassCard>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                      <Avatar
                        sx={(t) => ({
                          width: 42,
                          height: 42,
                          bgcolor: positive === false ? t.palette.error.light : t.palette.primary.main,
                          color: "#fff",
                          flex: "0 0 auto",
                        })}
                        variant="rounded"
                      >
                        {icon}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexWrap: "wrap" }}>
                          <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
                            {value}
                          </Typography>
                          {typeof delta === "number" && (
                            <Chip
                              size="small"
                              icon={positive === false ? <ArrowDownwardIcon fontSize="inherit" /> : <ArrowUpwardIcon fontSize="inherit" />}
                              label={`${Math.abs(delta).toLocaleString("da-DK")} kr.`}
                              color={positive === false ? "error" : "success"}
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </GlassCard>
                );
              }

              function KPIBarRow({ label, score, hint }) {
                const pct = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
                return (
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between" sx={{ gap: 1 }}>
                      <Typography variant="body2" sx={{ minWidth: 0 }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ flex: "0 0 auto" }}>
                        {pct.toFixed(0)}%
                      </Typography>
                    </Stack>
                    <Box
                      sx={(t) => ({
                        height: 8,
                        borderRadius: 999,
                        bgcolor: t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                        overflow: "hidden",
                      })}
                    >
                      <Box
                        sx={(t) => ({
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: 999,
                          bgcolor: t.palette.primary.main,
                        })}
                      />
                    </Box>
                    {hint && (
                      <Typography variant="caption" color="text.secondary">
                        {hint}
                      </Typography>
                    )}
                  </Stack>
                );
              }

              const Overview = (
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                    <TextField
                      type="month"
                      label="Month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 240 } }}
                    />

                    <Box sx={{ flexGrow: 1 }} />

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
                      <Button fullWidth={isPhone} variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/finance/journal")}>
                        New JE
                      </Button>
                      <Button fullWidth={isPhone} variant="outlined" onClick={() => navigate("/finance/gl")}>
                        View GL
                      </Button>
                      <Button fullWidth={isPhone} variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => exportGL(glAll)}>
                        Export GL
                      </Button>
                    </Stack>
                  </Stack>

                  {(Math.abs(totals.balance) > 1e-6 || pendingJEs > 0) && (
                    <Alert severity={Math.abs(totals.balance) > 1e-6 ? "warning" : "info"} sx={{ borderRadius: 3 }}>
                      <AlertTitle>Attention</AlertTitle>
                      {Math.abs(totals.balance) > 1e-6 && (
                        <div>
                          GL not balanced for {selectedMonth}: Δ {fmtKr(totals.balance)}.
                        </div>
                      )}
                      {pendingJEs > 0 && <div>{pendingJEs} journal(s) pending approval/posting.</div>}
                    </Alert>
                  )}

                  <Paper sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                      ERP Modules Overview
                    </Typography>

                    <Grid container spacing={{ xs: 1, sm: 2 }}>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<Inventory2Icon />}
                          title="Inventory Management"
                          subtitle="Items, costs, on-hand, and movements."
                          action="Open Inventory"
                          onClick={() => navigate("/inventory/items")}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<WarehouseIcon />}
                          title="Warehouse Management"
                          subtitle="Locations, put-away, transfers, and counts."
                          action="Warehouses"
                          onClick={() => navigate("/inventory/warehouses")}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<LocalShippingIcon />}
                          title="Supply Chain"
                          subtitle="Suppliers, purchase orders, and receipts."
                          action="Purchasing"
                          onClick={() => navigate("/purchasing")}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<PlaylistAddCheckIcon />}
                          title="Order Processing"
                          subtitle="Quotes, sales orders, deliveries, and invoices."
                          action="Sales Orders"
                          onClick={() => navigate("/sales/sales-orders")}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<AccountBalanceIcon />}
                          title="Financial Accounting"
                          subtitle="Journals, GL, trial balance, close."
                          action="Open GL"
                          onClick={() => navigate("/finance/gl")}
                          kpi={`Open JEs: ${pendingJEs}`}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<AssessmentIcon />}
                          title="Management Accounting"
                          subtitle="P&L, Balance Sheet, KPIs & analysis."
                          action="Reports"
                          onClick={() => navigate("/reports")}
                          kpi={`MTD Net: ${fmtKr(mtdNet)}`}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<AssignmentIcon />}
                          title="Project Management"
                          subtitle="Jobs and approvals (scaffold)."
                          action="Workflows"
                          onClick={() => navigate("/admin/workflows")}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<DataObjectIcon />}
                          title="Data Services"
                          subtitle="Master data and integrations."
                          action="Integrations"
                          onClick={() => navigate("/admin/integrations")}
                        />
                      </Grid>
                      <Grid item xs={12} md={6} lg={4}>
                        <ModuleCard
                          icon={<PrecisionManufacturingIcon />}
                          title="Manufacturing"
                          subtitle="Issue/receive materials (use stock moves)."
                          action="Stock Moves"
                          onClick={() => navigate("/inventory/stock-moves")}
                        />
                      </Grid>
                    </Grid>
                  </Paper>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6} lg={3}>
                      <StatCard icon={<AccountBalanceIcon />} label="Cash (MTD)" value={fmtKr(cashBalance)} delta={0} positive />
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                      <StatCard icon={<ReceiptLongIcon />} label="A/R (MTD)" value={fmtKr(arBalance)} delta={0} positive />
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                      <StatCard icon={<ReceiptLongIcon />} label="A/P (MTD)" value={fmtKr(apBalance)} delta={0} positive={false} />
                    </Grid>
                    <Grid item xs={12} md={6} lg={3}>
                      <StatCard icon={<LightbulbIcon />} label="Net Income (MTD)" value={fmtKr(mtdNet)} delta={0} positive={mtdNet >= 0} />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={7}>
                      <Panel
                        title="Performance Insights & Priority Actions – Acta Venture Partners"
                        action={
                          businessHealth && (
                            <Chip size="small" color="primary" label={`Overall health: ${businessHealth.overallScore.toFixed(0)}%`} />
                          )
                        }
                      >
                        {businessHealth ? (
                          <Stack spacing={1.25}>
                            <KPIBarRow label="Profitability" score={businessHealth.profitabilityScore} hint="How effectively current revenue is converted into profit." />
                            <KPIBarRow label="Liquidity (Cash vs A/P)" score={businessHealth.liquidityScore} hint="Short-term ability to cover supplier obligations with available cash." />
                            <KPIBarRow label="Collections (A/R)" score={businessHealth.collectionsScore} hint="How much customer receivables are under control relative to revenue." />
                            <KPIBarRow label="Payables discipline" score={businessHealth.payablesScore} hint="How structured and predictable supplier payments are." />
                            <KPIBarRow label="Data quality (GL & JEs)" score={businessHealth.dataQualityScore} hint="Balance, posting status and overall reliability of the books." />
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Business health will appear when there is activity in the selected month.
                          </Typography>
                        )}
                      </Panel>
                    </Grid>

                    <Grid item xs={12} md={5}>
                      <Panel
                        title="Performance Insights & Priority Actions"
                        action={
                          <Button size="small" variant="contained" onClick={() => setBhDialogOpen(true)}>
                            View priorities
                          </Button>
                        }
                      >
                        {businessHealthNews ? (
                          <Stack spacing={1}>
                            <Typography variant="body2" color="text.secondary">
                              {businessHealthNews.summary}
                            </Typography>

                            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                              Top focus areas
                            </Typography>

                            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                              {businessHealthNews.priorities.slice(0, 3).map((p, idx) => (
                                <li key={idx}>
                                  <Typography variant="body2" color="text.secondary">
                                    {p}
                                  </Typography>
                                </li>
                              ))}
                            </ul>

                            <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
                              {(businessHealthNews.ranking || []).map((r) => {
                                const mapping = KPI_MODULE_ROUTES[r.key];
                                if (!mapping) return null;
                                return (
                                  <Button key={r.key} size="small" variant="outlined" onClick={() => navigate(mapping.path)}>
                                    {mapping.label}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Once there is financial activity for this month, the AI helper will highlight where to prioritise your work.
                          </Typography>
                        )}
                      </Panel>
                    </Grid>
                  </Grid>
                </Stack>
              );

              return (
                <Routes>
                  <Route path="/" element={Overview} />

                  <Route path="/sales" element={<Navigate to="/sales/quotations" replace />} />
                  <Route
                    path="/sales/invoices"
                    element={
                      <Invoices
                        accounts={accounts}
                        onAddGlMany={async (rows) => {
                          try {
                            for (const r of rows) {
                              await createGLEntry({
                                date: r.date,
                                account: String(r.account),
                                memo: r.memo || "",
                                debit: Number(r.debit) || 0,
                                credit: Number(r.credit) || 0,
                                reference: r.reference || "",
                                jeNumber: r.jeNumber || "",
                                source: r.source || "AR",
                                locked: !!r.locked,
                              });
                            }
                          } finally {
                            await refetchGL();
                          }
                        }}
                      />
                    }
                  />
                  {(SECOND.sales || [])
                    .filter((s) => s.key !== "invoices")
                    .map((s) => (
                      <Route
                        key={`sales-${s.key}`}
                        path={`/sales/${s.key}`}
                        element={
                          <Paper sx={{ p: 3, borderRadius: 3 }}>
                            <Typography variant="h6">Sales — {s.label}</Typography>
                          </Paper>
                        }
                      />
                    ))}

                  <Route path="/purchasing" element={<Navigate to="/purchasing/supplier-invoices" replace />} />
                  <Route
                    path="/purchasing/supplier-invoices"
                    element={
                      <PurchaseInvoicesPage
                        accounts={accounts}
                        api={{
                          list: listPurchaseInvoices,
                          get: getPurchaseInvoice,
                          create: createPurchaseInvoice,
                          update: updatePurchaseInvoice,
                          remove: deletePurchaseInvoice,
                          post: postPurchaseInvoice,
                        }}
                        onAddGlMany={async (rows) => {
                          try {
                            for (const r of rows) {
                              await createGLEntry({
                                date: r.date,
                                account: String(r.account),
                                memo: r.memo || "",
                                debit: Number(r.debit) || 0,
                                credit: Number(r.credit) || 0,
                                reference: r.reference || "",
                                jeNumber: r.jeNumber || "",
                                source: r.source || "AP",
                                locked: !!r.locked,
                              });
                            }
                          } finally {
                            await refetchGL();
                          }
                        }}
                      />
                    }
                  />
                  {(SECOND.purchasing || [])
                    .filter((s) => s.key !== "supplier-invoices")
                    .map((s) => (
                      <Route
                        key={`purch-${s.key}`}
                        path={`/purchasing/${s.key}`}
                        element={
                          <Paper sx={{ p: 3, borderRadius: 3 }}>
                            <Typography variant="h6">Purchasing — {s.label}</Typography>
                          </Paper>
                        }
                      />
                    ))}

                  <Route path="/inventory" element={<Navigate to="/inventory/items" replace />} />
                  <Route
                    path="/inventory/items"
                    element={
                      <InventoryItem
                        api={{
                          listItems: listInventoryItems,
                          getItem: getInventoryItem,
                          createItem: createInventoryItem,
                          updateItem: updateInventoryItem,
                          deleteItem: deleteInventoryItem,
                          listMoves: listStockMoves,
                          postMove: postStockMove,
                        }}
                      />
                    }
                  />
                  <Route path="/inventory/stock-moves" element={<InventoryStockMove />} />
                  <Route path="/inventory/adjustments" element={<InventoryAdjustments />} />
                  <Route path="/inventory/warehouses" element={<InventoryWarehouses />} />
                  // PART 5/5 — Remaining routes + dialog + App() auth wrapper (plus mobile-safe dialog sizing)
// Notes applied:
// ✅ closed centered canvas + main layout correctly
// ✅ Dialog: already has maxWidth + fullWidth; theme also enforces maxWidth 100%
// ✅ removed any "zoom" idea; mobile visibility handled via layout constraints

                  <Route path="/finance" element={<Navigate to="/finance/finance-docs" replace />} />
                  <Route
                    path="/finance/journal"
                    element={
                      <JEDashboard
                        entries={journalEntries}
                        accounts={accounts}
                        onCreate={onCreateJE}
                        onUpdate={onUpdateJE}
                        onDelete={onDeleteJE}
                        onApprove={onApproveJE}
                        onPost={onPostJE}
                        onView={(id, e) => console.log("view JE", id, e)}
                        onExportCSV={(list, name = "journal_entries.csv") => {
                          const header = ["Date", "JE No.", "Ref No.", "Memo", "Status", "Debit (kr)", "Credit (kr)"];
                          const rows = (list ?? journalEntries).map((je) => {
                            const debit = Array.isArray(je.lines) ? je.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : 0;
                            const credit = Array.isArray(je.lines) ? je.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) : 0;
                            return { date: je.date, jeNumber: je.jeNumber, reference: je.reference, memo: je.memo, status: je.status, debit, credit };
                          });
                          const lines = rows.map((r) =>
                            [
                              String(r.date || "").slice(0, 10),
                              `"${(r.jeNumber || "").replace(/"/g, '""')}"`,
                              `"${(r.reference || "").replace(/"/g, '""')}"`,
                              `"${(r.memo || "").replace(/"/g, '""')}"`,
                              r.status || "draft",
                              (r.debit || 0).toFixed(2).replace(".", ","),
                              (r.credit || 0).toFixed(2).replace(".", ","),
                            ].join(",")
                          );
                          const csv = [header.join(","), ...lines].join("\n");
                          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = name;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        }}
                      />
                    }
                  />

                  <Route
                    path="/finance/gl"
                    element={
                      <GLDashboard
                        rows={glRows}
                        accounts={accounts}
                        onAdd={addGl}
                        onAddMany={async (rows) => {
                          for (const r of rows) await addGl(r);
                        }}
                        onUpdate={updGl}
                        onDelete={delGl}
                        onExportCSV={(rowsOverride, name = "general_ledger.csv") => exportGL(rowsOverride ?? glRows, name)}
                        inventoryApi={{ createStockMove, postStockMove }}
                        invoiceResolvers={invoiceResolvers}
                      />
                    }
                  />

                  <Route path="/finance/trial" element={<TrialBalance rows={glRows} accounts={accounts} onOpenAccount={() => {}} />} />
                  <Route path="/finance/coa" element={<ChartOfAccounts accounts={accounts} refetch={refetchAccounts} />} />

                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/balance-sheet" element={<BalanceSheet rows={glRows} accounts={accounts} />} />

                  <Route path="/admin" element={<Navigate to="/admin/inbox" replace />} />
                  <Route path="/admin/inbox" element={<BilagsInbox />} />
                  <Route
                    path="/admin/projects"
                    element={
                      <AdminProjectManagement
                        api={{
                          list: listProjects,
                          get: getProject,
                          create: createProject,
                          update: updateProject,
                          remove: deleteProject,
                        }}
                      />
                    }
                  />
                  {(SECOND.admin || [])
                    .filter((s) => s.key !== "inbox" && s.key !== "projects")
                    .map((s) => (
                      <Route
                        key={`admin-${s.key}`}
                        path={`/admin/${s.key}`}
                        element={
                          <Paper sx={{ p: 3, borderRadius: 3 }}>
                            <Typography variant="h6">Admin — {s.label}</Typography>
                          </Paper>
                        }
                      />
                    ))}

                  <Route path="/gl" element={<Navigate to="/finance/gl" replace />} />
                  <Route path="/journal" element={<Navigate to="/finance/journal" replace />} />
                  <Route path="/trial" element={<Navigate to="/finance/trial" replace />} />
                  <Route path="/coa" element={<Navigate to="/finance/coa" replace />} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              );
            })()}
          </Box>

          <BusinessHealthDialog
            open={bhDialogOpen}
            onClose={() => setBhDialogOpen(false)}
            health={businessHealth}
            news={businessHealthNews}
            onNavigate={(path) => navigate(path)}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

function BusinessHealthDialog({ open, onClose, health, news, onNavigate }) {
  if (!open) return null;

  const h = health || {};
  const n = news || {};

  const rows = [
    { label: "Profitability", score: h.profitabilityScore },
    { label: "Liquidity (Cash vs A/P)", score: h.liquidityScore },
    { label: "Collections (A/R)", score: h.collectionsScore },
    { label: "Payables discipline", score: h.payablesScore },
    { label: "Data quality", score: h.dataQualityScore },
  ];

  const KPIBarDialogRow = ({ label, score }) => {
    const pct = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
    return (
      <Stack spacing={0.5}>
        <Stack direction="row" justifyContent="space-between" sx={{ gap: 1 }}>
          <Typography variant="body2" sx={{ minWidth: 0 }}>
            {label}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: "0 0 auto" }}>
            {pct.toFixed(0)}%
          </Typography>
        </Stack>
        <Box
          sx={(t) => ({
            height: 10,
            borderRadius: 999,
            bgcolor: t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
            overflow: "hidden",
          })}
        >
          <Box
            sx={(t) => ({
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              bgcolor: t.palette.primary.main,
            })}
          />
        </Box>
      </Stack>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          borderRadius: { xs: 3, md: 4 },
          width: "100%",
          maxWidth: "100%",
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, minWidth: 0 }}>
            AI Business Health – Where to prioritise your work
          </Typography>
          {typeof h.overallScore === "number" && (
            <Chip size="small" color="primary" label={`Overall health: ${h.overallScore.toFixed(0)}%`} />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          {n.headline && (
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {n.headline}
            </Typography>
          )}
          {n.summary && (
            <Typography variant="body2" color="text.secondary">
              {n.summary}
            </Typography>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Stack spacing={1.25}>
                {rows.map((r) => (
                  <KPIBarDialogRow key={r.label} label={r.label} score={r.score} />
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Suggested priority sequence
              </Typography>
              <ol style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {(n.priorities || []).map((p, idx) => (
                  <li key={idx}>
                    <Typography variant="body2" color="text.secondary">
                      {p}
                    </Typography>
                  </li>
                ))}
              </ol>

              <Box sx={{ mt: 1.5, mb: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
                {(n.ranking || []).map((r) => {
                  const mapping = KPI_MODULE_ROUTES[r.key];
                  if (!mapping) return null;
                  return (
                    <Button
                      key={r.key}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        if (onNavigate) onNavigate(mapping.path);
                        else window.location.hash = `#${mapping.path}`;
                        onClose?.();
                      }}
                    >
                      {mapping.label}
                    </Button>
                  );
                })}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Tip: Start by assigning owners and deadlines to the top 1–2 priorities, then track progress monthly in the Reports module.
              </Typography>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Button variant="outlined" onClick={() => onClose?.()}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (payload) => {
    const { remember, ...userData } = payload;
    setUser(userData);

    if (remember) {
      try {
        localStorage.setItem(AUTH_LS_KEY, JSON.stringify(userData));
      } catch {
        // ignore
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_LS_KEY);
    } catch {
      // ignore
    }
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return <Shell onLogout={handleLogout} />;
}

