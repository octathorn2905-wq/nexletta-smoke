import { expect, test } from '@playwright/test';
import { SmokeError } from './helpers/env';
import { annotate, expectModuleBlocked, noteActual, openNav, signIn } from './helpers/session';
import { openFirstInvoice } from './helpers/staff';

test.describe('Biller', () => {
  test('Billing list opens and one invoice shows amount and status', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Biller',
      expected: 'Billing list opens, and viewing one invoice shows its amount and status. Payment is not recorded.',
      steps: [
        'Sign in as Biller.',
        'Open Billing.',
        'Choose View on the first invoice.',
        'Read the amount and status in the invoice dialog, then close it.',
      ],
    });
    await signIn(page, 'staff', 'BILLER');
    await openNav(page, 'Billing');
    await expect(page.getByRole('heading', { level: 2, name: 'Billing' })).toBeVisible();
    const invoice = await openFirstInvoice(page);
    await page.getByRole('button', { name: 'Close' }).last().click();
    await noteActual(testInfo, `Opened ${invoice.id}: amount ${invoice.amount}, status ${invoice.status}.`);
  });

  test('Mark as Paid is available and is not used', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Biller',
      expected: 'Mark as Paid is visible and enabled on at least one invoice. The button is not clicked.',
      steps: ['Sign in as Biller.', 'Open Billing.', 'Confirm Mark as Paid is available and leave it unclicked.'],
    });
    await signIn(page, 'staff', 'BILLER');
    await openNav(page, 'Billing');
    const markPaid = page.getByRole('button', { name: 'Mark as Paid' });
    if ((await markPaid.count()) === 0) {
      throw new SmokeError(
        'test-data',
        'Billing opened, but no invoice currently offers Mark as Paid. This is blocked test data, not a confirmed product defect.',
      );
    }
    await expect(markPaid.first()).toBeVisible();
    await expect(markPaid.first()).toBeEnabled();
    await noteActual(testInfo, `Mark as Paid is enabled on ${await markPaid.count()} invoice(s). It was not clicked.`);
  });

  test('Appointments do not open', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Biller',
      expected: 'Opening the appointments URL directly does not show the Appointments page.',
      steps: ['Sign in as Biller.', 'Go directly to /staff/appointments.', 'Confirm Appointments is not shown.'],
    });
    await signIn(page, 'staff', 'BILLER');
    await expectModuleBlocked(page, '/staff/appointments', 'Appointments');
    await noteActual(testInfo, `Appointments stayed blocked. Landed at ${page.url()}.`);
  });

  test('QA does not open', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Biller',
      expected: 'Opening the QA URL directly does not show QA Reviews.',
      steps: ['Sign in as Biller.', 'Go directly to /staff/qa.', 'Confirm QA Reviews is not shown.'],
    });
    await signIn(page, 'staff', 'BILLER');
    await expectModuleBlocked(page, '/staff/qa', 'QA Reviews');
    await noteActual(testInfo, `QA stayed blocked. Landed at ${page.url()}.`);
  });
});
