function createManuscriptRoutes({ manuscriptController }) {
  function isUploadFormRoute(req, url) {
    return req.method === "GET" && /^\/submissions\/[A-Za-z0-9_-]+\/manuscript\/upload$/.test(url.pathname);
  }

  function isUploadRoute(req, url) {
    return req.method === "POST" && /^\/submissions\/[A-Za-z0-9_-]+\/manuscript$/.test(url.pathname);
  }

  function isMetadataRoute(req, url) {
    return req.method === "GET" && /^\/submissions\/[A-Za-z0-9_-]+\/manuscript$/.test(url.pathname);
  }

  function submissionIdFromUrl(url) {
    return (url.pathname.split("/")[2] || "").trim();
  }

  async function handleUploadForm(req, url) {
    return manuscriptController.handleGetUploadForm({
      headers: req.headers,
      params: { submission_id: submissionIdFromUrl(url) },
    });
  }

  async function handleUpload(req, url, body) {
    return manuscriptController.handleUpload({
      headers: req.headers,
      params: { submission_id: submissionIdFromUrl(url) },
      body,
    });
  }

  async function handleMetadata(req, url) {
    return manuscriptController.handleGetMetadata({
      headers: req.headers,
      params: { submission_id: submissionIdFromUrl(url) },
    });
  }

  return {
    isUploadFormRoute,
    isUploadRoute,
    isMetadataRoute,
    handleUploadForm,
    handleUpload,
    handleMetadata,
  };
}

module.exports = {
  createManuscriptRoutes,
};
