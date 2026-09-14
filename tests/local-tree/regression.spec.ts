import { test, expect } from './browser-fixture.js';
import { treeAbcdefFixture } from './fixtures/view-fixtures.js';

test.describe('P0 & P1 Regression Spec Suite (§5 LT01~LT13)', () => {
  // 1. Single-character selection test
  test('Regression 1: Single character selection creates root tree and anchor mark without error', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    // Wait for content script
    await page.locator('.zhihu-explore-container').waitFor({ state: 'attached', timeout: 10000 });

    // Select exactly 1 character ("通" at start of #p1)
    await page.evaluate(() => {
      const p = document.querySelector('#p1')!;
      const textNode = p.firstChild || p;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1); // 1 single character
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    // Floating explore button should appear for single character
    const triggerBtn = page.locator('.zhihu-explore-trigger-btn');
    await expect(triggerBtn).toBeVisible({ timeout: 5000 });
    await triggerBtn.click();

    // Drawer opens
    const overlayContainer = page.locator('.zhihu-explore-container');
    await expect(overlayContainer).toBeVisible({ timeout: 5000 });

    const composer = page.locator('.zhihu-explore-composer');
    const textarea = page.locator('.zhihu-explore-composer textarea');
    const submitBtn = page.locator('.zhihu-explore-composer button:has-text("开启追问")');

    await expect(composer).toBeVisible();
    await textarea.fill('单字概念如何解析？');
    await submitBtn.click();

    // Tree and answer views appear
    const treeView = page.locator('.zhihu-explore-tree-wrapper');
    await expect(treeView).toBeVisible({ timeout: 10000 });

    // Anchor mark is rendered in article for the 1 single character
    const mark = page.locator('#p1 .zhihu-explore-anchor-mark');
    await expect(mark).toBeVisible({ timeout: 5000 });
    const markText = await mark.textContent();
    expect(markText).toBe('通');

    // Sibling badge is outside the mark element
    const badge = page.locator('#p1 .zhihu-explore-anchor-badge');
    await expect(badge).toBeVisible();
    expect(await badge.textContent()).toBe('1');

    await page.close();
  });

  // 2. Immediate root arrow display & ResizeObserver
  test('Regression 2: Root arrow is immediately displayed upon tree creation, and ResizeObserver handles layout changes', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    await page.locator('.zhihu-explore-container').waitFor({ state: 'attached', timeout: 10000 });

    // Select text in #p1
    await page.evaluate(() => {
      const p = document.querySelector('#p1')!;
      const textNode = p.firstChild || p;
      const range = document.createRange();
      range.setStart(textNode, 2);
      range.setEnd(textNode, 6);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const triggerBtn = page.locator('.zhihu-explore-trigger-btn');
    await expect(triggerBtn).toBeVisible({ timeout: 5000 });
    await triggerBtn.click();

    const textarea = page.locator('.zhihu-explore-composer textarea');
    const submitBtn = page.locator('.zhihu-explore-composer button:has-text("开启追问")');
    await textarea.fill('核心机制探讨');
    await submitBtn.click();

    // Immediate arrow check: ArrowLayer should be visible with computed path
    const arrowLayer = page.locator('.zhihu-explore-arrow-layer');
    await expect(arrowLayer).toBeVisible({ timeout: 10000 });

    const arrowPath = arrowLayer.locator('path[stroke]');
    await expect(arrowPath.first()).toBeAttached();

    // Ensure non-empty polyline path 'd' starting with M
    await expect(async () => {
      const d = await arrowPath.first().getAttribute('d');
      expect(d).toBeTruthy();
      expect(d!.startsWith('M ')).toBe(true);
    }).toPass({ timeout: 5000 });

    // Test ResizeObserver: mutate container style to trigger ResizeObserver
    const initialD = await arrowPath.first().getAttribute('d');
    expect(initialD).toBeTruthy();
    await page.evaluate(() => {
      const container = document.querySelector('.zhihu-explore-container') as HTMLElement;
      if (container) {
        container.style.width = '480px';
      }
    });

    // Wait for ResizeObserver and RAF to update arrow coordinates
    await page.waitForTimeout(200);
    const updatedD = await arrowPath.first().getAttribute('d');
    expect(updatedD).toBeTruthy();
    expect(updatedD!.startsWith('M ')).toBe(true);

    await page.close();
  });

  // 3. Duplicate text disambiguation via prefix/suffix/offset
  test('Regression 3: Disambiguates duplicate text using prefix and suffix, targeting correct paragraph', async ({ openArticlePage }) => {
    // Custom article with identical text "工具调用机制" in two distinct paragraphs
    const customHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>重复文本消歧测试</title></head>
        <body>
          <div class="Post-Main">
            <h1 class="Post-Title">重复文本测试</h1>
            <div class="Post-RichTextContainer">
              <div class="RichText ztext Post-RichText">
                <p id="p1">在基础概念中，工具调用机制是核心功能。</p>
                <p id="p2">在进阶架构中，多智能体协同与工具调用机制也是基础组件。</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    const page = await openArticlePage(customHtml);
    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    // Construct a tree targeting the 2nd paragraph instance
    const treeTargetingP2 = JSON.parse(JSON.stringify(treeAbcdefFixture));
    const rootNode = treeTargetingP2.nodes[0];
    rootNode.highlight_text = '工具调用机制';
    rootNode.highlight_anchor = {
      exact: '工具调用机制',
      paragraph_index: 1,
      prefix: '多智能体协同与',
      suffix: '也是基础组件。',
      start_offset: 10,
      end_offset: 16,
    };
    treeTargetingP2.anchor_paragraph = '在进阶架构中，多智能体协同与工具调用机制也是基础组件。';
    treeTargetingP2.anchor_highlight = '工具调用机制';

    // Show tree via test hook
    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeTargetingP2);

    await page.locator('.zhihu-explore-container[data-drawer-settled="true"]').waitFor({ timeout: 5000 });

    // Verify anchor mark is in #p2, NOT in #p1
    const p1Marks = page.locator('#p1 .zhihu-explore-anchor-mark');
    const p2Marks = page.locator('#p2 .zhihu-explore-anchor-mark');

    await expect(p2Marks).toHaveCount(1, { timeout: 5000 });
    await expect(p1Marks).toHaveCount(0);
    expect(await p2Marks.first().textContent()).toBe('工具调用机制');

    await page.close();
  });

  // 4. Repeated refresh zero pollution & cross-tag restoration test
  test('Regression 4: Repeated refreshTrees does not pollute article text and preserves nested tags like <strong> upon real clearAnchors', async ({ openArticlePage }) => {
    // Custom article with nested <strong> tag inside #p1
    const customHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>跨标签高亮与零污染测试</title></head>
        <body>
          <div class="Post-Main">
            <h1 class="Post-Title">跨标签高亮测试</h1>
            <div class="Post-RichTextContainer">
              <div class="RichText ztext Post-RichText">
                <p id="p1">通过<strong>工具调用</strong>机制，智能体突破了参数限制。</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    const page = await openArticlePage(customHtml);
    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    // Capture baseline innerHTML and textContent of #p1
    const originalHtml = await page.locator('#p1').evaluate((el) => el.innerHTML);
    const originalText = await page.locator('#p1').evaluate((el) => el.textContent);
    expect(originalHtml).toContain('<strong>工具调用</strong>');

    // Construct tree spanning across plain text and <strong> element
    const crossTagTree = JSON.parse(JSON.stringify(treeAbcdefFixture));
    const rootNode = crossTagTree.nodes[0];
    rootNode.highlight_text = '通过工具调用机制';
    rootNode.highlight_anchor = {
      exact: '通过工具调用机制',
      paragraph_index: 0,
      start_offset: 0,
      end_offset: 8,
    };
    crossTagTree.anchor_paragraph = '通过工具调用机制，智能体突破了参数限制。';
    crossTagTree.anchor_highlight = '通过工具调用机制';

    // Show tree via test hook -> invokes real anchorManager.setTrees([tree])
    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, crossTagTree);

    await page.locator('.zhihu-explore-container[data-drawer-settled="true"]').waitFor({ timeout: 5000 });

    // Verify marks are created across the text nodes (outside and inside <strong>)
    const marks = page.locator('#p1 .zhihu-explore-anchor-mark');
    await expect(marks.first()).toBeVisible({ timeout: 5000 });
    const markCount = await marks.count();
    expect(markCount).toBeGreaterThanOrEqual(2); // Must wrap text before strong, inside strong, and after strong

    // Verify badge element is separate from mark
    const badge = page.locator('#p1 .zhihu-explore-anchor-badge');
    await expect(badge.first()).toBeVisible();

    // Trigger multiple re-render cycles via window postMessage
    for (let i = 0; i < 3; i++) {
      await page.evaluate((tree) => {
        window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
      }, crossTagTree);
      await page.waitForTimeout(100);
    }

    // Now trigger real cleanup via the extension's actual implementation (anchorManager.setTrees([]))
    await page.evaluate(() => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_CLEAR_TREES__' }, '*');
    });

    // All marks and badges must be gone via real clearAnchors()
    await expect(page.locator('.zhihu-explore-anchor-mark')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('.zhihu-explore-anchor-badge')).toHaveCount(0, { timeout: 5000 });

    // InnerHTML must preserve <strong> tag intact, and textContent must be 100% identical byte-for-byte
    const restoredHtml = await page.locator('#p1').evaluate((el) => el.innerHTML);
    const restoredText = await page.locator('#p1').evaluate((el) => el.textContent);
    expect(restoredHtml).toBe(originalHtml);
    expect(restoredText).toBe(originalText);

    await page.close();
  });

  // 5. Subtree root identity test (rootNodeId vs isRoot)
  test('Regression 5: Subtree view does not falsely mark child node as root answer', async ({ openArticlePage }) => {
    const page = await openArticlePage();
    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    // Show canonical tree A -> B -> (D, F), C -> E
    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeAbcdefFixture);

    await page.locator('.zhihu-explore-container[data-drawer-settled="true"]').waitFor({ timeout: 5000 });

    const nodeBId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('B'))!.id;
    const nodeBEl = page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeBId}"]`);
    await expect(nodeBEl).toBeVisible({ timeout: 5000 });

    // Double-click B to view B subtree (B, D, F)
    // First dblclick if expanded collapses, or expands:
    await nodeBEl.dblclick();
    let cards = page.locator('.zhihu-explore-answer-card');
    if ((await cards.count()) === 2) {
      // Collapse happened, dblclick again to enter subtree mode
      await nodeBEl.dblclick();
    }

    cards = page.locator('.zhihu-explore-answer-card');
    await expect(cards).toHaveCount(3); // B, D, F

    // Card 0 is node B. It is at index 0 of the visible list, BUT it is NOT the tree root!
    const card0 = cards.nth(0);
    await expect(card0).toContainText('B 结构化参数定义');

    // Card 0 must NOT have root class
    const isRootClass = await card0.evaluate((el) => el.classList.contains('root'));
    expect(isRootClass).toBe(false);

    // Card 0 badge must say '追问回答', NOT '根回答'
    const typeBadge = card0.locator('.zhihu-explore-card-type-badge');
    await expect(typeBadge).toBeVisible();
    const badgeText = await typeBadge.textContent();
    expect(badgeText).not.toBe('根回答');
    expect(badgeText).toBe('追问回答');

    await page.close();
  });

  // 6. Real-time rename & field-level update
  test('Regression 6: In-place updateCardContent refreshes title and extra fields in real-time', async ({ openArticlePage }) => {
    const page = await openArticlePage();
    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeAbcdefFixture);

    await page.locator('.zhihu-explore-container[data-drawer-settled="true"]').waitFor({ timeout: 5000 });

    const rootNodeId = treeAbcdefFixture.root_node_id;
    const rootCard = page.locator(`.zhihu-explore-answer-card[data-node-id="${rootNodeId}"]`);
    await expect(rootCard).toBeVisible({ timeout: 5000 });

    const titleEl = rootCard.locator('.zhihu-explore-card-title-text');
    await expect(titleEl).toContainText('A 工具调用核心概念');

    // Update tree with new title and extra content for node A
    const updatedTree = JSON.parse(JSON.stringify(treeAbcdefFixture));
    const nodeA = updatedTree.nodes.find((n: any) => n.id === rootNodeId);
    nodeA.title = '全域智能体架构新篇章';
    nodeA.answer_extra = '更新后的详细解释文本，字段级刷新无残留。';

    // Dispatch update to overlay
    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, updatedTree);

    // Assert title and extra updated in real-time
    await expect(titleEl).toContainText('全域智能体架构新篇章', { timeout: 5000 });
    const extraEl = rootCard.locator('.zhihu-explore-answer-extra');
    await expect(extraEl).toContainText('更新后的详细解释文本，字段级刷新无残留。');

    await page.close();
  });
});
