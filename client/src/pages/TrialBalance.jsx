import React, { useMemo, useState } from "react";
import {
  Paper, Stack, Typography, TextField, Button, Chip, Box,
  ToggleButton, ToggleButtonGroup, Autocomplete,
  Table, TableHead, TableRow, TableCell, TableBody, TableSortLabel,
  Switch, FormControlLabel, Tooltip
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";

/* ---------- utils ---------- */
const fmtKr = (n) => (n ?? 0).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
const toISO = (d) => new Date(d).toISOString().slice(0, 10);
const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function signSplit(amount) {
  // positive => Dr, negative => Cr
  const a = safeNum(amount);
  return a >= 0 ? { dr: a, cr: 0 } : { dr: 0, cr: -a };
}

const inferNameFromCOA = (accounts, num) =>
  accounts?.find((a) => String(a.number) === String(num))?.name || "";

/* =========================================================
   Trial Balance Component
   ========================================================= */
export default function TrialBalance({
  rows = [],          // GL rows [{date, account, debit, credit, memo, ...}]
  accounts = [],      // COA [{number, name, ...}]
  onOpenAccount,      // optional drilldown(accountNumber) -> navigate to GL filtered
  title = "Trial Balance",
}) {
  /* ---------- Filters ---------- */
  const today = toISO(new Date());
  const [mode, setMode] = useState("PERIOD"); // "PERIOD" | "ASOF"
  const [start, setStart] = useState(() => toISO(new Date(new Date().getFullYear(), 0, 1))); // YTD by default
  const [end, setEnd] = useState(today);
  const [asOf, setAsOf] = useState(today);

  const [showZeros, setShowZeros] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyWithActivity, setOnlyWithActivity] = useState(false);

  // Sorting: account (asc), ending (desc)
  const [sort, setSort] = useState({ key: "account", dir: "asc" });

  const dateLabel =
    mode === "ASOF"
      ? `As of ${asOf}`
      : `From ${start} to ${end}`;

  /* ---------- Build TB from GL rows ---------- */
  const indexByAccount = useMemo(() => {
    const idx = new Map(); // acc => { opening, periodDebit, periodCredit }
    const inPeriod = (d) =>
      mode === "ASOF"
        ? toISO(d) <= asOf
        : toISO(d) >= start && toISO(d) <= end;

    for (const r of rows) {
      const acc = String(r.account || "");
      if (!acc) continue;

      const dateStr = toISO(r.date || r.createdAt || new Date());
      const debit = safeNum(r.debit);
      const credit = safeNum(r.credit);

      if (!idx.has(acc)) idx.set(acc, { opening: 0, periodDebit: 0, periodCredit: 0 });

      if (mode === "ASOF") {
        // Opening = all activity strictly before asOf; Period = activity on that date (optional)
        if (dateStr < asOf) {
          idx.get(acc).opening += debit - credit;
        } else if (dateStr === asOf) {
          idx.get(acc).periodDebit += debit;
          idx.get(acc).periodCredit += credit;
        }
      } else {
        // PERIOD mode
        if (dateStr < start) {
          idx.get(acc).opening += debit - credit;
        } else if (inPeriod(dateStr)) {
          idx.get(acc).periodDebit += debit;
          idx.get(acc).periodCredit += credit;
        }
      }
    }
    return idx;
  }, [rows, mode, start, end, asOf]);

  const tbRows = useMemo(() => {
    const out = [];

    for (const [account, vals] of indexByAccount.entries()) {
      const name = inferNameFromCOA(accounts, account);
      const opening = vals.opening;
      const periodDebit = vals.periodDebit;
      const periodCredit = vals.periodCredit;
      const ending = opening + (periodDebit - periodCredit);

      // compute display slices
      const { dr: openingDr, cr: openingCr } = signSplit(opening);
      const { dr: endingDr, cr: endingCr } = signSplit(ending);

      const activity = (periodDebit || 0) + (periodCredit || 0);

      out.push({
        account,
        name,
        opening,
        openingDr,
        openingCr,
        periodDebit,
        periodCredit,
        ending,
        endingDr,
        endingCr,
        activity,
      });
    }

    // search filter
    const q = query.trim().toLowerCase();
    const filtered = out.filter((r) => {
      if (!showZeros && r.opening === 0 && r.periodDebit === 0 && r.periodCredit === 0 && r.ending === 0) {
        return false;
      }
      if (onlyWithActivity && r.activity === 0) return false;
      if (!q) return true;
      return (
        String(r.account).toLowerCase().includes(q) ||
        String(r.name || "").toLowerCase().includes(q)
      );
    });

    // sort
    filtered.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "ending") return dir * (b.ending - a.ending); // default show big balances first
      if (sort.key === "account") return dir * String(a.account).localeCompare(String(b.account));
      if (sort.key === "name") return dir * String(a.name || "").localeCompare(String(b.name || ""));
      if (sort.key === "debit") return dir * (b.periodDebit - a.periodDebit);
      if (sort.key === "credit") return dir * (b.periodCredit - a.periodCredit);
      return 0;
    });

    return filtered;
  }, [indexByAccount, accounts, query, sort, showZeros, onlyWithActivity]);

  const totals = useMemo(() => {
    return tbRows.reduce(
      (t, r) => {
        t.periodDebit += r.periodDebit;
        t.periodCredit += r.periodCredit;
        t.endingDr += r.endingDr;
        t.endingCr += r.endingCr;
        return t;
      },
      { periodDebit: 0, periodCredit: 0, endingDr: 0, endingCr: 0 }
    );
  }, [tbRows]);

  /* ---------- CSV Export ---------- */
  const exportCSV = () => {
    const header = [
      "Account",
      "Name",
      "Opening Dr",
      "Opening Cr",
      "Period Debit",
      "Period Credit",
      "Ending Dr",
      "Ending Cr",
    ];
    const lines = tbRows.map((r) =>
      [
        `"${r.account}"`,
        `"${(r.name || "").replace(/"/g, '""')}"`,
        r.openingDr.toFixed(2).replace(".", ","),
        r.openingCr.toFixed(2).replace(".", ","),
        r.periodDebit.toFixed(2).replace(".", ","),
        r.periodCredit.toFixed(2).replace(".", ","),
        r.endingDr.toFixed(2).replace(".", ","),
        r.endingCr.toFixed(2).replace(".", ","),
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial_balance_${mode === "ASOF" ? asOf : `${start}_to_${end}`}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---------- UI ---------- */
  const setSortKey = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "ending" ? "desc" : "asc" }));

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="h5">{title}</Typography>
          <Chip size="small" label={dateLabel} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Chip label={`Debit ${fmtKr(totals.periodDebit)}`} color="success" variant="outlined" />
          <Chip label={`Credit ${fmtKr(totals.periodCredit)}`} color="error" variant="outlined" />
          <Chip
            label={`Ending Dr ${fmtKr(totals.endingDr)} / Cr ${fmtKr(totals.endingCr)}`}
            variant="outlined"
          />
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportCSV}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {/* Controls */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              size="small"
            >
              <ToggleButton value="PERIOD">Period</ToggleButton>
              <ToggleButton value="ASOF">As of</ToggleButton>
            </ToggleButtonGroup>

            {mode === "ASOF" ? (
              <TextField
                label="As of"
                type="date"
                size="small"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            ) : (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Start"
                  type="date"
                  size="small"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End"
                  type="date"
                  size="small"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <TextField
              size="small"
              placeholder="Search account or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />,
              }}
              sx={{ minWidth: 260 }}
            />

            <FormControlLabel
              control={<Switch checked={onlyWithActivity} onChange={(e) => setOnlyWithActivity(e.target.checked)} />}
              label="Only accounts with activity"
            />

            <FormControlLabel
              control={<Switch checked={showZeros} onChange={(e) => setShowZeros(e.target.checked)} />}
              label="Show zero balances"
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Box sx={{
          "& table": { tableLayout: "fixed" },
          "& th, & td": { verticalAlign: "middle", height: 40 },
          "& td": { fontVariantNumeric: "tabular-nums" }
        }}>
          <Table size="small">
            <colgroup>
              <col style={{ width: 140 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sort.key === "account" ? sort.dir : false}>
                  <TableSortLabel
                    active={sort.key === "account"}
                    direction={sort.key === "account" ? sort.dir : "asc"}
                    onClick={() => setSortKey("account")}
                  >
                    Account
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sort.key === "name" ? sort.dir : false}>
                  <TableSortLabel
                    active={sort.key === "name"}
                    direction={sort.key === "name" ? sort.dir : "asc"}
                    onClick={() => setSortKey("name")}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Opening (Dr)</TableCell>
                <TableCell align="right">Opening (Cr)</TableCell>
                <TableCell sortDirection={sort.key === "debit" ? sort.dir : false} align="right">
                  <TableSortLabel
                    active={sort.key === "debit"}
                    direction={sort.key === "debit" ? sort.dir : "asc"}
                    onClick={() => setSortKey("debit")}
                  >
                    Period Debit
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sort.key === "credit" ? sort.dir : false} align="right">
                  <TableSortLabel
                    active={sort.key === "credit"}
                    direction={sort.key === "credit" ? sort.dir : "asc"}
                    onClick={() => setSortKey("credit")}
                  >
                    Period Credit
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sort.key === "ending" ? sort.dir : false} align="right">
                  <TableSortLabel
                    active={sort.key === "ending"}
                    direction={sort.key === "ending" ? sort.dir : "desc"}
                    onClick={() => setSortKey("ending")}
                  >
                    Ending (Dr)
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Ending (Cr)</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {tbRows.map((r) => (
                <TableRow
                  key={r.account}
                  hover
                  onClick={() => onOpenAccount?.(r.account)}
                  sx={{ cursor: onOpenAccount ? "pointer" : "default" }}
                >
                  <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {r.account}
                  </TableCell>
                  <TableCell>{r.name || <span style={{ opacity: 0.6 }}>—</span>}</TableCell>
                  <TableCell align="right">{r.openingDr ? fmtKr(r.openingDr) : ""}</TableCell>
                  <TableCell align="right">{r.openingCr ? fmtKr(r.openingCr) : ""}</TableCell>
                  <TableCell align="right">{r.periodDebit ? fmtKr(r.periodDebit) : ""}</TableCell>
                  <TableCell align="right">{r.periodCredit ? fmtKr(r.periodCredit) : ""}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {r.endingDr ? fmtKr(r.endingDr) : ""}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {r.endingCr ? fmtKr(r.endingCr) : ""}
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals */}
              <TableRow>
                <TableCell colSpan={4} align="right">
                  <Typography variant="body2" fontWeight={700}>Totals</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>{fmtKr(totals.periodDebit)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>{fmtKr(totals.periodCredit)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>{fmtKr(totals.endingDr)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>{fmtKr(totals.endingCr)}</Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          Debits must equal credits. Ending Dr should equal Ending Cr for the whole book.
        </Typography>
      </Paper>
    </Stack>
  );
}
