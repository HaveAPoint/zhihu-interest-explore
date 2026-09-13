# T27-T30 网页端工作日志

## 1. 任务完成概况
- **T27 (多源数据适配与桥接)**：
  - 实现 `web/src/data/extension-bridge.ts` 与 `web/src/data/source-resolver.ts`。
  - 支持 §4.6 状态矩阵四行模式：`DEMO`（未登录未装插件）、`EXTENSION_GUEST`（未登录已装插件）、`EXTENSION_USER`（已登录已装插件且 uid 对齐）、`CLOUD_USER`（已登录未装插件）。
  - 内置离线与本地骨架预置回退（`agent-app-dev.json`、`cognitive-psychology.json`、`distributed-systems.json`），在纯前端离线运行时无缝呈现。
- **T28b (React 全局树画布组件)**：
  - 实现 `web/src/components/KnowledgeCanvas.tsx`。
  - 接入 T28a 的纯布局引擎 `calculateGlobalLayout` 与点亮算法 `calculateLighting`。
  - 渲染 SVG 平滑贝塞尔连接线，支持平移（Pan）、滚轮缩放（Zoom）、复位重置。
  - 严格落实视觉规范：点亮淡黄色底色 (`LIT_BG` = `#FFF4C2`)，全亮小金标签 (`GOLD_TAG_BG` = `#E6B422`) 独立展示且不替代底色，子树探索进度 `(n/N)`。
  - 点击节点时原位展开/折叠叶子节点，同时在侧边栏激活节点详情，点击卡片阻止事件冒泡防止触发画布拖拽。
- **T29 (节点详情与探索记录)**：
  - 实现 `web/src/components/NodeDetail.tsx` 与 `ExplorationRecord.tsx`。
  - 呈现概念定义、掌握熟练度选择（0～5 级或未设置）。
  - 展示关联知乎专栏探索记录：文章标题、根短标题、本地化格式时间。
  - 真实专栏 URL 附带 query 参数定位（`?explore_tree=...&explore_node=...`）。
- **T30 (网页端修改核对与删除确认)**：
  - 实现 `web/src/data/mutations.ts`。
  - 在删除探索记录前提供模态确认框，防止误触。
  - 支持云端树版本核对与并发检测（409 时提示刷新重试），支持通过扩展桥 `APPLY_TREE_ACTION` 广播与本地同步。

## 2. 验证结果
- `npm run typecheck`: 0 错误通过。
- `npm run build -w web`: Vite 构建生成 `dist/web/`，产物体积精简，包含 `index.html`、JS bundle 与 CSS bundle。
