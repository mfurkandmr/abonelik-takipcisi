const STORAGE_KEY = "abonelikler";
const CATEGORIES = ["Eğlence", "Müzik", "Yazılım", "Eğitim", "Diğer"];
const DEFAULT_CATEGORY = "Diğer";

/** Bilinmeyen veya boş kategoriyi varsayılana çevirir (eski kayıtlarda kategori yoktur). */
function normalizeCategory(category) {
  return CATEGORIES.includes(category) ? category : DEFAULT_CATEGORY;
}

/** Form girdisini doğrular, hata mesajlarını dizi olarak döndürür. */
function validateSubscription({ name, price, day }) {
  const errors = [];
  if (!String(name || "").trim()) errors.push("Abonelik adı boş olamaz.");
  const p = Number(price);
  if (price === "" || price === null || price === undefined || Number.isNaN(p) || p < 0) {
    errors.push("Ücret 0 veya daha büyük bir sayı olmalı.");
  }
  const d = Number(day);
  if (!Number.isInteger(d) || d < 1 || d > 31) {
    errors.push("Yenilenme günü 1 ile 31 arasında olmalı.");
  }
  return errors;
}

function loadSubscriptions(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubscriptions(storage, list) {
  storage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function addSubscription(list, { name, price, day, category }) {
  const errors = validateSubscription({ name, price, day });
  if (errors.length) return { list, errors };
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(name).trim(),
    price: Number(price),
    day: Number(day),
    category: normalizeCategory(category),
  };
  return { list: [...list, item], errors: [] };
}

/** Mevcut aboneliği günceller. Geçersiz girdide ya da bilinmeyen kimlikte liste değişmez. */
function updateSubscription(list, id, { name, price, day, category }) {
  const errors = validateSubscription({ name, price, day });
  if (errors.length) return { list, errors };
  if (!list.some((s) => s.id === id)) return { list, errors: ["Düzenlenecek abonelik bulunamadı."] };
  const updated = list.map((s) => {
    if (s.id !== id) return s;
    const next = { ...s, name: String(name).trim(), price: Number(price), day: Number(day) };
    if (category !== undefined) next.category = normalizeCategory(category);
    return next;
  });
  return { list: updated, errors: [] };
}

/** Seçilen kategoriye göre süzer. "Tümü" (veya boş) seçimde hepsini döndürür. */
function filterByCategory(list, category) {
  if (!category || category === "Tümü") return list;
  return list.filter((s) => normalizeCategory(s.category) === category);
}

/** Verilen kimlikteki aboneliği listeden çıkarır. Bulunamazsa liste değişmez. */
function removeSubscription(list, id) {
  return list.filter((s) => s.id !== id);
}

/** Tutarı gösterim için biçimlendirir: tam sayıysa ondalıksız, değilse 2 haneli. */
function formatTL(amount) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** Tüm aboneliklerin aylık toplam ücreti. Liste boşsa 0 döner. */
function monthlyTotal(list) {
  return list.reduce((sum, s) => sum + s.price, 0);
}

/** Yıllık tahmini maliyet: aylık toplam x 12 (kuruş hassasiyetinde yuvarlanır). */
function yearlyTotal(list) {
  return Math.round(monthlyTotal(list) * 12 * 100) / 100;
}

/** Verilen ay için yenilenme gününü ayın uzunluğuna sığdırır (31 -> Şubat'ta 28/29). */
function clampDay(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

/** Bir aboneliğin bugünden itibaren bir sonraki yenilenme tarihini ve kalan günü verir. */
function nextRenewal(sub, today) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let date = new Date(start.getFullYear(), start.getMonth(), clampDay(start.getFullYear(), start.getMonth(), sub.day));
  if (date < start) {
    const m = start.getMonth() + 1;
    const y = start.getFullYear() + Math.floor(m / 12);
    const mm = m % 12;
    date = new Date(y, mm, clampDay(y, mm, sub.day));
  }
  const daysLeft = Math.round((date - start) / 86400000);
  return { date, daysLeft };
}

/** Önümüzdeki `withinDays` gün içinde yenilenen abonelikleri, en yakın olan önce gelecek şekilde döndürür. */
function upcomingPayments(list, today, withinDays = 7) {
  return list
    .map((s) => ({ ...s, ...nextRenewal(s, today) }))
    .filter((s) => s.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Bu ayın günlerine düşen ödemeler: { gün: [abonelik, ...] }. 29-31. gün kısa aylarda ayın son gününe çekilir. */
function paymentsByDay(list, today) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const byDay = {};
  for (const s of list) {
    const d = clampDay(y, m, s.day);
    (byDay[d] = byDay[d] || []).push(s);
  }
  return byDay;
}

/* ---------- Tarayıcı arayüzü ---------- */
if (typeof document !== "undefined") {
  let subscriptions = loadSubscriptions(localStorage);
  let editingId = null;
  let activeFilter = "Tümü";
  let flashId = null;

  const money = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const monthFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const form = $("sub-form");
  const errorBox = $("errors");
  const listEl = $("sub-list");
  const submitBtn = $("submit-btn");
  const cancelBtn = $("cancel-edit");
  const formTitle = $("add-title");
  const totalEl = $("monthly-total");
  const yearlyEl = $("yearly-total");
  const upcomingEl = $("upcoming-list");
  const stripEl = $("month-strip");
  const monthNameEl = $("month-name");
  const chipsEl = $("category-filter");

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function when(daysLeft) {
    return daysLeft === 0 ? "bugün" : daysLeft === 1 ? "yarın" : `${daysLeft} gün sonra`;
  }

  /* --- Form: ekleme ve düzenleme --- */
  function startEdit(s) {
    editingId = s.id;
    form.elements.name.value = s.name;
    form.elements.price.value = s.price;
    form.elements.day.value = s.day;
    form.elements.category.value = normalizeCategory(s.category);
    submitBtn.textContent = "Kaydet";
    cancelBtn.hidden = false;
    formTitle.textContent = "Aboneliği düzenle";
    errorBox.textContent = "";
    form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    form.elements.name.focus({ preventScroll: true });
  }

  function stopEdit() {
    editingId = null;
    form.reset();
    submitBtn.textContent = "Ekle";
    cancelBtn.hidden = true;
    formTitle.textContent = "Abonelik ekle";
  }

  cancelBtn.addEventListener("click", () => {
    errorBox.textContent = "";
    stopEdit();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      name: form.elements.name.value,
      price: form.elements.price.value,
      day: form.elements.day.value,
      category: form.elements.category.value,
    };
    const result = editingId
      ? updateSubscription(subscriptions, editingId, data)
      : addSubscription(subscriptions, data);
    if (result.errors.length) {
      errorBox.textContent = result.errors.join(" ");
      return;
    }
    errorBox.textContent = "";
    flashId = editingId || result.list[result.list.length - 1].id;
    subscriptions = result.list;
    saveSubscriptions(localStorage, subscriptions);
    stopEdit();
    render();
  });

  /* --- Kategori filtresi --- */
  function renderChips() {
    chipsEl.replaceChildren();
    for (const name of ["Tümü", ...CATEGORIES]) {
      const chip = el("button", "chip", name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(name === activeFilter));
      chip.addEventListener("click", () => {
        activeFilter = name;
        renderChips();
        renderList();
      });
      chipsEl.appendChild(chip);
    }
  }

  /* --- Liste --- */
  function renderList() {
    listEl.replaceChildren();
    if (subscriptions.length === 0) {
      listEl.appendChild(el("li", "empty", "Henüz abonelik yok. Formdan ilk aboneliğini ekle."));
      return;
    }
    const visible = filterByCategory(subscriptions, activeFilter);
    if (visible.length === 0) {
      listEl.appendChild(el("li", "empty", `"${activeFilter}" kategorisinde abonelik yok.`));
      return;
    }
    const today = new Date();
    for (const s of visible) {
      const li = el("li", "row");
      if (s.id === flashId) li.classList.add("flash");

      const meta = el("p", "meta", `Her ayın ${s.day}. günü · ${normalizeCategory(s.category)}`);
      const { daysLeft } = nextRenewal(s, today);
      if (daysLeft <= 7) meta.append(" ", el("span", "pill", when(daysLeft)));

      const edit = el("button", "link", "Düzenle");
      edit.type = "button";
      edit.setAttribute("aria-label", `${s.name} aboneliğini düzenle`);
      edit.addEventListener("click", () => startEdit(s));

      const del = el("button", "link danger", "Sil");
      del.type = "button";
      del.setAttribute("aria-label", `${s.name} aboneliğini sil`);
      del.addEventListener("click", () => {
        if (editingId === s.id) stopEdit();
        subscriptions = removeSubscription(subscriptions, s.id);
        saveSubscriptions(localStorage, subscriptions);
        render();
      });

      const actions = el("div", "actions");
      actions.append(edit, del);
      li.append(
        el("h3", "name", s.name),
        el("p", "price", `${money.format(s.price)} TL`),
        meta,
        actions
      );
      listEl.appendChild(li);
    }
    flashId = null;
  }

  /* --- Özet: toplamlar, takvim şeridi, yaklaşanlar --- */
  let introPlayed = false;

  function renderStrip(now) {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const byDay = paymentsByDay(subscriptions, now);
    monthNameEl.textContent = monthFmt.format(now);
    stripEl.style.setProperty("--days", days);
    stripEl.replaceChildren();
    for (let d = 1; d <= days; d++) {
      const cell = el("div", "day");
      cell.style.setProperty("--i", d);
      cell.append(el("span", "", String(d)));
      if (d === now.getDate()) cell.classList.add("today");
      if (d < now.getDate()) cell.classList.add("past");
      const pays = byDay[d];
      if (pays) {
        cell.classList.add("has");
        cell.title = pays.map((p) => `${p.name} ${money.format(p.price)} TL`).join(", ");
        if (pays.length > 1) cell.append(el("b", "", `×${pays.length}`));
      }
      stripEl.appendChild(cell);
    }
    if (!introPlayed && !reduceMotion) {
      introPlayed = true;
      stripEl.classList.add("intro");
      setTimeout(() => stripEl.classList.remove("intro"), 1500);
    }
  }

  function renderSummary() {
    const now = new Date();
    totalEl.textContent = `${money.format(monthlyTotal(subscriptions))} TL`;
    yearlyEl.textContent = `${money.format(yearlyTotal(subscriptions))} TL`;
    renderStrip(now);

    upcomingEl.replaceChildren();
    const upcoming = upcomingPayments(subscriptions, now);
    if (upcoming.length === 0) {
      upcomingEl.appendChild(el("li", "empty", "Önümüzdeki 7 gün içinde ödeme yok."));
      return;
    }
    for (const s of upcoming) {
      const li = el("li", "soon-item");
      li.append(
        el("strong", "", s.name),
        el("span", "", `${money.format(s.price)} TL`),
        el("span", "when", when(s.daysLeft))
      );
      upcomingEl.appendChild(li);
    }
  }

  function render() {
    renderList();
    renderSummary();
  }

  renderChips();
  render();
}

if (typeof module !== "undefined") {
  module.exports = {
    validateSubscription, addSubscription, loadSubscriptions, saveSubscriptions,
    monthlyTotal, nextRenewal, upcomingPayments, formatTL, removeSubscription,
    updateSubscription, filterByCategory, normalizeCategory, CATEGORIES, yearlyTotal,
    paymentsByDay,
  };
}
