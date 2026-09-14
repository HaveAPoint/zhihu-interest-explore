// Pure domain state machine and visibility functions for Local Followup Tree
// Complies with 插件局部树执行计划 §3.2, §3.3, §5 (LT02)

import type { LocalTree, LocalNode } from '@zhihu-explore/contracts';
import { validateLocalTree, calculateSubtreeNodeIds } from './local-tree.js';

export interface AnswerSelection {
  treeId: string;
  parentNodeId: string;
  exact: string;
  prefix?: string;
  suffix?: string;
  startOffset?: number;
  endOffset?: number;
  containerText?: string;
}

export interface LocalTreeViewState {
  treeId: string | null;
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
  answerMode: 'path' | 'subtree';
  subtreeRootId: string | null;
  pendingSelection: AnswerSelection | null;
  pendingOperation: { requestId: string; treeId: string; parentId: string | null } | null;
}

export type LocalTreeAction =
  | { type: 'OPEN'; tree: LocalTree }
  | { type: 'SELECT'; nodeId: string }
  | { type: 'TOGGLE_SUBTREE'; nodeId: string }
  | { type: 'NODE_ADDED'; newNodeId: string }
  | { type: 'DELETE_APPLIED'; deletedNodeId: string }
  | { type: 'TREE_REPLACED'; tree: LocalTree }
  | { type: 'CLOSE' }
  | { type: 'SET_PENDING_SELECTION'; selection: AnswerSelection | null }
  | { type: 'SET_PENDING_OPERATION'; operation: { requestId: string; treeId: string; parentId: string | null } | null };

/**
 * Creates an empty/initial LocalTreeViewState.
 */
export function createInitialViewState(): LocalTreeViewState {
  return {
    treeId: null,
    selectedNodeId: null,
    expandedNodeIds: new Set<string>(),
    answerMode: 'path',
    subtreeRootId: null,
    pendingSelection: null,
    pendingOperation: null,
  };
}

/**
 * Builds a fast lookup Map for tree nodes.
 */
export function getNodeMap(nodes: readonly LocalNode[]): Map<string, LocalNode> {
  const map = new Map<string, LocalNode>();
  for (const node of nodes) {
    map.set(node.id, node);
  }
  return map;
}

/**
 * Builds a parent -> children Map with stable deterministic sorting:
 * Sorted by created_at ASC, then by id ASC.
 */
export function getChildrenMap(nodes: readonly LocalNode[]): Map<string, LocalNode[]> {
  const map = new Map<string, LocalNode[]>();
  for (const node of nodes) {
    if (!map.has(node.id)) map.set(node.id, []);
    if (node.parent_id !== null) {
      if (!map.has(node.parent_id)) map.set(node.parent_id, []);
      map.get(node.parent_id)!.push(node);
    }
  }

  for (const children of map.values()) {
    children.sort((a, b) => {
      const timeDiff = a.created_at.localeCompare(b.created_at);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
  }

  return map;
}

/**
 * Finds the latest created node in a tree.
 * Tie-breaker: id descending.
 */
export function getLatestNode(nodes: readonly LocalNode[]): LocalNode | null {
  if (nodes.length === 0) return null;
  const sorted = [...nodes].sort((a, b) => {
    const timeDiff = b.created_at.localeCompare(a.created_at);
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
  return sorted[0] ?? null;
}

/**
 * Returns the path from root to the target node (inclusive).
 */
export function getRootPath(nodeId: string, nodeMap: Map<string, LocalNode>): string[] {
  const path: string[] = [];
  let cur: LocalNode | undefined = nodeMap.get(nodeId);
  const seen = new Set<string>();

  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur.id);
    if (cur.parent_id === null) break;
    cur = nodeMap.get(cur.parent_id);
  }

  return path;
}

/**
 * Returns all ancestors of a node, from root down to parent (excludes nodeId itself).
 */
export function getAncestors(nodeId: string, nodeMap: Map<string, LocalNode>): string[] {
  const path = getRootPath(nodeId, nodeMap);
  return path.slice(0, -1);
}

/**
 * Computes the set of currently visible node IDs.
 * Rules (§3.2):
 * - Root node is always visible.
 * - For any visible node X: if X is in expandedNodeIds, all direct children of X are visible.
 */
export function computeVisibleNodeIds(tree: LocalTree, state: LocalTreeViewState): Set<string> {
  const visible = new Set<string>();
  const childrenMap = getChildrenMap(tree.nodes);

  visible.add(tree.root_node_id);
  const queue = [tree.root_node_id];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (state.expandedNodeIds.has(parentId)) {
      const children = childrenMap.get(parentId) ?? [];
      for (const child of children) {
        visible.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return visible;
}

/**
 * Calculates the number of collapsed/hidden descendants for a given node.
 */
export function computeCollapsedCount(nodeId: string, tree: LocalTree, visibleIds: Set<string>): number {
  const allSubtreeIds = calculateSubtreeNodeIds(tree.nodes, nodeId);
  // Subtract 1 for the node itself
  let collapsed = 0;
  for (const id of allSubtreeIds) {
    if (id !== nodeId && !visibleIds.has(id)) {
      collapsed++;
    }
  }
  return collapsed;
}

/**
 * Pure reducer function for LocalTreeViewState.
 * Guarantees zero mutation to input state and input tree.
 */
export function reduceTreeViewState(
  state: LocalTreeViewState,
  action: LocalTreeAction,
  currentTree?: LocalTree | null,
): LocalTreeViewState {
  switch (action.type) {
    case 'OPEN': {
      const tree = action.tree;
      const validation = validateLocalTree(tree);
      if (!validation.ok) {
        throw new Error(`Cannot OPEN invalid tree: ${validation.errors.map((e) => e.message).join('; ')}`);
      }

      const nodeMap = getNodeMap(tree.nodes);
      const latest = getLatestNode(tree.nodes);
      const selectedId = latest ? latest.id : tree.root_node_id;

      // Expand ancestors of the selected node (§3.2 Rule 2)
      const ancestors = getAncestors(selectedId, nodeMap);
      const expanded = new Set<string>(ancestors);

      return {
        treeId: tree.id,
        selectedNodeId: selectedId,
        expandedNodeIds: expanded,
        answerMode: 'path',
        subtreeRootId: null,
        pendingSelection: null,
        pendingOperation: null,
      };
    }

    case 'SELECT': {
      const tree = currentTree;
      if (!tree) return state;

      const nodeMap = getNodeMap(tree.nodes);
      if (!nodeMap.has(action.nodeId)) return state;

      // Add ancestors to ensure selected node is visible (§3.2 Rule 3)
      const ancestors = getAncestors(action.nodeId, nodeMap);
      const expanded = new Set<string>(state.expandedNodeIds);
      for (const ancId of ancestors) {
        expanded.add(ancId);
      }

      return {
        ...state,
        selectedNodeId: action.nodeId,
        expandedNodeIds: expanded,
        answerMode: 'path',
        subtreeRootId: null,
      };
    }

    case 'TOGGLE_SUBTREE': {
      const tree = currentTree;
      if (!tree) return state;

      const nodeMap = getNodeMap(tree.nodes);
      if (!nodeMap.has(action.nodeId)) return state;

      const childrenMap = getChildrenMap(tree.nodes);
      const children = childrenMap.get(action.nodeId) ?? [];

      // Step 1: Ensure ancestors are expanded (§3.2 Rule 4: "先自然执行 click")
      const ancestors = getAncestors(action.nodeId, nodeMap);
      const expanded = new Set<string>(state.expandedNodeIds);
      for (const ancId of ancestors) {
        expanded.add(ancId);
      }

      // Leaf node: double click only maintains selection, no collapse/expand side effect
      if (children.length === 0) {
        return {
          ...state,
          selectedNodeId: action.nodeId,
          expandedNodeIds: expanded,
          answerMode: 'path',
          subtreeRootId: null,
        };
      }

      // Non-leaf node: toggle expansion
      const isCurrentlyExpanded = expanded.has(action.nodeId);
      if (isCurrentlyExpanded) {
        // COLLAPSE: Remove X and all its descendants from expandedNodeIds
        const subtreeIds = calculateSubtreeNodeIds(tree.nodes, action.nodeId);
        for (const subId of subtreeIds) {
          expanded.delete(subId);
        }
        return {
          ...state,
          selectedNodeId: action.nodeId,
          expandedNodeIds: expanded,
          answerMode: 'path',
          subtreeRootId: null,
        };
      } else {
        // EXPAND: Add X and all its non-leaf descendants to expandedNodeIds
        const subtreeIds = calculateSubtreeNodeIds(tree.nodes, action.nodeId);
        for (const subId of subtreeIds) {
          const subChildren = childrenMap.get(subId) ?? [];
          if (subChildren.length > 0) {
            expanded.add(subId);
          }
        }
        return {
          ...state,
          selectedNodeId: action.nodeId,
          expandedNodeIds: expanded,
          answerMode: 'subtree',
          subtreeRootId: action.nodeId,
        };
      }
    }

    case 'NODE_ADDED': {
      const tree = currentTree;
      if (!tree) return state;

      const nodeMap = getNodeMap(tree.nodes);
      if (!nodeMap.has(action.newNodeId)) return state;

      // §3.2 Rule 5: 展开集合重置为新节点祖先，收起其他分支的后续节点
      const ancestors = getAncestors(action.newNodeId, nodeMap);
      const expanded = new Set<string>(ancestors);

      return {
        ...state,
        selectedNodeId: action.newNodeId,
        expandedNodeIds: expanded,
        answerMode: 'path',
        subtreeRootId: null,
        pendingSelection: null,
      };
    }

    case 'DELETE_APPLIED': {
      const tree = currentTree;
      if (!tree) return state;

      // Deleting root node clears everything and closes overlay (§3.2 Rule 6)
      if (action.deletedNodeId === tree.root_node_id) {
        return createInitialViewState();
      }

      const deletedSubtreeIds = calculateSubtreeNodeIds(tree.nodes, action.deletedNodeId);
      const expanded = new Set<string>();
      for (const expId of state.expandedNodeIds) {
        if (!deletedSubtreeIds.has(expId)) {
          expanded.add(expId);
        }
      }

      let nextSelectedId = state.selectedNodeId;
      if (state.selectedNodeId && deletedSubtreeIds.has(state.selectedNodeId)) {
        // Selected node or its ancestor was deleted: find nearest surviving ancestor
        const nodeMap = getNodeMap(tree.nodes);
        const ancestors = getAncestors(state.selectedNodeId, nodeMap);
        // Search backwards from direct parent up to root
        let nearestLiving: string | null = null;
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const ancId = ancestors[i]!;
          if (!deletedSubtreeIds.has(ancId)) {
            nearestLiving = ancId;
            break;
          }
        }
        nextSelectedId = nearestLiving ?? tree.root_node_id;
      }

      let answerMode = state.answerMode;
      let subtreeRootId = state.subtreeRootId;
      if (subtreeRootId && deletedSubtreeIds.has(subtreeRootId)) {
        answerMode = 'path';
        subtreeRootId = null;
      }

      return {
        ...state,
        selectedNodeId: nextSelectedId,
        expandedNodeIds: expanded,
        answerMode,
        subtreeRootId,
        pendingSelection: null,
      };
    }

    case 'TREE_REPLACED': {
      const tree = action.tree;
      const validation = validateLocalTree(tree);
      if (!validation.ok) {
        throw new Error(`Cannot replace with invalid tree: ${validation.errors.map((e) => e.message).join('; ')}`);
      }

      const nodeMap = getNodeMap(tree.nodes);
      let nextSelectedId = state.selectedNodeId;

      // §3.2 Rule 7: 选择仍存在就保留；不存在时按旧父链找到最近存活祖先
      if (state.selectedNodeId && !nodeMap.has(state.selectedNodeId)) {
        if (currentTree) {
          const oldNodeMap = getNodeMap(currentTree.nodes);
          const oldAncestors = getAncestors(state.selectedNodeId, oldNodeMap);
          let found: string | null = null;
          for (let i = oldAncestors.length - 1; i >= 0; i--) {
            const ancId = oldAncestors[i]!;
            if (nodeMap.has(ancId)) {
              found = ancId;
              break;
            }
          }
          nextSelectedId = found ?? tree.root_node_id;
        } else {
          nextSelectedId = tree.root_node_id;
        }
      } else if (!state.selectedNodeId) {
        const latest = getLatestNode(tree.nodes);
        nextSelectedId = latest ? latest.id : tree.root_node_id;
      }

      // Prune invalid expanded IDs
      const expanded = new Set<string>();
      for (const expId of state.expandedNodeIds) {
        if (nodeMap.has(expId)) {
          expanded.add(expId);
        }
      }

      // Ensure ancestors of nextSelectedId are expanded
      if (nextSelectedId) {
        const ancestors = getAncestors(nextSelectedId, nodeMap);
        for (const anc of ancestors) {
          expanded.add(anc);
        }
      }

      let answerMode = state.answerMode;
      let subtreeRootId = state.subtreeRootId;
      if (subtreeRootId && !nodeMap.has(subtreeRootId)) {
        answerMode = 'path';
        subtreeRootId = null;
      }

      return {
        ...state,
        treeId: tree.id,
        selectedNodeId: nextSelectedId,
        expandedNodeIds: expanded,
        answerMode,
        subtreeRootId,
        pendingSelection: null,
      };
    }

    case 'CLOSE':
      return createInitialViewState();

    case 'SET_PENDING_SELECTION':
      return {
        ...state,
        pendingSelection: action.selection,
      };

    case 'SET_PENDING_OPERATION':
      return {
        ...state,
        pendingOperation: action.operation,
      };

    default:
      return state;
  }
}
