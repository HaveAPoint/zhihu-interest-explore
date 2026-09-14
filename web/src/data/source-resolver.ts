// Unified Data Source Resolver for Standalone Web App
// Complies with 作者本人开发计划 §4.6, T27

import { extensionBridge, type ExtensionStatus } from './extension-bridge.js';
import { DEMO_LIT_NODE_IDS, DEMO_RECORDS } from './demo.js';
import type { DisciplineSlug, Proficiency } from '@zhihu-explore/contracts';

export type AppDataSourceMode =
  | 'DEMO' // 未登录、未装插件
  | 'EXTENSION_GUEST' // 未登录、已装插件 (读 guest 本地真实数据)
  | 'EXTENSION_USER' // 已登录、已装插件且 uid 对齐 (读当前 uid 本地真实数据)
  | 'CLOUD_USER'; // 已登录、未装插件 (读本人云端数据)

const API_ORIGIN = process.env['API_ORIGIN'] || 'http://localhost:9000';

export interface UserSession {
  uid: string;
  name: string;
  token: string;
}

import agentAppDevSkeleton from './presets/agent-app-dev.json';
import cognitivePsychologySkeleton from './presets/cognitive-psychology.json';
import distributedSystemsSkeleton from './presets/distributed-systems.json';

const PRESET_MAP: Record<string, any> = {
  'agent-app-dev': agentAppDevSkeleton,
  'cognitive-psychology': cognitivePsychologySkeleton,
  'distributed-systems': distributedSystemsSkeleton,
};

export class DataSourceResolver {
  private user: UserSession | null = null;
  private extensionStatus: ExtensionStatus = { available: false };

  constructor() {
    this.loadUserSession();
  }

  loadUserSession(): UserSession | null {
    try {
      const stored = localStorage.getItem('zhihu_explore_user');
      if (stored) {
        this.user = JSON.parse(stored);
      }
    } catch {
      this.user = null;
    }
    return this.user;
  }

  saveUserSession(user: UserSession) {
    this.user = user;
    localStorage.setItem('zhihu_explore_user', JSON.stringify(user));
  }

  clearUserSession() {
    this.user = null;
    localStorage.removeItem('zhihu_explore_user');
  }

  getUser(): UserSession | null {
    return this.user;
  }

  async resolveMode(): Promise<AppDataSourceMode> {
    this.extensionStatus = await extensionBridge.checkStatus();

    if (!this.user) {
      if (this.extensionStatus.available) {
        return 'EXTENSION_GUEST';
      }
      return 'DEMO';
    } else {
      if (this.extensionStatus.available && this.extensionStatus.isPaired) {
        return 'EXTENSION_USER';
      }
      return 'CLOUD_USER';
    }
  }

  async getDisciplineTree(slug: DisciplineSlug, mode: AppDataSourceMode) {
    // 1. Fetch skeleton nodes from API or local preset
    let nodes: any[] = [];
    try {
      const res = await fetch(`${API_ORIGIN}/disciplines/${slug}/tree`);
      if (res.ok) {
        const json = await res.json();
        nodes = json.data?.nodes ?? [];
      }
    } catch {
      // Fallback to local preset below
    }

    if (nodes.length === 0 && PRESET_MAP[slug]) {
      nodes = PRESET_MAP[slug].nodes ?? [];
    }

    if (mode === 'DEMO') {
      return {
        nodes,
        personal_nodes: [],
        lit_node_ids: DEMO_LIT_NODE_IDS,
        isDemo: true,
      };
    }

    if (mode === 'EXTENSION_GUEST' || mode === 'EXTENSION_USER') {
      try {
        const snapshot: any = await extensionBridge.getSnapshot();
        const trees = snapshot?.trees ?? [];
        const personalNodes = (snapshot?.personal_nodes ?? []).filter(
          (p: any) => p.discipline_slug === slug
        );

        const litSet = new Set<string>();
        for (const t of trees) {
          if (t.discipline_slug === slug && t.global_node_id) {
            litSet.add(t.global_node_id);
          }
        }

        return {
          nodes,
          personal_nodes: personalNodes,
          lit_node_ids: Array.from(litSet),
          isDemo: false,
        };
      } catch (err) {
        console.error('Failed to read from extension bridge', err);
      }
    }

    // CLOUD_USER
    if (this.user) {
      try {
        const res = await fetch(`${API_ORIGIN}/disciplines/${slug}/tree`, {
          headers: {
            Authorization: `Bearer ${this.user.token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          return {
            nodes: json.data?.nodes ?? nodes,
            personal_nodes: json.data?.personal_nodes ?? [],
            lit_node_ids: json.data?.lit_node_ids ?? [],
            isDemo: false,
          };
        }
      } catch (err) {
        console.error('Failed to fetch from cloud', err);
      }
    }

    return {
      nodes,
      personal_nodes: [],
      lit_node_ids: [],
      isDemo: false,
    };
  }

  async getNodeDetail(nodeId: string, mode: AppDataSourceMode) {
    if (mode === 'DEMO') {
      const records = DEMO_RECORDS[nodeId] ?? [];
      return {
        id: nodeId,
        title: nodeId.split('/').pop()?.replace(/-/g, ' ') ?? nodeId,
        definition: '示例概念：在知乎专栏阅读中划词探索获得的知识节点。',
        proficiency: null,
        records,
        isDemo: true,
      };
    }

    // Cloud fetch
    if (this.user) {
      try {
        const res = await fetch(`${API_ORIGIN}/nodes/${nodeId}`, {
          headers: {
            Authorization: `Bearer ${this.user.token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          return { ...json.data, isDemo: false };
        }
      } catch {
        // Fallback
      }
    }

    // Extension bridge
    if (mode === 'EXTENSION_GUEST' || mode === 'EXTENSION_USER') {
      const snapshot: any = await extensionBridge.getSnapshot();
      const trees = snapshot?.trees ?? [];
      const boundTrees = trees.filter((t: any) => t.global_node_id === nodeId);

      return {
        id: nodeId,
        title: nodeId.split('/').pop() ?? nodeId,
        definition: '从本地浏览器插件同步的探索节点。',
        proficiency: null,
        records: boundTrees.map((t: any) => ({
          tree_id: t.tree_id,
          root_node_id: t.root_node_id,
          article_id: t.article_id,
          article_title: t.article_title ?? '文章记录',
          // Use real article URL from snapshot; fall back to zhihu_id-based URL.
          // Never use internal UUID (article_id) as a zhihu path — that causes 404.
          article_url:
            t.article_url ||
            (t.article_zhihu_id
              ? `https://zhuanlan.zhihu.com/p/${t.article_zhihu_id}`
              : null),
          root_title: t.root_title,
          created_at: t.created_at,
        })),
        isDemo: false,
      };
    }

    return null;
  }

  async updateProficiency(nodeId: string, value: Proficiency) {
    if (!this.user) return;
    await fetch(`${API_ORIGIN}/nodes/${nodeId}/proficiency`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
  }

  async deleteRecord(treeId: string, rootId: string, mode: AppDataSourceMode) {
    if (mode === 'EXTENSION_GUEST' || mode === 'EXTENSION_USER') {
      await extensionBridge.applyTreeAction({
        tree_id: treeId,
        action_type: 'DELETE',
        node_id: rootId,
      });
      return;
    }

    if (this.user) {
      await fetch(`${API_ORIGIN}/trees/${treeId}/nodes/${rootId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.user.token}`,
        },
      });
    }
  }
}

export const dataSourceResolver = new DataSourceResolver();
