function renderSelectableReviewerList(reviewers = []) {
  return (Array.isArray(reviewers) ? reviewers : []).map((reviewer) => ({
    reviewer_id: String((reviewer && reviewer.id) || "").trim(),
    name: String((reviewer && reviewer.name) || "").trim(),
  }));
}

module.exports = {
  renderSelectableReviewerList,
};
