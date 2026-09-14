// Local tree visualization component for short-title node graph
// Complies with 插件局部树执行计划 §3.1, §3.2, §5 (LT04, LT05)

import type { LocalTree, LocalNode } from '@zhihu-explore/contracts';
import {
  computeLocalTreeLayout,
  computeVisibleNodeIds,
  type LocalTreeViewState,
  type LocalTreeLayoutResult,
} from '@zhihu-explore/domain';

export interface LocalTreeViewCallbacks {
  onSelectNode: (nodeId: string) => void;
  onToggleSubtree: (nodeId: string) => void;
  onAttachNode?: (nodeId: string, element: HTMLElement) => void;
}

export class LocalTreeView {
  public element: HTMLElement;
  private canvasContainer: HTMLElement;
  private svgLayer: SVGSVGElement;
  private nodesContainer: HTMLElement;
  private nodeMap = new Map<string, HTMLElement>();
  private callbacks: LocalTreeViewCallbacks;

  constructor(callbacks: LocalTreeViewCallbacks) {
    this.callbacks = callbacks;

    this.element = document.createElement('div');
    this.element.className = 'zhihu-explore-tree-wrapper';
    this.element.style.cssText = `
      width: 100%;
      height: 220px;
      min-height: 180px;
      max-height: 360px;
      overflow: auto;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      position: relative;
      user-select: none;
    `;

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.style.cssText = `
      position: relative;
      min-width: 100%;
      min-height: 100%;
    `;
    this.element.appendChild(this.canvasContainer);

    // SVG layer for lines
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
    `;
    this.canvasContainer.appendChild(this.svgLayer);

    // HTML layer for interactive node cards
    this.nodesContainer = document.createElement('div');
    this.nodesContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;
    this.canvasContainer.appendChild(this.nodesContainer);
  }

  /**
   * Renders the hierarchical tree according to layout output.
   * Reuses existing node DOM elements to preserve dblclick and selection state.
   */
  renderTree(tree: LocalTree, viewState: LocalTreeViewState) {
    const visibleIds = computeVisibleNodeIds(tree, viewState);
    const layout = computeLocalTreeLayout(tree, visibleIds);

    // Update canvas and SVG sizes
    const width = Math.max(layout.bounds.width, this.element.clientWidth);
    const height = Math.max(layout.bounds.height, 200);

    this.canvasContainer.style.width = `${width}px`;
    this.canvasContainer.style.height = `${height}px`;
    this.svgLayer.setAttribute('width', `${width}`);
    this.svgLayer.setAttribute('height', `${height}`);

    // 1. Render Edges (SVG polylines)
    this.renderEdges(layout, tree, viewState);

    // 2. Render Node Cards
    this.renderNodeCards(layout, tree, viewState);
  }

  render(tree: LocalTree, viewState: LocalTreeViewState) {
    this.renderTree(tree, viewState);
  }

  private renderEdges(layout: LocalTreeLayoutResult, tree: LocalTree, viewState: LocalTreeViewState) {
    // Clear old edges
    while (this.svgLayer.firstChild) {
      this.svgLayer.removeChild(this.svgLayer.firstChild);
    }

    const activeEdgeKeys = new Set<string>();
    if (viewState.selectedNodeId) {
      const nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));
      let cur: LocalNode | undefined = nodeMap.get(viewState.selectedNodeId);
      while (cur && cur.parent_id !== null) {
        activeEdgeKeys.add(`${cur.parent_id}->${cur.id}`);
        cur = nodeMap.get(cur.parent_id);
      }
    }

    for (const edge of layout.edges) {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      const pointsStr = edge.points.map((p: any) => `${p.x},${p.y}`).join(' ');
      polyline.setAttribute('points', pointsStr);
      polyline.setAttribute('fill', 'none');

      const isActive = activeEdgeKeys.has(`${edge.fromNodeId}->${edge.toNodeId}`);
      polyline.setAttribute('stroke', isActive ? '#1677ff' : '#cbd5e1');
      polyline.setAttribute('stroke-width', isActive ? '2.5' : '1.8');
      polyline.setAttribute('stroke-linecap', 'round');
      polyline.setAttribute('stroke-linejoin', 'round');
      if (isActive) {
        polyline.setAttribute('stroke-dasharray', 'none');
      }
      this.svgLayer.appendChild(polyline);
    }
  }

  private renderNodeCards(layout: LocalTreeLayoutResult, tree: LocalTree, viewState: LocalTreeViewState) {
    const currentVisibleIds = new Set(layout.nodes.map((n: any) => n.nodeId));

    // Detach nodes no longer visible
    for (const [id, el] of this.nodeMap.entries()) {
      if (!currentVisibleIds.has(id)) {
        el.remove();
        this.nodeMap.delete(id);
      }
    }

    const treeNodeMap = new Map(tree.nodes.map((n) => [n.id, n]));

    for (const nodeRect of layout.nodes) {
      const nodeData = treeNodeMap.get(nodeRect.nodeId);
      if (!nodeData) continue;

      let el = this.nodeMap.get(nodeRect.nodeId);
      if (!el) {
        el = this.createNodeElement(nodeData);
        this.nodeMap.set(nodeRect.nodeId, el);
        this.nodesContainer.appendChild(el);
      }

      // Update position and dimensions
      el.style.left = `${nodeRect.x}px`;
      el.style.top = `${nodeRect.y}px`;
      el.style.width = `${nodeRect.width}px`;
      el.style.height = `${nodeRect.height}px`;

      // Update active styling
      const isSelected = viewState.selectedNodeId === nodeRect.nodeId;
      const isSubtreeRoot = viewState.subtreeRootId === nodeRect.nodeId;
      el.classList.toggle('selected', isSelected);

      if (isSelected) {
        el.style.borderColor = '#1677ff';
        el.style.background = '#e6f4ff';
        el.style.boxShadow = '0 0 0 2px rgba(22, 119, 255, 0.2)';
      } else if (isSubtreeRoot) {
        el.style.borderColor = '#52c41a';
        el.style.background = '#f6ffed';
        el.style.boxShadow = '0 0 0 2px rgba(82, 196, 26, 0.2)';
      } else {
        el.style.borderColor = '#e2e8f0';
        el.style.background = '#ffffff';
        el.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
      }

      // Update collapsed count badge
      let badgeEl = el.querySelector('.zhihu-explore-tree-badge') as HTMLElement;
      if (nodeRect.collapsedCount > 0) {
        if (!badgeEl) {
          badgeEl = document.createElement('span');
          badgeEl.className = 'zhihu-explore-tree-badge';
          badgeEl.style.cssText = `
            position: absolute;
            top: -6px;
            right: -6px;
            background: #fa8c16;
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 10px;
            border: 1px solid #ffffff;
          `;
          el.appendChild(badgeEl);
        }
        badgeEl.textContent = `+${nodeRect.collapsedCount}`;
      } else if (badgeEl) {
        badgeEl.remove();
      }
    }
  }

  private createNodeElement(node: LocalNode): HTMLElement {
    const el = document.createElement('div');
    el.className = 'zhihu-explore-tree-node';
    el.setAttribute('data-node-id', node.id);
    el.title = node.title; // Tooltip for full title on hover
    el.style.cssText = `
      position: absolute;
      box-sizing: border-box;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: center;
      transition: border-color 0.15s ease, background-color 0.15s ease;
      pointer-events: auto;
    `;

    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    titleEl.textContent = node.title;
    el.appendChild(titleEl);

    // Event listeners
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onSelectNode(node.id);
    });

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.callbacks.onToggleSubtree(node.id);
    });

    this.callbacks.onAttachNode?.(node.id, el);

    return el;
  }

  destroy() {
    this.nodeMap.clear();
    this.element.remove();
  }
}
