// Anchor restoration and deep-link handling in Zhihu article content
// Complies with 作者本人开发计划 §4.1, T22

import { HIGHLIGHT_BG } from '@zhihu-explore/ui-tokens';
import type { LocalTree } from '@zhihu-explore/contracts';

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
    // Clean up previously injected anchors
    document.querySelectorAll('.zhihu-explore-anchor-mark').forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
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
      if (!highlight || highlight.length < 2) continue;

      // Find paragraph containing highlight
      const walker = document.createTreeWalker(contentContainer, NodeFilter.SHOW_TEXT);
      let textNode: Text | null = null;

      while ((textNode = walker.nextNode() as Text | null)) {
        if (!textNode || !textNode.textContent) continue;
        const idx = textNode.textContent.indexOf(highlight);
        if (idx !== -1) {
          // Split text node and wrap
          const matchedText = textNode.splitText(idx);
          matchedText.splitText(highlight.length);

          const mark = document.createElement('mark');
          mark.className = 'zhihu-explore-anchor-mark';
          mark.style.cssText = `
            background: ${HIGHLIGHT_BG};
            padding: 1px 4px;
            border-radius: 3px;
            cursor: pointer;
            border-bottom: 2px solid #0084ff;
            position: relative;
            user-select: text;
          `;
          mark.textContent = matchedText.textContent;

          // Node count badge
          const badge = document.createElement('span');
          badge.className = 'zhihu-explore-badge';
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
          `;
          mark.appendChild(badge);

          mark.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.onOpenTreeCallback) {
              this.onOpenTreeCallback(tree);
            }
          };

          matchedText.parentNode?.replaceChild(mark, matchedText);
          break; // Found anchor for this tree
        }
      }
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
