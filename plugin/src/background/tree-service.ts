// Local tree application service for Chrome extension background
// Complies with 作者本人开发计划 §4.3, §4.5, T10, T13

import {
  PluginStorageRepository,
  type DraftItem,
  type OutboxItem,
} from '../storage/indexeddb-repo.js';
import {
  removeSubtree,
} from '@zhihu-explore/domain';
import type {
  LocalTree,
  LocalNode,
  Article,
  PersonalNode,
  DisciplineSlug,
  LocalSyncMeta,
} from '@zhihu-explore/contracts';

// ---------------------------------------------------------------------------
// AgentHttpClient
// Calls server in generate_only mode. Throws on HTTP error or network failure.
// Server runs MockAgentProvider by default; teammates replace the provider only
// on the server side — no plugin-side flag needed.
// ---------------------------------------------------------------------------

class AgentHttpClient {
  /**
   * @param apiOrigin - base URL of the server
   * @param getToken  - async getter returning current device token, or null for guest
   */
  constructor(
    private apiOrigin: string,
    private getToken: () => Promise<string | null>,
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    const base: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) base['Authorization'] = `Bearer ${token}`;
    return base;
  }

  /**
   * Classify article discipline.
   * - Guest (no token): stateless POST /guest/classify — never persists to DB.
   * - Logged-in: POST /articles/resolve with Authorization — persists and deduplicates.
   */
  async classifyArticle(payload: {
    article_id: string;
    zhihu_id: string;
    url: string;
    title: string;
    tags: string[];
    lead: string;
    content_text: string;
  }): Promise<{ discipline_slug: DisciplineSlug | null }> {
    const token = await this.getToken();

    if (!token) {
      // Guest path: stateless classify, no DB write
      const res = await fetch(`${this.apiOrigin}/guest/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          tags: payload.tags,
          lead: payload.lead,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[AgentHttp] guest/classify failed ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
      }
      const json = await res.json();
      return { discipline_slug: json.data?.slug ?? null };
    }

    // Logged-in path: /articles/resolve persists and deduplicates
    const res = await fetch(`${this.apiOrigin}/articles/resolve`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[AgentHttp] articles/resolve failed ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
    }
    const json = await res.json();
    return { discipline_slug: json.data?.discipline_slug ?? null };
  }

  /**
   * Generate root node answer via server (generate_only mode).
   * Passes full content_text and discipline_slug so server can load correct skeleton.
   */
  async generateRoot(payload: {
    tree_id: string;
    root_node_id: string;
    article_id: string;
    article: { title: string; tags: string[]; url: string; content_text: string; discipline_slug?: DisciplineSlug | null };
    anchor_paragraph: string;
    anchor_highlight: string;
    question_text: string;
  }): Promise<{ title: string; extra: string; sources: any[]; candidates: any[] }> {
    const body = {
      tree_id: payload.tree_id,
      root_node_id: payload.root_node_id,
      article_id: payload.article_id,
      anchor_paragraph: payload.anchor_paragraph,
      anchor_highlight: payload.anchor_highlight,
      question_text: payload.question_text,
      mode: 'generate_only',
      local_article: {
        title: payload.article.title,
        tags: payload.article.tags,
        url: payload.article.url,
        content_text: payload.article.content_text,
        discipline_slug: payload.article.discipline_slug ?? undefined,
      },
      history_summary: '',
    };
    const res = await fetch(`${this.apiOrigin}/trees`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[AgentHttp] generateRoot failed ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }

  /**
   * Generate followup node answer via server (generate_only mode).
   * Passes full local_tree_context so server agent has all branch history.
   */
  async generateFollowup(payload: {
    tree_id: string;
    node_id: string;
    parent_id: string;
    article: { title: string; tags: string[]; url: string; content_text: string };
    local_tree_context: LocalTree;
    highlight_text: string;
    question_text: string;
  }): Promise<{ title: string; extra: string; sources: any[] }> {
    const body = {
      node_id: payload.node_id,
      parent_id: payload.parent_id,
      highlight_text: payload.highlight_text,
      question_text: payload.question_text,
      mode: 'generate_only',
      local_article: {
        title: payload.article.title,
        tags: payload.article.tags,
        url: payload.article.url,
        content_text: payload.article.content_text,
      },
      local_tree_context: payload.local_tree_context,
    };
    const res = await fetch(`${this.apiOrigin}/trees/${payload.tree_id}/nodes`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[AgentHttp] generateFollowup failed ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }
}

export class LocalTreeService {
  private agentHttp: AgentHttpClient;

  constructor(
    private repo: PluginStorageRepository,
    private partition: string = 'guest:default',
    apiOrigin: string = 'http://localhost:9000',
    // Async token getter: returns device token for logged-in users, null for guests.
    // Used to route classify calls to /guest/classify vs /articles/resolve.
    private getToken: () => Promise<string | null> = async () => null,
  ) {
    this.agentHttp = new AgentHttpClient(apiOrigin, this.getToken);
  }

  setPartition(partition: string) {
    this.partition = partition;
  }

  getPartition(): string {
    return this.partition;
  }

  // --- Article Resolve ---

  async resolveLocalArticle(input: {
    zhihu_id: string;
    url: string;
    title: string;
    tags: string[];
    lead: string;
    content_text: string;
  }): Promise<Article> {
    const existing = await this.repo.getArticleByZhihuId(this.partition, input.zhihu_id);
    if (existing) {
      // Re-classify if previously stored without discipline (classify had failed last time)
      if (existing.discipline_slug === null) {
        try {
          const classified = await this.agentHttp.classifyArticle({
            article_id: existing.id,
            zhihu_id: existing.zhihu_id,
            url: existing.url,
            title: existing.title,
            tags: existing.tags,
            lead: existing.lead,
            content_text: existing.content_text,
          });
          if (classified.discipline_slug !== null) {
            const updated: Article = {
              ...existing,
              discipline_slug: classified.discipline_slug,
              updated_at: new Date().toISOString(),
            };
            await this.repo.saveArticle(this.partition, updated);
            return updated;
          }
        } catch {
          // Still unreachable; return existing without discipline
        }
      }
      return existing;
    }

    const articleId = crypto.randomUUID();
    let disciplineSlug: DisciplineSlug | null = null;
    let classifyFailed = false;

    // Classify via server HTTP.
    // - Guest  → stateless /guest/classify, no DB side-effect.
    // - Logged-in → /articles/resolve with auth, persists and deduplicates.
    // Failure is NOT cached: article is NOT saved so next call retries classify.
    try {
      const classified = await this.agentHttp.classifyArticle({
        article_id: articleId,
        zhihu_id: input.zhihu_id,
        url: input.url,
        title: input.title,
        tags: input.tags,
        lead: input.lead,
        content_text: input.content_text,
      });
      disciplineSlug = classified.discipline_slug;
    } catch (err) {
      classifyFailed = true;
      console.warn('[zhihu-explore] classify HTTP failed (will retry on next resolve):', err);
    }

    // Do NOT cache failed classification: throw so caller can surface the error.
    // Next ARTICLE_RESOLVE will retry. (distinguishes "fail" from "unknown discipline")
    if (classifyFailed) {
      throw new Error('Article classification failed. Please check your connection and try again.');
    }

    // disciplineSlug === null means server returned null (genuinely unrecognized discipline).
    // Store it so user can manually assign via UI; generateRoot will warn on null discipline.
    const newArticle: Article = {
      id: articleId,
      uid: this.partition,
      zhihu_id: input.zhihu_id,
      url: input.url,
      title: input.title,
      tags: input.tags,
      lead: input.lead,
      content_text: input.content_text,
      discipline_slug: disciplineSlug, // null = "server says unknown"; user can set manually
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.repo.saveArticle(this.partition, newArticle);
    return newArticle;
  }

  // --- Create Root Tree ---

  async createRootTree(input: {
    article: Article;
    anchor_paragraph: string;
    anchor_highlight: string;
    question_text: string;
    skeletons: any[]; // kept for signature compat; server loads skeleton from discipline
  }): Promise<LocalTree> {
    const draftId = crypto.randomUUID();
    const treeId = crypto.randomUUID();
    const rootNodeId = crypto.randomUUID();

    // 1. Save draft before calling generation
    const draft: DraftItem = {
      id: draftId,
      partition: this.partition,
      article_id: input.article.id,
      parent_id: null,
      highlight_text: input.anchor_highlight,
      question_text: input.question_text,
      created_at: new Date().toISOString(),
    };
    await this.repo.saveDraft(draft);

    try {
      // 2. Generate root response via HTTP (server MockAgentProvider or live agent)
      //    Pass full content_text (not just anchor_paragraph) and the real discipline_slug.
      const agentOutput = await this.agentHttp.generateRoot({
        tree_id: treeId,
        root_node_id: rootNodeId,
        article_id: input.article.id,
        article: {
          title: input.article.title,
          tags: input.article.tags,
          url: input.article.url,
          content_text: input.article.content_text, // full article text, not anchor_paragraph
          discipline_slug: input.article.discipline_slug ?? undefined,
        },
        anchor_paragraph: input.anchor_paragraph,
        anchor_highlight: input.anchor_highlight,
        question_text: input.question_text,
      });

      const firstCand = agentOutput.candidates?.[0];
      const autoBindId = firstCand && firstCand.degree === 'exact' ? firstCand.node_id : null;

      const rootNode: LocalNode = {
        id: rootNodeId,
        tree_id: treeId,
        parent_id: null,
        highlight_text: input.anchor_highlight,
        question_text: input.question_text,
        title: agentOutput.title,
        answer_original: input.anchor_paragraph,
        answer_extra: agentOutput.extra,
        sources: agentOutput.sources ?? [],
        created_at: new Date().toISOString(),
      };

      const tree: LocalTree = {
        id: treeId,
        root_node_id: rootNodeId,
        uid: this.partition,
        article_id: input.article.id,
        discipline_slug: input.article.discipline_slug,
        global_node_id: autoBindId,
        match_candidates: (agentOutput.candidates ?? []).map((c: any) => ({
          global_node_id: c.node_id,
          title: c.node_id, // server already resolved titles in its skeleton lookup
          degree: c.degree,
          reason: c.reason,
        })),
        anchor_paragraph: input.anchor_paragraph,
        anchor_highlight: input.anchor_highlight,
        version: 1,
        nodes: [rootNode],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const syncMeta: LocalSyncMeta = {
        partition: this.partition as any,
        cloudState: 'never_created',
        ackVersion: null,
        dirty: true,
        pendingDelete: false,
        createSeq: null,
      };

      const outboxItem: OutboxItem = {
        id: crypto.randomUUID(),
        partition: this.partition,
        type: 'CREATE_TREE',
        payload: tree,
        createdAt: new Date().toISOString(),
      };

      // 3. Atomically save tree, sync_meta, and outbox, and delete draft
      await this.repo.saveTreeAtomic(this.partition, tree, syncMeta, outboxItem);
      await this.repo.deleteDraft(this.partition, draftId);

      return tree;
    } catch (err) {
      // Draft remains in storage for retry
      throw err;
    }
  }

  // --- Add Followup Node ---

  async addFollowupNode(input: {
    tree_id: string;
    parent_id: string;
    highlight_text: string;
    question_text: string;
  }): Promise<LocalNode> {
    // Read pre-flight snapshot ONLY to send as context to the server.
    // This read is NOT used for the final save — appendNodeAtomic does its own
    // transactional read, so there is no race window between "check" and "write".
    const snapshotTree = await this.repo.getTree(this.partition, input.tree_id);
    if (!snapshotTree) throw new Error(`Tree "${input.tree_id}" not found`);

    const snapshotParent = snapshotTree.nodes.find((n) => n.id === input.parent_id);
    if (!snapshotParent) throw new Error(`Parent node "${input.parent_id}" not found`);

    const draftId = crypto.randomUUID();
    const nodeId = crypto.randomUUID();
    const nodeCreatedAt = new Date().toISOString();

    const draft: DraftItem = {
      id: draftId,
      partition: this.partition,
      article_id: snapshotTree.article_id,
      parent_id: input.parent_id,
      highlight_text: input.highlight_text,
      question_text: input.question_text,
      created_at: nodeCreatedAt,
    };
    await this.repo.saveDraft(draft);

    try {
      // Fetch article for full content_text context
      const article = await this.repo.getArticle(this.partition, snapshotTree.article_id);

      // HTTP call: may take several seconds. Use snapshot as context for the request.
      const agentOutput = await this.agentHttp.generateFollowup({
        tree_id: input.tree_id,
        node_id: nodeId,
        parent_id: input.parent_id,
        article: {
          title: article?.title ?? '',
          tags: article?.tags ?? [],
          url: article?.url ?? '',
          content_text: article?.content_text ?? input.highlight_text,
        },
        local_tree_context: snapshotTree,
        highlight_text: input.highlight_text,
        question_text: input.question_text,
      });

      // -----------------------------------------------------------------------
      // appendNodeAtomic: single IndexedDB readwrite transaction that:
      //   1. reads the CURRENT tree (may have changed since snapshot)
      //   2. checks tree still exists → throws STALE_TREE if deleted
      //   3. checks parent still exists → throws STALE_PARENT if pruned
      //   4. appends node, increments version, writes tree + meta + outbox
      // No race window between check and write is possible inside one transaction.
      // -----------------------------------------------------------------------
      const partition = this.partition;
      const updatedTree = await this.repo.appendNodeAtomic(
        partition,
        input.tree_id,
        input.parent_id,
        // buildNode: receives current (post-HTTP) tree, returns new LocalNode
        (currentTree) => ({
          id: nodeId,
          tree_id: input.tree_id,
          parent_id: input.parent_id,
          highlight_text: input.highlight_text,
          question_text: input.question_text,
          title: agentOutput.title,
          // Use current parent's answer_extra (not snapshot's) in case it was edited
          answer_original: currentTree.nodes.find((n) => n.id === input.parent_id)!.answer_extra,
          answer_extra: agentOutput.extra,
          sources: agentOutput.sources ?? [],
          created_at: nodeCreatedAt,
        }),
        // buildOutbox: UPDATE_TREE with the fully updated tree
        (updated) => ({
          id: crypto.randomUUID(),
          partition,
          type: 'UPDATE_TREE' as const,
          payload: updated,
          createdAt: new Date().toISOString(),
        }),
      );

      await this.repo.deleteDraft(this.partition, draftId);

      // Return the new node from the updated tree
      const newNode = updatedTree.nodes.find((n) => n.id === nodeId)!;
      return newNode;
    } catch (err) {
      throw err;
    }
  }


  // --- Subtree Deletion ---

  async deleteNode(treeId: string, nodeId: string): Promise<{ deleted: 'tree' | 'subtree'; remainingTree: LocalTree | null }> {
    const tree = await this.repo.getTree(this.partition, treeId);
    if (!tree) throw new Error(`Tree "${treeId}" not found`);

    if (nodeId === tree.root_node_id) {
      // Deleting root node deletes entire tree
      const outboxItem: OutboxItem = {
        id: crypto.randomUUID(),
        partition: this.partition,
        type: 'DELETE_TREE',
        payload: { treeId, rootId: tree.root_node_id },
        createdAt: new Date().toISOString(),
      };

      await this.repo.deleteTreeAtomic(this.partition, treeId, tree.root_node_id, outboxItem);
      return { deleted: 'tree', remainingTree: null };
    }

    const updatedTree = removeSubtree(tree, nodeId);
    if (!updatedTree) {
      return { deleted: 'tree', remainingTree: null };
    }

    const meta = (await this.repo.getSyncMeta(this.partition, treeId)) ?? {
      partition: this.partition as any,
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    };

    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      partition: this.partition,
      type: 'UPDATE_TREE',
      payload: updatedTree,
      createdAt: new Date().toISOString(),
    };

    await this.repo.saveTreeAtomic(this.partition, updatedTree, { ...meta, dirty: true }, outboxItem);
    return { deleted: 'subtree', remainingTree: updatedTree };
  }

  // --- Manual Binding & Renaming ---

  async setTreeBinding(treeId: string, globalNodeId: string): Promise<LocalTree> {
    const tree = await this.repo.getTree(this.partition, treeId);
    if (!tree) throw new Error(`Tree "${treeId}" not found`);

    const updatedTree: LocalTree = {
      ...tree,
      global_node_id: globalNodeId,
      version: tree.version + 1,
      updated_at: new Date().toISOString(),
    };

    const meta = (await this.repo.getSyncMeta(this.partition, treeId)) ?? {
      partition: this.partition as any,
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    };

    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      partition: this.partition,
      type: 'UPDATE_TREE',
      payload: updatedTree,
      createdAt: new Date().toISOString(),
    };

    await this.repo.saveTreeAtomic(this.partition, updatedTree, { ...meta, dirty: true }, outboxItem);
    return updatedTree;
  }

  async renameNode(treeId: string, nodeId: string, newTitle: string): Promise<LocalTree> {
    const tree = await this.repo.getTree(this.partition, treeId);
    if (!tree) throw new Error(`Tree "${treeId}" not found`);

    const updatedNodes = tree.nodes.map((n) => (n.id === nodeId ? { ...n, title: newTitle } : n));
    const updatedTree: LocalTree = {
      ...tree,
      version: tree.version + 1,
      nodes: updatedNodes,
      updated_at: new Date().toISOString(),
    };

    const meta = (await this.repo.getSyncMeta(this.partition, treeId)) ?? {
      partition: this.partition as any,
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    };

    const outboxItem: OutboxItem = {
      id: crypto.randomUUID(),
      partition: this.partition,
      type: 'UPDATE_TREE',
      payload: updatedTree,
      createdAt: new Date().toISOString(),
    };

    await this.repo.saveTreeAtomic(this.partition, updatedTree, { ...meta, dirty: true }, outboxItem);
    return updatedTree;
  }

  async changeArticleDiscipline(
    articleId: string,
    newSlug: DisciplineSlug | null,
    fallbackArticle?: Article,
  ): Promise<Article | null> {
    let article = await this.repo.getArticle(this.partition, articleId);
    if (!article && fallbackArticle) {
      article = {
        ...fallbackArticle,
        id: articleId,
        discipline_slug: newSlug,
        updated_at: new Date().toISOString(),
      };
    } else if (article) {
      article.discipline_slug = newSlug;
      article.updated_at = new Date().toISOString();
    } else {
      return null;
    }

    await this.repo.saveArticle(this.partition, article);

    // Reset all trees of this article
    const allTrees = await this.repo.listTrees(this.partition);
    const affectedTrees = allTrees.filter((t) => t.article_id === articleId);

    for (const t of affectedTrees) {
      const resetTree: LocalTree = {
        ...t,
        discipline_slug: newSlug,
        global_node_id: null,
        match_candidates: [],
        version: t.version + 1,
        updated_at: new Date().toISOString(),
      };

      const meta = (await this.repo.getSyncMeta(this.partition, t.id)) ?? {
        partition: this.partition as any,
        cloudState: 'never_created',
        ackVersion: null,
        dirty: true,
        pendingDelete: false,
        createSeq: null,
      };

      const outboxItem: OutboxItem = {
        id: crypto.randomUUID(),
        partition: this.partition,
        type: 'UPDATE_TREE',
        payload: resetTree,
        createdAt: new Date().toISOString(),
      };

      await this.repo.saveTreeAtomic(this.partition, resetTree, { ...meta, dirty: true }, outboxItem);
    }
    return article;
  }

  // --- Drafts & Personal Nodes ---

  async listArticleTrees(articleId: string): Promise<LocalTree[]> {
    return this.repo.listTreesByArticle(this.partition, articleId);
  }

  async saveDraft(payload: any): Promise<DraftItem> {
    const draft: DraftItem = {
      id: crypto.randomUUID(),
      partition: this.partition,
      article_id: payload.article_id,
      parent_id: payload.parent_id ?? null,
      highlight_text: payload.highlight_text,
      question_text: payload.question_text,
      created_at: new Date().toISOString(),
    };
    await this.repo.saveDraft(draft);
    return draft;
  }

  async listDrafts(articleId: string): Promise<DraftItem[]> {
    return this.repo.listDrafts(this.partition, articleId);
  }

  async deleteDraft(draftId: string): Promise<void> {
    await this.repo.deleteDraft(this.partition, draftId);
  }

  async createPersonalNode(payload: any): Promise<PersonalNode> {
    const node: PersonalNode = {
      id: crypto.randomUUID(),
      uid: this.partition,
      discipline_slug: payload.discipline_slug,
      parent_id: payload.parent_id,
      title: payload.title,
      definition: payload.definition,
      created_at: new Date().toISOString(),
    };
    await this.repo.savePersonalNode(this.partition, node);
    return node;
  }
}

