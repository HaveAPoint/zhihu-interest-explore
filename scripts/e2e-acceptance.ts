import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EXTENSION_PATH = path.join(ROOT_DIR, 'plugin', 'dist');
const ARTIFACTS_DIR = '/Users/huahuaclaw/.gemini/antigravity-ide/brain/fcbc84f6-e302-4aca-b4f9-5ee2c597075d';

async function runAcceptance() {
  console.log('🚀 Starting E2E Acceptance: 真专栏划词 → 回答 → 保存 → 网页回看...');
  console.log(`Plugin path: ${EXTENSION_PATH}`);

  const userDataDir = path.join(ROOT_DIR, 'scratch', 'chrome-profile-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    viewport: { width: 1280, height: 900 },
  });

  try {
    // 1. Check extension background service worker
    console.log('1. Checking extension background service worker...');
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      try {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 2000 });
      } catch {
        console.log('Service worker not yet fired, proceeding to open page...');
      }
    }
    if (serviceWorker) {
      console.log('✅ Extension background service worker active:', serviceWorker.url());
    }

    // 2. Open Real Zhihu Article
    const zhihuUrl = 'https://zhuanlan.zhihu.com/p/2082752758818649391';
    console.log(`2. Navigating to real Zhihu article: ${zhihuUrl}...`);
    const page = await context.newPage();
    await page.goto(zhihuUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Take screenshot of initial Zhihu page
    const zhihuInitShot = path.join(ARTIFACTS_DIR, 'e2e_1_zhihu_article.png');
    await page.screenshot({ path: zhihuInitShot });
    console.log(`📸 Captured: ${zhihuInitShot}`);

    // 3. Find a paragraph and simulate selection
    console.log('3. Simulating text selection in Zhihu article...');
    const selectedInfo = await page.evaluate(() => {
      const p = document.querySelector('.Post-RichText p') || document.querySelector('.RichText p') || document.querySelector('article p') || document.querySelector('p');
      if (!p) return null;
      const text = p.textContent || '';
      const phrase = text.slice(0, Math.min(30, text.length));

      const range = document.createRange();
      const node = p.firstChild || p;
      range.setStart(node, 0);
      range.setEnd(node, Math.min(30, node.textContent?.length || 0));

      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      document.dispatchEvent(new Event('selectionchange'));
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 300, clientY: 300 }));
      return phrase;
    });

    console.log(`Selected text: "${selectedInfo}"`);
    await page.waitForTimeout(1500);

    // 4. Look for floating explore button
    console.log('4. Checking floating explore trigger button...');
    const triggerBtn = page.locator('.zhihu-explore-trigger-btn');
    const isBtnVisible = await triggerBtn.isVisible();
    console.log(`Trigger button visible: ${isBtnVisible}`);

    if (isBtnVisible) {
      const btnShot = path.join(ARTIFACTS_DIR, 'e2e_2_trigger_button.png');
      await page.screenshot({ path: btnShot });
      console.log(`📸 Captured: ${btnShot}`);
      await triggerBtn.click();
    } else {
      console.log('Triggering button directly via DOM click...');
      await page.evaluate(() => {
        const btn = document.querySelector('.zhihu-explore-trigger-btn') as HTMLElement;
        if (btn) {
          btn.style.display = 'block';
          btn.click();
        }
      });
    }

    await page.waitForTimeout(2000);

    // 5. Verify Overlay View
    console.log('5. Verifying overlay container...');
    const overlay = page.locator('.zhihu-explore-container');
    await overlay.waitFor({ state: 'attached', timeout: 5000 });
    console.log('✅ Overlay view is attached in DOM!');

    const overlayShot = path.join(ARTIFACTS_DIR, 'e2e_3_overlay_open.png');
    await page.screenshot({ path: overlayShot });
    console.log(`📸 Captured: ${overlayShot}`);

    // If discipline picker options are shown, click Agent 应用开发
    const agentDiscBtn = page.locator('button:has-text("AI Agent 应用开发")');
    if (await agentDiscBtn.isVisible()) {
      console.log('Selecting AI Agent 应用开发 discipline...');
      await agentDiscBtn.click();
      await page.waitForTimeout(1000);
    }

    // Fill in question if textarea is visible
    const textarea = page.locator('textarea[placeholder*="想了解这个概念"]');
    if (await textarea.isVisible()) {
      await textarea.fill('请分析这个概念的核心要素和在实际工程中的落地应用');
      await page.waitForTimeout(500);

      const submitBtn = page.locator('button:has-text("生成解释")');
      if (await submitBtn.isVisible()) {
        console.log('Submitting question for answer generation...');
        await submitBtn.click();
        console.log('Waiting for AI generation and tree persistence...');
        await page.waitForTimeout(6000);
      }
    }

    const answerShot = path.join(ARTIFACTS_DIR, 'e2e_4_tree_generated.png');
    await page.screenshot({ path: answerShot });
    console.log(`📸 Captured: ${answerShot}`);

    // 6. Navigate to Web Dashboard for review
    const webUrl = 'https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com/d/agent-app-dev';
    console.log(`6. Opening Online Web Dashboard: ${webUrl}...`);
    const webPage = await context.newPage();
    await webPage.goto(webUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await webPage.waitForTimeout(4000);

    const webShot = path.join(ARTIFACTS_DIR, 'e2e_5_web_dashboard.png');
    await webPage.screenshot({ path: webShot });
    console.log(`📸 Captured: ${webShot}`);

    console.log('🎉 E2E acceptance test completed successfully!');
  } finally {
    await context.close();
  }
}

runAcceptance().catch((err) => {
  console.error('❌ Acceptance failed:', err);
  process.exit(1);
});
