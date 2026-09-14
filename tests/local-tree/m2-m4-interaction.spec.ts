// End-to-end regression tests for Milestones M2, M3, and M4 (§5 LT06 ~ LT13)
// Covers verification matrix items V06 ~ V18

import { test, expect } from './browser-fixture.js';
import { treeAbcdefFixture } from './fixtures/view-fixtures.js';

test.describe('Milestones M2~M4: Followup Selection, Arrow, Long-press & Host Layout (§5 LT06-LT13)', () => {
  test('V06 & V07: Answer card text selection and focus preservation in composer', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    // 1. Wait for extension overlay to be ready in DOM
    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    // 2. Send canonical tree
    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeAbcdefFixture);

    // Wait for tree nodes to appear
    await expect(page.locator('.zhihu-explore-tree-node').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.zhihu-explore-answer-extra').first()).toBeVisible({ timeout: 5000 });

    // 3. Select text in answer card extra container
    await page.evaluate(() => {
      const extraEl = document.querySelector('.zhihu-explore-answer-extra') as HTMLElement;
      if (!extraEl) return;
      const textNode = extraEl.firstChild;
      if (!textNode) return;

      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 2); // 2 characters

      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      }
    });

    // Check composer quote preview appears
    const quotePreview = page.locator('.zhihu-explore-composer div:has-text("已选追问文字")');
    await expect(quotePreview).toBeVisible({ timeout: 3000 });

    // V07: Focus the textarea — selection in quote preview must NOT be cleared!
    const textarea = page.locator('.zhihu-explore-composer textarea');
    await textarea.focus();
    await expect(quotePreview).toBeVisible();

    await page.close();
  });

  test('V09 & V10 & V11: Segmented highlight rendering and viewport arrow layer', async ({ openArticlePage }) => {
    const page = await openArticlePage();
    await page.setViewportSize({ width: 1400, height: 900 });

    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    // Inject a tree fixture where a node has highlight_anchor on parent
    const treeWithHighlights = JSON.parse(JSON.stringify(treeAbcdefFixture));
    const nodeA = treeWithHighlights.nodes.find((n: any) => n.title.startsWith('A'));
    const nodeB = treeWithHighlights.nodes.find((n: any) => n.title.startsWith('B'));
    if (nodeA && nodeB) {
      nodeB.highlight_anchor = {
        exact: nodeA.answer_extra.slice(0, 5),
        start_offset: 0,
        end_offset: 5,
      };
    }

    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeWithHighlights);

    await page.locator('.zhihu-explore-container[data-drawer-settled="true"]').waitFor({ timeout: 5000 });
    await expect(page.locator('.zhihu-explore-tree-node').first()).toBeVisible({ timeout: 5000 });

    // Select node B so its answer card is scrolled into view and connected to parent mark
    if (nodeB) {
      const nodeBTreeEl = page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeB.id}"]`);
      await nodeBTreeEl.click();
    }

    // V09: Check segmented <mark> rendered in parent card
    const markEl = page.locator('.zhihu-explore-highlight-mark');
    await expect(markEl.first()).toBeVisible({ timeout: 3000 });

    // V10 & V11: Arrow layer exists, is visible, and renders solid orthogonal lines
    const arrowLayer = page.locator('.zhihu-explore-arrow-layer');
    await expect(arrowLayer).toBeAttached();

    // Verify SVG path element attributes (§3.5: solid lines, stroke-width 1.5, no dasharray)
    const paths = arrowLayer.locator('path[stroke]');
    await expect(paths.first()).toBeAttached();
    const strokeDash = await paths.first().getAttribute('stroke-dasharray');
    expect(strokeDash).toBeNull();
    const strokeWidth = await paths.first().getAttribute('stroke-width');
    expect(strokeWidth).toBe('1.5');

    // Path must have calculated coordinates (non-empty 'd' attribute starting with M)
    await expect(async () => {
      const pathD = await paths.first().getAttribute('d');
      expect(pathD).toBeTruthy();
      expect(pathD!.startsWith('M ')).toBe(true);
    }).toPass({ timeout: 3000 });

    await page.close();
  });

  test('V12 & V13: Long-press 400ms triggers ghost and delete bar, Esc/move cancels, drop on bar deletes', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeAbcdefFixture);

    await page.locator('.zhihu-explore-container[data-drawer-settled="true"]').waitFor({ timeout: 5000 });

    const nodeBId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('B'))!.id;
    const nodeBEl = page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeBId}"]`);
    await expect(nodeBEl).toBeVisible({ timeout: 5000 });

    const deleteBar = page.locator('.zhihu-explore-delete-bar');
    const ghost = page.locator('.zhihu-explore-drag-ghost');

    // 1. Move >6px before 400ms: cancel timer, no ghost, no deleteBar
    await nodeBEl.scrollIntoViewIfNeeded();
    const box1 = await nodeBEl.boundingBox();
    expect(box1).toBeTruthy();

    await page.mouse.move(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box1!.x + box1!.width / 2 + 20, box1!.y + box1!.height / 2); // moved 20px (>6px) immediately
    await page.waitForTimeout(450);
    await expect(deleteBar).toBeHidden();
    await expect(ghost).toBeHidden();
    await page.mouse.up();

    // 2. Test 400ms long-press with Esc key cancel
    await nodeBEl.scrollIntoViewIfNeeded();
    const box2 = await nodeBEl.boundingBox();
    expect(box2).toBeTruthy();

    await page.mouse.move(box2!.x + box2!.width / 2, box2!.y + box2!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await expect(deleteBar).toBeVisible();
    await expect(ghost).toBeVisible();

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await expect(deleteBar).toBeHidden();
    await expect(ghost).toBeHidden();
    await page.mouse.up();

    // 3. Test 400ms long-press with real drag to delete bar and release (Drop to delete)
    await nodeBEl.scrollIntoViewIfNeeded();
    const box3 = await nodeBEl.boundingBox();
    expect(box3).toBeTruthy();

    await page.mouse.move(box3!.x + box3!.width / 2, box3!.y + box3!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await expect(deleteBar).toBeVisible();
    await expect(ghost).toBeVisible();

    const barBox = await deleteBar.boundingBox();
    expect(barBox).toBeTruthy();

    // Move to delete bar center
    await page.mouse.move(barBox!.x + barBox!.width / 2, barBox!.y + barBox!.height / 2);
    // Release pointer inside delete bar
    await page.mouse.up();

    // Node drag ends and cleans up ghost & delete bar
    await expect(deleteBar).toBeHidden();
    await expect(ghost).toBeHidden();

    // V13: Assert node B was actually deleted from local tree and answer view
    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeBId}"]`)).toHaveCount(0);
    await expect(page.locator(`.zhihu-explore-answer-card[data-node-id="${nodeBId}"]`)).toHaveCount(0);

    await page.close();
  });

  test('V17 & V18: Host layout shift/restore on close, and correct app origin in binding link', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    // Set wide viewport (>1400px) BEFORE opening drawer
    await page.setViewportSize({ width: 1600, height: 900 });

    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    const treeWithBinding = JSON.parse(JSON.stringify(treeAbcdefFixture));
    treeWithBinding.global_node_id = 'global-concept-001';

    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeWithBinding);

    await expect(page.locator('.zhihu-explore-tree-node').first()).toBeVisible({ timeout: 5000 });

    // V17: Wide screen shifts host body margin-right
    const bodyMarginRight = await page.evaluate(() => document.body.style.marginRight);
    expect(bodyMarginRight).toBe('360px');

    // V18: Binding status displays global node id and correct app origin route (not /explore)
    const bindingStatus = page.locator('.zhihu-explore-binding-status');
    await expect(bindingStatus).toBeVisible();
    await expect(bindingStatus).toContainText('已挂靠知识点: global-concept-001');

    const link = bindingStatus.locator('a');
    await expect(link).toContainText('在知识图谱中查看 ↗');
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    // Route must follow /d/:discipline?focus=... (§P1-7)
    expect(href!).toContain('/d/');
    expect(href!).toContain('focus=global-concept-001');
    expect(href!).not.toContain('/explore?');

    // Close drawer
    const closeBtn = page.locator('.zhihu-explore-container button:has-text("✕")');
    await closeBtn.click();

    // Host body margin-right must be restored faithfully (no lingering margin) (§3.7, V17)
    const restoredMargin = await page.evaluate(() => document.body.style.marginRight);
    expect(restoredMargin).toBe('');

    await page.close();
  });
});
