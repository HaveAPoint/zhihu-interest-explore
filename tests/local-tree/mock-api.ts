// Standalone mock HTTP API server for local tree testing
// Complies with 插件局部树执行计划 §4, §5 (LT01)
// Exists only in tests, zero external production dependencies.

import http, { type IncomingMessage, type ServerResponse } from 'node:http';

export interface RecordedRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body: any;
  timestamp: number;
}

export class LocalTreeMockServer {
  private server: http.Server | null = null;
  public origin: string = '';
  public recordedRequests: RecordedRequest[] = [];

  private delayMs: number = 0;
  private pendingResolvers: Array<() => void> = [];
  private manualReleaseMode: boolean = false;
  private failNextConfig: { status: number; message: string } | null = null;
  private customHandlers: Map<string, (req: RecordedRequest, res: ServerResponse) => boolean | Promise<boolean>> = new Map();

  constructor(private port: number = 0) {}

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          console.error('[LocalTreeMockServer] Request handling error:', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: err.message } }));
          }
        });
      });

      this.server.listen(this.port, () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.origin = `http://127.0.0.1:${addr.port}`;
          resolve(this.origin);
        } else {
          reject(new Error('Failed to obtain server address'));
        }
      });
      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    this.releaseAll();
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  reset(): void {
    this.recordedRequests = [];
    this.delayMs = 0;
    this.manualReleaseMode = false;
    this.failNextConfig = null;
    this.customHandlers.clear();
    this.releaseAll();
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  setManualRelease(enabled: boolean): void {
    this.manualReleaseMode = enabled;
  }

  releaseNext(): void {
    const resolver = this.pendingResolvers.shift();
    if (resolver) resolver();
  }

  releaseAll(): void {
    while (this.pendingResolvers.length > 0) {
      const resolver = this.pendingResolvers.shift();
      if (resolver) resolver();
    }
  }

  failNext(status: number = 500, message: string = 'Injected test failure'): void {
    this.failNextConfig = { status, message };
  }

  on(pathPrefix: string, handler: (req: RecordedRequest, res: ServerResponse) => boolean | Promise<boolean>): void {
    this.customHandlers.set(pathPrefix, handler);
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers for extension and test contexts
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    const rawBody = await this.readBody(req);
    let parsedBody: any = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }

    const recorded: RecordedRequest = {
      method: req.method || 'GET',
      path: pathname,
      headers: req.headers,
      body: parsedBody,
      timestamp: Date.now(),
    };
    this.recordedRequests.push(recorded);

    // Apply delay or manual release
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    if (this.manualReleaseMode) {
      await new Promise<void>((r) => this.pendingResolvers.push(r));
    }

    // Apply fail-next injection
    if (this.failNextConfig) {
      const fail = this.failNextConfig;
      this.failNextConfig = null;
      res.writeHead(fail.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: fail.message, code: 'INJECTED_FAILURE' } }));
      return;
    }

    // Check custom handlers
    for (const [prefix, handler] of this.customHandlers.entries()) {
      if (pathname.startsWith(prefix)) {
        const handled = await handler(recorded, res);
        if (handled) return;
      }
    }

    // Default built-in routes
    // 1. POST /guest/classify
    if (pathname === '/guest/classify' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          slug: 'agent-app-dev',
          confidence: 0.95,
          title: 'Agent 应用开发',
        },
      }));
      return;
    }

    // 2. POST /articles/resolve
    if (pathname === '/articles/resolve' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          article_id: recorded.body?.article_id || '550e8400-e29b-41d4-a716-446655440001',
          discipline_slug: 'agent-app-dev',
          title: recorded.body?.title || 'Test Article',
        },
      }));
      return;
    }

    // 3. POST /trees (Generate root answer)
    if (pathname === '/trees' && req.method === 'POST') {
      const highlight = recorded.body?.anchor_highlight || '工具调用';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          title: `概念：${highlight.slice(0, 8)}`,
          extra: `这是本地假 HTTP 服务针对「${highlight}」生成的根回答解释内容，完全满足 contracts 契约。`,
          sources: [
            {
              title: '本地测试参考来源',
              url: 'https://example.com/test-source',
            },
          ],
          candidates: [
            {
              global_node_id: 'agent-app-dev/tool-calling',
              title: '工具使用与调用',
              degree: 'exact',
              reason: '高亮核心概念即工具调用',
            },
          ],
        },
      }));
      return;
    }

    // 4. POST /trees/:id/nodes (Generate followup answer)
    const followupMatch = pathname.match(/^\/trees\/([^/]+)\/nodes$/);
    if (followupMatch && req.method === 'POST') {
      const highlight = recorded.body?.highlight_text || '追问高亮';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          title: `追问：${highlight.slice(0, 8)}`,
          extra: `这是本地假 HTTP 服务针对选区「${highlight}」生成的追问补充回答。`,
          sources: [],
        },
      }));
      return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Route not found: ${req.method} ${pathname}` } }));
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
}
