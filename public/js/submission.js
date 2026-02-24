(function initSubmissionForm() {
  const form = document.querySelector("[data-submission-form]");
  if (!form) {
    return;
  }

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

  const seed = document.getElementById("submission-field-errors");
  if (seed && seed.textContent.trim()) {
    try {
      renderFieldErrors(JSON.parse(seed.textContent));
    } catch (error) {
      // Ignore invalid embedded JSON and continue with empty state.
    }
  }

  form.addEventListener("submit", () => {
    clearFieldErrors();
    const submitButton = form.querySelector("[data-submit-button]");
    if (submitButton) {
      submitButton.setAttribute("disabled", "disabled");
      submitButton.textContent = "Submitting...";
    }
  });
})();
