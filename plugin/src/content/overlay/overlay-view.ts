// Right-side fixed overlay drawer for exploration and QA
// Complies with 插件局部树执行计划 §3.1, §3.2, §3.3, §3.4, §3.5, §5 (LT04, LT05, LT06)

import {
  HIGHLIGHT_BG,
  OVERLAY_DEFAULT_WIDTH,
} from '@zhihu-explore/ui-tokens';
import type { LocalTree, LocalNode, Article, DisciplineSlug, HighlightAnchor } from '@zhihu-explore/contracts';
import {
  createInitialViewState,
  reduceTreeViewState,
  type LocalTreeViewState,
} from '@zhihu-explore/domain';
import type { CapturedSelection } from '../selection.js';
import { DISCIPLINE_CONFIG, type OverlayCallbacks } from './view-types.js';
import { LocalTreeView } from './local-tree-view.js';
import { AnswerView } from './answer-view.js';
import { ComposerView } from './composer-view.js';
import { AnswerSelectionManager } from '../answer-selection.js';
import { ArrowLayer, type ArrowConnection } from '../arrow-layer.js';
import { NodeDragManager } from '../node-drag.js';
import { HostLayoutManager } from '../host-layout.js';

declare const __APP_ORIGIN__: string | undefined;

export { DISCIPLINE_CONFIG, type OverlayCallbacks };

export class OverlayView {
  public container: HTMLElement;
  private viewSessionId: string = '';
  private currentTree: LocalTree | null = null;
  private currentSelection: CapturedSelection | null = null;
  private currentArticle: Article | null = null;
  private callbacks: OverlayCallbacks;
  private classifyError: string | null = null;
  private isClassifying: boolean = false;
  private showDisciplinePicker: boolean = false;

  // Domain view state machine
  private viewState: LocalTreeViewState = createInitialViewState();

  // Stable child view components
  private headerEl: HTMLElement;
  private discBadgeEl: HTMLElement;
  private bindingStatusEl: HTMLElement;
  private errorBannerEl: HTMLElement;
  private pickerCardEl: HTMLElement;
  private bodyEl: HTMLElement;
  private excerptCardEl: HTMLElement;
  private localTreeView: LocalTreeView;
  private answerView: AnswerView;
  private composerView: ComposerView;
  private answerSelectionManager: AnswerSelectionManager;
  private arrowLayer: ArrowLayer;
  private nodeDragManager: NodeDragManager;
  private hostLayout: HostLayoutManager = new HostLayoutManager();
  private deleteBarEl: HTMLElement;

  constructor(callbacks: OverlayCallbacks) {
    this.callbacks = callbacks;

    // 1. Root container
    this.container = document.createElement('div');
    this.container.className = 'zhihu-explore-container';
    this.container.setAttribute('data-overlay-ready', 'true');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      right: -${OVERLAY_DEFAULT_WIDTH + 40}px;
      width: ${OVERLAY_DEFAULT_WIDTH}px;
      height: 100vh;
      background: #ffffff;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      z-index: 2147483645;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #121212;
      transition: right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // 2. Header
    this.headerEl = document.createElement('div');
    this.headerEl.style.cssText = `
      padding: 14px 16px;
      border-bottom: 1px solid #ebebeb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fafafa;
      flex-shrink: 0;
    `;

    this.discBadgeEl = document.createElement('div');
    this.discBadgeEl.style.cssText = `
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
    `;
    this.discBadgeEl.onclick = () => {
      this.showDisciplinePicker = !this.showDisciplinePicker;
      this.updateDisciplinePickerVisibility();
      this.callbacks.onChangeDisciplineClick?.();
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      border: none;
      background: none;
      font-size: 16px;
      cursor: pointer;
      color: #888;
      padding: 4px 8px;
    `;
    closeBtn.onclick = () => this.close();

    this.headerEl.appendChild(this.discBadgeEl);
    this.headerEl.appendChild(closeBtn);
    this.container.appendChild(this.headerEl);

    // 3. Error Banner (Classification Failure)
    this.errorBannerEl = document.createElement('div');
    this.errorBannerEl.style.cssText = `
      display: none;
      background: #fff2f0;
      border-bottom: 1px solid #ffccc7;
      padding: 10px 16px;
      font-size: 12px;
      color: #cf1322;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
    `;
    this.container.appendChild(this.errorBannerEl);

    // 3.1 Binding Status Bar (Global node binding & match candidates)
    this.bindingStatusEl = document.createElement('div');
    this.bindingStatusEl.className = 'zhihu-explore-binding-status';
    this.bindingStatusEl.style.cssText = `
      display: none;
      background: #f6ffed;
      border-bottom: 1px solid #b7eb8f;
      padding: 8px 16px;
      font-size: 12px;
      color: #389e0d;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
    `;
    this.container.appendChild(this.bindingStatusEl);

    // 4. Discipline Picker Card (toggled)
    this.pickerCardEl = document.createElement('div');
    this.pickerCardEl.style.cssText = `
      display: none;
      background: #f0f7ff;
      border-bottom: 1px solid #bae0ff;
      padding: 12px 16px;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    `;
    this.container.appendChild(this.pickerCardEl);

    // 5. Scrollable Body
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'zhihu-explore-body';
    this.bodyEl.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    `;

    // 5.1 Excerpt card
    this.excerptCardEl = document.createElement('div');
    this.excerptCardEl.style.cssText = `
      background: #f8f9fa;
      border-left: 4px solid #0084ff;
      padding: 12px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      flex-shrink: 0;
    `;
    this.bodyEl.appendChild(this.excerptCardEl);

    // Delete Dropzone Bar
    this.deleteBarEl = this.createDeleteBar();
    this.container.appendChild(this.deleteBarEl);

    // Node Drag Manager for 400ms long-press drag-to-delete (§3.6)
    this.nodeDragManager = new NodeDragManager(this.deleteBarEl, {
      onDragStart: () => {},
      onDragMove: () => {},
      onDragEnd: async (nodeId, droppedOnDeleteBar) => {
        if (droppedOnDeleteBar && this.currentTree) {
          await this.callbacks.onDeleteNode(this.currentTree.id, nodeId);
        }
      },
    });

    // 5.2 Local Tree View
    this.localTreeView = new LocalTreeView({
      onSelectNode: (nodeId) => this.handleNodeSelect(nodeId),
      onToggleSubtree: (nodeId) => this.handleToggleSubtree(nodeId),
      onAttachNode: (nodeId, element) => {
        this.nodeDragManager.attachNode(nodeId, element);
      },
    });
    this.bodyEl.appendChild(this.localTreeView.element);

    // 5.3 Answer View
    this.answerView = new AnswerView({
      onFollowupSelection: (_parentId, text) => {
        this.composerView.setQuote(text);
      },
      onDeleteNode: (nodeId) => {
        if (this.currentTree) {
          this.callbacks.onDeleteNode(this.currentTree.id, nodeId);
        }
      },
      onRenameNode: async (nodeId, newTitle) => {
        if (!this.currentTree) return;
        try {
          const res = await chrome.runtime.sendMessage({
            type: 'RENAME_NODE',
            payload: {
              tree_id: this.currentTree.id,
              node_id: nodeId,
              new_title: newTitle,
            },
          });
          if (res?.success && res.data) {
            this.updateTree(res.data);
          }
        } catch (err) {
          console.error('[OverlayView] Rename node failed:', err);
        }
      },
    });
    this.bodyEl.appendChild(this.answerView.element);

    this.container.appendChild(this.bodyEl);

    // 6. Composer View (Footer)
    this.composerView = new ComposerView({
      onSubmit: async (question) => {
        await this.handleComposerSubmit(question);
      },
      onClearSelection: () => {
        this.answerSelectionManager.clearPendingSelection();
      },
    });
    this.container.appendChild(this.composerView.element);

    // 7. Answer Selection Manager (captures selections within answer extra)
    this.answerSelectionManager = new AnswerSelectionManager({
      onSelectionChange: (sel) => {
        if (sel) {
          sel.treeId = this.currentTree?.id || '';
          this.viewState = reduceTreeViewState(this.viewState, {
            type: 'SET_PENDING_SELECTION',
            selection: sel,
          }, this.currentTree);
        } else {
          this.viewState = reduceTreeViewState(this.viewState, {
            type: 'SET_PENDING_SELECTION',
            selection: null,
          }, this.currentTree);
        }
        this.updateComposerFromSelection();
        this.callbacks.onAnswerSelectionChange?.(sel);
      },
    });

    // 8. Arrow Layer (connects highlight marks to answer cards)
    this.arrowLayer = new ArrowLayer();
    this.arrowLayer.registerScrollContainer(this.bodyEl);
    this.arrowLayer.observeElement(this.container);

    document.body.appendChild(this.container);
  }

  getViewSession(): { sessionId: string; treeId: string | null } {
    return {
      sessionId: this.viewSessionId,
      treeId: this.currentTree?.id ?? null,
    };
  }

  showForNewSelection(article: Article, selection: CapturedSelection) {
    this.viewSessionId = 'sess_' + Math.random().toString(36).slice(2) + '_' + Date.now();
    this.currentArticle = article;
    this.currentSelection = selection;
    this.currentTree = null;
    this.viewState = createInitialViewState();

    this.updateHeader();
    this.updateDisciplinePicker();
    this.updateExcerpt();
    this.updateBindingStatus();

    // In new selection mode, hide tree and answer views, show composer
    this.localTreeView.element.style.display = 'none';
    this.answerView.element.style.display = 'none';
    this.composerView.element.style.display = 'flex';
    this.updateComposerFromSelection();

    this.open();
  }

  showForExistingTree(article: Article, tree: LocalTree) {
    this.viewSessionId = 'sess_' + Math.random().toString(36).slice(2) + '_' + Date.now();
    this.currentArticle = article;
    this.currentTree = tree;
    this.currentSelection = null;

    // Initialize domain state machine with OPEN
    this.viewState = reduceTreeViewState(this.viewState, { type: 'OPEN', tree }, tree);

    this.updateHeader();
    this.updateDisciplinePicker();
    this.updateExcerpt();
    this.updateBindingStatus();

    this.localTreeView.element.style.display = 'block';
    this.answerView.element.style.display = 'flex';
    this.composerView.element.style.display = 'flex';

    this.answerSelectionManager.clearPendingSelection();
    this.updateComposerFromSelection();

    this.updateTreeAndAnswerViews();
    this.open();
  }

  /**
   * Called when the root QA node and tree have just been created for a new selection.
   * Restores tree and answer view visibility and focuses root card.
   */
  showForCreatedRoot(tree: LocalTree) {
    this.currentTree = tree;
    // Preserve this.currentSelection as immediate arrow source fallback before refreshTrees creates anchor mark DOM

    this.viewState = reduceTreeViewState(this.viewState, { type: 'OPEN', tree }, tree);

    this.localTreeView.element.style.display = 'block';
    this.answerView.element.style.display = 'flex';
    this.composerView.element.style.display = 'flex';

    this.updateHeader();
    this.updateDisciplinePicker();
    this.updateExcerpt();
    this.updateBindingStatus();

    this.answerSelectionManager.clearPendingSelection();
    this.updateComposerFromSelection();

    this.updateTreeAndAnswerViews();
  }

  /**
   * Called when a follow-up node has been added to the current tree.
   * Executes NODE_ADDED to expand ancestors and focus new card.
   */
  appendFollowupNode(tree: LocalTree, newNodeId: string) {
    this.currentTree = tree;
    this.viewState = reduceTreeViewState(this.viewState, { type: 'NODE_ADDED', newNodeId }, tree);

    this.localTreeView.element.style.display = 'block';
    this.answerView.element.style.display = 'flex';
    this.composerView.element.style.display = 'flex';

    this.answerSelectionManager.clearPendingSelection();
    this.updateComposerFromSelection();

    this.updateTreeAndAnswerViews();
  }

  updateTree(tree: LocalTree) {
    const previousTree = this.currentTree;
    this.currentTree = tree;
    this.viewState = reduceTreeViewState(this.viewState, { type: 'TREE_REPLACED', tree }, previousTree);
    if (tree.nodes.length > 0) {
      this.localTreeView.element.style.display = 'block';
      this.answerView.element.style.display = 'flex';
    }
    this.updateBindingStatus();
    this.updateTreeAndAnswerViews();
    this.updateComposerFromSelection();
  }

  updateArticle(article: Article) {
    this.currentArticle = article;
    this.updateHeader();
    this.updateDisciplinePicker();
  }

  setClassifyError(err: string | null) {
    this.classifyError = err;
    this.updateErrorBanner();
  }

  setClassifying(classifying: boolean) {
    this.isClassifying = classifying;
    this.updateErrorBanner();
  }

  open() {
    this.container.removeAttribute('data-drawer-settled');
    this.container.style.right = '0px';
    this.hostLayout.shiftHost(OVERLAY_DEFAULT_WIDTH);
    this.updateArrowConnection();
    setTimeout(() => {
      this.container.setAttribute('data-drawer-settled', 'true');
      this.updateArrowConnection();
    }, 280);
  }

  close() {
    this.viewSessionId = '';
    this.container.removeAttribute('data-drawer-settled');
    this.container.style.right = `-${OVERLAY_DEFAULT_WIDTH + 40}px`;
    this.hostLayout.restoreHost();
    this.nodeDragManager.cancelDrag();
    this.arrowLayer.clear();
    this.answerSelectionManager.clearPendingSelection();
    this.composerView.clearQuote();
    this.currentSelection = null;
    this.callbacks.onClose();
  }

  getCurrentTree(): LocalTree | null {
    return this.currentTree;
  }

  private handleNodeSelect(nodeId: string) {
    if (!this.currentTree) return;
    this.viewState = reduceTreeViewState(this.viewState, { type: 'SELECT', nodeId }, this.currentTree);
    this.answerSelectionManager.clearPendingSelection();
    this.updateComposerFromSelection();
    this.updateTreeAndAnswerViews();
    this.callbacks.onSelectNode?.(nodeId);
  }

  private handleToggleSubtree(nodeId: string) {
    if (!this.currentTree) return;
    this.viewState = reduceTreeViewState(this.viewState, { type: 'TOGGLE_SUBTREE', nodeId }, this.currentTree);
    this.answerSelectionManager.clearPendingSelection();
    this.updateComposerFromSelection();
    this.updateTreeAndAnswerViews();
    this.callbacks.onToggleSubtree?.(nodeId);
  }

  private updateComposerFromSelection() {
    if (this.currentTree) {
      const pSel = this.viewState.pendingSelection;
      this.composerView.updateState({
        isFollowupMode: true,
        hasSelection: Boolean(pSel),
        quoteText: pSel?.exact ?? null,
      });
    } else {
      this.composerView.updateState({
        isFollowupMode: false,
        hasSelection: Boolean(this.currentSelection),
        quoteText: this.currentSelection?.highlight_text ?? null,
      });
    }
  }

  private updateTreeAndAnswerViews() {
    if (!this.currentTree) return;

    // 1. Render LocalTreeView
    this.localTreeView.render(this.currentTree, this.viewState);

    // 2. Compute visible answer nodes according to mode
    let answerNodes: LocalNode[] = [];
    if (this.viewState.answerMode === 'subtree' && this.viewState.subtreeRootId) {
      // Subtree mode: nodes in the subtree
      const subtreeIds = new Set<string>();
      const addSubtree = (pid: string) => {
        subtreeIds.add(pid);
        const children = this.currentTree!.nodes.filter((n) => n.parent_id === pid);
        for (const c of children) addSubtree(c.id);
      };
      addSubtree(this.viewState.subtreeRootId);
      answerNodes = this.currentTree.nodes.filter((n) => subtreeIds.has(n.id));
    } else {
      // Path mode: from root to selectedNodeId
      const targetId = this.viewState.selectedNodeId || this.currentTree.root_node_id;
      const pathNodes: LocalNode[] = [];
      let cur: LocalNode | undefined = this.currentTree.nodes.find((n) => n.id === targetId);
      while (cur) {
        pathNodes.unshift(cur);
        cur = cur.parent_id ? this.currentTree.nodes.find((n) => n.id === cur!.parent_id) : undefined;
      }
      answerNodes = pathNodes.length > 0 ? pathNodes : this.currentTree.nodes.slice(0, 1);
    }

    // 3. Render AnswerView with segmented highlights and active node focus
    this.answerView.renderAnswers(
      answerNodes,
      this.viewState.answerMode,
      this.viewState.selectedNodeId,
      this.currentTree.nodes,
      this.currentTree.root_node_id,
    );

    // 4. Update SVG arrow connection between highlight and active card
    this.updateArrowConnection();
  }

  /**
   * Public method to refresh arrow connections after external DOM changes (e.g., anchor marks created).
   */
  refreshArrows() {
    this.updateArrowConnection();
  }

  private updateArrowConnection() {
    if (!this.currentTree) {
      this.arrowLayer.clear();
      return;
    }

    const connections: ArrowConnection[] = [];
    const activeNodeId = this.viewState.selectedNodeId || this.currentTree.root_node_id;

    // 1. Root Connection: From article original selection/anchor mark to root answer card
    const rootCard = this.answerView.element.querySelector(
      `[data-node-id="${this.currentTree.root_node_id}"]`
    ) as HTMLElement;

    if (rootCard) {
      // Anchor marks in article DOM (may be several when the highlight crosses inline tags);
      // span them with one Range so the arrow starts at the real highlight. Fall back to the
      // captured selection range before the anchor exists.
      const articleMarks = Array.from(
        document.querySelectorAll<HTMLElement>(
          `.zhihu-explore-anchor-mark[data-tree-id="${this.currentTree.id}"]`
        )
      );

      let rootSource: HTMLElement | Range | null = null;
      if (articleMarks.length === 1) {
        rootSource = articleMarks[0]!;
      } else if (articleMarks.length > 1) {
        const r = document.createRange();
        r.setStartBefore(articleMarks[0]!);
        r.setEndAfter(articleMarks[articleMarks.length - 1]!);
        rootSource = r;
      }
      if (!rootSource && this.currentSelection?.range && this.currentSelection.range.commonAncestorContainer.isConnected) {
        rootSource = this.currentSelection.range;
      }

      if (rootSource) {
        connections.push({
          id: 'root-connection',
          source: rootSource,
          target: rootCard,
          isActive: activeNodeId === this.currentTree.root_node_id,
        });
      }
    }

    // 2. Visible Branch Connections (parent highlight mark -> child answer card)
    for (const node of this.currentTree.nodes) {
      if (!node.parent_id) continue;

      const childCard = this.answerView.element.querySelector(
        `[data-node-id="${node.id}"]`
      ) as HTMLElement;
      const parentCard = this.answerView.element.querySelector(
        `[data-node-id="${node.parent_id}"]`
      ) as HTMLElement;

      if (!childCard || !parentCard) continue;

      const markEl = parentCard.querySelector(
        `.zhihu-explore-highlight-mark[data-child-ids*="${node.id}"]`
      ) as HTMLElement;

      if (markEl) {
        connections.push({
          id: `${node.parent_id}->${node.id}`,
          source: markEl,
          target: childCard,
          isActive: activeNodeId === node.id,
        });
      }
    }

    this.arrowLayer.setConnections(connections);
  }

  private async handleComposerSubmit(question: string) {
    if (!this.currentArticle?.discipline_slug) {
      alert('该文章尚未关联学科，请先在上方选择学科知识体系！');
      this.showDisciplinePicker = true;
      this.updateDisciplinePickerVisibility();
      return;
    }

    this.composerView.setLoading(true);

    try {
      if (this.currentTree) {
        // Enforce highlight selection for followup (§3.4, §5)
        if (!this.viewState.pendingSelection) {
          return;
        }
        const pSel = this.viewState.pendingSelection;
        const anchor: HighlightAnchor = {
          exact: pSel.exact,
          prefix: pSel.prefix,
          suffix: pSel.suffix,
          start_offset: pSel.startOffset,
          end_offset: pSel.endOffset,
        };
        await this.callbacks.onFollowupQuestion(pSel.parentNodeId, pSel.exact, question, anchor);
        this.answerSelectionManager.clearPendingSelection();
        this.viewState = { ...this.viewState, pendingSelection: null };
      } else {
        // Initial tree question
        await this.callbacks.onSubmitQuestion(question);
      }
      this.composerView.clearInput();
    } finally {
      this.composerView.setLoading(false);
      this.updateComposerFromSelection();
    }
  }

  private updateHeader() {
    const discSlug = this.currentArticle?.discipline_slug;
    const label = discSlug ? (DISCIPLINE_CONFIG[discSlug]?.name ?? discSlug) : '未选学科 (点击选择)';
    this.discBadgeEl.textContent = `📚 ${label} ▾`;
    this.discBadgeEl.style.background = discSlug ? '#0084ff15' : '#fff1f0';
    this.discBadgeEl.style.color = discSlug ? '#0084ff' : '#cf1322';
    this.discBadgeEl.style.border = `1px solid ${discSlug ? '#0084ff30' : '#ffa39e'}`;
  }

  private updateErrorBanner() {
    if (!this.classifyError) {
      this.errorBannerEl.style.display = 'none';
      return;
    }

    this.errorBannerEl.style.display = 'flex';
    while (this.errorBannerEl.firstChild) {
      this.errorBannerEl.removeChild(this.errorBannerEl.firstChild);
    }

    const errText = document.createElement('div');
    errText.textContent = `⚠️ 学科分类失败：${this.classifyError}`;

    const retryBtn = document.createElement('button');
    retryBtn.textContent = this.isClassifying ? '重试中...' : '重试分类';
    retryBtn.disabled = this.isClassifying;
    retryBtn.style.cssText = `
      background: #cf1322;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    `;
    retryBtn.onclick = async () => {
      if (this.callbacks.onRetryClassify) {
        this.isClassifying = true;
        this.updateErrorBanner();
        try {
          await this.callbacks.onRetryClassify();
        } finally {
          this.isClassifying = false;
          this.updateErrorBanner();
        }
      }
    };

    this.errorBannerEl.appendChild(errText);
    this.errorBannerEl.appendChild(retryBtn);
  }

  private updateDisciplinePicker() {
    while (this.pickerCardEl.firstChild) {
      this.pickerCardEl.removeChild(this.pickerCardEl.firstChild);
    }

    const discSlug = this.currentArticle?.discipline_slug;
    const pickerTitle = document.createElement('div');
    pickerTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: #0958d9;';
    pickerTitle.textContent = discSlug ? '切换关联学科体系：' : '文章未自动识别学科，请选择关联学科：';
    this.pickerCardEl.appendChild(pickerTitle);

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

    for (const [slug, info] of Object.entries(DISCIPLINE_CONFIG) as [DisciplineSlug, { name: string; desc: string }][]) {
      const isCurrent = discSlug === slug;
      const dBtn = document.createElement('button');
      dBtn.style.cssText = `
        padding: 8px 10px;
        background: ${isCurrent ? '#0084ff' : '#ffffff'};
        color: ${isCurrent ? '#ffffff' : '#262626'};
        border: 1px solid ${isCurrent ? '#0084ff' : '#d9d9d9'};
        border-radius: 6px;
        font-size: 12px;
        text-align: left;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
        transition: all 0.2s;
      `;
      const nameSpan = document.createElement('span');
      nameSpan.style.fontWeight = '600';
      nameSpan.textContent = info.name + (isCurrent ? ' (当前)' : '');
      const descSpan = document.createElement('span');
      descSpan.style.fontSize = '11px';
      descSpan.style.color = isCurrent ? 'rgba(255,255,255,0.85)' : '#8c8c8c';
      descSpan.textContent = info.desc;

      dBtn.appendChild(nameSpan);
      dBtn.appendChild(descSpan);

      dBtn.onclick = async () => {
        dBtn.disabled = true;
        if (this.callbacks.onSelectDiscipline) {
          await this.callbacks.onSelectDiscipline(slug);
        }
        this.showDisciplinePicker = false;
        this.updateDisciplinePickerVisibility();
      };
      btnGroup.appendChild(dBtn);
    }

    this.pickerCardEl.appendChild(btnGroup);
    this.updateDisciplinePickerVisibility();
  }

  private updateDisciplinePickerVisibility() {
    const discSlug = this.currentArticle?.discipline_slug;
    const shouldShow = !discSlug || this.showDisciplinePicker;
    this.pickerCardEl.style.display = shouldShow ? 'flex' : 'none';
  }

  private updateExcerpt() {
    while (this.excerptCardEl.firstChild) {
      this.excerptCardEl.removeChild(this.excerptCardEl.firstChild);
    }

    const paragraphText = this.currentTree?.anchor_paragraph || this.currentSelection?.anchor_paragraph || '';
    const highlightText = this.currentTree?.anchor_highlight || this.currentSelection?.highlight_text || '';

    if (paragraphText && highlightText && paragraphText.includes(highlightText)) {
      const parts = paragraphText.split(highlightText);
      this.excerptCardEl.appendChild(document.createTextNode(parts[0]!));
      const mark = document.createElement('mark');
      mark.style.cssText = `background: ${HIGHLIGHT_BG}; padding: 1px 3px; border-radius: 2px; font-weight: 500;`;
      mark.textContent = highlightText;
      this.excerptCardEl.appendChild(mark);
      this.excerptCardEl.appendChild(document.createTextNode(parts.slice(1).join(highlightText)));
    } else {
      this.excerptCardEl.textContent = paragraphText || highlightText;
    }
  }

  private updateBindingStatus() {
    while (this.bindingStatusEl.firstChild) {
      this.bindingStatusEl.removeChild(this.bindingStatusEl.firstChild);
    }

    if (!this.currentTree) {
      this.bindingStatusEl.style.display = 'none';
      return;
    }

    this.bindingStatusEl.style.display = 'flex';

    if (this.currentTree.global_node_id) {
      const infoSpan = document.createElement('div');
      infoSpan.style.cssText = 'display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 12px;';
      infoSpan.textContent = `🌿 已挂靠知识点: ${this.currentTree.global_node_id}`;

      const link = document.createElement('a');
      const disc = this.currentTree.discipline_slug || 'agent-app-dev';
      const appOrigin = typeof __APP_ORIGIN__ !== 'undefined' ? __APP_ORIGIN__ : 'https://zhihu-interest-explore.web.app';
      link.href = `${appOrigin}/d/${disc}?focus=${encodeURIComponent(this.currentTree.global_node_id)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '在知识图谱中查看 ↗';
      link.style.cssText = 'color: #389e0d; text-decoration: underline; font-weight: 600; cursor: pointer; font-size: 11px;';

      this.bindingStatusEl.appendChild(infoSpan);
      this.bindingStatusEl.appendChild(link);
    } else if (this.currentTree.match_candidates && this.currentTree.match_candidates.length > 0) {
      const candContainer = document.createElement('div');
      candContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px;';

      const label = document.createElement('span');
      label.textContent = '推荐挂靠知识点:';
      label.style.fontWeight = '500';
      candContainer.appendChild(label);

      for (const cand of this.currentTree.match_candidates.slice(0, 3)) {
        const btn = document.createElement('button');
        btn.textContent = `+ ${cand.title || cand.global_node_id}`;
        btn.style.cssText = `
          background: #ffffff;
          border: 1px solid #b7eb8f;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          color: #389e0d;
          cursor: pointer;
        `;
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            const res = await chrome.runtime.sendMessage({
              type: 'BIND_TREE',
              payload: {
                tree_id: this.currentTree!.id,
                global_node_id: cand.global_node_id,
              },
            });
            if (res?.success && res.data) {
              this.updateTree(res.data);
            }
          } catch (err) {
            console.error('[OverlayView] Bind tree failed:', err);
          }
        };
        candContainer.appendChild(btn);
      }

      this.bindingStatusEl.appendChild(candContainer);
    } else {
      this.bindingStatusEl.style.display = 'none';
    }
  }

  private createDeleteBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'zhihu-explore-delete-bar';
    bar.textContent = '拖动到此处删除 🗑️';
    bar.style.cssText = `
      display: none;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50px;
      background: #ff4d4f;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
    `;

    bar.ondragover = (e) => e.preventDefault();
    bar.ondrop = async (e) => {
      e.preventDefault();
      const nodeId = e.dataTransfer?.getData('text/plain');
      if (nodeId && this.currentTree) {
        bar.style.display = 'none';
        await this.callbacks.onDeleteNode(this.currentTree.id, nodeId);
      }
    };

    return bar;
  }

  destroy() {
    this.hostLayout.restoreHost();
    this.nodeDragManager.destroy();
    this.arrowLayer.destroy();
    this.answerSelectionManager.destroy();
    this.localTreeView.destroy();
    this.answerView.destroy();
    this.composerView.destroy();
    this.container.remove();
  }
}
