function createRoutes({ submissionController, draftController, decisionController }) {
  return {
    isSubmissionGetForm(req, url) {
      return req.method === "GET" && (url.pathname === "/submissions/new" || url.pathname === "/submissions/new.html");
    },
    isSubmissionPost(req, url) {
      return req.method === "POST" && url.pathname === "/submissions";
    },
    isSubmissionConfirmation(req, url) {
      return req.method === "GET" && /^\/submissions\/[A-Za-z0-9_-]+$/.test(url.pathname);
    },
    async handleSubmissionGetForm(req) {
      return submissionController.handleGetForm({
        headers: req.headers,
        query: req.query || {},
      });
    },
    async handleSubmissionPost(req, body) {
      return submissionController.handlePost({ headers: req.headers, body });
    },
    async handleSubmissionConfirmation(req, url) {
      const submissionId = url.pathname.split("/")[2] || "";
      return submissionController.handleGetConfirmation({
        headers: req.headers,
        params: { submission_id: submissionId },
      });
    },
    isDraftGet(req, url) {
      return req.method === "GET" && /^\/submissions\/[A-Za-z0-9_-]+\/draft$/.test(url.pathname);
    },
    isDraftPut(req, url) {
      return req.method === "PUT" && /^\/submissions\/[A-Za-z0-9_-]+\/draft$/.test(url.pathname);
    },
    async handleDraftGet(req, url) {
      if (!draftController) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorCode: "not_found", message: "Not found." }),
        };
      }
      const submissionId = url.pathname.split("/")[2] || "";
      return draftController.handleGetDraft({
        headers: req.headers,
        params: { submission_id: submissionId },
      });
    },
    async handleDraftPut(req, url, body) {
      if (!draftController) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorCode: "not_found", message: "Not found." }),
        };
      }
      const submissionId = url.pathname.split("/")[2] || "";
      return draftController.handlePutDraft({
        headers: req.headers,
        body,
        params: { submission_id: submissionId },
      });
    },
    isPapersList(req, url) {
      return req.method === "GET" && url.pathname === "/papers";
    },
    isPaperDecisionGet(req, url) {
      return req.method === "GET" && /^\/papers\/[A-Za-z0-9_-]+\/decision$/.test(url.pathname);
    },
    async handlePapersList(req) {
      if (!decisionController) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorCode: "not_found", message: "Not found." }),
        };
      }
      return decisionController.handleListPapers({
        headers: req.headers,
      });
    },
    async handlePaperDecisionGet(req, url) {
      if (!decisionController) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorCode: "not_found", message: "Not found." }),
        };
      }
      const paperId = url.pathname.split("/")[2] || "";
      return decisionController.handleGetDecision({
        headers: req.headers,
        params: { paper_id: paperId },
      });
    },
  };
}

module.exports = {
  createRoutes,
};
