const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createManuscriptStorage } = require("../../src/services/manuscript_storage");

function makeTempRoot(prefix) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), prefix)), "private");
}

test("uc-05 manuscript_storage rejects public storage root", () => {
  assert.throws(
    () => createManuscriptStorage({ storageRoot: "/tmp/public/manuscripts" }),
    /outside public web root/
  );
});

test("uc-05 manuscript_storage save validates submission_id and handles forced failure cleanup", async () => {
  const root = makeTempRoot("uc05-storage-failure-");
  const storage = createManuscriptStorage({ storageRoot: root });

  await assert.rejects(
    () => storage.save({ submission_id: "", filename: "paper.pdf", contentBuffer: Buffer.from("x") }),
    /submission_id is required/
  );

  await assert.rejects(
    () =>
      storage.save({
        submission_id: "s1",
        filename: "paper.pdf",
        contentBuffer: Buffer.from("content"),
        forceFailure: true,
      }),
    (error) => error && error.code === "upload_failed"
  );

  await assert.rejects(
    () =>
      storage.save({
        submission_id: "../outside-root",
        filename: "paper.pdf",
        contentBuffer: Buffer.from("content"),
      }),
    /Attempted manuscript access outside storage root/
  );

  fs.mkdirSync(root, { recursive: true });
  assert.deepEqual(fs.readdirSync(root), []);
});

test("uc-05 manuscript_storage covers replacement, reads, delete branches, and missing lookups", async () => {
  const root = makeTempRoot("uc05-storage-");
  const storage = createManuscriptStorage({ storageRoot: root });

  assert.equal(await storage.getActiveBySubmissionId(undefined), null);
  assert.equal(await storage.getActiveBySubmissionId("missing"), null);
  assert.equal(await storage.readContent(undefined), null);
  assert.equal(await storage.readContent("missing"), null);
  assert.equal(await storage.deleteById(undefined), false);
  assert.equal(await storage.deleteById("missing"), false);
  assert.equal(storage.getPublicUrl(), null);

  const first = await storage.save({
    submission_id: "s1",
    filename: "v1.pdf",
    contentBuffer: "alpha",
  });
  assert.equal(fs.existsSync(first.file_path), true);

  const firstContent = await storage.readContent(first.file_id);
  assert.equal(firstContent.toString("utf8"), "alpha");

  const second = await storage.save({
    submission_id: "s1",
    filename: "v2.pdf",
    format: "pdf",
    contentBuffer: Buffer.from("beta"),
  });
  assert.equal(first.file_id !== second.file_id, true);
  assert.equal(fs.existsSync(first.file_path), false);

  const active = await storage.getActiveBySubmissionId("s1");
  assert.equal(active.file_id, second.file_id);
  assert.equal(active.format, "pdf");

  const third = await storage.save({
    submission_id: "s2",
    filename: "v3.pdf",
    contentBuffer: Buffer.from("gamma"),
  });
  assert.equal(fs.existsSync(third.file_path), true);
  const deletedExisting = await storage.deleteById(third.file_id);
  assert.equal(deletedExisting, true);
  assert.equal(fs.existsSync(third.file_path), false);

  const noNameOrFormat = await storage.save({
    submission_id: "s3",
    contentBuffer: Buffer.from("delta"),
  });
  assert.equal(noNameOrFormat.filename, "");
  assert.equal(noNameOrFormat.format, "");
  assert.equal(noNameOrFormat.file_path.endsWith(".bin"), true);

  fs.unlinkSync(second.file_path);
  assert.equal(await storage.readContent(second.file_id), null);

  const deleted = await storage.deleteById(second.file_id);
  assert.equal(deleted, true);
  assert.equal(await storage.getActiveBySubmissionId("s1"), null);
});
