async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function requestJson(url, { method = "GET", headers = {}, body } = {}) {
  const mergedHeaders = {
    Accept: "application/json",
    ...headers,
  };
  if (body !== undefined && !mergedHeaders["Content-Type"]) {
    mergedHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers: mergedHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const payload = await parseJsonSafe(response);
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

if (typeof window !== "undefined") {
  window.ScheduleHttpClient = {
    requestJson,
  };
}

module.exports = {
  requestJson,
  __test: {
    parseJsonSafe,
  },
};
