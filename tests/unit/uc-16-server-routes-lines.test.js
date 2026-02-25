const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createAppServer } = require("../../src/server");

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

    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
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
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      resolve({
        status: res.statusCode || 200,
        headers: res.headers || {},
        body: Buffer.concat(chunks).toString("utf8"),
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

test("server UC-16 route param extraction uses conference segment for POST generate and GET schedule", async () => {
  const calls = [];
  const { server } = createAppServer({
    scheduleController: {
      async handleGenerate(input) {
        calls.push({ route: "generate", input });
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, route: "generate" }),
        };
      },
      async handleGetSchedule(input) {
        calls.push({ route: "view", input });
        return {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, route: "view" }),
        };
      },
    },
  });

  const post = await injectRequest(
    server,
    {
      method: "POST",
      path: "/admin/conferences/CONF_99/schedule/generate",
      headers: {
        host: "localhost",
        "content-type": "application/json",
        accept: "application/json",
      },
    },
    JSON.stringify({ confirmReplace: true })
  );
  assert.equal(post.status, 200);

  const get = await injectRequest(server, {
    method: "GET",
    path: "/admin/conferences/CONF_77/schedule",
    headers: {
      host: "localhost",
      accept: "application/json",
    },
  });
  assert.equal(get.status, 200);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].route, "generate");
  assert.equal(calls[0].input.params.conference_id, "CONF_99");
  assert.equal(calls[0].input.body.confirmReplace, true);

  assert.equal(calls[1].route, "view");
  assert.equal(calls[1].input.params.conference_id, "CONF_77");
});
