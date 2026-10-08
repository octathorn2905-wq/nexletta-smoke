import { expect, test } from '@playwright/test';
import { SmokeError } from './helpers/env';
import { annotate, expectModuleBlocked, noteActual, openNav, signIn, waitForShell } from './helpers/session';

/**
 * QA appearance rule (saved for every smoke run):
 * An empty QA queue is not a release blocker.
 * Start from a submitted evaluation and set its status in the QA module
 * (Return for Correction, Approve, or another QA status).
 * The case must then appear in QA Review.
 * It is an application bug only when that status change does not make the case appear.
 */
const QA_FILTERS = ['Pending QA Review', 'In Review', 'Returned', 'Approved', 'On Hold'] as const;

async function rowsInFilter(page: import('@playwright/test').Page, filter: string) {
  await page.getByRole('button', { name: filter, exact: true }).click();
  await page.getByText(/Nexletta is loading/i).waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
  if (await page.getByText('No QA reviews match this filter.').isVisible().catch(() => false)) return [];
  const rows = page.locator('table tbody tr').filter({ hasNotText: 'No QA reviews' });
  const count = await rows.count();
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) labels.push((await rows.nth(i).innerText()).replace(/\s+/g, ' ').trim());
  return labels;
}

async function caseAppearsInQa(page: import('@playwright/test').Page, caseId: string): Promise<boolean> {
  for (const filter of QA_FILTERS) {
    const labels = await rowsInFilter(page, filter);
    if (labels.some((label) => label.includes(caseId))) return true;
  }
  return false;
}

async function reviewSubmittedEvaluation(page: import('@playwright/test').Page): Promise<string> {
  await expect(page.getByRole('heading', { level: 2, name: 'QA Reviews' })).toBeVisible();

  for (const filter of ['Pending QA Review', 'In Review'] as const) {
    const labels = await rowsInFilter(page, filter);
    if (labels.length === 0) continue;
    const row = page.locator('table tbody tr').filter({ hasNotText: 'No QA reviews' }).first();
    const label = labels[0];
    const caseId = label.match(/NXL-\d{4}-\d+/)?.[0] || '';
    await row.click();
    await waitForShell(page);
    const statusAction = page.getByRole('button', { name: /Return for Correction|Return for Revision|^Return$|^Approve$/i });
    if ((await statusAction.count()) > 0) {
      const actionName = ((await statusAction.first().innerText()) || 'QA status').trim();
      await statusAction.first().click();
      const confirm = page.getByRole('button', { name: /Confirm|Submit|Yes|Return for Correction|Approve/i });
      if (await confirm.first().isVisible().catch(() => false)) await confirm.first().click();
      await waitForShell(page);
      if (caseId && !(await caseAppearsInQa(page, caseId))) {
        throw new SmokeError(
          'application',
          `Submitted evaluation ${caseId} was set to "${actionName}" in QA, but it did not appear in QA Review.`,
        );
      }
      return `${label}. Status "${actionName}" was applied and the case remains visible in QA Review.`;
    }
    return `${label} is already in ${filter}.`;
  }

  return 'QA Reviews opened. No submitted evaluation was waiting, so there was nothing to move. An empty queue is not a release blocker.';
}

test.describe('Reviewer', () => {
  test('Submitted evaluation appears in QA Review after a status change', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Reviewer',
      expected: 'Use a submitted evaluation and set its QA status (Return for Correction, Approve, or another QA status). The case must then appear in QA Review. An empty queue is not a blocker. It is a bug only when the case does not appear after the status change.',
      steps: [
        'Sign in as Reviewer.',
        'Open QA Reviews.',
        'Open a submitted evaluation that is in Pending QA Review or In Review.',
        'Set the status through the QA module, such as Return for Correction or Approve.',
        'Confirm that case appears in QA Review.',
        'If no submitted evaluation is waiting, record that the empty queue is not a defect.',
      ],
    });
    await signIn(page, 'staff', 'REVIEWER');
    await openNav(page, 'QA Reviews');
    const actual = await reviewSubmittedEvaluation(page);
    await noteActual(testInfo, actual);
  });

  test('Billing does not open', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Reviewer',
      expected: 'Opening the billing URL directly does not show Billing.',
      steps: ['Sign in as Reviewer.', 'Go directly to /staff/billing.', 'Confirm Billing is not shown.'],
    });
    await signIn(page, 'staff', 'REVIEWER');
    await expectModuleBlocked(page, '/staff/billing', 'Billing');
    await noteActual(testInfo, `Billing stayed blocked. Landed at ${page.url()}.`);
  });

  test('Appointments do not open', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Reviewer',
      expected: 'Opening the appointments URL directly does not show Appointments.',
      steps: ['Sign in as Reviewer.', 'Go directly to /staff/appointments.', 'Confirm Appointments is not shown.'],
    });
    await signIn(page, 'staff', 'REVIEWER');
    await expectModuleBlocked(page, '/staff/appointments', 'Appointments');
    await noteActual(testInfo, `Appointments stayed blocked. Landed at ${page.url()}.`);
  });
});
