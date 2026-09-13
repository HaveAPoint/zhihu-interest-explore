// Local tree application service for Chrome extension background
// Complies with 作者本人开发计划 §4.3, §4.5, T13

import {
  PluginStorageRepository,
  type DraftItem,
  type OutboxItem,
} from '../storage/indexeddb-repo.js';
import {
  removeSubtree,
} from '@zhihu-explore/domain';
import {
  buildMockClassify,
  buildMockGenerateRoot,
  buildMockGenerateFollowup,
} from '@zhihu-explore/fixtures';
import type {
  LocalTree,
  LocalNode,
  Article,
  DisciplineSlug,
  LocalSyncMeta,
  SkeletonNode,
} from '@zhihu-explore/contracts';

export class LocalTreeService {
  constructor(
    private repo: PluginStorageRepository,
    private partition: string = 'guest:default',
  ) {}

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
      return existing;
    }

    // Local classification
    const classifyRes = buildMockClassify({
      title: input.title,
      tags: input.tags,
      lead: input.lead,
    });

    const newArticle: Article = {
      id: crypto.randomUUID(),
      uid: this.partition,
      zhihu_id: input.zhihu_id,
      url: input.url,
      title: input.title,
      tags: input.tags,
      lead: input.lead,
      content_text: input.content_text,
      discipline_slug: classifyRes.slug,
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
    skeletons: SkeletonNode[];
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
      // 2. Generate root response
      const agentOutput = buildMockGenerateRoot({
        article: {
          title: input.article.title,
          tags: input.article.tags,
          url: input.article.url,
          content_text: input.anchor_paragraph,
        },
        tree: { nodes: [] },
        highlight: input.anchor_highlight,
        question: input.question_text,
        historySummary: '',
        disciplineSkeleton: input.skeletons,
      });

      const firstCand = agentOutput.candidates[0];
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
        sources: agentOutput.sources,
        created_at: new Date().toISOString(),
      };

      const tree: LocalTree = {
        id: treeId,
        root_node_id: rootNodeId,
        uid: this.partition,
        article_id: input.article.id,
        discipline_slug: input.article.discipline_slug,
        global_node_id: autoBindId,
        match_candidates: agentOutput.candidates.map((c) => ({
          global_node_id: c.node_id,
          title: input.skeletons.find((s) => s.id === c.node_id)?.title ?? c.node_id,
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
    const tree = await this.repo.getTree(this.partition, input.tree_id);
    if (!tree) throw new Error(`Tree "${input.tree_id}" not found`);

    const parentNode = tree.nodes.find((n) => n.id === input.parent_id);
    if (!parentNode) throw new Error(`Parent node "${input.parent_id}" not found`);

    const draftId = crypto.randomUUID();
    const nodeId = crypto.randomUUID();

    const draft: DraftItem = {
      id: draftId,
      partition: this.partition,
      article_id: tree.article_id,
      parent_id: input.parent_id,
      highlight_text: input.highlight_text,
      question_text: input.question_text,
      created_at: new Date().toISOString(),
    };
    await this.repo.saveDraft(draft);

    try {
      const agentOutput = buildMockGenerateFollowup({
        article: {
          title: '',
          tags: [],
          url: '',
          content_text: input.highlight_text,
        },
        tree: {
          nodes: tree.nodes.map((n) => ({
            id: n.id,
            parent_id: n.parent_id,
            title: n.title,
            highlight_text: n.highlight_text,
            question_text: n.question_text,
            answer_extra: n.answer_extra,
            is_current: n.id === input.parent_id,
          })),
        },
        highlight: input.highlight_text,
        question: input.question_text,
      });

      const newNode: LocalNode = {
        id: nodeId,
        tree_id: input.tree_id,
        parent_id: input.parent_id,
        highlight_text: input.highlight_text,
        question_text: input.question_text,
        title: agentOutput.title,
        answer_original: parentNode.answer_extra,
        answer_extra: agentOutput.extra,
        sources: agentOutput.sources,
        created_at: new Date().toISOString(),
      };

      const updatedTree: LocalTree = {
        ...tree,
        version: tree.version + 1,
        nodes: [...tree.nodes, newNode],
        updated_at: new Date().toISOString(),
      };

      const meta = (await this.repo.getSyncMeta(this.partition, input.tree_id)) ?? {
        partition: this.partition as any,
        cloudState: 'never_created',
        ackVersion: null,
        dirty: true,
        pendingDelete: false,
        createSeq: null,
      };

      const updatedMeta: LocalSyncMeta = {
        ...meta,
        dirty: true,
      };

      const outboxItem: OutboxItem = {
        id: crypto.randomUUID(),
        partition: this.partition,
        type: 'UPDATE_TREE',
        payload: updatedTree,
        createdAt: new Date().toISOString(),
      };

      await this.repo.saveTreeAtomic(this.partition, updatedTree, updatedMeta, outboxItem);
      await this.repo.deleteDraft(this.partition, draftId);

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

  // --- Change Article Discipline ---

  async changeArticleDiscipline(articleId: string, newSlug: DisciplineSlug | null): Promise<void> {
    const article = await this.repo.getArticle(this.partition, articleId);
    if (!article) return;

    article.discipline_slug = newSlug;
    article.updated_at = new Date().toISOString();
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
  }
}
