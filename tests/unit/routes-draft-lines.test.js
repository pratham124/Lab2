const test = require("node:test");
const assert = require("node:assert/strict");

const { createRoutes } = require("../../src/controllers/routes");

test("routes draft handlers hit submissionId extraction lines", async () => {
  const seen = [];
  const routes = createRoutes({
    submissionController: {
      async handleGetForm() {
        return { status: 200, headers: {}, body: "ok" };
      },
      async handlePost() {
        return { status: 200, headers: {}, body: "ok" };
      },
      async handleGetConfirmation() {
        return { status: 200, headers: {}, body: "ok" };
      },
    },
    draftController: {
      async handleGetDraft(input) {
        seen.push(input.params.submission_id);
        return { status: 200, headers: {}, body: "ok" };
      },
      async handlePutDraft(input) {
        seen.push(input.params.submission_id);
        return { status: 200, headers: {}, body: "ok" };
      },
    },
  });

  await routes.handleDraftGet({ headers: {} }, { pathname: "/submissions/line42/draft" });
  await routes.handleDraftPut({ headers: {} }, { pathname: "/submissions/line56/draft" }, {});
  await routes.handleDraftGet({ headers: {} }, { pathname: "/submissions" });
  await routes.handleDraftPut({ headers: {} }, { pathname: "/submissions" }, {});

  assert.deepEqual(seen, ["line42", "line56", "", ""]);
});
