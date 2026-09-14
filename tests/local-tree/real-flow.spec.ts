import { test, expect } from './browser-fixture.js';

test.describe('End-to-End Real User Flow Without Test Hook Injection (§5 LT01~LT05)', () => {
  test('Selection -> Create Root Tree -> Show Tree & Answer -> Highlight Selection -> Follow-up Node Addition', async ({ openArticlePage }) => {
    const page = await openArticlePage();

    // Wait for content script to complete initialization
    await page.locator('.zhihu-explore-container').waitFor({ state: 'attached', timeout: 10000 });

    // 1. User selects text in Zhihu article #p1
    await page.evaluate(() => {
      const p = document.querySelector('#p1')!;
      const textNode = p.firstChild || p;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 10);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    // 2. Floating trigger button appears
    const triggerBtn = page.locator('.zhihu-explore-trigger-btn');
    await expect(triggerBtn).toBeVisible({ timeout: 5000 });
    await expect(triggerBtn).toContainText('探索 ✨');

    // 3. User clicks trigger button to open overlay in new-selection mode
    await triggerBtn.click();

    const overlayContainer = page.locator('.zhihu-explore-container');
    await expect(overlayContainer).toBeVisible({ timeout: 5000 });

    const treeView = page.locator('.zhihu-explore-tree-wrapper');
    const answerView = page.locator('.zhihu-explore-answers-container');
    const composer = page.locator('.zhihu-explore-composer');
    const textarea = page.locator('.zhihu-explore-composer textarea');
    const submitBtn = page.locator('.zhihu-explore-composer button:has-text("开启追问")');

    // Verify initial new selection state: tree and answers are hidden, composer visible
    await expect(treeView).toBeHidden();
    await expect(answerView).toBeHidden();
    await expect(composer).toBeVisible();
    await expect(submitBtn).toBeEnabled();

    // 4. User types initial question and submits
    await textarea.fill('什么是工具调用的核心架构？');
    await submitBtn.click();

    // 5. P1-1 Verification: After creation, tree and answer views MUST be visible!
    await expect(treeView).toBeVisible({ timeout: 10000 });
    await expect(answerView).toBeVisible({ timeout: 10000 });

    // Root node card in tree view
    const treeCards = page.locator('.zhihu-explore-tree-node');
    await expect(treeCards).toHaveCount(1);

    // Root answer card in answer view
    const answerCards = page.locator('.zhihu-explore-answer-card');
    await expect(answerCards).toHaveCount(1);
    await expect(answerCards.first()).toContainText('根回答解释内容');

    // 6. P1-2 Verification: Without selection on answer card, follow-up button MUST be disabled!
    const followupBtn = page.locator('.zhihu-explore-composer button');
    await expect(followupBtn).toBeDisabled();
    await expect(followupBtn).toHaveText('请在回答中划选追问文字');

    // 7. User selects text inside the root answer card extra text
    await page.evaluate(() => {
      const extra = document.querySelector('.zhihu-explore-answer-card .zhihu-explore-answer-extra')!;
      const textNode = extra.firstChild || extra;
      const range = document.createRange();
      range.setStart(textNode, 2);
      range.setEnd(textNode, 10);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    // 8. Follow-up button is now enabled for the selected highlight
    await expect(followupBtn).toBeEnabled({ timeout: 5000 });
    await expect(followupBtn).toHaveText('针对选区追问');

    const quotePreview = page.locator('.zhihu-explore-composer div:has-text("已选追问文字")');
    await expect(quotePreview).toBeVisible();

    // 9. User types followup question and submits
    await textarea.fill('请对这段选区深入说明具体的实现机制');
    await followupBtn.click();

    // 10. Followup node added: NODE_ADDED executed, 2 nodes in tree, 2 cards in answers!
    await expect(treeCards).toHaveCount(2, { timeout: 10000 });
    await expect(answerCards).toHaveCount(2, { timeout: 10000 });

    // The second node is selected and focused
    const selectedTreeCard = page.locator('.zhihu-explore-tree-node.selected');
    await expect(selectedTreeCard).toHaveCount(1);
    await expect(selectedTreeCard).toContainText('追问');

    // Button reverts to disabled waiting for new selection
    await expect(followupBtn).toBeDisabled();
    await expect(followupBtn).toHaveText('请在回答中划选追问文字');

    await page.close();
  });
});
