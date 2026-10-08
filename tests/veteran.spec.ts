import { expect, test } from '@playwright/test';
import { foreignCaseId, foreignVeteranName, portalUrl, SmokeError } from './helpers/env';
import { annotate, isBlankOrg, noteActual, openNav, signIn, waitForShell } from './helpers/session';

async function referringOrganization(page: import('@playwright/test').Page): Promise<string> {
  const body = await page.locator('body').innerText();
  const match = body.match(/Referring organization\s+([^\n]+)/i);
  return (match?.[1] || '').trim();
}

test.describe('Veteran', () => {
  test('Sign-in shows only that veteran\'s case', async ({ page }, testInfo) => {
    const foreign = foreignCaseId();
    annotate(testInfo, {
      role: 'Veteran',
      expected: 'Veteran sign-in shows that veteran\'s own case and does not list another veteran\'s case.',
      steps: [
        'Sign in as Veteran.',
        'Read the dashboard case reference.',
        `Confirm ${foreign} is not presented as this veteran's case.`,
      ],
    });
    await signIn(page, 'veteran', 'VETERAN');
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeVisible();
    const text = await page.locator('body').innerText();
    const ownCase = text.match(/NXL-\d{4}-\d+/)?.[0];
    if (!ownCase) {
      throw new SmokeError('application', 'Veteran dashboard did not show a case reference after sign-in.');
    }
    if (text.includes(foreign)) {
      throw new SmokeError('application', `Veteran dashboard includes another veteran's case ${foreign}.`);
    }
    await noteActual(testInfo, `Dashboard at ${page.url()} shows own case ${ownCase} and not ${foreign}.`);
  });

  test('Case status opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Veteran',
      expected: 'The case page opens and shows this veteran\'s case status.',
      steps: ['Sign in as Veteran.', 'Open Case.', 'Confirm the case reference and a status statement are visible.'],
    });
    await signIn(page, 'veteran', 'VETERAN');
    await openNav(page, 'Case');
    await expect(page.getByRole('heading', { level: 2, name: 'Case' })).toBeVisible();
    const text = await page.locator('#root').innerText();
    const caseId = text.match(/NXL-\d{4}-\d+/)?.[0];
    const status = text.match(/Your [^\n]+|Payment required[^\n]+/)?.[0]?.trim();
    if (!caseId || !status) {
      throw new SmokeError('application', `Case page opened at ${page.url()} but did not show a case id and status. Visible text: ${text.replace(/\s+/g, ' ').slice(0, 400)}`);
    }
    await noteActual(testInfo, `Case ${caseId} at ${page.url()} shows "${status}".`);
  });

  test('Records page opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Veteran',
      expected: 'Records opens and shows record categories. No file is uploaded.',
      steps: ['Sign in as Veteran.', 'Open Records.', 'Confirm a record category such as Service Treatment Records is visible.'],
    });
    await signIn(page, 'veteran', 'VETERAN');
    await openNav(page, 'Records');
    await expect(page.getByRole('heading', { level: 2, name: 'Records' })).toBeVisible();
    await expect(page.getByText(/Service Treatment Records|VA Medical Center Records|Private Medical Records/i).first()).toBeVisible();
    await noteActual(testInfo, `Records opened at ${page.url()}. No file was uploaded.`);
  });

  test('Billing follows who is paying', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Veteran',
      expected: 'NX-065: if the veteran pays, the invoice is visible. If a representative or organization pays, the veteran does not see that invoice or amount. "Billed to your referring organization" is acceptable.',
      steps: [
        'Sign in as Veteran.',
        'Open Case and read who is paying.',
        'Open Billing.',
        'If the veteran pays personally, confirm the invoice and amount are shown.',
        'If a representative or organization pays, confirm the invoice and amount are hidden. A billed-to-organization message is allowed.',
      ],
    });
    await signIn(page, 'veteran', 'VETERAN');
    await openNav(page, 'Case');
    const org = await referringOrganization(page);
    const caseAmount = ((await page.locator('body').innerText()).match(/Amount\s+(\$[\d,]+(?:\.\d{2})?)/i) || [])[1];
    await openNav(page, 'Billing');
    await expect(page.getByRole('heading', { level: 2, name: 'Billing' })).toBeVisible();
    const billedAmount = page.locator('table').getByText(/\$[\d,]+/).locator('visible=true');
    const emptyCurrent = page.getByText('No invoices for this case.');
    const emptyHistory = page.getByText('No invoices from other cases.');
    if (isBlankOrg(org)) {
      if ((await billedAmount.count()) === 0) {
        const emptyNow = await emptyCurrent.isVisible().catch(() => false);
        const emptyPast = await emptyHistory.isVisible().catch(() => false);
        if (caseAmount) {
          throw new SmokeError(
            'application',
            `Referring organization is "${org || 'blank'}" and the case shows ${caseAmount}, but Billing does not list that bill. Current invoices empty: ${emptyNow}. History empty: ${emptyPast}.`,
          );
        }
        throw new SmokeError(
          'test-data',
          `No referring organization, and this veteran has no bill on the case or on Billing yet. Current invoices empty: ${emptyNow}. History empty: ${emptyPast}.`,
        );
      }
      const shown = (await billedAmount.first().innerText()).trim();
      await noteActual(testInfo, `No referring organization. Billing shows own amount ${shown}.`);
      return;
    }
    const billingText = await page.locator('#root').innerText();
    const billedToOrg = /billed to your referring organization/i.test(billingText);
    if ((await billedAmount.count()) > 0) {
      throw new SmokeError(
        'application',
        `NX-065: "${org}" is paying, so the veteran must not see the invoice or amount.`,
      );
    }
    await noteActual(
      testInfo,
      `Payer is "${org}". Veteran billing hides the invoice and amount${billedToOrg ? '. Message "Billed to your referring organization" is shown' : ''}.`,
    );
  });

  test('Another veteran\'s case does not open', async ({ page }, testInfo) => {
    const foreign = foreignCaseId();
    const foreignName = foreignVeteranName();
    annotate(testInfo, {
      role: 'Veteran',
      expected: `${foreign} (${foreignName}) is not in this veteran's case list and does not open.`,
      steps: [
        'Sign in as Veteran.',
        'Open Case and read the case filter.',
        `Open /veteran/case/${foreign} directly.`,
        'Confirm that case is not shown as an opened case.',
      ],
    });
    await signIn(page, 'veteran', 'VETERAN');
    await openNav(page, 'Case');
    const options = (await page.locator('select option').allTextContents()).join(' ');
    if (options.includes(foreign)) {
      throw new SmokeError('test-data', `${foreign} is already in this veteran's case filter, so it cannot prove another veteran is blocked.`);
    }
    await page.goto(`${portalUrl('veteran')}/veteran/case/${foreign}`, { waitUntil: 'domcontentloaded' });
    await waitForShell(page);
    const heading = page.getByRole('heading', { name: foreign, exact: true });
    if (await heading.isVisible().catch(() => false)) {
      throw new SmokeError('application', `Another veteran's case ${foreign} opened at ${page.url()}.`);
    }
    const body = await page.locator('body').innerText();
    if (body.includes(foreign) && body.includes(foreignName)) {
      throw new SmokeError('application', `Case page shows ${foreignName} and ${foreign}.`);
    }
    await noteActual(testInfo, `${foreign} is not in the case filter and did not open. URL after direct navigation: ${page.url()}.`);
  });
});
