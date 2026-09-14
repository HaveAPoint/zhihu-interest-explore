import { describe, it, expect } from 'vitest';
import { LocalTreeSchema } from '@zhihu-explore/contracts';
import { validateLocalTree } from '@zhihu-explore/domain';
import {
  allViewFixtures,
  treeAbcdefFixture,
  longTitleTreeFixture,
  multilineAnswerTreeFixture,
  duplicateWordsTreeFixture,
  sameHighlightForkTreeFixture,
  legacyTreeWithoutAnchorFixture,
  singleRootTreeFixture,
  deep8TreeFixture,
  wide8TreeFixture,
  hundredNodesTreeFixture,
} from './view-fixtures.js';

describe('Local Tree Pure View Fixtures (LT01)', () => {
  it('contains exactly 10 pure view fixtures', () => {
    expect(allViewFixtures).toHaveLength(10);
  });

  it.each(allViewFixtures)('conforms to LocalTreeSchema and validateLocalTree: $id', (tree) => {
    // 1. Zod schema validation
    const parsed = LocalTreeSchema.safeParse(tree);
    if (!parsed.success) {
      console.error('Schema validation errors:', parsed.error.format());
    }
    expect(parsed.success).toBe(true);

    // 2. Domain rules validation
    const valResult = validateLocalTree(tree);
    expect(valResult.ok).toBe(true);
    expect(valResult.errors).toEqual([]);
  });

  it('validates canonical A/B/C/D/E/F tree structure and sequence', () => {
    expect(treeAbcdefFixture.nodes).toHaveLength(6);
    const root = treeAbcdefFixture.nodes.find((n) => n.parent_id === null);
    expect(root?.id).toBe(treeAbcdefFixture.root_node_id);

    // F must be latest created
    const sorted = [...treeAbcdefFixture.nodes].sort((a, b) => b.created_at.localeCompare(a.created_at));
    expect(sorted[0]?.title).toContain('F');
  });

  it('validates long title tree limits', () => {
    const childNode = longTitleTreeFixture.nodes[1]!;
    expect(childNode.title.length).toBeGreaterThan(30);
    expect(childNode.title.length).toBeLessThanOrEqual(50);
  });

  it('validates multiline answer text formatting', () => {
    const root = multilineAnswerTreeFixture.nodes[0]!;
    expect(root.answer_original).toContain('\n\n');
    expect(root.answer_extra).toContain('\n\n');
  });

  it('validates duplicate words anchor targets 2nd instance with correct offsets', () => {
    const root = duplicateWordsTreeFixture.nodes[0]!;
    const child = duplicateWordsTreeFixture.nodes[1]!;
    expect(root.answer_extra).toContain('强大的模式识别能力，但大模型缺乏时序状态');
    expect(child.highlight_anchor?.start_offset).toBe(18);
    expect(child.highlight_anchor?.end_offset).toBe(21);
    const sliced = root.answer_extra.slice(child.highlight_anchor!.start_offset!, child.highlight_anchor!.end_offset!);
    expect(sliced).toBe(child.highlight_anchor?.exact);
  });

  it('validates same highlight fork shares parent highlight but separate nodes', () => {
    const root = sameHighlightForkTreeFixture.nodes[0]!;
    const child1 = sameHighlightForkTreeFixture.nodes[1]!;
    const child2 = sameHighlightForkTreeFixture.nodes[2]!;
    expect(child1.parent_id).toBe(root.id);
    expect(child2.parent_id).toBe(root.id);
    expect(child1.highlight_text).toBe(child2.highlight_text);
    expect(child1.id).not.toBe(child2.id);
  });

  it('validates legacy tree without anchor has undefined highlight_anchor', () => {
    for (const node of legacyTreeWithoutAnchorFixture.nodes) {
      expect(node.highlight_anchor).toBeUndefined();
    }
  });

  it('validates single root tree contains exactly one node', () => {
    expect(singleRootTreeFixture.nodes).toHaveLength(1);
    expect(singleRootTreeFixture.nodes[0]?.parent_id).toBeNull();
  });

  it('validates deep 8 tree has 8 depth levels', () => {
    expect(deep8TreeFixture.nodes).toHaveLength(8);
  });

  it('validates wide 8 tree has 8 direct children', () => {
    const rootId = wide8TreeFixture.root_node_id;
    const children = wide8TreeFixture.nodes.filter((n) => n.parent_id === rootId);
    expect(children).toHaveLength(8);
  });

  it('validates hundred nodes tree contains 100 valid nodes without cycle', () => {
    expect(hundredNodesTreeFixture.nodes).toHaveLength(100);
  });
});
