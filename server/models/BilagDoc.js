// server/models/BilagDoc.js
import mongoose from "mongoose";
import path from "node:path";

/* ------------------------------ Sub-schemas ------------------------------ */
const BilagSourceSchema = new mongoose.Schema(
  {
    subject:    { type: String, default: "" },
    from:       { type: String, default: "" },
    messageId:  { type: String, default: "" }, // for dedupe/lookup (may be empty)
    receivedAt: { type: Date },
    files: [
      {
        filename: { type: String, default: "" }, // original filename
        storedAs: { type: String, default: "" }, // "/uploads/… .pdf|.png|.jpg|.tiff|.txt"
        mimetype: { type: String, default: "" }, // e.g. "application/pdf", "image/png", "text/plain"
        size:     { type: Number, default: 0 },
      },
    ],
  },
  { _id: false }
);

const BilagExtractedSchema = new mongoose.Schema(
  {
    // Raw OCR text snapshot (for re-processing / debugging)
    __rawText: { type: String, default: "" },

    // Optional LLM audit notes (what it inferred/fixed)
    notes: { type: String, default: "" },

    supplier: {
      name:    { type: String, default: "" },
      vat:     { type: String, default: "" },
      email:   { type: String, default: "" },
      phone:   { type: String, default: "" },
      address: { type: String, default: "" },
    },
    numbers: {
      invoiceNo: { type: String, default: "" },
      orderNo:   { type: String, default: "" },
      poNo:      { type: String, default: "" }, // optional purchase order number
    },
    date:     { type: String, default: "" },    // free-form or YYYY-MM-DD
    currency: { type: String, default: "DKK" },

    // Tax settings captured from manual form / parsing
    tax: {
      mode:        { type: String, enum: ["exclusive", "inclusive", ""], default: "" }, // "" when unknown
      defaultRate: { type: Number, default: 0 }, // percentage, e.g. 25 for 25%
    },

    // Prefer totals.totalInc; keep legacy "total" for compatibility with older UI
    totals: {
      subtotal: { type: Number, default: 0 },   // net amount (ex VAT)
      tax:      { type: Number, default: 0 },   // VAT amount
      totalInc: { type: Number, default: 0 },   // gross (incl. VAT)
    },
    total: { type: Number, default: 0 },        // legacy mirror of totals.totalInc

    lines: [
      {
        sku:       { type: String, default: "" },
        desc:      { type: String, default: "" },
        category:  { type: String, default: "" }, // "expense" | "inventory" | "service" | ...
        qty:       { type: Number, default: 0 },
        uom:       { type: String, default: "" },
        unitPrice: { type: Number, default: 0 },
        // When available, explicit net and tax per line
        lineNet:   { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },  // usually gross
        // Optional per-line override tax % (if absent, use tax.defaultRate)
        taxRate:   { type: Number, default: null },
      },
    ],
  },
  { _id: false }
);

const BilagProposalSchema = new mongoose.Schema(
  {
    journal: {
      date: { type: String }, // YYYY-MM-DD
      reference: { type: String, default: "" },
      memo: { type: String, default: "" },
      lines: [
        {
          account: { type: String, default: "" },
          memo:    { type: String, default: "" },
          debit:   { type: Number, default: 0 },
          credit:  { type: Number, default: 0 },
        },
      ],
    },
    stockMoves: [
      {
        date:     { type: String, default: "" },
        itemSku:  { type: String, default: "" },
        qty:      { type: Number, default: 0 },
        uom:      { type: String, default: "" },
        unitCost: { type: Number, default: 0 },
        toWhCode: { type: String, default: "" },
      },
    ],
  },
  { _id: false }
);

const BilagLinksSchema = new mongoose.Schema(
  {
    journalId:    { type: String, default: "" },
    stockMoveIds: { type: [String], default: [] },
  },
  { _id: false }
);

/* --------------------------------- Model --------------------------------- */
const BilagDocSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["invoice", "order", "delivery"],
      default: "invoice",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "RECEIVED",
        "CLASSIFIED",
        "PARSED",
        "READY",
        "ROUTED",
        "POSTED",
        "NEEDS_REVIEW",
      ],
      default: "RECEIVED",
      index: true,
    },
    source:    BilagSourceSchema,
    extracted: BilagExtractedSchema,
    proposal:  BilagProposalSchema,
    links:     BilagLinksSchema,
  },
  { timestamps: true }
);

/* -------------------------- Virtuals for the client ----------------------- */
BilagDocSchema.virtual("files").get(function filesVirtual() {
  const src = Array.isArray(this?.source?.files) ? this.source.files : [];
  return src.map((f) => ({
    name: f?.filename || path.basename(f?.storedAs || ""),
    url: f?.storedAs || "",
    mimeType: f?.mimetype || "",
    size: Number(f?.size || 0),
  }));
});

BilagDocSchema.virtual("preview").get(function previewVirtual() {
  const src = Array.isArray(this?.source?.files) ? this.source.files : [];
  if (!src.length) return null;
  const f = src[0];
  return {
    name: f?.filename || path.basename(f?.storedAs || ""),
    url: f?.storedAs || "",
    mimeType: f?.mimetype || "",
    size: Number(f?.size || 0),
  };
});

/* ----------------------------- Serialization ----------------------------- */
BilagDocSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    // Ensure links object exists for UI
    if (!ret.links) ret.links = { journalId: "", stockMoveIds: [] };
    return ret;
  },
});
BilagDocSchema.set("toObject", { virtuals: true, versionKey: false });

/* ------------------------ Helpful instance methods ------------------------ */
BilagDocSchema.methods.addSourceFiles = function addSourceFiles(files = []) {
  if (!this.source) this.source = {};
  if (!Array.isArray(this.source.files)) this.source.files = [];
  for (const f of files) {
    this.source.files.push({
      filename: f.filename || f.name || "",
      storedAs: f.storedAs || f.url || "",
      mimetype: f.mimetype || f.mimeType || "",
      size: Number(f.size || 0),
    });
  }
  if (!this.source.receivedAt) this.source.receivedAt = new Date();
  // only bump forward from RECEIVED
  if (!this.status || this.status === "RECEIVED") this.status = "CLASSIFIED";
};

BilagDocSchema.methods.markReadyWithProposal = function markReadyWithProposal(proposal) {
  this.proposal = proposal || this.proposal;
  this.status = "READY";
};

BilagDocSchema.methods.markPosted = function markPosted({ journalId, stockMoveIds = [] } = {}) {
  if (!this.links) this.links = {};
  if (journalId) this.links.journalId = String(journalId);
  if (Array.isArray(stockMoveIds)) this.links.stockMoveIds = stockMoveIds.map(String);
  this.status = "POSTED";
};

/* ------------------------- Status & totals normalizer --------------------- */
BilagDocSchema.pre("save", function normalizeAndBump(next) {
  try {
    // ensure nested objects exist
    if (!this.extracted) this.extracted = {};
    if (!this.extracted.totals) this.extracted.totals = { subtotal: 0, tax: 0, totalInc: 0 };
    if (!Array.isArray(this.extracted.lines)) this.extracted.lines = [];
    if (!this.extracted.tax) this.extracted.tax = { mode: "", defaultRate: 0 };

    // legacy totals mirror (both ways) -> keep in sync with totals.totalInc
    const inc = Number(this?.extracted?.totals?.totalInc || 0);
    if (inc > 0 && Number(this.extracted.total || 0) !== inc) {
      this.extracted.total = inc;
    } else if (inc === 0 && Number(this.extracted.total || 0) > 0) {
      this.extracted.totals.totalInc = Number(this.extracted.total || 0);
    }

    const hasFiles =
      Array.isArray(this?.source?.files) && this.source.files.length > 0;

    const hasExtract =
      Number(this?.extracted?.totals?.totalInc || 0) > 0 ||
      (Array.isArray(this?.extracted?.lines) && this.extracted.lines.length > 0);

    // bump status forward but never regress
    const order = [
      "RECEIVED",
      "CLASSIFIED",
      "PARSED",
      "READY",
      "ROUTED",
      "POSTED",
      "NEEDS_REVIEW",
    ];
    const idx = order.indexOf(this.status || "RECEIVED");
    const bump = (target) => {
      const ti = order.indexOf(target);
      if (ti > -1 && (idx === -1 || ti > idx)) this.status = target;
    };

    if (hasExtract) bump("PARSED");
    else if (hasFiles) bump("CLASSIFIED");

    next();
  } catch (e) {
    next(e);
  }
});

/* -------------------------------- Indexes -------------------------------- */
BilagDocSchema.index({ createdAt: -1 });
BilagDocSchema.index({ "extracted.numbers.invoiceNo": 1 });
BilagDocSchema.index({ "extracted.numbers.poNo": 1 }); // quick PO lookups
BilagDocSchema.index({ "source.messageId": 1 }, { sparse: true, unique: false });
BilagDocSchema.index({ status: 1 });
BilagDocSchema.index({ type: 1 });

/* -------------------------------- Export --------------------------------- */
// IMPORTANT: pin collection name to "bilags_docs" to match routes using the native driver
export default mongoose.models.BilagDoc ||
  mongoose.model("BilagDoc", BilagDocSchema, "bilags_docs");
