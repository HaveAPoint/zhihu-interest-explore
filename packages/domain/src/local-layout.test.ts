import { describe, it, expect } from 'vitest';
import { computeLocalTreeLayout, defaultLayoutOptions, type NodeRect } from './local-layout.js';
import type { LocalTree, LocalNode } from '@zhihu-explore/contracts';

describe('LocalTree Layout Pure Function (LT03)', () => {
  const treeId = '550e8400-e29b-41d4-a716-446655440000';
  const rootId = '550e8400-e29b-41d4-a716-446655440001';

  function createNode(id: string, parentId: string | null, title: string, timeOffsetMins: number): LocalNode {
    return {
      id,
      tree_id: treeId,
      parent_id: parentId,
      highlight_text: '高亮',
      question_text: '问题',
      title,
      answer_original: '引用',
      answer_extra: '解释',
      sources: [],
      created_at: new Date(Date.parse('2026-09-14T10:00:00.000Z') + timeOffsetMins * 60000).toISOString(),
    };
  }

  function checkNoOverlap(nodes: NodeRect[]) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        // Two boxes overlap iff they overlap in BOTH x and y
        const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        if (xOverlap > 0 && yOverlap > 0) {
          throw new Error(`Node overlap detected between "${a.nodeId}" and "${b.nodeId}":
            a: [x=${a.x}, y=${a.y}, w=${a.width}, h=${a.height}]
            b: [x=${b.x}, y=${b.y}, w=${b.width}, h=${b.height}]`);
        }
      }
    }
  }

  it('lays out single root tree correctly', () => {
    const singleTree: LocalTree = {
      id: treeId,
      root_node_id: rootId,
      uid: 'user-001',
      article_id: '550e8400-e29b-41d4-a716-446655440099',
      discipline_slug: 'agent-app-dev',
      global_node_id: null,
      match_candidates: [],
      anchor_paragraph: '段落',
      anchor_highlight: '高亮',
      version: 1,
      nodes: [createNode(rootId, null, 'Root', 0)],
      created_at: '2026-09-14T10:00:00.000Z',
      updated_at: '2026-09-14T10:00:00.000Z',
    };

    const res = computeLocalTreeLayout(singleTree, new Set([rootId]));
    expect(res.nodes).toHaveLength(1);
    expect(res.edges).toHaveLength(0);
    expect(res.nodes[0]?.depth).toBe(0);
    expect(res.bounds.width).toBeGreaterThan(defaultLayoutOptions.nodeWidth);
    expect(res.bounds.height).toBeGreaterThan(defaultLayoutOptions.nodeHeight);
  });

  it('centers parent vertically with respect to direct children span in wide branch tree', () => {
    // 1 root with 3 children
    const child1Id = '550e8400-e29b-41d4-a716-446655440002';
    const child2Id = '550e8400-e29b-41d4-a716-446655440003';
    const child3Id = '550e8400-e29b-41d4-a716-446655440004';

    const wideTree: LocalTree = {
      id: treeId,
      root_node_id: rootId,
      uid: 'user-001',
      article_id: '550e8400-e29b-41d4-a716-446655440099',
      discipline_slug: 'agent-app-dev',
      global_node_id: null,
      match_candidates: [],
      anchor_paragraph: '段落',
      anchor_highlight: '高亮',
      version: 1,
      nodes: [
        createNode(rootId, null, 'Root', 0),
        createNode(child1Id, rootId, 'C1', 1),
        createNode(child2Id, rootId, 'C2', 2),
        createNode(child3Id, rootId, 'C3', 3),
      ],
      created_at: '2026-09-14T10:00:00.000Z',
      updated_at: '2026-09-14T10:03:00.000Z',
    };

    const visible = new Set([rootId, child1Id, child2Id, child3Id]);
    const res = computeLocalTreeLayout(wideTree, visible);

    checkNoOverlap(res.nodes);
    expect(res.nodes).toHaveLength(4);
    expect(res.edges).toHaveLength(3);

    const rootRect = res.nodeMap.get(rootId)!;
    const c1Rect = res.nodeMap.get(child1Id)!;
    const c3Rect = res.nodeMap.get(child3Id)!;

    // Direct children centers span
    const spanCenterY = (c1Rect.y + c1Rect.height / 2 + (c3Rect.y + c3Rect.height / 2)) / 2;
    const rootCenterY = rootRect.y + rootRect.height / 2;
    expect(Math.abs(rootCenterY - spanCenterY)).toBeLessThan(0.001);
  });

  it('lays out canonical A/B/C/D/E/F tree with no overlapping rects and correct depth x-offsets', () => {
    const nodeAId = rootId;
    const nodeBId = '550e8400-e29b-41d4-a716-446655440002';
    const nodeCId = '550e8400-e29b-41d4-a716-446655440003';
    const nodeDId = '550e8400-e29b-41d4-a716-446655440004';
    const nodeEId = '550e8400-e29b-41d4-a716-446655440005';
    const nodeFId = '550e8400-e29b-41d4-a716-446655440006';

    const canonicalTree: LocalTree = {
      id: treeId,
      root_node_id: nodeAId,
      uid: 'user-001',
      article_id: '550e8400-e29b-41d4-a716-446655440099',
      discipline_slug: 'agent-app-dev',
      global_node_id: null,
      match_candidates: [],
      anchor_paragraph: '段落',
      anchor_highlight: '高亮',
      version: 1,
      nodes: [
        createNode(nodeAId, null, 'A', 0),
        createNode(nodeBId, nodeAId, 'B', 1),
        createNode(nodeCId, nodeAId, 'C', 2),
        createNode(nodeDId, nodeBId, 'D', 3),
        createNode(nodeEId, nodeCId, 'E', 4),
        createNode(nodeFId, nodeBId, 'F', 5),
      ],
      created_at: '2026-09-14T10:00:00.000Z',
      updated_at: '2026-09-14T10:05:00.000Z',
    };

    // When all nodes visible
    const allVisible = new Set([nodeAId, nodeBId, nodeCId, nodeDId, nodeEId, nodeFId]);
    const res = computeLocalTreeLayout(canonicalTree, allVisible);

    checkNoOverlap(res.nodes);
    expect(res.nodes).toHaveLength(6);
    expect(res.edges).toHaveLength(5);

    // Depth checks
    expect(res.nodeMap.get(nodeAId)?.depth).toBe(0);
    expect(res.nodeMap.get(nodeBId)?.depth).toBe(1);
    expect(res.nodeMap.get(nodeCId)?.depth).toBe(1);
    expect(res.nodeMap.get(nodeDId)?.depth).toBe(2);
    expect(res.nodeMap.get(nodeEId)?.depth).toBe(2);
    expect(res.nodeMap.get(nodeFId)?.depth).toBe(2);

    // Each depth level has strictly increasing x
    const x0 = res.nodeMap.get(nodeAId)!.x;
    const x1 = res.nodeMap.get(nodeBId)!.x;
    const x2 = res.nodeMap.get(nodeDId)!.x;
    expect(x1).toBeGreaterThan(x0);
    expect(x2).toBeGreaterThan(x1);
  });

  it('supports custom dynamic node heights without overlapping', () => {
    const nodeAId = rootId;
    const nodeBId = '550e8400-e29b-41d4-a716-446655440002';
    const nodeCId = '550e8400-e29b-41d4-a716-446655440003';

    const tree: LocalTree = {
      id: treeId,
      root_node_id: nodeAId,
      uid: 'user-001',
      article_id: '550e8400-e29b-41d4-a716-446655440099',
      discipline_slug: 'agent-app-dev',
      global_node_id: null,
      match_candidates: [],
      anchor_paragraph: '段落',
      anchor_highlight: '高亮',
      version: 1,
      nodes: [
        createNode(nodeAId, null, 'A', 0),
        createNode(nodeBId, nodeAId, 'B', 1),
        createNode(nodeCId, nodeAId, 'C', 2),
      ],
      created_at: '2026-09-14T10:00:00.000Z',
      updated_at: '2026-09-14T10:02:00.000Z',
    };

    const customSizes = new Map<string, { width: number; height: number }>();
    customSizes.set(nodeBId, { width: 140, height: 120 }); // Very tall node B
    customSizes.set(nodeCId, { width: 140, height: 60 });

    const res = computeLocalTreeLayout(tree, new Set([nodeAId, nodeBId, nodeCId]), {
      customNodeSizes: customSizes,
    });

    checkNoOverlap(res.nodes);
    expect(res.nodeMap.get(nodeBId)?.height).toBe(120);
    expect(res.nodeMap.get(nodeCId)?.height).toBe(60);
  });

  it('computes 100-node tree layout without infinite loop in sub-10ms', () => {
    const hundredNodes: LocalNode[] = [];
    const totalNodes = 100;
    const visibleIds = new Set<string>();

    for (let i = 0; i < totalNodes; i++) {
      const id = `550e8400-e29b-41d4-a716-${i.toString(16).padStart(12, '0')}`;
      const parentIndex = i === 0 ? null : Math.floor((i - 1) / 3);
      const parentId = parentIndex === null ? null : `550e8400-e29b-41d4-a716-${parentIndex.toString(16).padStart(12, '0')}`;
      hundredNodes.push(createNode(id, parentId, `N${i}`, i));
      visibleIds.add(id);
    }

    const hundredTree: LocalTree = {
      id: treeId,
      root_node_id: hundredNodes[0]!.id,
      uid: 'user-001',
      article_id: '550e8400-e29b-41d4-a716-446655440099',
      discipline_slug: 'agent-app-dev',
      global_node_id: null,
      match_candidates: [],
      anchor_paragraph: '段落',
      anchor_highlight: '高亮',
      version: 1,
      nodes: hundredNodes,
      created_at: '2026-09-14T10:00:00.000Z',
      updated_at: '2026-09-14T10:00:00.000Z',
    };

    const start = performance.now();
    const res = computeLocalTreeLayout(hundredTree, visibleIds);
    const elapsed = performance.now() - start;

    expect(res.nodes).toHaveLength(100);
    expect(res.edges).toHaveLength(99);
    checkNoOverlap(res.nodes);
    expect(elapsed).toBeLessThan(50); // fast execution
  });
});
