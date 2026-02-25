function createRepository({ submissionRepository, store } = {}) {
  const backingStore = store || {};
  if (!Array.isArray(backingStore.notificationAttempts)) {
    backingStore.notificationAttempts = [];
  }
  if (!Array.isArray(backingStore.reviewAssignments)) {
    backingStore.reviewAssignments = [];
  }

  function fromSubmission(submission) {
    if (!submission) {
      return null;
    }

    const authorIds = Array.isArray(submission.author_ids)
      ? submission.author_ids.map((entry) => String(entry))
      : submission.author_id
        ? [String(submission.author_id)]
        : [];

    const authors = Array.isArray(submission.authors)
      ? submission.authors
      : authorIds.map((id) => ({
          id,
          email: id === String(submission.author_id || "") ? submission.contact_email : "",
        }));

    return {
      id: String(submission.submission_id || submission.id || ""),
      title: String(submission.title || ""),
      requiredReviewCount: Number(submission.required_review_count || 0),
      authorIds,
      authors,
      finalDecision: submission.final_decision || null,
      reviewAssignments: Array.isArray(submission.review_assignments) ? submission.review_assignments : [],
    };
  }

  async function getPaperById(paperId) {
    if (!submissionRepository || typeof submissionRepository.findById !== "function") {
      return null;
    }
    const submission = await submissionRepository.findById(String(paperId || ""));
    return fromSubmission(submission);
  }

  async function getPaperTitleById(paperId) {
    const paper = await getPaperById(paperId);
    return paper ? paper.title : null;
  }

  async function getDecisionByPaperId(paperId) {
    const paper = await getPaperById(paperId);
    if (!paper || !paper.finalDecision) {
      return null;
    }

    const stored = paper.finalDecision;
    return {
      id: String(stored.decision_id || stored.id || ""),
      paperId: paper.id,
      outcome: String(stored.outcome || stored.decision_value || "").toLowerCase().replace("ed", ""),
      recordedAt: stored.recorded_at || stored.published_at || null,
      final: stored.final !== false,
      notificationStatus: stored.notification_status || stored.notificationStatus || "failed",
    };
  }

  async function saveDecision(decision) {
    if (!submissionRepository || typeof submissionRepository.upsertDecision !== "function") {
      throw new Error("submission_repository_not_available");
    }

    const storedDecision = {
      decision_id: decision.id,
      outcome: decision.outcome,
      decision_value: decision.outcome === "accept" ? "Accepted" : "Rejected",
      recorded_at: decision.recordedAt,
      published_at: decision.recordedAt,
      final: Boolean(decision.final),
      notification_status: decision.notificationStatus,
    };

    await submissionRepository.upsertDecision({
      submission_id: decision.paperId,
      decision: storedDecision,
    });

    return {
      ...decision,
    };
  }

  async function updateDecisionNotificationStatus({ paperId, notificationStatus }) {
    const decision = await getDecisionByPaperId(paperId);
    if (!decision) {
      return null;
    }

    return saveDecision({
      ...decision,
      notificationStatus,
    });
  }

  async function listReviewAssignments(paperId) {
    const fromStore = backingStore.reviewAssignments.filter(
      (assignment) => String(assignment.paperId || assignment.paper_id) === String(paperId)
    );
    if (fromStore.length > 0) {
      return fromStore;
    }

    const paper = await getPaperById(paperId);
    return paper ? paper.reviewAssignments : [];
  }

  async function recordNotificationAttempt(attempt) {
    backingStore.notificationAttempts.push(attempt);
    return attempt;
  }

  async function listNotificationAttemptsByDecisionId(decisionId) {
    return backingStore.notificationAttempts.filter(
      (attempt) => String(attempt.decisionId) === String(decisionId)
    );
  }

  async function listLatestFailedAuthorIdsByDecisionId(decisionId) {
    const attempts = await listNotificationAttemptsByDecisionId(decisionId);
    const latestByAuthor = new Map();
    for (const attempt of attempts) {
      const current = latestByAuthor.get(attempt.authorId);
      if (!current || String(attempt.attemptedAt) >= String(current.attemptedAt)) {
        latestByAuthor.set(attempt.authorId, attempt);
      }
    }

    return Array.from(latestByAuthor.values())
      .filter((attempt) => String(attempt.status) === "failed")
      .map((attempt) => attempt.authorId);
  }

  return {
    getPaperById,
    getPaperTitleById,
    getDecisionByPaperId,
    saveDecision,
    updateDecisionNotificationStatus,
    listReviewAssignments,
    recordNotificationAttempt,
    listNotificationAttemptsByDecisionId,
    listLatestFailedAuthorIdsByDecisionId,
  };
}

module.exports = {
  createRepository,
};
