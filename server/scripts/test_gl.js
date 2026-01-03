// server/scripts/test_gl.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import GLEntry from "../models/GLEntry.js";

dotenv.config();

const ymd = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}`;
};

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const date = "2025-01-15";
  const jeNumber = `JE-${ymd(date)}-0007`;
  const reference = `1000-${ymd(date)}-123`;

  // clean any previous test rows
  await GLEntry.deleteMany({ jeNumber });

  // insert the two sides
  await GLEntry.insertMany([
    {
      date,
      account: "1000",
      memo: "Test JE debit",
      debit: 2500,
      credit: 0,
      reference,
      jeNumber,
      journalId: "TEST-JE-7",
      source: "JE",
      locked: true,
    },
    {
      date,
      account: "4000",
      memo: "Test JE credit",
      debit: 0,
      credit: 2500,
      reference,
      jeNumber,
      journalId: "TEST-JE-7",
      source: "JE",
      locked: true,
    },
  ]);

  const rows = await GLEntry.find({ jeNumber }).lean();
  console.log("Inserted rows for", jeNumber, rows);

  await mongoose.disconnect();
};

main().catch((e) => { console.error(e); process.exit(1); });
