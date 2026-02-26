(function scheduleViewScript() {
  function byId(id) {
    return document.getElementById(id);
  }

  function hasCompleteEntry(entry) {
    return Boolean(
      entry &&
        entry.timeSlot &&
        String(entry.timeSlot.startTime || "").trim() &&
        String(entry.timeSlot.endTime || "").trim() &&
        entry.location &&
        String(entry.location.name || "").trim()
    );
  }

  function setVisible(element, visible) {
    if (!element) {
      return;
    }
    element.classList.toggle("hidden", !visible);
  }

  function clearPanels(panels) {
    for (const panel of panels) {
      if (panel) {
        panel.innerHTML = "";
        setVisible(panel, false);
      }
    }
  }

  function renderEntries(entries) {
    const list = byId("schedule-list");
    if (!list) {
      return;
    }
    list.innerHTML = "";
    for (const entry of entries) {
      const item = document.createElement("li");
      item.innerHTML = `
        <div class="schedule-entry-title">${entry.title || "Session"}</div>
        <div class="schedule-entry-meta">
          ${entry.day || ""} | ${entry.timeSlot.startTime} - ${entry.timeSlot.endTime} | ${entry.location.name}
        </div>
      `;
      list.appendChild(item);
    }
    setVisible(byId("schedule-state"), true);
  }

  function buildQuery() {
    const day = String((byId("day-filter") && byId("day-filter").value) || "").trim();
    const session = String((byId("session-filter") && byId("session-filter").value) || "").trim();
    return { day, session };
  }

  function resetFilters() {
    if (byId("day-filter")) {
      byId("day-filter").value = "";
    }
    if (byId("session-filter")) {
      byId("session-filter").value = "";
    }
  }

  async function loadPublishedSchedule(options = {}) {
    const panels = [
      byId("error-state"),
      byId("unpublished-state"),
      byId("empty-state"),
      byId("schedule-state"),
    ];
    clearPanels(panels);

    const client = window.ScheduleHttpClient;
    if (!client || typeof client.requestJson !== "function") {
      return;
    }

    const query = options.reset ? { day: "", session: "" } : buildQuery();
    const params = new URLSearchParams();
    if (query.day) {
      params.set("day", query.day);
    }
    if (query.session) {
      params.set("session", query.session);
    }
    const suffix = params.toString();
    const response = await client.requestJson(`/schedule/published${suffix ? `?${suffix}` : ""}`);

    if (response.status === 404) {
      const panel = byId("unpublished-state");
      panel.textContent = (response.payload && response.payload.message) || "Schedule is not published yet.";
      setVisible(panel, true);
      return;
    }

    if (response.status === 503) {
      const panel = byId("error-state");
      panel.innerHTML = `<p>${(response.payload && response.payload.message) || "Schedule unavailable."}</p>`;
      if (response.payload && response.payload.canRetry) {
        const retryButton = document.createElement("button");
        retryButton.type = "button";
        retryButton.className = "retry-button";
        retryButton.textContent = "Retry";
        retryButton.addEventListener("click", function onRetryClick() {
          loadPublishedSchedule();
        });
        panel.appendChild(retryButton);
      }
      setVisible(panel, true);
      return;
    }

    const payload = response.payload || {};
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const displayable = entries.filter(hasCompleteEntry);
    if (displayable.length === 0) {
      const panel = byId("empty-state");
      panel.innerHTML =
        '<p>No schedule results matched your current view.</p><button id="reset-empty" type="button">Reset</button>';
      const reset = byId("reset-empty");
      if (reset) {
        reset.addEventListener("click", function onResetEmpty() {
          resetFilters();
          loadPublishedSchedule({ reset: true });
        });
      }
      setVisible(panel, true);
      return;
    }

    renderEntries(displayable);
  }

  const applyButton = byId("apply-filters");
  if (applyButton) {
    applyButton.addEventListener("click", function onApplyClick() {
      loadPublishedSchedule();
    });
  }

  const resetButton = byId("reset-filters");
  if (resetButton) {
    resetButton.addEventListener("click", function onResetClick() {
      resetFilters();
      loadPublishedSchedule({ reset: true });
    });
  }

  loadPublishedSchedule();
})();
