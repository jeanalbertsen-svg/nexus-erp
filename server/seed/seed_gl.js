// server/seed/seed_gl.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import GeneralLedger from "../models/GeneralLedger.js";

dotenv.config();

/* helpers */
const ymd = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const da = String(dt.getDate()).padStart(2, "0");
  return `${y}${m}${da}`;
};

const buildRef = (account, date, seq) =>
  `${String(account)}-${ymd(date)}-${String(seq).padStart(3, "0")}`;

const buildJeNo = (date, seq) =>
  `JE-${ymd(date)}-${String(seq).padStart(4, "0")}`;

const seedGL = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Remove all existing entries if --wipe flag
    if (process.argv.includes("--wipe")) {
      await GeneralLedger.deleteMany({});
      console.log("General Ledger wiped ✅");
      await mongoose.disconnect();
      process.exit(0);
    }

    // Example seed entries WITH Ref No. + JE No.
    const e1Date = new Date("2025-01-01");
    const e2Date = new Date("2025-01-05");
    const e3Date = new Date("2025-01-10");

    const entries = [
      {
        date: e1Date,
        account: "1000",
        memo: "Opening Balance",
        debit: 50000,
        credit: 0,
        balance: 50000,
        source: "Manual",
        locked: false,
        reference: buildRef("1000", e1Date, 1),   // e.g. 1000-20250101-001
        jeNumber: buildJeNo(e1Date, 1),           // e.g. JE-20250101-0001
        journalId: undefined,
      },
      {
        date: e2Date,
        account: "4000",
        memo: "Service Revenue",
        debit: 0,
        credit: 10000,
        balance: 40000,
        source: "Manual",
        locked: false,
        reference: buildRef("4000", e2Date, 2),
        jeNumber: buildJeNo(e2Date, 2),
        journalId: undefined,
      },
      {
        date: e3Date,
        account: "5100",
        memo: "Salaries",
        debit: 5000,
        credit: 0,
        balance: 45000,
        source: "Manual",
        locked: false,
        reference: buildRef("5100", e3Date, 3),
        jeNumber: buildJeNo(e3Date, 3),
        journalId: undefined,
      },
    ];

    await GeneralLedger.insertMany(entries);
    console.log("General Ledger seeded ✅");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed ❌", err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
};

seedGL();
