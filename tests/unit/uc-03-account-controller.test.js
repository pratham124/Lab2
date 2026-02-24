const test = require("node:test");
const assert = require("node:assert/strict");
const { createAccountController } = require("../../src/controllers/account_controller");
const { VALIDATION_MESSAGES } = require("../../src/services/validation_messages");

test("account_controller handleGetSettings redirects unauthenticated users", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return { type: "success", status: 200, message: "ok" };
      },
    },
    sessionService: {
      validate() {
        return null;
      },
    },
  });

  const response = await controller.handleGetSettings({ headers: {} });
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/login.html");
});

test("account_controller handleGetSettings renders account settings for authenticated users", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return { type: "success", status: 200, message: "ok" };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "user_1" };
      },
    },
  });

  const response = await controller.handleGetSettings({
    headers: { cookie: "cms_session=session-1" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.equal(response.body.includes("Change Password"), true);
  assert.equal(response.body.includes("confirmPassword"), false);
});

test("account_controller uses authenticated session user_id for password update", async () => {
  let captured = null;
  const controller = createAccountController({
    accountService: {
      async changePassword(input) {
        captured = input;
        return {
          type: "success",
          status: 200,
          message: VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS,
        };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "session_user" };
      },
    },
  });

  const response = await controller.handlePostChangePassword({
    headers: {
      cookie: "cms_session=session-1",
      accept: "application/json",
      "content-type": "application/json",
    },
    body: {
      userId: "forged_user",
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(captured.userId, "session_user");
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS);
});

test("account_controller returns inline errors for HTML validation failures", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return {
          type: "validation_error",
          status: 400,
          message: VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE,
          fieldErrors: {
            currentPassword: VALIDATION_MESSAGES.CURRENT_PASSWORD_INVALID,
          },
        };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "session_user" };
      },
    },
  });

  const response = await controller.handlePostChangePassword({
    headers: {
      cookie: "cms_session=session-1",
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: {
      currentPassword: "wrong",
      newPassword: "NewPassw0rd1",
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.equal(response.body.includes(VALIDATION_MESSAGES.CURRENT_PASSWORD_INVALID), true);
});

test("account_controller returns json unauthenticated response for API clients", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return { type: "success", status: 200, message: "ok" };
      },
    },
    sessionService: {
      validate() {
        return null;
      },
    },
  });

  const response = await controller.handlePostChangePassword({
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    },
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers["Content-Type"], "application/json");
  const payload = JSON.parse(response.body);
  assert.equal(payload.errorCode, "unauthenticated");
});

test("account_controller redirects unauthenticated HTML submissions", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return { type: "success", status: 200, message: "ok" };
      },
    },
    sessionService: {
      validate() {
        return null;
      },
    },
  });

  const response = await controller.handlePostChangePassword({
    headers: { accept: "text/html" },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/login.html");
});

test("account_controller renders success message for HTML submissions", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return {
          type: "success",
          status: 200,
          message: VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS,
        };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "session_user" };
      },
    },
  });

  const response = await controller.handlePostChangePassword({
    headers: {
      cookie: "cms_session=session-1",
      accept: "text/html",
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes(VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS), true);
});

test("account_controller json failure response includes errorCode and fieldErrors", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return {
          type: "validation_error",
          status: 400,
          message: VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE,
          fieldErrors: {
            newPassword: VALIDATION_MESSAGES.PASSWORD_RULES,
          },
        };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "session_user" };
      },
    },
  });

  const response = await controller.handlePostChangePassword({
    headers: {
      cookie: "cms_session=session-1",
      accept: "application/json",
      "content-type": "application/json",
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "short",
    },
  });

  assert.equal(response.status, 400);
  const payload = JSON.parse(response.body);
  assert.equal(payload.errorCode, "validation_error");
  assert.equal(payload.fieldErrors.newPassword, VALIDATION_MESSAGES.PASSWORD_RULES);
});

test("account_controller html system_error renders failure message", async () => {
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return {
          type: "system_error",
          status: 500,
          message: VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE,
        };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "session_user" };
      },
    },
  });

  const response = await controller.handlePostChangePassword({
    headers: {
      cookie: "cms_session=session-1",
      accept: "text/html",
    },
    body: {
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd1",
    },
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.includes(VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE), true);
});

test("account_controller handles missing request for unauthenticated post (wantsJson defaults)", async () => {
  let validatedSessionId = "not-set";
  const controller = createAccountController({
    accountService: {
      async changePassword() {
        return { type: "success", status: 200, message: "ok" };
      },
    },
    sessionService: {
      validate(sessionId) {
        validatedSessionId = sessionId;
        return null;
      },
    },
  });

  const response = await controller.handlePostChangePassword();
  assert.equal(validatedSessionId, "");
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/login.html");
});

test("account_controller handles missing request body for authenticated post", async () => {
  let captured = null;
  const controller = createAccountController({
    accountService: {
      async changePassword(input) {
        captured = input;
        return {
          type: "validation_error",
          status: 400,
          message: VALIDATION_MESSAGES.PASSWORD_CHANGE_FAILURE,
          fieldErrors: {
            currentPassword: VALIDATION_MESSAGES.CURRENT_PASSWORD_REQUIRED,
          },
        };
      },
    },
    sessionService: {
      validate() {
        return { user_id: "session_user" };
      },
    },
  });

  const response = await controller.handlePostChangePassword();
  assert.equal(captured.userId, "session_user");
  assert.equal(captured.currentPassword, undefined);
  assert.equal(captured.newPassword, undefined);
  assert.equal(response.status, 400);
  assert.equal(response.body.includes(VALIDATION_MESSAGES.CURRENT_PASSWORD_REQUIRED), true);
});
