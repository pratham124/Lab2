(function registrationPricesPage() {
  const UNAVAILABLE_MESSAGE = "Pricing is not available.";
  const ERROR_MESSAGE = "Unable to retrieve pricing. Please try again shortly.";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setVisibility(element, visible) {
    if (!element) {
      return;
    }
    element.hidden = !visible;
  }

  async function loadPrices() {
    const loading = document.getElementById("pricing-loading");
    const empty = document.getElementById("pricing-empty");
    const error = document.getElementById("pricing-error");
    const list = document.getElementById("pricing-list");

    setVisibility(loading, true);
    setVisibility(empty, false);
    setVisibility(error, false);
    setVisibility(list, false);

    try {
      const response = await fetch("/api/registration-prices", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const payload = await response.json();
      setVisibility(loading, false);

      if (!response.ok) {
        error.textContent = payload.message || ERROR_MESSAGE;
        setVisibility(error, true);
        return;
      }

      if (payload.status === "unavailable") {
        empty.textContent = payload.message || UNAVAILABLE_MESSAGE;
        setVisibility(empty, true);
        return;
      }

      const categories = Array.isArray(payload.categories) ? payload.categories : [];
      if (categories.length === 0) {
        empty.textContent = UNAVAILABLE_MESSAGE;
        setVisibility(empty, true);
        return;
      }

      list.innerHTML = categories
        .map(
          (category) =>
            `<li class="price-item"><span class="category">${escapeHtml(category.name)}</span><span class="amount">${escapeHtml(category.display_amount)}</span></li>`
        )
        .join("");
      setVisibility(list, true);
    } catch (_error) {
      setVisibility(loading, false);
      error.textContent = ERROR_MESSAGE;
      setVisibility(error, true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPrices);
    return;
  }

  loadPrices();
})();
