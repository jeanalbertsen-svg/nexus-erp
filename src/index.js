import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

import accountRoutes from "./routes/accounts.js";
import generalLedgerRoutes from "./routes/generalLedger.js"; // ✅ correct name
import journalsRouter from "./routes/journals.js";

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nexus_erp";
await mongoose.connect(MONGO_URI);

// ✅ mount with the same identifiers you imported
app.use("/api/accounts", accountRoutes);
app.use("/api/gl", generalLedgerRoutes);
app.use("/api/journal", journalsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
