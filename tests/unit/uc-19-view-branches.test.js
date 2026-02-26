const test = require("node:test");
const assert = require("node:assert/strict");

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

function createFakeDom(ids = []) {
  const elements = new Map(ids.map((id) => [id, new FakeElement("div", id)]));
  return {
    elements,
    document: {
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
        return null;
      },
    },
  };
}

async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function flushMany(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await flushAsync();
  }
}

function loadViewModule() {
  const viewPath = require.resolve("../../src/views/schedule_view.js");
  delete require.cache[viewPath];
  require(viewPath);
}

test("UC-19 view branch: returns early when client missing and tolerates missing panels/list", async () => {
  const { document } = createFakeDom([
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);
  global.document = document;
  global.window = {};

  loadViewModule();
  await flushAsync();

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: renderEntries returns early when schedule-list is missing", async () => {
  const { document } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        return {
          status: 200,
          payload: {
            entries: [
              {
                id: "s1",
                title: "Has entry",
                timeSlot: { startTime: "10:00", endTime: "11:00" },
                location: { name: "R1" },
              },
            ],
          },
        };
      },
    },
  };

  loadViewModule();
  await flushAsync();

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: setVisible handles missing schedule-state element", async () => {
  const { document, elements } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        return {
          status: 200,
          payload: {
            entries: [
              {
                id: "s1",
                title: "Visible entry",
                timeSlot: { startTime: "10:00", endTime: "11:00" },
                location: { name: "R1" },
              },
            ],
          },
        };
      },
    },
  };

  loadViewModule();
  await flushAsync();
  assert.equal(elements.get("schedule-list").children.length, 1);

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: default title, missing time fields, and payload fallback branches", async () => {
  const { document, elements } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);

  const responses = [
    {
      status: 200,
      payload: {
        entries: [
          {
            id: "bad-start",
            title: "Bad Start",
            timeSlot: { endTime: "11:00" },
            location: { name: "R1" },
          },
          {
            id: "bad-end",
            title: "Bad End",
            timeSlot: { startTime: "10:00" },
            location: { name: "R1" },
          },
          {
            id: "ok-default-title",
            title: "",
            timeSlot: { startTime: "12:00", endTime: "13:00" },
            location: { name: "R2" },
          },
        ],
      },
    },
    { status: 200 },
  ];
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        return responses.shift() || { status: 200, payload: { entries: [] } };
      },
    },
  };

  loadViewModule();
  await flushAsync();
  const list = elements.get("schedule-list");
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].innerHTML.includes("Session"), true);

  elements.get("apply-filters").click();
  await flushAsync();
  assert.equal(elements.get("empty-state").isHidden, false);

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: uses provided 404 and 503 messages", async () => {
  const { document, elements } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);
  const responses = [
    { status: 404, payload: { message: "Custom unpublished message" } },
    { status: 503, payload: { message: "Custom unavailable message", canRetry: false } },
  ];
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        return responses.shift() || { status: 200, payload: { entries: [] } };
      },
    },
  };

  loadViewModule();
  await flushAsync();
  assert.equal(elements.get("unpublished-state").textContent, "Custom unpublished message");

  elements.get("apply-filters").click();
  await flushAsync();
  assert.equal(elements.get("error-state").innerHTML.includes("Custom unavailable message"), true);

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: 503 default message and success render path execute", async () => {
  const { document, elements } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);

  const responses = [
    { status: 503, payload: {} },
    {
      status: 200,
      payload: {
        entries: [
          {
            id: "s1",
            title: "Rendered",
            timeSlot: { startTime: "10:00", endTime: "11:00" },
            location: { name: "R1" },
          },
        ],
      },
    },
  ];
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        return responses.shift() || { status: 200, payload: { entries: [] } };
      },
    },
  };

  loadViewModule();
  await flushAsync();
  assert.equal(elements.get("error-state").innerHTML.includes("Schedule unavailable."), true);

  elements.get("apply-filters").click();
  await flushAsync();
  assert.equal(elements.get("schedule-list").children.length, 1);
  assert.equal(elements.get("schedule-list").children[0].innerHTML.includes("Rendered"), true);

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: initial successful load executes renderEntries path", async () => {
  const { document, elements } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);

  let calls = 0;
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson() {
        calls += 1;
        return {
          status: 200,
          payload: {
            entries: [
              {
                id: "s-init",
                title: "Initial Entry",
                timeSlot: { startTime: "09:00", endTime: "10:00" },
                location: { name: "R1" },
                day: "2026-04-10",
                session: "session_1",
              },
            ],
          },
        };
      },
    },
  };

  loadViewModule();
  await flushMany();

  assert.equal(calls, 1);
  assert.equal(elements.get("schedule-list").children.length, 1);
  assert.equal(elements.get("schedule-list").children[0].innerHTML.includes("Initial Entry"), true);

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: 404 fallback message and session query branch are used", async () => {
  const { document, elements } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);
  const calls = [];
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson(url) {
        calls.push(url);
        return { status: 404, payload: null };
      },
    },
  };

  elements.get("session-filter").value = "session_42";
  loadViewModule();
  await flushAsync();
  elements.get("apply-filters").click();
  await flushAsync();

  const unpublished = elements.get("unpublished-state");
  assert.equal(unpublished.isHidden, false);
  assert.equal(unpublished.textContent, "Schedule is not published yet.");
  assert.equal(calls.some((url) => url.includes("session=session_42")), true);

  delete global.document;
  delete global.window;
});

test("UC-19 view branch: reset-filters button triggers reset branch and empty-state reset works", async () => {
  const { document, elements } = createFakeDom([
    "error-state",
    "unpublished-state",
    "empty-state",
    "schedule-state",
    "schedule-list",
    "day-filter",
    "session-filter",
    "apply-filters",
    "reset-filters",
  ]);
  const calls = [];
  global.document = document;
  global.window = {
    ScheduleHttpClient: {
      async requestJson(url) {
        calls.push(url);
        if (url.includes("day=2099-01-01")) {
          return { status: 200, payload: { entries: [] } };
        }
        return {
          status: 200,
          payload: {
            entries: [
              {
                id: "s1",
                title: "Restored",
                timeSlot: { startTime: "10:00", endTime: "11:00" },
                location: { name: "R1" },
                day: "2026-04-10",
                session: "session_1",
              },
            ],
          },
        };
      },
    },
  };

  elements.get("day-filter").value = "2099-01-01";
  elements.get("session-filter").value = "session_x";
  loadViewModule();
  await flushAsync();

  elements.get("apply-filters").click();
  await flushAsync();
  const resetEmpty = document.getElementById("reset-empty");
  assert.equal(Boolean(resetEmpty), true);

  elements.get("reset-filters").click();
  await flushAsync();
  assert.equal(elements.get("day-filter").value, "");
  assert.equal(elements.get("session-filter").value, "");

  resetEmpty.click();
  await flushAsync();
  assert.equal(elements.get("schedule-list").children.length > 0, true);
  assert.equal(calls.some((url) => url.includes("day=2099-01-01")), true);
  assert.equal(calls.filter((url) => url === "/schedule/published").length >= 2, true);

  delete global.document;
  delete global.window;
});
