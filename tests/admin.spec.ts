import { expect, test } from '@playwright/test';
import { annotate, noteActual, openNav, pageHeading, signIn } from './helpers/session';
import { openFirstStaffCase } from './helpers/staff';

test.describe('Admin', () => {
  test('Dashboard opens with case counts', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Admin',
      expected: 'After admin sign-in, the dashboard shows numeric case counts, including Pending Records and In progress.',
      steps: [
        'Open the staff portal sign-in page.',
        'Sign in with the Admin account.',
        'Confirm the Dashboard heading and the case-count controls show numbers.',
      ],
    });
    await signIn(page, 'staff', 'ADMIN');
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pending Records\s+\d+/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /In progress\s+\d+/ })).toBeVisible();
    const pending = await page.getByRole('button', { name: /Pending Records\s+\d+/ }).innerText();
    const progress = await page.getByRole('button', { name: /In progress\s+\d+/ }).innerText();
    await noteActual(testInfo, `Dashboard at ${page.url()} shows "${pending.replace(/\s+/g, ' ')}" and "${progress.replace(/\s+/g, ' ')}".`);
  });

  test('Cases list opens and one case opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Admin',
      expected: 'The cases list renders case rows, and Edit / Open shows that case without saving any change.',
      steps: [
        'Sign in as Admin.',
        'Open Cases from the navigation.',
        'Use Edit / Open on the first case.',
        'Confirm the case workspace URL and leave without choosing Save.',
      ],
    });
    await signIn(page, 'staff', 'ADMIN');
    await openNav(page, 'Cases');
    const id = await openFirstStaffCase(page);
    await noteActual(testInfo, `Opened case ${id} at ${page.url()} and did not save.`);
  });

  test('Settings opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Admin',
      expected: 'Admin practice settings open. The live page is labeled Admin Dashboard and includes user administration and security settings.',
      steps: [
        'Sign in as Admin.',
        'Open Admin from the navigation.',
        'Confirm the Admin Dashboard heading, Users, and security settings are visible.',
      ],
    });
    await signIn(page, 'staff', 'ADMIN');
    await openNav(page, 'Admin');
    await expect(page.getByRole('heading', { level: 2, name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByText('security settings')).toBeVisible();
    await expect(page.getByText('Users', { exact: true }).first()).toBeVisible();
    await noteActual(testInfo, `Settings surface opened at ${page.url()} with heading "${await pageHeading(page)}".`);
  });

  test('Billing opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Admin',
      expected: 'Billing opens and shows the invoice table.',
      steps: ['Sign in as Admin.', 'Open Billing.', 'Confirm the Billing heading and invoice table.'],
    });
    await signIn(page, 'staff', 'ADMIN');
    await openNav(page, 'Billing');
    await expect(page.getByRole('heading', { level: 2, name: 'Billing' })).toBeVisible();
    await expect(page.locator('table.billing-invoices-table')).toBeVisible();
    await noteActual(testInfo, `Billing opened at ${page.url()}.`);
  });

  test('QA opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Admin',
      expected: 'QA Reviews opens for Admin.',
      steps: ['Sign in as Admin.', 'Open QA Reviews.', 'Confirm the QA Reviews heading.'],
    });
    await signIn(page, 'staff', 'ADMIN');
    await openNav(page, 'QA Reviews');
    await expect(page.getByRole('heading', { level: 2, name: 'QA Reviews' })).toBeVisible();
    await noteActual(testInfo, `QA Reviews opened at ${page.url()}.`);
  });

  test('Appointments opens', async ({ page }, testInfo) => {
    annotate(testInfo, {
      role: 'Admin',
      expected: 'Appointments opens on the calendar.',
      steps: ['Sign in as Admin.', 'Open Appointments.', 'Confirm the calendar heading and Calendar control.'],
    });
    await signIn(page, 'staff', 'ADMIN');
    await openNav(page, 'Appointments');
    await expect(page.getByRole('heading', { level: 2, name: 'Appointments' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible();
    await noteActual(testInfo, `Appointments opened at ${page.url()}.`);
  });
});
