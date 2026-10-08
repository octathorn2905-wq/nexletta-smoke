import { expect, test } from '@playwright/test';
import { foreignCaseId, SmokeError } from './helpers/env';
import { annotate, expectModuleBlocked, noteActual, signIn, waitForShell } from './helpers/session';

test.describe('Provider', () => {
  test('Dashboard opens with this provider\'s cases only', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Provider',
      expected: 'Provider dashboard opens and lists only this provider\'s cases.',
      steps: [
        'Sign in as Provider.',
        'Read the provider name in the header.',
        'Confirm the dashboard is scoped to that provider and does not show another provider\'s case label.',
      ],
    });
    await signIn(page, 'provider', 'PROVIDER');
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeVisible();
    const header = (await page.locator('body').innerText()).slice(0, 400);
    const name = header.match(/Portal\s+(.+?)\s+Provider/i)?.[1]?.trim() || 'this provider';
    const foreign = foreignCaseId();
    const body = await page.locator('body').innerText();
    if (body.includes(foreign)) {
      throw new SmokeError('application', `Provider dashboard includes case ${foreign}, which is assigned to another provider.`);
    }
    await noteActual(testInfo, `Dashboard for "${name}" at ${page.url()} does not include ${foreign}.`);
  });

  test('One assigned case opens and the evaluation form opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Provider',
      expected: 'One assigned case opens and its evaluation form is visible. The form is not submitted.',
      steps: [
        'Sign in as Provider.',
        'Open the first assigned case from the dashboard or cases list.',
        'Open the evaluation form.',
        'Leave without submitting.',
      ],
    });
    await signIn(page, 'provider', 'PROVIDER');
    const caseNav = page.getByRole('link', { name: /Cases|My Cases|Evaluations/i }).first();
    if (await caseNav.isVisible().catch(() => false)) {
      await caseNav.click();
      await waitForShell(page);
    }
    const row = page.locator('[role="row"][data-id^="NXL-"], table tbody tr').filter({ hasText: /NXL-/ }).first();
    const direct = page.getByRole('link', { name: /NXL-\d{4}-\d+/ }).first();
    let opened = '';
    if (await row.isVisible().catch(() => false)) {
      opened = ((await row.getAttribute('data-id')) || (await row.innerText())).replace(/\s+/g, ' ').trim();
      const opener = row.getByRole('button', { name: /Edit \/ Open|Open/i });
      if (await opener.count()) await opener.first().click();
      else await row.click();
    } else if (await direct.isVisible().catch(() => false)) {
      opened = (await direct.innerText()).trim();
      await direct.click();
    } else {
      throw new SmokeError('test-data', 'Provider signed in, but no assigned case was listed to open.');
    }
    await waitForShell(page);
    const evaluation = page
      .getByRole('link', { name: /Evaluation/i })
      .or(page.getByRole('button', { name: /Evaluation/i }))
      .or(page.getByRole('tab', { name: /Evaluation/i }))
      .first();
    if (await evaluation.isVisible().catch(() => false)) {
      await evaluation.click();
      await waitForShell(page);
    }
    const form = page.locator('form, textarea, [role="textbox"]').first();
    const evalHeading = page.getByRole('heading', { name: /Evaluation/i }).first();
    const formVisible = await form.isVisible().catch(() => false);
    const headingVisible = await evalHeading.isVisible().catch(() => false);
    if (!formVisible && !headingVisible) {
      const labels = (await page.getByRole('link').allInnerTexts()).join(', ');
      throw new SmokeError(
        'application',
        `Assigned case "${opened}" opened at ${page.url()}, but no evaluation form or Evaluation heading was found. Links: ${labels}`,
      );
    }
    await noteActual(testInfo, `Opened assigned case "${opened.slice(0, 120)}" and the evaluation surface at ${page.url()} without submitting.`);
  });

  test('Another provider\'s case, Billing, and Settings do not open', async ({ page }, testInfo) => {
    const foreign = foreignCaseId();
    annotate(testInfo, {
      role: 'Provider',
      expected: `Case ${foreign}, Billing, and Settings do not open for this provider.`,
      steps: [
        'Sign in as Provider.',
        'Open one own case so the case URL pattern is known.',
        `Replace the case id with ${foreign} and open that URL.`,
        'Open billing and settings URLs directly.',
        'Confirm none of those pages open.',
      ],
    });
    await signIn(page, 'provider', 'PROVIDER');
    const caseNav = page.getByRole('link', { name: /Cases|My Cases/i }).first();
    if (await caseNav.isVisible().catch(() => false)) {
      await caseNav.click();
      await waitForShell(page);
    }
    const own = page.locator('[role="row"][data-id^="NXL-"]').first();
    let foreignUrl = '';
    if (await own.isVisible().catch(() => false)) {
      const id = await own.getAttribute('data-id');
      const opener = own.getByRole('button', { name: 'Edit / Open' });
      if (await opener.count()) await opener.click();
      else await own.click();
      await waitForShell(page);
      if (id && page.url().includes(id)) foreignUrl = page.url().replace(id, foreign);
    }
    if (!foreignUrl) {
      const origin = new URL(page.url()).origin;
      foreignUrl = `${origin}/provider/cases/${foreign}`;
    }
    await page.goto(foreignUrl, { waitUntil: 'domcontentloaded' });
    await waitForShell(page);
    if (page.url().includes(foreign) && (await page.getByText(foreign).first().isVisible().catch(() => false))) {
      const denied = await page.getByText(/not authorized|access denied|do not have access|not found/i).first().isVisible().catch(() => false);
      if (!denied) {
        throw new SmokeError('application', `Another provider's case opened at ${page.url()}.`);
      }
    }
    await expectModuleBlocked(page, '/staff/billing', 'Billing');
    const origin = new URL(page.url()).origin;
    for (const path of ['/provider/billing', '/provider/settings', '/provider/admin', '/staff/admin', '/staff/settings']) {
      await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
      await page.getByText(/Verifying user/i).waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
      const blockedHeading = page.getByRole('heading', { level: 2, name: /^(Billing|Settings|Admin Dashboard)$/ });
      if (await blockedHeading.first().isVisible().catch(() => false)) {
        const name = await blockedHeading.first().innerText();
        throw new SmokeError('application', `${name} opened for the provider at ${page.url()}.`);
      }
    }
    await noteActual(testInfo, `Foreign case URL ${foreignUrl} did not open the case. Billing and Settings headings were not shown.`);
  });
});
