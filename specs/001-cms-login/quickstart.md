# Quickstart: CMS User Login

## Purpose

Run the CMS login flow locally and validate UC-02 acceptance scenarios.

## Prerequisites

- Node.js LTS installed (no external packages required).
- A `data/users.json` file containing at least one registered user (e.g., `user1@example.com`).

## Start the app

1. From the repository root, start the server:
   - `node src/server.js`
2. Open the login page in a browser:
   - `http://localhost:3000/login.html`

## Run acceptance checks (manual)

- Follow the steps in `UC-02-AT.md` using the login page and the dashboard URL.
- Validate missing-field handling, repeated-failure recording, service-outage messaging, and whitespace trimming.

## Expected behavior

- Valid credentials redirect to `/dashboard`.
- Invalid or unknown credentials show clear errors and keep the user on the login page.
- Authenticated users are redirected away from the login page.
- Error messages are user-safe and do not reveal internal details or credential policy specifics.
