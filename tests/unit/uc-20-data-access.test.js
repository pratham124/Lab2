const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataAccess } = require("../../src/services/data_access");

test("data access normalizes and returns registration prices", () => {
  const access = createDataAccess({
    seed: {
      registrationPrices: [
        { category_name: "Regular", amount: "200", active: true, order: 1 },
        { name: "Student", amount: null, active: false, order: 2 },
        { name: "Broken", amount: "abc" },
        {},
      ],
    },
  });

  const prices = access.listRegistrationPrices();
  assert.equal(prices.length, 4);
  assert.deepEqual(prices[0], {
    name: "Regular",
    category_name: "Regular",
    amount: 200,
    active: true,
    order: 1,
  });
  assert.deepEqual(prices[1], {
    name: "Student",
    category_name: "Student",
    amount: null,
    active: false,
    order: 2,
  });
  assert.equal(prices[2].amount, null);
  assert.equal(prices[2].active, true);
  assert.equal(prices[2].order, null);
  assert.equal(prices[3].name, "");
  assert.equal(prices[3].category_name, "");
  assert.equal(prices[3].amount, null);
});

test("data access registration prices list is returned as clone", () => {
  const access = createDataAccess({
    seed: {
      registrationPrices: [{ name: "Regular", amount: 100, active: true, order: 1 }],
    },
  });

  const first = access.listRegistrationPrices();
  first[0].name = "Mutated";
  const second = access.listRegistrationPrices();

  assert.equal(second[0].name, "Regular");
});

test("data access returns empty registration prices when not seeded", () => {
  const access = createDataAccess();
  assert.deepEqual(access.listRegistrationPrices(), []);
});
