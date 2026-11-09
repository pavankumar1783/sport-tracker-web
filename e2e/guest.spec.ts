import { expect, test } from '@playwright/test';

test.describe('guest browsing', () => {
  test('dashboard loads without console errors and navigation reaches the main sections', async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('main')).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
    await nav.getByRole('link', { name: 'Tournaments' }).click();
    await expect(page).toHaveURL(/\/tournaments$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    if (!isMobile) {
      await nav.getByRole('link', { name: 'Statistics' }).click();
      await expect(page).toHaveURL(/\/statistics$/);
    }

    expect(errors).toEqual([]);
  });

  test('pages that need an account send guests to sign in and back', async ({ page }) => {
    await page.goto('/tournaments/new');
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Ftournaments%2Fnew$/);
    await expect(page.getByRole('heading', { name: 'Sign in or create an account' })).toBeVisible();
  });

  test('an invalid email is rejected before anything is sent', async ({ page }) => {
    await page.goto('/sign-in');
    await page.locator('#email').fill('not-an-email');
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await expect(page.getByRole('alert')).toContainText('valid email');
    await expect(page.locator('#code')).toHaveCount(0);
  });

  test('unknown routes show the not-found page', async ({ page }) => {
    await page.goto('/definitely/not/a/page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('no horizontal scroll on the main pages', async ({ page }) => {
    for (const path of ['/dashboard', '/tournaments', '/matches', '/teams', '/players', '/statistics']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
    }
  });
});
