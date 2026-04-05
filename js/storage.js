const STORAGE_KEY = "tigist_finance_v1";

/** @typedef {{ id: string, name: string, salt: string, hashHex: string }} UserRow */
/** @typedef {{ id: string, ts: number, kind: 'sale_cash'|'sale_ebirr'|'expense', total: number, lines?: Array<{ itemId: string, label: string, unitPrice: number, qty: number }>, payerName?: string, phone?: string, note?: string }} TxRow */
/** @typedef {{ users: UserRow[], transactions: TxRow[], prices: Record<string, number>, prefs: { theme: 'light'|'dark', lang: 'am'|'om' } }} AppData */

function defaultData() {
  return {
    users: [],
    transactions: [],
    prices: {},
    prefs: { theme: "light", lang: "am" },
  };
}

export async function loadData() {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const base = defaultData();
  if (!raw[STORAGE_KEY]) return base;
  return { ...base, ...raw[STORAGE_KEY], prefs: { ...base.prefs, ...raw[STORAGE_KEY].prefs } };
}

/** @param {Partial<AppData>} patch */
export async function saveData(patch) {
  const cur = await loadData();
  const next = { ...cur, ...patch, prefs: { ...cur.prefs, ...patch.prefs } };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
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
