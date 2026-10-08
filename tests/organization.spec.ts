import { expect, test } from '@playwright/test';
import { foreignInvoiceId, SmokeError } from './helpers/env';
import { annotate, noteActual, openNav, pageHeading, signIn } from './helpers/session';
import { openFirstInvoice } from './helpers/staff';

test.describe('Organization', () => {
  test('One organization invoice opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Organization',
      expected: 'One invoice for this organization opens and shows an amount and status. Nothing is marked paid.',
      steps: ['Sign in as Organization.', 'Open Billing if sign-in did not already land there.', 'View the first invoice.'],
    });
    await signIn(page, 'staff', 'ORGANIZATION');
    if ((await pageHeading(page)) !== 'Billing') await openNav(page, 'Billing');
    const invoice = await openFirstInvoice(page);
    const orgFilter = page.getByRole('combobox', { name: 'Referring organization' });
    const options = await orgFilter.locator('option').allTextContents();
    const otherOrgs = options.map((item) => item.trim()).filter((item) => item && !/^All referring orgs$/i.test(item));
    await page.getByRole('button', { name: 'Close' }).last().click();
    await noteActual(
      testInfo,
      `Opened ${invoice.id}: ${invoice.amount}, ${invoice.status}. Referring-org filter options: ${otherOrgs.join(', ') || '(none)'}.`,
    );
  });

  test('Another organization\'s invoice does not open', async ({ page }, testInfo) => {
    const foreign = foreignInvoiceId();
    annotate(testInfo, {
      role: 'Organization',
      expected: `Invoice ${foreign}, which belongs to another organization, does not appear and does not open.`,
      steps: [
        'Sign in as Organization.',
        'Open Billing.',
        `Search for ${foreign}.`,
        'Confirm that invoice is not listed and its detail does not open.',
      ],
    });
    await signIn(page, 'staff', 'ORGANIZATION');
    if ((await pageHeading(page)) !== 'Billing') await openNav(page, 'Billing');
    const search = page.getByRole('searchbox', { name: 'Search invoices' });
    await search.fill(foreign);
    await search.press('Enter');
    await page.waitForTimeout(1000);
    const tableText = await page.locator('table.billing-invoices-table').innerText();
    if (tableText.includes(foreign)) {
      throw new SmokeError('application', `Another organization's invoice ${foreign} is visible in this organization's billing list.`);
    }
    await expect(page.locator('.modal.show')).toHaveCount(0);
    await noteActual(testInfo, `${foreign} is not in the organization billing list at ${page.url()}.`);
  });
});
