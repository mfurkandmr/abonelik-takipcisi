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
