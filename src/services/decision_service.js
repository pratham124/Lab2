const { createDecision } = require("../models/decision");
const { createDecisionView } = require("../models/decision_view");
const { normalizeOutcome, isEditorRole } = require("./validation");

function createDecisionService({ repository, notificationService, reviewStatusService } = {}) {
  if (!repository) {
    throw new Error("repository is required");
  }
  if (!notificationService) {
    throw new Error("notificationService is required");
  }
  if (!reviewStatusService) {
    throw new Error("reviewStatusService is required");
  }

  async function recordDecision({ paperId, outcome, actor } = {}) {
    const id = String(paperId || "").trim();
    if (!id) {
      return { type: "validation_error", status: 400, message: "paperId is required." };
    }

    if (!isEditorRole(actor && actor.role)) {
      return { type: "forbidden", status: 403, message: "Only editors can send decisions." };
    }

    const normalizedOutcome = normalizeOutcome(outcome);
    if (!normalizedOutcome) {
      return { type: "validation_error", status: 400, message: "Outcome must be accept or reject." };
    }

    const paper = await repository.getPaperById(id);
    if (!paper) {
      return { type: "not_found", status: 404, message: "Paper not found." };
    }

    const existing = await repository.getDecisionByPaperId(id);
    if (existing && existing.final) {
      return { type: "conflict", status: 409, message: "Final decision already recorded." };
    }

    const reviewStatus = await reviewStatusService.getReviewStatus({ paperId: id });
    if (reviewStatus.type === "not_found") {
      return { type: "not_found", status: 404, message: "Paper not found." };
    }

    if (!reviewStatus.status.complete) {
      return {
        type: "validation_error",
        status: 400,
        message: "Decision cannot be sent until all required reviews are submitted.",
      };
    }

    let decision;
    try {
      decision = createDecision({
        paperId: id,
        outcome: normalizedOutcome,
        final: true,
        notificationStatus: "failed",
      });
      await repository.saveDecision(decision);
    } catch (_error) {
      return {
        type: "storage_error",
        status: 500,
        message: "Decision could not be saved or sent at this time.",
      };
    }

    const notify = await notificationService.sendDecisionNotifications({
      paper,
      decision,
      authors: Array.isArray(paper.authors) ? paper.authors : [],
    });

    await repository.updateDecisionNotificationStatus({
      paperId: id,
      notificationStatus: notify.notificationStatus,
    });

    return {
      type: "success",
      status: 200,
      decisionId: decision.id,
      final: true,
      notificationStatus: notify.notificationStatus,
      failedAuthors: notify.failedAuthors,
    };
  }

  async function resendFailedNotifications({ paperId, actor } = {}) {
    const id = String(paperId || "").trim();
    if (!id) {
      return { type: "validation_error", status: 400, message: "paperId is required." };
    }

    if (!isEditorRole(actor && actor.role)) {
      return { type: "forbidden", status: 403, message: "Only editors can resend notifications." };
    }

    const paper = await repository.getPaperById(id);
    if (!paper) {
      return { type: "not_found", status: 404, message: "Paper not found." };
    }

    const decision = await repository.getDecisionByPaperId(id);
    if (!decision) {
      return { type: "not_found", status: 404, message: "Decision not found." };
    }

    const resend = await notificationService.resendFailedDecisionNotifications({
      paper,
      decision,
      authors: Array.isArray(paper.authors) ? paper.authors : [],
    });

    if (resend.type === "not_found") {
      return { type: "not_found", status: 404, message: "No failed recipients to resend." };
    }

    await repository.updateDecisionNotificationStatus({
      paperId: id,
      notificationStatus: resend.notificationStatus,
    });

    return {
      type: "success",
      status: 200,
      notificationStatus: resend.notificationStatus,
      failedAuthors: resend.failedAuthors,
    };
  }

  async function getDecisionView({ paperId, actor } = {}) {
    const id = String(paperId || "").trim();
    if (!id) {
      return { type: "validation_error", status: 400, message: "paperId is required." };
    }

    const paper = await repository.getPaperById(id);
    if (!paper) {
      return { type: "not_found", status: 404, message: "Paper not found." };
    }

    const actorId = String((actor && actor.id) || "");
    if (!paper.authorIds.includes(actorId) && !isEditorRole(actor && actor.role)) {
      return { type: "forbidden", status: 403, message: "Access denied." };
    }

    const decision = await repository.getDecisionByPaperId(id);
    if (!decision) {
      return { type: "not_found", status: 404, message: "Decision not recorded." };
    }

    return {
      type: "success",
      status: 200,
      decision: createDecisionView({
        paperId: paper.id,
        paperTitle: paper.title,
        outcome: decision.outcome,
        recordedAt: decision.recordedAt,
        final: decision.final,
      }),
    };
  }

  return {
    recordDecision,
    resendFailedNotifications,
    getDecisionView,
  };
}

module.exports = {
  createDecisionService,
};
