import { describe, it, expect } from 'vitest';
import {
  computeDisjointSegments,
  type NodeHighlightItem,
} from '../../plugin/src/content/highlight-renderer.js';

describe('LT06: Pure Highlight Algorithm', () => {
  it('computes disjoint segments for non-overlapping highlights', () => {
    const highlights: NodeHighlightItem[] = [
      { childNodeId: 'node-1', startOffset: 2, endOffset: 5 },
      { childNodeId: 'node-2', startOffset: 10, endOffset: 15 },
    ];

    const segments = computeDisjointSegments(20, highlights);
    expect(segments).toEqual([
      { start: 0, end: 2, childNodeIds: [] },
      { start: 2, end: 5, childNodeIds: ['node-1'] },
      { start: 5, end: 10, childNodeIds: [] },
      { start: 10, end: 15, childNodeIds: ['node-2'] },
      { start: 15, end: 20, childNodeIds: [] },
    ]);
  });

  it('computes disjoint segments for overlapping highlights and merges node ids', () => {
    const highlights: NodeHighlightItem[] = [
      { childNodeId: 'node-1', startOffset: 3, endOffset: 10 },
      { childNodeId: 'node-2', startOffset: 6, endOffset: 15 },
    ];

    const segments = computeDisjointSegments(20, highlights);
    expect(segments).toEqual([
      { start: 0, end: 3, childNodeIds: [] },
      { start: 3, end: 6, childNodeIds: ['node-1'] },
      { start: 6, end: 10, childNodeIds: ['node-1', 'node-2'] },
      { start: 10, end: 15, childNodeIds: ['node-2'] },
      { start: 15, end: 20, childNodeIds: [] },
    ]);
  });

  it('handles empty highlights gracefully', () => {
    const segments = computeDisjointSegments(50, []);
    expect(segments).toEqual([
      { start: 0, end: 50, childNodeIds: [] },
    ]);
  });

  it('handles zero length text gracefully', () => {
    const segments = computeDisjointSegments(0, [{ childNodeId: 'n1', startOffset: 0, endOffset: 5 }]);
    expect(segments).toEqual([
      { start: 0, end: 0, childNodeIds: [] },
    ]);
  });
});
