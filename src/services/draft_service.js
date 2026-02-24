const { createDraftSubmission } = require("../models/draft_submission");
const {
  normalizeDraftData,
  validateProvidedDraftFields,
} = require("./validation_service");

function createDraftService({ submissionRepository, loggingService } = {}) {
  if (!submissionRepository) {
    throw new Error("submissionRepository is required");
  }

  const logger =
    loggingService &&
    typeof loggingService.logSaveFailure === "function" &&
    typeof loggingService.logUnauthorizedAccess === "function"
      ? loggingService
      : {
          logSaveFailure() {},
          logUnauthorizedAccess() {},
        };

  async function getDraft({ submission_id, author_id }) {
    const submissionId = String(submission_id || "").trim();
    const authorId = String(author_id || "").trim();

    if (!submissionId) {
      return {
        type: "validation_error",
        status: 400,
        message: "Submission id is required.",
      };
    }

    const draft = await submissionRepository.findDraftBySubmissionId(submissionId);
    if (!draft) {
      return {
        type: "not_found",
        status: 404,
        message: "Draft not found.",
      };
    }

    if (draft.author_id !== authorId) {
      logger.logUnauthorizedAccess({
        submission_id: submissionId,
        actor_author_id: authorId,
        owner_author_id: draft.author_id,
        action: "read",
      });

      return {
        type: "forbidden",
        status: 403,
        message: "Access denied.",
      };
    }

    return {
      type: "success",
      status: 200,
      draft,
    };
  }

  async function saveDraft({ submission_id, author_id, data, expected_saved_at } = {}) {
    const submissionId = String(submission_id || "").trim();
    const authorId = String(author_id || "").trim();

    if (!submissionId) {
      return {
        type: "validation_error",
        status: 400,
        message: "Submission id is required.",
        fieldErrors: {
          submission_id: "Submission id is required.",
        },
      };
    }

    const normalizedData = normalizeDraftData(data);
    const fieldErrors = validateProvidedDraftFields(normalizedData);
    if (Object.keys(fieldErrors).length > 0) {
      return {
        type: "validation_error",
        status: 400,
        message: "Please correct highlighted fields.",
        fieldErrors,
      };
    }

    try {
      const existing = await submissionRepository.findDraftBySubmissionId(submissionId);

      if (existing && existing.author_id !== authorId) {
        logger.logUnauthorizedAccess({
          submission_id: submissionId,
          actor_author_id: authorId,
          owner_author_id: existing.author_id,
          action: "write",
        });

        return {
          type: "forbidden",
          status: 403,
          message: "Access denied.",
        };
      }

      const conflictDetected =
        Boolean(existing) &&
        Boolean(expected_saved_at) &&
        String(existing.saved_at) !== String(expected_saved_at);

      const mergedData = {
        ...(existing ? existing.data : {}),
        ...normalizedData,
      };

      const draft = createDraftSubmission({
        draft_id: existing ? existing.draft_id : undefined,
        submission_id: submissionId,
        author_id: authorId,
        data: mergedData,
      });

      const persisted = await submissionRepository.upsertDraft(draft);
      return {
        type: "success",
        status: 200,
        draft: persisted,
        conflictDetected,
      };
    } catch (error) {
      logger.logSaveFailure({
        submission_id: submissionId,
        author_id: authorId,
        reason: "draft_save_failure",
        error_code: error && error.message ? error.message : "UNKNOWN_ERROR",
      });

      return {
        type: "system_error",
        status: 500,
        message: "Draft could not be saved. Please try again.",
      };
    }
  }

  return {
    getDraft,
    saveDraft,
  };
}

module.exports = {
  createDraftService,
};
