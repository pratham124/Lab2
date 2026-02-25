const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { Readable, Writable } = require("stream");

const { createRepository } = require("../../src/services/repository");
const { createReviewStatusService } = require("../../src/services/review_status_service");
const { createDecisionService } = require("../../src/services/decision_service");
const { createDecisionNotificationService } = require("../../src/services/notification_service");
const { createDecisionController } = require("../../src/controllers/decision_controller");
const { createNotificationResendController } = require("../../src/controllers/notification_resend_controller");

function injectRequest(server, options, body) {
  return new Promise((resolve, reject) => {
    const reqBody = body ? Buffer.from(body, "utf8") : Buffer.alloc(0);
    let sent = false;
    const req = new Readable({
      read() {
        if (sent) {
          return;
        }
        sent = true;
        if (reqBody.length > 0) {
          this.push(reqBody);
        }
        this.push(null);
      },
    });
    req.method = options.method || "GET";
    req.url = options.path;
    req.headers = options.headers || {};

    const responseChunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        callback();
      },
    });
    res.writeHead = function writeHead(status, headers) {
      res.statusCode = status;
      res.headers = headers || {};
      return res;
    };
    res.end = function end(chunk) {
      if (chunk) {
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      resolve({
        status: res.statusCode || 200,
        headers: res.headers || {},
        body: Buffer.concat(responseChunks).toString("utf8"),
      });
      return res;
    };

    try {
      server.emit("request", req, res);
    } catch (error) {
      reject(error);
    }
  });
}

function createHarness({
  incompletePaperIds,
  failDecisionSaveForPaperId,
  notificationFailureMode,
} = {}) {
  const store = {
    submissions: [
      {
        submission_id: "P1",
        title: "UC-15 Paper One",
        author_id: "author_1",
        required_review_count: 2,
        authors: [
          { id: "author_1", email: "a1@example.com" },
          { id: "author_2", email: "a2@example.com" },
        ],
      },
      {
        submission_id: "P2",
        title: "UC-15 Paper Two",
        author_id: "author_3",
        required_review_count: 2,
        authors: [
          { id: "author_3", email: "a3@example.com" },
          { id: "author_4", email: "a4@example.com" },
        ],
      },
      {
        submission_id: "P3",
        title: "UC-15 Paper Three",
        author_id: "author_5",
        required_review_count: 2,
        authors: [
          { id: "author_5", email: "a5@example.com" },
          { id: "author_6", email: "a6@example.com" },
        ],
      },
    ],
    reviewAssignments: [
      { paperId: "P1", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P1", reviewerId: "r2", status: "submitted", required: true },
      { paperId: "P2", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P2", reviewerId: "r2", status: "submitted", required: true },
      { paperId: "P3", reviewerId: "r1", status: "submitted", required: true },
      { paperId: "P3", reviewerId: "r2", status: "submitted", required: true },
    ],
    notificationAttempts: [],
  };

  for (const paperId of incompletePaperIds || []) {
    store.reviewAssignments = store.reviewAssignments.map((entry) => {
      if (entry.paperId === paperId && entry.reviewerId === "r2") {
        return { ...entry, status: "pending" };
      }
      return entry;
    });
  }

  const notificationDeliveries = [];

  const submissionRepository = {
    async findById(id) {
      return store.submissions.find((entry) => entry.submission_id === id) || null;
    },
    async upsertDecision({ submission_id, decision }) {
      if (submission_id === failDecisionSaveForPaperId) {
        throw new Error("DB_WRITE_FAILURE");
      }

      const paper = store.submissions.find((entry) => entry.submission_id === submission_id);
      if (!paper) {
        return null;
      }
      paper.final_decision = {
        ...(paper.final_decision || {}),
        ...decision,
      };
      return paper.final_decision;
    },
  };

  const repository = createRepository({ submissionRepository, store });
  const reviewStatusService = createReviewStatusService({ repository });
  const notificationService = createDecisionNotificationService({
    repository,
    notifier: {
      async sendDecisionNotification({ paper, author }) {
        notificationDeliveries.push({ paperId: paper.id, authorId: author.id });

        if (notificationFailureMode === "all") {
          throw new Error("NOTIFICATION_DOWN");
        }
        if (notificationFailureMode === "partial" && String(author.id).endsWith("2")) {
          throw new Error("NOTIFICATION_DOWN");
        }
      },
    },
  });

  const decisionService = createDecisionService({
    repository,
    reviewStatusService,
    notificationService,
  });

  const sessionService = {
    validate(sessionId) {
      if (sessionId === "sid_editor") {
        return { user_id: "editor_1", role: "editor" };
      }
      if (sessionId === "sid_author_1") {
        return { user_id: "author_1", role: "author" };
      }
      if (sessionId === "sid_author_3") {
        return { user_id: "author_3", role: "author" };
      }
      if (sessionId === "sid_author_5") {
        return { user_id: "author_5", role: "author" };
      }
      if (sessionId === "sid_non_editor") {
        return { user_id: "author_x", role: "author" };
      }
      return null;
    },
  };

  const decisionController = createDecisionController({ decisionService, sessionService });
  const resendController = createNotificationResendController({
    decisionService,
    sessionService,
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    function send(result) {
      res.writeHead(result.status, result.headers || {});
      res.end(result.body || "");
    }

    function parseJsonBody() {
      return new Promise((resolve) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
          } catch (_error) {
            resolve({});
          }
        });
      });
    }

    if (req.method === "POST" && /^\/papers\/[A-Za-z0-9_-]+\/decision$/.test(url.pathname)) {
      const paperId = url.pathname.split("/")[2] || "";
      const body = await parseJsonBody();
      return send(
        await decisionController.handlePostDecision({
          headers: req.headers,
          params: { paper_id: paperId },
          body,
        })
      );
    }

    if (req.method === "GET" && /^\/papers\/[A-Za-z0-9_-]+\/decision$/.test(url.pathname)) {
      const paperId = url.pathname.split("/")[2] || "";
      return send(
        await decisionController.handleGetDecision({
          headers: req.headers,
          params: { paper_id: paperId },
        })
      );
    }

    if (
      req.method === "POST" &&
      /^\/papers\/[A-Za-z0-9_-]+\/decision\/notifications\/resend$/.test(url.pathname)
    ) {
      const paperId = url.pathname.split("/")[2] || "";
      return send(
        await resendController.handlePostResend({
          headers: req.headers,
          params: { paper_id: paperId },
        })
      );
    }

    send({ status: 404, headers: { "Content-Type": "application/json" }, body: "{}" });
  });

  return {
    server,
    store,
    notificationDeliveries,
  };
}

async function withServer(options, run) {
  const harness = createHarness(options);
  await run(harness.server, harness);
}

function jsonHeaders(sessionId) {
  return {
    cookie: `cms_session=${sessionId}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

test("UC-15 integration happy path: record decision, notify authors, and author can view decision", async () => {
  await withServer({}, async (server, harness) => {
    const payload = JSON.stringify({ outcome: "accept" });

    const postResponse = await injectRequest(
      server,
      {
        path: "/papers/P1/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(postResponse.status, 200);
    const postBody = JSON.parse(postResponse.body);
    assert.equal(postBody.final, true);
    assert.equal(postBody.notificationStatus, "sent");

    const getResponse = await injectRequest(server, {
      path: "/papers/P1/decision",
      method: "GET",
      headers: jsonHeaders("sid_author_1"),
    });

    assert.equal(getResponse.status, 200);
    const getBody = JSON.parse(getResponse.body);
    assert.equal(getBody.paperId, "P1");
    assert.equal(getBody.paperTitle, "UC-15 Paper One");
    assert.equal(getBody.outcome, "accept");
    assert.equal(getBody.final, true);

    assert.equal(harness.notificationDeliveries.length, 2);
  });
});

test("UC-15 integration invalid input: invalid outcome returns 400", async () => {
  await withServer({}, async (server) => {
    const payload = JSON.stringify({ outcome: "hold" });

    const response = await injectRequest(
      server,
      {
        path: "/papers/P1/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(response.status, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.message, "Outcome must be accept or reject.");
  });
});

test("UC-15 integration expected failure: block decision when required reviews are incomplete", async () => {
  await withServer({ incompletePaperIds: ["P2"] }, async (server, harness) => {
    const payload = JSON.stringify({ outcome: "reject" });

    const response = await injectRequest(
      server,
      {
        path: "/papers/P2/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(response.status, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.message, "Decision cannot be sent until all required reviews are submitted.");

    const paper = harness.store.submissions.find((entry) => entry.submission_id === "P2");
    assert.equal(paper.final_decision, undefined);
    assert.equal(harness.notificationDeliveries.length, 0);
  });
});

test("UC-15 integration expected failure: notification failure keeps stored decision", async () => {
  await withServer({ notificationFailureMode: "all" }, async (server, harness) => {
    const payload = JSON.stringify({ outcome: "accept" });

    const postResponse = await injectRequest(
      server,
      {
        path: "/papers/P3/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(postResponse.status, 200);
    const postBody = JSON.parse(postResponse.body);
    assert.equal(postBody.notificationStatus, "failed");
    assert.deepEqual(postBody.failedAuthors.sort(), ["author_5", "author_6"]);

    const getResponse = await injectRequest(server, {
      path: "/papers/P3/decision",
      method: "GET",
      headers: jsonHeaders("sid_author_5"),
    });

    assert.equal(getResponse.status, 200);
    const getBody = JSON.parse(getResponse.body);
    assert.equal(getBody.outcome, "accept");
    assert.equal(getBody.final, true);
  });
});

test("UC-15 integration expected failure: storage failure returns 500 and does not notify", async () => {
  await withServer({ failDecisionSaveForPaperId: "P1" }, async (server, harness) => {
    const payload = JSON.stringify({ outcome: "reject" });

    const response = await injectRequest(
      server,
      {
        path: "/papers/P1/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(response.status, 500);
    const body = JSON.parse(response.body);
    assert.equal(body.message, "Decision could not be saved or sent at this time.");

    const paper = harness.store.submissions.find((entry) => entry.submission_id === "P1");
    assert.equal(paper.final_decision, undefined);
    assert.equal(harness.notificationDeliveries.length, 0);
  });
});

test("UC-15 integration expected failure: non-editor cannot send decision", async () => {
  await withServer({}, async (server, harness) => {
    const payload = JSON.stringify({ outcome: "accept" });

    const response = await injectRequest(
      server,
      {
        path: "/papers/P1/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_non_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );

    assert.equal(response.status, 403);
    assert.equal(JSON.parse(response.body).message, "Only editors can send decisions.");

    const paper = harness.store.submissions.find((entry) => entry.submission_id === "P1");
    assert.equal(paper.final_decision, undefined);
  });
});

test("UC-15 integration expected failure: duplicate send is blocked and resend targets failed authors", async () => {
  await withServer({ notificationFailureMode: "partial" }, async (server, harness) => {
    const payload = JSON.stringify({ outcome: "accept" });

    const first = await injectRequest(
      server,
      {
        path: "/papers/P1/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );
    assert.equal(first.status, 200);
    assert.equal(JSON.parse(first.body).notificationStatus, "partial");

    const second = await injectRequest(
      server,
      {
        path: "/papers/P1/decision",
        method: "POST",
        headers: {
          ...jsonHeaders("sid_editor"),
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );
    assert.equal(second.status, 409);

    const beforeResendCount = harness.notificationDeliveries.length;
    const resend = await injectRequest(server, {
      path: "/papers/P1/decision/notifications/resend",
      method: "POST",
      headers: jsonHeaders("sid_editor"),
    });
    assert.equal(resend.status, 200);

    const resendBody = JSON.parse(resend.body);
    assert.equal(resendBody.notificationStatus, "failed");
    assert.deepEqual(resendBody.failedAuthors, ["author_2"]);

    const delta = harness.notificationDeliveries.slice(beforeResendCount);
    assert.deepEqual(delta.map((entry) => entry.authorId), ["author_2"]);
  });
});
