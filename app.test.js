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
