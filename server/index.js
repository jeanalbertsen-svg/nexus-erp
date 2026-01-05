import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import fs from "fs";
import path from "node:path";
import os from "os"; // detect local LAN IPs

/* ---------- Core routes ---------- */
import accountRoutes from "./routes/accounts.js";
import generalLedgerRoutes from "./routes/generalLedger.js";
import journalsRouter from "./routes/journals.js";
import reportsRouter from "./routes/reports.js";
import personsRoute from "./routes/persons.js";
import financeRouter from "./routes/finance.js";
import purchaseInvoiceRoutes from "./routes/purchaseInvoices.js";
import invoiceRouter from "./routes/invoice.js"; // Sales invoices
import stockMoveRouter from "./routes/stock_move.js";
import authRoutes from "./routes/auth.js";

/* ---------- Inventory ---------- */
import inventoryRouter from "./routes/inventory.js";
import itemRouter from "./routes/item.js";

/* ---------- Project management ---------- */
import projectsRouter from "./routes/projects.js";

/* ---------- Models for boot seed ---------- */
import { Warehouse } from "./models/Inventory.js";
import { Item } from "./models/Item.js";
import Person from "./models/Person.js";

/* ---------- Bilags + Seed ---------- */
import bilagsRouter from "./routes/bilags.js";
import seedRouter from "./routes/seed.js";

/* ---------- Config ---------- */
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nexus_erp";

// ✅ prod/dev switch
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// ✅ IMPORTANT: allow comma-separated origins in env
// Example PROD: https://jeanalbertsen.com,https://www.jeanalbertsen.com
// Example DEV:  http://localhost:5173,http://127.0.0.1:5173
const CLIENT_ORIGIN_RAW = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const CLIENT_ORIGINS = CLIENT_ORIGIN_RAW
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* --- collect local LAN IPs and add common dev ports as allowed origins --- */
function detectLanOrigins(ports = [5173, 4173]) {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(ifaces)) {
    for (const i of entries || []) {
      if (!i.internal && i.family === "IPv4") {
        // Only keep private ranges
        if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)) {
          for (const p of ports) ips.push(`http://${i.address}:${p}`);
        }
      }
    }
  }
  return ips;
}

const ENV_EXTRA = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * ✅ Allowed origins:
 * - In PROD: only explicit domains you set in CLIENT_ORIGIN/CORS_ORIGINS (+ jeanalbertsen regex)
 * - In DEV: include localhost + LAN detection
 */
const BASE_ALLOWED = new Set([
  ...CLIENT_ORIGINS,
  ...ENV_EXTRA,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

if (!IS_PROD) {
  // optional dev convenience (phone/LAN)
  BASE_ALLOWED.add("http://172.20.10.3:5173");
  for (const o of detectLanOrigins()) BASE_ALLOWED.add(o);
}

const ALLOWED_ORIGINS = Array.from(BASE_ALLOWED);

// ✅ Allow your domain family automatically (so you don’t forget to add www/non-www)
const ALLOW_DOMAIN_REGEXES = [/^https:\/\/(www\.)?jeanalbertsen\.com$/i];

function isAllowedOrigin(origin) {
  if (!origin) return true; // curl/postman/native/no origin
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOW_DOMAIN_REGEXES.some((rx) => rx.test(origin));
}

mongoose.set("strictQuery", true);
const app = express();

/* ---------- Preboot filesystem ---------- */
// Ensure uploads folder under /server/uploads (used by bilags + OCR)
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
console.log("[BOOT] Uploads dir ready:", uploadDir);

/* ---------- CORS (shared options for normal + preflight) ---------- */
const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);

    console.log("[CORS BLOCKED ORIGIN]", origin);
    console.log("[CORS ALLOWED ORIGINS]", ALLOWED_ORIGINS);
    console.log("[CORS ALLOWED REGEXES]", ALLOW_DOMAIN_REGEXES.map(String));
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 600,
};

app.use(cors(corsOptions));
// ✅ IMPORTANT: preflight must use SAME options, not cors() default
app.options("*", cors(corsOptions));
/* ---------- Parsers / misc ---------- */
app.use(express.json({ limit: "100mb" }));
app.set("trust proxy", 1);

/* ---------- Health / readiness ---------- */
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", (_req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    ok: mongoose.connection.readyState === 1,
    mongo:
      states[mongoose.connection.readyState] ||
      mongoose.connection.readyState,
  });
});

/* ---------- Native DB handle ---------- */
app.use((req, _res, next) => {
  req.db = mongoose.connection.db;
  next();
});

/* ---------- Static ---------- */
app.use(
  "/uploads",
  express.static(uploadDir, {
    fallthrough: false,
    immutable: false,
    maxAge: 0,
  })
);

/* ---------- Routes ---------- */
/* Login */
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/gl", generalLedgerRoutes);
app.use("/api/journals", journalsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/persons", personsRoute);
app.use("/api/finance", financeRouter);
app.use("/api/purchasing/invoices", purchaseInvoiceRoutes);
app.use("/api/invoice", invoiceRouter);

// Inventory
app.use("/api/inventory/items", itemRouter);
app.use("/api/inventory", inventoryRouter);

// Project management
app.use("/api/projects", projectsRouter);

// Stock moves — new and legacy paths (keep both)
app.use("/api/stock/moves", stockMoveRouter);
app.use("/api/stock-moves", stockMoveRouter);

// Bilags (OCR + LLM + IMAP email fetch)
app.use("/api/bilags", bilagsRouter);

// Seed data
app.use(seedRouter);

/* 404 for unknown API routes */
app.use("/api", (_req, res) =>
  res.status(404).json({ ok: false, error: "not_found" })
);

/* Central error handler */
app.use((err, _req, res, _next) => {
  console.error("[ERR]", err?.stack || err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: err?.message || "server_error" });
  }
});

/* ---------- Boot ---------- */
async function start() {
  try {
    console.log(`[BOOT] NODE_ENV=${NODE_ENV}`);
    console.log(`[BOOT] Connecting Mongo @ ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI, { autoIndex: true });
    console.log("[BOOT] Mongo connected");

    // Diagnostics for OCR / LLM envs
    console.log("[IMAP CHECK] Host:", process.env.IMAP_HOST || "(unset)");
    console.log("[IMAP CHECK] User:", process.env.IMAP_USER || "(unset)");
    console.log("[IMAP CHECK] Pass:", process.env.IMAP_PASS ? "(present)" : "(missing)");
    console.log("[IMAP CHECK] Mailbox:", process.env.MAILBOX || "INBOX");
    console.log("[OCR CHECK] Vendor:", process.env.OCR_VENDOR || "auto");
    console.log("[OCR CHECK] Lang:", process.env.OCR_LANG || "eng");
    console.log("[LLM CHECK] Model:", process.env.LLM_MODEL || "(unset)");
    console.log("[LLM CHECK] Key:", process.env.OPENAI_API_KEY ? "(present)" : "(missing)");

    /* ---------- Seed ---------- */
    const personsCount = await Person.countDocuments();
    if (personsCount === 0) {
      await Person.insertMany([
        { name: "Alice Jensen", roles: ["prepare", "approve"] },
        { name: "Bo Larsen", roles: ["prepare"] },
        { name: "Caroline Madsen", roles: ["approve", "post"] },
        { name: "Dennis Nguyen", roles: ["post"] },
        { name: "Eva Sørensen", roles: ["prepare", "approve", "post"] },
      ]);
      console.log("[BOOT] Seeded default persons");
    }

    const mainWh = await Warehouse.findOne({ code: "MAIN" });
    if (!mainWh) {
      await Warehouse.create({
        code: "MAIN",
        name: "Main Warehouse",
        isDefault: true,
        isActive: true,
      });
      console.log("[BOOT] Created default warehouse MAIN");
    }

    const itemCount = await Item.countDocuments();
    if (itemCount === 0) {
      await Item.create({
        sku: "SKU-STARTER-001",
        name: "Starter Item",
        description: "Demo item for first run",
        uom: "pcs",
        status: "active",
      });
      console.log("[BOOT] Seeded a starter Item (SKU-STARTER-001)");
    }

    app.listen(PORT, HOST, () => {
      console.log(`[BOOT] API listening on http://${HOST}:${PORT}`);
      console.log("  • /healthz  /readyz");
      console.log(`[BOOT] CORS origins (explicit): ${ALLOWED_ORIGINS.join(", ")}`);
      console.log(`[BOOT] CORS regex allow: ${ALLOW_DOMAIN_REGEXES.map(String).join(", ")}`);
    });
  } catch (err) {
    if (err.code === "EADDRINUSE") {
      console.error(`[FATAL] Port ${PORT} already in use.`);
      console.error("Run:");
      console.error(`  sudo lsof -iTCP:${PORT} -sTCP:LISTEN`);
      console.error("Then kill the old process, e.g.:");
      console.error(`  kill -9 $(lsof -t -iTCP:${PORT} -sTCP:LISTEN)`);
    } else {
      console.error("[FATAL] Failed to start server:", err?.message || err);
      console.error("Make sure MongoDB is running: e.g. 'sudo systemctl start mongod'");
    }
    process.exit(1);
  }
}

start();
