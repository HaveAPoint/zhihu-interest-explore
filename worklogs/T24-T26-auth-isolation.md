# T24-T26 认证与账户隔离工作日志（第一批二次复核与加固）

## 1. 修改背景与复核问题修复

针对用户探针复核反馈的阻塞问题，完成以下针对性整改与加固：

1. **P0 — Service Worker 启动即崩溃（消除 process.env）**：
   - 在 `plugin/src/background/index.ts` 中完全移除 `process.env` 依赖，采用全局编译期常量 `__API_ORIGIN__` 与 `__APP_ORIGIN__`。
   - 在 `plugin/scripts/build-plugin.js` 中配置 esbuild `define`（注入 `__API_ORIGIN__`、`__APP_ORIGIN__`、`process.env.NODE_ENV`、`process.env: '{}'`），杜绝 MV3 环境下的 `ReferenceError`。
   - 在 `scripts/release-check.ts` 中新增打包产物静态扫描：若扩展 dist 中出现字面量 `"process.env"` 则构建直接中断。

2. **P0 — `manifest.json` 通配符收敛**：
   - 将 `plugin/manifest.json` 中的 `externally_connectable.matches` 从 `https://*.tcloudbaseapp.com/*` 收敛为精准配置单域名：`["http://localhost:5173/*", "https://zhihu-explore.tcloudbaseapp.com/*"]`。
   - `build-plugin.js` 在生产构建时自动剥离 `localhost`；`release-check.ts` 强校验 matches 必须非空且严禁包含 `*` 或 `<all_urls>`。

3. **P1 — 开放重定向漏洞防御 (`redirect_uri` 白名单)**：
   - 在 `server/src/auth/zhihu.ts` 中实现严格的白名单校验函数 `isAllowedRedirectUri()`，仅允许预设的安全回调地址（`http://localhost:5173/auth/callback`、`https://zhihu-explore.tcloudbaseapp.com/auth/callback` 等）。
   - 在 `GET /auth/zhihu/login` 中严格校验传入的 `redirect_uri`，非法 URL 一律返回 400 Bad Request。

4. **P1 — 消除生产环境静默降级到内存数据库**：
   - 重写 `server/src/repositories/pg-client.ts`：移除在 PG 连接失败（ECONNREFUSED / 超时）时自动把 `useMemoryFallback` 置为 `true` 的逻辑。
   - 内存数据库仅在环境变量显式配置 `USE_MEMORY_DB=true` 时启用；在生产环境或标准运行中，所有查询直连真实 PostgreSQL，若连接中断或 SQL 报错直接向上抛出，坚决不静默吞没写入。

5. **P1 — 补齐插件端配对测试与恢复测试**：
   - 在 `tests/sync/account-migration.test.ts` 中新增 4 项测试：
     1. 验证拒绝页面直接注入 `uid` / `token` 切换分区；
     2. 验证拒绝已过期或伪造的 challenge 进行配对；
     3. 验证服务端票据兑换失败时不污染本地 Session 状态；
     4. 完整模拟 Worker 重启流程（IndexedDB 加载 `active_session`，验证 `currentPartition`、`authToken` 与 `treeService` 实例分区正确自愈与恢复）。
   - 在 `tests/integration/auth-isolation.test.ts` 中新增开放重定向拦截与生产环境缺少 `ZHIHU_CLIENT_ID` 快速报错拦截测试。

6. **次要体验与安全加固**：
   - `GET /auth/zhihu/callback` 不再在重定向 Query Params 中暴露 Bearer Token，仅传递 `code` 与 `state`，由前端安全换取 Token；
   - 生产环境下若未配置 `ZHIHU_CLIENT_ID` / `SECRET`，直接返回 500 配置错误，杜绝线上使用占位符产生误导。

---

## 2. 自动化测试与验收结果

1. **测试矩阵**：
   - `npm run typecheck`：**0 错误**
   - `npm run test:unit`：**58/58 全部通过**
   - `npm run test:agent-contract`：**11/11 全部通过**
   - `npm run test:integration`：**18/18 全部通过**
   - `npm run package:release && npm run release:check`：**通过（打包 SHA-256 校验、无 process.env 校验、manifest 无通配符校验、密钥泄漏扫描全部 Pass）**

2. **核心复核项对账单**：
   - [x] P0: Service Worker 无 `process.env`，打包产物通过 release 脚本零引用检查。
   - [x] P0: `manifest.json` 消除 `*.tcloudbaseapp.com` 通配符，仅限精准白名单。
   - [x] P1: `redirect_uri` 白名单校验生效，开放重定向探测返回 400。
   - [x] P1: 移除静默降级内存 DB，真实生产环境报错直接抛出。
   - [x] P1: 补充插件端 challenge 过期、直接注入拒绝、兑换失败隔离、Worker 实例恢复测试用例。
