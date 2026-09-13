// Chrome Extension Content Script entrypoint
// Complies with 作者本人开发计划 §4.1, T17, T18, T19, T20, T22

import { isZhihuZhuanlanPage, extractArticleFromDOM } from './zhihu-adapter.js';
import { SelectionManager, type CapturedSelection } from './selection.js';
import { OverlayView } from './overlay/overlay-view.js';
import { AnchorManager } from './anchors.js';
import type { Article, LocalTree } from '@zhihu-explore/contracts';

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

  // Resolve article with background worker
  let currentArticle: Article | null = null;
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

    if (res?.success) {
      currentArticle = res.data;
    }
  } catch (err) {
    console.error('[zhihu-explore] Failed to resolve article with background', err);
  }

  if (!currentArticle) {
    currentArticle = {
      id: crypto.randomUUID(),
      uid: 'guest:default',
      zhihu_id: articleInfo.zhihu_id,
      url: articleInfo.url,
      title: articleInfo.title,
      tags: articleInfo.tags,
      lead: articleInfo.lead,
      content_text: '',
      discipline_slug: 'agent-app-dev',
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

  await refreshTrees();

  let pendingSelection: CapturedSelection | null = null;

  // Initialize Overlay View
  const overlay = new OverlayView({
    onSubmitQuestion: async (question: string) => {
      if (!pendingSelection) return;

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
  });

  // Clicking an anchor in article reopens overlay
  anchorManager.onOpenTree((tree) => {
    overlay.showForExistingTree(currentArticle!, tree);
  });

  // Initialize Selection Manager
  const selectionManager = new SelectionManager();
  selectionManager.onTrigger((selection) => {
    pendingSelection = selection;
    overlay.showForNewSelection(currentArticle!, selection);
  });

  console.log('[zhihu-explore] Content script ready on article:', currentArticle?.title);
}

// Run after page DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}
