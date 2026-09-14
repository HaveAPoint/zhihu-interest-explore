// Right-side fixed overlay drawer for exploration and QA
// Complies with 作者本人开发计划 §4.1, §4.3, T19, T20

import {
  HIGHLIGHT_BG,
  OVERLAY_DEFAULT_WIDTH,
} from '@zhihu-explore/ui-tokens';
import type { LocalTree, Article, DisciplineSlug } from '@zhihu-explore/contracts';
import type { CapturedSelection } from '../selection.js';

export const DISCIPLINE_CONFIG: Record<DisciplineSlug, { name: string; desc: string }> = {
  'agent-app-dev': { name: 'AI Agent 应用开发', desc: 'LLM、Tool Use、ReAct 架构、记忆系统' },
  'cognitive-psychology': { name: '认知心理学', desc: '工作记忆、减法反应时、认知负荷模型' },
  'distributed-systems': { name: '分布式系统', desc: 'Raft 共识、Paxos、CAP 定理、分布式一致性' },
};

export interface OverlayCallbacks {
  onSubmitQuestion: (question: string) => Promise<void>;
  onFollowupQuestion: (parentNodeId: string, highlight: string, question: string) => Promise<void>;
  onDeleteNode: (treeId: string, nodeId: string) => Promise<void>;
  onClose: () => void;
  onChangeDisciplineClick?: () => void;
  onSelectDiscipline?: (slug: DisciplineSlug) => Promise<void>;
  onRetryClassify?: () => Promise<void>;
}

export class OverlayView {
  private container: HTMLElement;
  private currentTree: LocalTree | null = null;
  private currentSelection: CapturedSelection | null = null;
  private currentArticle: Article | null = null;
  private callbacks: OverlayCallbacks;
  private selectedNodeId: string | null = null;
  private answerHighlightText: string = '';
  private classifyError: string | null = null;
  private isClassifying: boolean = false;
  private showDisciplinePicker: boolean = false;

  constructor(callbacks: OverlayCallbacks) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.className = 'zhihu-explore-container';
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

    document.body.appendChild(this.container);
  }

  showForNewSelection(article: Article, selection: CapturedSelection) {
    this.currentArticle = article;
    this.currentSelection = selection;
    this.currentTree = null;
    this.selectedNodeId = null;
    this.render();
    this.open();
  }

  showForExistingTree(article: Article, tree: LocalTree) {
    this.currentArticle = article;
    this.currentTree = tree;
    this.currentSelection = null;
    this.selectedNodeId = tree.root_node_id;
    this.render();
    this.open();
  }

  updateTree(tree: LocalTree) {
    this.currentTree = tree;
    if (!this.selectedNodeId || !tree.nodes.some((n) => n.id === this.selectedNodeId)) {
      this.selectedNodeId = tree.root_node_id;
    }
    this.render();
  }

  updateArticle(article: Article) {
    this.currentArticle = article;
    this.render();
  }

  setClassifyError(err: string | null) {
    this.classifyError = err;
    this.render();
  }

  setClassifying(classifying: boolean) {
    this.isClassifying = classifying;
    this.render();
  }

  open() {
    this.container.style.right = '0px';
    // Shift page content slightly if desktop wide
    if (window.innerWidth > 1400) {
      document.body.style.marginRight = `${OVERLAY_DEFAULT_WIDTH}px`;
      document.body.style.transition = 'margin-right 0.25s ease';
    }
  }

  close() {
    this.container.style.right = `-${OVERLAY_DEFAULT_WIDTH + 40}px`;
    document.body.style.marginRight = '0px';
    this.callbacks.onClose();
  }

  private render() {
    this.container.innerHTML = '';

    const discSlug = this.currentArticle?.discipline_slug;

    // 1. Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #ebebeb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fafafa;
    `;

    const discBadge = document.createElement('div');
    discBadge.style.cssText = `
      background: ${discSlug ? '#0084ff15' : '#fff1f0'};
      color: ${discSlug ? '#0084ff' : '#cf1322'};
      border: 1px solid ${discSlug ? '#0084ff30' : '#ffa39e'};
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    const label = discSlug ? (DISCIPLINE_CONFIG[discSlug]?.name ?? discSlug) : '未选学科 (点击选择)';
    discBadge.textContent = `📚 ${label} ▾`;
    discBadge.onclick = () => {
      this.showDisciplinePicker = !this.showDisciplinePicker;
      this.render();
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

    header.appendChild(discBadge);
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    // 2. Scrollable Body
    const body = document.createElement('div');
    body.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // 2.1 Classification Error Banner (with Retry)
    if (this.classifyError) {
      const errCard = document.createElement('div');
      errCard.style.cssText = `
        background: #fff2f0;
        border: 1px solid #ffccc7;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 12px;
        color: #cf1322;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      `;
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
          this.render();
          try {
            await this.callbacks.onRetryClassify();
          } finally {
            this.isClassifying = false;
            this.render();
          }
        }
      };
      errCard.appendChild(errText);
      errCard.appendChild(retryBtn);
      body.appendChild(errCard);
    }

    // 2.2 Discipline Picker (shown when null or user toggled)
    if (!discSlug || this.showDisciplinePicker) {
      const pickerCard = document.createElement('div');
      pickerCard.style.cssText = `
        background: #f0f7ff;
        border: 1px solid #bae0ff;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      `;
      const pickerTitle = document.createElement('div');
      pickerTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: #0958d9;';
      pickerTitle.textContent = discSlug ? '切换关联学科体系：' : '文章未自动识别学科，请选择关联学科：';
      pickerCard.appendChild(pickerTitle);

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
          this.render();
        };
        btnGroup.appendChild(dBtn);
      }
      pickerCard.appendChild(btnGroup);
      body.appendChild(pickerCard);
    }

    // 3. Quoted Excerpt section
    const excerptCard = document.createElement('div');
    excerptCard.style.cssText = `
      background: #f8f9fa;
      border-left: 4px solid #0084ff;
      padding: 12px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
    `;

    const paragraphText = this.currentTree?.anchor_paragraph || this.currentSelection?.anchor_paragraph || '';
    const highlightText = this.currentTree?.anchor_highlight || this.currentSelection?.highlight_text || '';

    // Verbatim quote with highlight
    if (paragraphText && highlightText && paragraphText.includes(highlightText)) {
      const parts = paragraphText.split(highlightText);
      excerptCard.appendChild(document.createTextNode(parts[0]!));
      const mark = document.createElement('mark');
      mark.style.cssText = `background: ${HIGHLIGHT_BG}; padding: 1px 3px; border-radius: 2px; font-weight: 500;`;
      mark.textContent = highlightText;
      excerptCard.appendChild(mark);
      excerptCard.appendChild(document.createTextNode(parts.slice(1).join(highlightText)));
    } else {
      excerptCard.textContent = paragraphText || highlightText;
    }
    body.appendChild(excerptCard);

    // 4. If new question: show question input
    if (!this.currentTree) {
      const inputSection = document.createElement('div');
      inputSection.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

      const textarea = document.createElement('textarea');
      textarea.placeholder = '想了解这个概念的什么？（可留空直接生成）';
      textarea.style.cssText = `
        width: 100%;
        height: 70px;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 13px;
        resize: none;
        box-sizing: border-box;
      `;

      const submitBtn = document.createElement('button');
      submitBtn.textContent = '生成解释 ✨';
      submitBtn.style.cssText = `
        background: #0084ff;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      `;

      submitBtn.onclick = async () => {
        if (!this.currentArticle?.discipline_slug) {
          alert('该文章尚未关联学科，请先在上方选择学科知识体系！');
          this.showDisciplinePicker = true;
          this.render();
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = '生成中... ⏳';
        try {
          await this.callbacks.onSubmitQuestion(textarea.value.trim());
        } catch (err: any) {
          submitBtn.disabled = false;
          submitBtn.textContent = '重试生成';
          alert(`生成失败: ${err.message}`);
        }
      };

      inputSection.appendChild(textarea);
      inputSection.appendChild(submitBtn);
      body.appendChild(inputSection);
    } else {
      // 5. Existing tree: Render Local Tree Graph + Selected Answer
      this.renderTreeGraph(body);
      this.renderSelectedAnswer(body);
    }

    this.container.appendChild(body);

    // 6. Delete target dropzone bar (hidden by default)
    this.createDeleteBar();
  }

  private renderTreeGraph(parent: HTMLElement) {
    if (!this.currentTree) return;

    const graphContainer = document.createElement('div');
    graphContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px;
      background: #f4f6f8;
      border-radius: 8px;
    `;

    for (const node of this.currentTree.nodes) {
      const nodeEl = document.createElement('div');
      const isSelected = node.id === this.selectedNodeId;

      nodeEl.style.cssText = `
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        user-select: none;
        background: ${isSelected ? '#0084ff' : '#ffffff'};
        color: ${isSelected ? '#ffffff' : '#333333'};
        border: 1px solid ${isSelected ? '#0084ff' : '#dcdfe6'};
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      `;
      nodeEl.textContent = node.title;

      // Click to select
      nodeEl.onclick = () => {
        this.selectedNodeId = node.id;
        this.render();
      };

      // Draggable for deletion
      nodeEl.setAttribute('draggable', 'true');
      nodeEl.ondragstart = (e) => {
        e.dataTransfer?.setData('text/plain', node.id);
        const delBar = this.container.querySelector('.zhihu-explore-delete-bar') as HTMLElement;
        if (delBar) delBar.style.display = 'flex';
      };
      nodeEl.ondragend = () => {
        const delBar = this.container.querySelector('.zhihu-explore-delete-bar') as HTMLElement;
        if (delBar) delBar.style.display = 'none';
      };

      graphContainer.appendChild(nodeEl);
    }

    parent.appendChild(graphContainer);
  }

  private renderSelectedAnswer(parent: HTMLElement) {
    if (!this.currentTree || !this.selectedNodeId) return;
    const node = this.currentTree.nodes.find((n) => n.id === this.selectedNodeId);
    if (!node) return;

    const answerCard = document.createElement('div');
    answerCard.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      background: #ffffff;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-size: 15px; font-weight: 600; color: #121212;';
    title.textContent = node.title;
    answerCard.appendChild(title);

    // Verbatim Quote
    const quote = document.createElement('div');
    quote.style.cssText = `
      font-size: 12px;
      color: #666;
      border-left: 3px solid #ddd;
      padding-left: 8px;
      line-height: 1.5;
    `;
    quote.textContent = `原文引用: ${node.answer_original}`;
    answerCard.appendChild(quote);

    // Agent Explanation
    const extra = document.createElement('div');
    extra.className = 'zhihu-explore-answer-content';
    extra.style.cssText = 'font-size: 13px; line-height: 1.6; color: #222;';
    extra.textContent = node.answer_extra;

    // Support text selection inside answer to ask followups.
    // Only enable followup button when user has actively selected text.
    extra.onmouseup = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 1) {
        this.answerHighlightText = text;
        followupPrompt.style.display = 'block';
        followupPromptText.textContent = `追问选中: 「${text.slice(0, 15)}...」`;
        followupBtn.disabled = false;
        followupBtn.style.opacity = '1';
        followupBtn.style.cursor = 'pointer';
      }
    };
    answerCard.appendChild(extra);

    // Sources (collapsible, safe http/https only)
    if (node.sources && node.sources.length > 0) {
      const sourcesBox = document.createElement('details');
      sourcesBox.style.cssText = 'font-size: 12px; color: #666; cursor: pointer;';
      const summary = document.createElement('summary');
      summary.textContent = `参考来源 (${node.sources.length})`;
      sourcesBox.appendChild(summary);

      const list = document.createElement('ul');
      list.style.cssText = 'margin: 6px 0; padding-left: 18px;';
      for (const s of node.sources) {
        if (!s.url.startsWith('http://') && !s.url.startsWith('https://')) continue;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = s.title;
        a.style.color = '#0084ff';
        li.appendChild(a);
        list.appendChild(li);
      }
      sourcesBox.appendChild(list);
      answerCard.appendChild(sourcesBox);
    }

    // Followup Input Area
    const followupArea = document.createElement('div');
    followupArea.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-top: 8px;';

    const followupPrompt = document.createElement('div');
    followupPrompt.style.cssText = 'font-size: 11px; color: #0084ff; display: none;';
    const followupPromptText = document.createElement('span');
    followupPrompt.appendChild(followupPromptText);
    followupArea.appendChild(followupPrompt);

    const followupInput = document.createElement('input');
    followupInput.type = 'text';
    followupInput.placeholder = '请先在回答中划选文字，再输入追问...';
    followupInput.style.cssText = `
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
    `;

    const followupBtn = document.createElement('button');
    followupBtn.textContent = '追问 ↵';
    // Disabled by default; only enabled after user selects text in the answer.
    // This prevents force-substituting user selection with answer_extra.slice(0, 30).
    followupBtn.disabled = true;
    followupBtn.style.cssText = `
      align-self: flex-end;
      background: #0084ff;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: not-allowed;
      opacity: 0.5;
    `;

    followupBtn.onclick = async () => {
      const q = followupInput.value.trim();
      // Require explicit user selection; never substitute with a text slice.
      if (!this.answerHighlightText) {
        alert('请先在回答中划选文字，再点击追问。');
        return;
      }
      const hl = this.answerHighlightText;
      followupBtn.disabled = true;
      try {
        await this.callbacks.onFollowupQuestion(node.id, hl, q);
        followupInput.value = '';
        this.answerHighlightText = '';
        followupPrompt.style.display = 'none';
        // Re-disable after successful submission until user selects again
        followupBtn.style.opacity = '0.5';
        followupBtn.style.cursor = 'not-allowed';
      } catch (err: any) {
        alert(`追问失败: ${err.message}`);
        followupBtn.disabled = false;
      }
    };

    followupArea.appendChild(followupInput);
    followupArea.appendChild(followupBtn);
    answerCard.appendChild(followupArea);

    parent.appendChild(answerCard);
  }

  private createDeleteBar() {
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

    this.container.appendChild(bar);
  }
}
