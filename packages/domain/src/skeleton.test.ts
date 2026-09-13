import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateSkeleton,
  validateSkeletonSet,
  toAgentSkeleton,
  isLeaf,
  depthOf,
  skeletonNodeIds,
} from './skeleton.js';

describe('skeleton pure validator', () => {
  it('validates a valid minimal skeleton', () => {
    const minimal = {
      major: '人工智能',
      name: 'Agent 应用开发',
      slug: 'agent-app-dev',
      origin: 'preset',
      source_note: 'test note',
      review_status: 'draft',
      nodes: [
        {
          id: 'agent-app-dev/root',
          parent_id: null,
          title: 'Agent 应用开发',
          aliases: [],
          definition: '测试定义',
          sort_order: 0,
        },
        {
          id: 'agent-app-dev/sub',
          parent_id: 'agent-app-dev/root',
          title: '子概念',
          aliases: [],
          definition: '子定义',
          sort_order: 0,
        },
      ],
    };

    const result = validateSkeleton(minimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.skeleton.rootId).toBe('agent-app-dev/root');
      expect(result.skeleton.nodes.length).toBe(2);
      expect(isLeaf(result.skeleton, 'agent-app-dev/sub')).toBe(true);
      expect(isLeaf(result.skeleton, 'agent-app-dev/root')).toBe(false);
      expect(depthOf(result.skeleton, 'agent-app-dev/root')).toBe(1);
      expect(depthOf(result.skeleton, 'agent-app-dev/sub')).toBe(2);
    }
  });

  it('rejects duplicate node IDs', () => {
    const invalid = {
      major: '人工智能',
      name: 'Agent 应用开发',
      slug: 'agent-app-dev',
      origin: 'preset',
      source_note: 'test note',
      review_status: 'draft',
      nodes: [
        {
          id: 'agent-app-dev/root',
          parent_id: null,
          title: 'Root',
          aliases: [],
          definition: 'def',
          sort_order: 0,
        },
        {
          id: 'agent-app-dev/root',
          parent_id: null,
          title: 'Root Duplicate',
          aliases: [],
          definition: 'def',
          sort_order: 1,
        },
      ],
    };
    const result = validateSkeleton(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
    }
  });

  it('rejects cycle in parents', () => {
    const cycle = {
      major: '人工智能',
      name: 'Agent 应用开发',
      slug: 'agent-app-dev',
      origin: 'preset',
      source_note: 'test note',
      review_status: 'draft',
      nodes: [
        {
          id: 'agent-app-dev/root',
          parent_id: null,
          title: 'Root',
          aliases: [],
          definition: 'def',
          sort_order: 0,
        },
        {
          id: 'agent-app-dev/a',
          parent_id: 'agent-app-dev/b',
          title: 'A',
          aliases: [],
          definition: 'def',
          sort_order: 0,
        },
        {
          id: 'agent-app-dev/b',
          parent_id: 'agent-app-dev/a',
          title: 'B',
          aliases: [],
          definition: 'def',
          sort_order: 0,
        },
      ],
    };
    const result = validateSkeleton(cycle);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'CYCLE')).toBe(true);
    }
  });

  it('rejects missing parent and prefix mismatch', () => {
    const invalid = {
      major: '人工智能',
      name: 'Agent 应用开发',
      slug: 'agent-app-dev',
      origin: 'preset',
      source_note: 'test note',
      review_status: 'draft',
      nodes: [
        {
          id: 'agent-app-dev/root',
          parent_id: null,
          title: 'Root',
          aliases: [],
          definition: 'def',
          sort_order: 0,
        },
        {
          id: 'wrong-prefix/node',
          parent_id: 'agent-app-dev/nonexistent',
          title: 'Invalid',
          aliases: [],
          definition: 'def',
          sort_order: 0,
        },
      ],
    };
    const result = validateSkeleton(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'ID_PREFIX_MISMATCH')).toBe(true);
      expect(result.errors.some((e) => e.code === 'MISSING_PARENT')).toBe(true);
    }
  });
});

describe('all 3 discipline files validation', () => {
  const disciplinesDir = path.resolve(process.cwd(), 'disciplines');

  it('validates cognitive-psychology, distributed-systems, agent-app-dev and index.json', () => {
    const slugs = ['agent-app-dev', 'cognitive-psychology', 'distributed-systems'];
    const files = slugs.map((slug) => {
      const filePath = path.join(disciplinesDir, `${slug}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    });

    const indexPath = path.join(disciplinesDir, 'index.json');
    expect(fs.existsSync(indexPath)).toBe(true);
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

    const result = validateSkeletonSet(files, indexData);
    if (!result.ok) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.ok).toBe(true);
    expect(result.skeletons.length).toBe(3);

    // Check agent-app-dev stable node exists
    const agentSkeleton = result.skeletons.find((s) => s.slug === 'agent-app-dev');
    expect(agentSkeleton).toBeDefined();
    const nodeIds = skeletonNodeIds(agentSkeleton!);
    expect(nodeIds.has('agent-app-dev/tool-calling')).toBe(true);
    expect(nodeIds.has('agent-app-dev/root')).toBe(true);

    const agentNodes = toAgentSkeleton(agentSkeleton!);
    expect(agentNodes.length).toBeGreaterThan(10);
    // Agent skeleton node does not contain sort_order
    expect('sort_order' in agentNodes[0]!).toBe(false);
  });
});
