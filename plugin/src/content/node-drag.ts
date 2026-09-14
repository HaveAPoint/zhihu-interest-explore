// Long-press and drag-to-delete gesture manager for local tree nodes
// Complies with 插件局部树执行计划 §3.6, §5 (LT09)

export interface NodeDragCallbacks {
  onDragStart: (nodeId: string, element: HTMLElement) => void;
  onDragMove: (nodeId: string, clientX: number, clientY: number) => void;
  onDragEnd: (nodeId: string, droppedOnDeleteBar: boolean) => void;
}

export class NodeDragManager {
  private deleteBar: HTMLElement;
  private callbacks: NodeDragCallbacks;
  private activeTimer: number | null = null;
  private startPos: { x: number; y: number } | null = null;
  private draggingNodeId: string | null = null;
  private draggingEl: HTMLElement | null = null;
  private ghostEl: HTMLElement | null = null;
  private isDragging: boolean = false;
  private suppressNextClick: boolean = false;

  private boundOnWindowPointerMove: (e: PointerEvent) => void;
  private boundOnWindowPointerUp: (e: PointerEvent) => void;
  private boundOnWindowPointerCancel: (e: PointerEvent) => void;
  private boundOnWindowKeyDown: (e: KeyboardEvent) => void;
  private boundOnWindowBlur: () => void;

  constructor(deleteBar: HTMLElement, callbacks: NodeDragCallbacks) {
    this.deleteBar = deleteBar;
    this.callbacks = callbacks;

    this.boundOnWindowPointerMove = (e: PointerEvent) => this.handleWindowPointerMove(e);
    this.boundOnWindowPointerUp = (e: PointerEvent) => this.handleWindowPointerUp(e);
    this.boundOnWindowPointerCancel = (_e: PointerEvent) => this.cancelDrag();
    this.boundOnWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cancelDrag();
      }
    };
    this.boundOnWindowBlur = () => this.cancelDrag();

    window.addEventListener('pointermove', this.boundOnWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', this.boundOnWindowPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.boundOnWindowPointerCancel, { passive: true });
    window.addEventListener('keydown', this.boundOnWindowKeyDown);
    window.addEventListener('blur', this.boundOnWindowBlur);
  }

  attachNode(nodeId: string, element: HTMLElement) {
    const onPointerDown = (e: PointerEvent) => {
      // Only main mouse button (button === 0) (§3.6)
      if (e.button !== 0) return;

      this.startPos = { x: e.clientX, y: e.clientY };
      this.draggingNodeId = nodeId;
      this.draggingEl = element;
      this.isDragging = false;

      this.activeTimer = window.setTimeout(() => {
        this.startDrag(nodeId, element, e);
      }, 400); // 400ms long press threshold (§3.6)
    };

    const onClickCapture = (e: MouseEvent) => {
      if (this.suppressNextClick) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this.suppressNextClick = false;
      }
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('click', onClickCapture, true);
  }

  private handleWindowPointerMove(e: PointerEvent) {
    if (this.startPos && !this.isDragging) {
      const dist = Math.hypot(e.clientX - this.startPos.x, e.clientY - this.startPos.y);
      // Cancel long press if moved > 6px before 400ms (§3.6)
      if (dist > 6) {
        this.cancelTimer();
        this.startPos = null;
      }
    } else if (this.isDragging && this.draggingNodeId) {
      // Move visual drag ghost with cursor
      if (this.ghostEl) {
        this.ghostEl.style.left = `${e.clientX}px`;
        this.ghostEl.style.top = `${e.clientY}px`;
      }
      this.callbacks.onDragMove(this.draggingNodeId, e.clientX, e.clientY);
      this.checkDeleteBarHover(e.clientX, e.clientY);
    }
  }

  private handleWindowPointerUp(e: PointerEvent) {
    this.cancelTimer();
    if (this.isDragging && this.draggingNodeId) {
      this.finishDrag(this.draggingNodeId, e.clientX, e.clientY);
    }
    this.startPos = null;
  }

  private startDrag(nodeId: string, element: HTMLElement, e: PointerEvent) {
    this.isDragging = true;
    this.suppressNextClick = true;

    try {
      element.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture might fail if already released
    }

    // Source card styling during drag
    element.style.transform = 'scale(1.04)';
    element.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.25)';
    element.style.opacity = '0.7';
    element.style.zIndex = '999';

    // Create visual floating drag ghost following pointer (§3.6)
    this.ghostEl = document.createElement('div');
    this.ghostEl.className = 'zhihu-explore-drag-ghost';
    this.ghostEl.textContent = element.querySelector('div')?.textContent || element.textContent || '节点';
    this.ghostEl.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      background: #ffffff;
      border: 2px dashed #ff4d4f;
      color: #ff4d4f;
      font-weight: 600;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(255, 77, 79, 0.3);
      transform: translate(-50%, -50%);
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    document.body.appendChild(this.ghostEl);

    // Show delete bar at drawer bottom
    this.deleteBar.style.display = 'flex';
    this.callbacks.onDragStart(nodeId, element);
  }

  private checkDeleteBarHover(clientX: number, clientY: number) {
    const rect = this.deleteBar.getBoundingClientRect();
    const isInside = (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
    if (isInside) {
      this.deleteBar.style.background = '#d9363e';
      this.deleteBar.style.transform = 'scale(1.02)';
    } else {
      this.deleteBar.style.background = '#ff4d4f';
      this.deleteBar.style.transform = 'scale(1)';
    }
  }

  private finishDrag(nodeId: string, clientX: number, clientY: number) {
    const rect = this.deleteBar.getBoundingClientRect();
    const droppedOnBar = (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );

    this.callbacks.onDragEnd(nodeId, droppedOnBar);
    this.cleanupDragState();
  }

  /**
   * Cancels active drag or pending timer immediately.
   * Invoked on Esc key, window blur, pointercancel, or drawer close.
   */
  cancelDrag() {
    this.cancelTimer();
    if (this.isDragging && this.draggingNodeId) {
      this.callbacks.onDragEnd(this.draggingNodeId, false);
    }
    this.cleanupDragState();
  }

  private cleanupDragState() {
    this.isDragging = false;
    if (this.draggingEl) {
      this.draggingEl.style.transform = '';
      this.draggingEl.style.boxShadow = '';
      this.draggingEl.style.opacity = '';
      this.draggingEl.style.zIndex = '';
    }
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }
    this.draggingEl = null;
    this.draggingNodeId = null;
    this.startPos = null;
    this.deleteBar.style.display = 'none';
    this.deleteBar.style.background = '#ff4d4f';
    this.deleteBar.style.transform = 'scale(1)';
  }

  private cancelTimer() {
    if (this.activeTimer !== null) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
  }

  destroy() {
    this.cancelDrag();
    window.removeEventListener('pointermove', this.boundOnWindowPointerMove);
    window.removeEventListener('pointerup', this.boundOnWindowPointerUp);
    window.removeEventListener('pointercancel', this.boundOnWindowPointerCancel);
    window.removeEventListener('keydown', this.boundOnWindowKeyDown);
    window.removeEventListener('blur', this.boundOnWindowBlur);
  }
}
