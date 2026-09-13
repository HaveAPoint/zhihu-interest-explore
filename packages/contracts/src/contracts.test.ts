import { describe, it, expect } from 'vitest';
import {
  UUIDSchema,
  UidSchema,
  DisciplineSlugSchema,
  VersionSchema,
  DegreeSchema,
  ProficiencySchema,
  ResolveArticleInputSchema,
  LocalNodeSchema,
  CandidateSchema,
  SourceSchema,
  ClassifyOutputSchema,
  GenerateRootOutputSchema,
  GenerateFollowupOutputSchema,
  ErrorResponseSchema,
  BridgeRequestSchema,
  BridgeActionSchema,
  BridgeProtocolVersion,
  LocalSyncMetaSchema,
  SyncManifestEntrySchema,
  normalizeTreeForHash,
} from '../src/index.js';

describe('IDs and base schemas', () => {
  it('accepts valid UUID', () => {
    expect(UUIDSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    expect(UUIDSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('uid must be string, rejects empty', () => {
    expect(UidSchema.safeParse('12345678').success).toBe(true);
    expect(UidSchema.safeParse('').success).toBe(false);
    // uid must not be converted to number
    expect(UidSchema.safeParse(12345678).success).toBe(false);
  });

  it('version must be positive integer', () => {
    expect(VersionSchema.safeParse(1).success).toBe(true);
    expect(VersionSchema.safeParse(0).success).toBe(false);
    expect(VersionSchema.safeParse(-1).success).toBe(false);
    expect(VersionSchema.safeParse(1.5).success).toBe(false);
  });

  it('discipline slug is valid enum', () => {
    expect(DisciplineSlugSchema.safeParse('agent-app-dev').success).toBe(true);
    expect(DisciplineSlugSchema.safeParse('cognitive-psychology').success).toBe(true);
    expect(DisciplineSlugSchema.safeParse('distributed-systems').success).toBe(true);
    expect(DisciplineSlugSchema.safeParse('invalid-slug').success).toBe(false);
  });

  it('degree validation', () => {
    expect(DegreeSchema.safeParse('exact').success).toBe(true);
    expect(DegreeSchema.safeParse('broader').success).toBe(true);
    expect(DegreeSchema.safeParse('related').success).toBe(true);
    expect(DegreeSchema.safeParse('invalid').success).toBe(false);
  });

  it('proficiency: null and 0-5 valid, others invalid', () => {
    expect(ProficiencySchema.safeParse(null).success).toBe(true);
    expect(ProficiencySchema.safeParse(0).success).toBe(true);
    expect(ProficiencySchema.safeParse(5).success).toBe(true);
    expect(ProficiencySchema.safeParse(-1).success).toBe(false);
    expect(ProficiencySchema.safeParse(6).success).toBe(false);
    expect(ProficiencySchema.safeParse(2.5).success).toBe(false);
  });
});

describe('Article schemas', () => {
  it('accepts valid resolve input', () => {
    const result = ResolveArticleInputSchema.safeParse({
      article_id: '550e8400-e29b-41d4-a716-446655440000',
      zhihu_id: '123456789',
      url: 'https://zhuanlan.zhihu.com/p/123456789',
      title: '测试文章',
      tags: ['AI', 'Agent'],
      lead: '这是首段文本',
      content_text: '这是完整正文内容。',
    });
    expect(result.success).toBe(true);
  });

  it('rejects resolve input without content_text', () => {
    const result = ResolveArticleInputSchema.safeParse({
      article_id: '550e8400-e29b-41d4-a716-446655440000',
      zhihu_id: '123456789',
      url: 'https://zhuanlan.zhihu.com/p/123456789',
      title: '测试文章',
      tags: [],
      lead: '首段',
    });
    expect(result.success).toBe(false);
  });
});

describe('Tree schemas', () => {
  it('rejects empty highlight_text', () => {
    const node = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tree_id: '550e8400-e29b-41d4-a716-446655440001',
      parent_id: null,
      highlight_text: '',
      question_text: '',
      title: 'Test',
      answer_original: 'Original text',
      answer_extra: 'Extra explanation',
      sources: [],
      created_at: '2026-09-13T00:00:00.000Z',
    };
    expect(LocalNodeSchema.safeParse(node).success).toBe(false);
  });

  it('source URL must be http/https', () => {
    expect(SourceSchema.safeParse({ title: 'test', url: 'https://example.com' }).success).toBe(true);
    expect(SourceSchema.safeParse({ title: 'test', url: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('candidates max 3', () => {
    const candidates = Array.from({ length: 4 }, (_, i) => ({
      global_node_id: `node-${i}`,
      title: `Node ${i}`,
      degree: 'exact' as const,
      reason: 'test',
    }));
    // LocalTree's match_candidates max 3
    expect(candidates.length).toBe(4);
    const parsed = CandidateSchema.array().max(3).safeParse(candidates);
    expect(parsed.success).toBe(false);
  });
});

describe('Agent schemas', () => {
  it('classify output accepts null slug', () => {
    expect(ClassifyOutputSchema.safeParse({ slug: null }).success).toBe(true);
  });

  it('root output rejects missing title', () => {
    expect(GenerateRootOutputSchema.safeParse({
      extra: 'test',
      sources: [],
      candidates: [],
    }).success).toBe(false);
  });

  it('followup output has no candidates field', () => {
    const result = GenerateFollowupOutputSchema.safeParse({
      title: 'test',
      extra: 'explanation',
      sources: [],
    });
    expect(result.success).toBe(true);
    // candidates field should not exist in followup output
    expect('candidates' in (result as { success: true; data: Record<string, unknown> }).data).toBe(false);
  });
});

describe('Bridge schemas', () => {
  it('rejects unknown bridge action', () => {
    expect(BridgeActionSchema.safeParse('READ_TOKEN').success).toBe(false);
  });

  it('accepts valid bridge request', () => {
    expect(BridgeRequestSchema.safeParse({
      action: 'HELLO',
      version: BridgeProtocolVersion,
      payload: null,
    }).success).toBe(true);
  });

  it('rejects wrong protocol version', () => {
    expect(BridgeRequestSchema.safeParse({
      action: 'HELLO',
      version: 999,
      payload: null,
    }).success).toBe(false);
  });
});

describe('Sync schemas', () => {
  it('LocalSyncMeta validates partitions', () => {
    expect(LocalSyncMetaSchema.safeParse({
      partition: 'guest:abc',
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    }).success).toBe(true);

    expect(LocalSyncMetaSchema.safeParse({
      partition: 'uid:12345',
      cloudState: 'confirmed',
      ackVersion: 3,
      dirty: false,
      pendingDelete: false,
      createSeq: 1,
    }).success).toBe(true);
  });

  it('normalizeTreeForHash is deterministic', () => {
    const tree = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      root_node_id: '550e8400-e29b-41d4-a716-446655440001',
      discipline_slug: 'agent-app-dev' as const,
      global_node_id: 'agent-app-dev/tool-calling',
      match_candidates: [],
      anchor_paragraph: 'paragraph',
      anchor_highlight: 'highlight',
      version: 1,
      nodes: [
        { id: 'b', parent_id: 'a', highlight_text: 'hl', question_text: 'q', title: 'B', answer_original: 'o', answer_extra: 'e', sources: [] },
        { id: 'a', parent_id: null, highlight_text: 'hl', question_text: '', title: 'A', answer_original: 'o', answer_extra: 'e', sources: [] },
      ],
    };
    const hash1 = normalizeTreeForHash(tree);
    const hash2 = normalizeTreeForHash(tree);
    expect(hash1).toBe(hash2);

    // Same content, different node order → same hash (nodes are sorted by ID)
    const treeReordered = {
      ...tree,
      nodes: [...tree.nodes].reverse(),
    };
    expect(normalizeTreeForHash(treeReordered)).toBe(hash1);
  });

  it('JSON roundtrip preserves IDs', () => {
    const entry: { root_id: string; tree_id: string; version: number; hash: string } = {
      root_id: '550e8400-e29b-41d4-a716-446655440001',
      tree_id: '550e8400-e29b-41d4-a716-446655440000',
      version: 5,
      hash: 'abc123',
    };
    const json = JSON.stringify(entry);
    const parsed = SyncManifestEntrySchema.safeParse(JSON.parse(json));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.root_id).toBe(entry.root_id);
      expect(parsed.data.tree_id).toBe(entry.tree_id);
    }
  });
});

describe('Error response', () => {
  it('validates error response', () => {
    const result = ErrorResponseSchema.safeParse({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
        retryable: false,
      },
      request_id: 'req-123',
    });
    expect(result.success).toBe(true);
  });
});
