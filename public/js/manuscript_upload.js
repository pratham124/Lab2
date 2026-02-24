(function initManuscriptUploadForm() {
  const form = document.querySelector("[data-manuscript-upload-form]");
  if (!form) {
    return;
  }

  const submitButton = form.querySelector("[data-submit-button]");
  const retryMessage = form.querySelector("[data-retry-message]");
  const errorLabel = form.querySelector("[data-error-for='file']");
  const idempotencyInput = form.querySelector("[data-idempotency-token]");

  let isSubmitting = false;

  function refreshToken() {
    if (!idempotencyInput) {
      return;
    }
    const random = `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
    idempotencyInput.value = random;
  }

  refreshToken();

  form.addEventListener("submit", function onSubmit(event) {
    if (isSubmitting) {
      event.preventDefault();
      return;
    }

    const fileInput = form.querySelector("#file");
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      event.preventDefault();
      if (errorLabel) {
        errorLabel.textContent = "Select a manuscript file before submitting.";
      }
      return;
    }

    isSubmitting = true;
    if (submitButton) {
      submitButton.setAttribute("disabled", "disabled");
      submitButton.textContent = "Uploading...";
    }
  });

  window.addEventListener("pageshow", function onPageShow() {
    isSubmitting = false;
    refreshToken();
    if (submitButton) {
      submitButton.removeAttribute("disabled");
      submitButton.textContent = "Upload manuscript";
    }

    const inlineError = document.querySelector("[data-inline-error]");
    if (inlineError && inlineError.textContent.trim() && retryMessage) {
      retryMessage.hidden = false;
    }
  });
})();
