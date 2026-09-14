// Selection capture and floating explore trigger button
// Complies with 作者本人开发计划 §4.1, T18; 插件局部树执行计划 §3.4

import { getRangeOffsets } from './text-range.js';

/** Same container resolution as AnchorManager so captured offsets and restored anchors agree. */
export function findArticleContentContainer(): HTMLElement | null {
  return (
    (document.querySelector('.Post-RichText') as HTMLElement | null) ||
    (document.querySelector('.RichText') as HTMLElement | null) ||
    (document.querySelector('article') as HTMLElement | null)
  );
}

export interface CapturedSelection {
  highlight_text: string;
  anchor_paragraph: string;
  prefix: string;
  suffix: string;
  start_offset: number;
  end_offset: number;
  boundingRect: DOMRect;
  range: Range;
}

export class SelectionManager {
  private floatingButton: HTMLElement | null = null;
  private currentSelection: CapturedSelection | null = null;
  private onTriggerCallback: ((selection: CapturedSelection) => void) | null = null;

  constructor() {
    this.createFloatingButton();
    this.bindEvents();
  }

  onTrigger(cb: (selection: CapturedSelection) => void) {
    this.onTriggerCallback = cb;
  }

  private createFloatingButton() {
    this.floatingButton = document.createElement('div');
    this.floatingButton.className = 'zhihu-explore-trigger-btn';
    this.floatingButton.textContent = '探索 ✨';
    this.floatingButton.style.cssText = `
      position: absolute;
      display: none;
      z-index: 2147483640;
      background: #0084ff;
      color: #ffffff;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 16px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      user-select: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
    `;

    // Crucial requirement: pointerdown prevents selection loss
    this.floatingButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    this.floatingButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.currentSelection && this.onTriggerCallback) {
        this.onTriggerCallback(this.currentSelection);
        this.hideButton();
      }
    });

    document.body.appendChild(this.floatingButton);
  }

  private bindEvents() {
    const onUp = () => {
      setTimeout(() => this.handleSelectionChange(), 10);
    };
    document.addEventListener('pointerup', onUp);
    document.addEventListener('mouseup', onUp);

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        this.hideButton();
      }
    });
  }

  private handleSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      this.hideButton();
      return;
    }

    const range = sel.getRangeAt(0);

    // Make sure selection is within Zhihu content container, not inside overlay or comments
    const commonAncestor = range.commonAncestorContainer;
    const element = commonAncestor.nodeType === Node.ELEMENT_NODE
      ? (commonAncestor as HTMLElement)
      : commonAncestor.parentElement;

    if (!element || element.closest('.zhihu-explore-container') || element.closest('.Comments-container')) {
      this.hideButton();
      return;
    }

    // Selection must live inside the article content container — offsets are relative to it,
    // and AnchorManager restores against the same container (§3.4).
    const contentContainer = findArticleContentContainer();
    if (!contentContainer || !contentContainer.contains(range.commonAncestorContainer)) {
      this.hideButton();
      return;
    }

    // Exact UTF-16 offsets of the actual selected Range. Non-empty single character is valid;
    // exact text is taken from the DOM (not from sel.toString().trim()) so it matches on restore.
    const offsets = getRangeOffsets(contentContainer, range);
    if (!offsets) {
      this.hideButton();
      return;
    }

    // Find enclosing paragraph or block for the "原文说的是" quote
    let paragraphEl = element.closest('p, div.RichText > *, blockquote, li');
    if (!paragraphEl) paragraphEl = element;
    const fullParagraphText = paragraphEl.textContent?.trim() || offsets.exact;

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hideButton();
      return;
    }

    this.currentSelection = {
      highlight_text: offsets.exact,
      anchor_paragraph: fullParagraphText,
      prefix: offsets.prefix,
      suffix: offsets.suffix,
      start_offset: offsets.startOffset,
      end_offset: offsets.endOffset,
      boundingRect: rect,
      range: range.cloneRange(),
    };

    this.showButton(rect);
  }

  private showButton(rect: DOMRect) {
    if (!this.floatingButton) return;
    const top = window.scrollY + rect.top - 38;
    const left = window.scrollX + rect.left + rect.width / 2 - 30;

    this.floatingButton.style.top = `${Math.max(10, top)}px`;
    this.floatingButton.style.left = `${Math.max(10, left)}px`;
    this.floatingButton.style.display = 'block';
  }

  hideButton() {
    if (this.floatingButton) {
      this.floatingButton.style.display = 'none';
    }
  }

  clear() {
    this.currentSelection = null;
    this.hideButton();
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }
}
