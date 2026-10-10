import { test, expect } from '@playwright/test';

const routes = ['/', '/how-it-works.html', '/privacy.html', '/terms.html', '/rules.html', '/support.html', '/delete-account.html', '/404.html'];

for (const route of routes) {
  test(`${route} renders with intact layout and assets`, async ({ page }, testInfo) => {
    const errors = [];
    const external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.locator('form, iframe')).toHaveCount(0);
    // The requested footer field has one bundled same-origin module; inline and external scripts remain disallowed.
    const script = page.locator('script');
    await expect(script).toHaveCount(1);
    await expect(script).toHaveAttribute('type', 'module');
    expect(await script.textContent()).toBe('');
    const scriptURL = new URL(await script.getAttribute('src'), page.url());
    expect(scriptURL.origin).toBe(new URL(page.url()).origin);
    expect(scriptURL.pathname).toMatch(/^\/assets\/footer-physics-[\w-]+\.js$/);
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
      images: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
    }));
    expect(layout.contentWidth).toBeLessThanOrEqual(layout.width + 1);
    expect(layout.images).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (['/', '/privacy.html', '/support.html'].includes(route)) {
      await testInfo.attach(`${testInfo.project.name}-${route === '/' ? 'home' : route.slice(1)}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  });
}

test('navigation, history and FAQ controls work repeatedly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'How it works' }).click();
  await expect(page).toHaveURL(/how-it-works\.html$/);
  await page.goBack();
  await expect(page.locator('h1')).toContainText('rivalry');
  const question = page.locator('details').first();
  await question.locator('summary').click();
  await expect(question).toHaveAttribute('open', '');
  await question.locator('summary').click();
  await expect(question).not.toHaveAttribute('open', '');
  await question.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(question).not.toHaveAttribute('open', '');
  await page.getByRole('navigation', { name: 'Footer', exact: true }).getByRole('link', { name: 'Delete account' }).click();
  await expect(page.locator('h1')).toContainText('Delete');
  await expect(page.getByRole('link', { name: 'Start a deletion request' })).toHaveAttribute('href', /^mailto:support@outpaceapp\.com\?/);
});

test('keyboard skip link reaches the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});
