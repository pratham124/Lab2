const test = require("node:test");
const assert = require("node:assert/strict");

function freshRequire(path) {
  const resolved = require.resolve(path);
  delete require.cache[resolved];
  return require(path);
}

test("UC-19 models: error and published schedule helpers normalize and default fields", () => {
  const { createErrorMessage } = require("../../src/models/error_message");
  const {
    createPublishedSchedule,
    createScheduleEntry,
    createTimeSlot,
    createLocation,
  } = require("../../src/models/schedule");

  const error = createErrorMessage({ message: "  retry later  ", canRetry: 1 });
  assert.deepEqual(error, { message: "retry later", canRetry: true });
  assert.deepEqual(createErrorMessage(), { message: "", canRetry: false });

  assert.deepEqual(createTimeSlot({ startTime: " 10:00 ", endTime: " 11:00 " }), {
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.deepEqual(createLocation({ name: " Room A " }), { name: "Room A" });

  const entry = createScheduleEntry({
    id: " s1 ",
    title: " Session 1 ",
    timeSlot: { startTime: "09:00", endTime: "10:00" },
    location: { name: " Hall " },
    day: " 2026-04-10 ",
    session: " trackA ",
  });
  assert.equal(entry.id, "s1");
  assert.equal(entry.title, "Session 1");
  assert.equal(entry.location.name, "Hall");
  const fallbackEntry = createScheduleEntry({ id: "x", title: "y" });
  assert.deepEqual(fallbackEntry.timeSlot, { startTime: "", endTime: "" });
  assert.deepEqual(fallbackEntry.location, { name: "" });

  const published = createPublishedSchedule({
    id: " pub1 ",
    status: "",
    entries: [entry],
    publishedAt: " 2026-02-01T00:00:00.000Z ",
  });
  assert.equal(published.id, "pub1");
  assert.equal(published.status, "published");
  assert.equal(published.entries.length, 1);
  assert.equal(published.publishedAt, "2026-02-01T00:00:00.000Z");

  const fallback = createPublishedSchedule({ entries: null });
  assert.deepEqual(fallback.entries, []);
});

test("UC-19 schedule service __test helpers cover parse/filter/completeness branches", () => {
  const { createScheduleService } = require("../../src/services/schedule_service");
  const service = createScheduleService({
    storageAdapter: {
      getSchedule() {
        return null;
      },
      saveSchedule() {
        return {};
      },
      listAcceptedPapers() {
        return [];
      },
      getSchedulingParameters() {
        return {};
      },
    },
    scheduleGenerator: {
      generate() {
        return { type: "missing_parameters", missing: ["conferenceDates"] };
      },
    },
  });

  const helpers = service.__test;
  assert.deepEqual(helpers.parseSlotId("slot_2026-04-10_10:00_11:00"), {
    day: "2026-04-10",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.deepEqual(helpers.parseSlotId("bad_slot"), { day: "", startTime: "", endTime: "" });

  const entries = helpers.toPublishedEntries({
    sessions: [
      { id: "s1", paperIds: ["P1"], roomId: "R1", timeSlotId: "slot_2026-04-10_10:00_11:00" },
      { id: "s2", paperIds: [], roomId: "R2", timeSlotId: "bad_slot", day: "DAY_2" },
    ],
  });
  assert.equal(entries[0].title, "Session: P1");
  assert.equal(entries[1].title, "Session");
  assert.equal(entries[1].day, "DAY_2");
  const entriesNoSessions = helpers.toPublishedEntries({});
  assert.deepEqual(entriesNoSessions, []);
  const entriesNonArrayPaperIds = helpers.toPublishedEntries({
    sessions: [{ id: "s3", paperIds: "bad", roomId: "R3", timeSlotId: "slot_2026-04-10_12:00_13:00" }],
  });
  assert.equal(entriesNonArrayPaperIds[0].title, "Session");

  assert.equal(
    helpers.hasCompleteEntry({
      timeSlot: { startTime: "10:00", endTime: "11:00" },
      location: { name: "R1" },
    }),
    true
  );
  assert.equal(
    helpers.hasCompleteEntry({
      timeSlot: { startTime: "10:00", endTime: "" },
      location: { name: "R1" },
    }),
    false
  );
  assert.equal(helpers.hasCompleteEntry(null), false);

  const filteredDay = helpers.applyPublishedFilters(entries, { day: "2026-04-10" });
  assert.equal(filteredDay.length, 1);
  const filteredSession = helpers.applyPublishedFilters(entries, { session: "S2" });
  assert.equal(filteredSession.length, 1);
  const filteredBothMiss = helpers.applyPublishedFilters(entries, {
    day: "2026-04-10",
    session: "s2",
  });
  assert.equal(filteredBothMiss.length, 0);
});

test("UC-19 schedule service getPublishedSchedule covers success, default conferenceId, not_published, and retrieval_failed", () => {
  const state = {
    throwRead: false,
    schedules: new Map(),
  };
  const { createScheduleService } = require("../../src/services/schedule_service");
  const service = createScheduleService({
    storageAdapter: {
      getSchedule({ conferenceId }) {
        if (state.throwRead) {
          throw new Error("READ_DOWN");
        }
        return state.schedules.get(conferenceId) || null;
      },
      saveSchedule() {
        return {};
      },
      listAcceptedPapers() {
        return [];
      },
      getSchedulingParameters() {
        return {};
      },
    },
    scheduleGenerator: {
      generate() {
        return { type: "missing_parameters", missing: [] };
      },
    },
  });

  state.schedules.set("C1", {
    id: "pub1",
    status: "published",
    publishedAt: "2026-02-01T00:00:00.000Z",
    sessions: [
      { id: "s1", paperIds: ["P1"], roomId: "R1", timeSlotId: "slot_2026-04-10_10:00_11:00" },
      { id: "s2", paperIds: ["P2"], roomId: "", timeSlotId: "slot_2026-04-10_11:00_12:00" },
    ],
  });
  const success = service.getPublishedSchedule({ conferenceId: "C1", day: "2026-04-10" });
  assert.equal(success.type, "success");
  assert.equal(success.schedule.entries.length, 1);
  assert.equal(success.schedule.status, "published");

  const successDefaultConference = service.getPublishedSchedule();
  assert.equal(successDefaultConference.type, "success");

  state.schedules.set("C2", { id: "d1", status: "generated", sessions: [] });
  const notPublished = service.getPublishedSchedule({ conferenceId: "C2" });
  assert.equal(notPublished.type, "not_published");
  assert.equal(notPublished.error.canRetry, false);
  const missingSchedule = service.getPublishedSchedule({ conferenceId: "C404" });
  assert.equal(missingSchedule.type, "not_published");

  state.throwRead = true;
  const failed = service.getPublishedSchedule({ conferenceId: "C1" });
  assert.equal(failed.type, "retrieval_failed");
  assert.equal(failed.error.canRetry, true);
});

test("UC-19 published schedule client validates dependency and builds query combinations", async () => {
  const { createPublishedScheduleClient } = require("../../src/services/schedule_service");
  assert.throws(() => createPublishedScheduleClient(), /httpClient.requestJson is required/);

  const calls = [];
  const client = createPublishedScheduleClient({
    httpClient: {
      requestJson(url) {
        calls.push(url);
        return Promise.resolve({ ok: true, status: 200, payload: {} });
      },
    },
  });

  await client.getPublishedSchedule({});
  await client.getPublishedSchedule({ day: " 2026-04-10 " });
  await client.getPublishedSchedule({ session: " s1 " });
  await client.getPublishedSchedule({ day: "2026-04-10", session: "s1" });

  assert.equal(calls[0], "/schedule/published");
  assert.equal(calls[1], "/schedule/published?day=2026-04-10");
  assert.equal(calls[2], "/schedule/published?session=s1");
  assert.equal(calls[3], "/schedule/published?day=2026-04-10&session=s1");
});

test("UC-19 http client covers parseJsonSafe and requestJson header/body branches", async () => {
  const { __test, requestJson } = freshRequire("../../src/services/http_client.js");

  const parsed = await __test.parseJsonSafe({
    async json() {
      return { ok: 1 };
    },
  });
  assert.deepEqual(parsed, { ok: 1 });

  const parsedNull = await __test.parseJsonSafe({
    async json() {
      throw new Error("bad_json");
    },
  });
  assert.equal(parsedNull, null);

  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 201,
      async json() {
        return { hello: "world" };
      },
    };
  };

  const withBody = await requestJson("/schedule/published", {
    method: "POST",
    body: { retry: true },
  });
  assert.equal(withBody.ok, true);
  assert.equal(withBody.status, 201);
  assert.equal(calls[0].options.headers.Accept, "application/json");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.equal(calls[0].options.body, JSON.stringify({ retry: true }));

  const withoutBody = await requestJson("/schedule/published", {
    headers: { "Content-Type": "application/custom" },
  });
  assert.equal(withoutBody.status, 201);
  assert.equal(calls[1].options.headers["Content-Type"], "application/custom");
  assert.equal(calls[1].options.body, undefined);

  delete global.fetch;
});

test("UC-19 http client exposes browser global when window exists", () => {
  global.window = {};
  const moduleApi = freshRequire("../../src/services/http_client.js");
  assert.equal(typeof global.window.ScheduleHttpClient.requestJson, "function");
  assert.equal(typeof moduleApi.requestJson, "function");
  delete global.window;
});

test("UC-19 schedule controller handleGetPublished covers 404/503/200 ready/no_results and page rendering", async () => {
  const { createScheduleController } = require("../../src/controllers/schedule_controller");
  const response = require("../../src/services/response_service");

  const publishedController = createScheduleController({
    scheduleService: {
      getPublishedSchedule({ conferenceId, day, session }) {
        if (conferenceId === "C404") {
          return { type: "not_published", error: { message: "No schedule", canRetry: false } };
        }
        if (conferenceId === "C503") {
          return { type: "retrieval_failed", error: { message: "Down", canRetry: true } };
        }
        if (day === "none" || session === "none") {
          return { type: "success", schedule: { status: "published", entries: [] } };
        }
        return {
          type: "success",
          schedule: {
            status: "published",
            publishedAt: "2026-02-01T00:00:00.000Z",
            entries: [{ id: "s1" }],
          },
        };
      },
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "success", schedule: {} };
      },
    },
    sessionService: { validate() { return null; } },
    authService: {
      requireAdmin() {
        return { ok: true, actor: { id: "a1" } };
      },
    },
    response,
  });

  const r404 = await publishedController.handleGetPublished({ query: { conferenceId: "C404" } });
  assert.equal(r404.status, 404);
  const r503 = await publishedController.handleGetPublished({ query: { conferenceId: "C503" } });
  assert.equal(r503.status, 503);

  const ready = await publishedController.handleGetPublished({ query: { conferenceId: "C1" } });
  assert.equal(ready.status, 200);
  const readyPayload = JSON.parse(ready.body);
  assert.equal(readyPayload.viewState, "ready");
  assert.equal(readyPayload.publishedAt, "2026-02-01T00:00:00.000Z");

  const noResults = await publishedController.handleGetPublished({
    query: { conferenceId: " C1 ", day: "none" },
  });
  assert.equal(noResults.status, 200);
  assert.equal(JSON.parse(noResults.body).viewState, "no_results");

  const fallbackConferenceId = await publishedController.handleGetPublished({ query: {} });
  assert.equal(fallbackConferenceId.status, 200);
  const noArgs = await publishedController.handleGetPublished();
  assert.equal(noArgs.status, 200);

  const fallbackPayloadController = createScheduleController({
    scheduleService: {
      getPublishedSchedule() {
        return { type: "success" };
      },
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "success", schedule: {} };
      },
    },
    sessionService: { validate() { return null; } },
    authService: {
      requireAdmin() {
        return { ok: true, actor: { id: "a1" } };
      },
    },
    response,
  });
  const fallbackPayload = await fallbackPayloadController.handleGetPublished({ query: { conferenceId: "C1" } });
  assert.equal(fallbackPayload.status, 200);
  const fallbackPayloadJson = JSON.parse(fallbackPayload.body);
  assert.equal(fallbackPayloadJson.viewState, "no_results");
  assert.equal(fallbackPayloadJson.status, "published");
  assert.deepEqual(fallbackPayloadJson.entries, []);

  const page = await publishedController.handleGetPublishedPage();
  assert.equal(page.status, 200);
  assert.equal(page.headers["Content-Type"], "text/html");
});

test("UC-19 schedule controller normalize and payload fallbacks for status/entries", async () => {
  const { createScheduleController } = require("../../src/controllers/schedule_controller");
  const controller = createScheduleController({
    scheduleService: {
      getPublishedSchedule() {
        return {
          type: "success",
          schedule: {
            status: "",
            entries: null,
            publishedAt: "",
          },
        };
      },
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "success", schedule: {} };
      },
    },
    sessionService: { validate() { return null; } },
    authService: {
      requireAdmin() {
        return { ok: true, actor: { id: "a1" } };
      },
    },
    response: require("../../src/services/response_service"),
  });

  const response = await controller.handleGetPublished({ query: { conferenceId: "   " } });
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.status, "published");
  assert.deepEqual(payload.entries, []);
  assert.equal(payload.viewState, "ready");
});

test("UC-19 schedule controller normalize handles empty-string conferenceId", async () => {
  const { createScheduleController } = require("../../src/controllers/schedule_controller");
  const seen = [];
  const controller = createScheduleController({
    scheduleService: {
      getPublishedSchedule({ conferenceId }) {
        seen.push(conferenceId);
        return { type: "not_published", error: { message: "No schedule", canRetry: false } };
      },
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "success", schedule: {} };
      },
    },
    sessionService: { validate() { return null; } },
    authService: {
      requireAdmin() {
        return { ok: true, actor: { id: "a1" } };
      },
    },
    response: require("../../src/services/response_service"),
  });

  const response = await controller.handleGetPublished({ query: { conferenceId: "" } });
  assert.equal(response.status, 404);
  assert.equal(seen[0], "");
});

test("UC-19 schedule service not_published branch when schedule exists without status", () => {
  const { createScheduleService } = require("../../src/services/schedule_service");
  const service = createScheduleService({
    storageAdapter: {
      getSchedule({ conferenceId }) {
        if (conferenceId === "C1") {
          return { id: "s1", sessions: [] };
        }
        return null;
      },
      saveSchedule() {
        return {};
      },
      listAcceptedPapers() {
        return [];
      },
      getSchedulingParameters() {
        return {};
      },
    },
    scheduleGenerator: {
      generate() {
        return { type: "missing_parameters", missing: [] };
      },
    },
  });

  const result = service.getPublishedSchedule({ conferenceId: "C1" });
  assert.equal(result.type, "not_published");
  assert.equal(result.error.canRetry, false);
});
