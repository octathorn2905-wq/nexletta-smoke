import { expect, test } from '@playwright/test';
import { foreignVeteranName, SmokeError } from './helpers/env';
import { annotate, isBlankOrg, noteActual, signIn, waitForShell } from './helpers/session';

test.describe('Representative', () => {
  test('Managed Veterans list opens and one linked veteran shows case status', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Representative',
      expected: 'Managed Veterans opens, one linked veteran opens, and that veteran\'s case status is shown.',
      steps: [
        'Sign in as Representative on the veteran portal.',
        'Open Managed Veterans.',
        'Open the first linked veteran.',
        'Confirm case status is visible. Do not edit the case.',
      ],
    });
    await signIn(page, 'veteran', 'REPRESENTATIVE');
    const managed = page.getByRole('link', { name: 'Managed Veterans', exact: true });
    try {
      await expect(managed).toBeVisible();
    } catch {
      throw new SmokeError('application', 'Representative sign-in did not show a Managed Veterans link.');
    }
    await managed.click();
    await waitForShell(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Managed Veterans' })).toBeVisible();
    if (await page.getByText('No linked veterans.').isVisible().catch(() => false)) {
      throw new SmokeError(
        'test-data',
        'Managed Veterans opened, but this representative has no linked veteran. Case status cannot be checked until a veteran is linked.',
      );
    }
    const row = page.locator('table tbody tr').filter({ hasNotText: 'No linked veterans' }).first();
    try {
      await row.waitFor({ state: 'visible', timeout: 20_000 });
    } catch {
      throw new SmokeError('test-data', 'Managed Veterans opened, but this representative has no linked veteran row.');
    }
    const veteran = (await row.innerText()).replace(/\s+/g, ' ').trim();
    await row.click();
    await waitForShell(page);
    const caseLink = page.getByRole('link', { name: 'Case', exact: true });
    if (await caseLink.isVisible().catch(() => false)) {
      await caseLink.click();
      await waitForShell(page);
    }
    const text = await page.locator('#root').innerText();
    const caseId = text.match(/NXL-\d{4}-\d+/)?.[0];
    const status = text.match(/Your [^\n]+|Payment required[^\n]+|Documents needed|Evaluation underway|Quality review|Report ready/)?.[0]?.trim();
    if (!caseId || !status) {
      throw new SmokeError('application', `Linked veteran opened at ${page.url()}, but case status was not visible.`);
    }
    await noteActual(testInfo, `Opened linked veteran "${veteran.slice(0, 120)}". Case ${caseId} shows "${status}" at ${page.url()}.`);
  });

  test('Billing follows who is paying for the linked veteran', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Representative',
      expected: 'For the opened veteran, Billing shows that veteran\'s own bill when no organization is paying, and hides the organization price when an organization is paying.',
      steps: [
        'Sign in as Representative.',
        'Open a linked veteran from Managed Veterans.',
        'Read Referring organization on the case.',
        'Open Billing and apply the same price rule. Do not pay anything.',
      ],
    });
    await signIn(page, 'veteran', 'REPRESENTATIVE');
    await page.getByRole('link', { name: 'Managed Veterans', exact: true }).click();
    await waitForShell(page);
    if (await page.getByText(/No linked veterans|No veterans are linked/i).first().isVisible().catch(() => false)) {
      throw new SmokeError(
        'test-data',
        'This representative has no linked veteran, so the billing rule cannot be checked. This is missing test data, not a confirmed product defect.',
      );
    }
    const row = page.locator('table tbody tr').filter({ hasNotText: /No linked veterans/i }).first();
    if ((await row.count()) === 0) {
      throw new SmokeError('test-data', 'No linked veteran is available, so the billing rule cannot be checked.');
    }
    await row.click();
    await waitForShell(page);
    const caseLink = page.getByRole('link', { name: 'Case', exact: true });
    if (await caseLink.isVisible().catch(() => false)) {
      await caseLink.click();
      await waitForShell(page);
    }
    const body = await page.locator('body').innerText();
    const org = (body.match(/Referring organization\s+([^\n]+)/i)?.[1] || '').trim();
    await page.getByRole('link', { name: 'Billing', exact: true }).click();
    await waitForShell(page);
    await expect(page.getByRole('heading', { name: 'Billing' }).first()).toBeVisible();
    const billingText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const amount = billingText.match(/\$[\d,]+(?:\.\d{2})?/)?.[0];
    if (isBlankOrg(org)) {
      if (!amount || /No invoices for this case/i.test(billingText)) {
        throw new SmokeError(
          'application',
          `Linked veteran has no referring organization ("${org || 'blank'}"), but Billing does not show that veteran's bill. ${billingText.slice(0, 400)}`,
        );
      }
      await noteActual(testInfo, `No organization. Representative billing shows ${amount}.`);
      return;
    }
    if (amount && org && new RegExp(org.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(billingText)) {
      throw new SmokeError('application', `Organization "${org}" is paying, but the representative still sees a price (${amount}).`);
    }
    await noteActual(testInfo, `Organization "${org}" is paying. Representative billing does not show that organization price.`);
  });

  test('A veteran who is not linked does not open', async ({ page }, testInfo) => {
    const foreignName = foreignVeteranName();
    annotate(testInfo, {
      role: 'Representative',
      expected: `${foreignName} is not in Managed Veterans and does not open as a linked veteran.`,
      steps: [
        'Sign in as Representative.',
        'Open Managed Veterans.',
        `Confirm ${foreignName} is not listed.`,
        'Search the page for that veteran and confirm no case opens.',
      ],
    });
    await signIn(page, 'veteran', 'REPRESENTATIVE');
    await page.getByRole('link', { name: 'Managed Veterans', exact: true }).click();
    await waitForShell(page);
    const listText = await page.locator('body').innerText();
    if (listText.includes(foreignName)) {
      throw new SmokeError('test-data', `${foreignName} is already linked to this representative, so this check cannot prove an unlinked veteran is blocked.`);
    }
    const search = page.getByRole('searchbox').first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill(foreignName);
      await page.waitForTimeout(800);
    }
    const after = await page.locator('body').innerText();
    if (after.includes(foreignName)) {
      throw new SmokeError('application', `Unlinked veteran "${foreignName}" is visible to this representative.`);
    }
    await noteActual(testInfo, `${foreignName} is not in Managed Veterans at ${page.url()}.`);
  });
});
