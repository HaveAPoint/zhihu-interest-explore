import type { ArticleContext, ResolveArticleInput } from '@zhihu-explore/contracts';

export const agentArticleFixture: ArticleContext = {
  title: '深入理解大模型 Agent 与函数调用',
  tags: ['AI', 'Agent', 'LLM', '函数调用'],
  url: 'https://zhuanlan.zhihu.com/p/100000001',
  content_text: `大语言模型 Agent 是当前人工智能应用的核心方向。
通过工具调用（Tool Calling / Function Calling），Agent 可以突破自身参数知识的限制，
连接数据库、搜索引擎和沙箱计算环境。
典型的 ReAct 范式交替进行思考与行动，使复杂任务能够分步求解。
记忆系统则帮助 Agent 维持跨会话的上下文，包括工作记忆与长期向量检索。`,
};

export const psychologyArticleFixture: ArticleContext = {
  title: '从减法反应时看认知心理学的心理加工阶段',
  tags: ['心理学', '认知心理学', '记忆', '实验'],
  url: 'https://zhuanlan.zhihu.com/p/100000002',
  content_text: `认知心理学关注人脑如何获取、表征与处理信息。
减法反应时法是由荷兰生理学家唐德斯提出的经典行为实验范式。
通过比较简单反应、选择反应与辨别反应的时间差，
研究者得以量化推断不同心理加工阶段所需的时间消耗。`,
};

export const distributedSystemsArticleFixture: ArticleContext = {
  title: 'Raft 共识算法与分布式一致性原理剖析',
  tags: ['计算机系统', '分布式系统', '共识算法', 'Raft'],
  url: 'https://zhuanlan.zhihu.com/p/100000003',
  content_text: `分布式系统在现代云原生架构中无处不在。
为了在不可靠的网络和机器故障假设下达成数据一致性，共识算法至关重要。
相较于复杂的 Paxos，Raft 算法通过强领导者机制、日志复制和任期安全性，
显著提升了系统的可理解性与工程实现可靠性。`,
};

export const unknownArticleFixture: ArticleContext = {
  title: '周末烘焙指南：如何制作完美的法式可颂',
  tags: ['美食', '烘焙', '生活'],
  url: 'https://zhuanlan.zhihu.com/p/100000004',
  content_text: `制作正宗的法式可颂需要耐心与严谨的温度控制。
面团发酵、包油折叠、多轮冷藏松弛，每一步都决定了最终的蜂窝结构与酥脆口感。`,
};

export const sampleResolveInputFixture: ResolveArticleInput = {
  article_id: '550e8400-e29b-41d4-a716-446655440001',
  zhihu_id: '100000001',
  url: agentArticleFixture.url,
  title: agentArticleFixture.title,
  tags: agentArticleFixture.tags,
  lead: '大语言模型 Agent 是当前人工智能应用的核心方向。',
  content_text: agentArticleFixture.content_text,
};
