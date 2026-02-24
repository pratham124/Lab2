const test = require("node:test");
const assert = require("node:assert/strict");

const { __test } = require("../../src/server");

test("server line 227 coverage: parseMultipartForm boundary regex paths", () => {
  const boundary = "line227b";
  const raw = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="title"\r\n\r\n` +
      `line-227\r\n` +
      `--${boundary}--\r\n`,
    "latin1"
  );

  const quoted = __test.parseMultipartForm(raw, `multipart/form-data; boundary="${boundary}"`);
  assert.equal(quoted.title, "line-227");

  const unquoted = __test.parseMultipartForm(raw, `multipart/form-data; boundary=${boundary}`);
  assert.equal(unquoted.title, "line-227");

  const missing = __test.parseMultipartForm(raw, "multipart/form-data");
  assert.deepEqual(missing, {});
});
