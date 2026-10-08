import { expect, test } from '@playwright/test';
import { annotate, expectModuleBlocked, noteActual, openNav, signIn } from './helpers/session';
import { openFirstAppointment } from './helpers/staff';

test.describe('Scheduler', () => {
  test('Cases list opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Scheduler',
      expected: 'Scheduler can open the cases list and see case rows.',
      steps: ['Sign in as Scheduler on the staff portal.', 'Open Cases.', 'Confirm case rows are listed.'],
    });
    await signIn(page, 'staff', 'SCHEDULER');
    await openNav(page, 'Cases');
    await expect(page.getByRole('heading', { level: 2, name: 'Cases' })).toBeVisible();
    await expect(page.locator('[role="row"][data-id^="NXL-"]').first()).toBeVisible();
    await noteActual(testInfo, `Cases list opened at ${page.url()}.`);
  });

  test('Appointments calendar opens and one appointment opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Scheduler',
      expected: 'The appointments calendar opens, and choosing one appointment shows its detail. No appointment is created, edited, or cancelled.',
      steps: [
        'Sign in as Scheduler.',
        'Open Appointments.',
        'Confirm the calendar is showing.',
        'Open the first appointment on the calendar and stop without saving.',
      ],
    });
    await signIn(page, 'staff', 'SCHEDULER');
    await openNav(page, 'Appointments');
    await expect(page.getByRole('heading', { level: 2, name: 'Appointments' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible();
    const label = await openFirstAppointment(page);
    await page.keyboard.press('Escape');
    await noteActual(testInfo, `Opened appointment "${label}" from ${page.url()} and did not save.`);
  });

  test('Billing does not open', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Scheduler',
      expected: 'Opening the billing URL directly does not show the Billing page.',
      steps: ['Sign in as Scheduler.', 'Go directly to /staff/billing.', 'Confirm the Billing page heading is not shown.'],
    });
    await signIn(page, 'staff', 'SCHEDULER');
    await expectModuleBlocked(page, '/staff/billing', 'Billing');
    await noteActual(testInfo, `Billing stayed blocked. Landed at ${page.url()}.`);
  });

  test('QA does not open', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Scheduler',
      expected: 'Opening the QA URL directly does not show QA Reviews.',
      steps: ['Sign in as Scheduler.', 'Go directly to /staff/qa.', 'Confirm the QA Reviews heading is not shown.'],
    });
    await signIn(page, 'staff', 'SCHEDULER');
    await expectModuleBlocked(page, '/staff/qa', 'QA Reviews');
    await noteActual(testInfo, `QA stayed blocked. Landed at ${page.url()}.`);
  });
});
