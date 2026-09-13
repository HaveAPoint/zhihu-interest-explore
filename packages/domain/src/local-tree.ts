// Pure functions for LocalTree validation and subtree operations
// Complies with 作者本人开发计划 §4.1, §4.5, T07

import type { LocalTree, LocalNode } from '@zhihu-explore/contracts';

export type TreeValidationError =
  | 'NO_ROOT'
  | 'MULTIPLE_ROOTS'
  | 'ROOT_ID_MISMATCH'
  | 'ROOT_HIGHLIGHT_MISMATCH'
  | 'TREE_ID_MISMATCH'
  | 'MISSING_PARENT'
  | 'SELF_PARENT'
  | 'CYCLE'
  | 'DUPLICATE_NODE_ID';

export interface TreeValidationResult {
  ok: boolean;
  errors: Array<{ code: TreeValidationError; message: string; nodeId?: string }>;
}

/**
 * Validates a LocalTree:
 * 1. Exactly one root node (parent_id === null).
 * 2. Root node id must equal tree.root_node_id.
 * 3. Root highlight equals tree.anchor_highlight.
 * 4. All non-root parent_id exist in tree.nodes.
 * 5. No node is its own parent, no cycles.
 * 6. All nodes have tree_id === tree.id.
 * 7. No duplicate node IDs.
 */
export function validateLocalTree(tree: LocalTree): TreeValidationResult {
  const errors: Array<{ code: TreeValidationError; message: string; nodeId?: string }> = [];
  const nodeMap = new Map<string, LocalNode>();

  for (const node of tree.nodes) {
    if (nodeMap.has(node.id)) {
      errors.push({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node id "${node.id}"`,
        nodeId: node.id,
      });
    }
    nodeMap.set(node.id, node);

    if (node.tree_id !== tree.id) {
      errors.push({
        code: 'TREE_ID_MISMATCH',
        message: `Node "${node.id}" tree_id "${node.tree_id}" does not match tree.id "${tree.id}"`,
        nodeId: node.id,
      });
    }
  }

  const roots = tree.nodes.filter((n) => n.parent_id === null);
  if (roots.length === 0) {
    errors.push({
      code: 'NO_ROOT',
      message: 'Tree has no root node (parent_id null)',
    });
  } else if (roots.length > 1) {
    errors.push({
      code: 'MULTIPLE_ROOTS',
      message: `Tree must have exactly one root, found ${roots.length}`,
    });
  }

  const root = roots[0];
  if (root) {
    if (root.id !== tree.root_node_id) {
      errors.push({
        code: 'ROOT_ID_MISMATCH',
        message: `Root node id "${root.id}" does not match tree.root_node_id "${tree.root_node_id}"`,
        nodeId: root.id,
      });
    }

    if (root.highlight_text !== tree.anchor_highlight) {
      errors.push({
        code: 'ROOT_HIGHLIGHT_MISMATCH',
        message: 'Root highlight does not equal anchor_highlight',
        nodeId: root.id,
      });
    }
  }

  // Parent existence and self-parent checks
  for (const node of tree.nodes) {
    if (node.parent_id === null) continue;
    if (node.parent_id === node.id) {
      errors.push({
        code: 'SELF_PARENT',
        message: `Node "${node.id}" is its own parent`,
        nodeId: node.id,
      });
      continue;
    }
    if (!nodeMap.has(node.parent_id)) {
      errors.push({
        code: 'MISSING_PARENT',
        message: `Node "${node.id}" references missing parent "${node.parent_id}"`,
        nodeId: node.id,
      });
    }
  }

  // Cycle detection
  const seenGlobal = new Set<string>();
  for (const start of tree.nodes) {
    if (seenGlobal.has(start.id)) continue;
    const pathSeen = new Set<string>();
    let cur: LocalNode | undefined = start;
    while (cur) {
      if (pathSeen.has(cur.id)) {
        errors.push({
          code: 'CYCLE',
          message: `Cycle detected involving node "${cur.id}"`,
          nodeId: cur.id,
        });
        break;
      }
      if (seenGlobal.has(cur.id)) break;
      pathSeen.add(cur.id);
      cur = cur.parent_id !== null ? nodeMap.get(cur.parent_id) : undefined;
    }
    for (const id of pathSeen) seenGlobal.add(id);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Calculates the set of all node IDs in the subtree rooted at targetNodeId,
 * including targetNodeId itself and all its recursive descendants.
 */
export function calculateSubtreeNodeIds(nodes: LocalNode[], targetNodeId: string): Set<string> {
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (!childrenMap.has(node.id)) childrenMap.set(node.id, []);
    if (node.parent_id !== null) {
      if (!childrenMap.has(node.parent_id)) childrenMap.set(node.parent_id, []);
      childrenMap.get(node.parent_id)!.push(node.id);
    }
  }

  const result = new Set<string>();

  function collect(id: string) {
    result.add(id);
    const children = childrenMap.get(id) ?? [];
    for (const childId of children) {
      collect(childId);
    }
  }

  collect(targetNodeId);
  return result;
}

/**
 * Removes a subtree rooted at targetNodeId:
 * - If targetNodeId is the root node: returns null (deleting root is deleting tree).
 * - Otherwise: returns a new LocalTree with target and its descendants removed, version + 1.
 */
export function removeSubtree(tree: LocalTree, targetNodeId: string): LocalTree | null {
  if (targetNodeId === tree.root_node_id) {
    return null;
  }

  const toRemove = calculateSubtreeNodeIds(tree.nodes, targetNodeId);
  const remainingNodes = tree.nodes.filter((n) => !toRemove.has(n.id));

  return {
    ...tree,
    version: tree.version + 1,
    nodes: remainingNodes,
    updated_at: new Date().toISOString(),
  };
}
