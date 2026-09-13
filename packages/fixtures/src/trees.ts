import type { LocalTree, LocalNode, TreeContext } from '@zhihu-explore/contracts';

export const sampleRootNodeFixture: LocalNode = {
  id: '770e8400-e29b-41d4-a716-446655440001',
  tree_id: '660e8400-e29b-41d4-a716-446655440000',
  parent_id: null,
  highlight_text: '工具调用（Tool Calling / Function Calling）',
  question_text: '工具调用的核心机制是什么？',
  title: '工具调用机制',
  answer_original: '通过工具调用（Tool Calling / Function Calling），Agent 可以突破自身参数知识的限制，连接数据库、搜索引擎和沙箱计算环境。',
  answer_extra: '工具调用允许大语言模型生成结构化 JSON 参数，外部运行时捕获后执行对应函数并将结果回填。',
  sources: [
    { title: 'OpenAI Function Calling Guide', url: 'https://platform.openai.com/docs/guides/function-calling' },
  ],
  created_at: '2026-09-13T10:00:00.000Z',
};

export const sampleFollowupNodeFixture: LocalNode = {
  id: '770e8400-e29b-41d4-a716-446655440002',
  tree_id: '660e8400-e29b-41d4-a716-446655440000',
  parent_id: '770e8400-e29b-41d4-a716-446655440001',
  highlight_text: '结构化 JSON 参数',
  question_text: '如何保证生成的 JSON 格式正确？',
  title: 'JSON 语法保证',
  answer_original: '工具调用允许大语言模型生成结构化 JSON 参数，外部运行时捕获后执行对应函数并将结果回填。',
  answer_extra: '现代框架采用基于上下文无关文法的受约束解码（Constrained Decoding）技术，在采样阶段直接屏蔽非法 Token。',
  sources: [],
  created_at: '2026-09-13T10:05:00.000Z',
};

export const sampleLocalTreeFixture: LocalTree = {
  id: '660e8400-e29b-41d4-a716-446655440000',
  root_node_id: '770e8400-e29b-41d4-a716-446655440001',
  uid: 'user-10001',
  article_id: '550e8400-e29b-41d4-a716-446655440001',
  discipline_slug: 'agent-app-dev',
  global_node_id: 'agent-app-dev/tool-calling',
  match_candidates: [
    {
      global_node_id: 'agent-app-dev/tool-calling',
      title: '工具使用与调用',
      degree: 'exact',
      reason: '高亮核心概念即工具调用',
    },
  ],
  anchor_paragraph: '通过工具调用（Tool Calling / Function Calling），Agent 可以突破自身参数知识的限制，连接数据库、搜索引擎和沙箱计算环境。',
  anchor_highlight: '工具调用（Tool Calling / Function Calling）',
  version: 1,
  nodes: [sampleRootNodeFixture, sampleFollowupNodeFixture],
  created_at: '2026-09-13T10:00:00.000Z',
  updated_at: '2026-09-13T10:05:00.000Z',
};

export const sampleTreeContextFixture: TreeContext = {
  nodes: [
    {
      id: sampleRootNodeFixture.id,
      parent_id: null,
      title: sampleRootNodeFixture.title,
      highlight_text: sampleRootNodeFixture.highlight_text,
      question_text: sampleRootNodeFixture.question_text,
      answer_extra: sampleRootNodeFixture.answer_extra,
      is_current: false,
    },
    {
      id: sampleFollowupNodeFixture.id,
      parent_id: sampleRootNodeFixture.id,
      title: sampleFollowupNodeFixture.title,
      highlight_text: sampleFollowupNodeFixture.highlight_text,
      question_text: sampleFollowupNodeFixture.question_text,
      answer_extra: sampleFollowupNodeFixture.answer_extra,
      is_current: true,
    },
  ],
};
