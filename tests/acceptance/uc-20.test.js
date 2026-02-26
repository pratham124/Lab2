const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");
const {
  createPricingService,
  UNAVAILABLE_MESSAGE,
  RETRIEVAL_ERROR_MESSAGE,
} = require("../../src/services/pricing-service");
const {
  createRegistrationPricesController,
} = require("../../src/controllers/registration-prices-controller");

function injectRequest(server, options, body) {
  return new Promise((resolve, reject) => {
    const reqBody = body ? Buffer.from(body, "utf8") : Buffer.alloc(0);
    let sent = false;
    const req = new Readable({
      read() {
        if (sent) {
          return;
        }
        sent = true;
        if (reqBody.length > 0) {
          this.push(reqBody);
        }
        this.push(null);
      },
    });

    req.method = options.method || "GET";
    req.url = options.path;
    req.headers = options.headers || { host: "localhost" };

    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        callback();
      },
    });

    res.writeHead = function writeHead(status, headers) {
      res.statusCode = status;
      res.headers = headers || {};
      return res;
    };

    res.end = function end(chunk) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      resolve({
        status: res.statusCode || 200,
        headers: res.headers || {},
        body: Buffer.concat(chunks).toString("utf8"),
      });
      return res;
    };

    try {
      server.emit("request", req, res);
    } catch (error) {
      reject(error);
    }
  });
}

function makeElement(id) {
  return {
    id,
    hidden: false,
    textContent: "",
    innerHTML: "",
  };
}

function createFakeDocument() {
  const ids = ["pricing-loading", "pricing-empty", "pricing-error", "pricing-list"];
  const elements = new Map(ids.map((id) => [id, makeElement(id)]));

  return {
    readyState: "complete",
    addEventListener() {},
    getElementById(id) {
      return elements.get(id) || null;
    },
    elements,
  };
}

async function flushUi() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function parseJson(response) {
  return JSON.parse(response.body);
}

test("AT-UC20-01 — View Registration Prices Successfully (Main Success Scenario)", async () => {
  const pricingService = createPricingService({
    loadPricingData: async () => [
      { name: "Regular", amount: 200, active: true, order: 1 },
      { name: "Student", amount: 100, active: true, order: 2 },
    ],
  });
  const { server } = createAppServer({ pricingService });

  const api = await injectRequest(server, {
    method: "GET",
    path: "/api/registration-prices",
    headers: { host: "localhost", accept: "application/json" },
  });

  assert.equal(api.status, 200);
  const payload = parseJson(api);
  assert.equal(payload.status, "ok");
  assert.deepEqual(
    payload.categories.map((entry) => [entry.name, entry.display_amount]),
    [
      ["Regular", "$200.00"],
      ["Student", "$100.00"],
    ]
  );

  const page = await injectRequest(server, {
    method: "GET",
    path: "/registration-prices",
    headers: { host: "localhost", accept: "text/html" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("Conference Registration Prices"), true);
  assert.equal(page.body.includes("Unable to retrieve pricing"), true);
});

test("AT-UC20-02 — Pricing Not Defined: Show 'Not Available' Message (Extension 3a)", async () => {
  const pricingService = createPricingService({
    loadPricingData: async () => [],
  });
  const controller = createRegistrationPricesController({ pricingService });

  const response = await controller.handleGetApi({ headers: { accept: "application/json" } });
  assert.equal(response.status, 200);

  const payload = JSON.parse(response.body);
  assert.equal(payload.status, "unavailable");
  assert.equal(payload.message, UNAVAILABLE_MESSAGE);
  assert.deepEqual(payload.categories, []);
  assert.equal(payload.message.includes("Error"), false);
  assert.equal(payload.message.includes("stack"), false);
});

test("AT-UC20-03 — Retrieval Error: Show Friendly Error (Extension 3b)", async () => {
  const loggerEntries = [];
  const pricingService = createPricingService({
    loadPricingData: async () => {
      throw new Error("DB read failed");
    },
    logger: {
      error(code, error) {
        loggerEntries.push({ code, message: error && error.message });
      },
    },
  });
  const controller = createRegistrationPricesController({ pricingService });

  const response = await controller.handleGetApi({ headers: { accept: "application/json" } });
  assert.equal(response.status, 503);

  const payload = JSON.parse(response.body);
  assert.equal(payload.message, RETRIEVAL_ERROR_MESSAGE);
  assert.equal(payload.message.includes("DB"), false);
  assert.equal(payload.message.includes("stack"), false);
  assert.deepEqual(loggerEntries, [{ code: "pricing_retrieval_failed", message: "DB read failed" }]);
});

test("AT-UC20-04 — Category View/Filter Works (Extension 4a, If Supported)", async () => {
  const { server } = createAppServer({
    pricingService: createPricingService({
      loadPricingData: async () => [
        { name: "Student", amount: 100, active: true, order: 1 },
        { name: "Regular", amount: 200, active: true, order: 2 },
      ],
    }),
  });

  const page = await injectRequest(server, {
    method: "GET",
    path: "/registration-prices",
    headers: { host: "localhost", accept: "text/html" },
  });

  assert.equal(page.status, 200);
  assert.equal(page.body.includes("filter"), false);
  assert.equal(page.body.includes("category-filter"), false);

  const api = await injectRequest(server, {
    method: "GET",
    path: "/api/registration-prices",
    headers: { host: "localhost", accept: "application/json" },
  });
  const payload = parseJson(api);
  assert.equal(payload.status, "ok");
  assert.deepEqual(
    payload.categories.map((entry) => entry.name),
    ["Student", "Regular"]
  );
});

test("AT-UC20-05 — Public Access Without Login", async () => {
  const { server } = createAppServer({
    pricingService: createPricingService({
      loadPricingData: async () => [{ name: "Regular", amount: 200, active: true, order: 1 }],
    }),
  });

  const response = await injectRequest(server, {
    method: "GET",
    path: "/registration-prices",
    headers: { host: "localhost", accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Conference Registration Prices"), true);
  assert.equal(response.body.toLowerCase().includes("login"), false);
});

test("AT-UC20-06 — Data Integrity: Displayed Prices Match Stored Values", async () => {
  const pricingService = createPricingService({
    loadPricingData: async () => [
      { name: "Regular", amount: 200, active: true, order: 1 },
      { name: "Student", amount: 100, active: true, order: 2 },
    ],
  });
  const controller = createRegistrationPricesController({ pricingService });

  const response = await controller.handleGetApi({ headers: { accept: "application/json" } });
  const payload = JSON.parse(response.body);

  const regular = payload.categories.find((entry) => entry.name === "Regular");
  assert.equal(Boolean(regular), true);
  assert.equal(regular.amount, 200);
  assert.equal(regular.display_amount, "$200.00");
});

test("AT-UC20-07 — Inactive Categories Hidden", async () => {
  const pricingService = createPricingService({
    loadPricingData: async () => [
      { name: "Regular", amount: 200, active: true, order: 1 },
      { name: "VIP", amount: 500, active: false, order: 2 },
    ],
  });
  const controller = createRegistrationPricesController({ pricingService });

  const response = await controller.handleGetApi({ headers: { accept: "application/json" } });
  const payload = JSON.parse(response.body);

  assert.equal(payload.status, "ok");
  assert.deepEqual(
    payload.categories.map((entry) => entry.name),
    ["Regular"]
  );
  assert.equal(payload.categories.some((entry) => entry.name === "VIP"), false);
});

test("AT-UC20-08 — Category Without Price Shows 'Not available'", async () => {
  const pricingService = createPricingService({
    loadPricingData: async () => [
      { name: "Regular", amount: 200, active: true, order: 1 },
      { name: "Student", amount: null, active: true, order: 2 },
    ],
  });

  const response = await createRegistrationPricesController({ pricingService }).handleGetApi({
    headers: { accept: "application/json" },
  });
  const payload = JSON.parse(response.body);

  const student = payload.categories.find((entry) => entry.name === "Student");
  assert.equal(Boolean(student), true);
  assert.equal(student.display_amount, "Not available");
});

test("AT-UC20-09 — No Active Categories With Prices", async () => {
  const pricingService = createPricingService({
    loadPricingData: async () => [
      { name: "Inactive VIP", amount: 500, active: false, order: 1 },
      { name: "Student", amount: null, active: true, order: 2 },
    ],
  });

  const response = await createRegistrationPricesController({ pricingService }).handleGetApi({
    headers: { accept: "application/json" },
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(payload.status, "unavailable");
  assert.equal(payload.message, UNAVAILABLE_MESSAGE);
  assert.deepEqual(payload.categories, []);
});

test("AT-UC20-10 — English-Only Labels and Messages", async () => {
  const fakeDocument = createFakeDocument();
  const list = fakeDocument.elements.get("pricing-list");
  const empty = fakeDocument.elements.get("pricing-empty");

  global.document = fakeDocument;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        status: "ok",
        categories: [
          { name: "Regular", display_amount: "$200.00" },
          { name: "Student", display_amount: "Not available" },
        ],
      };
    },
  });

  const viewPath = require.resolve("../../src/views/registration-prices.js");
  delete require.cache[viewPath];
  require(viewPath);
  await flushUi();

  assert.equal(list.hidden, false);
  assert.equal(list.innerHTML.includes("Regular"), true);
  assert.equal(list.innerHTML.includes("Student"), true);
  assert.equal(list.innerHTML.includes("Not available"), true);
  assert.equal(empty.textContent === "" || empty.textContent === UNAVAILABLE_MESSAGE, true);

  const pricingService = createPricingService({
    loadPricingData: async () => [],
  });
  const controller = createRegistrationPricesController({ pricingService });
  const unavailable = await controller.handleGetApi({ headers: { accept: "application/json" } });
  const unavailablePayload = JSON.parse(unavailable.body);
  assert.equal(unavailablePayload.message, "Pricing is not available.");

  const retrievalFailureService = createPricingService({
    loadPricingData: async () => {
      throw new Error("db");
    },
  });
  const failureController = createRegistrationPricesController({ pricingService: retrievalFailureService });
  const failed = await failureController.handleGetApi({ headers: { accept: "application/json" } });
  const failedPayload = JSON.parse(failed.body);
  assert.equal(failedPayload.message, "Unable to retrieve pricing. Please try again shortly.");

  delete global.document;
  delete global.fetch;
});
