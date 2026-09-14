// Pure hierarchical tree layout functions for Local Followup Tree
// Complies with 插件局部树执行计划 §3.1, §5 (LT03)

import type { LocalTree } from '@zhihu-explore/contracts';
import { getChildrenMap, computeCollapsedCount } from './local-view-state.js';

export interface Point {
  x: number;
  y: number;
}

export interface NodeRect {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  collapsedCount: number;
}

export interface EdgePolyline {
  fromNodeId: string;
  toNodeId: string;
  points: Point[];
}

export interface LocalLayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalGap: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  customNodeSizes?: Map<string, { width: number; height: number }>;
}

export const defaultLayoutOptions: LocalLayoutOptions = {
  nodeWidth: 140,
  nodeHeight: 48,
  horizontalGap: 48,
  verticalGap: 16,
  padding: {
    top: 24,
    right: 32,
    bottom: 24,
    left: 24,
  },
};

export interface LocalTreeLayoutResult {
  nodes: NodeRect[];
  nodeMap: Map<string, NodeRect>;
  edges: EdgePolyline[];
  bounds: {
    width: number;
    height: number;
  };
}

interface SubtreeMetric {
  nodeId: string;
  width: number;
  height: number;
  subtreeHeight: number;
  children: SubtreeMetric[];
}

/**
 * Pure function: Computes deterministic 2D coordinates for visible nodes and connecting lines.
 * Orientation: Root on left, children on right, siblings stacked vertically.
 * Parent is vertically centered relative to its direct visible children span.
 */
export function computeLocalTreeLayout(
  tree: LocalTree,
  visibleNodeIds: Set<string>,
  customOptions?: Partial<LocalLayoutOptions>,
): LocalTreeLayoutResult {
  const options: LocalLayoutOptions = {
    ...defaultLayoutOptions,
    ...customOptions,
    padding: {
      ...defaultLayoutOptions.padding,
      ...customOptions?.padding,
    },
  };

  const childrenMap = getChildrenMap(tree.nodes);

  function getNodeSize(id: string): { width: number; height: number } {
    if (options.customNodeSizes?.has(id)) {
      return options.customNodeSizes.get(id)!;
    }
    return { width: options.nodeWidth, height: options.nodeHeight };
  }

  // Step 1: Bottom-up measurement of subtree heights
  function measureSubtree(nodeId: string): SubtreeMetric {
    const size = getNodeSize(nodeId);
    const rawChildren = childrenMap.get(nodeId) ?? [];
    // Only layout visible children
    const visibleChildren = rawChildren.filter((c) => visibleNodeIds.has(c.id));

    if (visibleChildren.length === 0) {
      return {
        nodeId,
        width: size.width,
        height: size.height,
        subtreeHeight: size.height,
        children: [],
      };
    }

    const childMetrics = visibleChildren.map((c) => measureSubtree(c.id));
    const totalChildrenHeight =
      childMetrics.reduce((sum, cm) => sum + cm.subtreeHeight, 0) +
      (childMetrics.length - 1) * options.verticalGap;

    const subtreeHeight = Math.max(size.height, totalChildrenHeight);

    return {
      nodeId,
      width: size.width,
      height: size.height,
      subtreeHeight,
      children: childMetrics,
    };
  }

  if (!visibleNodeIds.has(tree.root_node_id)) {
    return {
      nodes: [],
      nodeMap: new Map(),
      edges: [],
      bounds: { width: 0, height: 0 },
    };
  }

  const rootMetric = measureSubtree(tree.root_node_id);

  // Step 2: Top-down coordinate assignment
  const nodeRects: NodeRect[] = [];
  const nodeMap = new Map<string, NodeRect>();

  function assignPositions(metric: SubtreeMetric, depth: number, startY: number) {
    const x = options.padding.left + depth * (options.nodeWidth + options.horizontalGap);

    let y: number;
    if (metric.children.length === 0) {
      // Leaf in current visible tree: center in available vertical slot
      y = startY + (metric.subtreeHeight - metric.height) / 2;
    } else {
      // First assign children positions
      let curChildY = startY;
      const childCenterYs: number[] = [];

      for (const childMetric of metric.children) {
        assignPositions(childMetric, depth + 1, curChildY);
        const childRect = nodeMap.get(childMetric.nodeId)!;
        childCenterYs.push(childRect.y + childRect.height / 2);
        curChildY += childMetric.subtreeHeight + options.verticalGap;
      }

      // Parent center aligns with span of direct children centers
      const firstChildCenter = childCenterYs[0]!;
      const lastChildCenter = childCenterYs[childCenterYs.length - 1]!;
      const childrenCenter = (firstChildCenter + lastChildCenter) / 2;
      y = childrenCenter - metric.height / 2;
    }

    const collapsedCount = computeCollapsedCount(metric.nodeId, tree, visibleNodeIds);

    const rect: NodeRect = {
      nodeId: metric.nodeId,
      x,
      y,
      width: metric.width,
      height: metric.height,
      depth,
      collapsedCount,
    };

    nodeRects.push(rect);
    nodeMap.set(metric.nodeId, rect);
  }

  assignPositions(rootMetric, 0, options.padding.top);

  // Step 3: Compute orthogonal edge polylines
  const edges: EdgePolyline[] = [];

  for (const parent of nodeRects) {
    const rawChildren = childrenMap.get(parent.nodeId) ?? [];
    const visibleChildren = rawChildren.filter((c) => visibleNodeIds.has(c.id));

    for (const child of visibleChildren) {
      const childRect = nodeMap.get(child.id);
      if (!childRect) continue;

      const startX = parent.x + parent.width;
      const startY = parent.y + parent.height / 2;
      const endX = childRect.x;
      const endY = childRect.y + childRect.height / 2;

      let points: Point[];
      if (Math.abs(startY - endY) < 1) {
        // Straight horizontal line
        points = [
          { x: startX, y: startY },
          { x: endX, y: endY },
        ];
      } else {
        // Orthogonal step line with horizontal midpoint
        const midX = (startX + endX) / 2;
        points = [
          { x: startX, y: startY },
          { x: midX, y: startY },
          { x: midX, y: endY },
          { x: endX, y: endY },
        ];
      }

      edges.push({
        fromNodeId: parent.nodeId,
        toNodeId: child.id,
        points,
      });
    }
  }

  // Step 4: Calculate total canvas bounds
  let maxX = 0;
  let maxY = 0;

  for (const rect of nodeRects) {
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  const bounds = {
    width: maxX + options.padding.right,
    height: maxY + options.padding.bottom,
  };

  return {
    nodes: nodeRects,
    nodeMap,
    edges,
    bounds,
  };
}
