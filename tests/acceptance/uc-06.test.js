const test = require("node:test");
const assert = require("node:assert/strict");

const { createSubmissionRepository } = require("../../src/services/submission_repository");
const { createDraftService } = require("../../src/services/draft_service");
const { createDraftController } = require("../../src/controllers/draft_controller");
const { createSubmissionController } = require("../../src/controllers/submission_controller");

const AUTHOR_A = "author_uc06_a";
const AUTHOR_B = "author_uc06_b";
const SUBMISSION_ID = "submission_uc06_1";

function createHarness({ failingUpsert = false } = {}) {
  const store = {
    submissions: [],
    drafts: [],
  };

  const submissionRepository = createSubmissionRepository({ store });
  if (failingUpsert) {
    submissionRepository.upsertDraft = async () => {
      throw new Error("DB_DOWN");
    };
  }

  const logs = {
    saveFailures: [],
    unauthorized: [],
  };

  const loggingService = {
    logSaveFailure(entry) {
      logs.saveFailures.push(entry);
    },
    logUnauthorizedAccess(entry) {
      logs.unauthorized.push(entry);
    },
  };

  const sessions = new Map([
    ["sid_author_a", { user_id: AUTHOR_A, role: "author" }],
    ["sid_author_b", { user_id: AUTHOR_B, role: "author" }],
  ]);

  const sessionService = {
    validate(sessionId) {
      return sessions.get(String(sessionId || "")) || null;
    },
  };

  const draftService = createDraftService({
    submissionRepository,
    loggingService,
  });

  const draftController = createDraftController({
    draftService,
    sessionService,
  });

  const submissionService = {
    async submit() {
      return { type: "system_error" };
    },
    async getSubmission() {
      return null;
    },
  };

  const submissionController = createSubmissionController({
    submissionService,
    sessionService,
    draftService,
  });

  function jsonHeaders(sessionId, extraHeaders = {}) {
    return {
      accept: "application/json",
      "content-type": "application/json",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
      ...extraHeaders,
    };
  }

  function htmlHeaders(sessionId) {
    return {
      accept: "text/html",
      cookie: sessionId ? `cms_session=${sessionId}` : "",
    };
  }

  async function putDraft({
    sessionId,
    submissionId = SUBMISSION_ID,
    data = {},
    expectedSavedAt,
    idempotencyKey,
  }) {
    return draftController.handlePutDraft({
      headers: jsonHeaders(sessionId, idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      params: { submission_id: submissionId },
      body: {
        data,
        expectedSavedAt,
        idempotency_key: idempotencyKey,
      },
    });
  }

  async function getDraft({ sessionId, submissionId = SUBMISSION_ID }) {
    return draftController.handleGetDraft({
      headers: jsonHeaders(sessionId),
      params: { submission_id: submissionId },
    });
  }

  async function getSubmissionForm({ sessionId, draftSubmissionId }) {
    return submissionController.handleGetForm({
      headers: htmlHeaders(sessionId),
      query: draftSubmissionId ? { draft: draftSubmissionId } : {},
    });
  }

  return {
    putDraft,
    getDraft,
    getSubmissionForm,
    store,
    logs,
  };
}

test("AT-UC06-01 — Save Draft Successfully (Main Success Scenario)", async () => {
  const harness = createHarness();

  const response = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "  Partial Title  ",
      abstract: "Saved abstract",
    },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.message, "Draft saved successfully.");
  assert.equal(typeof payload.savedAt, "string");
  assert.equal(payload.savedAt.length > 0, true);
  assert.equal(payload.data.title, "Partial Title");
  assert.equal(payload.data.abstract, "Saved abstract");
});

test("AT-UC06-02 — Resume Draft Later", async () => {
  const harness = createHarness();

  const saved = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Resume Title",
      abstract: "Resume Abstract",
    },
  });
  const savedPayload = JSON.parse(saved.body);

  const signedOutAccess = await harness.getSubmissionForm({
    sessionId: "",
    draftSubmissionId: SUBMISSION_ID,
  });
  assert.equal(signedOutAccess.status, 302);

  const resumed = await harness.getSubmissionForm({
    sessionId: "sid_author_a",
    draftSubmissionId: SUBMISSION_ID,
  });

  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.includes("Draft loaded."), true);
  assert.equal(resumed.body.includes('value="Resume Title"'), true);
  assert.equal(resumed.body.includes("Resume Abstract"), true);
  assert.equal(resumed.body.includes(savedPayload.savedAt), true);
});

test("AT-UC06-03 — Save Draft With Minimal Information", async () => {
  const harness = createHarness();

  const emptySave = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {},
  });
  assert.equal(emptySave.status, 200);

  const oneFieldSave = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Only Title",
    },
  });
  assert.equal(oneFieldSave.status, 200);

  const payload = JSON.parse(oneFieldSave.body);
  assert.equal(payload.data.title, "Only Title");
});

test("AT-UC06-04 — Reject Invalid Provided Data", async () => {
  const harness = createHarness();

  await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Persisted title",
    },
  });

  const invalid = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      contact_email: "bad-email",
    },
  });

  assert.equal(invalid.status, 400);
  const invalidPayload = JSON.parse(invalid.body);
  assert.equal(invalidPayload.errorCode, "validation_error");
  assert.equal(invalidPayload.fieldErrors.contact_email, "Contact email must be valid.");

  const afterInvalid = await harness.getDraft({ sessionId: "sid_author_a" });
  const draftPayload = JSON.parse(afterInvalid.body);
  assert.equal(draftPayload.data.title, "Persisted title");
  assert.equal(Object.prototype.hasOwnProperty.call(draftPayload.data, "contact_email"), false);
});

test("AT-UC06-05 — Handle Save Failure Safely", async () => {
  const harness = createHarness({ failingUpsert: true });

  const failed = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Will fail",
    },
  });

  assert.equal(failed.status, 500);
  const payload = JSON.parse(failed.body);
  assert.equal(payload.errorCode, "save_failure");
  assert.equal(payload.message, "Draft could not be saved. Please try again.");
  assert.equal(harness.logs.saveFailures.length, 1);
  assert.equal(harness.store.drafts.length, 0);
});

test("AT-UC06-06 — Update Existing Draft (No Duplicate)", async () => {
  const harness = createHarness();

  const first = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Initial",
    },
  });
  const firstPayload = JSON.parse(first.body);

  const second = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Updated",
      keywords: "cms, draft",
    },
  });
  const secondPayload = JSON.parse(second.body);

  assert.equal(second.status, 200);
  assert.equal(secondPayload.draftId, firstPayload.draftId);
  assert.equal(secondPayload.data.title, "Updated");
  assert.equal(secondPayload.data.keywords, "cms, draft");
  assert.equal(harness.store.drafts.length, 1);
});

test("AT-UC06-07 — Rapid Double Save Is Idempotent", async () => {
  const harness = createHarness();

  const first = await harness.putDraft({
    sessionId: "sid_author_a",
    idempotencyKey: "double-save-key",
    data: {
      title: "Idempotent title",
    },
  });

  const second = await harness.putDraft({
    sessionId: "sid_author_a",
    idempotencyKey: "double-save-key",
    data: {
      title: "Idempotent title",
    },
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body, first.body);
  assert.equal(harness.store.drafts.length, 1);
});

test("AT-UC06-08 — Draft Is Private to Owner", async () => {
  const harness = createHarness();

  await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Private Draft",
    },
  });

  const readByOther = await harness.getDraft({ sessionId: "sid_author_b" });
  assert.equal(readByOther.status, 403);

  const writeByOther = await harness.putDraft({
    sessionId: "sid_author_b",
    data: {
      title: "Unauthorized overwrite",
    },
  });
  assert.equal(writeByOther.status, 403);

  assert.equal(harness.logs.unauthorized.length, 2);
});

test("AT-UC06-09 — Last-Write-Wins on Stale Save", async () => {
  const harness = createHarness();

  await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Client A v1",
    },
  });

  const second = await harness.putDraft({
    sessionId: "sid_author_a",
    data: {
      title: "Client B v2",
    },
  });
  assert.equal(second.status, 200);

  const stale = await harness.putDraft({
    sessionId: "sid_author_a",
    expectedSavedAt: "2000-01-01T00:00:00.000Z",
    data: {
      title: "Client A stale overwrite",
    },
  });

  assert.equal(stale.status, 200);
  const stalePayload = JSON.parse(stale.body);
  assert.equal(stalePayload.conflictPolicy, "last_write_wins");
  assert.equal(stalePayload.conflictDetected, true);

  const finalDraft = await harness.getDraft({ sessionId: "sid_author_a" });
  const finalPayload = JSON.parse(finalDraft.body);
  assert.equal(finalPayload.data.title, "Client A stale overwrite");
});
