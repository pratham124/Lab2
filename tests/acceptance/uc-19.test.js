const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");

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
    req.headers = options.headers || {};

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

function adminHeaders() {
  return {
    host: "localhost",
    cookie: "cms_session=sid_admin",
    accept: "application/json",
    "content-type": "application/json",
  };
}

function makeSessionService() {
  return {
    validate(sessionId) {
      if (sessionId === "sid_admin") {
        return { user_id: "admin_1", role: "admin" };
      }
      return null;
    },
  };
}

async function generateAndPublish(server) {
  const generated = await injectRequest(
    server,
    {
      method: "POST",
      path: "/admin/conferences/C1/schedule/generate",
      headers: adminHeaders(),
    },
    JSON.stringify({ confirmReplace: true })
  );
  assert.equal(generated.status, 200);

  const published = await injectRequest(server, {
    method: "POST",
    path: "/api/admin/schedule/publish",
    headers: {
      host: "localhost",
      cookie: "cms_session=sid_admin",
      accept: "application/json",
    },
  });
  assert.equal(published.status, 200);
}

class FakeElement {
  constructor(tagName = "div", id = "") {
    this.tagName = String(tagName).toUpperCase();
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.children = [];
    this.listeners = new Map();
    this.isHidden = false;
    this._innerHTML = "";
    this.classList = {
      toggle: (_className, force) => {
        if (typeof force === "boolean") {
          this.isHidden = force;
          return;
        }
        this.isHidden = !this.isHidden;
      },
    };
  }

  addEventListener(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(handler);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  click() {
    const handlers = this.listeners.get("click") || [];
    for (const handler of handlers) {
      handler({ target: this });
    }
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this.children = [];
    const idMatch = /id="([^"]+)"/g;
    let match = idMatch.exec(this._innerHTML);
    while (match) {
      this.children.push(new FakeElement("button", match[1]));
      match = idMatch.exec(this._innerHTML);
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

function createFakeDom() {
  const ids = [
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ];
  const elements = new Map(ids.map((id) => [id, new FakeElement("div", id)]));
  const emptyState = elements.get("empty-state");

  const document = {
    createElement(tag) {
      return new FakeElement(tag, "");
    },
    getElementById(id) {
      const existing = elements.get(id);
      if (existing) {
        return existing;
      }
      for (const element of elements.values()) {
        for (const child of element.children) {
          if (child.id === id) {
            return child;
          }
        }
      }
      if (id === "reset-empty" && emptyState) {
        return emptyState.children.find((child) => child.id === "reset-empty") || null;
      }
      return null;
    },
  };

  return { document, elements };
}

async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("AT-UC19-01 Published schedule is publicly viewable", async () => {
  const { server } = createAppServer({ sessionService: makeSessionService() });
  await generateAndPublish(server);

  const page = await injectRequest(server, {
    method: "GET",
    path: "/schedule",
    headers: { host: "localhost", accept: "text/html" },
  });
  assert.equal(page.status, 200);
  assert.equal(page.body.includes("Access denied"), false);

  const api = await injectRequest(server, {
    method: "GET",
    path: "/schedule/published",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(api.status, 200);
  const payload = parseJson(api);
  assert.equal(Array.isArray(payload.entries), true);
  assert.equal(payload.entries.length > 0, true);
  for (const entry of payload.entries) {
    assert.equal(Boolean(entry.timeSlot && entry.timeSlot.startTime && entry.timeSlot.endTime), true);
    assert.equal(Boolean(entry.location && entry.location.name), true);
  }
});

test("AT-UC19-02 Unpublished schedule shows availability message", async () => {
  const { server } = createAppServer();

  const page = await injectRequest(server, {
    method: "GET",
    path: "/schedule",
    headers: { host: "localhost", accept: "text/html" },
  });
  assert.equal(page.status, 200);

  const api = await injectRequest(server, {
    method: "GET",
    path: "/schedule/published",
    headers: { host: "localhost", accept: "application/json" },
  });
  assert.equal(api.status, 404);
  const payload = parseJson(api);
  assert.equal(typeof payload.message, "string");
  assert.equal(payload.message.length > 0, true);
  assert.equal(payload.canRetry, false);
  assert.equal(Object.hasOwn(payload, "entries"), false);
});

test("AT-UC19-03 Retrieval failure shows retry-enabled error and retries request", async () => {
  const { document, elements } = createFakeDom();
  let calls = 0;
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        calls += 1;
        return {
          status: 503,
          payload: {
            message: "Schedule is temporarily unavailable. Please try again.",
            canRetry: true,
          },
        };
      },
    },
  };

  const viewPath = require.resolve("../../src/views/schedule_view.js");
  delete require.cache[viewPath];
  require(viewPath);
  await flushAsync();

  const errorPanel = elements.get("error-state");
  assert.equal(errorPanel.isHidden, false);
  assert.equal(errorPanel.innerHTML.includes("temporarily unavailable"), true);
  const retryButton = errorPanel.children.find((child) => child.tagName === "BUTTON");
  assert.equal(Boolean(retryButton), true);
  assert.equal(calls, 1);

  retryButton.click();
  await flushAsync();
  assert.equal(calls, 2);

  delete global.document;
  delete global.window;
});

test("AT-UC19-04 Incomplete entries are hidden", async () => {
  const { document, elements } = createFakeDom();
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        return {
          status: 200,
          payload: {
            status: "published",
            entries: [
              {
                id: "s1",
                title: "Complete",
                timeSlot: { startTime: "10:00", endTime: "11:00" },
                location: { name: "Room R1" },
                day: "2026-04-10",
                session: "session_1",
              },
              {
                id: "s2",
                title: "Missing Location",
                timeSlot: { startTime: "11:00", endTime: "12:00" },
                location: { name: "" },
                day: "2026-04-10",
                session: "session_2",
              },
            ],
          },
        };
      },
    },
  };

  const viewPath = require.resolve("../../src/views/schedule_view.js");
  delete require.cache[viewPath];
  require(viewPath);
  await flushAsync();

  const list = elements.get("schedule-list");
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].innerHTML.includes("Complete"), true);

  delete global.document;
  delete global.window;
});

test("AT-UC19-05 Optional filters return no-results state and reset restores results", async () => {
  const { document, elements } = createFakeDom();
  const requests = [];
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson(url) {
        requests.push(url);
        if (url.includes("day=2099-01-01")) {
          return { status: 200, payload: { status: "published", entries: [] } };
        }
        return {
          status: 200,
          payload: {
            status: "published",
            entries: [
              {
                id: "s1",
                title: "Restored",
                timeSlot: { startTime: "10:00", endTime: "11:00" },
                location: { name: "Room R1" },
                day: "2026-04-10",
                session: "session_1",
              },
            ],
          },
        };
      },
    },
  };

  const viewPath = require.resolve("../../src/views/schedule_view.js");
  delete require.cache[viewPath];
  require(viewPath);
  await flushAsync();

  elements.get("day-filter").value = "2099-01-01";
  elements.get("apply-filters").click();
  await flushAsync();

  const emptyState = elements.get("empty-state");
  assert.equal(emptyState.isHidden, false);
  const resetButton = document.getElementById("reset-empty");
  assert.equal(Boolean(resetButton), true);
  resetButton.click();
  await flushAsync();

  const list = elements.get("schedule-list");
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].innerHTML.includes("Restored"), true);
  assert.equal(requests.some((url) => url.includes("day=2099-01-01")), true);
  assert.equal(requests.filter((url) => url === "/schedule/published").length >= 2, true);

  delete global.document;
  delete global.window;
});
