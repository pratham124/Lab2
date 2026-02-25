const REVIEW_MESSAGES = {
  required: "Comment is required.",
  tooShort: "Comment must be at least 10 characters.",
  unauthorized: "You are not authorized to submit a review for this paper.",
  invitation: "You must accept the review invitation before submitting.",
  duplicate: "Only one submission is allowed for this paper.",
  failure: "We could not submit your review right now. Please try again later.",
  success: "Review submitted successfully. It is now visible to the editor.",
  immutable: "This review has already been submitted and cannot be edited.",
};

function getFieldValue(form, name) {
  const field = form.querySelector(`[name="${name}"]`);
  return field ? String(field.value || "").trim() : "";
}

function setFieldError(form, name, message) {
  const container = form.querySelector(`[data-field-error="${name}"]`);
  if (container) {
    container.textContent = message || "";
  }
}

function clearFieldErrors(form) {
  form.querySelectorAll("[data-field-error]").forEach((node) => {
    node.textContent = "";
  });
}

function setMessage(form, message) {
  const messageContainer = form.closest(".review-form").querySelector(".review-form__message");
  if (messageContainer) {
    messageContainer.textContent = message || "";
  }
}

function setSuccess(form, message) {
  const success = form.closest(".review-form").querySelector("[data-success-message]");
  if (success) {
    success.textContent = message || "";
  }
}

function setImmutableMessage(form, message) {
  const immutable = form.closest(".review-form").querySelector("[data-immutable-message]");
  if (immutable) {
    immutable.textContent = message || "";
  }
}

function disableForm(form) {
  form.querySelectorAll("input, textarea, button").forEach((node) => {
    node.disabled = true;
  });
}

function validateClient(comment) {
  if (!comment) {
    return REVIEW_MESSAGES.required;
  }
  if (comment.length < 10) {
    return REVIEW_MESSAGES.tooShort;
  }
  return "";
}

async function submitReview(form) {
  const comment = getFieldValue(form, "comment");
  const notes = getFieldValue(form, "notes");
  const error = validateClient(comment);

  clearFieldErrors(form);
  setMessage(form, "");
  setSuccess(form, "");

  if (error) {
    setFieldError(form, "comment", error);
    return;
  }

  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        requiredFields: { comment },
        optionalFields: { notes },
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (response.status === 201) {
      setSuccess(form, payload.message || REVIEW_MESSAGES.success);
      disableForm(form);
      setImmutableMessage(form, REVIEW_MESSAGES.immutable);
      return;
    }

    if (response.status === 400) {
      const errors = payload.fieldErrors || {};
      setFieldError(form, "comment", errors.comment || REVIEW_MESSAGES.required);
      return;
    }

    if (response.status === 403) {
      setMessage(form, payload.message || REVIEW_MESSAGES.unauthorized);
      return;
    }

    if (response.status === 409) {
      setMessage(form, payload.message || REVIEW_MESSAGES.duplicate);
      disableForm(form);
      setImmutableMessage(form, REVIEW_MESSAGES.immutable);
      return;
    }

    setMessage(form, payload.message || REVIEW_MESSAGES.failure);
  } catch (_error) {
    setMessage(form, REVIEW_MESSAGES.failure);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("review-form");
  if (!form) {
    return;
  }

  const immutable = form.dataset.immutable === "true";
  if (immutable) {
    disableForm(form);
    setImmutableMessage(form, REVIEW_MESSAGES.immutable);
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitReview(form);
  });
});
