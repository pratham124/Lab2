const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { createAppServer } = require("../../src/server");

function requestRaw(baseUrl, path) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path,
        method: "GET",
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
    req.end();
  });
}

async function withServer(run) {
  const { server } = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("UC-13 server serves review form and editor review scripts", async () => {
  await withServer(async (baseUrl) => {
    const reviewForm = await requestRaw(baseUrl, "/js/review_form.js");
    assert.equal(reviewForm.status, 200);
    assert.equal(reviewForm.headers["content-type"].includes("application/javascript"), true);
    assert.equal(reviewForm.body.includes("review-form"), true);

    const editorReviews = await requestRaw(baseUrl, "/js/editor_reviews.js");
    assert.equal(editorReviews.status, 200);
    assert.equal(editorReviews.headers["content-type"].includes("application/javascript"), true);
    assert.equal(editorReviews.body.includes("loadReviews"), true);
  });
});
