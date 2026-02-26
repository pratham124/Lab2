const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");
const { createPricingService } = require("../../src/services/pricing-service");

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

function parseJson(response) {
  return JSON.parse(response.body);
}

test("UC-20 integration happy path: public page and API return active categories with formatted values", async () => {
  const { server } = createAppServer({
    pricingService: createPricingService({
      loadPricingData: async () => [
        { name: "Regular", amount: 200, active: true, order: 1 },
        { name: "Student", amount: 100, active: true, order: 2 },
        { name: "Workshop", amount: null, active: true, order: 3 },
        { name: "VIP", amount: 500, active: false, order: 4 },
      ],
    }),
  });

  const page = await injectRequest(server, {
    method: "GET",
    path: "/registration-prices",
    headers: { host: "localhost", accept: "text/html" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("Conference Registration Prices"), true);
  assert.equal(page.body.toLowerCase().includes("login"), false);

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
      ["Workshop", "Not available"],
    ]
  );
  assert.equal(payload.categories.some((entry) => entry.name === "VIP"), false);
});

test("UC-20 integration invalid input path: unsupported method is rejected safely", async () => {
  const { server } = createAppServer();

  const response = await injectRequest(server, {
    method: "POST",
    path: "/api/registration-prices",
    headers: {
      host: "localhost",
      accept: "application/json",
      "content-type": "application/json",
    },
  }, JSON.stringify({ bad: true }));

  assert.equal(response.status, 404);
  assert.equal(response.body, "Not found");
});

test("UC-20 integration expected failure path: no pricing defined returns unavailable state", async () => {
  const { server } = createAppServer({
    pricingService: createPricingService({
      loadPricingData: async () => [],
    }),
  });

  const response = await injectRequest(server, {
    method: "GET",
    path: "/api/registration-prices",
    headers: { host: "localhost", accept: "application/json" },
  });

  assert.equal(response.status, 200);
  const payload = parseJson(response);
  assert.equal(payload.status, "unavailable");
  assert.equal(payload.message, "Pricing is not available.");
  assert.deepEqual(payload.categories, []);
});

test("UC-20 integration expected failure path: no active priced categories returns unavailable state", async () => {
  const { server } = createAppServer({
    pricingService: createPricingService({
      loadPricingData: async () => [
        { name: "Inactive VIP", amount: 500, active: false, order: 1 },
        { name: "Student", amount: null, active: true, order: 2 },
      ],
    }),
  });

  const response = await injectRequest(server, {
    method: "GET",
    path: "/api/registration-prices",
    headers: { host: "localhost", accept: "application/json" },
  });

  assert.equal(response.status, 200);
  const payload = parseJson(response);
  assert.equal(payload.status, "unavailable");
  assert.equal(payload.message, "Pricing is not available.");
  assert.deepEqual(payload.categories, []);
});

test("UC-20 integration expected failure path: retrieval/service failure returns 503 with safe message", async () => {
  const loggerCalls = [];
  const { server } = createAppServer({
    pricingService: createPricingService({
      loadPricingData: async () => {
        throw new Error("DB_READ_FAILURE");
      },
      logger: {
        error(code, error) {
          loggerCalls.push({ code, message: error.message });
        },
      },
    }),
  });

  const response = await injectRequest(server, {
    method: "GET",
    path: "/api/registration-prices",
    headers: { host: "localhost", accept: "application/json" },
  });

  assert.equal(response.status, 503);
  const payload = parseJson(response);
  assert.equal(payload.message, "Unable to retrieve pricing. Please try again shortly.");
  assert.equal(response.body.includes("DB_READ_FAILURE"), false);
  assert.equal(response.body.toLowerCase().includes("stack"), false);
  assert.deepEqual(loggerCalls, [{ code: "pricing_retrieval_failed", message: "DB_READ_FAILURE" }]);
});
