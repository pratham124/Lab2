const MIN_COMMENT_LENGTH = 10;

const REVIEW_MESSAGES = {
  COMMENT_REQUIRED: "Comment is required.",
  COMMENT_TOO_SHORT: `Comment must be at least ${MIN_COMMENT_LENGTH} characters.`,
  DUPLICATE: "Only one submission is allowed for this paper.",
  IMMUTABLE: "This review has already been submitted and cannot be edited.",
  SAVE_FAILURE: "We could not submit your review right now. Please try again later.",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalFields(optionalFields = {}) {
  if (!optionalFields || typeof optionalFields !== "object") {
    return {};
  }
  const notes = normalizeText(optionalFields.notes);
  return notes ? { notes } : {};
}

function validateRequiredFields(requiredFields = {}) {
  const errors = {};
  const comment = normalizeText(requiredFields.comment);

  if (!comment) {
    errors.comment = REVIEW_MESSAGES.COMMENT_REQUIRED;
  } else if (comment.length < MIN_COMMENT_LENGTH) {
    errors.comment = REVIEW_MESSAGES.COMMENT_TOO_SHORT;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      comment,
    },
  };
}

function createReviewModel({ store, now = () => new Date() } = {}) {
  const backingStore = store || {};
  if (!Array.isArray(backingStore.reviews)) {
    backingStore.reviews = [];
  }

  function listByPaperId(paperId) {
    const normalizedPaperId = normalizeText(paperId);
    return backingStore.reviews.filter((review) => review.paper_id === normalizedPaperId);
  }

  function findByReviewerAndPaper({ reviewerId, paperId } = {}) {
    const normalizedReviewerId = normalizeText(reviewerId);
    const normalizedPaperId = normalizeText(paperId);
    return (
      backingStore.reviews.find(
        (review) =>
          review.reviewer_id === normalizedReviewerId && review.paper_id === normalizedPaperId
      ) || null
    );
  }

  function findDuplicate({ reviewerId, paperId } = {}) {
    return findByReviewerAndPaper({ reviewerId, paperId });
  }

  function isImmutable({ reviewerId, paperId } = {}) {
    return Boolean(findByReviewerAndPaper({ reviewerId, paperId }));
  }

  function create({ reviewerId, paperId, requiredFields, optionalFields, simulateFailure } = {}) {
    if (simulateFailure) {
      return { type: "failure", message: REVIEW_MESSAGES.SAVE_FAILURE };
    }

    const duplicate = findDuplicate({ reviewerId, paperId });
    if (duplicate) {
      return { type: "duplicate", message: REVIEW_MESSAGES.DUPLICATE, review: duplicate };
    }

    const validation = validateRequiredFields(requiredFields || {});
    if (!validation.valid) {
      return {
        type: "validation_error",
        message: "Review submission is invalid.",
        fieldErrors: validation.errors,
      };
    }

    const review = {
      review_id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      paper_id: normalizeText(paperId),
      reviewer_id: normalizeText(reviewerId),
      required_fields: validation.normalized,
      optional_fields: normalizeOptionalFields(optionalFields),
      status: "Submitted",
      submitted_at: now().toISOString(),
    };

    backingStore.reviews.push(review);

    return { type: "success", review };
  }

  return {
    MIN_COMMENT_LENGTH,
    REVIEW_MESSAGES,
    validateRequiredFields,
    create,
    listByPaperId,
    findByReviewerAndPaper,
    findDuplicate,
    isImmutable,
  };
}

module.exports = {
  MIN_COMMENT_LENGTH,
  REVIEW_MESSAGES,
  createReviewModel,
  validateRequiredFields,
};
