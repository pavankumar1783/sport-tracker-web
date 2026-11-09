import { Browser, Page, expect, test } from '@playwright/test';

/**
 * Needs the API running in Development with `Auth:Otp:FixedCode` set (for example "123456"); the
 * code is honoured only in Development. Export the same value as E2E_FIXED_CODE.
 * These specs register real accounts (example.test addresses) and create tournaments in the
 * database the API uses.
 */
const code = process.env['E2E_FIXED_CODE'];

test.describe('accounts and tournament ownership (writes real data)', () => {
  test.skip(!code, 'Set E2E_FIXED_CODE to the API development one-time code to run these.');

  let counter = 0;
  const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}${counter++}`;
  const emailFor = () => `e2e-${Date.now().toString(36)}-${counter++}@example.test`;

  /** Registers a new account through the real sign-in screens. */
  async function signUp(page: Page, name: string, email = emailFor()) {
    await page.goto('/sign-in');
    await page.locator('#email').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();

    await page.locator('#code').fill(code!);
    // A new email must also give a name; the code stays valid while you do.
    await page.locator('#name').fill(name);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'My profile' }).first()).toBeVisible();
    return email;
  }

  test('a new email registers, is signed in, and can change their name', async ({ page }) => {
    await signUp(page, 'E2E Asha');

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'E2E Asha' })).toBeVisible();

    await page.locator('#profile-name').fill('E2E Asha Rao');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByText('Name updated.')).toBeVisible();
  });

  test('a wrong code is refused with a clear message', async ({ page }) => {
    await page.goto('/sign-in');
    await page.locator('#email').fill(emailFor());
    await page.getByRole('button', { name: 'Email me a code' }).click();

    await page.locator('#code').fill(code === '000000' ? '111111' : '000000');
    await expect(page.getByRole('alert')).toContainText(/incorrect|expired|name/i);
  });

  test('any signed-in user can create a tournament and becomes its organizer', async ({ page }) => {
    await signUp(page, 'E2E Organizer');
    const name = unique('E2E Cup');

    await page.goto('/tournaments/new');
    await page.locator('#name').fill(name);
    await page.getByRole('button', { name: /create tournament/i }).click();

    await expect(page).toHaveURL(/\/tournaments\/\d+$/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();

    await page.goto('/tournaments');
    await page.getByRole('button', { name: 'My tournaments' }).click();
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  });

  test("someone else cannot manage another user's tournament", async ({ browser, page }) => {
    await signUp(page, 'E2E Owner');
    const name = unique('E2E Private Cup');
    await page.goto('/tournaments/new');
    await page.locator('#name').fill(name);
    await page.getByRole('button', { name: /create tournament/i }).click();
    await expect(page).toHaveURL(/\/tournaments\/\d+$/);
    const tournamentUrl = page.url();

    const other = await newSignedInPage(browser, 'E2E Visitor');
    await other.goto(tournamentUrl);
    await expect(other.getByRole('heading', { name })).toBeVisible();
    await expect(other.getByRole('link', { name: 'Settings' })).toHaveCount(0);
    await expect(other.getByRole('button', { name: /open registration|start tournament/i })).toHaveCount(0);
    await other.context().close();
  });

  async function newSignedInPage(browser: Browser, name: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUp(page, name);
    return page;
  }
});
