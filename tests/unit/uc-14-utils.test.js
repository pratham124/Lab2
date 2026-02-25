const test = require("node:test");
const assert = require("node:assert/strict");

const { buildErrorResponse } = require("../../src/controllers/error_response");
const { createErrorLog } = require("../../src/controllers/error_log");
const { canAccessAssignedPaper } = require("../../src/controllers/authz");
const { getAssignedEditorId } = require("../../src/models/paper");
const {
  normalizeReviewStatus,
  isCompletedReview,
  getSubmittedReviews,
} = require("../../src/models/review");
const { getActiveReviewFormSchema } = require("../../src/models/review_form_schema");

test("error_response builds defaults and omits empty errorId", () => {
  const payload = buildErrorResponse();
  assert.equal(payload.message, "Unable to load completed reviews.");
  assert.equal(payload.nextStep, "Please try again later.");
  assert.equal(payload.returnTo, "/papers");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "errorId"), false);
});

test("error_response falls back when trimmed values are empty", () => {
  const payload = buildErrorResponse({
    message: "   ",
    nextStep: "   ",
    returnTo: "   ",
  });
  assert.equal(payload.message, "Unable to load completed reviews.");
  assert.equal(payload.nextStep, "Please try again later.");
  assert.equal(payload.returnTo, "/papers");
});

test("error_response trims and includes errorId when provided", () => {
  const payload = buildErrorResponse({
    message: "  Boom ",
    nextStep: " Retry ",
    returnTo: " /home ",
    errorId: " err_1 ",
  });
  assert.equal(payload.message, "Boom");
  assert.equal(payload.nextStep, "Retry");
  assert.equal(payload.returnTo, "/home");
  assert.equal(payload.errorId, "err_1");
});

test("error_log records a retrieval failure and returns an errorId", () => {
  const entries = [];
  const logger = {
    error(entry) {
      entries.push(entry);
    },
  };
  const log = createErrorLog({ logger });
  const errorId = log.recordReviewRetrievalFailure({
    paperId: "P1",
    editorId: "E1",
    reason: "failed",
    error: new Error("DB_DOWN"),
  });

  assert.ok(errorId);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].paper_id, "P1");
  assert.equal(entries[0].editor_id, "E1");
  assert.equal(entries[0].reason, "failed");
});

test("error_log uses console sink and default reason/message", () => {
  const originalError = console.error;
  const entries = [];
  console.error = (entry) => entries.push(entry);

  try {
    const log = createErrorLog();
    const errorId = log.recordReviewRetrievalFailure({});
    assert.ok(errorId);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].reason, "review_retrieval_failed");
    assert.equal(entries[0].message, "");
  } finally {
    console.error = originalError;
  }
});

test("authz canAccessAssignedPaper enforces assigned editor", () => {
  const paper = { assignedEditorId: "editor_1" };

  assert.equal(canAccessAssignedPaper({ editorId: "", paper }), false);
  assert.equal(canAccessAssignedPaper({ editorId: "editor_1" }), false);
  assert.equal(canAccessAssignedPaper({ editorId: "editor_2", paper }), false);
  assert.equal(canAccessAssignedPaper({ editorId: "editor_1", paper }), true);
  assert.equal(canAccessAssignedPaper({ editorId: "editor_1", paper: { assignedEditorId: "" } }), false);
});

test("paper getAssignedEditorId trims value", () => {
  const paper = { assignedEditorId: " editor_9 " };
  assert.equal(getAssignedEditorId(paper), "editor_9");
});

test("review status helpers normalize and filter", () => {
  assert.equal(normalizeReviewStatus(" Submitted "), "submitted");
  assert.equal(normalizeReviewStatus(), "");
  assert.equal(isCompletedReview({ status: "submitted" }), true);
  assert.equal(isCompletedReview({ status: "pending" }), false);
  assert.equal(isCompletedReview({ review_status: "submitted" }), true);
  assert.deepEqual(getSubmittedReviews(null), []);

  const filtered = getSubmittedReviews([
    { status: "submitted" },
    { status: "pending" },
    { status: "Submitted" },
  ]);
  assert.equal(filtered.length, 2);
});

test("review_form_schema exposes required and optional fields", () => {
  const schema = getActiveReviewFormSchema();
  assert.ok(Array.isArray(schema.required));
  assert.ok(Array.isArray(schema.optional));
  assert.equal(schema.required[0].key, "comment");
  assert.equal(schema.optional[0].key, "notes");
});
