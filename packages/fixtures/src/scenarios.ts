import type {
  ClassifyInput,
  ClassifyOutput,
  GenerateRootInput,
  GenerateRootOutput,
  GenerateFollowupInput,
  GenerateFollowupOutput,
} from '@zhihu-explore/contracts';

export type MockScenario =
  | 'default'
  | 'exact_match'
  | 'broader_then_exact'
  | 'zero_candidates'
  | 'delay'
  | 'failure'
  | 'empty_title'
  | 'invalid_candidate'
  | 'zero_sources';

export interface MockAgentOptions {
  scenario?: MockScenario;
  delayMs?: number;
}

export function buildMockClassify(input: ClassifyInput, options: MockAgentOptions = {}): ClassifyOutput {
  if (options.scenario === 'failure') {
    throw new Error('Mock Agent classify failure simulated');
  }

  const text = `${input.title} ${input.tags.join(' ')} ${input.lead}`.toLowerCase();
  if (text.includes('agent') || text.includes('llm') || text.includes('大模型') || text.includes('提示词') || text.includes('工具调用')) {
    return { slug: 'agent-app-dev' };
  }
  if (text.includes('认知') || text.includes('心理') || text.includes('记忆') || text.includes('注意力') || text.includes('学习')) {
    return { slug: 'cognitive-psychology' };
  }
  if (text.includes('分布式') || text.includes('一致性') || text.includes('共识') || text.includes('raft') || text.includes('paxos')) {
    return { slug: 'distributed-systems' };
  }
  return { slug: null };
}

export function buildMockGenerateRoot(input: GenerateRootInput, options: MockAgentOptions = {}): GenerateRootOutput {
  if (options.scenario === 'failure') {
    throw new Error('Mock Agent generateRoot failure simulated');
  }

  const baseTitle = options.scenario === 'empty_title' ? '' : (input.highlight.slice(0, 10) || '高亮概念');
  const baseSources = options.scenario === 'zero_sources'
    ? []
    : [
        {
          title: '官方参考文档',
          url: 'https://zhuanlan.zhihu.com/p/sample-source',
        },
      ];

  let candidates: GenerateRootOutput['candidates'] = [];

  switch (options.scenario) {
    case 'exact_match': {
      const matchNode = input.disciplineSkeleton.find((n) => n.id.includes('tool-calling')) || input.disciplineSkeleton[0];
      if (matchNode) {
        candidates = [
          {
            node_id: matchNode.id,
            degree: 'exact',
            reason: '概念完全精确匹配',
          },
        ];
      }
      break;
    }
    case 'broader_then_exact': {
      if (input.disciplineSkeleton.length >= 2) {
        candidates = [
          {
            node_id: input.disciplineSkeleton[0]!.id,
            degree: 'broader',
            reason: '上位宏观范畴',
          },
          {
            node_id: input.disciplineSkeleton[1]!.id,
            degree: 'exact',
            reason: '精确下位概念',
          },
        ];
      }
      break;
    }
    case 'invalid_candidate': {
      candidates = [
        {
          node_id: 'nonexistent-discipline/invalid-id',
          degree: 'exact',
          reason: '伪造的不在骨架内的ID',
        },
      ];
      break;
    }
    case 'zero_candidates': {
      candidates = [];
      break;
    }
    default: {
      // Default: match first node if exists
      if (input.disciplineSkeleton.length > 0) {
        const found = input.disciplineSkeleton.find((n) => input.highlight.includes(n.title)) || input.disciplineSkeleton[0]!;
        candidates = [
          {
            node_id: found.id,
            degree: 'exact',
            reason: '高亮包含该节点核心关键词',
          },
        ];
      }
      break;
    }
  }

  return {
    title: baseTitle,
    extra: `基于原文高亮「${input.highlight}」，该概念在学科体系中具有重要理论与应用价值。${input.question ? `针对您的问题「${input.question}」：` : ''}这是示例解释。`,
    sources: baseSources,
    candidates,
  };
}

export function buildMockGenerateFollowup(input: GenerateFollowupInput, options: MockAgentOptions = {}): GenerateFollowupOutput {
  if (options.scenario === 'failure') {
    throw new Error('Mock Agent generateFollowup failure simulated');
  }

  const baseTitle = options.scenario === 'empty_title' ? '' : (input.highlight.slice(0, 10) || '追问概念');
  const baseSources = options.scenario === 'zero_sources'
    ? []
    : [
        {
          title: '深入延伸资料',
          url: 'https://zhuanlan.zhihu.com/p/followup-source',
        },
      ];

  return {
    title: baseTitle,
    extra: `针对父回答高亮「${input.highlight}」的进一步探讨：${input.question ? `关于「${input.question}」，` : ''}该细分机制有助于理解整体架构设计。`,
    sources: baseSources,
  };
}
