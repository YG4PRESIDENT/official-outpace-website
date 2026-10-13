import { test, expect } from '@playwright/test';

const phrases = [
  'YOUR PEOPLE. YOUR PACE.',
  'THE DAILY WIN IS YOURS.',
  'KEEP EACH OTHER MOVING.',
  'EVERY STEP COUNTS.',
];

async function movePointerOutsideTicker(page) {
  const bounds = await page.locator('.ticker').boundingBox();
  await page.mouse.move(0, bounds.y <= 1 ? page.viewportSize().height - 1 : 0);
}

async function motionSamples(page, count = 3, interval = 200) {
  return page.locator('.ticker-track').evaluate(async (track, options) => {
    const samples = [];
    for (let index = 0; index < options.count; index++) {
      const frameTime = await new Promise(resolve => requestAnimationFrame(resolve));
      const animation = track.getAnimations()[0];
      samples.push({
        frameTime,
        currentTime: animation?.currentTime ?? null,
        x: new DOMMatrixReadOnly(getComputedStyle(track).transform).m41,
        playState: animation?.playState ?? 'none',
      });
      if (index < options.count - 1) await new Promise(resolve => setTimeout(resolve, options.interval));
    }
    return samples;
  }, { count, interval });
}

async function attachScreenshot(page, testInfo, name, locator) {
  await testInfo.attach(`${testInfo.project.name}-${name}`, {
    body: locator
      ? await locator.screenshot({ animations: 'allow' })
      : await page.screenshot({ fullPage: true, animations: 'allow' }),
    contentType: 'image/png',
  });
}

async function attachEvidence(testInfo, name, evidence) {
  await testInfo.attach(name, { body: JSON.stringify(evidence), contentType: 'application/json' });
}

function expectStopped(samples) {
  expect(samples.every(sample => sample.playState === 'paused')).toBe(true);
  expect(Math.abs(samples.at(-1).x - samples[0].x)).toBeLessThan(0.1);
}

function expectMoving(samples) {
  expect(samples.every(sample => sample.playState === 'running')).toBe(true);
  expect(samples.at(-1).x).toBeLessThan(samples[0].x - 1);
}

test.describe('scrolling product highlights', () => {
  test.use({ reducedMotion: 'no-preference' });

  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/');
    await page.locator('.ticker').scrollIntoViewIfNeeded();
    await movePointerOutsideTicker(page);
    await attachEvidence(testInfo, 'ticker-build', {
      stylesheet: await page.locator('link[rel="stylesheet"]').getAttribute('href'),
    });
  });

  test('moves slowly at constant speed and crosses the loop seam without a gap', async ({ page }, testInfo) => {
    const ticker = page.locator('.ticker');
    const track = page.locator('.ticker-track');
    const samples = await motionSamples(page, 4);
    expectMoving(samples);
    const speeds = samples.slice(1).map((sample, index) =>
      (samples[index].x - sample.x) / (sample.currentTime - samples[index].currentTime) * 1000);
    for (const speed of speeds) {
      expect(speed).toBeGreaterThan(5);
      expect(speed).toBeLessThan(50);
    }
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(1.05);
    await attachScreenshot(page, testInfo, 'ticker-moving-home');

    const geometry = await track.evaluate(async element => {
      const animation = element.getAnimations()[0];
      const timing = animation.effect.getComputedTiming();
      animation.pause();
      async function seek(time) {
        animation.currentTime = time;
        await new Promise(resolve => requestAnimationFrame(resolve));
        return [...element.querySelectorAll('.ticker-group')].map(group => ({
          left: group.getBoundingClientRect().left,
          right: group.getBoundingClientRect().right,
          width: group.getBoundingClientRect().width,
          items: [...group.querySelectorAll('.ticker-item')].map(item => ({
            text: item.textContent,
            left: item.getBoundingClientRect().left,
            width: item.getBoundingClientRect().width,
          })),
        }));
      }
      return {
        duration: timing.duration,
        easing: timing.easing,
        properties: [...new Set(animation.effect.getKeyframes().flatMap(frame =>
          Object.keys(frame).filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key))))],
        windowWidth: element.parentElement.getBoundingClientRect().width,
        start: await seek(0),
        before: await seek(timing.duration - 1),
      };
    });
    expect(geometry.duration).toBeGreaterThanOrEqual(30_000);
    expect(geometry.easing).toBe('linear');
    expect(geometry.properties).toEqual(['transform']);
    expect(geometry.start).toHaveLength(2);
    expect(Math.abs(geometry.start[0].width - geometry.start[1].width)).toBeLessThan(0.1);
    expect(Math.abs(geometry.start[1].left - geometry.start[0].right)).toBeLessThan(0.1);
    expect(geometry.start[0].width).toBeGreaterThanOrEqual(geometry.windowWidth - 1);
    await attachScreenshot(page, testInfo, 'ticker-seam-before', ticker);

    const after = await track.evaluate(async element => {
      const animation = element.getAnimations()[0];
      animation.currentTime = animation.effect.getComputedTiming().duration + 1;
      await new Promise(resolve => requestAnimationFrame(resolve));
      return [...element.querySelector('.ticker-group').querySelectorAll('.ticker-item')].map(item => ({
        text: item.textContent,
        left: item.getBoundingClientRect().left,
        width: item.getBoundingClientRect().width,
      }));
    });
    for (const [index, item] of after.entries()) {
      const before = geometry.before[1].items[index];
      expect(item.text).toBe(before.text);
      expect(Math.abs(item.left - before.left)).toBeLessThan(0.2);
      expect(Math.abs(item.width - before.width)).toBeLessThan(0.1);
    }
    await attachScreenshot(page, testInfo, 'ticker-seam-after', ticker);
    await attachEvidence(testInfo, 'ticker-motion-and-seam', { samples, speeds, geometry, after });
  });

  test('keyboard pause remains stopped after blur and resumes while still focused', async ({ page }, testInfo) => {
    const checkbox = page.getByRole('checkbox', { name: 'Pause scrolling highlights' });
    const ticker = page.getByRole('region', { name: 'Product highlights' });
    const snapshot = await ticker.ariaSnapshot();
    for (const phrase of phrases) expect(snapshot.split(phrase).length - 1).toBe(1);
    expect(snapshot).not.toContain('✳');
    await expect(page.locator('.ticker-group').nth(1)).toHaveAttribute('aria-hidden', 'true');

    await page.getByRole('link', { name: 'Skip to content' }).focus();
    for (let index = 0; index < 12 && !(await checkbox.evaluate(element => element === document.activeElement)); index++) {
      await page.keyboard.press('Tab');
    }
    await expect(checkbox).toBeFocused();
    await expect(checkbox).not.toBeChecked();
    await movePointerOutsideTicker(page);
    expectMoving(await motionSamples(page));
    expect(await page.locator('.ticker-control').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
    await attachScreenshot(page, testInfo, 'ticker-keyboard-control', page.locator('.ticker'));

    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    const focusedPaused = await motionSamples(page);
    expectStopped(focusedPaused);
    await attachScreenshot(page, testInfo, 'ticker-paused', page.locator('.ticker'));
    await page.keyboard.press('Tab');
    await expect(checkbox).not.toBeFocused();
    const blurredPaused = await motionSamples(page);
    expectStopped(blurredPaused);

    await checkbox.focus();
    await movePointerOutsideTicker(page);
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeFocused();
    const resumed = await motionSamples(page);
    expectMoving(resumed);
    await attachEvidence(testInfo, 'ticker-keyboard-and-accessibility', { snapshot, focusedPaused, blurredPaused, resumed });
  });

  test('hover pauses on fine pointers without leaving touch visitors stuck', async ({ page }, testInfo) => {
    const fineHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    const checkbox = page.getByRole('checkbox', { name: 'Pause scrolling highlights' });
    let paused;
    if (fineHover) {
      await page.locator('.ticker-window').hover();
      paused = await motionSamples(page);
      expectStopped(paused);
      await expect(checkbox).not.toBeChecked();
      await movePointerOutsideTicker(page);
    } else {
      await checkbox.tap();
      await expect(checkbox).toBeChecked();
      paused = await motionSamples(page);
      expectStopped(paused);
      await checkbox.tap();
      await expect(checkbox).not.toBeChecked();
    }
    const resumed = await motionSamples(page);
    expectMoving(resumed);
    await attachEvidence(testInfo, 'ticker-pointer-pause', { fineHover, paused, resumed });
  });
});

test('reduced motion shows all four highlights without motion or hidden overflow', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const ticker = page.getByRole('region', { name: 'Product highlights' });
  await ticker.scrollIntoViewIfNeeded();
  const items = page.locator('.ticker-group').first().locator('.ticker-item');
  await expect(items).toHaveCount(4);
  await expect(items).toContainText(phrases);
  for (let index = 0; index < phrases.length; index++) await expect(items.nth(index)).toBeVisible();
  await expect(page.locator('.ticker-group').nth(1)).toBeHidden();
  await expect(page.locator('.ticker-toggle')).toBeHidden();
  await expect(page.locator('.ticker-control')).toBeHidden();
  const layout = await ticker.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return {
      width: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
      tickerWidth: element.clientWidth,
      tickerContentWidth: element.scrollWidth,
      animationCount: element.querySelector('.ticker-track').getAnimations().length,
      transform: getComputedStyle(element.querySelector('.ticker-track')).transform,
      bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
      items: [...element.querySelector('.ticker-group').querySelectorAll('.ticker-item')].map(item => {
        const rect = item.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
    };
  });
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.width + 1);
  expect(layout.tickerContentWidth).toBeLessThanOrEqual(layout.tickerWidth + 1);
  expect(layout.animationCount).toBe(0);
  expect(layout.transform).toBe('none');
  for (const item of layout.items) {
    expect(item.left).toBeGreaterThanOrEqual(layout.bounds.left - 1);
    expect(item.right).toBeLessThanOrEqual(layout.bounds.right + 1);
    expect(item.top).toBeGreaterThanOrEqual(layout.bounds.top - 1);
    expect(item.bottom).toBeLessThanOrEqual(layout.bounds.bottom + 1);
  }
  const snapshot = await ticker.ariaSnapshot();
  for (const phrase of phrases) expect(snapshot.split(phrase).length - 1).toBe(1);
  expect(snapshot).not.toContain('checkbox');
  await attachScreenshot(page, testInfo, 'ticker-reduced-motion', ticker);
  await attachEvidence(testInfo, 'ticker-reduced-layout', {
    stylesheet: await page.locator('link[rel="stylesheet"]').getAttribute('href'),
    layout,
    snapshot,
  });
});
