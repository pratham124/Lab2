const test = require("node:test");
const assert = require("node:assert/strict");

const { renderSelectableReviewerList } = require("../../src/views/reviewer_selection_view");

test("UC-09 reviewer_selection_view maps reviewer_id and name fields", () => {
  const result = renderSelectableReviewerList([
    { id: " R1 ", name: " Reviewer One " },
    { id: 99, name: 123 },
    { id: "", name: "" },
    {},
  ]);

  assert.deepEqual(result, [
    { reviewer_id: "R1", name: "Reviewer One" },
    { reviewer_id: "99", name: "123" },
    { reviewer_id: "", name: "" },
    { reviewer_id: "", name: "" },
  ]);
});

test("UC-09 reviewer_selection_view returns empty list for non-array input", () => {
  assert.deepEqual(renderSelectableReviewerList(null), []);
  assert.deepEqual(renderSelectableReviewerList(undefined), []);
});
