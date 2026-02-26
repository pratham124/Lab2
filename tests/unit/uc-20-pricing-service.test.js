const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapRegistrationPrice,
  mapRegistrationPrices,
  formatDisplayAmount,
} = require("../../src/models/registration-price");
const {
  createPricingService,
  UNAVAILABLE_MESSAGE,
  RETRIEVAL_ERROR_MESSAGE,
} = require("../../src/services/pricing-service");
const {
  createRegistrationPricesController,
} = require("../../src/controllers/registration-prices-controller");

test("registration price model maps and formats values", () => {
  const mapped = mapRegistrationPrice({
    category_name: "Regular",
    amount: "200",
    active: "true",
  });

  assert.equal(mapped.name, "Regular");
  assert.equal(mapped.amount, 200);
  assert.equal(mapped.active, true);
  assert.equal(formatDisplayAmount(mapped.amount), "$200.00");

  const list = mapRegistrationPrices([
    { name: "B", amount: 20, active: true, order: 2 },
    { name: "A", amount: null, active: true, order: 1 },
  ]);

  assert.deepEqual(
    list.map((entry) => entry.name),
    ["A", "B"]
  );

  assert.deepEqual(mapRegistrationPrices("bad"), []);
  assert.equal(mapRegistrationPrice({ name: "Neg", amount: -1 }).amount, null);
  assert.equal(mapRegistrationPrice({ name: "NaN", amount: "bad" }).amount, null);
  assert.equal(mapRegistrationPrice({ name: "Empty", amount: "" }).amount, null);
  assert.equal(mapRegistrationPrice({ name: "From bool false", active: false }).active, false);
  assert.equal(mapRegistrationPrice({ name: "From string false", active: " false " }).active, false);
  assert.equal(mapRegistrationPrice({ name: "Default active", active: 12 }).active, true);
  assert.equal(mapRegistrationPrice({ category_name: "From category" }, 3).order, 3);
  assert.equal(mapRegistrationPrice({}, 9).name, "");
  assert.equal(formatDisplayAmount(12, { currency: "" }), "12");
  assert.equal(formatDisplayAmount(null), "Not available");
});

test("pricing service returns ok and unavailable states correctly", async () => {
  const okService = createPricingService({
    loadPricingData: async () => [
      { name: "Regular", amount: 200, active: true, order: 1 },
      { name: "Student", amount: null, active: true, order: 2 },
      { name: "VIP", amount: 500, active: false, order: 3 },
    ],
  });

  const ok = await okService.getCurrentPricing();
  assert.equal(ok.status, "ok");
  assert.equal(ok.categories.length, 2);
  assert.equal(ok.categories[1].display_amount, "Not available");

  const unavailableService = createPricingService({
    loadPricingData: async () => [{ name: "Student", amount: null, active: true }],
  });

  const unavailable = await unavailableService.getCurrentPricing();
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.message, UNAVAILABLE_MESSAGE);

  const unavailableNoActive = await createPricingService({
    loadPricingData: async () => [{ name: "VIP", amount: 500, active: false }],
  }).getCurrentPricing();
  assert.equal(unavailableNoActive.status, "unavailable");

  const fromDataAccess = await createPricingService({
    dataAccess: {
      listRegistrationPrices() {
        return [{ name: "DataAccessPrice", amount: 45, active: true }];
      },
    },
  }).getCurrentPricing();
  assert.equal(fromDataAccess.status, "ok");
  assert.equal(fromDataAccess.categories[0].name, "DataAccessPrice");

  const fromFallback = await createPricingService({}).getCurrentPricing();
  assert.equal(fromFallback.status, "unavailable");
});

test("pricing service returns safe error on loader failure", async () => {
  const logs = [];
  const service = createPricingService({
    loadPricingData: async () => {
      throw new Error("database offline");
    },
    logger: {
      error(code, error) {
        logs.push({ code, message: error.message });
      },
    },
  });

  const result = await service.getCurrentPricing();
  assert.equal(result.status, "error");
  assert.equal(result.message, RETRIEVAL_ERROR_MESSAGE);
  assert.deepEqual(logs, [{ code: "pricing_retrieval_failed", message: "database offline" }]);

  const noLoggerMethod = await createPricingService({
    loadPricingData: async () => {
      throw new Error("x");
    },
    logger: {},
  }).getCurrentPricing();
  assert.equal(noLoggerMethod.status, "error");
});

test("registration prices controller returns page and API payloads", async () => {
  const controller = createRegistrationPricesController({
    pricingService: {
      async getCurrentPricing() {
        return {
          status: "ok",
          categories: [{ name: "Regular", active: true, amount: 200, display_amount: "$200.00" }],
        };
      },
    },
  });

  const page = await controller.handleGetPage();
  assert.equal(page.status, 200);
  assert.equal(page.headers["Content-Type"], "text/html");
  assert.equal(page.body.includes("Conference Registration Prices"), true);

  const api = await controller.handleGetApi();
  assert.equal(api.status, 200);
  const payload = JSON.parse(api.body);
  assert.equal(payload.status, "ok");
  assert.equal(payload.categories[0].name, "Regular");

  const unavailableController = createRegistrationPricesController({
    pricingService: {
      async getCurrentPricing() {
        return {
          status: "unavailable",
          categories: [{ name: "ignored" }],
        };
      },
    },
  });
  const unavailableApi = await unavailableController.handleGetApi();
  const unavailablePayload = JSON.parse(unavailableApi.body);
  assert.equal(unavailableApi.status, 200);
  assert.equal(unavailablePayload.status, "unavailable");
  assert.equal(unavailablePayload.message, UNAVAILABLE_MESSAGE);
  assert.deepEqual(unavailablePayload.categories, []);

  const errorController = createRegistrationPricesController({
    pricingService: {
      async getCurrentPricing() {
        return {
          status: "error",
        };
      },
    },
  });
  const errorApi = await errorController.handleGetApi();
  const errorPayload = JSON.parse(errorApi.body);
  assert.equal(errorApi.status, 503);
  assert.equal(errorPayload.message, RETRIEVAL_ERROR_MESSAGE);

  const missingArrayController = createRegistrationPricesController({
    pricingService: {
      async getCurrentPricing() {
        return {
          status: "ok",
          categories: null,
        };
      },
    },
  });
  const missingArrayApi = await missingArrayController.handleGetApi();
  const missingArrayPayload = JSON.parse(missingArrayApi.body);
  assert.deepEqual(missingArrayPayload.categories, []);
});

test("registration prices controller validates pricing service dependency", () => {
  assert.throws(
    () => createRegistrationPricesController({}),
    /pricingService with getCurrentPricing is required/
  );
  assert.throws(
    () => createRegistrationPricesController({ pricingService: {} }),
    /pricingService with getCurrentPricing is required/
  );
});
