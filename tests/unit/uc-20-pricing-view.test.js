const test = require("node:test");
const assert = require("node:assert/strict");

function makeElement(id) {
  return {
    id,
    hidden: false,
    textContent: "",
    innerHTML: "",
  };
}

function createDocument({ readyState = "complete", missingIds = [] } = {}) {
  const ids = ["pricing-loading", "pricing-empty", "pricing-error", "pricing-list"];
  const elements = new Map(ids.map((id) => [id, makeElement(id)]));
  for (const id of missingIds) {
    elements.delete(id);
  }

  const listeners = new Map();
  return {
    readyState,
    getElementById(id) {
      return elements.get(id) || null;
    },
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    trigger(name) {
      const handler = listeners.get(name);
      if (typeof handler === "function") {
        handler();
      }
    },
    elements,
  };
}

async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function loadViewScriptWith({ document, fetchImpl }) {
  global.document = document;
  global.fetch = fetchImpl;
  const viewPath = require.resolve("../../src/views/registration-prices.js");
  delete require.cache[viewPath];
  require(viewPath);
}

function cleanupGlobals() {
  delete global.document;
  delete global.fetch;
}

test("registration prices view renders successful category list", async () => {
  const doc = createDocument();
  loadViewScriptWith({
    document: doc,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          status: "ok",
          categories: [
            { name: "<Regular>", display_amount: "$200.00" },
            { name: "Student", display_amount: "Not available" },
          ],
        };
      },
    }),
  });

  await flushAsync();

  const list = doc.getElementById("pricing-list");
  const loading = doc.getElementById("pricing-loading");
  const empty = doc.getElementById("pricing-empty");
  const error = doc.getElementById("pricing-error");

  assert.equal(loading.hidden, true);
  assert.equal(empty.hidden, true);
  assert.equal(error.hidden, true);
  assert.equal(list.hidden, false);
  assert.equal(list.innerHTML.includes("&lt;Regular&gt;"), true);

  cleanupGlobals();
});

test("registration prices view escapes missing category fields safely", async () => {
  const doc = createDocument();
  loadViewScriptWith({
    document: doc,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          status: "ok",
          categories: [{ name: null, display_amount: undefined }],
        };
      },
    }),
  });

  await flushAsync();

  const list = doc.getElementById("pricing-list");
  assert.equal(list.hidden, false);
  assert.equal(list.innerHTML.includes("undefined"), false);
  assert.equal(list.innerHTML.includes("null"), false);

  cleanupGlobals();
});

test("registration prices view handles unavailable and empty categories states", async () => {
  const unavailableDoc = createDocument();
  loadViewScriptWith({
    document: unavailableDoc,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { status: "unavailable", message: "Pricing is not available." };
      },
    }),
  });
  await flushAsync();
  assert.equal(unavailableDoc.getElementById("pricing-empty").hidden, false);
  assert.equal(unavailableDoc.getElementById("pricing-empty").textContent, "Pricing is not available.");
  cleanupGlobals();

  const emptyCategoriesDoc = createDocument();
  loadViewScriptWith({
    document: emptyCategoriesDoc,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { status: "ok", categories: [] };
      },
    }),
  });
  await flushAsync();
  assert.equal(emptyCategoriesDoc.getElementById("pricing-empty").hidden, false);
  assert.equal(emptyCategoriesDoc.getElementById("pricing-empty").textContent, "Pricing is not available.");
  cleanupGlobals();

  const unavailableFallbackDoc = createDocument();
  loadViewScriptWith({
    document: unavailableFallbackDoc,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { status: "unavailable" };
      },
    }),
  });
  await flushAsync();
  assert.equal(unavailableFallbackDoc.getElementById("pricing-empty").hidden, false);
  assert.equal(unavailableFallbackDoc.getElementById("pricing-empty").textContent, "Pricing is not available.");
  cleanupGlobals();

  const nonArrayCategoriesDoc = createDocument();
  loadViewScriptWith({
    document: nonArrayCategoriesDoc,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { status: "ok", categories: null };
      },
    }),
  });
  await flushAsync();
  assert.equal(nonArrayCategoriesDoc.getElementById("pricing-empty").hidden, false);
  assert.equal(nonArrayCategoriesDoc.getElementById("pricing-empty").textContent, "Pricing is not available.");
  cleanupGlobals();
});

test("registration prices view handles non-ok responses and thrown fetch errors", async () => {
  const nonOkDoc = createDocument();
  loadViewScriptWith({
    document: nonOkDoc,
    fetchImpl: async () => ({
      ok: false,
      async json() {
        return { message: "Custom failure" };
      },
    }),
  });
  await flushAsync();
  assert.equal(nonOkDoc.getElementById("pricing-error").hidden, false);
  assert.equal(nonOkDoc.getElementById("pricing-error").textContent, "Custom failure");
  cleanupGlobals();

  const nonOkFallbackDoc = createDocument();
  loadViewScriptWith({
    document: nonOkFallbackDoc,
    fetchImpl: async () => ({
      ok: false,
      async json() {
        return {};
      },
    }),
  });
  await flushAsync();
  assert.equal(nonOkFallbackDoc.getElementById("pricing-error").hidden, false);
  assert.equal(
    nonOkFallbackDoc.getElementById("pricing-error").textContent,
    "Unable to retrieve pricing. Please try again shortly."
  );
  cleanupGlobals();

  const thrownDoc = createDocument();
  loadViewScriptWith({
    document: thrownDoc,
    fetchImpl: async () => {
      throw new Error("network");
    },
  });
  await flushAsync();
  assert.equal(thrownDoc.getElementById("pricing-error").hidden, false);
  assert.equal(
    thrownDoc.getElementById("pricing-error").textContent,
    "Unable to retrieve pricing. Please try again shortly."
  );
  cleanupGlobals();
});

test("registration prices view supports DOMContentLoaded flow and missing elements", async () => {
  const loadingDoc = createDocument({ readyState: "loading" });
  let calls = 0;
  loadViewScriptWith({
    document: loadingDoc,
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        async json() {
          return { status: "ok", categories: [{ name: "Regular", display_amount: "$200.00" }] };
        },
      };
    },
  });

  assert.equal(calls, 0);
  loadingDoc.trigger("DOMContentLoaded");
  await flushAsync();
  assert.equal(calls, 1);
  cleanupGlobals();

  const missingElementsDoc = createDocument({ missingIds: ["pricing-error", "pricing-list"] });
  loadViewScriptWith({
    document: missingElementsDoc,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { status: "unavailable", message: "Pricing is not available." };
      },
    }),
  });
  await flushAsync();
  assert.equal(missingElementsDoc.getElementById("pricing-empty").hidden, false);
  cleanupGlobals();
});
