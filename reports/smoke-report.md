# Nexletta post-deployment smoke report

Overall Status: **NOT STABLE**

Generated: 2026-10-08T10:37:14.953Z

STABLE means every required role check passed. A failed application check or a blocked automation/test-data check keeps the release NOT STABLE.

## Summary

| Total tests | Passed | Failed | Blocked |
| --- | --- | --- | --- |
| 32 | 29 | 2 | 1 |

## Role-wise results

| Role | Total | Passed | Failed | Blocked | Result |
| --- | --- | --- | --- | --- | --- |
| Admin | 6 | 6 | 0 | 0 | PASS |
| Scheduler | 4 | 4 | 0 | 0 | PASS |
| Biller | 4 | 4 | 0 | 0 | PASS |
| Reviewer | 3 | 2 | 0 | 1 | FAIL |
| Organization | 4 | 2 | 2 | 0 | FAIL |
| Veteran | 5 | 5 | 0 | 0 | PASS |
| Representative | 3 | 3 | 0 | 0 | PASS |
| Provider | 3 | 3 | 0 | 0 | PASS |

## Failed and blocked tests

### FAILED: Organization — Sign-in lands on that organization's own bills

- Classification: application
- Path: Organization / Sign-in lands on that organization's own bills
- Expected: Organization sign-in lands on that organization's own bills, not the practice-wide dashboard.
- Actual: SmokeError: [application] Organization sign-in landed on https://staff.nexletta.com/staff/dashboard with heading "Dashboard", not that organization's bills.
- Reproduction steps:

1. Open the staff portal.
2. Sign in with the Organization account.
3. Read the landing page.

- Screenshot: artifacts/organization-Organization--2ba17-at-organization-s-own-bills-chromium/test-failed-1.png
- Trace: artifacts/organization-Organization--2ba17-at-organization-s-own-bills-chromium/trace.zip

```
SmokeError: [application] Organization sign-in landed on https://staff.nexletta.com/staff/dashboard with heading "Dashboard", not that organization's bills.
```

### FAILED: Organization — Veteran and representative do not see the organization invoice

- Classification: application
- Path: Organization / Veteran and representative do not see the organization invoice
- Expected: An invoice visible to the organization is not visible to the veteran account or the representative account.
- Actual: SmokeError: [application] Representative can see organization invoice INV-2026-0520.
- Reproduction steps:

1. Sign in as Organization and read the first invoice id.
2. Sign in as Veteran and open Billing. Confirm that invoice id is absent.
3. Sign in as Representative and open Billing. Confirm that invoice id is absent.

- Screenshot: artifacts/organization-Organization--8cc42-ee-the-organization-invoice-chromium/test-failed-1.png
- Trace: artifacts/organization-Organization--8cc42-ee-the-organization-invoice-chromium/trace.zip

```
SmokeError: [application] Representative can see organization invoice INV-2026-0520.
```

### BLOCKED: Reviewer — QA queue opens, one case in review opens, and Approve and Return are available

- Classification: test-data
- Path: Reviewer / QA queue opens, one case in review opens, and Approve and Return are available
- Expected: The QA queue opens, one case in review opens, and Approve and Return are available. Neither action is clicked.
- Actual: SmokeError: [test-data] QA queue opened, but Pending QA Review and In Review have no case. Approve and Return cannot be checked without a case in review. This is blocked test data.
- Reproduction steps:

1. Sign in as Reviewer.
2. Open QA Reviews.
3. Filter to Pending QA Review, then In Review if needed.
4. Open one case in review.
5. Confirm Approve and Return are available and do not click them.

- Screenshot: artifacts/reviewer-Reviewer-QA-queue-970cb-ve-and-Return-are-available-chromium/test-failed-1.png
- Trace: artifacts/reviewer-Reviewer-QA-queue-970cb-ve-and-Return-are-available-chromium/trace.zip

```
SmokeError: [test-data] QA queue opened, but Pending QA Review and In Review have no case. Approve and Return cannot be checked without a case in review. This is blocked test data.
```

Playwright process status: failed
