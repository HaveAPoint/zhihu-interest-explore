// Chrome Extension Content Script entrypoint
// Complies with 作者本人开发计划 §4.1, T17, T18, T19, T20, T22

import { isZhihuZhuanlanPage, extractArticleFromDOM } from './zhihu-adapter.js';
import { SelectionManager, type CapturedSelection } from './selection.js';
import { OverlayView } from './overlay/overlay-view.js';
import { AnchorManager } from './anchors.js';
import type { Article, LocalTree, DisciplineSlug } from '@zhihu-explore/contracts';

async function init() {
  if (!isZhihuZhuanlanPage()) {
    return;
  }

  // Extract article info from DOM
  const articleInfo = extractArticleFromDOM();
  if (!articleInfo) {
    console.log('[zhihu-explore] Could not extract Zhihu article info');
    return;
  }

  // 1. Resolve Article with Background Service
  let currentArticle: Article | null = null;
  let classifyError: string | null = null;

  async function tryResolveArticle(): Promise<boolean> {
    if (!articleInfo) return false;
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ARTICLE_RESOLVE',
        payload: {
          zhihu_id: articleInfo.zhihu_id,
          url: articleInfo.url,
          title: articleInfo.title,
          tags: articleInfo.tags,
          lead: articleInfo.lead,
          content_text: articleInfo.content_text,
        },
      });

      if (res?.success && res.data) {
        currentArticle = res.data;
        classifyError = null;
        return true;
      } else {
        classifyError = res?.error || '分类服务暂时不可用';
        return false;
      }
    } catch (err: any) {
      console.error('[zhihu-explore] Failed to resolve article with background', err);
      classifyError = err?.message || '网络连接异常，无法获取学科分类';
      return false;
    }
  }

  await tryResolveArticle();

  // If classification failed or returned null, preserve real content_text and set discipline_slug to null (never fake agent-app-dev)
  if (!currentArticle) {
    currentArticle = {
      id: crypto.randomUUID(),
      uid: 'guest:default',
      zhihu_id: articleInfo.zhihu_id,
      url: articleInfo.url,
      title: articleInfo.title,
      tags: articleInfo.tags,
      lead: articleInfo.lead,
      content_text: articleInfo.content_text,
      discipline_slug: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Initialize Anchor Manager
  const anchorManager = new AnchorManager();

  // Load existing trees for this article
  async function refreshTrees() {
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'LIST_TREES',
        payload: { article_id: currentArticle!.id },
      });
      if (res?.success && Array.isArray(res.data)) {
        anchorManager.setTrees(res.data);
      }
    } catch (err) {
      console.error('[zhihu-explore] Failed to list trees for article', err);
    }
  }

  let pendingSelection: CapturedSelection | null = null;

  // Initialize Overlay View
  const overlay = new OverlayView({
    onSubmitQuestion: async (question: string) => {
      if (!pendingSelection) return;
      if (!currentArticle?.discipline_slug) {
        throw new Error('请先在上方选择所属学科以挂载知识图谱');
      }

      const res = await chrome.runtime.sendMessage({
        type: 'CREATE_TREE',
        payload: {
          article: currentArticle,
          anchor_paragraph: pendingSelection.anchor_paragraph,
          anchor_highlight: pendingSelection.highlight_text,
          question_text: question,
          skeletons: [],
        },
      });

      if (res?.success) {
        const createdTree: LocalTree = res.data;
        overlay.updateTree(createdTree);
        await refreshTrees();
      } else {
        throw new Error(res?.error || 'Failed to create tree');
      }
    },

    onFollowupQuestion: async (parentNodeId: string, highlight: string, question: string) => {
      const activeTreeId = (overlay as any).currentTree?.id;
      if (!activeTreeId) return;

      const res = await chrome.runtime.sendMessage({
        type: 'ADD_NODE',
        payload: {
          tree_id: activeTreeId,
          parent_id: parentNodeId,
          highlight_text: highlight,
          question_text: question,
        },
      });

      if (res?.success) {
        // Fetch updated tree
        const treeRes = await chrome.runtime.sendMessage({
          type: 'GET_TREE',
          payload: { tree_id: activeTreeId },
        });
        if (treeRes?.success) {
          overlay.updateTree(treeRes.data);
        }
        await refreshTrees();
      } else {
        throw new Error(res?.error || 'Failed to add node');
      }
    },

    onDeleteNode: async (treeId: string, nodeId: string) => {
      const res = await chrome.runtime.sendMessage({
        type: 'DELETE_NODE',
        payload: { tree_id: treeId, node_id: nodeId },
      });

      if (res?.success) {
        if (res.data?.deleted === 'tree') {
          overlay.close();
        } else if (res.data?.remainingTree) {
          overlay.updateTree(res.data.remainingTree);
        }
        await refreshTrees();
      } else {
        alert(res?.error || '删除失败');
      }
    },

    onClose: () => {
      selectionManager.clear();
      pendingSelection = null;
    },

    onSelectDiscipline: async (slug: DisciplineSlug) => {
      if (!currentArticle) return;
      currentArticle = {
        ...currentArticle,
        discipline_slug: slug,
        updated_at: new Date().toISOString(),
      };
      await chrome.runtime.sendMessage({
        type: 'CHANGE_DISCIPLINE',
        payload: {
          article_id: currentArticle.id,
          discipline_slug: slug,
          fallback_article: currentArticle,
        },
      });
      overlay.updateArticle(currentArticle);
    },

    onRetryClassify: async () => {
      const ok = await tryResolveArticle();
      if (ok && currentArticle) {
        overlay.setClassifyError(null);
        overlay.updateArticle(currentArticle);
        await refreshTrees();
      } else {
        overlay.setClassifyError(classifyError);
      }
    },
  });

  if (classifyError) {
    overlay.setClassifyError(classifyError);
  }

  // Register onOpenTree BEFORE refreshTrees so checkDeepLink finds the callback.
  // Fix: deep-link timing race — explore_tree param was cleared before overlay was ready.
  anchorManager.onOpenTree((tree) => {
    overlay.showForExistingTree(currentArticle!, tree);
  });

  // Initialize Selection Manager
  // Declared with let before overlay construction so the onClose closure can reference it.
  const selectionManager = new SelectionManager();
  selectionManager.onTrigger((selection) => {
    pendingSelection = selection;
    overlay.showForNewSelection(currentArticle!, selection);
  });

  // Load trees after callbacks are registered so deep-link opens correctly
  await refreshTrees();

  console.log('[zhihu-explore] Content script ready on article:', currentArticle?.title);
}

// Run after page DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}
