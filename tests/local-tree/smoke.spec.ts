import { test, expect } from './browser-fixture.js';

test.describe('Plugin Browser Environment Smoke Test (LT01)', () => {
  test('extension service worker loads and returns valid extensionId', async ({ extensionId }) => {
    expect(extensionId).toBeDefined();
    expect(extensionId.length).toBeGreaterThan(10);
  });

  test('extension injects into simulated Zhihu column page', async ({ openArticlePage }) => {
    const page = await openArticlePage();
    await expect(page.locator('h1.Post-Title')).toContainText('关于智能体架构与工具调用的深入思考');
    await expect(page.locator('#p1')).toContainText('工具调用');
    await page.close();
  });
});
