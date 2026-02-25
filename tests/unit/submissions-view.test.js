const test = require("node:test");
const assert = require("node:assert/strict");

const { renderSubmissionsView } = require("../../src/views/submissions-view");

test("submissions_view covers item normalization and pending status fallback", () => {
  const htmlWithInvalidItems = renderSubmissionsView({
    items: "not-an-array",
    errorMessage: undefined,
  });
  assert.equal(htmlWithInvalidItems.includes("<tbody></tbody>"), true);

  const htmlWithPending = renderSubmissionsView({
    items: [{ title: undefined, decisionStatus: "" }],
  });
  assert.equal(htmlWithPending.includes("Pending publication"), true);
  assert.equal(htmlWithPending.includes("<td></td>"), true);
});

