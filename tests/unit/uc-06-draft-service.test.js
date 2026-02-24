const test = require("node:test");
const assert = require("node:assert/strict");

const { createDraftService } = require("../../src/services/draft_service");

function makeRepo() {
  const drafts = [];
  return {
    drafts,
    async findDraftBySubmissionId(submissionId) {
      return drafts.find((item) => item.submission_id === submissionId) || null;
    },
    async upsertDraft(draft) {
      const index = drafts.findIndex((item) => item.submission_id === draft.submission_id);
      if (index < 0) {
        drafts.push(draft);
        return draft;
      }
      drafts[index] = { ...drafts[index], ...draft };
      return drafts[index];
    },
  };
}

test("draft_service throws when submissionRepository is missing", () => {
  assert.throws(() => createDraftService(), /submissionRepository is required/);
});

test("draft_service saves minimal draft and trims fields", async () => {
  const repo = makeRepo();
  const service = createDraftService({ submissionRepository: repo });

  const result = await service.saveDraft({
    submission_id: "sub-1",
    author_id: "author-1",
    data: {
      title: "  Title  ",
      abstract: "",
    },
  });

  assert.equal(result.type, "success");
  assert.equal(result.draft.submission_id, "sub-1");
  assert.equal(result.draft.author_id, "author-1");
  assert.equal(result.draft.data.title, "Title");
  assert.equal(result.draft.data.abstract, "");
});

test("draft_service rejects invalid provided email", async () => {
  const service = createDraftService({ submissionRepository: makeRepo() });

  const result = await service.saveDraft({
    submission_id: "sub-1",
    author_id: "author-1",
    data: {
      contact_email: "not-an-email",
    },
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.fieldErrors.contact_email, "Contact email must be valid.");
});

test("draft_service getDraft covers missing id and not-found branches", async () => {
  const service = createDraftService({ submissionRepository: makeRepo() });

  const missingId = await service.getDraft({ submission_id: "", author_id: "author-1" });
  assert.equal(missingId.type, "validation_error");
  assert.equal(missingId.status, 400);

  const missingDraft = await service.getDraft({ submission_id: "sub-x", author_id: "author-1" });
  assert.equal(missingDraft.type, "not_found");
  assert.equal(missingDraft.status, 404);
});

test("draft_service getDraft normalizes missing author_id to empty string branch", async () => {
  const repo = makeRepo();
  repo.drafts.push({
    draft_id: "d1",
    submission_id: "sub-1",
    author_id: "owner",
    saved_at: "2026-01-01T00:00:00.000Z",
    data: {},
  });

  const unauthorizedLogs = [];
  const service = createDraftService({
    submissionRepository: repo,
    loggingService: {
      logSaveFailure() {},
      logUnauthorizedAccess(entry) {
        unauthorizedLogs.push(entry);
      },
    },
  });

  const result = await service.getDraft({ submission_id: "sub-1", author_id: undefined });
  assert.equal(result.type, "forbidden");
  assert.equal(unauthorizedLogs[0].actor_author_id, "");
});

test("draft_service saveDraft covers missing submission id branch", async () => {
  const service = createDraftService({ submissionRepository: makeRepo() });

  const result = await service.saveDraft({
    submission_id: "",
    author_id: "author-1",
    data: {},
  });

  assert.equal(result.type, "validation_error");
  assert.equal(result.fieldErrors.submission_id, "Submission id is required.");
});

test("draft_service saveDraft normalizes missing author_id to empty string branch", async () => {
  const repo = makeRepo();
  repo.drafts.push({
    draft_id: "d1",
    submission_id: "sub-1",
    author_id: "owner",
    saved_at: "2026-01-01T00:00:00.000Z",
    data: { title: "x" },
  });

  const unauthorizedLogs = [];
  const service = createDraftService({
    submissionRepository: repo,
    loggingService: {
      logSaveFailure() {},
      logUnauthorizedAccess(entry) {
        unauthorizedLogs.push(entry);
      },
    },
  });

  const result = await service.saveDraft({
    submission_id: "sub-1",
    author_id: undefined,
    data: { title: "attempt" },
  });

  assert.equal(result.type, "forbidden");
  assert.equal(unauthorizedLogs[0].actor_author_id, "");
});

test("draft_service enforces owner-only access and logs unauthorized", async () => {
  const repo = makeRepo();
  const unauthorizedLogs = [];
  const service = createDraftService({
    submissionRepository: repo,
    loggingService: {
      logSaveFailure() {},
      logUnauthorizedAccess(entry) {
        unauthorizedLogs.push(entry);
      },
    },
  });

  await service.saveDraft({
    submission_id: "sub-1",
    author_id: "owner",
    data: { title: "Owner draft" },
  });

  const readResult = await service.getDraft({ submission_id: "sub-1", author_id: "intruder" });
  assert.equal(readResult.type, "forbidden");

  const writeResult = await service.saveDraft({
    submission_id: "sub-1",
    author_id: "intruder",
    data: { title: "hack" },
  });
  assert.equal(writeResult.type, "forbidden");
  assert.equal(unauthorizedLogs.length, 2);
});

test("draft_service updates same draft and applies last-write-wins marker", async () => {
  const repo = makeRepo();
  const service = createDraftService({ submissionRepository: repo });

  const first = await service.saveDraft({
    submission_id: "sub-1",
    author_id: "author-1",
    data: { title: "First" },
  });

  const second = await service.saveDraft({
    submission_id: "sub-1",
    author_id: "author-1",
    data: { title: "Second" },
    expected_saved_at: "2000-01-01T00:00:00.000Z",
  });

  assert.equal(second.type, "success");
  assert.equal(second.conflictDetected, true);
  assert.equal(second.draft.draft_id, first.draft.draft_id);
  assert.equal(second.draft.data.title, "Second");
  assert.equal(repo.drafts.length, 1);
});

test("draft_service returns success from getDraft for owner", async () => {
  const repo = makeRepo();
  const service = createDraftService({ submissionRepository: repo });

  await service.saveDraft({
    submission_id: "sub-1",
    author_id: "author-1",
    data: { title: "Title" },
  });

  const result = await service.getDraft({
    submission_id: "sub-1",
    author_id: "author-1",
  });

  assert.equal(result.type, "success");
  assert.equal(result.draft.data.title, "Title");
});

test("draft_service system_error uses UNKNOWN_ERROR when thrown value has no message", async () => {
  const logs = [];
  const service = createDraftService({
    submissionRepository: {
      async findDraftBySubmissionId() {
        return null;
      },
      async upsertDraft() {
        throw {};
      },
    },
    loggingService: {
      logSaveFailure(entry) {
        logs.push(entry);
      },
      logUnauthorizedAccess() {},
    },
  });

  const result = await service.saveDraft({
    submission_id: "sub-1",
    author_id: "author-1",
    data: { title: "x" },
  });

  assert.equal(result.type, "system_error");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].error_code, "UNKNOWN_ERROR");
});

test("draft_service default logger no-op unauthorized function is exercised", async () => {
  const repo = makeRepo();
  repo.drafts.push({
    draft_id: "d1",
    submission_id: "sub-1",
    author_id: "owner",
    saved_at: "2026-01-01T00:00:00.000Z",
    data: {},
  });

  const service = createDraftService({ submissionRepository: repo });
  const result = await service.getDraft({
    submission_id: "sub-1",
    author_id: "intruder",
  });

  assert.equal(result.type, "forbidden");
  assert.equal(result.status, 403);
});

test("draft_service default logger no-op save-failure function is exercised", async () => {
  const service = createDraftService({
    submissionRepository: {
      async findDraftBySubmissionId() {
        return null;
      },
      async upsertDraft() {
        throw new Error("FAIL_NO_LOGGER");
      },
    },
  });

  const result = await service.saveDraft({
    submission_id: "sub-2",
    author_id: "author-2",
    data: { title: "x" },
  });

  assert.equal(result.type, "system_error");
  assert.equal(result.status, 500);
});
