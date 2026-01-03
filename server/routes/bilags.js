import express from "express";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module"; // CJS/ESM interop for pdf-parse & axios
import { ObjectId } from "mongodb";

// ---- pdf-parse normalization (handles both ESM default and CJS) ----
const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;

// axios + multipart for OCR.space
const axios = require("axios");
const FormData = require("form-data");

// Use our lightweight tesseract wrapper (server/lib/ocr.js)
import { ocrFile /*, isOcrCandidate*/ } from "../lib/ocr.js";

// pdfkit interop (ESM/CJS)
const pdfkitModule = require("pdfkit");
const PDFDocument = pdfkitModule.default || pdfkitModule;

/* ────────────────────────────── Config helpers ───────────────────────────── */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function env(v, def = "") {
  const s = process.env[v];
  return s === undefined || s === null ? def : String(s);
}
function bool(v, def) {
  const s = env(v, String(def));
  return /^(1|true|yes)$/i.test(s);
}
const DEBUG = bool("IMAP_DEBUG", false);

// OCR config
const OCR_VENDOR = env("OCR_VENDOR", "auto").toLowerCase(); // auto | tesseract | ocrspace
const OCR_LANG = env("OCR_LANG", "eng");
const OCRSPACE_KEY = env("OCRSPACE_KEY", "");
const OCR_TIMEOUT_MS = Number(env("OCR_TIMEOUT_MS", 180000));

/* ─────────────────────────── LLM config + STRICT schema ─────────────────── */
const LLM_MODEL = env("LLM_MODEL", "gpt-4o-mini");
const OPENAI_KEY = env("OPENAI_API_KEY", "");

// Retry knobs for OpenAI calls (helps with 429s)
const LLM_MAX_RETRIES = Number(env("LLM_MAX_RETRIES", 4));
const LLM_MIN_DELAY_MS = Number(env("LLM_MIN_DELAY_MS", 1200));
const LLM_MAX_DELAY_MS = Number(env("LLM_MAX_DELAY_MS", 6000));

// Strict JSON schema the model must follow
const InvoiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["header", "lines"],
  properties: {
    header: {
      type: "object",
      additionalProperties: false,
      required: ["supplier", "numbers", "date", "currency", "totals"],
      properties: {
        supplier: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                vat: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                address: { type: "string" },
              },
            },
          ],
        },
        numbers: {
          type: "object",
          additionalProperties: false,
          properties: {
            invoiceNo: { type: ["string", "null"] },
            orderNo: { type: ["string", "null"] },
            poNo: { type: ["string", "null"] },
            jeNumber: { type: ["string", "null"] }, // allow JE number here too
          },
        },
        date: { type: ["string", "null"] },
        currency: { type: "string" },
        totals: {
          type: "object",
          additionalProperties: false,
          properties: {
            subtotal: { type: ["number", "null"] },
            tax: { type: ["number", "null"] },
            totalInc: { type: ["number", "null"] },
          },
        },
      },
    },
    lines: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["desc", "qty", "uom", "unitPrice", "lineTotal"],
        properties: {
          sku: { type: "string", default: "" },
          desc: { type: "string" },
          qty: { type: "number" },
          uom: { type: "string" },
          unitPrice: { type: "number" },
          taxRate: { type: ["number", "null"] },
          taxAmount: { type: ["number", "null"] },
          lineNet: { type: ["number", "null"] },
          lineTotal: { type: "number" },
          category: { type: ["string", "null"] },
        },
      },
    },
    notes: { type: "string" },
  },
};

// utility: sleep with jittered exponential backoff
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function backoffDelay(attempt) {
  const base = Math.min(LLM_MIN_DELAY_MS * Math.pow(2, attempt), LLM_MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * (base * 0.4));
  return base + jitter;
}

// OpenAI caller: returns null if no key OR after exhausting retries (so we can gracefully fall back)
async function callLLM({ system, prompt, schema }) {
  if (!OPENAI_KEY) return null;

  const body = {
    model: LLM_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "invoice_extraction", schema, strict: true },
    },
  };

  for (let attempt = 0; attempt < LLM_MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        if (resp.status === 429 || (resp.status >= 500 && resp.status <= 599)) {
          if (attempt < LLM_MAX_RETRIES - 1) {
            if (DEBUG) console.warn(`[LLM] HTTP ${resp.status}; retrying…`);
            await sleep(backoffDelay(attempt));
            continue;
          }
          return null;
        }
        if (DEBUG) console.warn(`[LLM] Non-retriable HTTP ${resp.status}`);
        return null;
      }

      const data = await resp.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    } catch (e) {
      if (attempt < LLM_MAX_RETRIES - 1) {
        if (DEBUG) console.warn(`[LLM] Error: ${e?.message || e}; retrying…`);
        await sleep(backoffDelay(attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

// Direct collection helper (no Mongoose here)
const coll = (req) => {
  if (!req?.db) throw new Error("db_not_ready");
  return req.db.collection("bilags_docs");
};

/* ───────────────────── Simple extraction from text ──────────────────────── */
const NUM = /(?:\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2})?)/;
const CUR = /(DKK|KR|KR\.|EUR|USD|GBP|SEK|NOK|CHF)/i;

// ── DK/receipt-aware helpers ───────────────────────────────────────────────
const DK_WORDS = /\b(kvittering|moms|bel[øo]b|faktura|cvr|bilag|konto|s[æa]lger)\b/i;
const DATE_ANY = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/;

function normDate(dstr) {
  if (!dstr) return null;
  const m = String(dstr).match(DATE_ANY);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  dd = dd.padStart(2, "0");
  mm = mm.padStart(2, "0");
  yy = yy.length === 2 ? (Number(yy) >= 70 ? `19${yy}` : `20${yy}`) : yy;
  return `${yy}-${mm}-${dd}`; // ISO
}

function parseTaxAndTotals(text) {
  const t = (text || "").replace(/\u00A0/g, " ");
  const vatHit = t.match(new RegExp(`\\b(moms|vat)\\b[ :]*(${NUM.source})`, "i"));
  const exclHit = t.match(new RegExp(`\\b(total\\s*(ex|ekskl\\.?|excl\\.?))\\b[ :]*(${NUM.source})`, "i"));
  const inclHit = t.match(new RegExp(`\\b(total\\s*(inc|inkl\\.?|incl\\.?|i\\s*alt))\\b[ :]*(${NUM.source})`, "i"));
  const belobAlt = t.match(new RegExp(`\\b(bel[øo]b\\s*i\\s*alt)\\b[ :]*(${NUM.source})`, "i"));

  const tax = vatHit ? cleanNum(vatHit[2]) : null;
  const totalInc = inclHit ? cleanNum(inclHit[3]) : (belobAlt ? cleanNum(belobAlt[2]) : null);
  const subtotal = exclHit ? cleanNum(exclHit[3]) : (totalInc != null && tax != null ? +(totalInc - tax).toFixed(2) : null);

  const resolvedTotal = totalInc != null ? totalInc
    : (subtotal != null && tax != null ? +(subtotal + tax).toFixed(2) : null);

  return {
    subtotal: Number.isFinite(subtotal) ? subtotal : null,
    tax: Number.isFinite(tax) ? tax : null,
    totalInc: Number.isFinite(resolvedTotal) ? resolvedTotal : null,
  };
}

function cleanNum(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim();
  s = s.replace(/\s?(kr\.?|dkk|eur|usd|gbp|sek|nok|chf)\b/gi, "");
  s = s.replace(/[^\d.,-]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;

  if (hasComma && hasDot) {
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("");
    s = s.replace(decSep, ".");
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const m = s.match(new RegExp(`^(.*)\\${sep}(\\d{3})$`));
    if (m && m[1].replace(/[^\d]/g, "").length >= 1) {
      s = s.replace(new RegExp(`\\${sep}`, "g"), "");
    } else {
      s = s.replace(sep, ".");
    }
  }
  s = s.replace(/[^\d.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseHeaderFields(text) {
  const t = (text || "").replace(/\u00A0/g, " ");

  const curHit = t.match(CUR)?.[1] || (/\bkr\b/i.test(t) ? "DKK" : "DKK");
  const currency = /kr/i.test(curHit) ? "DKK" : curHit.toUpperCase();

  const firstLines = t
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  let supplier = null;
  for (const line of firstLines.slice(0, 15)) {
    if (/invoice|faktura|receipt|kvittering/i.test(line)) continue;
    if (/^cvr[:\s]/i.test(line) || /\b\d{8}\b/.test(line)) continue;
    if (/[A-Za-z]/.test(line) && line.length >= 3) {
      if (!supplier || line === line.toUpperCase()) {
        supplier = { name: line.slice(0, 80) };
      }
    }
  }

  const topChunk = firstLines.slice(0, 30).join("\n");
  const vat =
    topChunk.match(/\b(cvr|vat|org\.?nr)\b[ :]*([A-Z0-9.\- ]{6,})/i)?.[2]?.trim() || null;
  const email = topChunk.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  const phone = topChunk.match(/\+?\d[\d\s\-]{6,}\d/)?.[0] || null;

  if (supplier) {
    if (vat) supplier.vat = vat;
    if (email) supplier.email = email;
    if (phone) supplier.phone = phone;
  }

  const invoiceNo =
    t.match(/(?:invoice|faktura)\s*(no\.?|#|nr\.?|nummer)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i)?.[2] ||
    t.match(/\bfaktura(?:nr|nummer)?\b\s*[:\-]?\s*([A-Z0-9\-\/]+)/i)?.[1] || null;

  const orderNo =
    t.match(/(?:order|ordrenr|ordrenummer)\s*(no\.?|#|nr\.?|nummer)?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i)?.[2] || null;

  const dateRaw =
    t.match(/\b(?:dato|invoice\s*date|faktura\s*dato)\b[ :]*([0-9./-]{6,10})/i)?.[1] ||
    t.match(DATE_ANY)?.[0] || null;

  const date = normDate(dateRaw);

  const totals = parseTaxAndTotals(t);
  if (totals.totalInc == null) {
    const totalRegexB = new RegExp(
      `(total|sum)\\s*:?\\s*(${NUM.source})\\s*(?:${CUR.source})?`,
      "i"
    );
    const totHit = t.match(totalRegexB);
    if (totHit) totals.totalInc = cleanNum(totHit[2]);
  }

  return {
    supplier: supplier || null,
    numbers: { invoiceNo, orderNo, jeNumber: null }, // ensure key exists
    date,
    currency,
    totals: {
      subtotal: totals.subtotal ?? null,
      tax: totals.tax ?? null,
      totalInc: totals.totalInc ?? 0,
    },
  };
}

function parseLines(text) {
  const rows = (text || "").split(/\r?\n/);
  const out = [];
  // … (unchanged parsing rules) …
  for (const raw of rows) {
    const s = raw.trim();
    if (!s) continue;
    const m = s.match(
      new RegExp(
        `^([A-Z0-9._-]{3,})\\s+(.+?)\\s+(\\d+(?:[.,]\\d{1,3})?)\\s+(${NUM.source})\\s+(${NUM.source})$`,
        "i"
      )
    );
    if (m) {
      out.push({
        sku: m[1], desc: m[2].slice(0, 140),
        qty: Number(String(m[3]).replace(",", ".")) || 1,
        unitPrice: cleanNum(m[4]), lineTotal: cleanNum(m[5]),
        category: "inventory", uom: "pcs",
      });
      continue;
    }
    let pos = s.match(new RegExp(
      `^(.*?)(\\d+(?:[.,]\\d{1,3})?)\\s*[x×]\\s*(${NUM.source})(?:\\s*[=]\\s*(${NUM.source}))?$`,
      "i"
    ));
    if (pos) {
      const desc = (pos[1].trim() || "Item").slice(0, 140);
      const q = Number(String(pos[2]).replace(",", ".")) || 1;
      const u = cleanNum(pos[3]);
      const tot = pos[4] ? cleanNum(pos[4]) : +(q * u).toFixed(2);
      out.push({ sku: "", desc, qty: q, unitPrice: u, lineTotal: tot, category: "expense", uom: "ea" });
      continue;
    }
    pos = s.match(new RegExp(
      `^(.*?)(${NUM.source})\\s*[x×]\\s*(\\d+(?:[.,]\\d{1,3})?)\\s+(${NUM.source})$`,
      "i"
    ));
    if (pos) {
      const desc = (pos[1].trim() || "Item").slice(0, 140);
      const u = cleanNum(pos[2]);
      const q = Number(String(pos[3]).replace(",", ".")) || 1;
      const tot = cleanNum(pos[4]);
      out.push({ sku: "", desc, qty: q, unitPrice: u, lineTotal: tot || +(q * u).toFixed(2), category: "expense", uom: "ea" });
      continue;
    }
    const mt = s.match(new RegExp(`^(.{6,}?)\\s+(${NUM.source})$`));
    if (mt) {
      out.push({
        sku: "", desc: mt[1].slice(0, 140), qty: 1,
        unitPrice: cleanNum(mt[2]), lineTotal: cleanNum(mt[2]),
        category: /shipping|freight|porto|delivery|fragt|porto/i.test(mt[1]) ? "service" : "expense",
        uom: "ea",
      });
      continue;
    }
  }

  const lines = out.slice(0, 50);
  const hasTotalsLine = (txt) => /\b(total|i\s*alt|amount\s*due|total\s*inkl)/i.test(txt);
  if (!lines.length && hasTotalsLine(text)) {
    const totals = parseTaxAndTotals(text);
    if (totals.totalInc != null) {
      lines.push({ sku: "", desc: "Receipt total", qty: 1, uom: "ea", unitPrice: totals.totalInc, lineTotal: totals.totalInc, category: "expense" });
    }
  }
  return lines;
}
/* ──────────────────────── OCR helpers ─────────────────────────── */

function looksLikeEmptyTextLayer(s) {
  if (!s) return true;
  const t = s.replace(/\s+/g, "");
  return t.length < 50;
}

async function ocrWithTesseract(absPath, lang = OCR_LANG) {
  const { text } = await ocrFile(absPath, { lang });
  return text || "";
}

async function ocrWithOcrSpace(absPath, lang = OCR_LANG) {
  if (!OCRSPACE_KEY) throw new Error("ocrspace_key_missing");
  const form = new FormData();
  form.append("apikey", OCRSPACE_KEY);
  form.append("language", lang.split(/[,:\s]+/).join(","));
  form.append("isCreateSearchablePdf", "false");
  form.append("isTable", "false");
  form.append("OCREngine", "2");
  form.append("file", fs.createReadStream(absPath));

  const { data } = await axios.post("https://api.ocr.space/parse/image", form, {
    headers: form.getHeaders(),
    timeout: OCR_TIMEOUT_MS,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  if (data?.IsErroredOnProcessing) {
    const msg = Array.isArray(data?.ErrorMessage) ? data.ErrorMessage[0] : data?.ErrorMessage;
    throw new Error(`ocrspace_error: ${msg || "unknown"}`);
  }
  const parts = (data?.ParsedResults || []).map((p) => p?.ParsedText || "");
  return parts.join("\n");
}

async function runOcr(absPath, { prefer = OCR_VENDOR, lang = OCR_LANG } = {}) {
  const ext = path.extname(absPath).toLowerCase();
  const isPdf = ext === ".pdf";

  if (prefer === "tesseract") {
    if (isPdf) return ocrWithOcrSpace(absPath, lang);
    return ocrWithTesseract(absPath, lang);
  }
  if (prefer === "ocrspace") {
    return ocrWithOcrSpace(absPath, lang);
  }
  // AUTO
  if (isPdf) return ocrWithOcrSpace(absPath, lang);
  try {
    const t = await ocrWithTesseract(absPath, lang);
    if (looksLikeEmptyTextLayer(t) && OCRSPACE_KEY) {
      const t2 = await ocrWithOcrSpace(absPath, lang);
      return t2 || t;
    }
    return t;
  } catch (e) {
    if (OCRSPACE_KEY) return ocrWithOcrSpace(absPath, lang);
    throw e;
  }
}

/* ─────────────────────── extractFromFile ──────────────────────── */
async function extractFromFile(absPath, opts = {}) {
  const { ocrVendor = OCR_VENDOR, ocrLang = OCR_LANG } = opts;
  const ext = path.extname(absPath).toLowerCase();
  let text = "";

  if (ext === ".pdf") {
    try {
      const data = await pdfParse(fs.readFileSync(absPath));
      text = data.text || "";
    } catch {
      text = "";
    }
    if (looksLikeEmptyTextLayer(text)) {
      if (DEBUG) console.log(`[ocr] PDF had little/no text; running OCR (${ocrVendor})`);
      text = await runOcr(absPath, { prefer: ocrVendor, lang: ocrLang });
    }
  } else if ([".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif", ".webp"].includes(ext)) {
    text = await runOcr(absPath, { prefer: ocrVendor, lang: ocrLang });
  } else {
    try {
      text = fs.readFileSync(absPath, "utf8");
    } catch {
      text = "";
    }
  }

  // Heuristic re-OCR for Danish receipts if first pass looks wrong
  if ((text || "").trim().length > 0) {
    if (DK_WORDS.test(text) && /eng/i.test(OCR_LANG) && !/dan/i.test(OCR_LANG)) {
      try {
        const improved = await runOcr(absPath, { prefer: ocrVendor, lang: "dan,eng" });
        if (improved && improved.length > text.length * 0.8) text = improved; // only accept meaningful change
      } catch {}
    }
  }

  const header = parseHeaderFields(text);
  const lines = parseLines(text);
  return { text, header, lines };
}

/* ─────────────── Auto-generators ──────────────── */
function pad(n, w = 4) { const s = String(n); return s.length >= w ? s : "0".repeat(w - s.length) + s; }
function rand4() { return pad(Math.floor(Math.random() * 10000), 4); }
function yyyymmdd(d = new Date()) { const y = d.getFullYear(); const m = pad(d.getMonth() + 1, 2); const day = pad(d.getDate(), 2); return `${y}${m}${day}`; }
function generateInvoiceNo() { return `INV-${yyyymmdd()}-${rand4()}`; }
function generateOrderNo() { return `ORD-${yyyymmdd()}-${rand4()}`; }
function generateJeNumber() { return `JE-${yyyymmdd()}-${rand4()}`; }
export function generateSku(desc = "") {
  const base =
    desc.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w.slice(0, 3))
      .join("-") || "SKU";

  return `SKU-${base}-${rand4()}`;
}
function defaultUomForCategory(cat = "") { if (/service/i.test(cat)) return "hrs"; if (/inventory/i.test(cat)) return "pcs"; return "ea"; }
// ─────────────── Auto-generators (add these) ───────────────
function generateItemNo(sku = "", desc = "") {
  // short readable stem from sku or desc
  const stem =
    (sku || desc || "ITEM")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "ITEM";
  return `ITEM-${stem}-${rand4()}`;
}
function generateMoveNo() {
  return `MOV-${yyyymmdd()}-${rand4()}`;
}


/* ─────────────────────── IMAP helpers (timeouts + retry) ────────────────── */
function makeImapClient() {
  const client = new ImapFlow({
    host: env("IMAP_HOST", "imap.gmail.com"),
    port: Number(env("IMAP_PORT", 993)),
    secure: bool("IMAP_TLS", true),
    auth: { user: env("IMAP_USER"), pass: env("IMAP_PASS").replace(/\s+/g, "") },
    logger: DEBUG ? console : false,
    disableCompression: true,
    socketTimeout: Number(env("IMAP_SOCKET_TIMEOUT_MS", 180000)),
    greetingTimeout: Number(env("IMAP_GREETING_TIMEOUT_MS", 60000)),
  });

  client.on("error", (err) => {
    console.error("[IMAP] client error:", err?.code || "", err?.message || err);
  });

  return client;
}

async function connectWithRetry(client, mailbox, retries = 2) {
  let attempt = 0;
  const backoff = [0, 1000, 3000];
  while (true) {
    try {
      await client.connect();
      await client.mailboxOpen(mailbox);
      return;
    } catch (err) {
      attempt += 1;
      const code = err?.code || "";
      const msg = err?.message || String(err);
      console.warn(`[IMAP] connect/open failed (attempt ${attempt}):`, code, msg);
      if (attempt > retries || code !== "ETIMEOUT") throw err;
      await new Promise((r) =>
        setTimeout(r, backoff[Math.min(attempt, backoff.length - 1)])
      );
    }
  }
}

/* ───────────────────────────────── Router ───────────────────────────────── */
const router = express.Router();

/** IMAP smoke test */
router.get("/email/test", async (_req, res) => {
  if (!env("IMAP_USER") || !env("IMAP_PASS")) {
    return res
      .status(400)
      .json({ ok: false, error: "IMAP credentials missing (IMAP_USER/IMAP_PASS)" });
  }
  const client = makeImapClient();
  try {
    await connectWithRetry(client, env("MAILBOX", "INBOX"));
    const unseenRes = await client.search({ seen: false }, { uid: true });
    const unseen = (Array.isArray(unseenRes) ? unseenRes : Array.from(unseenRes || [])).length;
    const st = await client.status(env("MAILBOX", "INBOX"), { messages: true });
    res.json({ ok: true, unseen, total: st?.messages ?? 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "imap_test_failed" });
  } finally {
    try {
      await client.logout();
    } catch {}
  }
});

/** FETCH emails -> create docs for attachments */
router.post("/email/fetch", async (req, res) => {
  if (!env("IMAP_USER") || !env("IMAP_PASS")) {
    return res
      .status(400)
      .json({ ok: false, error: "IMAP credentials missing (IMAP_USER/IMAP_PASS)" });
  }
  if (!req?.db) return res.status(503).json({ ok: false, error: "db_not_ready" });

  const { subject = "", includeSeen = true, limit = 50, fromContains = "" } =
    req.body && typeof req.body === "object" ? req.body : {};

  const created = [];
  const mailbox = env("MAILBOX", "INBOX");
  const subjectRaw = String(subject || "");
  const ignoreDefaultSubject = subjectRaw.trim().toLowerCase() === "back office";
  const subjNeedle = ignoreDefaultSubject ? "" : subjectRaw.trim().toLowerCase();
  const fromNeedle = String(fromContains || "").trim().toLowerCase();

  const client = makeImapClient();

  let scanned = 0,
    parsedCount = 0;
  let skippedNoMatch = 0,
    skippedNoFiles = 0,
    skippedDuplicate = 0,
    skippedNoStream = 0;

  try {
    await connectWithRetry(client, mailbox);

    const criteria = includeSeen ? {} : { seen: false };
    const sr = await client.search(criteria, { uid: true });
    const uids = Array.isArray(sr) ? sr : Array.from(sr || []);
    uids.sort((a, b) => b - a);
    if (DEBUG)
      console.log(
        `[bilags] search(${includeSeen ? "ALL" : "UNSEEN"}) -> ${uids.length} uid(s)`
      );

    for (const uid of uids.slice(0, Number(limit) || 50)) {
      scanned += 1;

      let rawSource = null;
      for await (const msg of client.fetch({ uid }, { uid: true, source: true })) {
        rawSource = msg.source;
        break;
      }
      if (!rawSource) {
        skippedNoStream += 1;
        continue;
      }

      const parsed = await simpleParser(rawSource).catch((err) => {
        if (DEBUG) console.warn(`[bilags] uid=${uid} parse error:`, err?.message || err);
        return null;
      });
      if (!parsed) {
        skippedNoStream += 1;
        continue;
      }

      const subj = String(parsed.subject || "");
      const fromText = String(parsed.from?.text || "");
      const subjOk = !subjNeedle || subj.toLowerCase().includes(subjNeedle);
      const fromOk = !fromNeedle || fromText.toLowerCase().includes(fromNeedle);
      if (!subjOk || !fromOk) {
        skippedNoMatch += 1;
        continue;
      }

      // Dedupe by messageId
      const msgId = String(parsed.messageId || "").trim();
      if (msgId) {
        const dupe = await coll(req).findOne(
          { "source.messageId": msgId },
          { projection: { _id: 1 } }
        );
        if (dupe) {
          skippedDuplicate += 1;
          continue;
        }
      }

      // Save parseable attachments (pdf / image / text)
      const savedFiles = [];
      for (const att of parsed.attachments || []) {
        const ct = (att.contentType || "").toLowerCase();
        const isPDF = ct.includes("pdf") || /\.pdf$/i.test(att.filename || "");
        const isImage =
          ct.startsWith("image/") || /\.(png|jpe?g|tiff?|bmp|gif|webp)$/i.test(att.filename || "");
        const isText = ct.startsWith("text/") || /\.txt$/i.test(att.filename || "");
        if (!isPDF && !isImage && !isText) continue;

        let filename = (att.filename || "").trim();
        if (!filename) {
          const ext = isPDF ? ".pdf" : isImage ? ".img" : ".txt";
          filename = `attachment-${Date.now()}${ext}`;
        }
        const safeName = filename.replace(/[^\w.-]+/g, "_");
        const storedAs = `/uploads/${Date.now()}-${safeName}`;
        const dest = path.join(UPLOAD_DIR, path.basename(storedAs));
        fs.writeFileSync(dest, att.content);
        savedFiles.push({
          filename: safeName,
          storedAs,
          mimetype: att.contentType,
          size: Number(att.size || 0),
        });
      }

      if (!savedFiles.length) {
        skippedNoFiles += 1;
        continue;
      }

      // Create doc shell
      const doc = {
        type: "invoice",
        status: "RECEIVED",
        createdAt: new Date(),
        source: {
          subject: subj,
          from: fromText,
          messageId: msgId,
          files: savedFiles,
          receivedAt: parsed.date ? new Date(parsed.date) : new Date(),
        },
        extracted: {},
        proposal: null,
        links: {},
      };
      const ins = await coll(req).insertOne(doc);

      // Extract from attachments
      let lines = [];
      let header = {
        supplier: null,
        numbers: {},
        date: null,
        currency: "DKK",
        totals: {},
      };
      const rawTextParts = []; // <── NEW: keep OCR/plain text for LLM reuse
      for (const f of savedFiles) {
        const abs = path.join(process.cwd(), f.storedAs.replace(/^\//, ""));
        const ex = await extractFromFile(abs).catch((err) => {
          if (DEBUG) console.warn(`[bilags] extract failed for ${abs}:`, err?.message || err);
          return { header: {}, lines: [] };
        });
        if (ex.header?.supplier && !header.supplier) header.supplier = ex.header.supplier;
        header.numbers = { ...header.numbers, ...(ex.header?.numbers || {}) };
        header.currency = ex.header?.currency || header.currency;
        header.totals = { ...header.totals, ...(ex.header?.totals || {}) };
        if (ex.header?.date && !header.date) header.date = ex.header.date;
        lines.push(...(ex.lines || []));
        if (ex?.text) rawTextParts.push(ex.text); // <── NEW
      }
      header.totals.totalInc = Number(header.totals?.totalInc || 0);
      const __rawText = rawTextParts.join("\n").slice(0, 500000); // <── NEW

      await coll(req).updateOne(
        { _id: ins.insertedId },
        {
          $set: {
            extracted: { ...header, lines, __rawText }, // <── NEW
            proposal: buildProposalFromExtraction({ header, lines, subject: subj }),
            status: "PARSED",
            updatedAt: new Date(),
          },
        }
      );

      created.push({ _id: ins.insertedId, subject: subj, files: savedFiles.length });
      parsedCount += 1;
    }

    const meta = {
      scanned,
      parsed: parsedCount,
      skippedNoMatch,
      skippedNoFiles,
      skippedDuplicate,
      skippedNoStream,
    };
    res.json({
      ok: true,
      imported: created.length,
      items: created,
      meta,
      scanned,
      parsed: parsedCount,
      skippedNoMatch,
      skippedNoFiles,
      skippedDuplicate,
      skippedNoStream,
    });
  } catch (e) {
    console.error("IMAP fetch error:", e);
    res.status(500).json({ ok: false, error: e.message || "imap_fetch_failed" });
  } finally {
    try {
      await client.logout();
    } catch {}
  }
});
/* ───────────── Manual document → PDF, then insert as parsed doc (with tax) ─────────── */
router.post("/docs/manual", async (req, res) => {
  try {
    if (!req?.db) return res.status(503).json({ ok: false, error: "db_not_ready" });

    const {
      subject = "Manual",
      supplierName = "",
      supplierEmail = "",
      supplierPhone = "",
      supplierAddress = "",
      supplierVAT = "",
      invoiceNo: invoiceNoIn,
      orderNo: orderNoIn,
      date = "",
      currency = "DKK",
      taxMode = "exclusive",
      taxRate: taxRateIn,
      lines = [],
    } = req.body || {};

    const invoiceNo      = (invoiceNoIn && String(invoiceNoIn)) || generateInvoiceNo();
    const orderNo        = (orderNoIn && String(orderNoIn))     || generateOrderNo();
    const jeNumber       = generateJeNumber(); // also store on extracted.numbers
        const invoiceDefaultTaxMode = String(taxMode || "exclusive").toLowerCase(); // keep request-level default
    const defaultTaxRate = Number.isFinite(Number(taxRateIn)) ? Number(taxRateIn) : 25;
    const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

    const linesWithTotals = (Array.isArray(lines) ? lines : []).map((l, idx) => {
      const qty = Math.max(0, n(l.qty));
      const category = String(l.category || (l.sku ? "inventory" : "expense"));
      const genSku = generateSku(String(l.desc || `LINE-${idx + 1}`));
      const uom = String(l.uom || defaultUomForCategory(category));

      // 1) Per-line tax rate: use line.taxRate if present, else invoice default
      const ratePct = Number.isFinite(Number(l.taxRate)) ? Number(l.taxRate) : defaultTaxRate;
      const rate = ratePct / 100;

      // 2) Per-line price basis:
      //    - If l.priceMode provided, interpret common synonyms.
      //    - Else if l.includesTax boolean provided, use that.
      //    - Else fall back to invoice-level taxMode.
      const normalizedMode = String(l.priceMode || "").trim().toLowerCase();
      const modeHintsInclusive = /^(inclusive|gross|incl|inc|brutto|taxed)$/i.test(normalizedMode);
      const modeHintsExclusive = /^(exclusive|net|excl|netto)$/i.test(normalizedMode);
      const includesTax = (
        typeof l.includesTax === "boolean" ? l.includesTax
        : modeHintsInclusive ? true
        : modeHintsExclusive ? false
        : invoiceDefaultTaxMode === "inclusive"
      );

      // 3) Unit price selection:
      //    - If caller supplies unitPriceGross when includesTax=true, prefer it.
      //    - Else use unitPrice (legacy).
      const unitPriceCandidate = includesTax && Number.isFinite(Number(l.unitPriceGross))
        ? Number(l.unitPriceGross)
        : n(l.unitPrice);

      // Safety: negative or NaN unit prices → 0
      const unitPrice = Math.max(0, unitPriceCandidate);

      // 4) Compute line net/tax/total based on price basis
      let lineNet, lineTax, lineTotal;
      if (includesTax) {
        const gross = unitPrice * qty;                       // price already includes tax
        lineNet   = +((rate > 0 ? gross / (1 + rate) : gross)).toFixed(2);
        lineTax   = +((gross - lineNet)).toFixed(2);
        lineTotal = +gross.toFixed(2);
      } else {
        const net = unitPrice * qty;                          // price excludes tax
        lineNet   = +net.toFixed(2);
        lineTax   = +((net * rate)).toFixed(2);
        lineTotal = +((net + lineTax)).toFixed(2);
      }

      return {
        sku: String(l.sku || genSku),
        desc: String(l.desc || `Line ${idx + 1}`),
        qty, uom,
        unitPrice,                // always store the numeric basis used
        category,
        taxRate: ratePct,
        taxAmount: lineTax,
        lineNet,
        lineTotal,
      };
    });

    const subtotal = linesWithTotals.reduce((s, r) => s + (Number(r.lineNet)    || 0), 0);
    const tax      = linesWithTotals.reduce((s, r) => s + (Number(r.taxAmount) || 0), 0);
    const totalInc = linesWithTotals.reduce((s, r) => s + (Number(r.lineTotal) || 0), 0);

    /* ──────────────────────────── Professional A4 PDF ─────────────────────────── */

    const BRAND = {
      name: "Acta Venture Partners Aps",
      address: "Ravnsborg Tværgade 1, 1. 2200 København N • CVR 44427508",
      primary: "#0E4C92",
      primaryLight: "#315d93",
      primaryBorder: "#324870",
      muted: "#56657a",
      thBgRgb: [49, 93, 147],
    };

    function tryFindLogo() {
      const candidates = [
        path.join(process.cwd(), "client", "public", "ACTA_logo.png"),
        path.join(process.cwd(), "public", "ACTA_logo.png"),
        path.join(process.cwd(), "ACTA_logo.png"),
      ];
      for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch {} }
      return null;
    }
    const BRAND_LOGO = tryFindLogo();

    const money = (v) => `${Number(v || 0).toFixed(2)} ${currency}`;
    const fmtDateTime = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const mo = d.toLocaleString("en-US", { month: "short" });
      const day = String(d.getDate()).padStart(2, "0");
      const yr = d.getFullYear();
      return `${mo} ${day}, ${yr}, ${hh}:${mm}`;
    };
    const mmu = (n) => (n * 72) / 25.4; // mm → pt

    const pageW = 595.28, pageH = 841.89; // A4
    const M = { l: mmu(12), r: mmu(12), t: mmu(10), b: mmu(12) };
    const contentW = pageW - M.l - M.r;

    const filenameSafe = `manual-${Date.now()}.pdf`;
    const storedAs = `/uploads/${filenameSafe}`;
    const abs = path.join(UPLOAD_DIR, filenameSafe);

    const pdf = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, autoFirstPage: false });
    const out = fs.createWriteStream(abs);
    pdf.pipe(out);
    pdf.registerFont("Normal", "Helvetica");
    pdf.registerFont("Bold", "Helvetica-Bold");

    pdf.addPage({ margin: 0 });
    let y = M.t;

    /* Top ribbon */
    (function topRibbon() {
      const colW = contentW / 3;
      const breadcrumb = `${supplierName || "Supplier"} `;
      pdf.font("Normal").fontSize(8).fillColor(BRAND.muted)
        .text(fmtDateTime(), M.l, y, { width: colW, align: "left" })
        .text(breadcrumb, M.l + colW, y, { width: colW, align: "center" });
      pdf.font("Bold").fontSize(12).fillColor(BRAND.primary)
        .text(String(subject || "Manual"), M.l + 2 * colW, y, { width: colW, align: "right" });
      y += mmu(6);
    })();

    /* Brand left + stacked meta right */
    (function headerBlock() {
      const leftW = contentW * 0.55;
      const rightW = contentW - leftW;

      // brand left
      const logoH = mmu(10);
      const bx = M.l, by = y;
      if (BRAND_LOGO) { try { pdf.image(BRAND_LOGO, bx, by, { height: logoH }); } catch {} }
      pdf.fillColor(BRAND.primary).font("Bold").fontSize(12)
        .text(BRAND.name, bx + (BRAND_LOGO ? mmu(14) : 0), by, { width: leftW - (BRAND_LOGO ? mmu(14) : 0) });
      pdf.fillColor(BRAND.muted).font("Normal").fontSize(9)
        .text(BRAND.address, bx + (BRAND_LOGO ? mmu(14) : 0), by + mmu(5), { width: leftW - (BRAND_LOGO ? mmu(14) : 0) });

      // meta right
      const rx = M.l + leftW;
      const kv = [
        ["Invoice No", invoiceNo],
        ["Order No", orderNo],
        ["Date", date || "—"],
        ["Currency", currency],
        ["Tax Mode", String(taxMode).toLowerCase()],
        ["Tax Rate", `${defaultTaxRate}%`],
      ];
      let yy = by;
      kv.forEach(([k, v]) => {
        pdf.fillColor(BRAND.muted).font("Normal").fontSize(9)
          .text(k, rx, yy, { width: rightW / 2, align: "right" });
        pdf.fillColor("#000").font("Normal").fontSize(9)
          .text(String(v || "—"), rx + rightW / 2, yy, { width: rightW / 2, align: "right" });
        yy += mmu(6.2);
      });

      y = Math.max(by + mmu(16), yy) + mmu(6);
    })();

    /* Supplier card (single-column, no border) */
    (function supplierCard() {
      const pad = mmu(3);
      const rowH = mmu(7.5);
      const labelW = mmu(24);
      const gap = mmu(2);

      const rows = [
        ["Supplier:", supplierName],
        ["Email:",    supplierEmail],
        ["Phone:",    supplierPhone],
        ["Address:",  supplierAddress],
        ["VAT:",      supplierVAT],
      ];

      const blockH = pad * 2 + rows.length * rowH;
      const x = M.l + pad;
      let vy = y + pad;

      pdf.font("Normal").fontSize(9);
      rows.forEach(([k, v]) => {
        pdf.fillColor(BRAND.muted).font("Bold").fontSize(8)
           .text(k, x, vy, { width: labelW, align: "left" });
        pdf.fillColor("#000").font("Normal").fontSize(9)
           .text(String(v || "—"), x + labelW + gap, vy,
                 { width: contentW - pad - (labelW + gap) - pad, align: "left" });
        vy += rowH;
      });

      y += blockH + mmu(8);
    })();

    /* Table */
    const cols = [
      { key: "desc",      label: "Description", w: 0.32, align: "left"  },
      { key: "category",  label: "Cat.",        w: 0.10, align: "right" },
      { key: "qty",       label: "Qty",         w: 0.08, align: "right" },
      { key: "uom",       label: "UoM",         w: 0.08, align: "right" },
      { key: "unitPrice", label: "Unit",        w: 0.10, align: "right" },
      { key: "lineNet",   label: "Net",         w: 0.10, align: "right" },
      { key: "taxAmount", label: "Tax",         w: 0.10, align: "right" },
      { key: "lineTotal", label: "Line Total",  w: 0.12, align: "right" },
    ];
    const colW = cols.map(c => c.w * contentW);
    const colX = []; cols.reduce((x, c, i) => (colX[i] = x, x + colW[i]), M.l);

    function ensureSpace(h) {
      if (y + h > pageH - M.b - mmu(24)) {
        drawFooter();
        pdf.addPage({ margin: 0 });
        y = M.t;
        drawTableHeader();
      }
    }
    function drawTableHeader() {
      const thH = mmu(9.5);
      pdf.save();
      pdf.rect(M.l, y, contentW, thH).fillColor(`rgb(${BRAND.thBgRgb.join(",")})`).fill();
      pdf.restore();
      cols.forEach((c, i) => {
        pdf.fillColor("#fff").font("Bold").fontSize(9)
          .text(c.label, colX[i] + mmu(2), y + mmu(2), { width: colW[i] - mmu(4), align: c.align || "left" });
      });
      y += thH;
      pdf.moveTo(M.l, y).lineTo(M.l + contentW, y).lineWidth(0.6).strokeColor(BRAND.primaryBorder).stroke();
      y += mmu(2);
    }
    drawTableHeader();

    for (let i = 0; i < linesWithTotals.length; i++) {
      const ln = linesWithTotals[i];
      const rH = Math.max(mmu(8), pdf.heightOfString(ln.desc || "—", { width: colW[0] - mmu(4) }));
      ensureSpace(rH + mmu(5));

      if (i % 2 === 1) {
        pdf.save();
        pdf.rect(M.l, y - mmu(1), contentW, rH + mmu(2)).fillOpacity(0.06).fill(BRAND.primary).fillOpacity(1).restore();
      }

      const cell = (k, v) => {
        const idx = cols.findIndex(c => c.key === k);
        pdf.fillColor("#000").font("Normal").fontSize(9)
          .text(v, colX[idx] + mmu(2), y, { width: colW[idx] - mmu(4), align: cols[idx].align || "left" });
      };
      cell("desc",      String(ln.desc || "—"));
      cell("category",  String(ln.category || "—"));
      cell("qty",       (ln.qty ?? 0).toFixed(2));
      cell("uom",       String(ln.uom || "ea"));
      cell("unitPrice", (ln.unitPrice ?? 0).toFixed(2));
      cell("lineNet",   (ln.lineNet ?? 0).toFixed(2));
      cell("taxAmount", (ln.taxAmount ?? 0).toFixed(2));
      cell("lineTotal", (ln.lineTotal ?? 0).toFixed(2));

      y += rH + mmu(3);
      pdf.moveTo(M.l, y).lineTo(M.l + contentW, y).lineWidth(0.3).strokeColor("#dde2ea").stroke();
      y += mmu(1.5);
    }

    /* Totals, right side */
    ensureSpace(mmu(26));
    const lineY = y + mmu(2);
    pdf.moveTo(M.l, lineY).lineTo(M.l + contentW, lineY).lineWidth(0.6).strokeColor(BRAND.primaryBorder).stroke();

    const labelW = mmu(45), valueW = mmu(45), totalW = labelW + valueW + mmu(2);
    const rightX = M.l + contentW - totalW;

    const row = (label, value, bold = false, blue = false, padTop = 0) => {
      y += mmu(6) + padTop;
      pdf.font(bold ? "Bold" : "Normal").fontSize(bold ? 11 : 9)
        .fillColor(blue ? BRAND.primary : "#000");
      pdf.text(label, rightX, y, { width: labelW, align: "right" });
      pdf.text(value, rightX + labelW + mmu(2), y, { width: valueW, align: "right" });
    };
    row("Subtotal", money(subtotal));
    row("Tax",      money(tax));
    pdf.moveTo(rightX, y + mmu(6)).lineTo(rightX + totalW, y + mmu(6)).lineWidth(0.6).strokeColor(BRAND.primaryBorder).stroke();
    row("Total",    money(totalInc), true, true, mmu(2));

    /* Footer: blob/file left, page number right */
    function drawFooter() {
      const footerY = pageH - M.b + mmu(3);
      pdf.font("Normal").fontSize(8).fillColor(BRAND.muted)
        .text(storedAs, M.l, footerY, { width: contentW * 0.85, align: "left" });
    }
    drawFooter();

    // page numbers
    const range = pdf.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      pdf.switchToPage(p);
      const num = `${p - range.start + 1}/${range.count}`;
      pdf.font("Normal").fontSize(8).fillColor(BRAND.muted)
        .text(num, M.l + contentW - mmu(16), pageH - M.b + mmu(3), { width: mmu(14), align: "right" });
    }

    pdf.end();
    await new Promise((resolve, reject) => { out.on("finish", resolve); out.on("error", reject); });


    const docShell = {
      type: "invoice",
      status: "PARSED",
      createdAt: new Date(),
      source: {
        subject,
        from: "Manual Entry",
        messageId: "",
        files: [{ filename: filenameSafe, storedAs, mimetype: "application/pdf", size: fs.statSync(abs).size }],
        receivedAt: new Date(),
      },
      extracted: {
        supplier: { name: supplierName, email: supplierEmail, phone: supplierPhone, address: supplierAddress, vat: supplierVAT },
        numbers: { invoiceNo, orderNo, jeNumber }, // <-- persist JE here too
        date, currency,
        totals: { subtotal, tax, totalInc },
        total: totalInc,
        lines: linesWithTotals,
        tax: { mode: taxMode, defaultRate: defaultTaxRate },
      },
      proposal: null,
      links: {},
    };

    const ret = await coll(req).insertOne(docShell);
    res.json({ ok: true, _id: ret.insertedId, storedAs, numbers: { invoiceNo, orderNo, jeNumber }, autoFilled: true });
  } catch (err) {
    console.error("manual create failed:", err);
    res.status(500).json({ ok: false, error: err.message || "manual_create_failed" });
  }
});


/* ───────────── Proposal builder (journal + stock moves) ───────────── */
function buildProposalFromExtraction({ header, lines, subject }) {
  // Prefer sum of line totals; fall back to header totals.
  const sumLines = (Array.isArray(lines) ? lines : []).reduce((s, r) => s + (Number(r?.lineTotal) || 0), 0);
  const total = sumLines > 0 ? sumLines : Number(header?.totals?.totalInc || 0);

  const currency = header?.currency || "DKK";
  const dateISO = new Date().toISOString().slice(0, 10);
  const jeNumber = header?.numbers?.jeNumber || generateJeNumber(); // ALWAYS generate/provide

  const looksInventory =
    (lines || []).some((l) => (l.sku && l.sku.length >= 3) || l.category === "inventory") ||
    /module|converter|cable|monitor|ssd|ram|keyboard|microphone|sensor|pcb|psu/i.test(subject || "");

  // Always return a journal object with jeNumber so validation passes
  const journal = {
    jeNumber,
    date: dateISO,
    reference:
      header?.numbers?.invoiceNo ||
      header?.numbers?.orderNo ||
      subject ||
      "Supplier Invoice",
    memo: `Supplier ${header?.supplier?.name || "N/A"} — ${header?.numbers?.invoiceNo || ""}`,
    currency,
    lines: total > 0
      ? (looksInventory
          ? [
              { account: "1000", memo: "Payment/Payable", debit: 0, credit: total },
              { account: "1400", memo: "Inventory receipt", debit: total, credit: 0 },
            ]
          : [
              { account: "1000", memo: "Payment/Payable", debit: 0, credit: total },
              { account: "5500", memo: "Expense", debit: total, credit: 0 },
            ])
      : [], // allow zero-amount draft; JE number still present
  };

const stockMoves = looksInventory
  ? (lines || [])
      .filter((l) => (l.sku && l.qty && l.lineTotal) || l.unitPrice)
      .map((l) => {
        const qty = Math.abs(Number(l.qty) || 1);
        const unitCost = qty
          ? Number(l.lineTotal || 0) / qty
          : Number(l.unitPrice || 0);

        // Supplier name -> "From" column (works for manual entry too)
        const supplierName =
          (header?.supplier?.name || "Unknown Supplier").trim();
        const fromWhCode = supplierName.slice(0, 40); // keep UI tidy
        const fromName = supplierName;                 // full value if needed

        return {
          moveNo: generateMoveNo(),
          itemNo: generateItemNo(l.sku, l.desc),
          date: dateISO,
          itemSku: l.sku,
          qty,
          uom: l.uom || "pcs",
          unitCost,
          fromWhCode,             // <── your Recent Moves “From” column uses this
          fromName,               // <── optional, keep full supplier name
          toWhCode: "MAIN",
          memo: `Auto receipt from ${header?.numbers?.invoiceNo || "invoice"}`,
          status: "approved",
        };
      })
  : [];


  return { journal, stockMoves };
}
/* ───────────────────────────── Other UI endpoints ───────────────────────── */
router.get("/docs", async (req, res) => {
  const { limit = 200, search = "", status = "" } = req.query || {};
  const q = {};
  if (search) q["source.subject"] = { $regex: String(search), $options: "i" };
  if (status) q.status = { $in: String(status).split(",").filter(Boolean) };
  const items = await coll(req).find(q).sort({ createdAt: -1 }).limit(Number(limit)).toArray();
  res.json({ items });
});

router.get("/docs/:id", async (req, res) => {
  const doc = await coll(req).findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
  res.json(doc);
});

router.post("/docs/:id/route", async (req, res) => {
  const doc = await coll(req).findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
  const header = {
    ...doc.extracted,
    numbers: {
      ...(doc.extracted?.numbers || {}),
      jeNumber: doc.extracted?.numbers?.jeNumber || generateJeNumber(), // ensure it’s present
    },
  };
  const lines = header.lines || [];
  const prop = buildProposalFromExtraction({ header, lines, subject: doc.source?.subject });
  await coll(req).updateOne(
    { _id: doc._id },
    { $set: { extracted: header, proposal: prop, status: "READY", updatedAt: new Date() } }
  );
  res.json({ ok: true, proposal: prop });
});

router.post("/docs/:id/ocr", async (req, res) => {
  const doc = await coll(req).findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
  const { ocrVendor = OCR_VENDOR, ocrLang = OCR_LANG } = req.body || {};

  let lines = [];
  let header = { supplier: null, numbers: {}, date: null, currency: "DKK", totals: {} };
  const rawTextParts = [];
  for (const f of doc.source?.files || []) {
    const abs = path.join(process.cwd(), f.storedAs.replace(/^\//, ""));
    const ex = await extractFromFile(abs, { ocrVendor, ocrLang }).catch(() => ({ header: {}, lines: [] }));
    if (ex.header?.supplier && !header.supplier) header.supplier = ex.header.supplier;
    header.numbers = { ...header.numbers, ...(ex.header?.numbers || {}) };
    header.currency = ex.header?.currency || header.currency;
    header.totals = { ...header.totals, ...(ex.header?.totals || {}) };
    if (ex.header?.date && !header.date) header.date = ex.header.date;
    lines.push(...(ex.lines || []));
    if (ex?.text) rawTextParts.push(ex.text);
  }
  header.totals.totalInc = Number(header.totals?.totalInc || 0);
  header.numbers.jeNumber = header.numbers.jeNumber || generateJeNumber(); // ensure JE number
  const __rawText = rawTextParts.join("\n").slice(0, 500000);

  const prop = buildProposalFromExtraction({ header, lines, subject: doc.source?.subject });
  await coll(req).updateOne(
    { _id: doc._id },
    { $set: { extracted: { ...header, lines, __rawText }, proposal: prop, status: "PARSED", updatedAt: new Date() } }
  );
  res.json({ ok: true, extracted: { ...header, lines, __rawText }, proposal: prop });
});

// Legacy understand
router.post("/docs/:id/llm/understand", async (req, res) => {
  const doc = await coll(req).findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
  const header = {
    ...doc.extracted,
    numbers: { ...(doc.extracted?.numbers || {}), jeNumber: doc.extracted?.numbers?.jeNumber || generateJeNumber() },
  };
  const prop = buildProposalFromExtraction({ header, lines: header.lines || [], subject: doc.source?.subject });
  await coll(req).updateOne({ _id: doc._id }, { $set: { extracted: header, proposal: prop, status: "READY", updatedAt: new Date() } });
  res.json({ ok: true, proposal: prop });
});

// Strict-JSON extraction with graceful fallback if OPENAI_API_KEY is missing
// **FLATTENS** header into top-level `extracted.*` for UI compatibility
router.post("/docs/:id/llm/extract", async (req, res) => {
  try {
    const doc = await coll(req).findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });

    const { forceReOcr = false } = req.body || {};

    // 1) Aggregate OCR text (re-run if requested)
    let aggregatedText = "";
    if (forceReOcr || !doc.extracted?.__rawText) {
      for (const f of doc.source?.files || []) {
        const abs = path.join(process.cwd(), f.storedAs.replace(/^\//, ""));
        const ex = await extractFromFile(abs).catch(() => null);
        if (ex?.text) aggregatedText += `\n=== FILE:${path.basename(abs)} ===\n${ex.text}\n`;
      }
    } else {
      aggregatedText = doc.extracted.__rawText;
    }

    // 2) Draft from rule-based parse
    const headerDraft = {
      supplier: doc.extracted?.supplier ?? null,
      numbers: doc.extracted?.numbers ?? {},
      date: doc.extracted?.date ?? null,
      currency: doc.extracted?.currency ?? "DKK",
      totals: doc.extracted?.totals ?? {},
    };
    const linesDraft = Array.isArray(doc.extracted?.lines) ? doc.extracted.lines : [];

    // 3) LLM prompt
    const system = [
      "You extract structured invoice data from noisy OCR text.",
      "Return STRICT JSON that matches the given JSON Schema.",
      "Do not invent values; if unknown, use null. Numbers must use '.' decimal.",
      "Ensure numeric integrity: lineTotal ≈ qty * unitPrice; totals consistent.",
    ].join(" ");

    const prompt = `### OCR_TEXT
${(aggregatedText || "").slice(0, 250000)}

### DRAFT_JSON
${JSON.stringify({ header: headerDraft, lines: linesDraft }).slice(0, 50000)}

### TASK
1) Normalize and complete header + line items.
2) If invoice number is missing but visible, fill it.
3) Reconcile subtotal, tax, totalInc consistently.
4) Provide brief "notes" about corrections.
Return ONLY JSON.`;

    // 4) Call LLM (may be null if key missing)
    let llmResult = await callLLM({ system, prompt, schema: InvoiceSchema });

    // 5) Fallback if LLM disabled or failed
    if (!llmResult) {
      const totalsGuess = parseTaxAndTotals(aggregatedText || "");
      llmResult = {
        header: {
          supplier: headerDraft.supplier,
          numbers: headerDraft.numbers,
          date: headerDraft.date,
          currency: headerDraft.currency || "DKK",
          totals: totalsGuess,
        },
        lines: linesDraft && linesDraft.length ? linesDraft : (
          totalsGuess?.totalInc != null ? [{
            sku: "",
            desc: "Receipt total",
            qty: 1,
            uom: "ea",
            unitPrice: totalsGuess.totalInc,
            lineTotal: totalsGuess.totalInc,
            category: "expense",
          }] : []
        ),
        notes:
          "LLM disabled: OPENAI_API_KEY not set. Heuristic DK-aware parse applied.",
      };
    }

    // 6) Recompute totals
    const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const subtotal = (llmResult.lines || []).reduce(
      (s, r) => s + num(r.lineNet ?? (num(r.lineTotal) - (r.taxAmount ? num(r.taxAmount) : 0))),
      0
    );
    const total = (llmResult.lines || []).reduce((s, r) => s + num(r.lineTotal), 0);
    const tax   = num(llmResult.header?.totals?.tax ?? (total - subtotal));
    const totals = {
      subtotal: +subtotal.toFixed(2),
      tax: +tax.toFixed(2),
      totalInc: +total.toFixed(2),
    };

    // 7) **FLATTEN** header for storage
    const flattenedExtracted = {
      ...(llmResult.header || {}),
      totals,
      lines: llmResult.lines || [],
      notes: llmResult.notes || "",
      __rawText: (aggregatedText || "").slice(0, 500000),
    };

    const proposal = buildProposalFromExtraction({
      header: flattenedExtracted,
      lines: flattenedExtracted.lines,
      subject: doc.source?.subject,
    });

    await coll(req).updateOne(
      { _id: doc._id },
      {
        $set: {
          extracted: flattenedExtracted,
          proposal,
          status: "PARSED",
          updatedAt: new Date(),
        },
      }
    );

    res.json({ ok: true, extracted: flattenedExtracted, proposal });
  } catch (err) {
    console.error("llm/extract failed:", err);
    res.status(500).json({ ok: false, error: err.message || "llm_extract_failed" });
  }
});

router.patch("/docs/:id/link", async (req, res) => {
  const patch = req.body || {};
  await coll(req).updateOne(
    { _id: new ObjectId(req.params.id) },
    {
      $set: {
        links: { journalId: patch.journalId || null, stockMoveIds: patch.stockMoveIds || [] },
        status: patch.posted ? "POSTED" : "ROUTED",
        updatedAt: new Date(),
      },
    }
  );
  const doc = await coll(req).findOne({ _id: new ObjectId(req.params.id) });
  res.json(doc);
});

router.post("/signoff", async (_req, res) => res.json({ ok: true }));

export default router;