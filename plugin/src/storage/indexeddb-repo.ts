// IndexedDB repository for Chrome extension MV3 background worker
// Complies with 作者本人开发计划 §4.3, §4.4, T12

import { openDB, type IDBPDatabase } from 'idb';
import type {
  LocalTree,
  Article,
  PersonalNode,
  LocalSyncMeta,
} from '@zhihu-explore/contracts';

export interface OutboxItem {
  id: string;
  partition: string;
  type: 'CREATE_TREE' | 'UPDATE_TREE' | 'DELETE_TREE' | 'CREATE_PERSONAL_NODE';
  payload: any;
  createSeq?: number | null;
  createdAt: string;
}

export interface DraftItem {
  id: string;
  partition: string;
  article_id: string;
  parent_id: string | null;
  highlight_text: string;
  question_text: string;
  created_at: string;
}

export interface AccountMeta {
  partition: string;
  uid: string | null;
  deviceId: string | null;
  lastSyncAt: string | null;
  migrationDone: boolean;
  lastCreateSeq?: number;
}

const DB_NAME = 'zhihu_explore_db';
const DB_VERSION = 1;

export class PluginStorageRepository {
  private dbPromise: Promise<IDBPDatabase>;

  constructor(dbName: string = DB_NAME) {
    this.dbPromise = openDB(dbName, DB_VERSION, {
      upgrade(db) {
        // 1. Articles
        if (!db.objectStoreNames.contains('articles')) {
          const store = db.createObjectStore('articles', { keyPath: ['partition', 'id'] });
          store.createIndex('by_partition', 'partition');
          store.createIndex('by_zhihu_id', ['partition', 'zhihu_id']);
        }

        // 2. Trees
        if (!db.objectStoreNames.contains('trees')) {
          const store = db.createObjectStore('trees', { keyPath: ['partition', 'id'] });
          store.createIndex('by_partition', 'partition');
          store.createIndex('by_root_node_id', ['partition', 'root_node_id']);
          store.createIndex('by_article_id', ['partition', 'article_id']);
        }

        // 3. Sync Meta
        if (!db.objectStoreNames.contains('sync_meta')) {
          const store = db.createObjectStore('sync_meta', { keyPath: ['partition', 'tree_id'] });
          store.createIndex('by_partition', 'partition');
        }

        // 4. Drafts
        if (!db.objectStoreNames.contains('drafts')) {
          const store = db.createObjectStore('drafts', { keyPath: ['partition', 'id'] });
          store.createIndex('by_partition', 'partition');
        }

        // 5. Outbox
        if (!db.objectStoreNames.contains('outbox')) {
          const store = db.createObjectStore('outbox', { keyPath: ['partition', 'id'] });
          store.createIndex('by_partition', 'partition');
        }

        // 6. Personal Nodes
        if (!db.objectStoreNames.contains('personal_nodes')) {
          const store = db.createObjectStore('personal_nodes', { keyPath: ['partition', 'id'] });
          store.createIndex('by_partition', 'partition');
        }

        // 7. Account Meta
        if (!db.objectStoreNames.contains('account_meta')) {
          db.createObjectStore('account_meta', { keyPath: 'partition' });
        }
      },
    });
  }

  // --- Atomic Tree Operations ---

  async saveTreeAtomic(
    partition: string,
    tree: LocalTree,
    meta: LocalSyncMeta,
    outboxItem?: OutboxItem,
  ): Promise<void> {
    const db = await this.dbPromise;
    const storeNames = outboxItem
      ? (['trees', 'sync_meta', 'outbox'] as const)
      : (['trees', 'sync_meta'] as const);

    const tx = db.transaction(storeNames as any, 'readwrite');

    await Promise.all([
      tx.objectStore('trees').put({ ...tree, partition }),
      tx.objectStore('sync_meta').put({ ...meta, partition, tree_id: tree.id }),
      outboxItem ? tx.objectStore('outbox').put(outboxItem) : Promise.resolve(),
      tx.done,
    ]);
  }

  async getTree(partition: string, treeId: string): Promise<LocalTree | null> {
    const db = await this.dbPromise;
    const row = await db.get('trees', [partition, treeId]);
    if (!row) return null;
    const { partition: _p, ...tree } = row;
    return tree as LocalTree;
  }

  async listTrees(partition: string): Promise<LocalTree[]> {
    const db = await this.dbPromise;
    const rows = await db.getAllFromIndex('trees', 'by_partition', partition);
    return rows.map(({ partition: _p, ...tree }) => tree as LocalTree);
  }

  async deleteTreeAtomic(
    partition: string,
    treeId: string,
    _rootId?: string,
    outboxItem?: OutboxItem,
  ): Promise<void> {
    const db = await this.dbPromise;
    const storeNames = outboxItem
      ? (['trees', 'sync_meta', 'outbox'] as const)
      : (['trees', 'sync_meta'] as const);

    const tx = db.transaction(storeNames as any, 'readwrite');

    await Promise.all([
      tx.objectStore('trees').delete([partition, treeId]),
      tx.objectStore('sync_meta').delete([partition, treeId]),
      outboxItem ? tx.objectStore('outbox').put(outboxItem) : Promise.resolve(),
      tx.done,
    ]);
  }

  // --- Sync Meta ---

  async getSyncMeta(partition: string, treeId: string): Promise<LocalSyncMeta | null> {
    const db = await this.dbPromise;
    const row = await db.get('sync_meta', [partition, treeId]);
    if (!row) return null;
    const { partition: _p, tree_id: _t, ...meta } = row;
    return meta as LocalSyncMeta;
  }

  // --- Drafts ---

  async saveDraft(draft: DraftItem): Promise<void> {
    const db = await this.dbPromise;
    await db.put('drafts', draft);
  }

  async getDraft(partition: string, draftId: string): Promise<DraftItem | null> {
    const db = await this.dbPromise;
    return (await db.get('drafts', [partition, draftId])) ?? null;
  }

  async deleteDraft(partition: string, draftId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('drafts', [partition, draftId]);
  }

  async listDrafts(partition: string, articleId?: string): Promise<DraftItem[]> {
    const db = await this.dbPromise;
    const all = await db.getAllFromIndex('drafts', 'by_partition', partition);
    if (articleId) {
      return all.filter((d) => d.article_id === articleId);
    }
    return all;
  }

  async listTreesByArticle(partition: string, articleId: string): Promise<LocalTree[]> {
    const db = await this.dbPromise;
    const rows = await db.getAllFromIndex('trees', 'by_article_id', [partition, articleId]);
    return rows.map(({ partition: _p, ...tree }) => tree as LocalTree);
  }

  // --- Articles ---

  async saveArticle(partition: string, article: Article): Promise<void> {
    const db = await this.dbPromise;
    await db.put('articles', { partition, ...article });
  }

  async getArticle(partition: string, articleId: string): Promise<Article | null> {
    const db = await this.dbPromise;
    const row = await db.get('articles', [partition, articleId]);
    if (!row) return null;
    const { partition: _p, ...article } = row;
    return article as Article;
  }

  async getArticleByZhihuId(partition: string, zhihuId: string): Promise<Article | null> {
    const db = await this.dbPromise;
    const row = await db.getFromIndex('articles', 'by_zhihu_id', [partition, zhihuId]);
    if (!row) return null;
    const { partition: _p, ...article } = row;
    return article as Article;
  }

  // --- Outbox ---

  async addOutboxItem(item: OutboxItem): Promise<void> {
    const db = await this.dbPromise;
    await db.put('outbox', item);
  }

  async listOutbox(partition: string): Promise<OutboxItem[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex('outbox', 'by_partition', partition);
  }

  async removeOutboxItem(partition: string, id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('outbox', [partition, id]);
  }

  // --- Personal Nodes ---

  async savePersonalNode(partition: string, node: PersonalNode): Promise<void> {
    const db = await this.dbPromise;
    await db.put('personal_nodes', { partition, ...node });
  }

  async listPersonalNodes(partition: string): Promise<PersonalNode[]> {
    const db = await this.dbPromise;
    const rows = await db.getAllFromIndex('personal_nodes', 'by_partition', partition);
    return rows.map(({ partition: _p, ...node }) => node as PersonalNode);
  }

  // --- Account Meta & Active Session ---

  async getAccountMeta(partition: string): Promise<AccountMeta | null> {
    const db = await this.dbPromise;
    return (await db.get('account_meta', partition)) ?? null;
  }

  async setAccountMeta(meta: AccountMeta): Promise<void> {
    const db = await this.dbPromise;
    await db.put('account_meta', meta);
  }

  async saveDeviceSession(session: { uid: string; deviceToken: string; deviceId: string }): Promise<void> {
    const db = await this.dbPromise;
    await db.put('account_meta', {
      partition: 'active_session',
      uid: session.uid,
      deviceId: session.deviceId,
      lastSyncAt: new Date().toISOString(),
      migrationDone: true,
      deviceToken: session.deviceToken,
    });
  }

  async getDeviceSession(): Promise<{ uid: string; deviceToken: string; deviceId: string } | null> {
    const db = await this.dbPromise;
    const row: any = await db.get('account_meta', 'active_session');
    if (!row || !row.deviceToken || !row.uid) return null;
    return {
      uid: row.uid,
      deviceToken: row.deviceToken,
      deviceId: row.deviceId,
    };
  }

  async clearDeviceSession(): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('account_meta', 'active_session');
  }

  async close(): Promise<void> {
    const db = await this.dbPromise;
    db.close();
  }
}
