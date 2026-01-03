// server/bilags-only-server.js (example filename)
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { MongoClient } from "mongodb";
import cron from "node-cron";

import bilagsRouter from "./routes/bilags.js";
import bilagsTasks from "./routes/bilagsTasks.js";

/* -------------------- Config -------------------- */
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  "mongodb://127.0.0.1:27017/nexus_erp";

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const ALLOWED_ORIGINS = [
  CLIENT_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

/* -------------------- App -------------------- */
const app = express();
app.set("trust proxy", 1);

// JSON body parsing (no body-parser needed)
app.use(express.json({ limit: "100mb" }));

// CORS
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow curl/postman
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);
app.options("*", cors());

/* -------------------- Static /uploads -------------------- */
/** IMPORTANT: Align with bilags router which writes to <project>/uploads */
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use(
  "/uploads",
  express.static(uploadDir, { fallthrough: false, immutable: false, maxAge: 0 })
);

/* -------------------- DB attach -------------------- */
const mongo = new MongoClient(MONGO_URI);
await mongo.connect();
const db = mongo.db(); // default from URL
app.use((req, _res, next) => {
  req.db = db;
  next();
});

/* -------------------- Health -------------------- */
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", async (_req, res) => {
  try {
    // ping the DB quickly
    await db.command({ ping: 1 });
    res.json({ ok: true, mongo: "connected" });
  } catch {
    res.status(503).json({ ok: false, mongo: "disconnected" });
  }
});

/* -------------------- Routes -------------------- */
app.use("/api/bilags", bilagsRouter);
app.use("/api/bilags", bilagsTasks);

/* 404 for unknown API paths */
app.use("/api", (_req, res) => res.status(404).json({ ok: false, error: "not_found" }));

/* Central error handler */
app.use((err, _req, res, _next) => {
  console.error("[ERR]", err?.stack || err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: err?.message || "server_error" });
  }
});

/* -------------------- Optional cron (every 5 min) -------------------- */
if (/^(1|true|yes)$/i.test(process.env.BILAGS_CRON ?? "0")) {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const { runOnce } = await import("./services/bilagsPipeline.js");
      const r = await runOnce({
        db,
        filter: {
          includeSeen: true,
          limit: Number(process.env.BILAGS_CRON_LIMIT || 100),
          subject: process.env.BILAGS_SUBJECT || "",
          fromContains: process.env.BILAGS_FROM || "",
        },
      });
      console.log("[bilags-cron]", r);
    } catch (e) {
      console.error("[bilags-cron] failed:", e?.message || e);
    }
  });
}

/* -------------------- Boot -------------------- */
app.listen(PORT, HOST, () => {
  console.log(`[BOOT] Bilags API listening on http://${HOST}:${PORT}`);
  console.log(`       Serving uploads from: ${uploadDir}`);
  console.log(`[BOOT] CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log("[BOOT] Routes:");
  console.log("  • /api/bilags/email/test");
  console.log("  • /api/bilags/email/fetch");
  console.log("  • /api/bilags/docs, /api/bilags/docs/:id");
  console.log("  • /api/bilags/docs/:id/ocr");
  console.log("  • /api/bilags/docs/:id/llm/extract");
  console.log("  • /api/bilags/docs/manual");
  console.log("  • /uploads/* (static files)");
});
