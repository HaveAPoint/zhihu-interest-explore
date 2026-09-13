// Pure global tree layout algorithm (HTML nodes + SVG connectors).
// Root on left, children on right. Non-leaves expanded by default; leaves folded into parent by default.
// No DOM or React dependencies.

import type { UnifiedKnowledgeNode } from './lighting.js';

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 180,
  nodeHeight: 44,
  horizontalSpacing: 80,
  verticalSpacing: 24,
};

export interface LayoutNode {
  id: string;
  parent_id: string | null;
  title: string;
  isLeaf: boolean;
  isPersonal: boolean;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface LayoutConnector {
  fromId: string;
  toId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** SVG bezier path */
  pathData: string;
}

export interface GlobalTreeLayoutResult {
  nodes: LayoutNode[];
  connectors: LayoutConnector[];
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Determines default expansion state:
 * - Non-leaves are expanded by default.
 * - Nodes whose children are all leaves are folded by default.
 */
export function getDefaultExpandedNodeIds(nodes: UnifiedKnowledgeNode[]): Set<string> {
  const childrenMap = new Map<string, string[]>();
  for (const n of nodes) {
    if (!childrenMap.has(n.id)) childrenMap.set(n.id, []);
  }
  for (const n of nodes) {
    if (n.parent_id !== null && childrenMap.has(n.parent_id)) {
      childrenMap.get(n.parent_id)!.push(n.id);
    }
  }

  const expanded = new Set<string>();

  for (const n of nodes) {
    const children = childrenMap.get(n.id) ?? [];
    if (children.length === 0) continue; // leaf

    // Check if node has any non-leaf children
    const hasNonLeafChild = children.some((cid) => (childrenMap.get(cid) ?? []).length > 0);
    if (hasNonLeafChild) {
      expanded.add(n.id);
    }
  }

  return expanded;
}

/**
 * Calculates (x, y) coordinates and SVG connectors for visible nodes.
 *
 * Guarantees:
 * - 根左子右 (Left-to-right hierarchy)
 * - Non-overlapping layout when multiple leaf groups are expanded
 * - Deterministic output
 */
export function calculateGlobalLayout(
  nodes: UnifiedKnowledgeNode[],
  expandedNodeIds: Set<string>,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): GlobalTreeLayoutResult {
  const nodeMap = new Map<string, UnifiedKnowledgeNode>();
  const childrenMap = new Map<string, string[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, n);
    childrenMap.set(n.id, []);
  }

  let rootId: string | null = null;
  for (const n of nodes) {
    if (n.parent_id === null) {
      rootId = n.id;
    } else if (childrenMap.has(n.parent_id)) {
      childrenMap.get(n.parent_id)!.push(n.id);
    }
  }

  if (!rootId && nodes.length > 0) {
    rootId = nodes[0]!.id;
  }

  // Sort children by sort_order or id
  for (const [, children] of childrenMap) {
    children.sort((a, b) => {
      const nodeA = nodeMap.get(a)!;
      const nodeB = nodeMap.get(b)!;
      const sortA = nodeA.sort_order ?? 0;
      const sortB = nodeB.sort_order ?? 0;
      if (sortA !== sortB) return sortA - sortB;
      return a.localeCompare(b);
    });
  }

  // 1. Determine visibility
  const isVisible = new Set<string>();

  function markVisibility(nodeId: string, parentExpanded: boolean) {
    if (parentExpanded) {
      isVisible.add(nodeId);
      const isExpanded = expandedNodeIds.has(nodeId);
      const children = childrenMap.get(nodeId) ?? [];
      for (const childId of children) {
        markVisibility(childId, isExpanded);
      }
    }
  }

  if (rootId) {
    markVisibility(rootId, true);
  }

  // 2. Tree Layout coordinate calculation (tidy horizontal tree)
  // Track depth for X calculation
  const depths = new Map<string, number>();
  function computeDepths(nodeId: string, depth: number) {
    depths.set(nodeId, depth);
    const children = childrenMap.get(nodeId) ?? [];
    for (const childId of children) {
      computeDepths(childId, depth + 1);
    }
  }
  if (rootId) computeDepths(rootId, 0);

  // Layout positions: nodeId -> { x, y }
  const positions = new Map<string, { x: number; y: number }>();
  let currentY = 0;

  /**
   * Post-order traversal to allocate vertical Y space without collision.
   * Returns the center Y of this subtree.
   */
  function layoutSubtree(nodeId: string): number {
    const visibleChildren = (childrenMap.get(nodeId) ?? []).filter((id) => isVisible.has(id));

    if (visibleChildren.length === 0) {
      // Leaf in current visible view
      const y = currentY;
      currentY += config.nodeHeight + config.verticalSpacing;
      const depth = depths.get(nodeId) ?? 0;
      const x = depth * (config.nodeWidth + config.horizontalSpacing);
      positions.set(nodeId, { x, y });
      return y + config.nodeHeight / 2;
    }

    const childCenterYs: number[] = [];
    for (const childId of visibleChildren) {
      childCenterYs.push(layoutSubtree(childId));
    }

    const firstCenterY = childCenterYs[0]!;
    const lastCenterY = childCenterYs[childCenterYs.length - 1]!;
    const centerY = (firstCenterY + lastCenterY) / 2;
    const y = centerY - config.nodeHeight / 2;

    const depth = depths.get(nodeId) ?? 0;
    const x = depth * (config.nodeWidth + config.horizontalSpacing);
    positions.set(nodeId, { x, y });

    return centerY;
  }

  if (rootId && isVisible.has(rootId)) {
    layoutSubtree(rootId);
  }

  // 3. Assemble LayoutNode list
  const layoutNodes: LayoutNode[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const visible = isVisible.has(n.id);
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    const children = childrenMap.get(n.id) ?? [];
    const isLeafNode = children.length === 0;

    if (visible) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + config.nodeWidth);
      maxY = Math.max(maxY, pos.y + config.nodeHeight);
    }

    layoutNodes.push({
      id: n.id,
      parent_id: n.parent_id,
      title: n.title,
      isLeaf: isLeafNode,
      isPersonal: !!n.is_personal,
      depth: depths.get(n.id) ?? 0,
      x: pos.x,
      y: pos.y,
      width: config.nodeWidth,
      height: config.nodeHeight,
      visible,
    });
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  // 4. Generate SVG Connectors for visible parent-child pairs
  const connectors: LayoutConnector[] = [];

  for (const node of layoutNodes) {
    if (!node.visible || node.parent_id === null) continue;
    const parentNode = layoutNodes.find((p) => p.id === node.parent_id);
    if (!parentNode || !parentNode.visible) continue;

    const startX = parentNode.x + parentNode.width;
    const startY = parentNode.y + parentNode.height / 2;
    const endX = node.x;
    const endY = node.y + node.height / 2;

    const dx = (endX - startX) / 2;
    const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

    connectors.push({
      fromId: parentNode.id,
      toId: node.id,
      startX,
      startY,
      endX,
      endY,
      pathData,
    });
  }

  return {
    nodes: layoutNodes,
    connectors,
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}
