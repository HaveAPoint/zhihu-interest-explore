// Answer view component for rendering path or subtree answer cards
// Complies with 插件局部树执行计划 §3.1, §3.5, §5 (LT04, LT05)

import type { LocalNode } from '@zhihu-explore/contracts';
import { resolveChildHighlights, renderSegmentedHighlights } from '../highlight-renderer.js';

export interface AnswerViewCallbacks {
  onFollowupSelection?: (parentNodeId: string, selectionText: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onRenameNode?: (nodeId: string, newTitle: string) => void;
}

export class AnswerView {
  public element: HTMLElement;
  private callbacks: AnswerViewCallbacks;
  private cardMap = new Map<string, HTMLElement>();
  private extraBoxMap = new Map<string, HTMLElement>();

  constructor(callbacks: AnswerViewCallbacks = {}) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'zhihu-explore-answers-container';
    this.element.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 4px;
    `;
  }

  getCallbacks(): AnswerViewCallbacks {
    return this.callbacks;
  }

  /**
   * Renders the answer cards for the given nodes.
   * Preserves existing card DOM elements by nodeId to prevent losing scroll and selection.
   * @param rootNodeId Explicit root node ID from tree.root_node_id — never inferred from index.
   */
  renderAnswers(nodes: LocalNode[], _mode: 'path' | 'subtree', activeNodeId: string | null, allNodes?: LocalNode[], rootNodeId?: string) {
    const activeNodeIds = new Set(nodes.map((n) => n.id));
    const treeNodes = allNodes || nodes;

    // 1. Detach cards that are no longer visible in the active mode
    for (const [id, cardEl] of this.cardMap.entries()) {
      if (!activeNodeIds.has(id)) {
        cardEl.remove();
        this.cardMap.delete(id);
        this.extraBoxMap.delete(id);
      }
    }

    // 2. Ensure cards are rendered in order
    nodes.forEach((node, idx) => {
      const isRoot = rootNodeId ? node.id === rootNodeId : idx === 0;
      let card = this.cardMap.get(node.id);
      if (!card) {
        card = this.createCardElement(node, isRoot, treeNodes);
        this.cardMap.set(node.id, card);
      } else {
        // Field-level update for existing cards
        this.updateCardContent(card, node, isRoot, treeNodes);
      }

      // Re-append or preserve in container in order
      if (this.element.children[idx] !== card) {
        this.element.appendChild(card);
      }
    });

    // Update active card border/shadow
    for (const [id, card] of this.cardMap.entries()) {
      this.updateCardHighlight(card, id === activeNodeId);
    }
  }

  private createCardElement(node: LocalNode, isRoot: boolean, treeNodes: LocalNode[]): HTMLElement {
    const card = document.createElement('div');
    card.className = 'zhihu-explore-answer-card';
    card.setAttribute('data-node-id', node.id);
    card.style.cssText = `
      background: #ffffff;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    `;

    // 1. Header (Title + Type badge)
    const header = document.createElement('div');
    header.className = 'zhihu-explore-card-header';
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;

    const titleEl = document.createElement('div');
    titleEl.className = 'zhihu-explore-card-title';
    titleEl.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #121212;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    const titleText = document.createElement('span');
    titleText.className = 'zhihu-explore-card-title-text';
    titleText.textContent = node.title;
    titleEl.appendChild(titleText);

    const editBtn = document.createElement('button');
    editBtn.className = 'zhihu-explore-card-edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = '修改短标题';
    editBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 11px;
      opacity: 0.5;
      padding: 0 2px;
      transition: opacity 0.15s;
    `;
    editBtn.onmouseenter = () => { editBtn.style.opacity = '1'; };
    editBtn.onmouseleave = () => { editBtn.style.opacity = '0.5'; };
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const currentTitle = card.querySelector('.zhihu-explore-card-title-text')?.textContent || node.title;
      const newTitle = prompt('修改节点短标题：', currentTitle);
      if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
        this.callbacks.onRenameNode?.(node.id, newTitle.trim());
      }
    };
    titleEl.appendChild(editBtn);

    const typeBadge = document.createElement('span');
    typeBadge.className = 'zhihu-explore-card-type-badge';
    this.applyTypeBadgeStyle(typeBadge, isRoot);

    const actionGroup = document.createElement('div');
    actionGroup.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    actionGroup.appendChild(typeBadge);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'zhihu-explore-card-delete-btn';
    deleteBtn.title = isRoot ? '删除整棵树' : '删除此节点及所有子节点';
    deleteBtn.textContent = '🗑️';
    deleteBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      opacity: 0.6;
      padding: 2px 4px;
      border-radius: 4px;
      transition: opacity 0.15s, background 0.15s;
    `;
    deleteBtn.onmouseenter = () => { deleteBtn.style.opacity = '1'; deleteBtn.style.background = '#fff1f0'; };
    deleteBtn.onmouseleave = () => { deleteBtn.style.opacity = '0.6'; deleteBtn.style.background = 'none'; };
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      const promptText = isRoot ? '确定要删除整棵树吗？' : '确定要删除此节点及所有后续追问吗？';
      if (confirm(promptText)) {
        this.callbacks.onDeleteNode?.(node.id);
      }
    };
    actionGroup.appendChild(deleteBtn);

    header.appendChild(titleEl);
    header.appendChild(actionGroup);
    card.appendChild(header);

    // 2. Quote / Highlight text
    const quoteBox = document.createElement('div');
    quoteBox.className = 'zhihu-explore-card-quote-box';
    this.applyQuoteBoxStyle(quoteBox, isRoot);
    const quoteLabel = document.createElement('span');
    quoteLabel.className = 'zhihu-explore-card-quote-label';
    quoteLabel.style.fontWeight = '600';
    quoteLabel.style.color = isRoot ? '#0084ff' : '#389e0d';
    quoteLabel.textContent = isRoot ? '原文引用: ' : '本次高亮: ';
    quoteBox.appendChild(quoteLabel);
    const quoteText = document.createElement('span');
    quoteText.className = 'zhihu-explore-card-quote-text';
    quoteText.textContent = node.highlight_text;
    quoteBox.appendChild(quoteText);
    card.appendChild(quoteBox);

    // 3. Question (if present)
    const qEl = document.createElement('div');
    qEl.className = 'zhihu-explore-card-question';
    qEl.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      color: #262626;
      display: flex;
      gap: 4px;
    `;
    if (node.question_text && node.question_text.trim().length > 0) {
      const qIcon = document.createElement('span');
      qIcon.textContent = '❓ ';
      qEl.appendChild(qIcon);
      qEl.appendChild(document.createTextNode(node.question_text));
      qEl.style.display = 'flex';
    } else {
      qEl.style.display = 'none';
    }
    card.appendChild(qEl);

    // 4. Explanation text with segmented highlight (verbatim text nodes + marks, preventing XSS)
    const extraBox = document.createElement('div');
    extraBox.className = 'zhihu-explore-answer-extra';
    extraBox.setAttribute('data-parent-node-id', node.id);
    extraBox.style.cssText = `
      font-size: 13px;
      color: #333333;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: text;
    `;

    const childNodes = treeNodes.filter((n) => n.parent_id === node.id);
    const highlights = resolveChildHighlights(node.answer_extra, childNodes);
    renderSegmentedHighlights(extraBox, node.answer_extra, highlights);

    this.extraBoxMap.set(node.id, extraBox);
    card.appendChild(extraBox);

    // 5. Sources list (if any)
    const sourcesContainer = document.createElement('div');
    sourcesContainer.className = 'zhihu-explore-card-sources';
    this.renderSources(sourcesContainer, node);
    card.appendChild(sourcesContainer);

    return card;
  }

  /**
   * Field-level update for an existing card — refreshes title, quote, question, highlights, sources, and type badge.
   */
  private updateCardContent(card: HTMLElement, node: LocalNode, isRoot: boolean, treeNodes: LocalNode[]) {
    // Title
    const titleText = card.querySelector('.zhihu-explore-card-title-text');
    if (titleText && titleText.textContent !== node.title) {
      titleText.textContent = node.title;
    }

    // Type badge
    const typeBadge = card.querySelector('.zhihu-explore-card-type-badge') as HTMLElement;
    if (typeBadge) {
      this.applyTypeBadgeStyle(typeBadge, isRoot);
    }

    // Delete button tooltip
    const deleteBtn = card.querySelector('.zhihu-explore-card-delete-btn') as HTMLElement;
    if (deleteBtn) {
      deleteBtn.title = isRoot ? '删除整棵树' : '删除此节点及所有子节点';
    }

    // Quote box
    const quoteBox = card.querySelector('.zhihu-explore-card-quote-box') as HTMLElement;
    if (quoteBox) {
      this.applyQuoteBoxStyle(quoteBox, isRoot);
      const quoteLabel = quoteBox.querySelector('.zhihu-explore-card-quote-label');
      if (quoteLabel) {
        quoteLabel.textContent = isRoot ? '原文引用: ' : '本次高亮: ';
        (quoteLabel as HTMLElement).style.color = isRoot ? '#0084ff' : '#389e0d';
      }
      const quoteTextEl = quoteBox.querySelector('.zhihu-explore-card-quote-text');
      if (quoteTextEl && quoteTextEl.textContent !== node.highlight_text) {
        quoteTextEl.textContent = node.highlight_text;
      }
    }

    // Question
    const qEl = card.querySelector('.zhihu-explore-card-question') as HTMLElement;
    if (qEl) {
      while (qEl.firstChild) qEl.removeChild(qEl.firstChild);
      if (node.question_text && node.question_text.trim().length > 0) {
        const qIcon = document.createElement('span');
        qIcon.textContent = '❓ ';
        qEl.appendChild(qIcon);
        qEl.appendChild(document.createTextNode(node.question_text));
        qEl.style.display = 'flex';
      } else {
        qEl.style.display = 'none';
      }
    }

    // Segmented highlights (answer_extra)
    const extraBox = this.extraBoxMap.get(node.id);
    if (extraBox) {
      const childNodes = treeNodes.filter((n) => n.parent_id === node.id);
      const highlights = resolveChildHighlights(node.answer_extra, childNodes);
      renderSegmentedHighlights(extraBox, node.answer_extra, highlights);
    }

    // Sources
    const sourcesContainer = card.querySelector('.zhihu-explore-card-sources') as HTMLElement;
    if (sourcesContainer) {
      this.renderSources(sourcesContainer, node);
    }

    // Active highlight
    this.updateCardHighlight(card, false);
  }

  private applyTypeBadgeStyle(badge: HTMLElement, isRoot: boolean) {
    badge.style.cssText = `
      font-size: 11px;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;
      background: ${isRoot ? '#e6f4ff' : '#f6ffed'};
      color: ${isRoot ? '#0958d9' : '#389e0d'};
      border: 1px solid ${isRoot ? '#91caff' : '#b7eb8f'};
    `;
    badge.textContent = isRoot ? '根回答' : '追问回答';
  }

  private applyQuoteBoxStyle(box: HTMLElement, isRoot: boolean) {
    box.style.cssText = `
      background: #fcfcfc;
      border-left: 3px solid ${isRoot ? '#0084ff' : '#52c41a'};
      padding: 8px 10px;
      border-radius: 0 4px 4px 0;
      font-size: 12px;
      color: #555555;
      line-height: 1.5;
    `;
  }

  private renderSources(container: HTMLElement, node: LocalNode) {
    while (container.firstChild) container.removeChild(container.firstChild);

    if (!node.sources || node.sources.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    container.style.cssText = `
      border-top: 1px dashed #f0f0f0;
      padding-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;
    const sourceTitle = document.createElement('div');
    sourceTitle.style.cssText = 'font-size: 11px; color: #8c8c8c; font-weight: 500;';
    sourceTitle.textContent = '参考来源:';
    container.appendChild(sourceTitle);

    for (const src of node.sources) {
      const link = document.createElement('a');
      link.href = src.url;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      link.style.cssText = 'font-size: 11px; color: #1677ff; text-decoration: none;';
      link.textContent = `🔗 ${src.title}`;
      container.appendChild(link);
    }
  }

  private updateCardHighlight(card: HTMLElement, isActive: boolean) {
    if (isActive) {
      card.style.borderColor = '#1677ff';
      card.style.boxShadow = '0 0 0 2px rgba(22, 119, 255, 0.15)';
    } else {
      card.style.borderColor = '#e8e8e8';
      card.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
    }
  }

  destroy() {
    this.cardMap.clear();
    this.element.remove();
  }
}

