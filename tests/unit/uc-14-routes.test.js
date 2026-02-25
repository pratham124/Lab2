const test = require("node:test");
const assert = require("node:assert/strict");

const { createRoutes } = require("../../src/controllers/routes");

test("routes returns 404 when completedReviewsController is missing", async () => {
  const routes = createRoutes({});
  const response = await routes.handleCompletedReviewsGet(
    { headers: {} },
    new URL("http://localhost/papers/P1/reviews/completed")
  );

  assert.equal(response.status, 404);
  const payload = JSON.parse(response.body);
  assert.equal(payload.errorCode, "not_found");
});

test("routes passes paper id to completedReviewsController", async () => {
  let captured = null;
  const routes = createRoutes({
    completedReviewsController: {
      handleGet({ params }) {
        captured = params.paper_id;
        return { status: 200, headers: {}, body: "" };
      },
    },
  });

  assert.equal(
    routes.isCompletedReviewsGet(
      { method: "GET" },
      new URL("http://localhost/papers/P99/reviews/completed")
    ),
    true
  );

  const response = await routes.handleCompletedReviewsGet(
    { headers: {} },
    new URL("http://localhost/papers/P99/reviews/completed")
  );

  assert.equal(response.status, 200);
  assert.equal(captured, "P99");
});

test("routes handles empty paper id segment", async () => {
  let captured = "unset";
  const routes = createRoutes({
    completedReviewsController: {
      handleGet({ params }) {
        captured = params.paper_id;
        return { status: 200, headers: {}, body: "" };
      },
    },
  });

  const response = await routes.handleCompletedReviewsGet(
    { headers: {} },
    new URL("http://localhost/papers//reviews/completed")
  );

  assert.equal(response.status, 200);
  assert.equal(captured, "");
});
