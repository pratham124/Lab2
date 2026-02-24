const test = require("node:test");
const assert = require("node:assert/strict");

const { createRoutes } = require("../../src/controllers/routes");
const { createSubmissionWindow, isWithinSubmissionWindow } = require("../../src/models/submission_window");
const { createSubmissionRepository } = require("../../src/services/submission_repository");
const { createManuscriptStorage } = require("../../src/services/manuscript_storage");
const {
  mapValidationErrors,
  fileRequirementMessage,
  formatListLabel,
  composeSafeSaveFailureMessage,
} = require("../../src/lib/response_helpers");

test("routes predicates and handlers cover forwarding branches", async () => {
  const calls = [];
  const routes = createRoutes({
    submissionController: {
      async handleGetForm(input) {
        calls.push({ type: "get", input });
        return { ok: true };
      },
      async handlePost(input) {
        calls.push({ type: "post", input });
        return { ok: true };
      },
      async handleGetConfirmation(input) {
        calls.push({ type: "confirm", input });
        return { ok: true };
      },
    },
  });

  assert.equal(routes.isSubmissionGetForm({ method: "GET" }, { pathname: "/submissions/new" }), true);
  assert.equal(routes.isSubmissionGetForm({ method: "GET" }, { pathname: "/submissions/new.html" }), true);
  assert.equal(routes.isSubmissionGetForm({ method: "POST" }, { pathname: "/submissions/new" }), false);

  assert.equal(routes.isSubmissionPost({ method: "POST" }, { pathname: "/submissions" }), true);
  assert.equal(routes.isSubmissionPost({ method: "GET" }, { pathname: "/submissions" }), false);

  assert.equal(routes.isSubmissionConfirmation({ method: "GET" }, { pathname: "/submissions/abc_1" }), true);
  assert.equal(routes.isSubmissionConfirmation({ method: "GET" }, { pathname: "/submissions/new" }), true);
  assert.equal(routes.isSubmissionConfirmation({ method: "POST" }, { pathname: "/submissions/abc_1" }), false);

  await routes.handleSubmissionGetForm({ headers: { a: "1" } });
  await routes.handleSubmissionPost({ headers: { b: "2" } }, { title: "x" });
  await routes.handleSubmissionConfirmation({ headers: { c: "3" } }, { pathname: "/submissions/sub_1" });
  await routes.handleSubmissionConfirmation({ headers: { d: "4" } }, { pathname: "/submissions" });

  assert.equal(calls.length, 4);
  assert.equal(calls[2].input.params.submission_id, "sub_1");
  assert.equal(calls[3].input.params.submission_id, "");
});

test("submission_window defaults/overrides and boundary checks", () => {
  const defaults = createSubmissionWindow();
  assert.equal(defaults.submission_window_id, "default_window");

  const custom = createSubmissionWindow({
    submission_window_id: "w1",
    opens_at: "2026-01-01T00:00:00.000Z",
    closes_at: "2026-01-02T00:00:00.000Z",
    conference_id: "c1",
  });
  assert.equal(custom.conference_id, "c1");

  assert.equal(isWithinSubmissionWindow(custom, new Date("2026-01-01T12:00:00.000Z")), true);
  assert.equal(isWithinSubmissionWindow(custom, "2025-12-31T23:59:59.000Z"), false);
  assert.equal(isWithinSubmissionWindow(custom, "2026-01-02T00:00:00.000Z"), true);
  assert.equal(isWithinSubmissionWindow(custom, "2026-01-02T00:00:01.000Z"), false);
});

test("submission_repository covers initialization, create/find, duplicate rules", async () => {
  const store = { submissions: "bad-shape" };
  const repo = createSubmissionRepository({ store });
  assert.deepEqual(store.submissions, []);

  const first = {
    submission_id: "s1",
    author_id: "a1",
    title: "My Title",
    submission_window_id: "w1",
    manuscript: { content_hash: "h1" },
  };
  await repo.create(first);
  assert.equal((await repo.findById("s1")).submission_id, "s1");
  assert.equal(await repo.findById("missing"), null);

  const noWindowMatch = await repo.findDuplicate({
    author_id: "a1",
    title: "My Title",
    content_hash: "h1",
    submission_window_id: "w2",
  });
  assert.equal(noWindowMatch, null);

  const sameAuthorTitle = await repo.findDuplicate({
    author_id: "a1",
    title: "  my title  ",
    content_hash: "different",
    submission_window_id: "w1",
  });
  assert.equal(sameAuthorTitle.submission_id, "s1");

  const sameHash = await repo.findDuplicate({
    author_id: "other",
    title: "other",
    content_hash: "h1",
    submission_window_id: "w1",
  });
  assert.equal(sameHash.submission_id, "s1");
});

test("submission_repository default store branch works without injected store", async () => {
  const repo = createSubmissionRepository();
  const created = {
    submission_id: "auto_store_1",
    author_id: "a1",
    title: "Title",
    submission_window_id: "w1",
    manuscript: { content_hash: "h1" },
  };
  await repo.create(created);
  const found = await repo.findById("auto_store_1");
  assert.equal(found.submission_id, "auto_store_1");
});

test("submission_repository title-normalization fallback handles missing titles", async () => {
  const repo = createSubmissionRepository();
  await repo.create({
    submission_id: "no_title_1",
    author_id: "same_author",
    submission_window_id: "w1",
    manuscript: { content_hash: "h_no_title" },
  });

  const duplicate = await repo.findDuplicate({
    author_id: "same_author",
    title: undefined,
    content_hash: "",
    submission_window_id: "w1",
  });
  assert.equal(duplicate.submission_id, "no_title_1");
});

test("manuscript_storage save/hash cover buffer and non-buffer branches", async () => {
  const storage = createManuscriptStorage();

  const savedFromString = await storage.save({
    submission_id: "s1",
    filename: "p.pdf",
    format: "pdf",
    contentBuffer: "abc",
  });
  assert.equal(savedFromString.size_bytes, 3);

  const savedFromBuffer = await storage.save({
    submission_id: "s2",
    filename: "p2.pdf",
    format: "pdf",
    contentBuffer: Buffer.from("abc"),
  });
  assert.equal(savedFromBuffer.content_hash, savedFromString.content_hash);

  const hashString = await storage.hash("abc");
  const hashBuffer = await storage.hash(Buffer.from("abc"));
  assert.equal(hashString, hashBuffer);
});

test("response_helpers covers defaults and formatting", () => {
  const mapped = mapValidationErrors({ title: "Title is required." });
  assert.equal(mapped.title, "Title is required.");
  assert.equal(mapped.abstract, "");

  assert.equal(fileRequirementMessage().includes("7 MB"), true);
  assert.equal(formatListLabel().includes("PDF"), true);
  assert.equal(composeSafeSaveFailureMessage().includes("Please try again later"), true);
});

test("routes draft handlers extract submission_id for get/put paths", async () => {
  const calls = [];
  const routes = createRoutes({
    submissionController: {
      async handleGetForm() {
        return { ok: true };
      },
      async handlePost() {
        return { ok: true };
      },
      async handleGetConfirmation() {
        return { ok: true };
      },
    },
    draftController: {
      async handleGetDraft(input) {
        calls.push({ type: "get", input });
        return { status: 200, headers: {}, body: "ok" };
      },
      async handlePutDraft(input) {
        calls.push({ type: "put", input });
        return { status: 200, headers: {}, body: "ok" };
      },
    },
  });

  await routes.handleDraftGet(
    { headers: { accept: "application/json" } },
    { pathname: "/submissions/submission_42/draft" }
  );
  await routes.handleDraftPut(
    { headers: { accept: "application/json" } },
    { pathname: "/submissions/submission_56/draft" },
    { data: { title: "x" } }
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].input.params.submission_id, "submission_42");
  assert.equal(calls[1].input.params.submission_id, "submission_56");
});
