const test = require("node:test");
const assert = require("node:assert/strict");

const { createSubmissionController } = require("../../src/controllers/submission_controller");

function makeController({ session, submission } = {}) {
  return createSubmissionController({
    submissionService: {
      async getSubmission() {
        return submission || null;
      },
    },
    sessionService: {
      validate() {
        return session || null;
      },
    },
  });
}

test("submission_controller handleGetConfirmation renders HTML confirmation", async () => {
  const controller = makeController({
    session: { user_id: "author-1" },
    submission: {
      submission_id: "s1",
      author_id: "author-1",
      title: "Paper Title",
      status: "submitted",
    },
  });

  const response = await controller.handleGetConfirmation({
    headers: { accept: "text/html", cookie: "cms_session=s1" },
    params: { submission_id: "s1" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "text/html");
  assert.ok(response.body.includes("Submission received"));
  assert.ok(response.body.includes("Paper Title"));
});
