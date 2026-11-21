const STORAGE_KEY = "abonelikler";

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

function addSubscription(list, { name, price, day }) {
  const errors = validateSubscription({ name, price, day });
  if (errors.length) return { list, errors };
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(name).trim(),
    price: Number(price),
    day: Number(day),
  };
  return { list: [...list, item], errors: [] };
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

  const totalEl = document.getElementById("monthly-total");
  const upcomingEl = document.getElementById("upcoming-list");

  function emptyItem(text) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = text;
    return li;
  }

  function renderList() {
    listEl.replaceChildren();
    if (subscriptions.length === 0) {
      listEl.appendChild(emptyItem("Henüz abonelik eklenmedi."));
      return;
    }
    for (const s of subscriptions) {
      const li = document.createElement("li");
      li.textContent = `${s.name} - ${s.price} TL (her ayın ${s.day}. günü)`;
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
    };
    const result = addSubscription(subscriptions, data);
    if (result.errors.length) {
      errorBox.textContent = result.errors.join(" ");
      return;
    }
    errorBox.textContent = "";
    subscriptions = result.list;
    saveSubscriptions(localStorage, subscriptions);
    form.reset();
    render();
  });

  render();
}

if (typeof module !== "undefined") {
  module.exports = {
    validateSubscription, addSubscription, loadSubscriptions, saveSubscriptions,
    monthlyTotal, nextRenewal, upcomingPayments, formatTL,
  };
}
