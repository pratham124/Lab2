# Source Modules

This directory contains the CMS MVC server-side implementation and shared services.

## Upload Manuscript Module

UC-05 upload functionality is implemented across:
- `src/controllers/manuscript_controller.js`
- `src/routes/manuscripts.js`
- `src/services/manuscript_storage.js`
- `src/services/upload_validation.js`
- `src/services/upload_errors.js`
- `src/services/authz.js`
- `src/views/manuscripts/upload.html`
- `public/js/manuscript_upload.js`

## View Completed Reviews (UC-14)

Feature wiring notes:
- Controller: `src/controllers/completed_reviews_controller.js`
- Routes: `src/controllers/routes.js` and `src/server.js`
- View: `src/views/completed_reviews_view.js`
- Models: `src/models/paper.js`, `src/models/review.js`, `src/models/review_form_schema.js`
- Support: `src/controllers/authz.js`, `src/controllers/error_response.js`, `src/controllers/review_service.js`, `src/controllers/error_log.js`
