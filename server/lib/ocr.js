// server/lib/ocr.js
// Lightweight, ESM-safe wrapper around tesseract.js used by server routes only.

import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Support both CJS/ESM bundles of tesseract.js
const tesseractMod = require("tesseract.js");
const Tesseract = tesseractMod.default || tesseractMod;

/**
 * Normalize a language string like "eng,dan, deu " → "eng+dan+deu"
 * Tesseract accepts "+" to chain multiple languages.
 */
function normalizeLang(lang) {
  const raw = String(lang || process.env.OCR_LANG_DEFAULT || "eng").trim();
  if (!raw) return "eng";
  // Accept comma/space/semicolon separated lists
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts.join("+") : "eng";
}

/**
 * Quick extension check for image types we OCR.
 */
export function isOcrCandidate(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp", ".pbm", ".pgm"].includes(ext);
}

/**
 * OCR a single image file with tesseract.js.
 * @param {string} absPath Absolute path to an image file
 * @param {{ lang?: string, log?: boolean }} opts
 * @returns {Promise<{ text: string, confidence: number, words: number }>}
 */
export async function ocrFile(absPath, opts = {}) {
  if (!absPath || !path.isAbsolute(absPath)) {
    throw new Error("ocrFile requires an absolute file path");
  }
  if (!fs.existsSync(absPath)) {
    throw new Error(`ocrFile: file not found: ${absPath}`);
  }
  if (!isOcrCandidate(absPath)) {
    // Not an image → caller can decide to fallback to pdf-parse or skip
    return { text: "", confidence: 0, words: 0 };
  }

  const lang = normalizeLang(opts.lang);
  const logger = opts.log ? (m) => console.log("[tesseract]", m?.status || "", m?.progress || "") : null;

  // Basic path: one-shot recognize
  const result = await Tesseract.recognize(absPath, lang, logger ? { logger } : undefined);
  const text = String(result?.data?.text || "").trim();
  const confidence = Number(result?.data?.confidence || 0) || 0;
  const words = Array.isArray(result?.data?.words) ? result.data.words.length : 0;

  return { text, confidence, words };
}

/**
 * OCR a Buffer (if you already read the file in memory).
 * @param {Buffer|Uint8Array} buf
 * @param {{ lang?: string, log?: boolean }} opts
 */
export async function ocrBuffer(buf, opts = {}) {
  if (!buf || !buf.length) return { text: "", confidence: 0, words: 0 };
  const lang = normalizeLang(opts.lang);
  const logger = opts.log ? (m) => console.log("[tesseract]", m?.status || "", m?.progress || "") : null;
  const result = await Tesseract.recognize(buf, lang, logger ? { logger } : undefined);
  const text = String(result?.data?.text || "").trim();
  const confidence = Number(result?.data?.confidence || 0) || 0;
  const words = Array.isArray(result?.data?.words) ? result.data.words.length : 0;
  return { text, confidence, words };
}

export default {
  ocrFile,
  ocrBuffer,
  isOcrCandidate,
};
