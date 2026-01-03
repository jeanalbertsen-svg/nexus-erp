// client/src/pages/BalanceSheet.jsx
import React, { useMemo, useState } from "react";
import {
  Paper,
  Stack,
  Typography,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Button,
  Alert,
  Divider,
  TableContainer,
  Toolbar,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const fmtKr = (n) =>
  (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });

/* ---------- COA helpers (number ranges) ---------- */
const isAsset = (n) => {
  const x = Number(n);
  return x >= 1000 && x <= 1999;
};
const isLiability = (n) => {
  const x = Number(n);
  return x >= 2000 && x <= 2999;
};
const isEquity = (n) => {
  const x = Number(n);
  return x >= 3000 && x <= 3999;
};

const isCurrentAsset = (n) => Number(n) < 1500;
const isCurrentLiability = (n) => Number(n) < 2500;

/* ---------- Build balances up to a date ---------- */
function buildBalances(rows, asOfYMD) {
  const upto = new Date(asOfYMD ?? new Date());
  const map = new Map(); // account -> { debit, credit }

  for (const r of rows || []) {
    const d = new Date(r.date);
    if (isNaN(d) || d > upto) continue;
    const k = String(r.account);
    const prev = map.get(k) || { debit: 0, credit: 0 };
    map.set(k, {
      debit: prev.debit + (+r.debit || 0),
      credit: prev.credit + (+r.credit || 0),
    });
  }
  return map;
}

/* ---------- CSV Export ---------- */
function exportCSV(lines, name = "balance_sheet.csv") {
  const header = ["Section", "Account", "Name", "Amount (DKK)"];
  const rows = lines.map((l) =>
    [
      l.section,
      `"${l.number}"`,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      (l.amount || 0).toFixed(2).replace(".", ","),
    ].join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- Themed table wrapper ---------- */
function ThemedTable({ head, body }) {
  const theme = useTheme();
  const divider = theme.palette.divider;
  const headBg = theme.palette.primary.main;
  const headFg = theme.palette.getContrastText(headBg);
  const zebra = alpha(
    theme.palette.primary.main,
    theme.palette.mode === "dark" ? 0.06 : 0.03
  );

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        border: `1px solid ${divider}`,
        overflow: "hidden",
      }}
    >
      <Table
        size="small"
        stickyHeader
        sx={{
          "& th, & td": { borderColor: divider },
          "& thead th": {
            bgcolor: headBg,
            color: headFg,
            borderBottom: `2px solid ${headBg}`,
            fontSize: 12,
            whiteSpace: "nowrap",
          },
          "& td": { fontSize: 12 },
          "& tbody tr:nth-of-type(odd)": { bgcolor: zebra },
        }}
      >
        <TableHead>
          <TableRow>{head}</TableRow>
        </TableHead>
        <TableBody>{body}</TableBody>
      </Table>
    </TableContainer>
  );
}

/* ---------- MAIN (ONE BOX) ---------- */
export default function BalanceSheet({ rows = [], accounts = [] }) {
  const theme = useTheme();
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  // account number -> name
  const nameByNo = useMemo(() => {
    const m = new Map();
    (accounts || []).forEach((a) => {
      const k = String(a?.number ?? "");
      if (k) m.set(k, a?.name || "");
    });
    return m;
  }, [accounts]);

  const balances = useMemo(() => buildBalances(rows, asOf), [rows, asOf]);

  // lines with sections & names
  const lines = useMemo(() => {
    const res = [];
    for (const [acc, { debit, credit }] of balances.entries()) {
      const amount = isAsset(acc) ? debit - credit : credit - debit; // normal balance
      if (Math.abs(amount) < 1e-8) continue;

      let section = null;
      if (isAsset(acc))
        section = isCurrentAsset(acc) ? "Current Assets" : "Non-current Assets";
      else if (isLiability(acc))
        section = isCurrentLiability(acc)
          ? "Current Liabilities"
          : "Non-current Liabilities";
      else if (isEquity(acc)) section = "Equity";
      else continue;

      res.push({
        section,
        number: String(acc),
        name: nameByNo.get(String(acc)) || "",
        amount,
      });
    }
    return res.sort((a, b) => Number(a.number) - Number(b.number));
  }, [balances, nameByNo]);

  const totals = useMemo(() => {
    const A = lines
      .filter((l) => l.section.includes("Assets"))
      .reduce((s, l) => s + l.amount, 0);
    const L = lines
      .filter((l) => l.section.includes("Liabilities"))
      .reduce((s, l) => s + l.amount, 0);
    const E = lines.filter((l) => l.section === "Equity").reduce((s, l) => s + l.amount, 0);
    return { assets: A, liabilities: L, equity: E, diff: A - (L + E) };
  }, [lines]);

  const exportLines = useMemo(
    () => [
      ...lines,
      { section: "TOTAL", number: "", name: "Assets", amount: totals.assets },
      { section: "TOTAL", number: "", name: "Liabilities", amount: totals.liabilities },
      { section: "TOTAL", number: "", name: "Equity", amount: totals.equity },
      {
        section: "CHECK",
        number: "",
        name: "Assets - (Liabilities + Equity)",
        amount: totals.diff,
      },
    ],
    [lines, totals]
  );

  const currentAssets = lines.filter((l) => l.section === "Current Assets");
  const nonCurrentAssets = lines.filter((l) => l.section === "Non-current Assets");
  const currentLiabs = lines.filter((l) => l.section === "Current Liabilities");
  const nonCurrentLiabs = lines.filter((l) => l.section === "Non-current Liabilities");
  const equity = lines.filter((l) => l.section === "Equity");
  const sum = (arr) => arr.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <Paper variant="outlined" sx={{ p: 0, borderRadius: 3 }}>
      {/* Header/toolbar — inside the SAME box */}
      <Toolbar
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontWeight: 800, color: theme.palette.primary.main, mr: 1 }}
        >
          Balance Sheet
        </Typography>
        <TextField
          type="date"
          label="As of"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ width: 220 }}
        />
        <Stack direction="row" sx={{ ml: "auto" }}>
          <Button
            startIcon={<FileDownloadIcon />}
            variant="outlined"
            size="small"
            onClick={() => exportCSV(exportLines)}
          >
            Export CSV
          </Button>
        </Stack>
      </Toolbar>

      <Stack spacing={2} sx={{ p: 2 }}>
        {Math.abs(totals.diff) > 1e-6 && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Balance check mismatch: Assets {fmtKr(totals.assets)} vs Liabilities + Equity{" "}
            {fmtKr(totals.liabilities + totals.equity)} (Δ {fmtKr(totals.diff)}).
          </Alert>
        )}

        {/* Two columns—but still ONE outer Paper */}
        <Grid container spacing={2}>
          {/* Left: Assets */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Assets
              </Typography>

              <SectionTable
                title="Current Assets"
                rows={currentAssets}
                subtotal={sum(currentAssets)}
              />
              <SectionTable
                title="Non-current Assets"
                rows={nonCurrentAssets}
                subtotal={sum(nonCurrentAssets)}
              />

              <Divider />
              <RowTotal label="Total Assets" amount={totals.assets} />
            </Stack>
          </Grid>

          {/* Right: Liabilities & Equity */}
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Liabilities
              </Typography>

              <SectionTable
                title="Current Liabilities"
                rows={currentLiabs}
                subtotal={sum(currentLiabs)}
              />
              <SectionTable
                title="Non-current Liabilities"
                rows={nonCurrentLiabs}
                subtotal={sum(nonCurrentLiabs)}
              />

              <Divider />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Equity
              </Typography>
              <SectionTable title="" rows={equity} subtotal={sum(equity)} />

              <Divider />
              <RowTotal
                label="Total Liabilities & Equity"
                amount={totals.liabilities + totals.equity}
              />
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  );
}

/* ---------- Pieces ---------- */
function SectionTable({ title, rows, subtotal }) {
  return (
    <Stack spacing={1}>
      {title ? (
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      ) : null}

      <ThemedTable
        head={
          <>
            <TableCell sx={{ width: 120 }}>Account</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right" sx={{ width: 160 }}>
              Amount (DKK)
            </TableCell>
          </>
        }
        body={
          <>
            {(rows || []).map((r) => (
              <TableRow key={r.number}>
                <TableCell
                  sx={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {r.number}
                </TableCell>
                <TableCell>{r.name || "-"}</TableCell>
                <TableCell align="right">{fmtKr(r.amount)}</TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell />
              <TableCell sx={{ fontWeight: 700 }}>Subtotal</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {fmtKr(subtotal)}
              </TableCell>
            </TableRow>
          </>
        }
      />
    </Stack>
  );
}

function RowTotal({ label, amount }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700 }}>{fmtKr(amount)}</Typography>
    </Stack>
  );
}
