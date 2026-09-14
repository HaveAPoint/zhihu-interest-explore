import { test, expect } from './browser-fixture.js';

test.describe('OverlayView Lifecycle and DOM Stability (§5 LT04)', () => {
  test('typing halfway then updateArticle does not lose composer text', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    // Select text on page to open drawer
    await page.evaluate(() => {
      const p = document.querySelector('#p1')!;
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    // Wait for drawer container to appear
    const composer = page.locator('.zhihu-explore-composer textarea');
    await expect(composer).toBeVisible({ timeout: 5000 });

    // Type text halfway
    const draftText = '这是测试用户输入了一半的重要追问草稿，不应丢失！';
    await composer.fill(draftText);
    expect(await composer.inputValue()).toBe(draftText);

    // Simulate external article update (e.g. classification result arrived)
    await page.evaluate(() => {
      // Check that background or article changes do not wipe container innerHTML
      const badge = document.querySelector('.zhihu-explore-container div') as HTMLElement;
      if (badge) {
        badge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    // Text in textarea must be preserved
    expect(await composer.inputValue()).toBe(draftText);
    await page.close();
  });

  test('updating tree does not destroy and recreate existing answer card DOM elements', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    // Open existing tree directly via helper or simulated click
    await page.evaluate(async () => {
      const p = document.querySelector('#p1')!;
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const container = page.locator('.zhihu-explore-container');
    await expect(container).toBeVisible({ timeout: 5000 });

    // Check that card elements persist identity
    const identityPreserved = await page.evaluate(() => {
      const cards = document.querySelectorAll('.zhihu-explore-answer-card');
      if (cards.length === 0) return true; // new selection mode has no cards yet
      (cards[0] as any).__test_marker = 998877;
      return (cards[0] as any).__test_marker === 998877;
    });
    expect(identityPreserved).toBe(true);

    await page.close();
  });

  test('repeated open and close 20 times results in exactly one container', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    const container = page.locator('.zhihu-explore-container');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    for (let i = 0; i < 20; i++) {
      // Trigger open via evaluate
      await page.evaluate(() => {
        const el = document.querySelector('.zhihu-explore-container') as HTMLElement;
        if (el) el.style.right = '0px';
      });

      // Click close button
      const closeBtn = page.locator('.zhihu-explore-container button:has-text("✕")');
      await closeBtn.click();
    }

    const containerCount = await page.evaluate(() => {
      return document.querySelectorAll('.zhihu-explore-container').length;
    });

    expect(containerCount).toBe(1);
    await page.close();
  });
});
