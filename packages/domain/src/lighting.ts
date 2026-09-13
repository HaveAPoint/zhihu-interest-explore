// Pure lighting and subtree statistics calculation for global knowledge tree.
// No DOM or React dependencies.

export interface UnifiedKnowledgeNode {
  id: string;
  parent_id: string | null;
  title: string;
  definition?: string;
  is_personal?: boolean;
  sort_order?: number;
}

export interface NodeLightingState {
  id: string;
  isDirectLit: boolean;
  isGold: boolean;
  /** Number of lit nodes in this subtree including self */
  n: number;
  /** Total number of nodes in this subtree including self */
  N: number;
  /** Subtree lit ratio: n / N */
  ratio: number;
}

export interface LightingCalculationResult {
  states: Map<string, NodeLightingState>;
  /** Direct children lookup */
  childrenMap: Map<string, string[]>;
}

/**
 * Computes direct lit, gold tag, and subtree n/N statistics.
 *
 * Rules:
 * 1. 父亮子不继承: Children do not inherit lit state from parent.
 * 2. 叶亮即有小金 tag: A leaf node is gold iff it is direct lit.
 * 3. 子全亮但父不亮不 gold: A non-leaf whose children are all lit is NOT gold if parent itself is unlit.
 * 4. 父和所有直接子亮则 gold: A non-leaf is gold iff parent is lit and all direct children are lit.
 * 5. n/N 包含自身: Subtree count includes the node itself.
 * 6. 新增个人节点参与自己所在子树统计: Personal nodes participate in subtree n and N.
 */
export function calculateLighting(
  nodes: UnifiedKnowledgeNode[],
  directLitNodeIds: Set<string>,
): LightingCalculationResult {
  const childrenMap = new Map<string, string[]>();
  const nodeMap = new Map<string, UnifiedKnowledgeNode>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    if (!childrenMap.has(node.id)) {
      childrenMap.set(node.id, []);
    }
  }

  for (const node of nodes) {
    if (node.parent_id !== null && nodeMap.has(node.parent_id)) {
      const list = childrenMap.get(node.parent_id);
      if (list) {
        list.push(node.id);
      }
    }
  }

  const states = new Map<string, NodeLightingState>();

  // Post-order traversal / recursive aggregation
  function compute(nodeId: string): NodeLightingState {
    const cached = states.get(nodeId);
    if (cached) return cached;

    const isDirectLit = directLitNodeIds.has(nodeId);
    const childrenIds = childrenMap.get(nodeId) ?? [];

    let totalNodes = 1;
    let litNodes = isDirectLit ? 1 : 0;

    let allDirectChildrenLit = true;

    for (const childId of childrenIds) {
      const childState = compute(childId);
      totalNodes += childState.N;
      litNodes += childState.n;

      if (!childState.isDirectLit) {
        allDirectChildrenLit = false;
      }
    }

    let isGold: boolean;
    if (childrenIds.length === 0) {
      // Leaf node: 叶亮即有小金 tag
      isGold = isDirectLit;
    } else {
      // Non-leaf node: 父和所有直接子亮则 gold；子全亮但父不亮不 gold
      isGold = isDirectLit && allDirectChildrenLit;
    }

    const state: NodeLightingState = {
      id: nodeId,
      isDirectLit,
      isGold,
      n: litNodes,
      N: totalNodes,
      ratio: totalNodes > 0 ? litNodes / totalNodes : 0,
    };

    states.set(nodeId, state);
    return state;
  }

  for (const node of nodes) {
    compute(node.id);
  }

  return { states, childrenMap };
}
