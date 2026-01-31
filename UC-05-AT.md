# Acceptance Test Suite — UC-05 Upload Manuscript File

## Overview

**Use Case**: UC-05 Upload Manuscript File  
**Objective**: Verify that an authenticated author can upload a manuscript in an accepted format (PDF/Word/LaTeX), that size/format rules are enforced, and that upload failures are handled safely.  
**In Scope**: File chooser/upload flow, format validation, size validation, association with current submission, retry behavior on failure.  
**Out of Scope**: Full paper submission persistence (handled by UC-04), “Save submission” draft behavior, virus scanning (not specified), multi-file packaging rules for LaTeX beyond what is implemented.

### Accepted Formats / Constraints

- Formats: PDF, Word, LaTeX
- Maximum size: 7MB (as per submission rules)

---

## AT-UC05-01 — Successful Upload (PDF)

**Priority**: High  
**Preconditions**:

- Author is registered and logged in.
- Author is in an active paper submission workflow (a “current submission” exists).
- File upload service is available.

**Test Data**:

- File: `manuscript.pdf`, size <= 7MB

**Steps**:

1. Navigate to the manuscript upload step during paper submission.
2. Choose `manuscript.pdf`.
3. Confirm/upload the selected file.

**Expected Results**:

- System accepts the file format.
- System validates file size within limit.
- File is uploaded successfully.
- File is associated with the current paper submission.
- System displays an upload success confirmation (e.g., filename shown).

**Pass/Fail Criteria**:

- PASS if file uploads and is linked to the current submission; FAIL otherwise.

---

## AT-UC05-02 — Successful Upload (Word)

**Priority**: Medium  
**Preconditions**: Same as AT-UC05-01

**Test Data**:

- File: `manuscript.docx`, size <= 7MB

**Steps**:

1. Go to manuscript upload step.
2. Choose `manuscript.docx`.
3. Upload.

**Expected Results**:

- Upload succeeds and file is associated with the current submission.
- Success confirmation shown.

**Pass/Fail Criteria**:

- PASS if Word upload works end-to-end; FAIL otherwise.

---

## AT-UC05-03 — Successful Upload (LaTeX)

**Priority**: Medium  
**Preconditions**: Same as AT-UC05-01

**Test Data**:

- File: `manuscript.tex` (or other accepted LaTeX upload artifact as implemented), size <= 7MB

**Steps**:

1. Go to manuscript upload step.
2. Choose the LaTeX file/artifact.
3. Upload.

**Expected Results**:

- System accepts the LaTeX upload in the implemented supported form.
- File is associated with the current submission.
- Success confirmation shown.

**Pass/Fail Criteria**:

- PASS if the system’s supported LaTeX upload path

# Acceptance Test Suite — UC-05 Upload Manuscript File

## Overview

**Use Case**: UC-05 Upload Manuscript File  
**Objective**: Verify that an authenticated author can upload a manuscript in an accepted format (PDF/Word/LaTeX), that size/format rules are enforced, and that upload failures are handled safely.  
**In Scope**: File chooser/upload flow, format validation, size validation, association with current submission, retry behavior on failure.  
**Out of Scope**: Full paper submission persistence (handled by UC-04), “Save submission” draft behavior, virus scanning (not specified), multi-file packaging rules for LaTeX beyond what is implemented.

### Accepted Formats / Constraints

- Formats: PDF, Word, LaTeX
- Maximum size: 7MB (as per submission rules)

---

## AT-UC05-01 — Successful Upload (PDF)

**Priority**: High  
**Preconditions**:

- Author is registered and logged in.
- Author is in an active paper submission workflow (a “current submission” exists).
- File upload service is available.

**Test Data**:

- File: `manuscript.pdf`, size <= 7MB

**Steps**:

1. Navigate to the manuscript upload step during paper submission.
2. Choose `manuscript.pdf`.
3. Confirm/upload the selected file.

**Expected Results**:

- System accepts the file format.
- System validates file size within limit.
- File is uploaded successfully.
- File is associated with the current paper submission.
- System displays an upload success confirmation (e.g., filename shown).

**Pass/Fail Criteria**:

- PASS if file uploads and is linked to the current submission; FAIL otherwise.

---

## AT-UC05-02 — Successful Upload (Word)

**Priority**: Medium  
**Preconditions**: Same as AT-UC05-01

**Test Data**:

- File: `manuscript.docx`, size <= 7MB

**Steps**:

1. Go to manuscript upload step.
2. Choose `manuscript.docx`.
3. Upload.

**Expected Results**:

- Upload succeeds and file is associated with the current submission.
- Success confirmation shown.

**Pass/Fail Criteria**:

- PASS if Word upload works end-to-end; FAIL otherwise.

---

## AT-UC05-03 — Successful Upload (LaTeX)

**Priority**: Medium  
**Preconditions**: Same as AT-UC05-01

**Test Data**:

- File: `manuscript.tex` (or other accepted LaTeX upload artifact as implemented), size <= 7MB

**Steps**:

1. Go to manuscript upload step.
2. Choose the LaTeX file/artifact.
3. Upload.

**Expected Results**:

- System accepts the LaTeX upload in the implemented supported form.
- File is associated with the current submission.
- Success confirmation shown.

**Pass/Fail Criteria**:

- PASS if the system’s supported LaTeX upload path succeeds; FAIL otherwise.

---

## AT-UC05-04 — Reject Unsupported File Format (Extension 3a)

**Priority**: High  
**Preconditions**:

- Author is logged in and in an active submission workflow.

**Test Data**:

- File: `manuscript.txt` (or `.png`, `.exe`), size <= 7MB

**Steps**:

1. Go to manuscript upload step.
2. Choose `manuscript.txt`.
3. Upload.

**Expected Results**:

- System rejects the upload due to invalid format.
- System displays an error message listing acceptable formats (PDF/Word/LaTeX).
- No file is stored or associated with the submission.

**Pass/Fail Criteria**:

- PASS if unsupported formats are blocked; FAIL otherwise.

---

## AT-UC05-05 — Reject Oversized File (> 7MB) (Extension 4a)

**Priority**: High  
**Preconditions**:

- Author is logged in and in an active submission workflow.

**Test Data**:

- File: `large_manuscript.pdf`, size > 7MB

**Steps**:

1. Go to manuscript upload step.
2. Choose `large_manuscript.pdf`.
3. Upload.

**Expected Results**:

- System rejects the upload due to size limit violation.
- System displays an error message indicating maximum allowed size.
- No file is stored or associated with the submission.

**Pass/Fail Criteria**:

- PASS if oversized files are blocked; FAIL otherwise.

---

## AT-UC05-06 — Handle Network/System Failure During Upload (Extension 5a)

**Priority**: High  
**Preconditions**:

- Author is logged in and in an active submission workflow.
- Simulate network interruption or upload service failure mid-upload.

**Test Data**:

- File: `manuscript.pdf`, size <= 7MB

**Steps**:

1. Start uploading `manuscript.pdf`.
2. Trigger a network/service failure during upload.

**Expected Results**:

- System reports upload failure with a non-technical message.
- System does not associate a partial/corrupt file with the submission.
- System provides a retry option (or allows reattempting upload).

**Pass/Fail Criteria**:

- PASS if failure is handled safely and retry is possible; FAIL otherwise.

---

## AT-UC05-07 — Retry Upload After Failure (Recovery Behavior)

**Priority**: Medium  
**Preconditions**:

- AT-UC05-06 executed and upload failed.
- Service/network restored.

**Test Data**:

- File: `manuscript.pdf`, size <= 7MB

**Steps**:

1. Retry the upload of `manuscript.pdf`.

**Expected Results**:

- Upload succeeds after retry.
- File is associated with the current submission.
- System shows a success confirmation.

**Pass/Fail Criteria**:

- PASS if user can recover by retrying; FAIL otherwise.

---

## AT-UC05-08 — Replace Previously Uploaded Manuscript

**Priority**: Medium  
**Preconditions**:

- Author is logged in and in an active submission workflow.
- A manuscript file is already uploaded and associated with the submission.

**Test Data**:

- Initial File: `manuscript_v1.pdf`, size <= 7MB
- Replacement File: `manuscript_v2.pdf`, size <= 7MB

**Steps**:

1. Upload `manuscript_v1.pdf` successfully.
2. Upload `manuscript_v2.pdf` for the same submission.

**Expected Results**:

- System associates the latest uploaded file with the submission (replacement behavior) **or** maintains versioning if implemented.
- The UI clearly indicates which manuscript is currently attached.
- No duplicate/confusing attachments appear unless versioning is intended.

**Pass/Fail Criteria**:

- PASS if replacement behavior is clear and consistent; FAIL otherwise.

---

## AT-UC05-09 — Authorization: Block Upload When Not Logged In

**Priority**: High  
**Preconditions**:

- User is not logged in.

**Test Data**:

- File: `manuscript.pdf`

**Steps**:

1. Attempt to access the upload endpoint/page directly.
2. Attempt to upload `manuscript.pdf`.

**Expected Results**:

- System blocks the upload (redirect to login or access denied).
- No file is stored or associated with any submission.

**Pass/Fail Criteria**:

- PASS if unauthenticated uploads are blocked; FAIL otherwise.

---

## AT-UC05-10 — Prevent Double-Upload on Double-Click

**Priority**: Low  
**Preconditions**:

- Author is logged in and in an active submission workflow.

**Test Data**:

- File: `manuscript.pdf`, size <= 7MB

**Steps**:

1. Choose `manuscript.pdf`.
2. Trigger upload twice quickly (double-click upload button or rapid submit).

**Expected Results**:

- System creates at most one stored upload artifact for the action.
- Submission shows one associated manuscript (or clearly versioned behavior if implemented).
- No server error/stack trace is shown.

**Pass/Fail Criteria**:

- PASS if duplication is prevented/handled cleanly; FAIL otherwise.

---

## Traceability (UC-05 Steps → Tests)

- **Main Success Scenario** → AT-UC05-01, AT-UC05-02, AT-UC05-03
- **Extension 3a (unsupported format)** → AT-UC05-04
- **Extension 4a (oversized file)** → AT-UC05-05
- **Extension 5a (system/network failure)** → AT-UC05-06, AT-UC05-07
- **Robustness & security** → AT-UC05-08, AT-UC05-09, AT-UC05-10
