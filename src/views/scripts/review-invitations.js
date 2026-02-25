(function () {
  const state = {
    status: "pending",
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  const refs = {
    list: document.querySelector("[data-list]"),
    loading: document.querySelector("[data-loading]"),
    empty: document.querySelector("[data-empty]"),
    errorBanner: document.querySelector("[data-error-banner]"),
    errorMessage: document.querySelector("[data-error-message]"),
    errorRetry: document.querySelector("[data-error-retry]"),
    filter: document.querySelector("[data-filter-status]"),
    prev: document.querySelector("[data-page-prev]"),
    next: document.querySelector("[data-page-next]"),
    pageLabel: document.querySelector("[data-page-label]"),
  };

  function setLoading(isLoading) {
    if (!refs.loading) {
      return;
    }
    refs.loading.hidden = !isLoading;
  }

  function hideError() {
    if (refs.errorBanner) {
      refs.errorBanner.hidden = true;
    }
  }

  function showError(message) {
    if (!refs.errorBanner) {
      return;
    }
    refs.errorBanner.hidden = false;
    if (refs.errorMessage) {
      refs.errorMessage.textContent = message || "We could not load invitations right now. Please try again.";
    }
  }

  async function request(url, options) {
    const startedAt = performance.now();
    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    const duration = performance.now() - startedAt;
    if (duration > 2000) {
      console.warn("review_invitations_slow_load", { duration_ms: Math.round(duration) });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "Request failed");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function setPager(page, totalPages) {
    state.page = page;
    state.totalPages = totalPages;
    if (refs.pageLabel) {
      refs.pageLabel.textContent = `Page ${page} of ${totalPages}`;
    }
    if (refs.prev) {
      refs.prev.disabled = page <= 1;
    }
    if (refs.next) {
      refs.next.disabled = page >= totalPages;
    }
  }

  function renderItems(items) {
    if (!refs.list) {
      return;
    }

    refs.list.innerHTML = "";
    if (!items.length) {
      if (refs.empty) {
        refs.empty.hidden = false;
      }
      return;
    }

    if (refs.empty) {
      refs.empty.hidden = true;
    }

    for (const item of items) {
      const li = document.createElement("li");
      li.className = "review-invitations__item";
      li.innerHTML = `
        <section>
          <strong>${item.paperTitle}</strong>
          <p class="review-invitations__meta">Status: ${item.status} | Due: ${item.responseDueAt || "N/A"}</p>
        </section>
        <div class="review-invitations__actions">
          <button type="button" data-action="accept" data-id="${item.id}" ${
        item.status !== "pending" ? "disabled" : ""
      }>Accept</button>
          <button type="button" data-action="reject" data-id="${item.id}" ${
        item.status !== "pending" ? "disabled" : ""
      }>Reject</button>
        </div>
      `;
      refs.list.appendChild(li);
    }
  }

  async function loadInvitations() {
    hideError();
    setLoading(true);
    try {
      const query = new URLSearchParams({
        status: state.status,
        page: String(state.page),
        page_size: String(state.pageSize),
      });
      const payload = await request(`/api/review-invitations?${query.toString()}`);
      renderItems(payload.items || []);
      setPager(payload.page || 1, payload.totalPages || 1);
    } catch (_error) {
      showError("We could not load invitations right now. Please try again.");
      if (refs.empty) {
        refs.empty.hidden = true;
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitAction(invitationId, action) {
    try {
      await request(`/api/review-invitations/${encodeURIComponent(invitationId)}/${action}`, {
        method: "POST",
      });
      await loadInvitations();
    } catch (_error) {
      showError("We could not update this invitation. Please try again.");
    }
  }

  function onListClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = target.getAttribute("data-action");
    const invitationId = target.getAttribute("data-id");
    if (!action || !invitationId) {
      return;
    }
    submitAction(invitationId, action);
  }

  function bindEvents() {
    if (refs.filter) {
      refs.filter.addEventListener("change", () => {
        state.status = refs.filter.value;
        state.page = 1;
        loadInvitations();
      });
    }

    if (refs.prev) {
      refs.prev.addEventListener("click", () => {
        if (state.page > 1) {
          state.page -= 1;
          loadInvitations();
        }
      });
    }

    if (refs.next) {
      refs.next.addEventListener("click", () => {
        if (state.page < state.totalPages) {
          state.page += 1;
          loadInvitations();
        }
      });
    }

    if (refs.errorRetry) {
      refs.errorRetry.addEventListener("click", () => {
        loadInvitations();
      });
    }

    if (refs.list) {
      refs.list.addEventListener("click", onListClick);
    }
  }

  bindEvents();
  loadInvitations();
  setInterval(loadInvitations, 60 * 1000);
})();
