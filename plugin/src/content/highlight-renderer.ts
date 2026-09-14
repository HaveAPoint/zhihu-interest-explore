// Segmented non-overlapping highlight renderer for answer cards
// Merges overlapping highlight ranges into adjacent flat <mark> elements.
// Complies with 插件局部树执行计划 §3.5, §5 (LT06)

import type { HighlightAnchor } from '@zhihu-explore/contracts';

export interface NodeHighlightItem {
  childNodeId: string;
  startOffset: number;
  endOffset: number;
}

export interface Segment {
  start: number;
  end: number;
  childNodeIds: string[];
}

/**
 * Computes non-overlapping segments from a list of overlapping highlight intervals.
 */
export function computeDisjointSegments(fullTextLength: number, highlights: NodeHighlightItem[]): Segment[] {
  if (fullTextLength <= 0) {
    return [{ start: 0, end: 0, childNodeIds: [] }];
  }

  if (highlights.length === 0) {
    return [{ start: 0, end: fullTextLength, childNodeIds: [] }];
  }

  // 1. Collect and sort all boundary points within [0, fullTextLength]
  const points = new Set<number>([0, fullTextLength]);
  for (const h of highlights) {
    const clampedStart = Math.max(0, Math.min(fullTextLength, h.startOffset));
    const clampedEnd = Math.max(0, Math.min(fullTextLength, h.endOffset));
    if (clampedStart < clampedEnd) {
      points.add(clampedStart);
      points.add(clampedEnd);
    }
  }

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const segments: Segment[] = [];

  // 2. For each interval [p_i, p_{i+1}], determine covering childNodeIds
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i]!;
    const segEnd = sortedPoints[i + 1]!;
    if (segStart >= segEnd) continue;

    const coveringIds: string[] = [];
    for (const h of highlights) {
      if (h.startOffset <= segStart && h.endOffset >= segEnd) {
        coveringIds.push(h.childNodeId);
      }
    }

    segments.push({
      start: segStart,
      end: segEnd,
      childNodeIds: coveringIds,
    });
  }

  return segments;
}

/**
 * Resolves child node highlight ranges relative to parent text.
 */
export function resolveChildHighlights(
  parentText: string,
  childNodes: Array<{ id: string; highlight_anchor?: HighlightAnchor }>,
): NodeHighlightItem[] {
  const highlights: NodeHighlightItem[] = [];
  if (!parentText) return highlights;

  for (const child of childNodes) {
    const anchor = child.highlight_anchor;
    if (!anchor || !anchor.exact) continue;

    // 1. Direct offset match
    if (
      typeof anchor.start_offset === 'number' &&
      typeof anchor.end_offset === 'number' &&
      anchor.start_offset >= 0 &&
      anchor.end_offset <= parentText.length &&
      parentText.slice(anchor.start_offset, anchor.end_offset) === anchor.exact
    ) {
      highlights.push({
        childNodeId: child.id,
        startOffset: anchor.start_offset,
        endOffset: anchor.end_offset,
      });
      continue;
    }

    // 2. Search exact text in parentText with prefix/suffix disambiguation
    const exact = anchor.exact;
    const occurrences: number[] = [];
    let pos = parentText.indexOf(exact, 0);
    while (pos !== -1) {
      occurrences.push(pos);
      pos = parentText.indexOf(exact, pos + 1);
    }

    if (occurrences.length === 1) {
      const matchStart = occurrences[0]!;
      highlights.push({
        childNodeId: child.id,
        startOffset: matchStart,
        endOffset: matchStart + exact.length,
      });
    } else if (occurrences.length > 1) {
      let bestIdx = occurrences[0]!;
      let bestScore = -1;

      for (const idx of occurrences) {
        let score = 0;
        if (anchor.prefix) {
          const pre = parentText.slice(Math.max(0, idx - anchor.prefix.length), idx);
          if (pre.endsWith(anchor.prefix)) score += 2;
          else if (pre.length > 0 && anchor.prefix.endsWith(pre)) score += 1;
        }
        if (anchor.suffix) {
          const post = parentText.slice(idx + exact.length, Math.min(parentText.length, idx + exact.length + anchor.suffix.length));
          if (post.startsWith(anchor.suffix)) score += 2;
          else if (post.length > 0 && anchor.suffix.startsWith(post)) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }

      highlights.push({
        childNodeId: child.id,
        startOffset: bestIdx,
        endOffset: bestIdx + exact.length,
      });
    }
  }

  return highlights;
}

/**
 * Renders segmented non-overlapping text + <mark> elements into container.
 * Absolutely NO innerHTML or arbitrary markup injection; uses document.createTextNode and createElement('mark').
 */
export function renderSegmentedHighlights(
  container: HTMLElement,
  fullText: string,
  highlights: NodeHighlightItem[],
): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const segments = computeDisjointSegments(fullText.length, highlights);

  for (const seg of segments) {
    const segText = fullText.slice(seg.start, seg.end);
    if (!segText) continue;

    if (seg.childNodeIds.length === 0) {
      container.appendChild(document.createTextNode(segText));
    } else {
      const mark = document.createElement('mark');
      mark.className = 'zhihu-explore-highlight-mark';
      mark.setAttribute('data-child-ids', seg.childNodeIds.join(','));
      mark.setAttribute('data-start-offset', String(seg.start));
      mark.setAttribute('data-end-offset', String(seg.end));
      mark.style.cssText = `
        background: #ffe58f;
        color: inherit;
        border-radius: 2px;
        padding: 1px 2px;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      `;
      mark.appendChild(document.createTextNode(segText));
      container.appendChild(mark);
    }
  }
}
