import { expect, Page } from '@playwright/test';
import { SmokeError } from './env';
import { waitForShell } from './session';

export async function openFirstStaffCase(page: Page): Promise<string> {
  await expect(page.getByRole('heading', { level: 2, name: 'Cases' })).toBeVisible();
  const row = page.locator('[role="row"][data-id^="NXL-"]').first();
  try {
    await row.waitFor({ state: 'visible', timeout: 25_000 });
  } catch {
    throw new SmokeError('test-data', 'Cases list opened, but it has no case row to open.');
  }
  const id = (await row.getAttribute('data-id')) || '';
  await row.getByRole('button', { name: 'Edit / Open' }).click();
  await page.waitForURL(new RegExp(`/staff/cases/${id}`), { timeout: 30_000 });
  await waitForShell(page);
  const back = page.getByRole('button', { name: /Cases/ }).or(page.getByText(/←\s*Cases/));
  await expect(back.first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  return id;
}

export async function openFirstInvoice(page: Page): Promise<{ id: string; amount: string; status: string }> {
  const table = page.locator('table.billing-invoices-table');
  await expect(table).toBeVisible();
  const row = table.locator('tbody tr').filter({ hasText: /INV-\d{4}-\d+/ }).first();
  try {
    await row.waitFor({ state: 'visible', timeout: 25_000 });
  } catch {
    throw new SmokeError('test-data', 'Billing opened, but there is no invoice row to open.');
  }
  const rowText = (await row.innerText()).replace(/\s+/g, ' ').trim();
  const id = rowText.match(/INV-\d{4}-\d+/)?.[0];
  const amount = rowText.match(/\$[\d,]+(?:\.\d{2})?/)?.[0];
  const status = rowText.match(/\b(Paid|Pending|Overdue|Disputed|Voided)\b/)?.[0];
  if (!id || !amount || !status) {
    throw new SmokeError('automation', `Invoice row did not expose id, amount, and status. Row text: ${rowText}`);
  }
  await row.getByRole('button', { name: 'View' }).click();
  const modal = page.locator('.modal.show .modal-content');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(id);
  await expect(modal).toContainText(amount);
  await expect(modal).toContainText(status);
  return { id, amount, status };
}

export async function calendarHasAppointment(page: Page): Promise<boolean> {
  await expect(page.getByRole('heading', { level: 2, name: 'Appointments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible();
  return (await page.locator('.rbc-event').count()) > 0;
}

export async function openFirstAppointment(page: Page): Promise<string> {
  await page.getByText(/^Loading/i).waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
  const event = page.locator('.rbc-event').first();
  const appeared = await event.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
  if (!appeared) {
    throw new SmokeError(
      'test-data',
      'Appointments calendar opened, but the current calendar view has no appointment to open.',
    );
  }
  const label = (await event.innerText()).replace(/\s+/g, ' ').trim();
  await event.click();
  const detail = page.locator('.modal.show, [role="dialog"]').last();
  try {
    await detail.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    throw new SmokeError('application', `Clicking appointment "${label}" did not open an appointment detail.`);
  }
  await expect(detail).toContainText(/AM|PM|Scheduled|Telehealth|In Person|Appointment/i);
  return label;
}
