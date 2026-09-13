import { describe, it, expect } from 'vitest';
import {
  validateLocalTree,
  calculateSubtreeNodeIds,
  removeSubtree,
} from './local-tree.js';
import type { LocalTree, LocalNode } from '@zhihu-explore/contracts';

describe('T07: LocalTree pure validation and subtree deletion', () => {
  const treeId = '550e8400-e29b-41d4-a716-446655440000';
  const rootId = '550e8400-e29b-41d4-a716-446655440001';
  const nodeBId = '550e8400-e29b-41d4-a716-446655440002';
  const nodeCId = '550e8400-e29b-41d4-a716-446655440003';
  const nodeDId = '550e8400-e29b-41d4-a716-446655440004';

  function createNode(id: string, parentId: string | null, title: string, hl: string = 'hl'): LocalNode {
    return {
      id,
      tree_id: treeId,
      parent_id: parentId,
      highlight_text: hl,
      question_text: '',
      title,
      answer_original: 'orig',
      answer_extra: 'extra',
      sources: [],
      created_at: '2026-09-13T10:00:00.000Z',
    };
  }

  const validTree: LocalTree = {
    id: treeId,
    root_node_id: rootId,
    uid: 'user-1',
    article_id: '550e8400-e29b-41d4-a716-446655440099',
    discipline_slug: 'agent-app-dev',
    global_node_id: 'agent-app-dev/tool-calling',
    match_candidates: [],
    anchor_paragraph: 'anchor paragraph text',
    anchor_highlight: 'anchor highlight text',
    version: 1,
    nodes: [
      createNode(rootId, null, 'Root A', 'anchor highlight text'),
      createNode(nodeBId, rootId, 'Node B'),
      createNode(nodeCId, rootId, 'Node C'),
      createNode(nodeDId, nodeBId, 'Node D'),
    ],
    created_at: '2026-09-13T10:00:00.000Z',
    updated_at: '2026-09-13T10:00:00.000Z',
  };

  it('validates a correct LocalTree', () => {
    const result = validateLocalTree(validTree);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects tree with multiple roots', () => {
    const multiRootTree: LocalTree = {
      ...validTree,
      nodes: [
        ...validTree.nodes,
        createNode('550e8400-e29b-41d4-a716-446655440005', null, 'Second Root'),
      ],
    };
    const result = validateLocalTree(multiRootTree);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'MULTIPLE_ROOTS')).toBe(true);
  });

  it('rejects tree with missing parent', () => {
    const brokenTree: LocalTree = {
      ...validTree,
      nodes: [
        createNode(rootId, null, 'Root A', 'anchor highlight text'),
        createNode(nodeBId, '550e8400-e29b-41d4-a716-446655440999', 'Node B with missing parent'),
      ],
    };
    const result = validateLocalTree(brokenTree);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_PARENT')).toBe(true);
  });

  it('rejects cycle in tree', () => {
    const cycleTree: LocalTree = {
      ...validTree,
      nodes: [
        createNode(rootId, null, 'Root A', 'anchor highlight text'),
        createNode(nodeBId, nodeDId, 'Node B'),
        createNode(nodeDId, nodeBId, 'Node D'),
      ],
    };
    const result = validateLocalTree(cycleTree);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'CYCLE')).toBe(true);
  });

  it('calculateSubtreeNodeIds returns target and all descendants', () => {
    // Under Root A: B & C, under B: D
    // Subtree under B should be { B, D }
    const subtreeB = calculateSubtreeNodeIds(validTree.nodes, nodeBId);
    expect(subtreeB).toEqual(new Set([nodeBId, nodeDId]));

    // Subtree under Root A should be { A, B, C, D }
    const subtreeA = calculateSubtreeNodeIds(validTree.nodes, rootId);
    expect(subtreeA).toEqual(new Set([rootId, nodeBId, nodeCId, nodeDId]));
  });

  it('removeSubtree removes target and descendants, preserving siblings and incrementing version', () => {
    // Delete B: should remove B and D, leaving only A and C
    const updated = removeSubtree(validTree, nodeBId);
    expect(updated).not.toBeNull();
    expect(updated!.version).toBe(2);
    expect(updated!.nodes.map((n) => n.id)).toEqual([rootId, nodeCId]);
  });

  it('removeSubtree on root returns null (deleting root is deleting tree)', () => {
    const deleted = removeSubtree(validTree, rootId);
    expect(deleted).toBeNull();
  });
});
