// Mutations for tree node actions and user proficiency
// Complies with 作者本人开发计划 §4.6, T29, T30

import { extensionBridge } from './extension-bridge.js';
import { dataSourceResolver, type AppDataSourceMode } from './source-resolver.js';
import type { Proficiency } from '@zhihu-explore/contracts';

const API_ORIGIN = process.env['API_ORIGIN'] || 'http://localhost:9000';

export interface DeleteRecordResult {
  success: boolean;
  refreshed?: boolean;
  error?: string;
}

export async function deleteExplorationRecord(
  treeId: string,
  rootNodeId: string,
  mode: AppDataSourceMode,
  expectedVersion?: number
): Promise<DeleteRecordResult> {
  const user = dataSourceResolver.getUser();

  // 1. Logged in user: check cloud concurrency before write
  if (user && (mode === 'CLOUD_USER' || mode === 'EXTENSION_USER')) {
    try {
      // Check cloud tree version
      const getRes = await fetch(`${API_ORIGIN}/trees/${treeId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (getRes.ok) {
        const json = await getRes.json();
        const currentVersion = json.data?.version;
        if (expectedVersion !== undefined && currentVersion !== undefined && currentVersion !== expectedVersion) {
          // Stale intent detected, refresh UI first!
          return {
            success: false,
            refreshed: true,
            error: '云端树版本已更新，已刷新最新数据，请再次确认删除。',
          };
        }
      }
    } catch {
      // Proceed to bridge or delete
    }

    // If extension is connected, delegate deletion through bridge
    if (mode === 'EXTENSION_USER') {
      try {
        await extensionBridge.applyTreeAction({
          tree_id: treeId,
          action_type: 'DELETE',
          node_id: rootNodeId,
        });
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || '插件删除记录失败' };
      }
    }

    // Otherwise direct cloud deletion
    try {
      const delRes = await fetch(`${API_ORIGIN}/trees/${treeId}/nodes/${rootNodeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (delRes.status === 409) {
        return {
          success: false,
          refreshed: true,
          error: '并发冲突：该节点已被其他客户端修改。',
        };
      }

      if (!delRes.ok) {
        return { success: false, error: '云端删除失败' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '网络请求失败' };
    }
  }

  // 2. Guest with extension
  if (mode === 'EXTENSION_GUEST') {
    try {
      await extensionBridge.applyTreeAction({
        tree_id: treeId,
        action_type: 'DELETE',
        node_id: rootNodeId,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '本地插件操作失败' };
    }
  }

  // 3. Demo mode
  return { success: true };
}

export async function updateNodeProficiency(
  nodeId: string,
  proficiency: Proficiency | null,
  mode: AppDataSourceMode
): Promise<boolean> {
  const user = dataSourceResolver.getUser();
  // Guest does not send private proficiency API
  if (!user || mode === 'DEMO' || mode === 'EXTENSION_GUEST') {
    return false;
  }

  try {
    const res = await fetch(`${API_ORIGIN}/nodes/${encodeURIComponent(nodeId)}/proficiency`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ proficiency }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
