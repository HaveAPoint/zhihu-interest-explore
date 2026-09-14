// Anchor restoration and deep-link handling in Zhihu article content
// Complies with 作者本人开发计划 §4.1, T22

import { HIGHLIGHT_BG } from '@zhihu-explore/ui-tokens';
import type { LocalTree, HighlightAnchor } from '@zhihu-explore/contracts';
import { findRangeForAnchor } from './text-range.js';

export class AnchorManager {
  private treesByRootId = new Map<string, LocalTree>();
  private onOpenTreeCallback: ((tree: LocalTree) => void) | null = null;

  onOpenTree(cb: (tree: LocalTree) => void) {
    this.onOpenTreeCallback = cb;
  }

  setTrees(trees: LocalTree[]) {
    this.treesByRootId.clear();
    for (const t of trees) {
      this.treesByRootId.set(t.root_node_id, t);
    }
    this.renderAnchors();
    this.checkDeepLink();
  }

  private renderAnchors() {
    // 1. Clean up previously injected badges (outside marks, must be removed first)
    document.querySelectorAll('.zhihu-explore-anchor-badge').forEach((el) => {
      el.remove();
    });

    // 2. Clean up previously injected marks — restore original text only
    document.querySelectorAll('.zhihu-explore-anchor-mark').forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        const originalText = el.getAttribute('data-original-text') || '';
        parent.replaceChild(document.createTextNode(originalText), el);
        parent.normalize();
      }
    });

    const contentContainer =
      document.querySelector('.Post-RichText') ||
      document.querySelector('.RichText') ||
      document.querySelector('article');

    if (!contentContainer) return;

    for (const tree of this.treesByRootId.values()) {
      const highlight = tree.anchor_highlight;
      if (!highlight || highlight.length < 1) continue;

      // Build a HighlightAnchor from the root node if available, otherwise fall back to basic exact match
      const rootNode = tree.nodes.find((n) => n.id === tree.root_node_id);
      const anchor: HighlightAnchor = rootNode?.highlight_anchor ?? { exact: highlight };

      // Use findRangeForAnchor for precise, disambiguated positioning
      const range = findRangeForAnchor(contentContainer as HTMLElement, anchor);
      if (!range) continue;

      // Wrap the range in a mark element
      const rangeText = range.toString();
      const mark = document.createElement('mark');
      mark.className = 'zhihu-explore-anchor-mark';
      mark.setAttribute('data-tree-id', tree.id);
      mark.setAttribute('data-original-text', rangeText);
      mark.style.cssText = `
        background: ${HIGHLIGHT_BG};
        padding: 1px 4px;
        border-radius: 3px;
        cursor: pointer;
        border-bottom: 2px solid #0084ff;
        position: relative;
        user-select: text;
      `;

      // Use Range.surroundContents if the range is within a single text node,
      // otherwise use extractContents + appendChild for cross-node ranges
      try {
        range.surroundContents(mark);
      } catch {
        // surroundContents throws if range crosses element boundaries
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
      }

      // Node count badge — placed OUTSIDE the mark as a sibling to prevent text pollution
      const badge = document.createElement('span');
      badge.className = 'zhihu-explore-anchor-badge';
      badge.setAttribute('data-tree-id', tree.id);
      badge.textContent = `${tree.nodes.length}`;
      badge.style.cssText = `
        font-size: 10px;
        background: #0084ff;
        color: #ffffff;
        border-radius: 8px;
        padding: 0 5px;
        margin-left: 3px;
        font-weight: 600;
        display: inline-block;
        vertical-align: middle;
        cursor: pointer;
      `;
      badge.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.onOpenTreeCallback) {
          this.onOpenTreeCallback(tree);
        }
      };

      // Insert badge after mark
      if (mark.nextSibling) {
        mark.parentNode?.insertBefore(badge, mark.nextSibling);
      } else {
        mark.parentNode?.appendChild(badge);
      }

      mark.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.onOpenTreeCallback) {
          this.onOpenTreeCallback(tree);
        }
      };
    }
  }

  private checkDeepLink() {
    const url = new URL(window.location.href);
    const targetTreeId = url.searchParams.get('explore_tree');
    if (!targetTreeId) return;

    const targetTree = Array.from(this.treesByRootId.values()).find((t) => t.id === targetTreeId);
    if (targetTree) {
      // Clean up parameter from URL
      url.searchParams.delete('explore_tree');
      window.history.replaceState({}, document.title, url.toString());

      // Open tree
      if (this.onOpenTreeCallback) {
        this.onOpenTreeCallback(targetTree);
      }
    }
  }
}

