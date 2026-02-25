function createRouter({ reviewInvitationsController } = {}) {
  return {
    isReviewInvitationsPage(req, url) {
      return (
        req.method === "GET" &&
        (url.pathname === "/review-invitations" || url.pathname === "/review-invitations.html")
      );
    },
    isReviewInvitationsList(req, url) {
      return req.method === "GET" && url.pathname === "/api/review-invitations";
    },
    isReviewInvitationDetail(req, url) {
      return req.method === "GET" && /^\/api\/review-invitations\/[A-Za-z0-9_-]+$/.test(url.pathname);
    },
    isReviewInvitationAction(req, url) {
      return (
        (req.method === "POST" || req.method === "PATCH") &&
        /^\/api\/review-invitations\/[A-Za-z0-9_-]+\/(accept|reject)$/.test(url.pathname)
      );
    },
    async handleReviewInvitationsPage(req) {
      return reviewInvitationsController.handleGetPage({ headers: req.headers });
    },
    async handleReviewInvitationsList(req, url) {
      return reviewInvitationsController.handleList({
        headers: req.headers,
        query: {
          status: url.searchParams.get("status") || "pending",
          page: url.searchParams.get("page") || "1",
          page_size: url.searchParams.get("page_size") || "20",
        },
      });
    },
    async handleReviewInvitationDetail(req, url) {
      const invitationId = url.pathname.split("/")[3] || "";
      return reviewInvitationsController.handleGetDetail({
        headers: req.headers,
        params: { invitation_id: invitationId },
      });
    },
    async handleReviewInvitationAction(req, url) {
      const invitationId = url.pathname.split("/")[3] || "";
      const action = url.pathname.split("/")[4] || "";
      return reviewInvitationsController.handleAction({
        headers: req.headers,
        params: { invitation_id: invitationId, action },
      });
    },
  };
}

module.exports = {
  createRouter,
};
