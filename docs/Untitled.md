我把仓库过了一遍，下面是大层面的模块图和边界。不涉及正在变动的细节，只讲"有哪几块、谁跟谁说话、在哪个文件划界"。

## 一、总共只有 4 个运行时 + 1 个共享层



```
┌────────────────────┐   chrome.runtime.sendMessage   ┌────────────────────┐
│ ① 插件 content.js   │ ─────────(内部消息)──────────▶ │ ② 插件 background.js│
│ 跑在知乎文章页里      │                                │ Service Worker      │
└────────────────────┘                                │ 持有 IndexedDB       │
                                                      └─────────┬──────────┘
┌────────────────────┐   chrome.runtime.sendMessage             │ fetch (HTTP)
│ ③ 独立页 web/       │ ──(外部消息 onMessageExternal)──▶ 同上    │
│ React + HashRouter  │ ──────────────── fetch (HTTP) ───────────┼─────────┐
└────────────────────┘                                          ▼         ▼
                                                      ┌────────────────────┐
                                                      │ ④ server/ Fastify   │
                                                      │ 云函数 explore-api   │──▶ Postgres
                                                      └────────────────────┘

        ⑤ packages/contracts (zod schema) —— 四方共用的"协议字典"
```

| 模块             | 目录                     | 跑在哪                               | 职责一句话                                                   |
| ---------------- | ------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| ① content script | `plugin/src/content/`    | 知乎 `zhuanlan.zhihu.com/p/*` 页面内 | 划词、锚点、悬浮层 UI。**自己不存数据、不发 HTTP**           |
| ② background     | `plugin/src/background/` | 插件的 Service Worker                | 插件的"大脑"：IndexedDB 本地存储、调 API、同步、账号配对     |
| ③ 独立页         | `web/src/`               | 浏览器打开的网站                     | 展示学科树 / 探索记录；自己不存树数据，要么问插件、要么问云端 |
| ④ server         | `server/src/`            | CloudBase 云函数                     | HTTP API + Postgres + Agent(分类/生成)                       |
| ⑤ contracts      | `packages/contracts/`    | 编译期被 ①②③④ 各自打包进去           | 所有跨模块消息的 schema，**边界就写在这里**                  |

## 二、你问的每个边界，在哪个文件

### "插件和独立页之间怎么传数据"

- **协议定义**：`packages/contracts/src/bridge.ts` —— 9 个动作（HELLO / GET_SNAPSHOT / GET_TREE / PAIR_SESSION / APPLY_TREE_ACTION / SYNC_NOW …），版本号 `BridgeProtocolVersion = 1`。
- **独立页这一侧**：`web/src/data/extension-bridge.ts` —— 用 `chrome.runtime.sendMessage(extensionId, …)` 发。
- **插件这一侧**：`plugin/src/background/index.ts` 里 `chrome.runtime.onMessageExternal.addListener` —— 检查来源 origin 必须等于打包时写死的 `APP_ORIGIN`，再用 zod 校验。
- **谁允许连**：`plugin/manifest.json` 的 `externally_connectable.matches`（现在是 localhost:5173 和 `zhihu-explore.tcloudbaseapp.com`）。

要点：**独立页 ↔ 插件 之间没有 HTTP，是 Chrome 扩展消息通道**，且只有 web 主动问、插件回答，插件不会主动推给页面。

### "独立页在没插件的时候怎么活"

`web/src/data/source-resolver.ts` 定义了 4 种模式，这是独立页最重要的边界：

| 登录? | 装插件? | 模式              | 数据来自                      |
| ----- | ------- | ----------------- | ----------------------------- |
| ✗     | ✗       | `DEMO`            | `web/src/data/demo.ts` 假数据 |
| ✗     | ✓       | `EXTENSION_GUEST` | 问插件（guest 分区）          |
| ✓     | ✓       | `EXTENSION_USER`  | 问插件（uid 分区）            |
| ✓     | ✗       | `CLOUD_USER`      | 直接 fetch server             |

### "content script 和 background 之间"

`plugin/src/background/index.ts` 的第一个 listener（`onMessage`，内部消息）：ARTICLE_RESOLVE / CREATE_TREE / ADD_NODE / DELETE_NODE / SAVE_DRAFT / CHANGE_DISCIPLINE …。这套消息**没进 contracts**，是插件内部私有协议，只在 `content/index.ts` 和 `background/index.ts` 两个文件之间。

### "插件 → 云端"

只有 background 发 HTTP，两个文件：

- `background/tree-service.ts`：写操作（`/articles/resolve`、`/trees`、`/trees/:id/nodes`、`/guest/classify`）
- `background/network-client.ts`：同步（`/sync/trees`、`/disciplines/:slug/nodes`）

server 端对应的路由全在 `server/src/routes/*.ts`，请求/响应 schema 在 `packages/contracts/src/http.ts`、`sync.ts`。

## 三、"插件怎么装上去"—— 你的理解是对的

**没有自动安装。** 流程是：

1. `plugin/scripts/build-plugin.js` 用 esbuild 把 `src/` 打成 `plugin/dist/{manifest.json, content.js, background.js}`，打包时把 `API_ORIGIN` / `APP_ORIGIN` 两个环境变量**写死进 js**。
2. `scripts/package-release.ts` 把 `plugin/dist` 整个 zip 成 `web/public/downloads/zhihu-explore-extension.zip`，并写 `release-manifest.json`（sha256、大小）。
3. 这个 zip 随 web 一起被部署到静态托管，独立页的 `/downloads` 路由（`DownloadsPage.tsx`）给一个下载链接 + 文字说明。
4. 用户手动：解压 → `chrome://extensions` → 开发者模式 → "加载已解压的扩展程序"。

所以 zip 不是安装包，就是 3 个文件的源码目录。黑客松阶段这是正常做法（上 Chrome 商店要审核好几天）。

有个**必须留意的坑**：手动加载的扩展 ID 是根据本机路径算出来的，每个人不一样。独立页用 `VITE_EXTENSION_ID` 指定要和哪个扩展对话，如果为空则用 `chrome.runtime.sendMessage(request)` 无 ID 形式——网页环境下这是发不出去的。这是"独立页检测不到插件"最常见的原因，你们在联调时可以先盯这个。

## 四、云部署到底在动什么

只有 **两个** 云产物，分别对应两个脚本：

### A. 云函数 `explore-api`（= server）

`npm run deploy:api` → `scripts/deploy-api.ts`：

1. `npm run build -w server`：tsc 检查 + **esbuild 把整个 server 连依赖打成一个 `index.js` 单文件**（2.3MB），再复制成 `dist/bundle.js` 和 `index.mjs`。
2. `npx tcb fn deploy explore-api --httpFn`。

`cloudbaserc.json` 里对应的配置：`path: server`、`handler: index.main`、`installDependency: false`（因为已经打进单文件了，云上不用 npm install）、忽略 `src/` 和 `node_modules/`。

`server/src/index.ts` 里的 `main(event)` 就是云函数入口：把 API 网关的 event 转成 Fastify 的 `app.inject()`，相当于在函数里模拟了一次 HTTP 请求。本地开发时 `START_SERVER=true` 才真的 listen 9000 端口。

**你看到的未提交 diff 正是这里在折腾**：`type: http → Event`、`handler: dist/src/index.js → index.main`、`scf_bootstrap` 指向 bundle。这是在"用 HTTP 云函数还是 Event 云函数 + 网关"两种模式之间切换——两种在腾讯云都能跑，但入口和配置不一样，现在处于 Event 模式。`server/index.js`、`index.mjs`、`dist/bundle.js` 三份是同一个东西，只是不同入口猜测的产物，能跑通之后应该删掉两份。

### B. 静态托管（= web + 插件 zip）

`npm run deploy:web` → `scripts/deploy-web.ts`：

1. `package:release`（先打插件 zip 塞进 `web/public/downloads`，再 vite build web 到 `dist/web`）
2. `release:check` 校验
3. 给 `/downloads`、`/login`、`/d` 各复制一份 `index.html`（静态托管没有 SPA fallback，所以手动兜底）
4. `npx tcb hosting deploy dist/web`

### 独立页内部的跳转

`web/src/main.tsx` 用 **HashRouter**：`/#/`、`/#/d/:disciplineId`、`/#/login`、`/#/auth/callback`、`/#/downloads`。用 hash 路由就是为了绕开静态托管没有 fallback 的问题，所以第 3 步的目录兜底其实是双保险。

### 部署时的 3 个地址必须对上（这是最容易失控的点）

| 变量           | 谁用                                                         | 何时固化 |
| -------------- | ------------------------------------------------------------ | -------- |
| `API_ORIGIN`   | 插件 background（打包时写死）、web（`VITE_API_ORIGIN`，打包时写死） | 构建时   |
| `APP_ORIGIN`   | 插件 background 校验消息来源（写死）、manifest `externally_connectable` | 构建时   |
| `EXTENSION_ID` | web `VITE_EXTENSION_ID`                                      | 构建时   |

也就是说：**换了云函数 URL 或网站域名，插件 zip 和 web 都要重新 build + 重新部署，用户还得重新加载插件**。本地默认值是 `localhost:9000` / `localhost:5173`，如果部署时没设这些环境变量，云上的 web 会去找 localhost 的 API——这类问题不是 bug，是配置没传进去。

## 五、给你一张"出问题先看哪"的速查

| 症状                         | 大概率在哪个边界                                             |
| ---------------------------- | ------------------------------------------------------------ |
| 知乎页面划词没反应           | ① content ↔ 知乎 DOM（`zhihu-adapter.ts`），或 manifest `content_scripts.matches` |
| 悬浮层出来了但生成失败       | ② background → server HTTP，看 `API_ORIGIN` 是不是 localhost |
| 独立页显示 DEMO 假数据       | ③ ↔ ②：`EXTENSION_ID` 为空 / `APP_ORIGIN` 与实际域名不一致 / manifest `externally_connectable` |
| 独立页登录后看不到插件里的树 | 配对流程：`/auth/extension-ticket` → `PAIR_SESSION`，插件里 `authToken` 没建立 |
| 云函数 5xx / 404             | `cloudbaserc.json` 的 type / handler 与 `server/src/index.ts` 导出方式不匹配 |
| 直接访问 `/downloads` 404    | 静态托管无 fallback，看 `deploy-web.ts` 第 3 步              |

如果你想，下一步我可以帮你把这张图整理成 `docs/架构边界.md` 放进仓库，或者专门盯着云部署那条链路把 `index.js / index.mjs / bundle.js` 三份产物收敛成一份。