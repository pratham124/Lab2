const test = require("node:test");
const assert = require("node:assert/strict");

const { createManuscriptStorage } = require("../../src/services/manuscript_storage");

test("manuscript_storage covers save/hash buffer and non-buffer branches", async () => {
  const storage = createManuscriptStorage();

  // line 10 false branch and line 27 false branch (non-buffer input)
  const savedFromString = await storage.save({
    submission_id: "s1",
    filename: "f1.pdf",
    format: "pdf",
    contentBuffer: "abc",
  });
  const hashFromString = await storage.hash("abc");

  // line 10 true branch and line 27 true branch (buffer input)
  const savedFromBuffer = await storage.save({
    submission_id: "s2",
    filename: "f2.pdf",
    format: "pdf",
    contentBuffer: Buffer.from("abc"),
  });
  const hashFromBuffer = await storage.hash(Buffer.from("abc"));

  // line 10 and 27 fallback branch for (contentBuffer || "") when input is missing
  const savedFromMissing = await storage.save({
    submission_id: "s3",
    filename: "f3.pdf",
    format: "pdf",
  });
  const hashFromMissing = await storage.hash();

  assert.equal(savedFromString.size_bytes, 3);
  assert.equal(savedFromBuffer.size_bytes, 3);
  assert.equal(savedFromMissing.size_bytes, 0);
  assert.equal(savedFromString.content_hash, savedFromBuffer.content_hash);
  assert.equal(hashFromString, hashFromBuffer);
  assert.equal(hashFromMissing, savedFromMissing.content_hash);
});
