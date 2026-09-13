import { describe, it, expect } from 'vitest';
import {
  calculateLighting,
  type UnifiedKnowledgeNode,
} from './lighting.js';
import {
  calculateGlobalLayout,
  getDefaultExpandedNodeIds,
} from './global-layout.js';

describe('T28a: Lighting and Subtree Statistics', () => {
  const sampleNodes: UnifiedKnowledgeNode[] = [
    { id: 'root', parent_id: null, title: 'Root' },
    { id: 'cat1', parent_id: 'root', title: 'Category 1' },
    { id: 'leaf1_1', parent_id: 'cat1', title: 'Leaf 1-1' },
    { id: 'leaf1_2', parent_id: 'cat1', title: 'Leaf 1-2' },
    { id: 'cat2', parent_id: 'root', title: 'Category 2' },
    { id: 'leaf2_1', parent_id: 'cat2', title: 'Leaf 2-1' },
  ];

  it('父亮子不继承 (Children do NOT inherit lit state from parent)', () => {
    // Only root is lit
    const directLit = new Set(['root']);
    const { states } = calculateLighting(sampleNodes, directLit);

    expect(states.get('root')!.isDirectLit).toBe(true);
    expect(states.get('cat1')!.isDirectLit).toBe(false);
    expect(states.get('leaf1_1')!.isDirectLit).toBe(false);
  });

  it('叶亮即有小金 tag (Leaf node has gold tag iff it is direct lit)', () => {
    const directLit = new Set(['leaf1_1']);
    const { states } = calculateLighting(sampleNodes, directLit);

    expect(states.get('leaf1_1')!.isGold).toBe(true);
    expect(states.get('leaf1_2')!.isGold).toBe(false);
  });

  it('子全亮但父不亮不 gold (All direct children lit but parent unlit -> parent is NOT gold)', () => {
    // Both children of cat1 are lit, but cat1 is unlit
    const directLit = new Set(['leaf1_1', 'leaf1_2']);
    const { states } = calculateLighting(sampleNodes, directLit);

    const cat1State = states.get('cat1')!;
    expect(cat1State.isDirectLit).toBe(false);
    expect(cat1State.isGold).toBe(false);
    expect(states.get('leaf1_1')!.isGold).toBe(true);
    expect(states.get('leaf1_2')!.isGold).toBe(true);
  });

  it('父和所有直接子亮则 gold (Parent and all direct children lit -> parent is gold)', () => {
    // cat1 and both its direct children are lit
    const directLit = new Set(['cat1', 'leaf1_1', 'leaf1_2']);
    const { states } = calculateLighting(sampleNodes, directLit);

    const cat1State = states.get('cat1')!;
    expect(cat1State.isDirectLit).toBe(true);
    expect(cat1State.isGold).toBe(true);
  });

  it('n/N 包含自身 (n/N subtree count includes self)', () => {
    const directLit = new Set(['cat1', 'leaf1_1']);
    const { states } = calculateLighting(sampleNodes, directLit);

    // cat1 subtree has: cat1, leaf1_1, leaf1_2 -> total N = 3
    // Lit: cat1, leaf1_1 -> total n = 2
    const cat1State = states.get('cat1')!;
    expect(cat1State.N).toBe(3);
    expect(cat1State.n).toBe(2);
    expect(cat1State.ratio).toBeCloseTo(2 / 3);

    // leaf1_1 subtree has: leaf1_1 -> N = 1, n = 1
    const leafState = states.get('leaf1_1')!;
    expect(leafState.N).toBe(1);
    expect(leafState.n).toBe(1);

    // Root subtree has: root (6 nodes total), 2 lit
    const rootState = states.get('root')!;
    expect(rootState.N).toBe(6);
    expect(rootState.n).toBe(2);
  });

  it('新增个人节点参与自己所在子树统计 (Personal supplement node participates in subtree stats)', () => {
    const nodesWithPersonal: UnifiedKnowledgeNode[] = [
      ...sampleNodes,
      {
        id: 'pers-uuid-1',
        parent_id: 'cat1',
        title: 'Personal Concept',
        is_personal: true,
      },
    ];

    // Light up personal node
    const directLit = new Set(['pers-uuid-1']);
    const { states } = calculateLighting(nodesWithPersonal, directLit);

    // cat1 subtree now has 4 nodes (cat1, leaf1_1, leaf1_2, pers-uuid-1)
    const cat1State = states.get('cat1')!;
    expect(cat1State.N).toBe(4);
    expect(cat1State.n).toBe(1);

    // Personal node is a leaf, lit -> gold
    const persState = states.get('pers-uuid-1')!;
    expect(persState.isDirectLit).toBe(true);
    expect(persState.isGold).toBe(true);
  });
});

describe('T28a: Global Tree Layout Algorithm', () => {
  const treeNodes: UnifiedKnowledgeNode[] = [
    { id: 'root', parent_id: null, title: 'Root' },
    { id: 'cat1', parent_id: 'root', title: 'Cat1' },
    { id: 'leaf1_1', parent_id: 'cat1', title: 'Leaf1-1' },
    { id: 'leaf1_2', parent_id: 'cat1', title: 'Leaf1-2' },
    { id: 'cat2', parent_id: 'root', title: 'Cat2' },
    { id: 'leaf2_1', parent_id: 'cat2', title: 'Leaf2-1' },
    { id: 'leaf2_2', parent_id: 'cat2', title: 'Leaf2-2' },
  ];

  it('根左子右 (Root is left, children are right with increasing X)', () => {
    const expanded = new Set(['root', 'cat1', 'cat2']);
    const layout = calculateGlobalLayout(treeNodes, expanded);

    const rootNode = layout.nodes.find((n) => n.id === 'root')!;
    const cat1Node = layout.nodes.find((n) => n.id === 'cat1')!;
    const leaf1Node = layout.nodes.find((n) => n.id === 'leaf1_1')!;

    expect(rootNode.x).toBe(0);
    expect(cat1Node.x).toBeGreaterThan(rootNode.x);
    expect(leaf1Node.x).toBeGreaterThan(cat1Node.x);
  });

  it('非叶默认展开、叶子折进父节点 (Default expanded folds leaves into parent)', () => {
    const defaultExpanded = getDefaultExpandedNodeIds(treeNodes);
    // Root has non-leaf children (cat1, cat2), so root is expanded
    expect(defaultExpanded.has('root')).toBe(true);
    // cat1 and cat2 only have leaves, so by default they are folded
    expect(defaultExpanded.has('cat1')).toBe(false);
    expect(defaultExpanded.has('cat2')).toBe(false);

    const layout = calculateGlobalLayout(treeNodes, defaultExpanded);

    const rootNode = layout.nodes.find((n) => n.id === 'root')!;
    const cat1Node = layout.nodes.find((n) => n.id === 'cat1')!;
    const leaf1Node = layout.nodes.find((n) => n.id === 'leaf1_1')!;

    expect(rootNode.visible).toBe(true);
    expect(cat1Node.visible).toBe(true);
    // Leaves folded by default
    expect(leaf1Node.visible).toBe(false);
  });

  it('展开两组不会覆盖 (Expanding multiple leaf groups never overlaps in Y space)', () => {
    // Both cat1 and cat2 expanded
    const expanded = new Set(['root', 'cat1', 'cat2']);
    const layout = calculateGlobalLayout(treeNodes, expanded);

    const visibleNodes = layout.nodes.filter((n) => n.visible);
    expect(visibleNodes.length).toBe(7);

    // Check that no two nodes on the same column overlap in Y
    const byDepth = new Map<number, typeof visibleNodes>();
    for (const node of visibleNodes) {
      if (!byDepth.has(node.depth)) byDepth.set(node.depth, []);
      byDepth.get(node.depth)!.push(node);
    }

    for (const [, columnNodes] of byDepth) {
      columnNodes.sort((a, b) => a.y - b.y);
      for (let i = 0; i < columnNodes.length - 1; i++) {
        const a = columnNodes[i]!;
        const b = columnNodes[i + 1]!;
        // Bottom of a must be <= top of b
        expect(a.y + a.height).toBeLessThanOrEqual(b.y);
      }
    }
  });

  it('generates valid SVG connector paths for visible edges', () => {
    const expanded = new Set(['root', 'cat1']);
    const layout = calculateGlobalLayout(treeNodes, expanded);

    expect(layout.connectors.length).toBeGreaterThan(0);
    for (const c of layout.connectors) {
      expect(c.pathData).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? C/);
      expect(c.startX).toBeLessThan(c.endX);
    }
  });
});
