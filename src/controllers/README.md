# Controller Wiring Notes

UC-15 decision notification workflow modules:
- `decision_controller.js`: POST/GET handlers for `/papers/{paperId}/decision` payloads.
- `notification_resend_controller.js`: POST handler for `/papers/{paperId}/decision/notifications/resend`.
- `response.js`: shared JSON response helpers.

Integration expectations:
- Wire controller calls from server routes after session resolution.
- Use `decision_service.js` with `repository.js`, `review_status_service.js`, and decision notification service.
- Keep legacy `decision-controller.js` routes for UC-07 compatibility unless route migration is planned.
