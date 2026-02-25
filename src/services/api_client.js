async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function request(url, { method = "GET", body } = {}) {
  const headers = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message = payload && payload.message ? payload.message : "Request failed";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function createApiClient({ baseUrl = "/api" } = {}) {
  return {
    listReviewInvitations({ status = "pending", page = 1, pageSize = 20 } = {}) {
      const query = new URLSearchParams({ status, page: String(page), page_size: String(pageSize) });
      return request(`${baseUrl}/review-invitations?${query.toString()}`);
    },
    respondToInvitation(invitationId, action) {
      return request(`${baseUrl}/review-invitations/${encodeURIComponent(invitationId)}/${action}`, {
        method: "POST",
      });
    },
  };
}

module.exports = {
  createApiClient,
  __test: {
    request,
    parseJsonSafe,
  },
};
