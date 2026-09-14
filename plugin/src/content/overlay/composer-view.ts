// Composer view component for submitting questions and followup queries
// Complies with 插件局部树执行计划 §3.4, §5 (LT04)

import type { ComposerCallbacks } from './view-types.js';

export class ComposerView {
  public element: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private submitBtn: HTMLButtonElement;
  private quotePreview: HTMLElement;
  private isComposing: boolean = false;
  private isLoading: boolean = false;
  private isFollowupMode: boolean = false;
  private hasSelection: boolean = false;
  private callbacks: ComposerCallbacks;

  constructor(callbacks: ComposerCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'zhihu-explore-composer';
    this.element.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: #fafafa;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
    `;

    // 1. Quote preview container
    this.quotePreview = document.createElement('div');
    this.quotePreview.style.cssText = `
      display: none;
      font-size: 12px;
      color: #595959;
      background: #f0f7ff;
      border-left: 3px solid #1677ff;
      padding: 6px 8px;
      border-radius: 0 4px 4px 0;
      word-break: break-all;
    `;
    this.element.appendChild(this.quotePreview);

    // 2. Textarea
    this.textarea = document.createElement('textarea');
    this.textarea.placeholder = '输入针对选区的追问或疑问 (可留空)...';
    this.textarea.style.cssText = `
      width: 100%;
      min-height: 56px;
      resize: vertical;
      padding: 8px 10px;
      border: 1px solid #d9d9d9;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.4;
      box-sizing: border-box;
      outline: none;
      font-family: inherit;
      background: #ffffff;
      color: #121212;
    `;

    // IME composition events
    this.textarea.addEventListener('compositionstart', () => {
      this.isComposing = true;
    });
    this.textarea.addEventListener('compositionend', () => {
      this.isComposing = false;
    });

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (this.isComposing) return;
        e.preventDefault();
        this.handleSubmit();
      }
    });

    this.element.appendChild(this.textarea);

    // 3. Actions Row
    const actionRow = document.createElement('div');
    actionRow.style.cssText = `
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
    `;

    this.submitBtn = document.createElement('button');
    this.submitBtn.textContent = '开启追问';
    this.submitBtn.style.cssText = `
      background: #0084ff;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, opacity 0.15s ease;
    `;
    this.submitBtn.onclick = () => this.handleSubmit();

    actionRow.appendChild(this.submitBtn);
    this.element.appendChild(actionRow);
  }

  updateState(opts: { isFollowupMode: boolean; hasSelection: boolean; quoteText?: string | null }) {
    this.isFollowupMode = opts.isFollowupMode;
    this.hasSelection = opts.hasSelection;
    if (opts.quoteText && opts.quoteText.trim().length > 0) {
      this.quotePreview.style.display = 'block';
      this.quotePreview.textContent = `🎯 已选追问文字: "${opts.quoteText}"`;
    } else {
      this.quotePreview.style.display = 'none';
      this.quotePreview.textContent = '';
    }
    this.syncButtonState();
  }

  private syncButtonState() {
    if (this.isLoading) {
      this.submitBtn.disabled = true;
      this.submitBtn.style.opacity = '0.6';
      this.submitBtn.style.cursor = 'not-allowed';
      this.submitBtn.textContent = '生成中...';
      this.textarea.disabled = true;
      return;
    }

    this.textarea.disabled = false;
    if (this.isFollowupMode) {
      if (this.hasSelection) {
        this.submitBtn.disabled = false;
        this.submitBtn.style.opacity = '1';
        this.submitBtn.style.cursor = 'pointer';
        this.submitBtn.textContent = '针对选区追问';
      } else {
        this.submitBtn.disabled = true;
        this.submitBtn.style.opacity = '0.5';
        this.submitBtn.style.cursor = 'not-allowed';
        this.submitBtn.textContent = '请在回答中划选追问文字';
      }
    } else {
      this.submitBtn.disabled = false;
      this.submitBtn.style.opacity = '1';
      this.submitBtn.style.cursor = 'pointer';
      this.submitBtn.textContent = '开启追问';
    }
  }

  setPendingHighlight(text: string | null) {
    this.updateState({
      isFollowupMode: this.isFollowupMode,
      hasSelection: Boolean(text && text.trim().length > 0),
      quoteText: text,
    });
  }

  setQuote(text: string) {
    this.setPendingHighlight(text);
  }

  clearQuote() {
    this.setPendingHighlight(null);
  }

  setLoading(loading: boolean) {
    this.isLoading = loading;
    this.syncButtonState();
  }

  getText(): string {
    return this.textarea.value;
  }

  setText(val: string) {
    this.textarea.value = val;
  }

  clearText() {
    this.textarea.value = '';
  }

  clearInput() {
    this.clearText();
  }

  focus() {
    this.textarea.focus();
  }

  private async handleSubmit() {
    if (this.isLoading) return;
    if (this.isFollowupMode && !this.hasSelection) return;
    const text = this.textarea.value.trim();
    this.setLoading(true);
    try {
      await this.callbacks.onSubmit(text);
      this.clearText();
    } catch (err) {
      console.error('[ComposerView] Submit failed:', err);
    } finally {
      this.setLoading(false);
    }
  }

  destroy() {
    this.element.remove();
  }
}
