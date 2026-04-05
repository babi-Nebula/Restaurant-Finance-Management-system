import { CATALOG, itemLabel } from "./catalog.js";
import { t, applyI18n } from "./i18n.js";
import {
  loadData,
  saveData,
  createUser,
  verifyUser,
  isToday,
} from "./storage.js";

/** Simulated E-Birr payer names (until real API) */
const SIM_NAMES_AM = [
  "አበበ ከበደ",
  "ጸሃይ ተስፋዬ",
  "ማርታ ወንድወሰን",
  "ዮሐንስ መኮንን",
  "ፍቅርተ ልዑል",
  "ተክለ ሃይማኖት",
  "ሩት አበበ",
  "ዳዊት ምሁር",
];
const SIM_NAMES_OM = [
  "Abbaabaa Kaabadaa",
    "Tsahaay Tasfaayee",
    "Maartaa Wandawasaan",
    "Yohaannis Makonnin",
    "Firqattee L'iil",
    "Takkalaa Haymaanot",
    "Ruut Abaabaa",
    "Daawit Mihuur",
];

function hashPhone(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function simulatedPayerName(lang, phone) {
  const list = lang === "om" ? SIM_NAMES_OM : SIM_NAMES_AM;
  const idx = hashPhone(phone.replace(/\D/g, "")) % list.length;
  return list[idx];
}

let state = {
  lang: "am",
  theme: "light",
  currentUser: null,
  cart: /** @type {Array<{ key: string, itemId: string, label: string, unitPrice: number, qty: number }>} */ ([]),
  ebirrPending: /** @type {{ payerName: string, phone: string, amount: number } | null} */ (null),
};

function $(sel) {
  return /** @type {HTMLElement} */ (document.querySelector(sel));
}

function formatMoney(n) {
  return new Intl.NumberFormat("am-ET", { maximumFractionDigits: 2 }).format(n);
}

function setTheme(theme) {
  state.theme = theme;
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  document.querySelectorAll(".theme-dual .moon-icon").forEach((el) => el.classList.toggle("hidden", isDark));
  document.querySelectorAll(".theme-dual .sun-icon").forEach((el) => el.classList.toggle("hidden", !isDark));
  const tip = isDark ? t(state.lang, "themeLight") : t(state.lang, "themeDark");
  document.querySelectorAll(".theme-dual").forEach((btn) => {
    btn.title = tip;
    btn.setAttribute("aria-label", tip);
  });
}

function showView(name) {
  ["setup", "login", "main"].forEach((v) => {
    const el = $(`#view-${v}`);
    if (!el) return;
    const on = v === name;
    el.classList.toggle("hidden", !on);
    el.setAttribute("aria-hidden", on ? "false" : "true");
  });
}

async function persistPrefs() {
  await saveData({ prefs: { theme: state.theme, lang: state.lang } });
}

function getPriceOverrides(data) {
  return data.prices || {};
}

function resolveUnitPrice(data, itemId, defaultPrice) {
  const o = getPriceOverrides(data);
  return typeof o[itemId] === "number" ? o[itemId] : defaultPrice;
}

function renderCatalog(data) {
  const root = $("#catalog-groups");
  if (!root) return;
  root.innerHTML = "";
  const lang = state.lang;
  CATALOG.forEach((group) => {
    const wrap = document.createElement("div");
    wrap.className = "catalog-group";
    const title = document.createElement("h3");
    title.className = "catalog-group-title";
    title.textContent = t(lang, group.groupKey);
    wrap.appendChild(title);
    const items = document.createElement("div");
    items.className = "catalog-items";
    group.items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "catalog-row";
      const label = document.createElement("span");
      label.textContent = itemLabel(lang, it.id);
      const price = document.createElement("input");
      price.type = "number";
      price.min = "0";
      price.step = "0.01";
      price.className = "price-input";
      price.value = String(resolveUnitPrice(data, it.id, it.defaultPrice));
      price.dataset.itemId = it.id;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn primary btn-add";
      add.innerHTML =
        '<svg class="icon btn-leading" aria-hidden="true"><use href="#i-plus"/></svg><span></span>';
      add.querySelector("span").textContent = lang === "om" ? "Dabaluu" : "ጨምር";
      add.addEventListener("click", () => {
        const v = parseFloat(price.value);
        if (Number.isNaN(v) || v < 0) return;
        const prices = { ...getPriceOverrides(data), [it.id]: v };
        saveData({ prices }).then((d) => {
          addToCart(d, it.id, itemLabel(lang, it.id), v);
        });
      });
      row.appendChild(label);
      row.appendChild(price);
      row.appendChild(add);
      items.appendChild(row);
    });
    wrap.appendChild(items);
    root.appendChild(wrap);
  });
}

function addToCart(data, itemId, label, unitPrice) {
  const key = `${itemId}@${unitPrice}`;
  const existing = state.cart.find((l) => l.key === key);
  if (existing) existing.qty += 1;
  else state.cart.push({ key, itemId, label, unitPrice, qty: 1 });
  renderCart();
}

function cartTotal() {
  return state.cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

function renderCart() {
  const ul = $("#cart-lines");
  const totalEl = $("#cart-total");
  if (!ul || !totalEl) return;
  ul.innerHTML = "";
  state.cart.forEach((line) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.textContent = `${line.label} ×${line.qty} @ ${formatMoney(line.unitPrice)}`;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "remove";
    rm.setAttribute("aria-label", state.lang === "om" ? "Haquu" : "ሰርዝ");
    rm.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg>';
    rm.addEventListener("click", () => {
      state.cart = state.cart.filter((x) => x.key !== line.key);
      renderCart();
    });
    li.appendChild(left);
    li.appendChild(rm);
    ul.appendChild(li);
  });
  totalEl.textContent = formatMoney(cartTotal());
}

function refreshDashboard(data) {
  let revenue = 0;
  let expenses = 0;
  for (const tx of data.transactions || []) {
    if (!isToday(tx.ts)) continue;
    if (tx.kind === "expense") expenses += tx.total;
    else if (tx.kind === "sale_cash" || tx.kind === "sale_ebirr") revenue += tx.total;
  }
  const profit = revenue - expenses;
  const sr = $("#stat-revenue");
  const se = $("#stat-expenses");
  const sp = $("#stat-profit");
  if (sr) sr.textContent = formatMoney(revenue);
  if (se) se.textContent = formatMoney(expenses);
  if (sp) sp.textContent = formatMoney(profit);
}

function renderHistory(data) {
  const ul = $("#history-list");
  if (!ul) return;
  const list = [...(data.transactions || [])].sort((a, b) => b.ts - a.ts).slice(0, 80);
  ul.innerHTML = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = t(state.lang, "noHistory");
    ul.appendChild(li);
    return;
  }
  list.forEach((tx) => {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "history-row";
    const icoWrap = document.createElement("div");
    icoWrap.className = "history-ico";
    let iconId = "i-cash";
    if (tx.kind === "expense") {
      icoWrap.classList.add("kind-expense");
      iconId = "i-wallet";
    } else if (tx.kind === "sale_ebirr") {
      icoWrap.classList.add("kind-ebirr");
      iconId = "i-mobile-pay";
    }
    icoWrap.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${iconId}"/></svg>`;
    const body = document.createElement("div");
    body.className = "history-body";
    const kindLabel =
      tx.kind === "expense"
        ? t(state.lang, "expenses")
        : tx.kind === "sale_ebirr"
          ? t(state.lang, "saleEbirr")
          : t(state.lang, "saleCash");
    const main = document.createElement("div");
    main.textContent = `${kindLabel}: ${formatMoney(tx.total)}`;
    const meta = document.createElement("div");
    meta.className = "history-meta";
    const d = new Date(tx.ts);
    let extra = d.toLocaleString(state.lang === "om" ? "om-ET" : "am-ET");
    if (tx.payerName) extra += ` · ${t(state.lang, "payer")}: ${tx.payerName}`;
    if (tx.phone) extra += ` · ${tx.phone}`;
    if (tx.note) extra += ` · ${tx.note}`;
    meta.textContent = extra;
    body.appendChild(main);
    body.appendChild(meta);
    row.appendChild(icoWrap);
    row.appendChild(body);
    li.appendChild(row);
    ul.appendChild(li);
  });
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-tab") === tab);
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === `panel-${tab}`);
    p.classList.toggle("hidden", p.id !== `panel-${tab}`);
  });
}

async function afterLogin(data) {
  showView("main");
  const un = $("#main-user-name");
  if (un && state.currentUser) un.textContent = state.currentUser.name;
  const ml = /** @type {HTMLSelectElement | null} */ (document.querySelector("#main-lang"));
  if (ml) ml.value = state.lang;
  applyI18n(document, state.lang);
  renderCatalog(data);
  renderCart();
  refreshDashboard(data);
  renderHistory(data);
}

function openEbirrModal(open) {
  const m = $("#modal-ebirr");
  if (!m) return;
  m.classList.toggle("hidden", !open);
  if (!open) {
    state.ebirrPending = null;
    const res = $("#ebirr-result");
    if (res) {
      res.classList.add("hidden");
      res.textContent = "";
    }
    const c = $("#btn-ebirr-confirm");
    if (c) c.classList.add("hidden");
  }
}

async function recordSale(kind, total, lines, extra = {}) {
  const data = await loadData();
  const tx = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    kind,
    total,
    lines,
    ...extra,
  };
  const transactions = [...(data.transactions || []), tx];
  await saveData({ transactions });
  state.cart = [];
  renderCart();
  refreshDashboard({ ...data, transactions });
  renderHistory({ ...data, transactions });
}

async function init() {
  let data = await loadData();
  state.lang = data.prefs?.lang === "om" ? "om" : "am";
  state.theme = data.prefs?.theme === "dark" ? "dark" : "light";
  setTheme(state.theme);

  $("#login-lang").value = state.lang;
  $("#setup-lang").value = state.lang;

  applyI18n(document, state.lang);

  const needsSetup = !data.users?.length;
  showView(needsSetup ? "setup" : "login");

  $("#btn-theme-toggle")?.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    setTheme(state.theme);
    persistPrefs();
  });
  $("#btn-main-theme")?.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    setTheme(state.theme);
    persistPrefs();
  });

  const setLang = async (lang) => {
    state.lang = lang === "om" ? "om" : "am";
    applyI18n(document, state.lang);
    await persistPrefs();
    data = await loadData();
    if (!$("#view-main").classList.contains("hidden")) {
      renderCatalog(data);
      renderCart();
      renderHistory(data);
    }
  };
  $("#login-lang")?.addEventListener("change", (e) => setLang(/** @type {HTMLSelectElement} */ (e.target).value));
  $("#setup-lang")?.addEventListener("change", (e) => setLang(/** @type {HTMLSelectElement} */ (e.target).value));
  $("#main-lang")?.addEventListener("change", (e) => setLang(/** @type {HTMLSelectElement} */ (e.target).value));

  $("#form-setup")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = /** @type {HTMLInputElement} */ ($("#setup-name")).value;
    const password = /** @type {HTMLInputElement} */ ($("#setup-password")).value;
    state.lang = /** @type {HTMLSelectElement} */ ($("#setup-lang")).value === "om" ? "om" : "am";
    await createUser(name, password);
    await persistPrefs();
    data = await loadData();
    showView("login");
    applyI18n(document, state.lang);
    $("#login-lang").value = state.lang;
    /** @type {HTMLInputElement} */ ($("#login-name")).value = name;
  });

  $("#form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#login-error");
    if (err) {
      err.classList.add("hidden");
      err.textContent = "";
    }
    const name = /** @type {HTMLInputElement} */ ($("#login-name")).value;
    const password = /** @type {HTMLInputElement} */ ($("#login-password")).value;
    const u = await verifyUser(name, password);
    if (!u) {
      if (err) {
        err.textContent = t(state.lang, "loginFailed");
        err.classList.remove("hidden");
      }
      return;
    }
    state.currentUser = u;
    data = await loadData();
    await afterLogin(data);
  });

  $("#btn-logout")?.addEventListener("click", () => {
    state.currentUser = null;
    state.cart = [];
    showView("login");
    /** @type {HTMLInputElement} */ ($("#login-password")).value = "";
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab") || "dashboard"));
  });

  $("#btn-clear-cart")?.addEventListener("click", () => {
    state.cart = [];
    renderCart();
  });

  $("#btn-pay-cash")?.addEventListener("click", async () => {
    const total = cartTotal();
    if (total <= 0) {
      alert(t(state.lang, "cartEmpty"));
      return;
    }
    const lines = state.cart.map((l) => ({
      itemId: l.itemId,
      label: l.label,
      unitPrice: l.unitPrice,
      qty: l.qty,
    }));
    await recordSale("sale_cash", total, lines);
  });

  $("#btn-pay-ebirr")?.addEventListener("click", () => {
    const total = cartTotal();
    if (total <= 0) {
      alert(t(state.lang, "cartEmpty"));
      return;
    }
    const amt = /** @type {HTMLInputElement} */ ($("#ebirr-amount"));
    if (amt) amt.value = String(total);
    openEbirrModal(true);
  });

  $("#modal-ebirr")?.addEventListener("click", (e) => {
    if (/** @type {HTMLElement} */ (e.target).dataset.closeModal !== undefined) openEbirrModal(false);
  });

  $("#btn-ebirr-verify")?.addEventListener("click", () => {
    const phone = /** @type {HTMLInputElement} */ ($("#ebirr-phone")).value.trim();
    const amount = parseFloat(/** @type {HTMLInputElement} */ ($("#ebirr-amount")).value);
    const res = $("#ebirr-result");
    const confirmBtn = $("#btn-ebirr-confirm");
    if (!phone || Number.isNaN(amount) || amount < 0) {
      alert(t(state.lang, "enterPhoneAmount"));
      return;
    }
    const payerName = simulatedPayerName(state.lang, phone);
    state.ebirrPending = { payerName, phone, amount };
    if (res) {
      res.classList.remove("hidden");
      res.innerHTML = `<strong>${t(state.lang, "payer")}:</strong> ${payerName}<br/><strong>${t(state.lang, "amount")}:</strong> ${formatMoney(amount)}<br/><span class="hint">${t(state.lang, "ebirrSimulated")}</span>`;
    }
    if (confirmBtn) confirmBtn.classList.remove("hidden");
  });

  $("#btn-ebirr-confirm")?.addEventListener("click", async () => {
    if (!state.ebirrPending) return;
    const { payerName, phone, amount } = state.ebirrPending;
    const lines = state.cart.map((l) => ({
      itemId: l.itemId,
      label: l.label,
      unitPrice: l.unitPrice,
      qty: l.qty,
    }));
    await recordSale("sale_ebirr", amount, lines, { payerName, phone });
    openEbirrModal(false);
    /** @type {HTMLInputElement} */ ($("#ebirr-phone")).value = "";
  });

  $("#form-expense")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const desc = /** @type {HTMLInputElement} */ ($("#expense-desc")).value.trim();
    const amount = parseFloat(/** @type {HTMLInputElement} */ ($("#expense-amount")).value);
    if (!desc || Number.isNaN(amount) || amount < 0) return;
    const data = await loadData();
    const tx = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      kind: /** @type {'expense'} */ ("expense"),
      total: amount,
      note: desc,
    };
    const transactions = [...(data.transactions || []), tx];
    await saveData({ transactions });
    /** @type {HTMLFormElement} */ ($("#form-expense")).reset();
    refreshDashboard({ ...data, transactions });
    renderHistory({ ...data, transactions });
  });

  $("#btn-clear-all-history")?.addEventListener("click", async () => {
    if (!confirm(t(state.lang, "clearAllHistoryConfirm"))) return;
    const data = await loadData();
    await saveData({ transactions: [] });
    const next = { ...data, transactions: [] };
    refreshDashboard(next);
    renderHistory(next);
  });
}

init().catch(console.error);
