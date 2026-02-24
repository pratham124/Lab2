const test = require("node:test");
const assert = require("node:assert/strict");

const { createRegistrationController } = require("../../src/controllers/registration_controller");
const { VALIDATION_MESSAGES } = require("../../src/services/validation_messages");

function buildController(result) {
  const registrationService = {
    async register() {
      return typeof result === "function" ? result() : result;
    },
  };
  return createRegistrationController({ registrationService });
}

test("registration_controller handleGet returns HTML with placeholders resolved", async () => {
  const controller = buildController({
    type: "success",
    status: 302,
    redirect: "/login",
  });

  const response = await controller.handleGet();
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.equal(response.body.includes("{{"), false);
});

test("registration_controller handlePost success redirects", async () => {
  const controller = buildController({
    type: "success",
    status: 302,
    redirect: "/login",
  });

  const response = await controller.handlePost({ headers: {}, body: {} });
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, "/login");
});

test("registration_controller handlePost forwards email/password payload to service", async () => {
  let captured = null;
  const controller = createRegistrationController({
    registrationService: {
      async register(input) {
        captured = input;
        return {
          type: "success",
          status: 302,
          redirect: "/login",
        };
      },
    },
  });

  const response = await controller.handlePost({
    headers: { accept: "application/json" },
    body: { email: "author@example.com", password: "ValidPassw0rd1" },
  });

  assert.equal(response.status, 302);
  assert.equal(captured.email, "author@example.com");
  assert.equal(captured.password, "ValidPassw0rd1");
});

test("registration_controller handlePost handles missing request", async () => {
  let captured = null;
  const controller = createRegistrationController({
    registrationService: {
      async register(input) {
        captured = input;
        return {
          type: "validation_error",
          status: 400,
          error: "Validation error",
          fieldErrors: {
            email: VALIDATION_MESSAGES.EMAIL_REQUIRED,
            password: VALIDATION_MESSAGES.PASSWORD_REQUIRED,
          },
        };
      },
    },
  });

  const response = await controller.handlePost();
  assert.equal(captured.email, undefined);
  assert.equal(captured.password, undefined);
  assert.equal(response.status, 400);
});

test("registration_controller handlePost returns JSON for validation errors", async () => {
  const controller = buildController({
    type: "validation_error",
    status: 400,
    error: "Validation error",
    fieldErrors: {
      email: VALIDATION_MESSAGES.EMAIL_INVALID,
    },
  });

  const response = await controller.handlePost({
    headers: { accept: "application/json" },
    body: { email: "invalid" },
  });

  assert.equal(response.status, 400);
  assert.equal(response.headers["Content-Type"], "application/json");
  const payload = JSON.parse(response.body);
  assert.equal(payload.error, "Validation error");
  assert.equal(payload.fieldErrors.email, VALIDATION_MESSAGES.EMAIL_INVALID);
});

test("registration_controller handlePost returns JSON for duplicate", async () => {
  const controller = buildController({
    type: "duplicate",
    status: 409,
    error: VALIDATION_MESSAGES.EMAIL_IN_USE,
  });

  const response = await controller.handlePost({
    headers: { "content-type": "application/json" },
    body: { email: "dup@example.com" },
  });

  const payload = JSON.parse(response.body);
  assert.equal(response.status, 409);
  assert.equal(payload.fieldErrors.email, VALIDATION_MESSAGES.EMAIL_IN_USE);
});

test("registration_controller handlePost renders HTML with escaped values", async () => {
  const controller = buildController({
    type: "validation_error",
    status: 400,
    error: "Validation error",
    fieldErrors: {
      password: VALIDATION_MESSAGES.PASSWORD_REQUIRED,
    },
  });

  const response = await controller.handlePost({
    headers: { accept: "text/html" },
    body: { email: "<script>alert(1)</script>" },
  });

  assert.equal(response.status, 400);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.equal(response.body.includes("<script>"), false);
  assert.equal(response.body.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), true);
});

test("registration_controller handlePost renders system error message", async () => {
  const controller = buildController({
    type: "system_error",
    status: 500,
    error: VALIDATION_MESSAGES.SYSTEM_ERROR,
  });

  const response = await controller.handlePost({
    headers: { accept: "text/html" },
    body: { email: "user@example.com" },
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.includes(VALIDATION_MESSAGES.SYSTEM_ERROR), true);
  assert.equal(response.body.includes("user@example.com"), true);
});
