const { canViewDecision } = require("../lib/decision-visibility");

function createDecisionService({ submissionRepository, notificationService, visibilityPredicate } = {}) {
  if (!submissionRepository) {
    throw new Error("submissionRepository is required");
  }

  const canView = typeof visibilityPredicate === "function" ? visibilityPredicate : canViewDecision;
  const notifications =
    notificationService && typeof notificationService.notifyDecisionPublished === "function"
      ? notificationService
      : null;

  function toDecisionStatus(decision) {
    const value = decision && decision.decision_value;
    if (value === "Accepted" || value === "Rejected") {
      return value;
    }
    return null;
  }

  function sanitizeDecision(decision) {
    return {
      paper_id: String(decision.paper_id || ""),
      decision_value: toDecisionStatus(decision),
      published_at: decision.published_at || null,
    };
  }

  async function listDecisionsForAuthor({ author_id } = {}) {
    try {
      const authorId = String(author_id || "").trim();
      const submissions = await submissionRepository.findByAuthorId(authorId);

      const items = submissions.map((submission) => {
        const decision = submission.final_decision || null;
        const visible = canView({
          decision,
          requestingAuthorId: authorId,
          submittingAuthorId: submission.author_id,
        });

        return {
          paperId: submission.submission_id,
          title: submission.title || "",
          decisionPublished: Boolean(decision && decision.published_at),
          decisionStatus: visible ? toDecisionStatus(decision) : null,
        };
      });

      return {
        type: "success",
        status: 200,
        items,
      };
    } catch (error) {
      return {
        type: "retrieval_error",
        status: 503,
      };
    }
  }

  async function getDecisionForPaper({ paper_id, author_id } = {}) {
    const paperId = String(paper_id || "").trim();
    const authorId = String(author_id || "").trim();

    if (!paperId) {
      return {
        type: "validation_error",
        status: 400,
      };
    }

    try {
      const submission = await submissionRepository.findById(paperId);
      if (!submission) {
        return {
          type: "not_found",
          status: 404,
        };
      }

      if (String(submission.author_id || "") !== authorId) {
        return {
          type: "forbidden",
          status: 403,
        };
      }

      const decision = submission.final_decision || null;
      if (!decision) {
        return {
          type: "not_found",
          status: 404,
        };
      }

      if (!decision.published_at) {
        return {
          type: "unpublished",
          status: 409,
        };
      }

      const visible = canView({
        decision,
        requestingAuthorId: authorId,
        submittingAuthorId: submission.author_id,
      });
      if (!visible) {
        return {
          type: "forbidden",
          status: 403,
        };
      }

      return {
        type: "success",
        status: 200,
        decision: sanitizeDecision({
          ...decision,
          paper_id: submission.submission_id,
        }),
      };
    } catch (error) {
      return {
        type: "retrieval_error",
        status: 503,
      };
    }
  }

  async function publishDecision({ paper_id, decision_value, published_at } = {}) {
    const paperId = String(paper_id || "").trim();
    const decisionValue = String(decision_value || "").trim();
    const publishedAt = String(published_at || new Date().toISOString());

    if (!paperId || (decisionValue !== "Accepted" && decisionValue !== "Rejected")) {
      return {
        type: "validation_error",
        status: 400,
      };
    }

    try {
      const submission = await submissionRepository.findById(paperId);
      if (!submission) {
        return {
          type: "not_found",
          status: 404,
        };
      }

      const nextDecision = {
        paper_id: paperId,
        decision_value: decisionValue,
        published_at: publishedAt,
      };

      await submissionRepository.upsertDecision({
        submission_id: paperId,
        decision: nextDecision,
      });

      let notification = null;
      if (notifications) {
        notification = await notifications.notifyDecisionPublished({
          paper_id: paperId,
          submitting_author: {
            id: submission.author_id,
            email: submission.contact_email,
          },
        });
      }

      return {
        type: "success",
        status: 200,
        decision: sanitizeDecision(nextDecision),
        notification,
      };
    } catch (error) {
      return {
        type: "retrieval_error",
        status: 503,
      };
    }
  }

  return {
    listDecisionsForAuthor,
    getDecisionForPaper,
    publishDecision,
  };
}

module.exports = {
  createDecisionService,
};
