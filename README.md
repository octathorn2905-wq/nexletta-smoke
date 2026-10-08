# Nexletta smoke tests

Playwright checks that run after a deploy. Each role signs in, opens its main page, and does one real action. Roles that should be blocked are checked by opening the next role's URL directly.

The suite does not change the Nexletta application, except the Reviewer check: when a submitted evaluation is waiting, it changes that case's QA status so the case must show up in QA Review.

## Run

```bash
npm install
npx playwright install chromium
copy .env.example .env
npm run smoke
```

Put credentials only in `.env`. That file is not committed.

The browser stays visible. Set `SMOKE_HEADLESS=1` to hide it.

Reports land in `reports/`.
