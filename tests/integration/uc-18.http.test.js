const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");
const {
  createAuthorPresentationDetailsController,
} = require("../../src/controllers/author_presentation_details_controller");

function requestRaw(baseUrl, options, body) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: options.path,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function withServer(options, run) {
  const { server } = createAppServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function makeSessionService() {
  return {
    validate(sessionId) {
      if (sessionId === "sid_admin") {
        return { user_id: "admin_1", role: "admin" };
      }
      if (sessionId === "sid_author1") {
        return { user_id: "author_1", role: "author" };
      }
      if (sessionId === "sid_author2") {
        return { user_id: "author_2", role: "author" };
      }
      return null;
    },
  };
}

async function generateSchedule(baseUrl) {
  const response = await requestRaw(
    baseUrl,
    {
      path: "/admin/conferences/C1/schedule/generate",
      method: "POST",
      headers: {
        Cookie: "cms_session=sid_admin",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
    JSON.stringify({ confirmReplace: true })
  );
  assert.equal(response.status, 200);
}

async function publishSchedule(baseUrl) {
  const response = await requestRaw(baseUrl, {
    path: "/api/admin/schedule/publish",
    method: "POST",
    headers: { Cookie: "cms_session=sid_admin", Accept: "application/json" },
  });
  assert.equal(response.status, 200);
  return JSON.parse(response.body);
}

test("UC-18 integration happy path: generate -> publish -> list -> details", async () => {
  await withServer({ sessionService: makeSessionService() }, async (baseUrl) => {
    await generateSchedule(baseUrl);
    const publishPayload = await publishSchedule(baseUrl);
    assert.equal(typeof publishPayload.publishedAt, "string");
    assert.equal(Number.isInteger(publishPayload.notificationsEnqueuedCount), true);
    assert.equal(publishPayload.notificationsEnqueuedCount > 0, true);

    const list = await requestRaw(baseUrl, {
      path: "/api/author/submissions",
      headers: { Cookie: "cms_session=sid_author2", Accept: "application/json" },
    });
    assert.equal(list.status, 200);
    const listPayload = JSON.parse(list.body);
    assert.equal(listPayload.submissions.length, 2);
    assert.equal(listPayload.submissions.every((entry) => entry.status === "accepted"), true);

    const details = await requestRaw(baseUrl, {
      path: "/api/author/submissions/P18B/presentation-details",
      headers: { Cookie: "cms_session=sid_author2", Accept: "application/json" },
    });
    assert.equal(details.status, 200);
    const detailsPayload = JSON.parse(details.body);
    assert.equal(detailsPayload.paperId, "P18B");
    assert.equal(typeof detailsPayload.date, "string");
    assert.equal(typeof detailsPayload.time, "string");
    assert.equal(typeof detailsPayload.session, "string");
    assert.equal(typeof detailsPayload.location, "string");
    assert.equal(detailsPayload.timezone, "UTC");
  });
});

test("UC-18 integration invalid input/auth paths return expected errors", async () => {
  await withServer({ sessionService: makeSessionService() }, async (baseUrl) => {
    const unauthList = await requestRaw(baseUrl, {
      path: "/api/author/submissions",
      headers: { Accept: "application/json" },
    });
    assert.equal(unauthList.status, 401);

    const forbiddenPublish = await requestRaw(baseUrl, {
      path: "/api/admin/schedule/publish",
      method: "POST",
      headers: { Cookie: "cms_session=sid_author1", Accept: "application/json" },
    });
    assert.equal(forbiddenPublish.status, 403);

    await generateSchedule(baseUrl);
    await publishSchedule(baseUrl);

    const unknownPaper = await requestRaw(baseUrl, {
      path: "/api/author/submissions/P404/presentation-details",
      headers: { Cookie: "cms_session=sid_author1", Accept: "application/json" },
    });
    assert.equal(unknownPaper.status, 404);
  });
});

test("UC-18 integration failure path: details blocked before final schedule publication", async () => {
  await withServer({ sessionService: makeSessionService() }, async (baseUrl) => {
    const detailsBeforePublish = await requestRaw(baseUrl, {
      path: "/api/author/submissions/P18A/presentation-details",
      headers: { Cookie: "cms_session=sid_author1", Accept: "application/json" },
    });
    assert.equal(detailsBeforePublish.status, 409);
    const payload = JSON.parse(detailsBeforePublish.body);
    assert.equal(payload.category, "schedule_not_published");
  });
});

test("UC-18 integration failure path: author cannot view another author's details", async () => {
  await withServer({ sessionService: makeSessionService() }, async (baseUrl) => {
    await generateSchedule(baseUrl);
    await publishSchedule(baseUrl);

    const forbidden = await requestRaw(baseUrl, {
      path: "/api/author/submissions/P18A/presentation-details",
      headers: { Cookie: "cms_session=sid_author2", Accept: "application/json" },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(JSON.parse(forbidden.body).category, "forbidden");
  });
});

test("UC-18 integration failure path: retrieval error returns friendly 503 payload", async () => {
  const customErrorController = createAuthorPresentationDetailsController({
    dataAccess: {
      getPaperById() {
        return { id: "P18A", conferenceId: "C1" };
      },
    },
    authorizationService: {
      canAccessAuthorPaper() {
        return true;
      },
    },
    scheduleService: {
      ensurePublished() {
        return { type: "published" };
      },
    },
    presentationDetailsService: {
      getByPaperId() {
        throw new Error("DB_DOWN");
      },
    },
    auditLogService: {
      logRetrievalError() {},
    },
    authService: {
      resolveActor() {
        return { id: "author_1", role: "author" };
      },
    },
  });

  await withServer(
    {
      sessionService: makeSessionService(),
      authorPresentationDetailsController: customErrorController,
    },
    async (baseUrl) => {
      const response = await requestRaw(baseUrl, {
        path: "/api/author/submissions/P18A/presentation-details",
        headers: { Cookie: "cms_session=sid_author1", Accept: "application/json" },
      });
      assert.equal(response.status, 503);
      const payload = JSON.parse(response.body);
      assert.equal(payload.category, "service_unavailable");
      assert.equal(typeof payload.nextStep, "string");
      assert.equal(payload.nextStep.length > 0, true);
      assert.equal(payload.reportIssueAvailable, true);
      assert.equal(payload.message.includes("DB_DOWN"), false);
    }
  );
});

test("UC-18 API exposes accepted submissions and per-paper details for an author", async () => {
  await withServer({ sessionService: makeSessionService() }, async (baseUrl) => {
    const response = await requestRaw(baseUrl, {
      path: "/api/author/submissions",
      headers: { Cookie: "cms_session=sid_author2", Accept: "application/json" },
    });
    assert.equal(response.status, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.submissions.length, 2);
    assert.equal(payload.submissions.every((entry) => entry.status === "accepted"), true);
    assert.equal(payload.submissions.every((entry) => entry.presentationDetails && entry.presentationDetails.paperId === entry.id), true);
  });
});

test("UC-18 API enforces published-only visibility and ownership checks", async () => {
  await withServer({ sessionService: makeSessionService() }, async (baseUrl) => {
    const beforePublish = await requestRaw(baseUrl, {
      path: "/api/author/submissions/P18A/presentation-details",
      headers: { Cookie: "cms_session=sid_author1", Accept: "application/json" },
    });
    assert.equal(beforePublish.status, 409);

    await requestRaw(
      baseUrl,
      {
        path: "/admin/conferences/C1/schedule/generate",
        method: "POST",
        headers: {
          Cookie: "cms_session=sid_admin",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
      JSON.stringify({ confirmReplace: true })
    );

    const publish = await requestRaw(baseUrl, {
      path: "/api/admin/schedule/publish",
      method: "POST",
      headers: { Cookie: "cms_session=sid_admin", Accept: "application/json" },
    });
    assert.equal(publish.status, 200);
    const publishPayload = JSON.parse(publish.body);
    assert.ok(publishPayload.publishedAt);
    assert.ok(Number(publishPayload.notificationsEnqueuedCount) > 0);

    const authorized = await requestRaw(baseUrl, {
      path: "/api/author/submissions/P18A/presentation-details",
      headers: { Cookie: "cms_session=sid_author1", Accept: "application/json" },
    });
    assert.equal(authorized.status, 200);
    const authorizedPayload = JSON.parse(authorized.body);
    assert.equal(authorizedPayload.paperId, "P18A");
    assert.ok(authorizedPayload.timezone);

    const forbidden = await requestRaw(baseUrl, {
      path: "/api/author/submissions/P18A/presentation-details",
      headers: { Cookie: "cms_session=sid_author2", Accept: "application/json" },
    });
    assert.equal(forbidden.status, 403);
  });
});
