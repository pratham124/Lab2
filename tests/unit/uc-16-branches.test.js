const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createScheduleGenerator } = require("../../src/services/schedule_generator");
const { createScheduleService } = require("../../src/services/schedule_service");
const { createScheduleController } = require("../../src/controllers/schedule_controller");
const { createAuthService } = require("../../src/services/auth_service");
const responseService = require("../../src/services/response_service");
const { createStorageAdapter } = require("../../src/services/storage_adapter");
const { createAcceptedPaper } = require("../../src/models/accepted_paper");
const { createConferenceSchedule } = require("../../src/models/conference_schedule");
const { createSchedulingParameters } = require("../../src/models/scheduling_parameters");
const { createSession } = require("../../src/models/session");
const { createTimeSlot } = require("../../src/models/time_slot");

function makeWorkingStorage() {
  const schedules = new Map();
  return {
    listAcceptedPapers() {
      return [{ id: "P1", status: "accepted" }];
    },
    getSchedulingParameters() {
      return {
        conferenceDates: ["2026-05-01"],
        sessionLengthMinutes: 60,
        dailyTimeWindow: { start: "09:00", end: "10:00" },
        availableRoomIds: ["R1"],
      };
    },
    getSchedule({ conferenceId }) {
      return schedules.get(conferenceId) || null;
    },
    saveSchedule({ conferenceId, schedule }) {
      schedules.set(conferenceId, schedule);
      return schedule;
    },
  };
}

test("UC-16 generator branches: missing params, invalid slot window, unsatisfiable, and empty papers success", () => {
  const generator = createScheduleGenerator();

  const defaultCall = generator.generate();
  assert.equal(defaultCall.type, "missing_parameters");

  const missing = generator.generate({
    conferenceId: "C1",
    acceptedPapers: [],
    parameters: {},
  });
  assert.equal(missing.type, "missing_parameters");
  assert.equal(missing.missing.includes("conferenceDates"), true);
  assert.equal(missing.missing.includes("sessionLengthMinutes"), true);
  assert.equal(missing.missing.includes("dailyTimeWindow"), true);
  assert.equal(missing.missing.includes("availableRoomIds"), true);

  const invalidWindow = generator.generate({
    conferenceId: "C1",
    acceptedPapers: [{ id: "P1", status: "accepted" }],
    parameters: {
      conferenceDates: ["2026-05-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "10:00", end: "09:00" },
      availableRoomIds: ["R1"],
    },
  });
  assert.equal(invalidWindow.type, "unsatisfiable_constraints");

  const invalidTimeFormat = generator.generate({
    conferenceId: "C1",
    acceptedPapers: [{ id: "P1", status: "accepted" }],
    parameters: {
      conferenceDates: ["2026-05-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "xx:yy", end: "10:00" },
      availableRoomIds: ["R1"],
    },
  });
  assert.equal(invalidTimeFormat.type, "unsatisfiable_constraints");

  const unsatisfiable = generator.generate({
    conferenceId: "C1",
    acceptedPapers: [
      { id: "P1", status: "accepted" },
      { id: "P2", status: "accepted" },
    ],
    parameters: {
      conferenceDates: ["2026-05-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "10:00" },
      availableRoomIds: ["R1"],
    },
  });
  assert.equal(unsatisfiable.type, "unsatisfiable_constraints");

  const emptyAcceptedList = generator.generate({
    conferenceId: "C1",
    acceptedPapers: null,
    parameters: {
      conferenceDates: ["2026-05-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "11:00" },
      availableRoomIds: ["R1"],
    },
    createdByAdminId: "admin_1",
  });
  assert.equal(emptyAcceptedList.type, "success");
  assert.equal(emptyAcceptedList.schedule.sessions.length, 0);

  const mixedStatuses = generator.generate({
    conferenceId: "C1",
    acceptedPapers: [
      { id: "P1", status: "accepted" },
      { id: "P2", status: "rejected" },
      { id: "P3" },
    ],
    parameters: {
      conferenceDates: ["2026-05-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "11:00" },
      availableRoomIds: ["R1", null],
    },
    createdByAdminId: "admin_1",
  });
  assert.equal(mixedStatuses.type, "success");
  assert.deepEqual(
    mixedStatuses.schedule.sessions.map((session) => session.paperIds[0]),
    ["P1"]
  );

  const sortWithMissingIds = generator.generate({
    conferenceId: "C1",
    acceptedPapers: [
      { id: "", status: "accepted" },
      { status: "accepted" },
    ],
    parameters: {
      conferenceDates: ["2026-05-01"],
      sessionLengthMinutes: 60,
      dailyTimeWindow: { start: "09:00", end: "11:00" },
      availableRoomIds: ["R1"],
    },
    createdByAdminId: "admin_1",
  });
  assert.equal(sortWithMissingIds.type, "success");
  assert.equal(sortWithMissingIds.schedule.sessions.length, 2);
});

test("UC-16 service branches: constructor errors, has/get, passthrough and save paths", () => {
  const generator = createScheduleGenerator();
  assert.throws(() => createScheduleService({ scheduleGenerator: generator }), /storageAdapter is required/);
  assert.throws(() => createScheduleService({ storageAdapter: makeWorkingStorage() }), /scheduleGenerator is required/);

  const storage = makeWorkingStorage();
  const service = createScheduleService({ storageAdapter: storage, scheduleGenerator: generator });

  assert.equal(service.hasSchedule({ conferenceId: "C1" }), false);
  assert.equal(service.getSchedule({ conferenceId: "C1" }).type, "not_found");

  const generated = service.generateSchedule({
    conferenceId: "C1",
    confirmReplace: false,
    createdByAdminId: "admin_1",
  });
  assert.equal(generated.type, "success");
  assert.equal(service.hasSchedule({ conferenceId: "C1" }), true);
  assert.equal(service.getSchedule({ conferenceId: "C1" }).type, "success");

  const conflict = service.generateSchedule({ conferenceId: "C1", confirmReplace: false });
  assert.equal(conflict.type, "confirm_replace_required");

  const passthroughService = createScheduleService({
    storageAdapter: {
      getSchedule() {
        return null;
      },
      listAcceptedPapers() {
        return [];
      },
      getSchedulingParameters() {
        return {};
      },
      saveSchedule() {
        return {};
      },
    },
    scheduleGenerator: {
      generate() {
        return { type: "missing_parameters", missing: ["conferenceDates"] };
      },
    },
  });
  const passthrough = passthroughService.generateSchedule({ conferenceId: "C1" });
  assert.equal(passthrough.type, "missing_parameters");

  const failingSaveService = createScheduleService({
    storageAdapter: {
      getSchedule() {
        return null;
      },
      listAcceptedPapers() {
        return [];
      },
      getSchedulingParameters() {
        return {
          conferenceDates: ["2026-05-01"],
          sessionLengthMinutes: 60,
          dailyTimeWindow: { start: "09:00", end: "10:00" },
          availableRoomIds: ["R1"],
        };
      },
      saveSchedule() {
        throw new Error("boom");
      },
    },
    scheduleGenerator: {
      generate() {
        return { type: "success", schedule: { id: "s1", sessions: [] } };
      },
    },
  });
  const saveFail = failingSaveService.generateSchedule({ conferenceId: "C1", confirmReplace: true });
  assert.equal(saveFail.type, "save_failed");
});

test("UC-16 auth service branches: cookies, fallback actor, and admin checks", () => {
  const service = createAuthService({
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_admin") {
          return { user_id: "u_admin", role: " Admin User " };
        }
        if (sessionId === "sid_author") {
          return { user_id: "u_author", role: "author" };
        }
        return null;
      },
    },
  });

  const cookies = service.parseCookies({ cookie: "a=1; flag; b=two" });
  assert.equal(cookies.a, "1");
  assert.equal(cookies.flag, "");
  assert.equal(cookies.b, "two");
  assert.equal(service.normalizeRole("  Program Chair "), "program_chair");

  const actorFromSession = service.resolveActor({ cookie: "cms_session=sid_admin" });
  assert.deepEqual(actorFromSession, { id: "u_admin", role: "admin_user" });

  const actorFromFallback = service.resolveActor({
    cookie: "cms_session=missing",
    "x-user-id": " u1 ",
    "x-user-role": " Admin ",
  });
  assert.deepEqual(actorFromFallback, { id: "u1", role: "admin" });

  const noActor = service.resolveActor({ cookie: "cms_session=missing" });
  assert.equal(noActor, null);

  const emptyHeadersCookies = service.parseCookies();
  assert.deepEqual(emptyHeadersCookies, {});
  assert.equal(service.normalizeRole(), "");

  assert.equal(service.requireAdmin({ cookie: "cms_session=missing" }).status, 401);
  assert.equal(service.requireAdmin({ cookie: "cms_session=sid_author" }).status, 403);
  assert.equal(service.requireAdmin({ cookie: "cms_session=sid_admin" }).ok, false);

  const sessionMissingUser = createAuthService({
    sessionService: {
      validate() {
        return { role: "admin" };
      },
    },
  });
  const missingIdActor = sessionMissingUser.resolveActor({ cookie: "cms_session=any" });
  assert.deepEqual(missingIdActor, { id: "", role: "admin" });

  const pureFallbackAuth = createAuthService();
  const fallbackAdmin = pureFallbackAuth.requireAdmin({
    "x-user-id": "u2",
    "x-user-role": "admin",
  });
  assert.equal(fallbackAdmin.ok, true);
  assert.equal(fallbackAdmin.actor.id, "u2");

  const validateCalls = [];
  const missingCookieAuth = createAuthService({
    sessionService: {
      validate(sessionId) {
        validateCalls.push(sessionId);
        return null;
      },
    },
  });
  missingCookieAuth.resolveActor({});
  assert.deepEqual(validateCalls, [""]);
});

test("UC-16 response service branches: json/html/render/accessDenied", () => {
  const json = responseService.json(201, { ok: true });
  assert.equal(json.status, 201);
  assert.equal(JSON.parse(json.body).ok, true);

  const html = responseService.html(202, "<p>ok</p>");
  assert.equal(html.status, 202);
  assert.equal(html.headers["Content-Type"], "text/html");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc16-render-"));
  const templatePath = path.join(tempDir, "template.html");
  try {
    fs.writeFileSync(templatePath, "Hi {{name}} from {{place}}", "utf8");
    const rendered = responseService.renderView({
      templatePath,
      replacements: { name: "Alice", place: "Lab2" },
    });
    assert.equal(rendered, "Hi Alice from Lab2");

    const renderedNoReplacements = responseService.renderView({
      templatePath,
    });
    assert.equal(renderedNoReplacements, "Hi {{name}} from {{place}}");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const denied = responseService.accessDenied();
  assert.equal(denied.status, 403);
  assert.equal(JSON.parse(denied.body).errorCode, "access_denied");
});

test("UC-16 storage adapter branches: defaults, filtering, lookups, save and save failure", () => {
  const adapterNoArgs = createStorageAdapter();
  assert.equal(Array.isArray(adapterNoArgs.listAcceptedPapers({ conferenceId: "C1" })), true);

  const emptyState = {};
  const defaultAdapter = createStorageAdapter({ store: emptyState });
  assert.equal(defaultAdapter.listAcceptedPapers({ conferenceId: "C1" }).length > 0, true);
  assert.deepEqual(defaultAdapter.listAcceptedPapers({ conferenceId: "missing" }), []);
  assert.deepEqual(defaultAdapter.listAcceptedPapers(), []);
  assert.equal(defaultAdapter.getSchedulingParameters({}), null);
  assert.equal(defaultAdapter.getSchedule({}), null);
  assert.equal(defaultAdapter.getSchedulingParameters({ conferenceId: "missing" }), null);
  assert.equal(defaultAdapter.getSchedule({ conferenceId: "C1" }), null);

  const state = {
    acceptedPapersByConference: new Map([
      ["C1", [
        { id: "A", status: "accepted" },
        { id: "B", status: "REJECTED" },
        { id: "C" },
      ]],
    ]),
    schedulingParametersByConference: new Map([["C1", { x: 1 }]]),
    scheduleByConference: new Map(),
  };

  const adapter = createStorageAdapter({ store: state });
  const filtered = adapter.listAcceptedPapers({ conferenceId: "C1" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "A");

  const saved = adapter.saveSchedule({ conferenceId: " C1 ", schedule: { id: "s1" } });
  assert.equal(saved.id, "s1");
  assert.deepEqual(adapter.getSchedule({ conferenceId: "C1" }), { id: "s1" });
  assert.deepEqual(adapter.saveSchedule({ schedule: { id: "s_empty_key" } }), { id: "s_empty_key" });
  assert.deepEqual(adapter.getSchedule({ conferenceId: "" }), { id: "s_empty_key" });

  state.failScheduleSave = true;
  assert.throws(() => adapter.saveSchedule({ conferenceId: "C1", schedule: { id: "s2" } }), /schedule_save_failed/);
});

test("UC-16 model constructors cover default and normalization branches", () => {
  const accepted = createAcceptedPaper({ id: " p1 ", conferenceId: " c1 ", title: " T ", status: " ACCEPTED " });
  assert.deepEqual(accepted, { id: "p1", conferenceId: "c1", title: "T", status: "accepted" });
  assert.equal(createAcceptedPaper().status, "accepted");
  assert.equal(createAcceptedPaper({ status: "" }).status, "accepted");

  const scheduleWithDefaults = createConferenceSchedule();
  assert.equal(scheduleWithDefaults.id, "");
  assert.equal(scheduleWithDefaults.conferenceId, "");
  assert.equal(scheduleWithDefaults.createdByAdminId, "");
  assert.equal(scheduleWithDefaults.status, "generated");
  assert.deepEqual(scheduleWithDefaults.sessions, []);

  const params = createSchedulingParameters({
    conferenceId: " c1 ",
    conferenceDates: [" 2026-01-01 ", null],
    sessionLengthMinutes: "60",
    dailyTimeWindow: { start: " 09:00 ", end: " 10:00 " },
    availableRoomIds: [" R1 ", null],
  });
  assert.equal(params.conferenceId, "c1");
  assert.deepEqual(params.conferenceDates, ["2026-01-01", ""]);
  assert.equal(params.sessionLengthMinutes, 60);
  assert.deepEqual(params.dailyTimeWindow, { start: "09:00", end: "10:00" });
  assert.deepEqual(params.availableRoomIds, ["R1", ""]);

  const paramsDefaults = createSchedulingParameters();
  assert.deepEqual(paramsDefaults.conferenceDates, []);
  assert.deepEqual(paramsDefaults.availableRoomIds, []);
  assert.deepEqual(paramsDefaults.dailyTimeWindow, { start: "", end: "" });

  const session = createSession({ id: " s1 ", scheduleId: " sch ", roomId: " r1 ", timeSlotId: " t1 ", paperIds: [" p1 ", null] });
  assert.deepEqual(session, { id: "s1", scheduleId: "sch", roomId: "r1", timeSlotId: "t1", paperIds: ["p1", ""] });
  assert.deepEqual(createSession().paperIds, []);

  const slot = createTimeSlot({ id: " ts ", conferenceId: " c1 ", date: " 2026-01-01 ", startTime: " 09:00 ", endTime: " 10:00 " });
  assert.deepEqual(slot, {
    id: "ts",
    conferenceId: "c1",
    date: "2026-01-01",
    startTime: "09:00",
    endTime: "10:00",
  });
  assert.deepEqual(createTimeSlot(), {
    id: "",
    conferenceId: "",
    date: "",
    startTime: "",
    endTime: "",
  });
});

test("UC-16 schedule controller branches: constructor, auth, validation, failure mapping, html/json", async () => {
  assert.throws(() => createScheduleController(), /scheduleService is required/);

  function makeResponseSpy() {
    const calls = [];
    return {
      calls,
      json(status, payload) {
        calls.push({ fn: "json", status, payload });
        return { status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
      },
      html(status, body) {
        calls.push({ fn: "html", status, body });
        return { status, headers: { "Content-Type": "text/html" }, body };
      },
      renderView({ templatePath, replacements }) {
        calls.push({ fn: "renderView", templatePath, replacements });
        return `render:${path.basename(templatePath)}:${replacements.conferenceId}`;
      },
      accessDenied() {
        calls.push({ fn: "accessDenied" });
        return { status: 403, headers: { "Content-Type": "application/json" }, body: "denied" };
      },
    };
  }

  const auth401 = { requireAdmin: () => ({ ok: false, status: 401, errorCode: "session_expired", message: "no" }) };
  const rsp401 = makeResponseSpy();
  const c401 = createScheduleController({
    scheduleService: { generateSchedule() {}, getSchedule() {} },
    authService: auth401,
    response: rsp401,
  });
  const unauth = await c401.handleGenerate({ headers: {}, params: { conference_id: "C1" }, body: {} });
  assert.equal(unauth.status, 401);
  const unauthGet = await c401.handleGetSchedule({ headers: {}, params: { conference_id: "C1" } });
  assert.equal(unauthGet.status, 401);
  const unauthGenerateNoArgs = await c401.handleGenerate();
  assert.equal(unauthGenerateNoArgs.status, 401);
  const unauthGetNoArgs = await c401.handleGetSchedule();
  assert.equal(unauthGetNoArgs.status, 401);

  const auth403 = { requireAdmin: () => ({ ok: false, status: 403, errorCode: "access_denied", message: "denied" }) };
  const rsp403 = makeResponseSpy();
  const c403 = createScheduleController({
    scheduleService: { generateSchedule() {}, getSchedule() {} },
    authService: auth403,
    response: rsp403,
  });
  const denied = await c403.handleGetSchedule({ headers: {}, params: { conference_id: "C1" } });
  assert.equal(denied.status, 403);
  assert.equal(rsp403.calls.some((call) => call.fn === "accessDenied"), true);

  const okAuth = { requireAdmin: () => ({ ok: true, actor: { id: "admin_1" } }) };
  const missingConferenceResponse = makeResponseSpy();
  const cMissing = createScheduleController({
    scheduleService: { generateSchedule() {}, getSchedule() {} },
    authService: okAuth,
    response: missingConferenceResponse,
  });
  const missingConference = await cMissing.handleGenerate({ headers: {}, params: {}, body: {} });
  assert.equal(missingConference.status, 400);

  const failureTypes = [
    { inType: "missing_parameters", expectedStatus: 400, expectedCode: "missing_parameters" },
    { inType: "confirm_replace_required", expectedStatus: 409, expectedCode: "confirm_replace_required" },
    { inType: "unsatisfiable_constraints", expectedStatus: 409, expectedCode: "unsatisfiable_constraints" },
    { inType: "save_failed", expectedStatus: 500, expectedCode: "save_failed" },
    { inType: "anything_else", expectedStatus: 500, expectedCode: "generation_failed" },
  ];

  for (const sample of failureTypes) {
    const failureResponse = makeResponseSpy();
    const controller = createScheduleController({
      scheduleService: {
        generateSchedule() {
          return {
            type: sample.inType,
            missing: ["x"],
            message: "msg",
          };
        },
        getSchedule() {
          return { type: "success", schedule: { id: "s1", sessions: [] } };
        },
      },
      authService: okAuth,
      response: failureResponse,
    });

    const response = await controller.handleGenerate({
      headers: { accept: "application/json" },
      params: { conference_id: "C1" },
      body: {},
    });
    assert.equal(response.status, sample.expectedStatus);
    assert.equal(JSON.parse(response.body).errorCode, sample.expectedCode);
  }

  const generateHtmlSpy = makeResponseSpy();
  const generateHtmlController = createScheduleController({
    scheduleService: {
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "success", schedule: { id: "s1", sessions: [] } };
      },
    },
    authService: okAuth,
    response: generateHtmlSpy,
  });
  const htmlGenerate = await generateHtmlController.handleGenerate({
    headers: { accept: "text/html" },
    params: { conference_id: "C1" },
    body: { confirmReplace: true },
  });
  assert.equal(htmlGenerate.status, 200);
  assert.equal(generateHtmlSpy.calls.some((call) => call.fn === "renderView"), true);
  assert.equal(generateHtmlSpy.calls.some((call) => call.fn === "html"), true);

  const getJsonSpy = makeResponseSpy();
  const getJsonController = createScheduleController({
    scheduleService: {
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "success", schedule: { id: "s2", sessions: [] } };
      },
    },
    authService: okAuth,
    response: getJsonSpy,
  });
  const getJson = await getJsonController.handleGetSchedule({
    headers: { accept: "application/json" },
    params: { conference_id: "C1" },
  });
  assert.equal(getJson.status, 200);
  assert.equal(JSON.parse(getJson.body).conferenceId, "C1");

  const getNotFoundSpy = makeResponseSpy();
  const getNotFoundController = createScheduleController({
    scheduleService: {
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "not_found" };
      },
    },
    authService: okAuth,
    response: getNotFoundSpy,
  });
  const getNotFound = await getNotFoundController.handleGetSchedule({
    headers: { accept: "application/json" },
    params: { conference_id: "C1" },
  });
  assert.equal(getNotFound.status, 404);

  const getMissingConference = await getNotFoundController.handleGetSchedule({
    headers: { accept: "application/json" },
    params: {},
  });
  assert.equal(getMissingConference.status, 400);

  const getHtmlSpy = makeResponseSpy();
  const getHtmlController = createScheduleController({
    scheduleService: {
      generateSchedule() {
        return { type: "success", schedule: { status: "generated", sessions: [] } };
      },
      getSchedule() {
        return { type: "success", schedule: { id: "s3", sessions: [] } };
      },
    },
    authService: okAuth,
    response: getHtmlSpy,
  });
  const getHtml = await getHtmlController.handleGetSchedule({
    headers: { accept: "text/html" },
    params: { conference_id: "C1" },
  });
  assert.equal(getHtml.status, 200);
  assert.equal(getHtmlSpy.calls.some((call) => call.fn === "renderView"), true);
  assert.equal(getHtmlSpy.calls.some((call) => call.fn === "html"), true);
});

test("UC-16 schedule controller real response paths: wantsJson via content-type and HTML rendering", async () => {
  const service = createScheduleService({
    storageAdapter: makeWorkingStorage(),
    scheduleGenerator: createScheduleGenerator(),
  });

  const controller = createScheduleController({
    scheduleService: service,
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_admin") {
          return { user_id: "admin_1", role: "admin" };
        }
        return null;
      },
    },
  });

  const jsonByContentType = await controller.handleGenerate({
    headers: { cookie: "cms_session=sid_admin", "content-type": "application/json" },
    params: { conference_id: "C1" },
    body: {},
  });
  assert.equal(jsonByContentType.status, 200);
  assert.equal(jsonByContentType.headers["Content-Type"], "application/json");

  const htmlGenerate = await controller.handleGenerate({
    headers: { cookie: "cms_session=sid_admin", accept: "text/html" },
    params: { conference_id: "C1" },
    body: { confirmReplace: true },
  });
  assert.equal(htmlGenerate.status, 200);
  assert.equal(htmlGenerate.headers["Content-Type"], "text/html");
  assert.equal(htmlGenerate.body.includes("Schedule generated and stored successfully."), true);

  const htmlView = await controller.handleGetSchedule({
    headers: { cookie: "cms_session=sid_admin", accept: "text/html" },
    params: { conference_id: "C1" },
  });
  assert.equal(htmlView.status, 200);
  assert.equal(htmlView.headers["Content-Type"], "text/html");
  assert.equal(htmlView.body.includes("Stored schedule loaded successfully."), true);

  const undefinedScheduleController = createScheduleController({
    scheduleService: {
      generateSchedule() {
        return { type: "success", schedule: undefined };
      },
      getSchedule() {
        return { type: "success", schedule: undefined };
      },
    },
    sessionService: {
      validate(sessionId) {
        if (sessionId === "sid_admin") {
          return { user_id: "admin_1", role: "admin" };
        }
        return null;
      },
    },
  });

  const htmlWithUndefinedSchedule = await undefinedScheduleController.handleGenerate({
    headers: { cookie: "cms_session=sid_admin", accept: "text/html" },
    params: { conference_id: "C1" },
    body: {},
  });
  assert.equal(htmlWithUndefinedSchedule.status, 200);
  assert.equal(htmlWithUndefinedSchedule.body.includes("{}"), true);
});
