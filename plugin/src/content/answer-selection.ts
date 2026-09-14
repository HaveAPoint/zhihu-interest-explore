// Answer selection manager for capturing precise followup selections within answer cards
// Complies with 插件局部树执行计划 §3.4, §5 (LT06)

import type { AnswerSelection } from '@zhihu-explore/domain';
import { getRangeOffsets } from './text-range.js';

export interface AnswerSelectionCallbacks {
  onSelectionChange: (selection: AnswerSelection | null) => void;
}

export class AnswerSelectionManager {
  private currentSelection: AnswerSelection | null = null;
  private pendingMarkEl: HTMLElement | null = null;
  private activeContainer: HTMLElement | null = null;
  private callbacks: AnswerSelectionCallbacks;
  private boundSelectionHandler: () => void;

  constructor(callbacks: AnswerSelectionCallbacks) {
    this.callbacks = callbacks;
    this.boundSelectionHandler = () => this.handleSelectionChange();
    document.addEventListener('selectionchange', this.boundSelectionHandler);
  }

  getSelection(): AnswerSelection | null {
    return this.currentSelection;
  }

  getActiveContainer(): HTMLElement | null {
    return this.activeContainer;
  }

  /**
   * Clears the pending selection and restores the container DOM.
   */
  clearPendingSelection() {
    this.currentSelection = null;
    if (this.pendingMarkEl && this.pendingMarkEl.parentNode) {
      const parent = this.pendingMarkEl.parentNode;
      while (this.pendingMarkEl.firstChild) {
        parent.insertBefore(this.pendingMarkEl.firstChild, this.pendingMarkEl);
      }
      this.pendingMarkEl.remove();
      parent.normalize();
    }
    this.pendingMarkEl = null;
    this.activeContainer = null;
    this.callbacks.onSelectionChange(null);
  }

  /**
   * Call when composer textarea receives focus:
   * Keeps currentSelection intact while browser selection collapses!
   */
  preserveOnComposerFocus() {
    // Intentionally no-op: currentSelection remains held
  }

  private handleSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return;
    }

    const range = sel.getRangeAt(0);
    // 1. Check if range is inside an answer extra container
    let container: HTMLElement | null = null;
    let el: Node | null = range.commonAncestorContainer;
    while (el && el !== document.body) {
      if (el instanceof HTMLElement && el.classList.contains('zhihu-explore-answer-extra')) {
        container = el;
        break;
      }
      el = el.parentNode;
    }

    if (!container) {
      // Not inside an answer card extra container
      return;
    }

    const parentNodeId = container.getAttribute('data-parent-node-id');
    if (!parentNodeId) return;

    // 2. Compute exact offsets
    const offsets = getRangeOffsets(container, range);
    if (!offsets) return;

    // Non-empty single character is valid (§3.4: "非空单字有效；不要继续使用 text.length > 1")
    if (offsets.exact.trim().length === 0) return;

    this.currentSelection = {
      treeId: '', // Filled by orchestrator
      parentNodeId,
      exact: offsets.exact,
      prefix: offsets.prefix,
      suffix: offsets.suffix,
      startOffset: offsets.startOffset,
      endOffset: offsets.endOffset,
      containerText: offsets.containerText,
    };

    this.activeContainer = container;
    this.callbacks.onSelectionChange(this.currentSelection);
  }

  destroy() {
    document.removeEventListener('selectionchange', this.boundSelectionHandler);
    this.clearPendingSelection();
  }
}
