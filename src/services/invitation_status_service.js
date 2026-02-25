function createInvitationStatusService({ now = () => new Date() } = {}) {
  function refreshStatuses(invitations) {
    const current = now();
    let changed = 0;

    for (const invitation of invitations || []) {
      if (!invitation || invitation.status !== "pending" || !invitation.responseDueAt) {
        continue;
      }
      const due = new Date(invitation.responseDueAt);
      if (Number.isNaN(due.getTime())) {
        continue;
      }
      if (due.getTime() < current.getTime()) {
        invitation.status = "declined";
        invitation.respondedAt = current.toISOString();
        changed += 1;
      }
    }

    return { changed };
  }

  return {
    refreshStatuses,
  };
}

module.exports = {
  createInvitationStatusService,
};
