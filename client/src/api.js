/* =========================================
   API base (with extra env fallbacks) — now mutable at runtime
   ✅ FIX: on phones, default to current host instead of localhost
   ========================================= */

// If running in browser, default API to same host as the current page, port 4000.
// Example: page http://172.20.10.3:5173  -> API http://172.20.10.3:4000
const DEFAULT_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : "http://localhost:4000";

const RAW_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || window.API_BASE)) ??
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_API_BASE || import.meta.env?.VITE_API_URL)) ??
  DEFAULT_BASE;

let API_BASE_INTERNAL = String(RAW_BASE).replace(/\/+$/, "");

export function getApiBase() {
  if (typeof window !== "undefined" && window.__API_BASE__) {
    return String(window.__API_BASE__).replace(/\/+$/, "");
  }
  return API_BASE_INTERNAL;
}

// Back-compat named export (constant-like), but prefer getApiBase() in requests
export const API_BASE = getApiBase();

export function setApiBase(url) {
  if (!url) return;
  const next = String(url).replace(/\/+$/, "");
  API_BASE_INTERNAL = next;
  if (typeof window !== "undefined") window.__API_BASE__ = next;
  console.warn("[api] setApiBase →", next);
}

/* =========================================
   Small utils (mirrors server for JE / item / move numbers)
   ========================================= */
function pad(n, w = 4) {
  const s = String(n);
  return s.length >= w ? s : "0".repeat(w - s.length) + s;
}
function rand4() {
  return pad(Math.floor(Math.random() * 10000), 4);
}
function yyyymmdd(d = new Date()) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  return `${y}${m}${day}`;
}

export function generateJeNumber() {
  return `JE-${yyyymmdd()}-${rand4()}`;
}
function ensureJeNumber(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (!payload.jeNumber) payload.jeNumber = generateJeNumber();
  return payload;
}

// NEW: match server’s item/move auto-ids
export function generateItemNo(sku = "", desc = "") {
  const stem =
    (sku || desc || "ITEM")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "ITEM";
  return `ITM-${stem}-${rand4()}`;
}
export function generateMoveNo() {
  return `MOV-${yyyymmdd()}-${rand4()}`;
}
function stampMoveIds(move) {
  if (!move || typeof move !== "object") return move;
  if (!move.itemNo)
    move.itemNo = generateItemNo(
      move.itemSku || "",
      move.desc || move.memo || ""
    );
  if (!move.moveNo) move.moveNo = generateMoveNo();
  return move;
}
function ensureItemAndMove(payload) {
  if (Array.isArray(payload)) return payload.map(stampMoveIds);
  return stampMoveIds(payload);
}

/* =========================================
   Core request helpers
   ========================================= */
function isJsonResponse(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json");
}

function toAbsoluteUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBase()}${path.startsWith("/") ? path : "/" + path}`;
}

/**
 * Core request with timeout + retry
 */
async function request(path, options = {}) {
  const {
    withCredentials = false,
    timeoutMs = 20000,
    retries = 0,
    retryDelayMs = 1000,
    method = "GET",
    headers = {},
    ...rest
  } = options;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(toAbsoluteUrl(path), {
        method,
        headers: {
          Accept: "application/json, text/plain, */*",
          ...(typeof rest.body === "string"
            ? { "Content-Type": "application/json" }
            : {}),
          ...headers,
        },
        credentials: withCredentials ? "include" : "same-origin",
        signal: controller.signal,
        ...rest,
      });

      if (!res.ok) {
        if (isJsonResponse(res)) {
          const data = await res.json().catch(() => ({}));
          const msg =
            data?.error ||
            data?.message ||
            data?.msg ||
            `${res.status} ${res.statusText}`;
          throw new Error(msg);
        }
        const text = await res.text().catch(() => "");
        const m = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
        throw new Error(
          (m && m[1]) || text || `${res.status} ${res.statusText}`
        );
      }

      if (res.status === 204) return null;
      return isJsonResponse(res) ? res.json() : res.text();
    } catch (err) {
      const isAbort = err?.name === "AbortError";
      const isFetchFail = String(err?.message || "").includes("Failed to fetch");

      if (isAbort) {
        err = new Error(
          `Network timeout after ${Math.round(
            timeoutMs / 1000
          )}s. Is the API running at ${getApiBase()}?`
        );
      } else if (isFetchFail) {
        err = new Error(
          `Failed to reach API at ${getApiBase()}. Check that the server is running and CORS is configured.`
        );
      }

      if (attempt < retries) {
        attempt += 1;
        console.warn(
          `[api] Retry ${attempt}/${retries} for ${path} in ${retryDelayMs}ms ...`
        );
        clearTimeout(t);
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }
}

async function requestTry(paths = [], options = {}) {
  let lastErr;
  for (const p of paths) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await request(p, options);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All request paths failed");
}

/* =========================================
   Small helpers for pager + querystring
   ========================================= */
function toPager(res) {
  if (Array.isArray(res))
    return {
      items: res,
      total: res.length,
      page: 1,
      limit: res.length || 50,
    };
  if (res && Array.isArray(res.items)) return res;
  return { items: [], total: 0, page: 1, limit: 50 };
}

function buildQS(params = {}, allowedKeys = []) {
  const qs = new URLSearchParams();
  for (const k of allowedKeys) {
    const v = params[k];
    if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  }
  const q = qs.toString();
  return q ? `?${q}` : "";
}

/* =========================================
   Persons
   ========================================= */
export const listPersons = () => request("/api/persons");

/* =========================================
   Accounts
   ========================================= */
export const getAccounts = () => request("/api/accounts");
export const getChartOfAccounts = getAccounts;

export const createAccount = (body) =>
  request("/api/accounts", { method: "POST", body: JSON.stringify(body) });

export const updateAccount = (id, body) =>
  request(`/api/accounts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteAccount = (id) =>
  request(`/api/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });

export async function getAccountMap() {
  const list = await getAccounts();
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((a) => {
    const key = String(a?.number ?? "");
    if (key) map.set(key, a);
  });
  return map;
}

/* =========================================
   General Ledger
   ========================================= */
export const getGL = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/gl${qs ? `?${qs}` : ""}`);
};

export const createGLEntry = (entry) =>
  request("/api/gl", { method: "POST", body: JSON.stringify(entry) });

export const updateGLEntry = (id, entry) =>
  request(`/api/gl/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(entry),
  });

export const deleteGLEntry = (id) =>
  request(`/api/gl/${encodeURIComponent(id)}`, { method: "DELETE" });

/* =========================================
   Journals (auto-inject jeNumber)
   ========================================= */
export const getJournalEntries = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/journals${qs ? `?${qs}` : ""}`);
};

export const createJournal = (body) => {
  const payload = ensureJeNumber({ ...(body || {}) });
  return request("/api/journals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateJournal = (id, body) => {
  const payload = ensureJeNumber({ ...(body || {}) });
  return request(`/api/journals/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const deleteJournal = (id) =>
  request(`/api/journals/${encodeURIComponent(id)}`, { method: "DELETE" });

export const approveJournal = (id, body = {}) =>
  request(`/api/journals/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postJournal = (id, body = {}) =>
  request(`/api/journals/${encodeURIComponent(id)}/post`, {
    method: "POST",
    body: JSON.stringify(body),
  });

/* =========================================
   Finance — direct to GL on post
   ========================================= */
export const listFinanceDocuments = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.date) qs.set("date", params.date);
  const q = qs.toString();
  return request(`/api/finance/documents${q ? `?${q}` : ""}`);
};

export const createFinanceDocument = (body) =>
  request("/api/finance", { method: "POST", body: JSON.stringify(body) });

export const approveFinanceDocument = (id, body = {}) =>
  request(`/api/finance/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postFinanceDocument = (id, body = {}) =>
  request(`/api/finance/${encodeURIComponent(id)}/post`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteFinanceDocument = (id) =>
  request(`/api/finance/${encodeURIComponent(id)}`, { method: "DELETE" });

/* =========================================
   Invoices (Sales)
   ========================================= */
export function listInvoices(params = {}) {
  const q = buildQS(params, ["search", "status", "from", "to", "page", "limit"]);
  return request(`/api/invoice${q}`).then(toPager);
}

export const getInvoice = (id) =>
  request(`/api/invoice/${encodeURIComponent(id)}`);

export const createInvoice = (body) =>
  request(`/api/invoice`, { method: "POST", body: JSON.stringify(body) });

export const updateInvoice = (id, body) =>
  request(`/api/invoice/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteInvoice = (id) =>
  request(`/api/invoice/${encodeURIComponent(id)}`, { method: "DELETE" });

export const postInvoice = (id) =>
  request(`/api/invoice/${encodeURIComponent(id)}/post`, { method: "POST" });

/* =========================================
   Purchase (Supplier) Invoices
   ========================================= */
export function listPurchaseInvoices(params = {}) {
  const q = buildQS(params, ["search", "status", "from", "to", "page", "limit"]);
  return request(`/api/purchasing/invoices${q}`).then(toPager);
}

export const getPurchaseInvoice = (id) =>
  request(`/api/purchasing/invoices/${encodeURIComponent(id)}`);

export const createPurchaseInvoice = (body) =>
  request(`/api/purchasing/invoices`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updatePurchaseInvoice = (id, body) =>
  request(`/api/purchasing/invoices/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deletePurchaseInvoice = (id) =>
  request(`/api/purchasing/invoices/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const postPurchaseInvoice = (id) =>
  request(`/api/purchasing/invoices/${encodeURIComponent(id)}/post`, {
    method: "POST",
  });

/* =========================================
   Reports
   ========================================= */
export function getTrialBalance(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/reports/trial-balance${qs ? `?${qs}` : ""}`);
}

export function getPnL(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/reports/pnl${qs ? `?${qs}` : ""}`);
}

export function getCashReport(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/reports/cash${qs ? `?${qs}` : ""}`);
}

/* =========================================
   Inventory
   ========================================= */
// ---- Items
export function listInventoryItems(params = {}) {
  const q = buildQS(params, ["search", "page", "limit"]);
  return request(`/api/inventory/items${q}`).then(toPager);
}
export const listItems = listInventoryItems;

export const getInventoryItem = (id) =>
  request(`/api/inventory/items/${encodeURIComponent(id)}`);

export const createInventoryItem = (body) =>
  request(`/api/inventory/items`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateInventoryItem = (id, body) =>
  request(`/api/inventory/items/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteInventoryItem = (id) =>
  request(`/api/inventory/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

// ---- Stock Moves
function stockMovePath(suffix = "") {
  return [
    `/api/inventory/stock-moves${suffix}`,
    `/api/stock/moves${suffix}`,
    `/api/inventory/stock_move${suffix}`,
    `/api/stock-moves${suffix}`,
  ];
}

export function listStockMoves(params = {}) {
  const q = buildQS(params, ["search", "status", "from", "to", "page", "limit"]);
  return requestTry(stockMovePath(q)).then(toPager);
}

export const getStockMove = (id) =>
  requestTry(stockMovePath(`/${encodeURIComponent(id)}`));

export const createStockMove = (body) => {
  const payload = ensureItemAndMove({ ...(body || {}) });
  return requestTry(stockMovePath(""), {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateStockMove = (id, body) => {
  const payload = ensureItemAndMove({ ...(body || {}) });
  return requestTry(stockMovePath(`/${encodeURIComponent(id)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const deleteStockMove = (id) =>
  requestTry(stockMovePath(`/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });

export const postStockMove = (id, body = {}) =>
  requestTry(stockMovePath(`/${encodeURIComponent(id)}/post`), {
    method: "POST",
    body: JSON.stringify(body),
  });

// ---- Adjustments
export function listAdjustments(params = {}) {
  const q = buildQS(params, ["search", "status", "from", "to", "page", "limit"]);
  return request(`/api/inventory/adjustments${q}`).then(toPager);
}

export const getAdjustment = (id) =>
  request(`/api/inventory/adjustments/${encodeURIComponent(id)}`);

export const createAdjustment = (body) =>
  request(`/api/inventory/adjustments`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateAdjustment = (id, body) =>
  request(`/api/inventory/adjustments/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteAdjustment = (id) =>
  request(`/api/inventory/adjustments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const postAdjustment = (id, body = {}) =>
  request(`/api/inventory/adjustments/${encodeURIComponent(id)}/post`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// ---- Warehouses
export function listWarehouses(params = {}) {
  const q = buildQS(params, ["search", "page", "limit"]);
  return request(`/api/inventory/warehouses${q}`).then(toPager);
}

export const getWarehouse = (id) =>
  request(`/api/inventory/warehouses/${encodeURIComponent(id)}`);

export const createWarehouse = (body) =>
  request(`/api/inventory/warehouses`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateWarehouse = (id, body) =>
  request(`/api/inventory/warehouses/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteWarehouse = (id) =>
  request(`/api/inventory/warehouses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export function makeInventoryApi(section) {
  switch (section) {
    case "items":
      return {
        list: listInventoryItems,
        get: getInventoryItem,
        create: createInventoryItem,
        update: updateInventoryItem,
        remove: deleteInventoryItem,
      };
    case "stock-moves":
      return {
        list: listStockMoves,
        get: getStockMove,
        create: createStockMove,
        update: updateStockMove,
        remove: deleteStockMove,
        post: postStockMove,
      };
    case "adjustments":
      return {
        list: listAdjustments,
        get: getAdjustment,
        create: createAdjustment,
        update: updateAdjustment,
        remove: deleteAdjustment,
        post: postAdjustment,
      };
    case "warehouses":
      return {
        list: listWarehouses,
        get: getWarehouse,
        create: createWarehouse,
        update: updateWarehouse,
        remove: deleteWarehouse,
      };
    default:
      return {
        list: async () => [],
        create: async () => {},
        update: async () => {},
        remove: async () => {},
      };
  }
}

/* =========================================
   Back-Office Inbox (Bilags)
   ========================================= */
export const bilags = {
  listDocs(params = {}) {
    const q = buildQS(params, ["status", "limit", "search"]);
    return request(`/api/bilags/docs${q}`).then(toPager);
  },
  getDoc(id) {
    return request(`/api/bilags/docs/${encodeURIComponent(id)}`);
  },
  async ingest(formData) {
    return requestTry([`/api/bilags/ingest`, `/api/upload`, `/api/files`], {
      method: "POST",
      body: formData,
    });
  },
  manualCreate(body = {}) {
    return request(`/api/bilags/docs/manual`, {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: 120000,
    });
  },
  emailTest() {
    return request(`/api/bilags/email/test`, { timeoutMs: 60000 });
  },
  emailFetch(body = {}) {
    return request(`/api/bilags/email/fetch`, {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: 300000,
      retries: 1,
      retryDelayMs: 2000,
    });
  },
  ocr(id, body = {}) {
    return request(`/api/bilags/docs/${encodeURIComponent(id)}/ocr`, {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: 180000,
    });
  },
  async llmExtract(id, body = {}) {
    return requestTry(
      [
        `/api/bilags/docs/${encodeURIComponent(id)}/llm/extract`,
        `/api/bilags/docs/${encodeURIComponent(id)}/llm/understand`,
      ],
      { method: "POST", body: JSON.stringify(body), timeoutMs: 120000 }
    );
  },
  llmUnderstand(id, body = {}) {
    return this.llmExtract(id, body);
  },
  route(id) {
    return request(`/api/bilags/docs/${encodeURIComponent(id)}/route`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  link(id, body = {}) {
    return request(`/api/bilags/docs/${encodeURIComponent(id)}/link`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  signoff(body = {}) {
    return request(`/api/bilags/signoff`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

/* =========================================
   Health endpoints (optional convenience)
   ========================================= */
export const ping = () => request(`/healthz`).catch(() => request(`/readyz`));

/* =========================================
   Backwards-compatibility aliases
   ========================================= */
export const listStockItems = listInventoryItems;
export const getStockItem = getInventoryItem;
export const createStockItem = createInventoryItem;
export const updateStockItem = updateInventoryItem;
export const deleteStockItem = deleteInventoryItem;

export const listInventoryStockMoves = listStockMoves;
export const getInventoryStockMove = getStockMove;
export const createInventoryStockMove = createStockMove;
export const updateInventoryStockMove = updateStockMove;
export const deleteInventoryStockMove = deleteStockMove;
export const postInventoryStockMove = postStockMove;

export const listStockAdjustments = listAdjustments;
export const getStockAdjustment = getAdjustment;
export const createStockAdjustment = createAdjustment;
export const updateStockAdjustment = updateAdjustment;
export const deleteStockAdjustment = deleteAdjustment;
export const postStockAdjustment = postAdjustment;

export const listStockWarehouses = listWarehouses;
export const getStockWarehouse = getWarehouse;
export const createStockWarehouse = createWarehouse;
export const updateStockWarehouse = updateWarehouse;
export const deleteStockWarehouse = deleteWarehouse;

/* =========================================
   Admin / Project Management
   ========================================= */
const PROJECTS_BASE = "/api/projects";

export function listProjects(params = {}) {
  const q = buildQS(params, [
    "search",
    "status",
    "owner",
    "from",
    "to",
    "page",
    "limit",
  ]);
  return request(`${PROJECTS_BASE}${q}`).then(toPager);
}

export function getProject(id) {
  if (!id) return Promise.resolve(null);
  return request(`${PROJECTS_BASE}/${encodeURIComponent(id)}`);
}

export function createProject(body = {}) {
  return request(PROJECTS_BASE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateProject(id, body = {}) {
  if (!id) throw new Error("updateProject: id is required");
  return request(`${PROJECTS_BASE}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteProject(id) {
  if (!id) throw new Error("deleteProject: id is required");
  return request(`${PROJECTS_BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* =========================================
   Auth
   ========================================= */
export function loginUser(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
