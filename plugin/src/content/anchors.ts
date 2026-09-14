// Anchor restoration and deep-link handling in Zhihu article content
// Complies with 作者本人开发计划 §4.1, T22; 插件局部树执行计划 §3.4, §3.5, LT10

import { HIGHLIGHT_BG } from '@zhihu-explore/ui-tokens';
import type { LocalTree, HighlightAnchor } from '@zhihu-explore/contracts';
import { findRangeForAnchor, getTextNodes } from './text-range.js';

const MARK_CLASS = 'zhihu-explore-anchor-mark';
const BADGE_CLASS = 'zhihu-explore-anchor-badge';

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

  /**
   * Live Range spanning the restored highlight of a tree (first mark start → last mark end),
   * or null if the anchor could not be located on this page.
   */
  getRootRange(treeId: string): Range | null {
    const marks = Array.from(
      document.querySelectorAll<HTMLElement>(`.${MARK_CLASS}[data-tree-id="${treeId}"]`),
    );
    if (marks.length === 0) return null;
    const range = document.createRange();
    range.setStartBefore(marks[0]!.firstChild ?? marks[0]!);
    const last = marks[marks.length - 1]!;
    range.setEndAfter(last.lastChild ?? last);
    return range;
  }

  /** Remove every mark/badge this manager injected; article text is restored byte-for-byte. */
  private clearAnchors() {
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());

    const touchedParents = new Set<Node>();
    document.querySelectorAll(`.${MARK_CLASS}`).forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      // Each mark wraps exactly one original text node segment; unwrap it in place.
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
      touchedParents.add(parent);
    });
    touchedParents.forEach((p) => p.normalize());
  }

  private renderAnchors() {
    this.clearAnchors();

    const contentContainer =
      document.querySelector('.Post-RichText') ||
      document.querySelector('.RichText') ||
      document.querySelector('article');

    if (!contentContainer) return;

    for (const tree of this.treesByRootId.values()) {
      const highlight = tree.anchor_highlight;
      if (!highlight || highlight.length < 1) continue;

      // Prefer the root node's precise anchor (offsets + context); fall back to exact-only.
      const rootNode = tree.nodes.find((n) => n.id === tree.root_node_id);
      const anchor: HighlightAnchor = rootNode?.highlight_anchor ?? { exact: highlight };

      // Ambiguous / not found → no mark rather than a wrong one (§3.4).
      const range = findRangeForAnchor(contentContainer as HTMLElement, anchor);
      if (!range) continue;

      const marks = this.wrapRangeByTextNode(range, tree.id);
      if (marks.length === 0) continue;

      const open = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.onOpenTreeCallback?.(tree);
      };
      for (const mark of marks) mark.onclick = open;

      // Node count badge lives OUTSIDE the marks so it can never leak into article text.
      const badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.setAttribute('data-tree-id', tree.id);
      badge.setAttribute('aria-hidden', 'true');
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
        user-select: none;
      `;
      badge.onclick = open;

      const lastMark = marks[marks.length - 1]!;
      lastMark.parentNode?.insertBefore(badge, lastMark.nextSibling);
    }
  }

  /**
   * Wrap a Range in <mark> elements WITHOUT crossing element boundaries: one mark per
   * intersected text-node segment. Keeps <strong>/<a>/… structure intact so unwrapping
   * restores the original DOM exactly.
   */
  private wrapRangeByTextNode(range: Range, treeId: string): HTMLElement[] {
    const root = range.commonAncestorContainer;
    const scope: Node =
      root.nodeType === Node.TEXT_NODE ? (root.parentNode as Node) : root;
    const textNodes = getTextNodes(scope).filter((n) => range.intersectsNode(n));

    const marks: HTMLElement[] = [];
    for (const node of textNodes) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (end <= start) continue;

      let target: Text = node;
      if (start > 0) target = target.splitText(start);
      if (end - start < target.length) target.splitText(end - start);

      const mark = document.createElement('mark');
      mark.className = MARK_CLASS;
      mark.setAttribute('data-tree-id', treeId);
      mark.style.cssText = `
        background: ${HIGHLIGHT_BG};
        padding: 1px 0;
        border-radius: 3px;
        cursor: pointer;
        border-bottom: 2px solid #0084ff;
        color: inherit;
        user-select: text;
      `;
      target.parentNode?.insertBefore(mark, target);
      mark.appendChild(target);
      marks.push(mark);
    }
    return marks;
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
