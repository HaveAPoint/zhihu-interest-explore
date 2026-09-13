// Demo data fixture for unauthenticated visitors without extension
// Complies with 作者本人开发计划 §4.6 (State 1)

export interface DemoExplorationRecord {
  tree_id: string;
  root_node_id: string;
  article_id: string;
  article_title: string;
  article_url: string;
  root_title: string;
  created_at: string;
}

export const DEMO_LIT_NODE_IDS = [
  'agent-app-dev/tool-calling',
  'agent-app-dev/core-patterns/react',
  'cognitive-psychology/research-methods/behavioral-paradigms/subtraction-method',
  'distributed-systems/consensus/raft',
];

export const DEMO_RECORDS: Record<string, DemoExplorationRecord[]> = {
  'agent-app-dev/tool-calling': [
    {
      tree_id: 'demo-tree-001',
      root_node_id: 'demo-root-001',
      article_id: 'demo-article-001',
      article_title: '示例文章：大模型 Agent 架构与工具调用实战',
      article_url: 'https://zhuanlan.zhihu.com/p/100000001',
      root_title: '函数调用机制',
      created_at: '2026-09-13T10:00:00.000Z',
    },
  ],
  'agent-app-dev/core-patterns/react': [
    {
      tree_id: 'demo-tree-002',
      root_node_id: 'demo-root-002',
      article_id: 'demo-article-001',
      article_title: '示例文章：大模型 Agent 架构与工具调用实战',
      article_url: 'https://zhuanlan.zhihu.com/p/100000001',
      root_title: 'ReAct 思考行动循环',
      created_at: '2026-09-13T10:15:00.000Z',
    },
  ],
  'cognitive-psychology/research-methods/behavioral-paradigms/subtraction-method': [
    {
      tree_id: 'demo-tree-003',
      root_node_id: 'demo-root-003',
      article_id: 'demo-article-002',
      article_title: '示例文章：认知心理学中的经典实验范式',
      article_url: 'https://zhuanlan.zhihu.com/p/100000002',
      root_title: '减法反应时法',
      created_at: '2026-09-13T11:00:00.000Z',
    },
  ],
};
