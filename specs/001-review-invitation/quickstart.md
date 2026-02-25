# Quickstart: Receive Review Invitation

## Manual Verification

1. Assign a reviewer to a submitted paper.
2. Log in as invited reviewer.
3. Open `/review-invitations.html`.
4. Verify:
   - Pending invitations appear by default.
   - List is newest-first and paginated after 20 items.
   - Accept/Reject works and updates status.
   - Keyboard-only navigation works for filter, pager, and action buttons.
   - Generic retry message appears if invitation retrieval fails.
   - A newly created invitation appears within one minute of assignment.

## API Checks

- `GET /api/review-invitations?status=pending&page=1&page_size=20`
- `POST /api/review-invitations/{invitationId}/accept`
- `POST /api/review-invitations/{invitationId}/reject`

## Performance Check

- Browser console should not show slow-load warning under normal conditions.
- If list load exceeds 2 seconds, warning `review_invitations_slow_load` is logged.

