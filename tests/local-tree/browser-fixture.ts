// Playwright browser test fixture for unpacked Chrome Extension
// Complies with 插件局部树执行计划 §4, §5 (LT01)

import { test as base, chromium, type BrowserContext, type Page } from 'playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LocalTreeMockServer } from './mock-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginDist = path.resolve(__dirname, '../../plugin/dist');

export interface TestFixtures {
  context: BrowserContext;
  extensionId: string;
  mockServer: LocalTreeMockServer;
  mockServerOrigin: string;
  openArticlePage: (htmlContent?: string) => Promise<Page>;
}

export const test = base.extend<TestFixtures>({
  mockServer: async ({}, use) => {
    const server = new LocalTreeMockServer(9000);
    await server.start();
    await use(server);
    await server.stop();
  },
  mockServerOrigin: async ({ mockServer }, use) => {
    await use(mockServer.origin);
  },
  context: async ({ mockServer: _mockServer }, use) => {
    if (!fs.existsSync(pluginDist) || !fs.existsSync(path.join(pluginDist, 'manifest.json'))) {
      throw new Error(`Plugin dist not found at ${pluginDist}. Please run "npm run build -w plugin" first.`);
    }

    const userDataDir = path.resolve(__dirname, `../../scratch/test-user-data-dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pluginDist}`,
        `--load-extension=${pluginDist}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    await use(context);
    await context.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    const extensionId = background.url().split('/')[2] ?? '';
    await use(extensionId);
  },
  openArticlePage: async ({ context }, use) => {
    const fn = async (bodyHtml?: string) => {
      const page = await context.newPage();
      await page.route('https://zhuanlan.zhihu.com/p/*', (route) => {
        const defaultArticle = `
          <!DOCTYPE html>
          <html>
            <head><title>知乎专栏测试文章</title></head>
            <body>
              <div class="Post-Main">
                <h1 class="Post-Title">关于智能体架构与工具调用的深入思考</h1>
                <div class="Post-RichTextContainer">
                  <div class="RichText ztext Post-RichText">
                    <p id="p1">通过工具调用（Tool Calling / Function Calling），Agent 可以突破自身参数知识的限制，连接数据库、搜索引擎和沙箱计算环境。</p>
                    <p id="p2">大模型可以构建智能体，而大模型本身也需要外部记忆，大模型的局限性需要工具弥补。</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
        route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: bodyHtml || defaultArticle,
        });
      });

      await page.goto('https://zhuanlan.zhihu.com/p/12345678');
      return page;
    };
    await use(fn);
  },
});

export const expect = base.expect;
