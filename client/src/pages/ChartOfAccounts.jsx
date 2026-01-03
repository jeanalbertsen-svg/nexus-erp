import React, { useMemo, useState, useCallback } from "react";
import {
  Paper, Stack, Typography, TextField, MenuItem, Button,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton,
  Divider, Alert, Chip, Box, Autocomplete, Switch, FormControlLabel,
  Tooltip, InputAdornment, Accordion, AccordionSummary, AccordionDetails,
  ToggleButton, ToggleButtonGroup, Badge
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import DensitySmallIcon from "@mui/icons-material/DensitySmall";
import DensityMediumIcon from "@mui/icons-material/DensityMedium";
import DensityLargeIcon from "@mui/icons-material/DensityLarge";
import PropTypes from "prop-types";
import { createAccount, updateAccount, deleteAccount } from "../api";

/* ============================ Constants & Helpers ============================ */

const TYPES = Object.freeze(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]);

const SUBTYPES = Object.freeze({
  ASSET: [
    "Cash & Cash Equivalents","Accounts Receivable","Investments",
    "Inventory","Prepaid & Other Current","Other Current Assets",
    "Property, Plant & Equipment","Intangibles","Contra Assets"
  ],
  LIABILITY: [
    "Accounts Payable","Accrued Liabilities","Taxes Payable",
    "Deferred Revenue","Short-term Debt","Long-term Debt","Leases"
  ],
  EQUITY: [
    "Paid-in Capital","Retained Earnings","Distributions / Draws","Treasury Stock","Partners’ Capital"
  ],
  REVENUE: [
    "Product Revenue","Service Revenue","Recurring / Subscriptions",
    "Investment Income","Other Income","Gains / (Losses)"
  ],
  EXPENSE: [
    "COGS / Cost of Sales","Payroll","Facilities","Operations",
    "G&A","Sales & Marketing","R&D","Financing","Other"
  ],
});

const STATEMENT_BY_TYPE = Object.freeze({
  ASSET: "Balance Sheet",
  LIABILITY: "Balance Sheet",
  EQUITY: "Balance Sheet",
  REVENUE: "Income Statement",
  EXPENSE: "Income Statement",
});

const NAME_SUGGESTIONS = Object.freeze({
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
    "Gains / (Losses)": ["4040 Realized Gains (Losses) on Investments","4010 Unrealized Gains (Losses) on Investments","4030 FX Gain (Loss)"]
  },
  EXPENSE: {
    "COGS / Cost of Sales": ["5000 Cost of Goods Sold (COGS)","5001 COGS"],
    "Payroll": ["5100 Salaries & Wages"],
    "Facilities": ["5200 Rent Expense","5300 Utilities Expense"],
    "Operations": ["6300 Bank Charges","6400 IT / Software Expense","6500 Miscellaneous Expenses","2810 Lease Expense"],
    "G&A": ["6100 Legal Expenses","6200 Audit & Accounting Fees","5800 Professional Fees","5900 Training & Development","6000 Depreciation Expense","5500 Insurance Expense"],
    "Sales & Marketing": ["5600 Marketing & Advertising","5700 Travel Expense"],
    "R&D": ["5150 R&D Expense","5160 Product Development"],
    "Financing": ["6600 Interest Expense","6700 Foreign Exchange Loss"],
    "Other": ["5070 Other Fund Operating Expenses","5060 Deal Expenses (Non-capitalized)","5050 Organizational & Offering Costs"]
  }
});

const NAME_META = Object.freeze({
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
});

const INDUSTRY_TEMPLATES = {
  Baseline: [
    // ---- ASSETS ----
    { number: "1000", name: "Cash", type: "ASSET", subtype: "Cash & Cash Equivalents", description: "Operating cash in fund bank accounts", statement: "Balance Sheet" },
    { number: "1010", name: "Subscriptions Receivable", type: "ASSET", subtype: "Accounts Receivable", description: "Called but unpaid capital from LPs", statement: "Balance Sheet" },
    { number: "1020", name: "Interest & Dividends Receivable", type: "ASSET", subtype: "Accounts Receivable", description: "Accrued portfolio interest/dividends", statement: "Balance Sheet" },
    { number: "1100", name: "Investments at Fair Value", type: "ASSET", subtype: "Investments", description: "Portfolio investments measured at fair value", statement: "Balance Sheet" },
    { number: "1110", name: "Cost Basis of Investments", type: "ASSET", subtype: "Investments", description: "Historical cost of investments (tracking)", statement: "Balance Sheet" },
    { number: "1120", name: "Unrealized Appreciation (Contra)", type: "ASSET", subtype: "Contra Assets", description: "FV uplift vs. cost (contra to cost)", statement: "Balance Sheet" },
    { number: "1130", name: "Unrealized Depreciation (Contra)", type: "ASSET", subtype: "Contra Assets", description: "FV markdown vs. cost (contra to cost)", statement: "Balance Sheet" },
    { number: "1200", name: "Due from GP / Manager", type: "ASSET", subtype: "Other Current Assets", description: "Amounts receivable from GP/Manager", statement: "Balance Sheet" },
    { number: "1210", name: "Other Receivables", type: "ASSET", subtype: "Other Current Assets", description: "Miscellaneous receivables", statement: "Balance Sheet" },
    { number: "1300", name: "Prepaid Expenses", type: "ASSET", subtype: "Prepaid & Other Current", description: "Payments made in advance for future services", statement: "Balance Sheet" },
    { number: "1400", name: "Short-Term Investments", type: "ASSET", subtype: "Investments", description: "Investments easily convertible to cash", statement: "Balance Sheet" },
    { number: "1500", name: "Equipment", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Machinery and tools used in operations", statement: "Balance Sheet" },
    { number: "1510", name: "Furniture & Fixtures", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Office furniture and fixtures", statement: "Balance Sheet" },
    { number: "1600", name: "Vehicles", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Company-owned cars and trucks", statement: "Balance Sheet" },
    { number: "1700", name: "Buildings", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Company-owned real estate buildings", statement: "Balance Sheet" },
    { number: "1800", name: "Land", type: "ASSET", subtype: "Property, Plant & Equipment", description: "Company-owned land property", statement: "Balance Sheet" },
    { number: "1900", name: "Accumulated Depreciation", type: "ASSET", subtype: "Contra Assets", description: "Total depreciation of fixed assets", statement: "Balance Sheet" },
    // ---- LIABILITIES ----
    { number: "2000", name: "Accounts Payable", type: "LIABILITY", subtype: "Accounts Payable", description: "Trade payables and invoices due", statement: "Balance Sheet" },
    { number: "2010", name: "Accrued Expenses", type: "LIABILITY", subtype: "Accrued Liabilities", description: "Incurred expenses not yet billed", statement: "Balance Sheet" },
    { number: "2020", name: "Management Fees Payable", type: "LIABILITY", subtype: "Accrued Liabilities", description: "Accrued management fees owed to Manager", statement: "Balance Sheet" },
    { number: "2300", name: "Taxes Payable", type: "LIABILITY", subtype: "Taxes Payable", description: "Taxes owed to the government", statement: "Balance Sheet" },
    { number: "2400", name: "Unearned Revenue", type: "LIABILITY", subtype: "Deferred Revenue", description: "Customer payments received before delivery", statement: "Balance Sheet" },
    { number: "2500", name: "Short-Term Loans", type: "LIABILITY", subtype: "Short-term Debt", description: "Loans due within one year", statement: "Balance Sheet" },
    { number: "2600", name: "Bank Loan Payable", type: "LIABILITY", subtype: "Long-term Debt", description: "Outstanding balance of bank loans", statement: "Balance Sheet" },
    { number: "2700", name: "Bonds Payable", type: "LIABILITY", subtype: "Long-term Debt", description: "Company-issued bonds outstanding", statement: "Balance Sheet" },
    { number: "2800", name: "Lease Obligations", type: "LIABILITY", subtype: "Leases", description: "Future lease payments owed", statement: "Balance Sheet" },
    // ---- EQUITY ----
    { number: "3000", name: "Share Capital", type: "EQUITY", subtype: "Paid-in Capital", description: "Owner or shareholder investments", statement: "Balance Sheet" },
    { number: "3200", name: "Additional Paid-In Capital", type: "EQUITY", subtype: "Paid-in Capital", description: "Contributions beyond par value of shares", statement: "Balance Sheet" },
    { number: "3300", name: "Retained Earnings", type: "EQUITY", subtype: "Retained Earnings", description: "Accumulated profits not distributed as dividends", statement: "Balance Sheet" },
    { number: "3400", name: "Dividends / Owner’s Draw", type: "EQUITY", subtype: "Distributions / Draws", description: "Funds paid to owners or shareholders", statement: "Balance Sheet" },
    { number: "3500", name: "Treasury Stock", type: "EQUITY", subtype: "Treasury Stock", description: "Repurchased company stock", statement: "Balance Sheet" },
    // ---- REVENUE ----
    { number: "4000", name: "Sales Revenue", type: "REVENUE", subtype: "Product Revenue", description: "Income from sale of goods", statement: "Income Statement" },
    { number: "4100", name: "Service Revenue", type: "REVENUE", subtype: "Service Revenue", description: "Income from providing services", statement: "Income Statement" },
    { number: "4200", name: "Rental Income", type: "REVENUE", subtype: "Other Income", description: "Income from renting property or equipment", statement: "Income Statement" },
    { number: "4300", name: "Interest Income", type: "REVENUE", subtype: "Investment Income", description: "Interest earned on investments or deposits", statement: "Income Statement" },
    { number: "4030", name: "FX Gain (Loss)", type: "REVENUE", subtype: "Gains / (Losses)", description: "Foreign currency transaction gains or losses", statement: "Income Statement" },
    // ---- EXPENSES ----
    { number: "5000", name: "Cost of Goods Sold (COGS)", type: "EXPENSE", subtype: "COGS / Cost of Sales", description: "Direct costs of producing goods sold", statement: "Income Statement" },
    { number: "5100", name: "Salaries & Wages", type: "EXPENSE", subtype: "Payroll", description: "Employee compensation", statement: "Income Statement" },
    { number: "5200", name: "Rent Expense", type: "EXPENSE", subtype: "Facilities", description: "Payments for office or building rent", statement: "Income Statement" },
    { number: "5300", name: "Utilities Expense", type: "EXPENSE", subtype: "Facilities", description: "Electricity, water, gas, and related utilities", statement: "Income Statement" },
    { number: "5400", name: "Office Supplies", type: "EXPENSE", subtype: "Operations", description: "Stationery and consumables for office use", statement: "Income Statement" },
    { number: "5500", name: "Insurance Expense", type: "EXPENSE", subtype: "G&A", description: "Premiums for business insurance policies", statement: "Income Statement" },
    { number: "5600", name: "Marketing & Advertising", type: "EXPENSE", subtype: "Sales & Marketing", description: "Promotional and advertising costs", statement: "Income Statement" },
    { number: "5700", name: "Travel Expense", type: "EXPENSE", subtype: "Sales & Marketing", description: "Costs of business travel", statement: "Income Statement" },
    { number: "5800", name: "Professional Fees", type: "EXPENSE", subtype: "G&A", description: "Legal, consulting, or professional services", statement: "Income Statement" },
    { number: "5900", name: "Training & Development", type: "EXPENSE", subtype: "G&A", description: "Employee training and development costs", statement: "Income Statement" },
    { number: "6000", name: "Depreciation Expense", type: "EXPENSE", subtype: "G&A", description: "Expense allocation for asset depreciation", statement: "Income Statement" },
    { number: "6100", name: "Legal Expenses", type: "EXPENSE", subtype: "G&A", description: "Fees paid to lawyers and legal firms", statement: "Income Statement" },
    { number: "6200", name: "Audit & Accounting Fees", type: "EXPENSE", subtype: "G&A", description: "External audit and accounting service fees", statement: "Income Statement" },
    { number: "6300", name: "Bank Charges", type: "EXPENSE", subtype: "Operations", description: "Service fees charged by banks", statement: "Income Statement" },
    { number: "6400", name: "IT / Software Expense", type: "EXPENSE", subtype: "Operations", description: "Cost of software subscriptions and IT services", statement: "Income Statement" },
    { number: "6500", name: "Miscellaneous Expenses", type: "EXPENSE", subtype: "Other", description: "Other minor or irregular expenses", statement: "Income Statement" },
    { number: "6600", name: "Interest Expense", type: "EXPENSE", subtype: "Financing", description: "Interest paid on loans", statement: "Income Statement" },
    { number: "6700", name: "Foreign Exchange Loss", type: "EXPENSE", subtype: "Financing", description: "Losses from currency exchange differences", statement: "Income Statement" },
  ],
};


const COA_COLGROUP = (
  <colgroup>
    <col style={{ width: 110 }} />
    <col style={{ width: 280 }} />
    <col style={{ width: 140 }} />
    <col style={{ width: 220 }} />
    <col style={{ width: 160 }} />
    <col style={{ width: "auto" }} />
    <col style={{ width: 120 }} />
  </colgroup>
);

// Table styling inspired by GLDashboard (no zoom, normal font size)
const TABLE_SX = {
  tableLayout: "fixed",
  "& thead th": { fontWeight: 700, whiteSpace: "nowrap" },
  "& td, & th": {
    height: 40,
    verticalAlign: "middle",
  },
  "& td:nth-of-type(1)": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
};

const typeChipColor = (t) => {
  switch (t) {
    case "ASSET": return "success";
    case "LIABILITY": return "warning";
    case "EQUITY": return "info";
    case "REVENUE": return "primary";
    case "EXPENSE": return "error";
    default: return "default";
  }
};

const SectionTitle = React.memo(function SectionTitle({ title, count }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Chip size="small" label={count} />
    </Stack>
  );
});
/* ============================ Component ============================ */

export default function ChartOfAccounts({ accounts = [], refetch }) {
  // ---------- State ----------
  const [form, setForm] = useState({
    number: "",
    name: "",
    type: "ASSET",
    subtype: SUBTYPES.ASSET[0],
    description: "",
    statement: STATEMENT_BY_TYPE.ASSET,
  });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [selectedIndustry, setSelectedIndustry] = useState("Baseline");
  const [showOnlyIndustry, setShowOnlyIndustry] = useState(true);

  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterSubtype, setFilterSubtype] = useState("ALL");
  const [density, setDensity] = useState("comfortable"); // compact | comfortable | spacious

  // ---------- Derived ----------
  const templateNumbers = useMemo(() => {
    const t = INDUSTRY_TEMPLATES[selectedIndustry] || [];
    return new Set(t.map((r) => String(r.number)));
  }, [selectedIndustry]);

  const industryTypes = useMemo(() => {
    const t = INDUSTRY_TEMPLATES[selectedIndustry] || [];
    const types = Array.from(new Set(t.map((r) => r.type)));
    return TYPES.filter((tt) => types.includes(tt));
  }, [selectedIndustry]);

  const grouped = useMemo(() => {
    let rows = accounts;

    if (showOnlyIndustry) rows = rows.filter((a) => templateNumbers.has(String(a.number)));
    if (filterType !== "ALL") rows = rows.filter((a) => a.type === filterType);
    if (filterSubtype !== "ALL") rows = rows.filter((a) => (a.subtype || "Ungrouped") === filterSubtype);

    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (a) =>
          String(a.number).toLowerCase().includes(q) ||
          (a.name || "").toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q) ||
          (a.subtype || "").toLowerCase().includes(q)
      );
    }

    // Build grouped structure safely
    const groupedByType = {};
    TYPES.forEach((t) => { groupedByType[t] = {}; });

    for (const a of rows) {
      const t = a.type || "OTHER";
      const st = a.subtype || "Ungrouped";
      if (!groupedByType[t]) groupedByType[t] = {};
      if (!groupedByType[t][st]) groupedByType[t][st] = [];
      groupedByType[t][st].push(a);
    }

    TYPES.forEach((t) => {
      Object.keys(groupedByType[t] || {}).forEach((st) => {
        groupedByType[t][st].sort((a, b) =>
          String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
        );
      });
    });

    return groupedByType;
  }, [accounts, showOnlyIndustry, templateNumbers, query, filterType, filterSubtype]);

  const rowSize = density === "compact" ? "small" : "medium"; // MUI Table accepts 'small' | 'medium'

  // ---------- Handlers ----------
  const startEdit = useCallback((acc) => {
    setError("");
    setInfo("");
    setEditing({ ...acc });
  }, []);

  const cancelEdit = useCallback(() => setEditing(null), []);

  const submitCreate = useCallback(async () => {
    setError("");
    setInfo("");
    try {
      const number = String(form.number || "").trim();
      const name = String(form.name || "").trim();
      const type = form.type;
      const subtype = form.subtype || "";
      const description = String(form.description || "");
      const statement = STATEMENT_BY_TYPE[type];

      if (!number || !name) {
        setError("Number and Name are required");
        return;
      }

      await createAccount({ number, name, type, subtype, description, statement, active: true });

      const nextType = industryTypes[0] || "ASSET";
      setForm({
        number: "",
        name: "",
        type: nextType,
        subtype: SUBTYPES[nextType][0],
        description: "",
        statement: STATEMENT_BY_TYPE[nextType],
      });

      if (refetch) await refetch();
      setInfo("Account created.");
    } catch (e) {
      console.error("Create failed", e);
      setError(e?.message || "Failed to create account");
    }
  }, [form, industryTypes, refetch]);

  const submitUpdate = useCallback(async () => {
    setError("");
    setInfo("");
    try {
      if (!editing) return;

      const { _id } = editing;
      const number = String(editing.number || "").trim();
      const name = String(editing.name || "").trim();
      const type = editing.type;
      const subtype = editing.subtype || "";
      const description = String(editing.description || "");
      const statement = STATEMENT_BY_TYPE[type];
      const active = editing.active ?? true;

      if (!number || !name) {
        setError("Number and Name are required");
        return;
      }

      await updateAccount(_id, { number, name, type, subtype, description, statement, active });
      setEditing(null);
      if (refetch) await refetch();
      setInfo("Account updated.");
    } catch (e) {
      console.error("Update failed", e);
      setError(e?.message || "Failed to update account");
    }
  }, [editing, refetch]);

  const remove = useCallback(
    async (id) => {
      setError("");
      setInfo("");
      try {
        await deleteAccount(id);
        if (refetch) await refetch();
        setInfo("Account deleted.");
      } catch (e) {
        console.error("Delete failed", e);
        setError(e?.message || "Failed to delete account");
      }
    },
    [refetch]
  );

  const applyTemplate = useCallback(
    async (industryName) => {
      setError("");
      setInfo("");
      const template = [
        ...(INDUSTRY_TEMPLATES["Baseline"] || []),
        ...(INDUSTRY_TEMPLATES[industryName] || []),
      ];
      if (!template.length) {
        setError(`No template found for "${industryName}".`);
        return;
      }

      const existing = new Set(accounts.map((a) => String(a.number)));
      const toCreate = [];
      const skipped = [];

      for (const row of template) {
        const num = String(row.number);
        if (existing.has(num)) skipped.push(row);
        else toCreate.push(row);
      }

      if (!toCreate.length) {
        setInfo(`All “${industryName}” (and Baseline) accounts already exist (${skipped.length} skipped).`);
        return;
      }

      try {
        setLoadingTemplate(true);
        const results = await Promise.allSettled(
          toCreate.map((row) => {
            const statement = row.statement || STATEMENT_BY_TYPE[row.type];
            return createAccount({ ...row, statement, active: true });
          })
        );
        const addedCount = results.filter((r) => r.status === "fulfilled").length;
        const failedCount = results.filter((r) => r.status === "rejected").length;

        if (refetch) await refetch();

        if (failedCount) {
          setError(`Applied “${industryName}” + Baseline: ${addedCount} added, ${skipped.length} skipped, ${failedCount} failed.`);
        } else {
          setInfo(`Applied “${industryName}” + Baseline: ${addedCount} added, ${skipped.length} skipped.`);
        }
      } catch (e) {
        console.error(e);
        setError(e?.message || `Failed to apply “${industryName}” template`);
      } finally {
        setLoadingTemplate(false);
      }
    },
    [accounts, refetch]
  );

  const clickIndustry = useCallback((name) => {
    setSelectedIndustry(name);
    const types = INDUSTRY_TEMPLATES[name]?.map((x) => x.type) ?? [];
    const first = TYPES.find((t) => types.includes(t)) || "ASSET";
    setForm((f) => ({
      ...f,
      type: first,
      subtype: SUBTYPES[first][0],
      statement: STATEMENT_BY_TYPE[first],
    }));
  }, []);

  const suggestionOptions = useMemo(() => {
    const byType = NAME_SUGGESTIONS[form.type] || {};
    let opts = byType[form.subtype] || [];

    const industrySet = INDUSTRY_TEMPLATES[selectedIndustry]
      ? new Set(INDUSTRY_TEMPLATES[selectedIndustry].map((r) => String(r.number)))
      : null;

    if (industrySet) {
      const preferred = opts.filter((label) => industrySet.has(label.split(" ")[0]));
      const others = opts.filter((label) => !industrySet.has(label.split(" ")[0]));
      opts = [...preferred, ...others];
    }
    return opts;
  }, [form.type, form.subtype, selectedIndustry]);

  // ============================ Render ============================

  return (
    <Stack spacing={2}>
      {/* Title */}
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography variant="h5">Chart of Accounts</Typography>
        <Chip size="small" label={`${accounts.length} total`} />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      {/* Template / Industry */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2 }}
      >
        <Stack spacing={1.5}>
          <Typography variant="overline" color="text.secondary">
            TEMPLATE
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            {Object.keys(INDUSTRY_TEMPLATES).map((name) => (
              <Chip
                key={name}
                label={name}
                onClick={() => clickIndustry(name)}
                color={selectedIndustry === name ? "primary" : "default"}
                variant={selectedIndustry === name ? "filled" : "outlined"}
                clickable
                sx={{ mb: 0.5 }}
              />
            ))}
            <Box flexGrow={1} />
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyIndustry}
                  onChange={(e) => setShowOnlyIndustry(e.target.checked)}
                />
              }
              label="Only show template accounts"
            />
            <Button
              size="small"
              variant="outlined"
              disabled={loadingTemplate}
              onClick={() => applyTemplate(selectedIndustry)}
            >
              {loadingTemplate ? "Applying…" : `Apply “${selectedIndustry}”`}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Toolbar */}
      <Paper
        variant="outlined"
        sx={{ p: 2, borderRadius: 2 }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ md: "center" }}
        >
          <TextField
            placeholder="Search number, name, description, subtype…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            select
            label="Type"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setFilterSubtype("ALL");
            }}
            sx={{ minWidth: 180 }}
            size="small"
          >
            <MenuItem value="ALL">All Types</MenuItem>
            {TYPES.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Subtype"
            value={filterSubtype}
            onChange={(e) => setFilterSubtype(e.target.value)}
            sx={{ minWidth: 220 }}
            size="small"
            disabled={filterType === "ALL"}
          >
            <MenuItem value="ALL">All Subtypes</MenuItem>
            {(SUBTYPES[filterType] || []).map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>

          <ToggleButtonGroup
            value={density}
            exclusive
            onChange={(_, v) => v && setDensity(v)}
            size="small"
          >
            <ToggleButton value="compact">
              <DensitySmallIcon />
            </ToggleButton>
            <ToggleButton value="comfortable">
              <DensityMediumIcon />
            </ToggleButton>
            <ToggleButton value="spacious">
              <DensityLargeIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* Quick Add */}
      <Paper
        variant="outlined"
        sx={{ p: 3, borderRadius: 2 }}
      >
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="flex-end">
          {/* Number */}
          <TextField
            label="Number"
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            sx={{ minWidth: 150 }}
            size="small"
            inputProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
          />

          {/* Name (Autocomplete: freeSolo + controlled inputValue) */}
          <Autocomplete
            freeSolo
            options={suggestionOptions}
            value={null}
            inputValue={form.name}
            onInputChange={(_, v) => {
              const desc = NAME_META[v] || form.description;
              setForm((f) => ({ ...f, name: v, description: desc }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Name"
                size="small"
                sx={{ flexGrow: 1, minWidth: 300 }}
              />
            )}
            sx={{ flexGrow: 1, minWidth: 300 }}
          />

          {/* Type */}
          <TextField
            select
            label="Type"
            value={form.type}
            onChange={(e) => {
              const t = e.target.value;
              setForm((f) => ({
                ...f,
                type: t,
                subtype: SUBTYPES[t][0],
                statement: STATEMENT_BY_TYPE[t],
              }));
            }}
            sx={{ minWidth: 200 }}
            size="small"
          >
            {(industryTypes.length ? industryTypes : TYPES).map((t) => (
              <MenuItem key={t} value={t}>
                <Chip size="small" label={t} color={typeChipColor(t)} sx={{ mr: 1 }} />
                {t}
              </MenuItem>
            ))}
          </TextField>

          {/* Subtype */}
          <TextField
            select
            label="Subtype"
            value={form.subtype}
            onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value }))}
            sx={{ minWidth: 240 }}
            size="small"
          >
            {(SUBTYPES[form.type] || []).map((st) => (
              <MenuItem key={st} value={st}>{st}</MenuItem>
            ))}
          </TextField>

          {/* Statement */}
          <TextField
            label="Statement"
            value={form.statement}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 200 }}
            size="small"
          />

          {/* Description */}
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            sx={{ flexGrow: 1, minWidth: 320 }}
            size="small"
            placeholder="Optional"
          />

          {/* Add Account */}
          <Box sx={{ flexShrink: 0 }}>
            <Tooltip title="Quick add">
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  sx={{ px: 3, height: "100%" }}
                  onClick={submitCreate}
                  disabled={!String(form.number).trim() || !String(form.name).trim()}
                >
                  Add Account
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Stack>
      </Paper>

      {/* Grouped Tables */}
      {TYPES.map((type) => {
        const bySubtype = grouped[type];
        const subtypes = bySubtype ? Object.keys(bySubtype) : [];
        const typeCount = subtypes.reduce((n, st) => n + (bySubtype[st]?.length || 0), 0);
        if (!typeCount) return null;

        return (
          <Accordion
            key={type}
            defaultExpanded
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: 1,
              borderColor: "divider",
              boxShadow: "none",
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={type} color={typeChipColor(type)} />
                <Badge color="default" badgeContent={typeCount}>
                  <Box sx={{ width: 0, height: 0 }} />
                </Badge>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {subtypes.map((st) => {
                const rows = bySubtype[st] || [];
                if (!rows.length) return null;

                return (
                  <Paper
                    key={`${type}-${st}`}
                    variant="outlined"
                    sx={{ mb: 2, borderRadius: 1, overflow: "hidden" }}
                  >
                    <Box sx={{ px: 2, py: 1, bgcolor: "action.hover" }}>
                      <SectionTitle title={st} count={rows.length} />
                    </Box>

                    <Box sx={{ overflowX: "auto", "& table": { tableLayout: "fixed" } }}>
                      <Table size={rowSize} sx={TABLE_SX}>
                        {COA_COLGROUP}
                        <TableHead>
                          <TableRow>
                            <TableCell>Number</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Subtype</TableCell>
                            <TableCell>Statement</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {rows.map((a) => {
                            const isEditing = editing?._id === a._id;
                            return (
                              <TableRow key={a._id || a.number} hover>
                                {/* Number */}
                                <TableCell>
                                  {isEditing ? (
                                    <TextField
                                      size="small"
                                      value={editing.number}
                                      onChange={(e) =>
                                        setEditing({ ...editing, number: e.target.value })
                                      }
                                    />
                                  ) : (
                                    a.number
                                  )}
                                </TableCell>

                                {/* Name */}
                                <TableCell>
                                  {isEditing ? (
                                    <TextField
                                      size="small"
                                      fullWidth
                                      value={editing.name}
                                      onChange={(e) =>
                                        setEditing({ ...editing, name: e.target.value })
                                      }
                                    />
                                  ) : (
                                    <Box
                                      sx={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {a.name}
                                    </Box>
                                  )}
                                </TableCell>

                                {/* Type */}
                                <TableCell>
                                  {isEditing ? (
                                    <TextField
                                      size="small"
                                      select
                                      value={editing.type}
                                      onChange={(e) => {
                                        const t = e.target.value;
                                        setEditing((ed) => ({
                                          ...ed,
                                          type: t,
                                          subtype: SUBTYPES[t][0],
                                          statement: STATEMENT_BY_TYPE[t],
                                        }));
                                      }}
                                    >
                                      {TYPES.map((t) => (
                                        <MenuItem key={t} value={t}>
                                          {t}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  ) : (
                                    <Chip
                                      size="small"
                                      label={a.type}
                                      color={typeChipColor(a.type)}
                                    />
                                  )}
                                </TableCell>

                                {/* Subtype */}
                                <TableCell>
                                  {isEditing ? (
                                    <TextField
                                      size="small"
                                      select
                                      value={editing.subtype || ""}
                                      onChange={(e) =>
                                        setEditing({ ...editing, subtype: e.target.value })
                                      }
                                    >
                                      {(SUBTYPES[editing.type] || []).map((s) => (
                                        <MenuItem key={s} value={s}>
                                          {s}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  ) : (
                                    a.subtype || "-"
                                  )}
                                </TableCell>

                                {/* Statement */}
                                <TableCell>
                                  {isEditing ? (
                                    <TextField
                                      size="small"
                                      value={STATEMENT_BY_TYPE[editing.type]}
                                      InputProps={{ readOnly: true }}
                                    />
                                  ) : (
                                    a.statement || STATEMENT_BY_TYPE[a.type]
                                  )}
                                </TableCell>

                                {/* Description */}
                                <TableCell>
                                  {isEditing ? (
                                    <TextField
                                      size="small"
                                      fullWidth
                                      value={editing.description || ""}
                                      onChange={(e) =>
                                        setEditing({
                                          ...editing,
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Optional"
                                    />
                                  ) : (
                                    <Box
                                      sx={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {a.description || "-"}
                                    </Box>
                                  )}
                                </TableCell>

                                {/* Actions */}
                                <TableCell
                                  align="right"
                                  sx={{ whiteSpace: "nowrap" }}
                                >
                                  {isEditing ? (
                                    <>
                                      <Tooltip title="Save">
                                        <span>
                                          <IconButton onClick={submitUpdate}>
                                            <SaveIcon />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                      <Tooltip title="Cancel">
                                        <IconButton onClick={cancelEdit}>
                                          <CloseIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  ) : (
                                    <>
                                      <Tooltip title="Edit">
                                        <IconButton onClick={() => startEdit(a)}>
                                          <EditIcon />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete">
                                        <IconButton
                                          color="error"
                                          onClick={() => remove(a._id)}
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                  </Paper>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Empty state */}
      {TYPES.every(
        (t) =>
          !grouped[t] || Object.values(grouped[t]).every((arr) => !arr.length)
      ) && (
        <Paper
          variant="outlined"
          sx={{ p: 4, textAlign: "center", borderRadius: 2 }}
        >
          <Typography variant="subtitle1" gutterBottom>
            No accounts to show.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Adjust search or filters, or click{" "}
            <strong>Apply “{selectedIndustry}”</strong> to seed your template.
          </Typography>
        </Paper>
      )}

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Tip: Use Type &amp; Subtype for smarter reporting. Statement is derived
        automatically from Type.
      </Typography>
    </Stack>
  );
}

ChartOfAccounts.propTypes = {
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      number: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      type: PropTypes.oneOf(TYPES),
      subtype: PropTypes.string,
      statement: PropTypes.string,
      description: PropTypes.string,
      active: PropTypes.bool,
    })
  ),
  refetch: PropTypes.func,
};
