const { createPaper } = require("../models/paper");
const { createReviewer } = require("../models/reviewer");
const { createAssignment } = require("../models/assignment");

function normalizeSeed(seed = {}) {
  const papers = Array.isArray(seed.papers) ? seed.papers : [];
  const reviewers = Array.isArray(seed.reviewers) ? seed.reviewers : [];
  const assignments = Array.isArray(seed.assignments) ? seed.assignments : [];

  return {
    papers,
    reviewers,
    assignments,
  };
}

function createDataAccess({ seed } = {}) {
  const normalized = normalizeSeed(seed);

  const papers = new Map(
    normalized.papers.map((paper) => {
      const model = createPaper(paper);
      return [model.id, model];
    })
  );

  const reviewers = new Map(
    normalized.reviewers.map((reviewer) => {
      const model = createReviewer(reviewer);
      return [model.id, model];
    })
  );

  const assignments = normalized.assignments.map((assignment) => createAssignment(assignment));

  function listSubmittedPapers() {
    return Array.from(papers.values()).filter((paper) => paper.status === "submitted");
  }

  function getPaperById(paperId) {
    return papers.get(String(paperId || "").trim()) || null;
  }

  function listEligibleReviewers() {
    return Array.from(reviewers.values()).filter((reviewer) => reviewer.eligibilityStatus);
  }

  function getReviewerById(reviewerId) {
    return reviewers.get(String(reviewerId || "").trim()) || null;
  }

  function getAssignmentsByPaperId(paperId) {
    const normalizedPaperId = String(paperId || "").trim();
    return assignments.filter((assignment) => assignment.paperId === normalizedPaperId);
  }

  function createAssignments({ paperId, reviewerIds } = {}) {
    const normalizedPaperId = String(paperId || "").trim();
    const targetPaper = getPaperById(normalizedPaperId);

    if (!targetPaper) {
      const error = new Error("invalid_paper");
      error.code = "invalid_paper";
      throw error;
    }

    const existing = getAssignmentsByPaperId(normalizedPaperId);
    if (existing.length > 0 || targetPaper.status === "assigned") {
      const error = new Error("already_assigned");
      error.code = "already_assigned";
      throw error;
    }

    const now = new Date().toISOString();
    const created = [];

    for (const reviewerId of reviewerIds || []) {
      const reviewer = getReviewerById(reviewerId);
      if (!reviewer) {
        const error = new Error("ineligible_reviewer");
        error.code = "ineligible_reviewer";
        throw error;
      }

      const assignment = createAssignment({
        paperId: normalizedPaperId,
        reviewerId,
        assignedAt: now,
      });

      assignments.push(assignment);
      reviewer.currentAssignmentCount += 1;
      created.push(assignment);
    }

    targetPaper.status = "assigned";
    targetPaper.assignedReviewerCount = created.length;

    return created;
  }

  return {
    listSubmittedPapers,
    getPaperById,
    listEligibleReviewers,
    getReviewerById,
    getAssignmentsByPaperId,
    createAssignments,
  };
}

module.exports = {
  createDataAccess,
};
