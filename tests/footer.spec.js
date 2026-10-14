import { test, expect } from '@playwright/test';

// Instrument browser scheduling before the real module loads; production exposes no test hooks.
async function observeFrames(page) {
  await page.addInitScript(() => {
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const pending = new Set();
    window.__footerFrames = { executed: 0, scheduled: 0, cancelled: 0, pending };
    window.requestAnimationFrame = callback => {
      window.__footerFrames.scheduled++;
      const id = nativeRequest(time => {
        pending.delete(id);
        window.__footerFrames.executed++;
        callback(time);
      });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => {
      pending.delete(id);
      window.__footerFrames.cancelled++;
      nativeCancel(id);
    };
  });
}

const frameState = page => page.evaluate(() => ({
  executed: window.__footerFrames.executed,
  scheduled: window.__footerFrames.scheduled,
  cancelled: window.__footerFrames.cancelled,
  pending: window.__footerFrames.pending.size,
}));

async function expectSleeping(page) {
  await expect.poll(async () => (await frameState(page)).pending, { timeout: 15_000 }).toBe(0);
  const before = await frameState(page);
  // Observe a real idle interval; a continuously running loop would execute several frames.
  await page.waitForTimeout(250);
  const after = await frameState(page);
  expect(after.pending).toBe(0);
  expect(after.executed).toBe(before.executed);
  return after;
}

async function pixelState(page, saveBaseline = false) {
  return page.locator('.footer-field').evaluate((canvas, save) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    if (save) window.__footerPixels = new Uint8ClampedArray(data);
    const baseline = window.__footerPixels;
    let painted = 0;
    let changed = 0;
    let channelDelta = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3]) painted++;
      if (baseline && baseline.length === data.length) {
        const delta = Math.abs(data[index] - baseline[index]) + Math.abs(data[index + 1] - baseline[index + 1]) + Math.abs(data[index + 2] - baseline[index + 2]) + Math.abs(data[index + 3] - baseline[index + 3]);
        if (delta > 0) changed++;
        channelDelta += delta;
      }
    }
    return { width: canvas.width, height: canvas.height, painted, changed, channelDelta };
  }, saveBaseline);
}

async function prepareFooter(page, reducedMotion = 'no-preference') {
  await observeFrames(page);
  await page.emulateMedia({ reducedMotion });
  await page.goto('/');
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await pixelState(page)).painted).toBeGreaterThan(100);
  await expectSleeping(page);
  return { finePointer: await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), baseline: await pixelState(page, true) };
}

async function pointInField(page, offset = 0) {
  const bounds = await page.locator('.site-footer').boundingBox();
  // The lower decorative wordmark area stays away from links and is visible at each supported width.
  return { x: bounds.x + bounds.width * 0.48 + offset, y: Math.min(page.viewportSize().height - 20, bounds.y + bounds.height * 0.84) };
}

async function disturbField(page) {
  const point = await pointInField(page);
  await page.mouse.move(point.x - 35, point.y);
  await page.mouse.move(point.x + 35, point.y - 12, { steps: 8 });
  await expect.poll(async () => (await pixelState(page)).changed).toBeGreaterThan(20);
  return point;
}

async function attachEvidence(testInfo, name, value) {
  await testInfo.attach(name, { body: JSON.stringify(value), contentType: 'application/json' });
}

async function attachFooter(page, testInfo, name) {
  await testInfo.attach(`${testInfo.project.name}-${name}`, {
    body: await page.locator('.site-footer').screenshot({ animations: 'allow' }), contentType: 'image/png',
  });
}

test('footer glyphs respond to a pointer and spring back; coarse touch stays static', async ({ page }, testInfo) => {
  const { finePointer, baseline } = await prepareFooter(page);
  await attachFooter(page, testInfo, 'footer-static');
  if (finePointer) {
    await disturbField(page);
    const displaced = await pixelState(page);
    expect(displaced.channelDelta).toBeGreaterThan(1_000);
    await attachFooter(page, testInfo, 'footer-displaced');
    await page.mouse.move(0, 0);
    // The return must animate before settling; an immediate reset is not a spring return.
    const returning = await pixelState(page);
    expect(returning.changed).toBeGreaterThan(20);
    await expectSleeping(page);
    const settled = await pixelState(page);
    expect(settled.changed).toBe(0);
    await attachFooter(page, testInfo, 'footer-returned');
    await attachEvidence(testInfo, 'footer-pointer-spring', { finePointer, baseline, displaced, returning, settled });
  } else {
    const point = await pointInField(page);
    await page.touchscreen.tap(point.x, point.y);
    await page.mouse.move(point.x, point.y);
    await expectSleeping(page);
    const afterTouch = await pixelState(page);
    expect(afterTouch.changed).toBe(0);
    await attachEvidence(testInfo, 'footer-coarse-static', { finePointer, baseline, afterTouch });
  }
});

test('footer animation sleeps while idle, offscreen, and hidden', async ({ page }, testInfo) => {
  const { finePointer } = await prepareFooter(page);
  const idle = await expectSleeping(page);
  if (finePointer) await disturbField(page);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await expect.poll(() => page.locator('.site-footer').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThan(page.viewportSize().height);
  const offscreen = await expectSleeping(page);
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  await expectSleeping(page);
  await pixelState(page, true);
  if (finePointer) await disturbField(page);
  // Headless tabs do not reliably change visibility. Drive the browser APIs the module observes.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await expectSleeping(page);
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectSleeping(page);
  const restored = await pixelState(page);
  expect(restored.changed).toBe(0);
  if (finePointer) await disturbField(page);
  await attachEvidence(testInfo, 'footer-scheduling', { finePointer, idle, offscreen, hidden, restored, visibilityEventSimulated: true });
});

test('footer canvas resizes without overflowing content or covering links', async ({ page }, testInfo) => {
  await prepareFooter(page);
  const initial = page.viewportSize();
  const widths = [...new Set([initial.width, Math.max(320, initial.width - 33), initial.width + 41, initial.width])];
  const layouts = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: initial.height });
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('.footer-field').evaluate(canvas => {
      const rect = canvas.closest('.site-footer').getBoundingClientRect();
      // Compare observed horizontal and vertical scales, allowing pixel rounding without reproducing sizing logic.
      return Math.abs(canvas.width / rect.width - canvas.height / rect.height) - (2 / rect.width + 2 / rect.height);
    })).toBeLessThanOrEqual(0);
    const layout = await page.locator('.site-footer').evaluate(footer => {
      const canvas = footer.querySelector('canvas');
      const bounds = footer.getBoundingClientRect();
      const canvasBounds = canvas.getBoundingClientRect();
      return {
        width: document.documentElement.clientWidth, contentWidth: document.documentElement.scrollWidth,
        canvasWidth: canvas.width, canvasHeight: canvas.height,
        backingScaleX: canvas.width / bounds.width, backingScaleY: canvas.height / bounds.height,
        bounds: { left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height },
        canvasBounds: { left: canvasBounds.left, right: canvasBounds.right, width: canvasBounds.width, height: canvasBounds.height },
        borderHeight: parseFloat(getComputedStyle(footer).borderTopWidth) + parseFloat(getComputedStyle(footer).borderBottomWidth),
        links: [...footer.querySelectorAll('a')].map(link => { const rect = link.getBoundingClientRect(); return { name: link.textContent.trim(), left: rect.left, right: rect.right, width: rect.width, height: rect.height, mobileTarget: link.matches('.footer-column a, .footer-contact a') && matchMedia('(max-width: 760px)').matches }; }),
        pointerEvents: getComputedStyle(canvas).pointerEvents,
      };
    });
    expect(layout.contentWidth).toBeLessThanOrEqual(layout.width + 1);
    expect(layout.canvasWidth).toBeGreaterThan(0);
    expect(layout.canvasHeight).toBeGreaterThan(0);
    expect(Math.abs(layout.backingScaleX - layout.backingScaleY)).toBeLessThanOrEqual(2 / layout.bounds.width + 2 / layout.bounds.height);
    expect(layout.backingScaleX).toBeLessThanOrEqual(2 + 2 / layout.bounds.width);
    expect(layout.backingScaleY).toBeLessThanOrEqual(2 + 2 / layout.bounds.height);
    expect(layout.canvasWidth * layout.canvasHeight).toBeLessThanOrEqual(3_000_000 + 2 * (layout.canvasWidth + layout.canvasHeight) + 4);
    expect(Math.abs(layout.canvasBounds.width - layout.bounds.width)).toBeLessThan(1);
    expect(Math.abs(layout.canvasBounds.height - (layout.bounds.height - layout.borderHeight))).toBeLessThan(1);
    expect(layout.pointerEvents).toBe('none');
    for (const link of layout.links) {
      expect(link.left).toBeGreaterThanOrEqual(-1);
      expect(link.right).toBeLessThanOrEqual(layout.width + 1);
      expect(link.width).toBeGreaterThan(0);
      expect(link.height).toBeGreaterThanOrEqual(link.mobileTarget ? 44 : 24);
    }
    layouts.push(layout);
  }
  await page.setViewportSize(initial);
  await attachFooter(page, testInfo, 'footer-responsive');
  await attachEvidence(testInfo, 'footer-responsive-layout', layouts);
});

test('footer respects initial and runtime reduced-motion preferences', async ({ page }, testInfo) => {
  const { finePointer, baseline } = await prepareFooter(page, 'reduce');
  const point = await pointInField(page);
  await page.mouse.move(point.x, point.y);
  await expectSleeping(page);
  const initiallyReduced = await pixelState(page);
  expect(initiallyReduced.changed).toBe(0);
  await attachFooter(page, testInfo, 'footer-reduced-motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectSleeping(page);
  await pixelState(page, true);
  if (finePointer) await disturbField(page);
  else {
    await page.mouse.move(point.x + 20, point.y);
    expect((await pixelState(page)).changed).toBe(0);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectSleeping(page);
  const runtimeReduced = await pixelState(page);
  expect(runtimeReduced.changed).toBe(0);
  await page.mouse.move(point.x - 25, point.y);
  await expectSleeping(page);
  expect((await pixelState(page)).changed).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectSleeping(page);
  if (finePointer) await disturbField(page);
  await attachEvidence(testInfo, 'footer-motion-preferences', { finePointer, baseline, initiallyReduced, runtimeReduced });
});

test('footer links remain keyboard accessible, decorative content stays hidden, and hero copy removals are scoped', async ({ page }, testInfo) => {
  await prepareFooter(page, 'reduce');
  const footer = page.locator('.site-footer');
  const nav = page.getByRole('navigation', { name: 'Footer', exact: true });
  const expected = [
    ['How it works', './how-it-works.html'], ['Support', './support.html'], ['Privacy', './privacy.html'],
    ['Terms', './terms.html'], ['Competition rules', './rules.html'], ['Delete account', './delete-account.html'],
  ];
  await expect(nav.getByRole('link')).toHaveCount(expected.length);
  await expect(footer.locator('.footer-column')).toHaveCount(2);
  for (const [name, href] of expected) await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  await expect(footer.getByRole('link', { name: /support@outpaceapp\.com/ })).toHaveAttribute('href', 'mailto:support@outpaceapp.com');
  await expect(footer.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  await expect(footer.locator('canvas')).not.toHaveAttribute('tabindex', /./);
  await expect(footer.locator('.footer-wordmark')).toHaveAttribute('aria-hidden', 'true');
  const snapshot = await footer.ariaSnapshot();
  expect(snapshot).not.toMatch(/canvas|img|graphics/);
  expect(snapshot.split('link "Outpace home"').length - 1).toBe(1);
  await footer.getByRole('link', { name: 'Outpace home', exact: true }).focus();
  for (const [name] of expected) {
    await page.keyboard.press('Tab');
    const link = nav.getByRole('link', { name, exact: true });
    await expect(link).toBeFocused();
    expect(await link.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  }
  await page.keyboard.press('Tab');
  await expect(footer.getByRole('link', { name: /support@outpaceapp\.com/ })).toBeFocused();
  await attachFooter(page, testInfo, 'footer-keyboard-focus');
  await expect(page.locator('.hero .eyebrow, .hero .platform-note')).toHaveCount(0);
  await expect(page.locator('.hero .preview-caption')).toHaveText('Illustrative leaderboard · sample names and totals');
  await expect(page.locator('.hero .phone-shell')).toHaveAttribute('aria-label', 'Illustrative Outpace friends leaderboard');
  await expect(page.locator('.hero h1')).toContainText('A little rivalry.');
  await expect(page.locator('.hero .hero-lede')).toContainText('One more reason to take the long way home.');
  await expect(page.locator('.launch-label')).toHaveText('Coming soon');
  await expect(page.locator('.closing > p')).toHaveText('Coming to iPhone and Android.');
  await expect(page.locator('details').first()).toContainText('Download links will appear here once it’s available.');
  await expect(page.locator('.asset-caption')).toHaveText('Character illustration. Winners choose their own approved photo.');
  await nav.getByRole('link', { name: 'How it works', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/how-it-works\.html$/);
  await expect(page.locator('main')).toContainText('confirm you’re 18 or older');
  await expect(page.locator('main')).toContainText('Outpace is for adults 18 and older.');
  for (const [route, text] of [
    ['/terms.html', 'You must be at least 18 years old to use Outpace.'],
    ['/rules.html', 'for adults 18 and older.'],
    ['/privacy.html', 'Outpace is intended for people 18 and older.'],
  ]) {
    await page.goto(route);
    await expect(page.locator('main')).toContainText(text);
  }
  await attachEvidence(testInfo, 'footer-semantics-and-copy', { snapshot, links: expected, mailto: 'mailto:support@outpaceapp.com', heroEyebrowRemoved: true, platformNoteRemoved: true, previewCaptionKept: true, legalEligibilityKept: true });
});
