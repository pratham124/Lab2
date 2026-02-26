# Acceptance Test Suite: UC-19 View Published Conference Schedule

## AT-UC19-01 Published schedule is publicly viewable

- Preconditions:
  - A schedule exists with `status=published`.
  - At least one complete entry has time and location.
- Steps:
  1. Open `/schedule` without login.
  2. Observe the page and the data loaded from `GET /schedule/published`.
- Expected:
  - Page loads without access denial.
  - API returns `200`.
  - UI shows schedule entries with time and location.

## AT-UC19-02 Unpublished schedule shows availability message

- Preconditions:
  - Schedule is absent or not published.
- Steps:
  1. Open `/schedule` or request `GET /schedule/published`.
- Expected:
  - API returns `404` with `ErrorMessage`.
  - UI shows a clear unpublished/unavailable message.
  - No schedule entries are displayed.

## AT-UC19-03 Retrieval failure shows retry-enabled error

- Preconditions:
  - Simulate retrieval failure in schedule data source.
- Steps:
  1. Request `GET /schedule/published`.
  2. Click retry in the UI.
- Expected:
  - API returns `503` with `{ message, canRetry: true }`.
  - UI shows user-facing error and retry action.
  - Retry triggers another `GET /schedule/published`.

## AT-UC19-04 Incomplete entries are hidden

- Preconditions:
  - Published schedule includes entries missing time or location.
- Steps:
  1. Request published schedule and render UI.
- Expected:
  - Entries lacking time or location are not shown.
  - Displayed entries always include both fields.

## AT-UC19-05 Optional filters return no-results state

- Preconditions:
  - Filter controls are present.
- Steps:
  1. Apply `day` and/or `session` filters with no matches.
  2. Reset filters.
- Expected:
  - API returns `200` with `entries=[]` for no match.
  - UI shows a “no results” message and reset option.
  - Reset restores unfiltered results.
