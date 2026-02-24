function setError(element, message) {
  if (!element) return;
  element.textContent = message || "";
  element.style.display = message ? "block" : "none";
}

function clearErrors(container) {
  setError(container.querySelector("[data-error-summary]"), "");
  setError(container.querySelector('[data-error-for="email"]'), "");
  setError(container.querySelector('[data-error-for="password"]'), "");
}

async function submitRegistration(form) {
  const email = form.querySelector("#email").value;
  const password = form.querySelector("#password").value;

  const response = await fetch("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (response.redirected) {
    window.location.assign(response.url);
    return;
  }

  if (response.status === 302) {
    const location = response.headers.get("Location");
    if (location) {
      window.location.assign(location);
      return;
    }
  }

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = { error: "Registration failed. Please try again." };
  }

  const fieldErrors = data.fieldErrors || {};
  setError(form.querySelector("[data-error-summary]"), data.error || "");
  setError(form.querySelector('[data-error-for="email"]'), fieldErrors.email || "");
  setError(
    form.querySelector('[data-error-for="password"]'),
    fieldErrors.password || ""
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-registration-form]");
  if (!form) return;

  const submitButton = form.querySelector("[data-submit-button]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(form);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      await submitRegistration(form);
    } catch (error) {
      setError(
        form.querySelector("[data-error-summary]"),
        "Registration failed. Please try again."
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Create account";
      }
    }
  });
});
