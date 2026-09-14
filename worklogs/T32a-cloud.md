# T32a 云端部署与最小闭环工作日志

日期：2026-09-14

## 1. 任务概述

根据《作者本人开发计划》§7.3、T32a 要求，完成云端最小闭环部署配置与工具链建设：
- 环境 ID：`hackerson-d0g0z55d2fc446485`（上海区）
- 云函数：`explore-api`（HTTP 自定义镜像 / Nodejs18，端口 9000）
- 静态网站托管：部署独立页产物 `dist/web`，内置扩展下载包与演示模式
- 自动化与验证脚本：`deploy-api.ts`、`deploy-web.ts`、`smoke-cloud.ts`

## 2. 交付产物

| 文件 | 用途 | 状态 |
|------|------|------|
| `cloudbaserc.json` | CloudBase 多端部署描述文件，定义 `explore-api` 云函数与静态托管路径 | ✅ 已交付 |
| `server/scf_bootstrap` | CloudBase HTTP 自定义 Runtime 启动入口脚本（`chmod +x`，监听 9000 端口） | ✅ 已交付 |
| `scripts/deploy-api.ts` | 云端 API 构建与部署执行器，调用 `npx tcb fn deploy explore-api --httpFn` | ✅ 已交付 |
| `scripts/deploy-web.ts` | 静态网页与安装包部署执行器，调用 `npx tcb hosting deploy dist/web` | ✅ 已交付 |
| `scripts/smoke-cloud.ts` | 云环境四项契约冒烟测试脚本（健康检查、学科骨架、401鉴权拦截、公网静态页） | ✅ 已交付 |
| `package.json` | 注册 `deploy:api`、`deploy:web`、`smoke:cloud` npm 命令 | ✅ 已配置 |

## 3. 部署与冒烟契约说明

### 3.1 HTTP 云函数架构
- 基础端口：9000（0.0.0.0）
- 自定义 Runtime 启动入口：`server/scf_bootstrap` 执行 `exec node dist/src/index.js`
- 匿名访问权限：`explore-api` 开放 `/health`、`/disciplines/:slug` 等公开只读接口；所有涉及用户私有资产（`/me`、`/trees`、`/sync`）必须经过 Authorization Bearer Token 鉴权，未登录直接返回 401 UNAUTHORIZED。

### 3.2 静态网站托管与 release 资产
- 网页构建输出：`dist/web/`
- 插件下载包发布：`web/public/downloads/zhihu-explore-extension.zip`
- 在未登录、未安装扩展的公网访问场景下，独立页直接进入 `DEMO` 模式，展示静态预置骨架图谱、插件三步安装引导与示例文章跳转链接。

### 3.3 冒烟验证契约（`scripts/smoke-cloud.ts`）
1. `GET /health`：返回 200，status 为 "ok"
2. `GET /disciplines/agent-app-dev`：返回 200，输出至少包含核心骨架节点
3. `GET /me`（未带 Token）：严格返回 401 UNAUTHORIZED，不得泄露假用户数据
4. 静态站点首页：返回 200，包含应用主 DOM

## 4. 实际部署与公网验证结果（2026-09-14 实测）

- **公网访问 URL**：[https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com/](https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com/)
- **插件下载 URL**：[https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com/downloads/zhihu-explore-extension.zip](https://hackerson-d0g0z55d2fc446485-1487155803.tcloudbaseapp.com/downloads/zhihu-explore-extension.zip)

### 验证项通过清单
1. **页面显示与模式**：
   - 访问公网 URL 成功渲染「知乎兴趣探索」独立页；
   - 未安装插件状态下准确展示 DEMO 示例模式、插件三步安装引导、示例专栏跳转链接。
2. **学科知识树切换**：
   - 「AI Agent 应用开发」（26 概念，4 点亮）
   - 「认知心理学」（95 概念）
   - 「分布式系统」（93 概念）
   - 三大学科动态切换，SVG 树连线与节点平滑重绘。
3. **节点操作与详情侧边栏**：
   - 点击「逻辑时钟」（logical clocks）节点，右侧详情面板弹出，完整展示定义、熟练度调节及关联探索记录。
4. **插件下载包验证**：
   - 静态托管下载链接 `downloads/zhihu-explore-extension.zip`（189.2 KB）响应 200，Playwright 实测直接触发文件下载。

