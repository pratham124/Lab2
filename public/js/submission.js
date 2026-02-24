(function initSubmissionForm() {
  const form = document.querySelector("[data-submission-form]");
  if (!form) {
    return;
  }

  const saveDraftButton = form.querySelector("[data-save-draft-button]");
  const submitButton = form.querySelector("[data-submit-button]");
  const draftIdInput = form.querySelector("[data-draft-id]");
  const draftSavedAtInput = form.querySelector("[data-draft-saved-at]");
  const draftMessageNode = document.querySelector("[data-draft-message]");
  const lastSavedNode = document.querySelector("[data-last-saved]");
  const storageKey = "cms_submission_draft_id";
  let draftSaveInFlight = false;

  function clearFieldErrors() {
    form.querySelectorAll("[data-field]").forEach((field) => field.classList.remove("has-error"));
    form.querySelectorAll("[data-error-for]").forEach((errorNode) => {
      errorNode.textContent = "";
    });
  }

  function renderFieldErrors(errors) {
    clearFieldErrors();
    Object.entries(errors || {}).forEach(([key, message]) => {
      if (!message) {
        return;
      }

      const field = form.querySelector(`[data-field="${key}"]`);
      const label = form.querySelector(`[data-error-for="${key}"]`);
      if (field) {
        field.classList.add("has-error");
      }
      if (label) {
        label.textContent = message;
      }
    });
  }

  function getOrCreateDraftId() {
    const current = draftIdInput ? String(draftIdInput.value || "").trim() : "";
    if (current) {
      try {
        window.localStorage.setItem(storageKey, current);
      } catch (error) {
        // Ignore storage errors.
      }
      return current;
    }

    let stored = "";
    try {
      stored = String(window.localStorage.getItem(storageKey) || "").trim();
    } catch (error) {
      stored = "";
    }

    const next = stored || `submission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (draftIdInput) {
      draftIdInput.value = next;
    }

    try {
      window.localStorage.setItem(storageKey, next);
    } catch (error) {
      // Ignore storage errors.
    }

    return next;
  }

  function readDraftPayload() {
    const fields = ["title", "abstract", "keywords", "affiliation", "contact_email"];
    return fields.reduce((acc, key) => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) {
        acc[key] = String(input.value || "");
      }
      return acc;
    }, {});
  }

  function setDraftMessage(message, isError) {
    if (!draftMessageNode) {
      return;
    }
    draftMessageNode.textContent = message || "";
    draftMessageNode.style.color = isError ? "#b42318" : "#0f5132";
  }

  function setLastSaved(savedAt) {
    if (draftSavedAtInput) {
      draftSavedAtInput.value = savedAt || "";
    }
    if (lastSavedNode) {
      lastSavedNode.textContent = savedAt || "";
    }
  }

  async function saveDraft() {
    if (!saveDraftButton || draftSaveInFlight) {
      return;
    }

    draftSaveInFlight = true;
    clearFieldErrors();
    setDraftMessage("", false);

    const originalLabel = saveDraftButton.textContent;
    saveDraftButton.setAttribute("disabled", "disabled");
    saveDraftButton.textContent = "Saving draft...";

    const draftId = getOrCreateDraftId();
    const data = readDraftPayload();
    const expectedSavedAt = draftSavedAtInput ? draftSavedAtInput.value : "";
    const idempotencyKey = `${draftId}:${JSON.stringify(data)}`;

    try {
      const response = await window.fetch(`/submissions/${encodeURIComponent(draftId)}/draft`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          data,
          expectedSavedAt,
          idempotency_key: idempotencyKey,
        }),
      });

      const payload = await response.json();
      if (response.status === 400) {
        renderFieldErrors(payload.fieldErrors || {});
        setDraftMessage(payload.message || "Draft could not be saved.", true);
        return;
      }

      if (!response.ok) {
        setDraftMessage(payload.message || "Draft could not be saved.", true);
        return;
      }

      setLastSaved(payload.savedAt || "");
      setDraftMessage(payload.message || "Draft saved successfully.", false);
    } catch (error) {
      setDraftMessage("Draft could not be saved. Please try again.", true);
    } finally {
      draftSaveInFlight = false;
      saveDraftButton.removeAttribute("disabled");
      saveDraftButton.textContent = originalLabel;
    }
  }

  const seed = document.getElementById("submission-field-errors");
  if (seed && seed.textContent.trim()) {
    try {
      renderFieldErrors(JSON.parse(seed.textContent));
    } catch (error) {
      // Ignore invalid embedded JSON and continue with empty state.
    }
  }

  getOrCreateDraftId();

  if (saveDraftButton) {
    saveDraftButton.addEventListener("click", saveDraft);
  }

  form.addEventListener("submit", () => {
    clearFieldErrors();
    if (submitButton) {
      submitButton.setAttribute("disabled", "disabled");
      submitButton.textContent = "Submitting...";
    }
    if (saveDraftButton) {
      saveDraftButton.setAttribute("disabled", "disabled");
    }
  });
})();
