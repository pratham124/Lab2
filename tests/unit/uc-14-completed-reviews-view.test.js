const test = require("node:test");
const assert = require("node:assert/strict");

function normalize(html) {
  return html.replace(/\s+/g, " ").trim();
}

function loadFreshViewModule() {
  const path = require("path");
  const viewPath = require.resolve("../../src/views/completed_reviews_view");
  delete require.cache[viewPath];
  return require(path.join("..", "..", "src", "views", "completed_reviews_view"));
}

test("completed_reviews_view renders reviewer identity variants and fields", () => {
  const { renderCompletedReviewsView } = loadFreshViewModule();
  const html = renderCompletedReviewsView({
    paper: { id: "P1", title: "Paper <Title>" },
    reviews: [
      {
        reviewerId: "R1",
        reviewerName: "Reviewer One & Co",
        submittedAt: "2026-02-24T12:00:00.000Z",
        content: { comment: "Great work.", notes: "Needs edits." },
      },
      {
        reviewerName: "Reviewer Two",
        content: { comment: "Solid work." },
      },
      {
        reviewerId: "<R3>",
        content: {},
      },
    ],
  });

  const output = normalize(html);
  assert.match(output, /Reviewer One &amp; Co \(ID: R1\)/);
  assert.match(output, /Reviewer Two/);
  assert.match(output, /Reviewer: &lt;R3&gt;/);
  assert.match(output, /Submitted: 2026-02-24T12:00:00.000Z/);
  assert.match(output, /Review Comment/);
  assert.match(output, /Optional Notes/);
  assert.match(output, /Optional Notes:<\/strong> —<\/div>/);
  assert.match(output, /Paper: <strong>Paper &lt;Title&gt;<\/strong>/);
});

test("completed_reviews_view renders empty state and error view", () => {
  const { renderCompletedReviewsView, renderCompletedReviewsError } = loadFreshViewModule();
  const html = renderCompletedReviewsView({
    paper: { id: "P2", title: "Empty Paper" },
    reviews: [],
    emptyMessage: "No completed reviews are available yet.",
  });

  assert.match(html, /No completed reviews are available yet\./);
  assert.match(html, /Back to papers list/);
  assert.match(html, /href="\/papers"/);

  const errorHtml = renderCompletedReviewsError({
    error: { message: "", nextStep: "", returnTo: "" },
  });

  assert.match(errorHtml, /Unable to load completed reviews/);
  assert.match(errorHtml, /Please try again later\./);
  assert.match(errorHtml, /Completed Reviews Error/);
});

test("completed_reviews_view escapes content and uses default empty message", () => {
  const { renderCompletedReviewsView } = loadFreshViewModule();
  const html = renderCompletedReviewsView({
    paper: { id: "P<3>", title: "Paper & Title" },
    reviews: [],
  });

  assert.match(html, /data-paper-id="P&lt;3&gt;"/);
  assert.match(html, /Paper: <strong>Paper &amp; Title<\/strong>/);
  assert.match(html, /No completed reviews are available yet\./);
  assert.match(html, /Back to papers list/);
});

test("completed_reviews_view renders required and optional fields", () => {
  const { renderCompletedReviewsView } = loadFreshViewModule();
  const html = renderCompletedReviewsView({
    paper: { id: "P3", title: "Field Paper" },
    reviews: [
      {
        reviewerId: "R9",
        content: { comment: "Good work.", notes: "Extra note." },
      },
    ],
  });

  assert.match(html, /Review Comment/);
  assert.match(html, /Optional Notes/);
  assert.match(html, /Good work\./);
  assert.match(html, /Extra note\./);
});

test("completed_reviews_view renders unknown reviewer and escapes title", () => {
  const { renderCompletedReviewsView } = loadFreshViewModule();
  const html = renderCompletedReviewsView({
    paper: { id: "P4", title: "Title \"Quote\" & More" },
    reviews: [
      {
        reviewerId: "",
        reviewerName: "",
        content: { comment: "Complete review." },
      },
    ],
  });

  assert.match(html, /Reviewer: Unknown reviewer/);
  assert.match(html, /Title &quot;Quote&quot; &amp; More/);
});

test("completed_reviews_view coverage smoke for escapeHtml and field list", () => {
  const { renderCompletedReviewsView } = loadFreshViewModule();
  const html = renderCompletedReviewsView({
    paper: { id: "P0", title: "T<&>\"'" },
    reviews: [
      {
        reviewerId: "",
        reviewerName: "",
        content: {},
      },
    ],
  });

  assert.match(html, /data-paper-id="P0"/);
  assert.match(html, /Paper: <strong>T&lt;&amp;&gt;&quot;&#39;<\/strong>/);
  assert.match(html, /Reviewer: Unknown reviewer/);
  assert.match(html, /Review Comment/);
  assert.match(html, /Optional Notes/);
  assert.match(html, /Optional Notes:<\/strong> —<\/div>/);
});

test("completed_reviews_view handles missing schema fields and empty title", () => {
  const path = require("path");
  const schemaPath = require.resolve("../../src/models/review_form_schema");
  const originalSchema = require.cache[schemaPath].exports;

  require.cache[schemaPath].exports = {
    getActiveReviewFormSchema() {
      return { required: null, optional: null };
    },
  };
  const fresh = loadFreshViewModule();

  try {
    const html = fresh.renderCompletedReviewsView({
      paper: { id: undefined, title: "" },
      reviews: [{ reviewerId: "", reviewerName: "", content: {} }],
    });

    assert.match(html, /data-paper-id=""/);
    assert.match(html, /Paper: <strong><\/strong>/);
    assert.match(html, /Reviewer: Unknown reviewer/);
    assert.match(html, /completed-review__field/);
  } finally {
    require.cache[schemaPath].exports = originalSchema;
  }
});

test("completed_reviews_view renders list items with fields", () => {
  const { renderCompletedReviewsView } = loadFreshViewModule();
  const html = renderCompletedReviewsView({
    paper: { id: "P5", title: "List Paper" },
    reviews: [
      {
        reviewerId: "R5",
        reviewerName: "Reviewer Five",
        submittedAt: "2026-02-24T10:00:00.000Z",
        content: { comment: "List review.", notes: "Note." },
      },
    ],
  });

  assert.match(html, /completed-review__field/);
  assert.match(html, /Review Comment/);
  assert.match(html, /Optional Notes/);
  assert.match(html, /Reviewer Five/);
});

test("completed_reviews_view executes renderReviewItem on fresh module load", () => {
  const fresh = loadFreshViewModule();
  const html = fresh.renderCompletedReviewsView({
    paper: { id: "P6", title: "Fresh Paper" },
    reviews: [
      {
        reviewerId: "R6",
        reviewerName: "Reviewer Six",
        submittedAt: "2026-02-24T11:00:00.000Z",
        content: { comment: "Fresh review.", notes: "Fresh note." },
      },
    ],
  });

  assert.match(html, /completed-review__field/);
  assert.match(html, /Fresh review\./);
});

test("completed_reviews_view exposes renderReviewItem for coverage", () => {
  const fresh = loadFreshViewModule();
  const schema = { required: [{ key: "comment", label: "Review Comment" }], optional: [] };
  const html = fresh.__test.renderReviewItem(
    {
      reviewerId: "R7",
      reviewerName: "Reviewer Seven",
      submittedAt: "2026-02-24T12:10:00.000Z",
      content: { comment: "Coverage review." },
    },
    schema
  );

  assert.match(html, /Reviewer Seven/);
  assert.match(html, /Coverage review\./);
});

