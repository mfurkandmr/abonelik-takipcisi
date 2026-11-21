const test = require("node:test");
const assert = require("node:assert");
const { addSubscription, validateSubscription, loadSubscriptions, saveSubscriptions } = require("./app.js");

function fakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

// Kart 1: Abonelik ekleme
test("geçerli form abonelik listesine eklenir", () => {
  const { list, errors } = addSubscription([], { name: "Netflix", price: "150", day: "15" });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, "Netflix");
  assert.strictEqual(list[0].price, 150);
  assert.strictEqual(list[0].day, 15);
});

test("kaydedilen abonelik 'sayfa yenilenince' (storage'dan okununca) geri gelir", () => {
  const storage = fakeStorage();
  const { list } = addSubscription([], { name: "Spotify", price: "60", day: "3" });
  saveSubscriptions(storage, list);
  const reloaded = loadSubscriptions(storage);
  assert.strictEqual(reloaded.length, 1);
  assert.strictEqual(reloaded[0].name, "Spotify");
});

test("boş ad hata verir ve kayıt eklenmez", () => {
  const { list, errors } = addSubscription([], { name: "  ", price: "50", day: "10" });
  assert.strictEqual(list.length, 0);
  assert.ok(errors.length > 0);
});

test("negatif ücret hata verir ve kayıt eklenmez", () => {
  const { list, errors } = addSubscription([], { name: "X", price: "-5", day: "10" });
  assert.strictEqual(list.length, 0);
  assert.ok(errors.length > 0);
});

test("ücret boşsa veya yenilenme günü aralık dışındaysa hata verir", () => {
  assert.ok(validateSubscription({ name: "X", price: "", day: "10" }).length > 0);
  assert.ok(validateSubscription({ name: "X", price: "10", day: "0" }).length > 0);
  assert.ok(validateSubscription({ name: "X", price: "10", day: "32" }).length > 0);
});

test("bozuk storage verisi uygulamayı çökertmez", () => {
  const storage = { getItem: () => "{bozuk json", setItem() {} };
  assert.deepStrictEqual(loadSubscriptions(storage), []);
});

// Kart 2: Aylık toplam ve yaklaşan ödemeler
const { monthlyTotal, nextRenewal, upcomingPayments, formatTL } = require("./app.js");

test("100 TL ve 50 TL'lik iki abonelikte toplam 150 TL olur", () => {
  assert.strictEqual(monthlyTotal([{ price: 100 }, { price: 50 }]), 150);
});

test("hiç abonelik yoksa toplam 0 olur", () => {
  assert.strictEqual(monthlyTotal([]), 0);
  assert.strictEqual(formatTL(0), "0");
});

test("yenilenme günü 7 gün içindeyse yaklaşan ödemelerde görünür", () => {
  const today = new Date(2026, 4, 10); // 10 Mayıs 2026
  const list = [
    { name: "A", price: 10, day: 12 }, // 2 gün sonra
    { name: "B", price: 20, day: 17 }, // tam 7 gün sonra
    { name: "C", price: 30, day: 18 }, // 8 gün sonra -> görünmez
    { name: "D", price: 40, day: 10 }, // bugün
  ];
  const names = upcomingPayments(list, today).map((s) => s.name);
  assert.deepStrictEqual(names, ["D", "A", "B"]);
});

test("ay sonuna yakın olup yenilenme günü ertesi aya taşan abonelik yaklaşanlarda görünür", () => {
  const today = new Date(2026, 4, 29); // 29 Mayıs 2026
  const [s] = upcomingPayments([{ name: "A", price: 10, day: 3 }], today);
  assert.strictEqual(s.daysLeft, 5); // 3 Haziran
});

test("yılbaşını aşan yenilenme doğru hesaplanır", () => {
  const today = new Date(2026, 11, 30); // 30 Aralık 2026
  const { date, daysLeft } = nextRenewal({ day: 2 }, today);
  assert.strictEqual(date.getFullYear(), 2027);
  assert.strictEqual(date.getMonth(), 0);
  assert.strictEqual(daysLeft, 3);
});

test("31. gün kısa aylarda ayın son gününe çekilir", () => {
  const today = new Date(2026, 1, 25); // 25 Şubat 2026 (28 gün)
  const { date } = nextRenewal({ day: 31 }, today);
  assert.strictEqual(date.getMonth(), 1);
  assert.strictEqual(date.getDate(), 28);
});

test("ondalıklı toplam iki haneli gösterilir", () => {
  assert.strictEqual(formatTL(149.9), "149.90");
  assert.strictEqual(formatTL(150), "150");
});

// Kart 3: Abonelik silme
const { removeSubscription } = require("./app.js");

test("silinen abonelik listeden kalkar, diğerleri durur", () => {
  const list = [{ id: "a", name: "A", price: 10, day: 1 }, { id: "b", name: "B", price: 20, day: 2 }];
  const result = removeSubscription(list, "a");
  assert.deepStrictEqual(result.map((s) => s.id), ["b"]);
});

test("silme sonrası toplam güncellenir", () => {
  const list = [{ id: "a", price: 100 }, { id: "b", price: 50 }];
  assert.strictEqual(monthlyTotal(removeSubscription(list, "a")), 50);
});

test("olmayan kimlik silinmek istenirse liste değişmez", () => {
  const list = [{ id: "a", price: 10 }];
  assert.strictEqual(removeSubscription(list, "yok").length, 1);
});

test("silme kalıcıdır: kaydedilip yeniden okununca silinen geri gelmez", () => {
  const storage = fakeStorage();
  const list = [{ id: "a", name: "A", price: 10, day: 1 }, { id: "b", name: "B", price: 20, day: 2 }];
  saveSubscriptions(storage, removeSubscription(list, "a"));
  assert.deepStrictEqual(loadSubscriptions(storage).map((s) => s.id), ["b"]);
});

// Kart 4: Abonelik düzenleme
const { updateSubscription } = require("./app.js");

test("düzenleme listedeki bilgiyi günceller, kimlik ve diğer kayıtlar korunur", () => {
  const list = [{ id: "a", name: "A", price: 10, day: 1 }, { id: "b", name: "B", price: 20, day: 2 }];
  const { list: out, errors } = updateSubscription(list, "a", { name: "A+", price: "99.5", day: "20" });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(out[0], { id: "a", name: "A+", price: 99.5, day: 20 });
  assert.deepStrictEqual(out[1], list[1]);
});

test("düzenleme sonrası toplam yeni ücrete göre hesaplanır", () => {
  const list = [{ id: "a", name: "A", price: 100, day: 1 }, { id: "b", name: "B", price: 50, day: 2 }];
  const { list: out } = updateSubscription(list, "a", { name: "A", price: "120", day: "1" });
  assert.strictEqual(monthlyTotal(out), 170);
});

test("geçersiz düzenleme hata verir ve liste değişmez", () => {
  const list = [{ id: "a", name: "A", price: 10, day: 1 }];
  const { list: out, errors } = updateSubscription(list, "a", { name: "", price: "-1", day: "40" });
  assert.ok(errors.length >= 3);
  assert.deepStrictEqual(out, list);
});

test("olmayan kimlik düzenlenmek istenirse hata verilir", () => {
  const list = [{ id: "a", name: "A", price: 10, day: 1 }];
  const { list: out, errors } = updateSubscription(list, "yok", { name: "X", price: "5", day: "5" });
  assert.strictEqual(errors.length, 1);
  assert.deepStrictEqual(out, list);
});

// Kart 5: Kategoriye göre filtreleme
const { filterByCategory, normalizeCategory } = require("./app.js");

const sample = [
  { id: "1", name: "Netflix", price: 100, day: 1, category: "Eğlence" },
  { id: "2", name: "Spotify", price: 50, day: 2, category: "Müzik" },
  { id: "3", name: "YouTube Premium", price: 60, day: 3, category: "Eğlence" },
  { id: "4", name: "Eski kayıt", price: 10, day: 4 }, // kategorisiz (eski sürümden)
];

test("kategori seçilince yalnızca o kategorideki abonelikler listelenir", () => {
  const names = filterByCategory(sample, "Eğlence").map((s) => s.name);
  assert.deepStrictEqual(names, ["Netflix", "YouTube Premium"]);
});

test("'Tümü' seçilince hepsi geri gelir", () => {
  assert.strictEqual(filterByCategory(sample, "Tümü").length, 4);
});

test("kategorisi olmayan eski kayıtlar 'Diğer' sayılır", () => {
  assert.deepStrictEqual(filterByCategory(sample, "Diğer").map((s) => s.name), ["Eski kayıt"]);
  assert.strictEqual(normalizeCategory(undefined), "Diğer");
  assert.strictEqual(normalizeCategory("Bilinmeyen"), "Diğer");
});

test("olmayan kategoride sonuç boş döner", () => {
  assert.deepStrictEqual(filterByCategory(sample, "Eğitim"), []);
});

test("eklenen abonelik seçilen kategoriyi taşır, seçilmezse 'Diğer' olur", () => {
  const a = addSubscription([], { name: "X", price: "10", day: "5", category: "Yazılım" });
  assert.strictEqual(a.list[0].category, "Yazılım");
  const b = addSubscription([], { name: "Y", price: "10", day: "5" });
  assert.strictEqual(b.list[0].category, "Diğer");
});

test("düzenlemede kategori değiştirilebilir, verilmezse korunur", () => {
  const list = [{ id: "a", name: "A", price: 10, day: 1, category: "Müzik" }];
  const changed = updateSubscription(list, "a", { name: "A", price: "10", day: "1", category: "Eğitim" });
  assert.strictEqual(changed.list[0].category, "Eğitim");
  const kept = updateSubscription(list, "a", { name: "A", price: "12", day: "1" });
  assert.strictEqual(kept.list[0].category, "Müzik");
});
