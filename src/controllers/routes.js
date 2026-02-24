function createRoutes({ submissionController }) {
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
      return submissionController.handleGetForm({ headers: req.headers });
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
  };
}

module.exports = {
  createRoutes,
};
