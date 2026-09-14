import { describe, it, expect } from 'vitest';
import {
  createInitialViewState,
  reduceTreeViewState,
  computeVisibleNodeIds,
  computeCollapsedCount,
  getChildrenMap,
} from './local-view-state.js';
import type { LocalTree, LocalNode } from '@zhihu-explore/contracts';

describe('LocalTreeViewState State Machine (§3.2, LT02)', () => {
  const treeId = '550e8400-e29b-41d4-a716-446655440000';
  const nodeAId = '550e8400-e29b-41d4-a716-446655440001';
  const nodeBId = '550e8400-e29b-41d4-a716-446655440002';
  const nodeCId = '550e8400-e29b-41d4-a716-446655440003';
  const nodeDId = '550e8400-e29b-41d4-a716-446655440004';
  const nodeEId = '550e8400-e29b-41d4-a716-446655440005';
  const nodeFId = '550e8400-e29b-41d4-a716-446655440006';

  function createNode(
    id: string,
    parentId: string | null,
    title: string,
    timeOffsetMins: number,
    hl: string = '高亮',
  ): LocalNode {
    return {
      id,
      tree_id: treeId,
      parent_id: parentId,
      highlight_text: hl,
      question_text: `问题 ${title}`,
      title,
      answer_original: `引用 ${title}`,
      answer_extra: `解释 ${title}`,
      sources: [],
      created_at: new Date(Date.parse('2026-09-14T10:00:00.000Z') + timeOffsetMins * 60000).toISOString(),
    };
  }

  // Canonical A/B/C/D/E/F tree (§3.2):
  // A (10:00)
  // ├─ B (10:01)
  // │  ├─ D (10:03)
  // │  └─ F (10:05) <- Latest
  // └─ C (10:02)
  //    └─ E (10:04)
  const canonicalTree: LocalTree = {
    id: treeId,
    root_node_id: nodeAId,
    uid: 'user-001',
    article_id: '550e8400-e29b-41d4-a716-446655440099',
    discipline_slug: 'agent-app-dev',
    global_node_id: 'agent-app-dev/tool-calling',
    match_candidates: [],
    anchor_paragraph: '通过工具调用构建智能体。',
    anchor_highlight: '工具调用',
    version: 1,
    nodes: [
      createNode(nodeAId, null, 'A 根节点', 0, '工具调用'),
      createNode(nodeBId, nodeAId, 'B 结构化参数', 1),
      createNode(nodeCId, nodeAId, 'C 宿主环境', 2),
      createNode(nodeDId, nodeBId, 'D JSON Schema', 3),
      createNode(nodeEId, nodeCId, 'E 沙盒隔离', 4),
      createNode(nodeFId, nodeBId, 'F 必填校验', 5), // Latest
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:05:00.000Z',
  };

  const singleRootTree: LocalTree = {
    ...canonicalTree,
    nodes: [canonicalTree.nodes[0]!],
    updated_at: '2026-09-14T10:00:00.000Z',
  };

  it('Rule 1: OPEN selects the latest created node (F) and sets path mode', () => {
    const initial = createInitialViewState();
    const state = reduceTreeViewState(initial, { type: 'OPEN', tree: canonicalTree });

    expect(state.treeId).toBe(canonicalTree.id);
    expect(state.selectedNodeId).toBe(nodeFId);
    expect(state.answerMode).toBe('path');
    expect(state.subtreeRootId).toBeNull();
  });

  it('Rule 2: OPEN expands only ancestors of focus; direct children of ancestors visible, descendants of others collapsed', () => {
    const initial = createInitialViewState();
    const state = reduceTreeViewState(initial, { type: 'OPEN', tree: canonicalTree });

    // Ancestors of F are A and B
    expect(state.expandedNodeIds).toEqual(new Set([nodeAId, nodeBId]));

    // Visible nodes: A, B, C, D, F. (E is collapsed under C)
    const visibleIds = computeVisibleNodeIds(canonicalTree, state);
    expect(visibleIds).toEqual(new Set([nodeAId, nodeBId, nodeCId, nodeDId, nodeFId]));
    expect(visibleIds.has(nodeEId)).toBe(false);

    // Collapsed counts
    expect(computeCollapsedCount(nodeCId, canonicalTree, visibleIds)).toBe(1); // E is collapsed
    expect(computeCollapsedCount(nodeBId, canonicalTree, visibleIds)).toBe(0);
    expect(computeCollapsedCount(nodeAId, canonicalTree, visibleIds)).toBe(1);
  });

  it('Rule 3: click(X) immediately selects X, opens ancestors, does NOT collapse other expanded nodes', () => {
    const initial = createInitialViewState();
    const state0 = reduceTreeViewState(initial, { type: 'OPEN', tree: canonicalTree });
    // state0 has expanded: { A, B }

    // Click C
    const state1 = reduceTreeViewState(state0, { type: 'SELECT', nodeId: nodeCId }, canonicalTree);
    expect(state1.selectedNodeId).toBe(nodeCId);
    expect(state1.answerMode).toBe('path');
    expect(state1.subtreeRootId).toBeNull();

    // B should remain expanded! (A is ancestor of C, so expanded is still { A, B })
    expect(state1.expandedNodeIds.has(nodeBId)).toBe(true);
    expect(state1.expandedNodeIds.has(nodeAId)).toBe(true);

    const visibleIds = computeVisibleNodeIds(canonicalTree, state1);
    expect(visibleIds.has(nodeDId)).toBe(true);
    expect(visibleIds.has(nodeFId)).toBe(true);
    expect(visibleIds.has(nodeEId)).toBe(false);
  });

  it('Rule 4: dblclick(X) toggles subtree expansion and switches answer mode; leaf dblclick has no side effect', () => {
    const initial = createInitialViewState();
    const state0 = reduceTreeViewState(initial, { type: 'OPEN', tree: canonicalTree });

    // First dblclick C (non-leaf): expands C and switches to subtree mode
    const state1 = reduceTreeViewState(state0, { type: 'TOGGLE_SUBTREE', nodeId: nodeCId }, canonicalTree);
    expect(state1.selectedNodeId).toBe(nodeCId);
    expect(state1.expandedNodeIds.has(nodeCId)).toBe(true);
    expect(state1.answerMode).toBe('subtree');
    expect(state1.subtreeRootId).toBe(nodeCId);

    // E is now visible
    const visible1 = computeVisibleNodeIds(canonicalTree, state1);
    expect(visible1.has(nodeEId)).toBe(true);

    // Second dblclick C: collapses C and switches back to path mode
    const state2 = reduceTreeViewState(state1, { type: 'TOGGLE_SUBTREE', nodeId: nodeCId }, canonicalTree);
    expect(state2.selectedNodeId).toBe(nodeCId);
    expect(state2.expandedNodeIds.has(nodeCId)).toBe(false);
    expect(state2.answerMode).toBe('path');
    expect(state2.subtreeRootId).toBeNull();

    const visible2 = computeVisibleNodeIds(canonicalTree, state2);
    expect(visible2.has(nodeEId)).toBe(false);

    // dblclick leaf node F: selection maintained, no expansion/collapse side effect
    const state3 = reduceTreeViewState(state2, { type: 'TOGGLE_SUBTREE', nodeId: nodeFId }, canonicalTree);
    expect(state3.selectedNodeId).toBe(nodeFId);
    expect(state3.answerMode).toBe('path');
    expect(state3.expandedNodeIds.has(nodeFId)).toBe(false);
  });

  it('Rule 5: NODE_ADDED resets expanded to new node ancestors, collapsing other branches', () => {
    const initial = createInitialViewState();
    const state0 = reduceTreeViewState(initial, { type: 'OPEN', tree: canonicalTree });
    // Initially expanded: { A, B } for node F

    // Simulate adding a new node G under C
    const nodeG = createNode('550e8400-e29b-41d4-a716-446655440007', nodeCId, 'G 新追问', 6);
    const treeWithG: LocalTree = {
      ...canonicalTree,
      nodes: [...canonicalTree.nodes, nodeG],
    };

    const state1 = reduceTreeViewState(state0, { type: 'NODE_ADDED', newNodeId: nodeG.id }, treeWithG);
    expect(state1.selectedNodeId).toBe(nodeG.id);
    expect(state1.answerMode).toBe('path');

    // Ancestors of G are A and C. Branch B is now collapsed!
    expect(state1.expandedNodeIds).toEqual(new Set([nodeAId, nodeCId]));

    const visibleIds = computeVisibleNodeIds(treeWithG, state1);
    expect(visibleIds.has(nodeG.id)).toBe(true);
    expect(visibleIds.has(nodeBId)).toBe(true); // B is direct child of A, so B is visible
    expect(visibleIds.has(nodeDId)).toBe(false); // D is child of B, B is not expanded -> D hidden!
    expect(visibleIds.has(nodeFId)).toBe(false); // F is child of B -> F hidden!
  });

  it('Rule 6: DELETE_APPLIED selects nearest living ancestor, and deleting root resets view state', () => {
    const initial = createInitialViewState();
    const state0 = reduceTreeViewState(initial, { type: 'OPEN', tree: canonicalTree });
    // Focus is F (child of B)

    // Delete B: F and D are also deleted. Nearest living ancestor is A.
    const state1 = reduceTreeViewState(state0, { type: 'DELETE_APPLIED', deletedNodeId: nodeBId }, canonicalTree);
    expect(state1.selectedNodeId).toBe(nodeAId);
    expect(state1.expandedNodeIds.has(nodeBId)).toBe(false);

    // Delete sibling C when focus is F: F remains selected
    const state2 = reduceTreeViewState(state0, { type: 'DELETE_APPLIED', deletedNodeId: nodeCId }, canonicalTree);
    expect(state2.selectedNodeId).toBe(nodeFId);

    // Delete root A: resets view state
    const state3 = reduceTreeViewState(state0, { type: 'DELETE_APPLIED', deletedNodeId: nodeAId }, canonicalTree);
    expect(state3).toEqual(createInitialViewState());
  });

  it('Rule 7: TREE_REPLACED keeps valid selection or backtracks to living ancestor, and prunes invalid expanded IDs', () => {
    const initial = createInitialViewState();
    const state0 = reduceTreeViewState(initial, { type: 'OPEN', tree: canonicalTree });

    // Snapshot where node F and node D were deleted remotely
    const prunedTree: LocalTree = {
      ...canonicalTree,
      version: 2,
      nodes: canonicalTree.nodes.filter((n) => n.id !== nodeFId && n.id !== nodeDId),
    };

    const state1 = reduceTreeViewState(state0, { type: 'TREE_REPLACED', tree: prunedTree }, canonicalTree);
    // Old focus was F. F is gone. Parent B is still alive -> focus falls back to B!
    expect(state1.selectedNodeId).toBe(nodeBId);
    expect(state1.expandedNodeIds.has(nodeAId)).toBe(true);
  });

  it('UI actions never mutate the input tree, version, or node objects', () => {
    const initialVersion = canonicalTree.version;
    const initialNodesCount = canonicalTree.nodes.length;
    const frozenTree = Object.freeze({ ...canonicalTree });

    const s1 = reduceTreeViewState(createInitialViewState(), { type: 'OPEN', tree: frozenTree });
    const s2 = reduceTreeViewState(s1, { type: 'SELECT', nodeId: nodeCId }, frozenTree);
    const s3 = reduceTreeViewState(s2, { type: 'TOGGLE_SUBTREE', nodeId: nodeCId }, frozenTree);
    const s4 = reduceTreeViewState(s3, { type: 'CLOSE' });

    expect(frozenTree.version).toBe(initialVersion);
    expect(frozenTree.nodes.length).toBe(initialNodesCount);
    expect(s4.treeId).toBeNull();
  });

  it('handles single root tree correctly', () => {
    const state = reduceTreeViewState(createInitialViewState(), { type: 'OPEN', tree: singleRootTree });
    expect(state.selectedNodeId).toBe(singleRootTree.root_node_id);
    expect(state.expandedNodeIds.size).toBe(0);

    const visible = computeVisibleNodeIds(singleRootTree, state);
    expect(visible).toEqual(new Set([singleRootTree.root_node_id]));
  });

  it('getChildrenMap sorts children deterministically even if array is shuffled', () => {
    const shuffledNodes = [...canonicalTree.nodes].reverse();
    const map1 = getChildrenMap(canonicalTree.nodes);
    const map2 = getChildrenMap(shuffledNodes);

    const bChildren1 = map1.get(nodeBId)?.map((n) => n.id);
    const bChildren2 = map2.get(nodeBId)?.map((n) => n.id);
    expect(bChildren1).toEqual(bChildren2);
  });
});
