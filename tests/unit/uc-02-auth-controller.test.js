const test = require("node:test");
const assert = require("node:assert/strict");

const { createAuthController } = require("../../src/controllers/auth-controller");

function createController({ authResult, sessionValidate, createdSessionId = "session123" } = {}) {
  const authService = {
    async authenticate() {
      return typeof authResult === "function" ? authResult() : authResult;
    },
  };

  const sessionService = {
    validate(sessionId) {
      return typeof sessionValidate === "function" ? sessionValidate(sessionId) : null;
    },
    create(userId) {
      return { session_id: `${createdSessionId}-${userId}` };
    },
  };

  return createAuthController({ authService, sessionService });
}

test("handleGetLogin returns login page when no session exists", async () => {
  const controller = createController({
    authResult: { type: "success", user: { id: "u1" } },
    sessionValidate: () => null,
  });

  const response = await controller.handleGetLogin({ headers: {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.equal(response.body.includes("Log In"), true);
});

test("handleGetLogin redirects authenticated user and decodes cookie values", async () => {
  let validatedWith = null;
  const controller = createController({
    authResult: { type: "success", user: { id: "u1" } },
    sessionValidate: (sessionId) => {
      validatedWith = sessionId;
      return { user_id: "u1" };
    },
  });

  const response = await controller.handleGetLogin({
    headers: { cookie: "other=1; cms_session=s%20id" },
  });
  assert.equal(validatedWith, "s id");
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/dashboard.html");
});

test("handlePostLogin success branch returns JSON when client wants JSON", async () => {
  const controller = createController({
    authResult: {
      type: "success",
      user: { id: "user_1" },
    },
    sessionValidate: () => null,
    createdSessionId: "abc",
  });

  const response = await controller.handlePostLogin({
    headers: { accept: "application/json" },
    body: { email: "user1@example.com", password: "ValidPassw0rd!" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "application/json");
  assert.equal(response.headers["Set-Cookie"].startsWith("cms_session=abc-user_1"), true);
  const payload = JSON.parse(response.body);
  assert.equal(payload.user_id, "user_1");
  assert.equal(payload.redirect_to, "/dashboard.html");
});

test("handlePostLogin success branch returns redirect when HTML is preferred", async () => {
  const controller = createController({
    authResult: {
      type: "success",
      user: { id: "user_1" },
    },
    sessionValidate: () => null,
  });

  const response = await controller.handlePostLogin({
    headers: { accept: "text/html" },
    body: { email: "user1@example.com", password: "ValidPassw0rd!" },
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/dashboard.html");
  assert.equal(typeof response.headers["Set-Cookie"], "string");
});

test("handlePostLogin failure returns JSON when content-type indicates JSON", async () => {
  const controller = createController({
    authResult: {
      type: "invalid_credentials",
      status: 401,
      message: "Invalid email or password.",
    },
    sessionValidate: () => null,
  });

  const response = await controller.handlePostLogin({
    headers: { "content-type": "application/json" },
    body: { email: "user1@example.com", password: "WrongPass!" },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers["Content-Type"], "application/json");
  const payload = JSON.parse(response.body);
  assert.equal(payload.error_code, "invalid_credentials");
  assert.equal(payload.message, "Invalid email or password.");
});

test("handlePostLogin failure returns rendered HTML and handles missing request/body safely", async () => {
  const controller = createController({
    authResult: {
      type: "missing_fields",
      status: 400,
      message: "Email is required.",
    },
    sessionValidate: () => null,
  });

  const response = await controller.handlePostLogin();
  assert.equal(response.status, 400);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.equal(response.body.includes("Email is required."), true);
});

test("handleGetDashboard enforces session guard and renders dashboard when session exists", async () => {
  const controller = createController({
    authResult: { type: "success", user: { id: "user_1" } },
    sessionValidate: (sessionId) => {
      if (sessionId === "good") {
        return { user_id: "user_1" };
      }
      return null;
    },
  });

  const denied = await controller.handleGetDashboard({ headers: {} });
  assert.equal(denied.status, 302);
  assert.equal(denied.headers.Location, "/login.html");

  const allowed = await controller.handleGetDashboard({
    headers: { cookie: "cms_session=good" },
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.includes("user_1"), true);
});

test("handleGetSession returns 401 when no session and 200 when session exists", async () => {
  const controller = createController({
    authResult: { type: "success", user: { id: "user_1" } },
    sessionValidate: (sessionId) => (sessionId === "ok" ? { user_id: "user_1" } : null),
  });

  const noSession = await controller.handleGetSession({ headers: {} });
  assert.equal(noSession.status, 401);
  assert.equal(JSON.parse(noSession.body).error_code, "no_session");

  const active = await controller.handleGetSession({
    headers: { cookie: "cms_session=ok" },
  });
  assert.equal(active.status, 200);
  const payload = JSON.parse(active.body);
  assert.equal(payload.authenticated, true);
  assert.equal(payload.user_id, "user_1");
});

test("cookie parsing decodes URI-encoded session cookie before validate", async () => {
  let receivedSessionId = null;
  const controller = createAuthController({
    authService: {
      async authenticate() {
        return { type: "invalid_credentials", status: 401, message: "Invalid email or password." };
      },
    },
    sessionService: {
      validate(sessionId) {
        receivedSessionId = sessionId;
        return null;
      },
      create() {
        return { session_id: "unused" };
      },
    },
  });

  await controller.handleGetDashboard({
    headers: { cookie: "cms_session=session%20id%2B1" },
  });
  assert.equal(receivedSessionId, "session id+1");
});

test("getSessionFromRequest handles undefined request via headers fallback", async () => {
  let validateCalls = 0;
  let validateArg = "unseen";
  const controller = createAuthController({
    authService: {
      async authenticate() {
        return { type: "invalid_credentials", status: 401, message: "Invalid email or password." };
      },
    },
    sessionService: {
      validate(sessionId) {
        validateCalls += 1;
        validateArg = sessionId;
        return null;
      },
      create() {
        return { session_id: "unused" };
      },
    },
  });

  const response = await controller.handleGetSession();
  assert.equal(response.status, 401);
  assert.equal(validateCalls, 1);
  assert.equal(validateArg, "");
});

test("cookie parser handles cookie token without '=' using empty-string fallback", async () => {
  let receivedSessionId = "unset";
  const controller = createAuthController({
    authService: {
      async authenticate() {
        return { type: "invalid_credentials", status: 401, message: "Invalid email or password." };
      },
    },
    sessionService: {
      validate(sessionId) {
        receivedSessionId = sessionId;
        return null;
      },
      create() {
        return { session_id: "unused" };
      },
    },
  });

  await controller.handleGetDashboard({
    headers: { cookie: "cms_session" },
  });
  assert.equal(receivedSessionId, "");
});
