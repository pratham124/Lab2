const ACTIVE_REVIEW_FORM_SCHEMA = Object.freeze({
  required: [
    {
      key: "comment",
      label: "Review Comment",
    },
  ],
  optional: [
    {
      key: "notes",
      label: "Optional Notes",
    },
  ],
});

function getActiveReviewFormSchema() {
  return ACTIVE_REVIEW_FORM_SCHEMA;
}

module.exports = {
  getActiveReviewFormSchema,
};
