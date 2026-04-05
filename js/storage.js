const STORAGE_KEY = "tigist_finance_v1";

/** @typedef {{ id: string, name: string, salt: string, hashHex: string }} UserRow */
/** @typedef {{ id: string, ts: number, kind: 'sale_cash'|'sale_ebirr'|'expense', total: number, lines?: Array<{ itemId: string, label: string, unitPrice: number, qty: number }>, payerName?: string, phone?: string, note?: string }} TxRow */
/** @typedef {{ users: UserRow[], transactions: TxRow[], prices: Record<string, number>, prefs: { theme: 'light'|'dark', lang: 'am'|'om' } }} AppData */

function useExtensionStorage() {
  try {
    return typeof chrome !== "undefined" && chrome.storage != null && chrome.storage.local != null;
  } catch {
    return false;
  }
}

function defaultData() {
  return {
    users: [],
    transactions: [],
    prices: {},
    prefs: { theme: "light", lang: "am" },
  };
}

/** @returns {Promise<AppData | null>} */
async function readStored() {
  if (useExtensionStorage()) {
    const raw = await chrome.storage.local.get(STORAGE_KEY);
    return raw[STORAGE_KEY] ?? null;
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** @param {AppData} data */
async function writeStored(data) {
  if (useExtensionStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export async function loadData() {
  const base = defaultData();
  const raw = await readStored();
  if (!raw) return base;
  return { ...base, ...raw, prefs: { ...base.prefs, ...raw.prefs } };
}

/** @param {Partial<AppData>} patch */
export async function saveData(patch) {
  const cur = await loadData();
  const next = { ...cur, ...patch, prefs: { ...cur.prefs, ...patch.prefs } };
  await writeStored(next);
  return next;
}

function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return hex(bits);
}

export async function createUser(name, password) {
  const salt = randomSalt();
  const hashHex = await hashPassword(password, salt);
  const id = crypto.randomUUID();
  const data = await loadData();
  const users = [...data.users, { id, name: name.trim(), salt, hashHex }];
  await saveData({ users });
  return { id, name: name.trim() };
}

export async function verifyUser(name, password) {
  const data = await loadData();
  const u = data.users.find((x) => x.name === name.trim());
  if (!u) return null;
  const h = await hashPassword(password, u.salt);
  if (h !== u.hashHex) return null;
  return { id: u.id, name: u.name };
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isToday(ts) {
  return ts >= startOfToday();
}
