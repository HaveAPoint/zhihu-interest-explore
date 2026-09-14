// View types and interfaces for the overlay drawer
// Complies with 插件局部树执行计划 §3.1, §3.3, §5 (LT04)

import type { DisciplineSlug } from '@zhihu-explore/contracts';
import type { AnswerSelection } from '@zhihu-explore/domain';

export const DISCIPLINE_CONFIG: Record<DisciplineSlug, { name: string; desc: string }> = {
  'agent-app-dev': { name: 'AI Agent 应用开发', desc: 'LLM、Tool Use、ReAct 架构、记忆系统' },
  'cognitive-psychology': { name: '认知心理学', desc: '工作记忆、减法反应时、认知负荷模型' },
  'distributed-systems': { name: '分布式系统', desc: 'Raft 共识、Paxos、CAP 定理、分布式一致性' },
};

export interface OverlayCallbacks {
  onSubmitQuestion: (question: string) => Promise<void>;
  onFollowupQuestion: (parentNodeId: string, highlight: string, question: string, anchor?: any) => Promise<void>;
  onDeleteNode: (treeId: string, nodeId: string) => Promise<void>;
  onClose: () => void;
  onChangeDisciplineClick?: () => void;
  onSelectDiscipline?: (slug: DisciplineSlug) => Promise<void>;
  onRetryClassify?: () => Promise<void>;
  onSelectNode?: (nodeId: string) => void;
  onToggleSubtree?: (nodeId: string) => void;
  onAnswerSelectionChange?: (selection: AnswerSelection | null) => void;
}

export interface ComposerCallbacks {
  onSubmit: (question: string) => Promise<void>;
  onClearSelection?: () => void;
}
