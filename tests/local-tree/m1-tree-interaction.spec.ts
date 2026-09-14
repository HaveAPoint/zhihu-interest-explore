// Milestone M1: Tree Rendering, Click/Dblclick, and Answer Chain Interaction
// Complies with 插件局部树执行计划 §3.1, §3.2, §5 (LT05, Milestone M1)

import { test, expect } from './browser-fixture.js';
import { treeAbcdefFixture } from './fixtures/view-fixtures.js';

test.describe('Milestone M1: Local Tree Interaction (§5 LT05)', () => {
  test('A/B/F default path, click C selects, dblclick C expands/collapses E, dblclick B shows B/D/F', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    // Wait for extension overlay to be initialized in DOM
    const container = page.locator('.zhihu-explore-container[data-overlay-ready="true"]');
    await container.waitFor({ state: 'attached', timeout: 5000 });

    // Send canonical A/B/C/D/E/F tree via cross-world postMessage
    await page.evaluate((tree) => {
      window.postMessage({ type: '__ZHIHU_EXPLORE_TEST_SHOW_TREE__', tree }, '*');
    }, treeAbcdefFixture);

    const nodeAId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('A'))!.id;
    const nodeBId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('B'))!.id;
    const nodeCId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('C'))!.id;
    const nodeDId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('D'))!.id;
    const nodeEId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('E'))!.id;
    const nodeFId = treeAbcdefFixture.nodes.find((n) => n.title.startsWith('F'))!.id;

    // 1. Initial State: Latest node F is selected
    const nodeFEl = page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeFId}"]`);
    await expect(nodeFEl).toBeVisible();

    // Visible nodes: A, B, C, D, F. E must be hidden!
    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeAId}"]`)).toBeVisible();
    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeBId}"]`)).toBeVisible();
    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeCId}"]`)).toBeVisible();
    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeDId}"]`)).toBeVisible();
    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeEId}"]`)).toHaveCount(0);

    // C has collapsed badge +1
    const badgeC = page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeCId}"] .zhihu-explore-tree-badge`);
    await expect(badgeC).toHaveText('+1');

    // Default path answer cards: A, B, F (3 cards)
    let cards = page.locator('.zhihu-explore-answer-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('A 工具调用核心概念');
    await expect(cards.nth(1)).toContainText('B 结构化参数定义');
    await expect(cards.nth(2)).toContainText('F 缺少必填参数处理');

    // 2. Single click node C: immediately selected, path switches to A -> C
    const nodeCEl = page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeCId}"]`);
    await nodeCEl.click();

    cards = page.locator('.zhihu-explore-answer-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('A 工具调用核心概念');
    await expect(cards.nth(1)).toContainText('C 宿主环境调度角色');
    // E is still collapsed!
    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeEId}"]`)).toHaveCount(0);

    // 3. Double click node C: expands C, node E becomes visible, answer switches to subtree (C, E)
    await nodeCEl.dblclick();

    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeEId}"]`)).toBeVisible();
    cards = page.locator('.zhihu-explore-answer-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('C 宿主环境调度角色');
    await expect(cards.nth(1)).toContainText('E 沙盒容器安全隔离');

    // 4. Double click node C again: collapses C, E hidden again, answers return to path (A, C)
    await nodeCEl.dblclick();

    await expect(page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeEId}"]`)).toHaveCount(0);
    cards = page.locator('.zhihu-explore-answer-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('A 工具调用核心概念');
    await expect(cards.nth(1)).toContainText('C 宿主环境调度角色');

    // 5. Double click node B: since B was expanded, first dblclick collapses B to path (A, B)
    const nodeBEl = page.locator(`.zhihu-explore-tree-node[data-node-id="${nodeBId}"]`);
    await nodeBEl.dblclick();

    cards = page.locator('.zhihu-explore-answer-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('A 工具调用核心概念');
    await expect(cards.nth(1)).toContainText('B 结构化参数定义');

    // Second dblclick on B: expands B and its subtree, showing B, D, F
    await nodeBEl.dblclick();

    cards = page.locator('.zhihu-explore-answer-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('B 结构化参数定义');
    await expect(cards.nth(1)).toContainText('D JSON Schema 验证');
    await expect(cards.nth(2)).toContainText('F 缺少必填参数处理');

    // Save screenshot for Milestone M1 visual delivery
    await page.screenshot({ path: 'scratch/m1-canonical-tree.png', fullPage: true });

    await page.close();
  });
});
