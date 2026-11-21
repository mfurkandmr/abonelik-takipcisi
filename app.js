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

/* ---------- Tarayıcı arayüzü ---------- */
if (typeof document !== "undefined") {
  let subscriptions = loadSubscriptions(localStorage);

  const form = document.getElementById("sub-form");
  const errorBox = document.getElementById("errors");
  const listEl = document.getElementById("sub-list");

  const submitBtn = document.getElementById("submit-btn");
  const cancelBtn = document.getElementById("cancel-edit");
  const formTitle = document.getElementById("add-title");
  let editingId = null;

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
    form.elements.name.focus();
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

  const totalEl = document.getElementById("monthly-total");
  const upcomingEl = document.getElementById("upcoming-list");

  function emptyItem(text) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = text;
    return li;
  }

  const filterEl = document.getElementById("category-filter");
  let activeFilter = "Tümü";
  filterEl.addEventListener("change", () => {
    activeFilter = filterEl.value;
    renderList();
  });

  function renderList() {
    listEl.replaceChildren();
    if (subscriptions.length === 0) {
      listEl.appendChild(emptyItem("Henüz abonelik eklenmedi."));
      return;
    }
    const visible = filterByCategory(subscriptions, activeFilter);
    if (visible.length === 0) {
      listEl.appendChild(emptyItem(`"${activeFilter}" kategorisinde abonelik yok.`));
      return;
    }
    for (const s of visible) {
      const li = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = `${s.name} - ${s.price} TL (her ayın ${s.day}. günü) · ${normalizeCategory(s.category)}`;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "Düzenle";
      edit.setAttribute("aria-label", `${s.name} aboneliğini düzenle`);
      edit.addEventListener("click", () => startEdit(s));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "Sil";
      del.setAttribute("aria-label", `${s.name} aboneliğini sil`);
      del.addEventListener("click", () => {
        if (editingId === s.id) stopEdit();
        subscriptions = removeSubscription(subscriptions, s.id);
        saveSubscriptions(localStorage, subscriptions);
        render();
      });
      const actions = document.createElement("span");
      actions.className = "actions";
      actions.append(edit, del);
      li.append(text, actions);
      listEl.appendChild(li);
    }
  }

  function renderSummary() {
    totalEl.textContent = `${formatTL(monthlyTotal(subscriptions))} TL`;
    upcomingEl.replaceChildren();
    const upcoming = upcomingPayments(subscriptions, new Date());
    if (upcoming.length === 0) {
      upcomingEl.appendChild(emptyItem("Önümüzdeki 7 gün içinde yenilenen abonelik yok."));
      return;
    }
    for (const s of upcoming) {
      const li = document.createElement("li");
      const when = s.daysLeft === 0 ? "bugün" : `${s.daysLeft} gün sonra`;
      li.textContent = `${s.name} - ${s.price} TL (${when})`;
      upcomingEl.appendChild(li);
    }
  }

  function render() {
    renderList();
    renderSummary();
  }

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
    subscriptions = result.list;
    saveSubscriptions(localStorage, subscriptions);
    stopEdit();
    render();
  });

  render();
}

if (typeof module !== "undefined") {
  module.exports = {
    validateSubscription, addSubscription, loadSubscriptions, saveSubscriptions,
    monthlyTotal, nextRenewal, upcomingPayments, formatTL, removeSubscription,
    updateSubscription, filterByCategory, normalizeCategory, CATEGORIES,
  };
}
