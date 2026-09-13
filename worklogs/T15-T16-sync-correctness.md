# T15-T16 同步正确性工作日志（第二批返工与执行器级验证）

## 1. 修改背景与对账核心要点

针对探针复核对 `plugin/src/background/sync-runner.ts` 提出的三条核心批评：
1. **`currentSeq` 归零与丢失**：每轮从 0 开始，忽略服务端与本地序号；
2. **ACK 未核对导致误删新树**：无论服务端返回什么状态或哪个树的 ID，收到返回就标记 `confirmed`，下一轮服务端清单查无此树触发 S02 误删；
3. **`RETRY_CREATE` 与 `DELETE_TREE` 漏执行**：在途重试在 switch 中未捕获直接 break，Outbox 仅消费个人节点而漏消费删树意图。

本次返工完成以下重构与加固：

### 1.1 `currentSeq` 跨轮次持久化与防跳号
- 在 `AccountMeta`（`plugin/src/storage/indexeddb-repo.ts`）中增加持久化字段 `lastCreateSeq?: number`。
- `SyncRunner` 启动时，取 `manifest.last_create_seq` 与本地 `accountMeta.lastCreateSeq` 的最大值，并结合本地所有在途树的 `createSeq` 确定当前的基准序列号，杜绝归零。
- 执行 `UPLOAD_CREATE` 时：先执行 `currentSeq++`，立即将 `accountMeta.lastCreateSeq = currentSeq` 持久化写入 IndexedDB，并赋予树的 `create_inflight` 元数据。进程崩溃、Worker 重启或多轮同步均严格单调递增。

### 1.2 ACK 严格核对 `tree_id` 与状态（拦截误删新树）
- 捕获 `const ack = await this.network.uploadCreateTree(token, tree, currentSeq)` 的返回值。
- **状态与 ID 严格核验**：
  - 只有在 `(ack.status === 'created' || ack.status === 'already_created') && ack.tree_id === tree.id` 时，才将本地树推进为 `confirmed`。
  - 若 `ack.tree_id !== tree.id`：记录报警并保持 `create_inflight` 状态，**严禁标记 `confirmed`**。下一轮同步即使服务端清单暂无该树，也不会因误认已确认而触发 S02 本地误删。
  - 若 `ack.status === 'deleted'`：服务端说明该序列号对应的树曾在云端创建但已被删除，执行本地安全删除（`deleteTreeAtomic`），不再复活。
  - 若网络异常中断：保持 `create_inflight`，进入下一轮重试。

### 1.3 `RETRY_CREATE` 与 `DELETE_TREE` 真正执行
- **补齐 `case 'RETRY_CREATE'`**：直接沿用本地元数据中的 `action.createSeq`（不推进新序号），向服务端重新提交创建，接收 ACK 并做同等严格校验。
- **Outbox `DELETE_TREE` 消费**：在 Outbox 消费阶段增加 `item.type === 'DELETE_TREE'` 分支，真正调用 `this.network.deleteRemoteTree(token, item.payload.treeId, item.payload.rootId)`，并在成功后从 Outbox 中删除该条意图。
- **支持 `DELETE_REMOTE`**：对本地带有 `pendingDelete: true` 的树，调用远程删除并原子清理本地记录。
- **云端缺失树增量拉取**：对于云端清单存在但本地不存在且未处于待删状态的树，调用 `fetchRemoteTree` 拉取并保存。

---

## 2. 执行器级测试与网络请求统计

新建执行器级集成测试集：[tests/sync/sync-runner.test.ts](file:///Users/huahuaclaw/hackathon/tests/sync/sync-runner.test.ts)，注入 `SpySyncNetworkClient`，直接驱动真实 `SyncRunner` 实例并统计网络调用次数：

1. **跨轮次序号自增与持久化**：
   - 第 1 轮创建 Tree A，网络调用 `uploadCreateTree(seq: 1)`，`accountMeta.lastCreateSeq` 落盘为 1；
   - 第 2 轮创建 Tree B，网络调用 `uploadCreateTree(seq: 2)`，绝不从 0 或 1 重新开始；累计 `fetchManifest: 2`，`uploadCreateTree: 2`。
2. **Worker 重启后序号延续**：
   - 模拟前序运行落盘 `lastCreateSeq: 5`，重启后实例化新 `SyncRunner`，新增 Tree C 时发出 `uploadCreateTree(seq: 6)`。
3. **ACK `tree_id` 不匹配拦截（防误删实测）**：
   - 注入非法 ACK（`tree_id` 不匹配），本地树保留为 `create_inflight`；
   - 第 2 轮云端清单无此树，执行器坚决不触发 S02 删除，本地新树完好无损。
4. **ACK `deleted` 状态处理**：
   - 注入 `status: 'deleted'`，执行器原子清理本地树。
5. **`RETRY_CREATE` 真实重试**：
   - 预置 `create_inflight` (seq: 42)，执行器发出 `uploadCreateTree(seq: 42)`，ACK 成功后变更为 `confirmed`。
6. **Outbox `DELETE_TREE` 真实执行**：
   - 插入 Outbox 删树记录，执行器真正触发 `deleteRemoteTree`，并清除 Outbox 记录。
7. **`DELETE_REMOTE` 标记删除**：
   - 标记 `pendingDelete` 的树触发网络删除与本地数据清理。
8. **S09 网络中断安全保证**：
   - `fetchManifest` 抛出 500 异常，执行器返回 `failed`，发出 1 次清单请求，0 次上传，0 次删除，本地树毫发无损。

---

## 3. 测试矩阵与验收数据

- `npm run typecheck`：**0 错误**
- `npm run test:unit`：**66/66 全部通过**（新增 8 项执行器级测试）
- `npm run test:agent-contract`：**11/11 全部通过**
- `npm run test:integration`：**18/18 全部通过**
- `npm run package:release && npm run release:check`：**全部通过**
