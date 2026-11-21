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

/* ---------- Tarayıcı arayüzü ---------- */
if (typeof document !== "undefined") {
  let subscriptions = loadSubscriptions(localStorage);

  const form = document.getElementById("sub-form");
  const errorBox = document.getElementById("errors");
  const listEl = document.getElementById("sub-list");

  function render() {
    listEl.replaceChildren();
    if (subscriptions.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Henüz abonelik eklenmedi.";
      listEl.appendChild(li);
      return;
    }
    for (const s of subscriptions) {
      const li = document.createElement("li");
      li.textContent = `${s.name} - ${s.price} TL (her ayın ${s.day}. günü)`;
      listEl.appendChild(li);
    }
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
  module.exports = { validateSubscription, addSubscription, loadSubscriptions, saveSubscriptions };
}
