// Bidirectional mapping between DOM Range and container text UTF-16 offsets
// Complies with 插件局部树执行计划 §3.4, §5 (LT06)

import type { HighlightAnchor } from '@zhihu-explore/contracts';

export interface OffsetSelectionResult {
  startOffset: number;
  endOffset: number;
  exact: string;
  prefix: string;
  suffix: string;
  containerText: string;
}

/**
 * Traverses all text nodes inside a container in document order.
 */
export function getTextNodes(container: Node): Text[] {
  if (typeof document === 'undefined') return [];
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.length === 0) return NodeFilter.FILTER_REJECT;
      // Plugin-injected chrome (node-count badges) is not article text: it must never shift offsets.
      const parent = node.parentElement;
      if (parent && parent.closest('.zhihu-explore-anchor-badge')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }
  return textNodes;
}

/**
 * Computes the full concatenated text of all text nodes in the container.
 */
export function getContainerText(container: Node): string {
  const nodes = getTextNodes(container);
  return nodes.map((n) => n.nodeValue || '').join('');
}

/**
 * Converts a DOM Range within container to exact UTF-16 offsets, exact text, prefix, suffix.
 * Returns null if the Range commonAncestor is outside the container.
 */
export function getRangeOffsets(container: HTMLElement, range: Range): OffsetSelectionResult | null {
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const textNodes = getTextNodes(container);
  let charCount = 0;
  let startOffset = -1;
  let endOffset = -1;

  for (const node of textNodes) {
    const nodeLen = node.nodeValue?.length || 0;

    // Check start
    if (startOffset === -1) {
      if (node === range.startContainer) {
        startOffset = charCount + range.startOffset;
      } else if (range.startContainer.contains(node)) {
        startOffset = charCount;
      }
    }

    // Check end
    if (endOffset === -1) {
      if (node === range.endContainer) {
        endOffset = charCount + range.endOffset;
      } else if (range.endContainer.contains(node)) {
        endOffset = charCount + nodeLen;
      }
    }

    charCount += nodeLen;
  }

  // Edge case: end boundary at very end of container
  if (startOffset !== -1 && endOffset === -1 && range.endOffset >= (range.endContainer.nodeValue?.length || 0)) {
    endOffset = charCount;
  }

  if (startOffset === -1 || endOffset === -1 || startOffset >= endOffset) {
    return null;
  }

  const fullText = textNodes.map((n) => n.nodeValue || '').join('');
  const exact = fullText.slice(startOffset, endOffset);

  // Validate non-empty after trimming whitespace (compliant with §3.4)
  if (exact.trim().length === 0) {
    return null;
  }

  const prefix = fullText.slice(Math.max(0, startOffset - 32), startOffset);
  const suffix = fullText.slice(endOffset, Math.min(fullText.length, endOffset + 32));

  return {
    startOffset,
    endOffset,
    exact,
    prefix,
    suffix,
    containerText: fullText,
  };
}

/**
 * Creates a DOM Range from container UTF-16 offsets.
 */
export function createRangeFromOffsets(container: HTMLElement, startOffset: number, endOffset: number): Range | null {
  if (startOffset < 0 || endOffset <= startOffset) return null;

  const textNodes = getTextNodes(container);
  let charCount = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  for (const node of textNodes) {
    const nodeLen = node.nodeValue?.length || 0;
    const nodeStart = charCount;
    const nodeEnd = charCount + nodeLen;

    if (!startNode && startOffset >= nodeStart && startOffset <= nodeEnd) {
      startNode = node;
      startNodeOffset = startOffset - nodeStart;
    }

    if (!endNode && endOffset >= nodeStart && endOffset <= nodeEnd) {
      endNode = node;
      endNodeOffset = endOffset - nodeStart;
    }

    charCount = nodeEnd;
    if (startNode && endNode) break;
  }

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
    return range;
  } catch (err) {
    console.error('[TextRange] Failed to create range from offsets:', err);
    return null;
  }
}

/**
 * Locates the DOM Range for a HighlightAnchor within container:
 * 1. Checks start_offset/end_offset if exact text matches.
 * 2. If missing or shifted: searches exact text and disambiguates using prefix/suffix.
 * 3. Returns null if ambiguous or not found.
 */
export function findRangeForAnchor(container: HTMLElement, anchor: HighlightAnchor): Range | null {
  const fullText = getContainerText(container);
  if (!fullText || !anchor.exact) return null;

  // 1. Direct offset match check
  if (typeof anchor.start_offset === 'number' && typeof anchor.end_offset === 'number') {
    const candidate = fullText.slice(anchor.start_offset, anchor.end_offset);
    if (candidate === anchor.exact) {
      return createRangeFromOffsets(container, anchor.start_offset, anchor.end_offset);
    }
  }

  // 2. Exact match search across full text
  const occurrences: number[] = [];
  let pos = fullText.indexOf(anchor.exact, 0);
  while (pos !== -1) {
    occurrences.push(pos);
    pos = fullText.indexOf(anchor.exact, pos + 1);
  }

  if (occurrences.length === 0) return null;
  if (occurrences.length === 1) {
    const matchStart = occurrences[0]!;
    return createRangeFromOffsets(container, matchStart, matchStart + anchor.exact.length);
  }

  // 3. Disambiguate multiple occurrences using prefix and suffix score
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < occurrences.length; i++) {
    const matchStart = occurrences[i]!;
    const matchEnd = matchStart + anchor.exact.length;
    let score = 0;

    if (anchor.prefix) {
      const textBefore = fullText.slice(Math.max(0, matchStart - anchor.prefix.length), matchStart);
      if (textBefore.endsWith(anchor.prefix)) score += 2;
      else if (textBefore.length > 0 && anchor.prefix.endsWith(textBefore)) score += 1;
    }

    if (anchor.suffix) {
      const textAfter = fullText.slice(matchEnd, Math.min(fullText.length, matchEnd + anchor.suffix.length));
      if (textAfter.startsWith(anchor.suffix)) score += 2;
      else if (textAfter.length > 0 && anchor.suffix.startsWith(textAfter)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = matchStart;
    }
  }

  if (bestScore > 0 && bestIdx !== -1) {
    return createRangeFromOffsets(container, bestIdx, bestIdx + anchor.exact.length);
  }

  return null;
}
