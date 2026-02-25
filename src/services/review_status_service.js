const { areRequiredReviewsComplete } = require("./validation");

function createReviewStatusService({ repository } = {}) {
  if (!repository) {
    throw new Error("repository is required");
  }

  async function getReviewStatus({ paperId } = {}) {
    const paper = await repository.getPaperById(paperId);
    if (!paper) {
      return {
        type: "not_found",
      };
    }

    const assignments = await repository.listReviewAssignments(paperId);
    const complete = areRequiredReviewsComplete({
      assignments,
      requiredCount: paper.requiredReviewCount,
    });

    const requiredAssignments = (assignments || []).filter((entry) => Boolean(entry.required));
    const submittedRequiredCount = requiredAssignments.filter(
      (entry) => String(entry.status || "").toLowerCase() === "submitted"
    ).length;

    return {
      type: "success",
      status: {
        paperId: paper.id,
        requiredCount: Number(paper.requiredReviewCount || 0),
        submittedRequiredCount,
        complete,
      },
    };
  }

  return {
    getReviewStatus,
  };
}

module.exports = {
  createReviewStatusService,
};
