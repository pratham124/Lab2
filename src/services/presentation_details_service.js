function normalize(value) {
  return String(value || "").trim();
}

function createPresentationDetailsService({ dataAccess } = {}) {
  if (!dataAccess) {
    throw new Error("dataAccess is required");
  }

  function getByPaperId({ paperId } = {}) {
    const normalizedPaperId = normalize(paperId);
    if (!normalizedPaperId) {
      return { type: "not_found" };
    }

    if (typeof dataAccess.getPresentationDetailsByPaperId !== "function") {
      return { type: "not_found" };
    }

    const details = dataAccess.getPresentationDetailsByPaperId(normalizedPaperId);
    if (!details) {
      return { type: "not_found" };
    }
    return { type: "success", details };
  }

  function listByAuthorId({ authorId } = {}) {
    if (typeof dataAccess.listAcceptedPapersByAuthorId !== "function") {
      return [];
    }

    const papers = dataAccess.listAcceptedPapersByAuthorId(authorId);
    return papers
      .map((paper) => ({
        paper,
        details:
          typeof dataAccess.getPresentationDetailsByPaperId === "function"
            ? dataAccess.getPresentationDetailsByPaperId(paper.id)
            : null,
      }))
      .filter((entry) => entry.details);
  }

  function validatePaperDetailsMapping({ paperId, details } = {}) {
    const normalizedPaperId = normalize(paperId);
    if (!normalizedPaperId || !details) {
      return false;
    }
    return normalize(details.paperId) === normalizedPaperId;
  }

  return {
    getByPaperId,
    listByAuthorId,
    validatePaperDetailsMapping,
  };
}

module.exports = {
  createPresentationDetailsService,
};
