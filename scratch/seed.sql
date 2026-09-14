BEGIN;

INSERT INTO disciplines (slug, name, major, origin)
VALUES ('agent-app-dev', 'Agent 应用开发', '人工智能', 'preset')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, major = EXCLUDED.major;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/root', 'agent-app-dev', NULL, 'Agent 应用开发', '["AI Agent Development","LLM Agent"]'::jsonb, '以大语言模型为核心控制器，具备感知、规划、记忆和工具使用能力以自主完成复杂任务的应用开发体系。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/core-patterns', 'agent-app-dev', 'agent-app-dev/root', '推理与行动范式', '["Reasoning and Acting Patterns","Agent Design Patterns"]'::jsonb, '大模型在执行任务时协调内部推理思考与外部环境交互的核心思维架构。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/core-patterns/react', 'agent-app-dev', 'agent-app-dev/core-patterns', 'ReAct 范式', '["Reasoning and Acting","ReAct"]'::jsonb, '交替执行「思考(Thought) - 行动(Action) - 观察(Observation)」的闭环迭代推理框架。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/core-patterns/plan-and-solve', 'agent-app-dev', 'agent-app-dev/core-patterns', '规划后执行范式', '["Plan-and-Solve","Plan-and-Execute"]'::jsonb, '先将复杂目标分解为结构化的子任务执行计划，再逐步或并行调度执行器完成的模式。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/core-patterns/reflection', 'agent-app-dev', 'agent-app-dev/core-patterns', '自我反思与纠错', '["Reflexion","Self-Correction","Self-Refine"]'::jsonb, 'Agent 评估自身输出或工具执行反馈，识别错误并自主调整策略的元认知机制。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/tool-calling', 'agent-app-dev', 'agent-app-dev/root', '工具使用与调用', '["Tool Use","Tool Calling","Function Calling"]'::jsonb, 'Agent 通过结构化协议调用外部 API、计算引擎或代码环境以突破纯模型能力边界的机制。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/tool-calling/function-calling', 'agent-app-dev', 'agent-app-dev/tool-calling', '函数调用机制', '["Function Calling","Tool Calling Protocol"]'::jsonb, '模型根据预定义 JSON Schema 提取参数并输出结构化调用意图的协议能力。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/tool-calling/tool-routing', 'agent-app-dev', 'agent-app-dev/tool-calling', '工具检索与路由', '["Tool Retrieval","Tool Routing"]'::jsonb, '在大量备选工具集中，根据用户意图语义检索并动态选择最相关工具子集的机制。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/tool-calling/schema-validation', 'agent-app-dev', 'agent-app-dev/tool-calling', '参数校验与自愈', '["Schema Validation","Grammar-based Decoding"]'::jsonb, '对模型生成的工具调用参数进行类型校验，并在解析失败时将错误信息回填重试的机制。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/tool-calling/execution-sandbox', 'agent-app-dev', 'agent-app-dev/tool-calling', '执行沙箱环境', '["Code Interpreter Sandbox","Execution Environment"]'::jsonb, '为 Agent 运行 Python/Bash 代码或高风险操作提供网络与文件隔离的安全执行环境。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/memory-systems', 'agent-app-dev', 'agent-app-dev/root', '记忆与上下文管理', '["Memory Systems","Context Management"]'::jsonb, '维持 Agent 在短期多轮对话和长期跨会话任务中的信息连续性与经验沉淀的系统。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/memory-systems/working-memory', 'agent-app-dev', 'agent-app-dev/memory-systems', '工作记忆与上下文窗口', '["Working Memory","Short-term Memory","Context Window Compression"]'::jsonb, '在单次运行的上下文窗口中维持当前状态、历史消息压缩与变量槽位的机制。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/memory-systems/episodic-memory', 'agent-app-dev', 'agent-app-dev/memory-systems', '情境与经验记忆', '["Episodic Memory","Experience Replay"]'::jsonb, '记录 Agent 过去成功与失败的任务轨迹并在面对相似新任务时作为少样本参考检索的能力。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/memory-systems/semantic-memory', 'agent-app-dev', 'agent-app-dev/memory-systems', '语义知识记忆', '["Semantic Memory","Long-term RAG"]'::jsonb, '利用向量检索或知识图谱持久化领域事实并在生成时召回的外挂知识库。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/planning-decomposition', 'agent-app-dev', 'agent-app-dev/root', '规划与任务分解', '["Planning","Task Decomposition"]'::jsonb, '将高层抽象指令系统性拆解为具备依赖关系和终止条件的子步骤序列的能力。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/planning-decomposition/tree-search', 'agent-app-dev', 'agent-app-dev/planning-decomposition', '树形搜索规划', '["Tree of Thoughts","ToT","MCTS for LLM"]'::jsonb, '在推理路径上进行分支探索、状态评估与回溯剪枝的前瞻性规划方法。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/planning-decomposition/dag-planning', 'agent-app-dev', 'agent-app-dev/planning-decomposition', '有向无环图工作流', '["DAG Workflow","Pipeline Planning"]'::jsonb, '以有向无环图组织任务节点并在满足先决条件时自动触发下游节点并发执行的编排机制。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/multi-agent', 'agent-app-dev', 'agent-app-dev/root', '多智能体协作', '["Multi-Agent Systems","MAS"]'::jsonb, '多个分工明确的专门化 Agent 协同通信以解决单一模型难以胜任的复杂系统的架构体系。', 4)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/multi-agent/topologies', 'agent-app-dev', 'agent-app-dev/multi-agent', '协作拓扑架构', '["Multi-Agent Topology","Hierarchical / Swarm"]'::jsonb, '主从层级制、对等辩论制或流水线链式等不同角色间的信息流向与决策权结构。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/multi-agent/communication', 'agent-app-dev', 'agent-app-dev/multi-agent', '通信协议与消息总线', '["Agent Communication Protocol","Message Bus"]'::jsonb, '定义 Agent 之间传递意图、委派子任务、共享黑板状态和仲裁冲突的结构化消息标准。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/evaluation-observability', 'agent-app-dev', 'agent-app-dev/root', '评估、追踪与可观测性', '["Evaluation and Observability","Agent Tracing"]'::jsonb, '监测 Agent 内部执行链路、衡量任务达成率并对幻觉与失败根因进行量化归因的工程支撑体系。', 5)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/evaluation-observability/tracing', 'agent-app-dev', 'agent-app-dev/evaluation-observability', '调用链路追踪', '["Execution Tracing","Run Tree Visualization"]'::jsonb, '记录包含 Prompt 输入、模型推理耗时、Token 消耗及工具输入输出的树形调用链路技术。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/evaluation-observability/benchmarking', 'agent-app-dev', 'agent-app-dev/evaluation-observability', '基准评测与端到端指标', '["Agent Benchmark","E2E Task Evaluation"]'::jsonb, '使用具有真实执行环境的基准测试集评估 Agent 在代码生成、网页浏览或复杂操作上的完工率指标体系。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/safety-guardrails', 'agent-app-dev', 'agent-app-dev/root', '安全、防护与人机协同', '["Safety Guardrails","Human-in-the-loop"]'::jsonb, '防御恶意提示词攻击、拦截不可逆危险动作并引入人工确认的安全保障设计。', 6)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/safety-guardrails/prompt-injection', 'agent-app-dev', 'agent-app-dev/safety-guardrails', '提示词注入防御', '["Prompt Injection Defense","Indirect Prompt Injection"]'::jsonb, '防止第三方网页或数据内容伪装成系统指令劫持 Agent 行为的输入清洗与权限隔离手段。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('agent-app-dev/safety-guardrails/human-in-the-loop', 'agent-app-dev', 'agent-app-dev/safety-guardrails', '人机协同审批', '["Human-in-the-loop","HITL Interrupt"]'::jsonb, '在执行写文件、转账、发送邮件或修改数据库等高影响度工具前主动挂起等待人工授权的机制。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO disciplines (slug, name, major, origin)
VALUES ('cognitive-psychology', '认知心理学', '心理学', 'preset')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, major = EXCLUDED.major;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/root', 'cognitive-psychology', NULL, '认知心理学', '["cognitive psychology"]'::jsonb, '研究人如何获取、表征、加工和运用信息的心理学分支。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods', 'cognitive-psychology', 'cognitive-psychology/root', '研究方法与范式', '["research methods"]'::jsonb, '用实验、脑活动测量与计算模拟等手段推断内部心理过程的方法体系。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/behavioral-paradigms', 'cognitive-psychology', 'cognitive-psychology/research-methods', '行为实验范式', '["behavioral paradigms","reaction time methods"]'::jsonb, '通过操纵任务条件并记录反应时与正确率来推断加工阶段的实验方法。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/behavioral-paradigms/subtraction-method', 'cognitive-psychology', 'cognitive-psychology/research-methods/behavioral-paradigms', '减法反应时法', '["subtraction method","Donders'' method"]'::jsonb, '用仅相差一个加工阶段的两种任务的反应时之差来估计该阶段所需时间。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/behavioral-paradigms/semantic-priming', 'cognitive-psychology', 'cognitive-psychology/research-methods/behavioral-paradigms', '语义启动效应', '["semantic priming","lexical decision task"]'::jsonb, '先呈现语义相关的启动词会加快随后目标词的判断速度。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/cognitive-neuroscience', 'cognitive-psychology', 'cognitive-psychology/research-methods', '认知神经科学技术', '["cognitive neuroscience methods"]'::jsonb, '借助脑活动测量技术刻画认知加工神经基础的技术集合。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/cognitive-neuroscience/fmri', 'cognitive-psychology', 'cognitive-psychology/research-methods/cognitive-neuroscience', '功能磁共振成像', '["fMRI","BOLD signal","功能性磁共振"]'::jsonb, '通过血氧水平依赖信号间接测量脑区活动强度的成像技术。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/cognitive-neuroscience/erp', 'cognitive-psychology', 'cognitive-psychology/research-methods/cognitive-neuroscience', '事件相关电位', '["ERP","event-related potential"]'::jsonb, '从脑电中叠加平均得到的与特定事件时间锁定的电位波形。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/cognitive-neuroscience/erp/n400', 'cognitive-psychology', 'cognitive-psychology/research-methods/cognitive-neuroscience/erp', 'N400 成分', '["N400"]'::jsonb, '对语义预期违反最为敏感的中央顶区负向脑电成分。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/computational-modeling', 'cognitive-psychology', 'cognitive-psychology/research-methods', '计算建模', '["computational modeling"]'::jsonb, '用形式化模型模拟认知过程并预测行为数据的研究途径。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/computational-modeling/act-r', 'cognitive-psychology', 'cognitive-psychology/research-methods/computational-modeling', 'ACT-R 符号加工架构', '["ACT-R","production system"]'::jsonb, '以产生式规则和陈述性组块刻画认知的统一符号加工架构。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/research-methods/computational-modeling/connectionist-pdp', 'cognitive-psychology', 'cognitive-psychology/research-methods/computational-modeling', '联结主义并行分布加工模型', '["connectionism","PDP","parallel distributed processing"]'::jsonb, '用大量简单单元的并行联结与权重学习来解释认知的建模框架。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception', 'cognitive-psychology', 'cognitive-psychology/root', '知觉', '["perception"]'::jsonb, '对感觉输入进行组织与解释并形成客体表征的加工过程。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/pattern-recognition', 'cognitive-psychology', 'cognitive-psychology/perception', '模式识别', '["pattern recognition","object recognition"]'::jsonb, '把输入的感觉刺激与长时记忆中的表征匹配并加以归类的过程。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/pattern-recognition/feature-analysis', 'cognitive-psychology', 'cognitive-psychology/perception/pattern-recognition', '特征分析与鬼域模型', '["feature analysis","Pandemonium model"]'::jsonb, '主张识别先抽取局部特征、再逐层整合为整体模式的层级模型。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/pattern-recognition/recognition-by-components', 'cognitive-psychology', 'cognitive-psychology/perception/pattern-recognition', '成分识别理论', '["recognition-by-components","geon","几何离子"]'::jsonb, '主张复杂物体由有限几何离子的组合方式来表征并据此识别。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/pattern-recognition/face-inversion-effect', 'cognitive-psychology', 'cognitive-psychology/perception/pattern-recognition', '面孔倒置效应', '["face inversion effect","holistic processing"]'::jsonb, '面孔倒置后识别成绩下降的幅度远大于其他类别物体。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/pattern-recognition/prosopagnosia', 'cognitive-psychology', 'cognitive-psychology/perception/pattern-recognition', '面孔失认症', '["prosopagnosia","face blindness"]'::jsonb, '基本视觉功能保留却不能辨认熟悉面孔的选择性障碍。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/perceptual-organization', 'cognitive-psychology', 'cognitive-psychology/perception', '知觉组织', '["perceptual organization","Gestalt principles"]'::jsonb, '把零散的感觉成分整合为稳定客体与背景的组织加工。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/perceptual-organization/figure-ground-segregation', 'cognitive-psychology', 'cognitive-psychology/perception/perceptual-organization', '图形—背景分离', '["figure-ground segregation"]'::jsonb, '视野被划分为轮廓凸显的图形与退居其后的背景两部分。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/perception/perceptual-organization/size-constancy', 'cognitive-psychology', 'cognitive-psychology/perception/perceptual-organization', '大小恒常性', '["size constancy"]'::jsonb, '视网膜投影随距离变化时仍把物体知觉为固定大小的倾向。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention', 'cognitive-psychology', 'cognitive-psychology/root', '注意', '["attention"]'::jsonb, '对有限认知资源进行选择与分配的调节机制。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/selective-attention', 'cognitive-psychology', 'cognitive-psychology/attention', '选择性注意', '["selective attention","dichotic listening"]'::jsonb, '从并行输入的多路信息中挑选部分进入深度加工的过程。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/selective-attention/broadbent-filter-model', 'cognitive-psychology', 'cognitive-psychology/attention/selective-attention', '过滤器模型', '["Broadbent filter model","early selection"]'::jsonb, '主张感觉分析后按物理特征以全或无方式筛选通道的早期选择模型。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/selective-attention/treisman-attenuation-model', 'cognitive-psychology', 'cognitive-psychology/attention/selective-attention', '衰减模型', '["attenuation model","Treisman"]'::jsonb, '主张未被注意通道的信号被减弱而非彻底阻断的选择模型。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/visual-attention', 'cognitive-psychology', 'cognitive-psychology/attention', '视觉注意', '["visual attention"]'::jsonb, '在视觉空间位置与客体之间分配注意资源的机制。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/visual-attention/feature-integration-theory', 'cognitive-psychology', 'cognitive-psychology/attention/visual-attention', '特征整合理论', '["feature integration theory","FIT","visual search"]'::jsonb, '主张特征先被平行登记、再由集中注意把特征绑定成客体的理论。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/visual-attention/feature-integration-theory/illusory-conjunction', 'cognitive-psychology', 'cognitive-psychology/attention/visual-attention/feature-integration-theory', '错觉性结合', '["illusory conjunction"]'::jsonb, '注意不足时把分属不同客体的特征错误绑定在一起的报告错误。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/visual-attention/posner-cueing-paradigm', 'cognitive-psychology', 'cognitive-psychology/attention/visual-attention', '波斯纳线索化范式', '["Posner cueing paradigm","spatial cueing"]'::jsonb, '用位置线索的有效与无效试次测量注意定向的收益与代价。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/visual-attention/inattentional-blindness', 'cognitive-psychology', 'cognitive-psychology/attention/visual-attention', '非注意盲视', '["inattentional blindness"]'::jsonb, '注意被其他任务占用时对视野中显著物体视而不见的现象。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/automaticity', 'cognitive-psychology', 'cognitive-psychology/attention', '自动化与分配性注意', '["automaticity","divided attention"]'::jsonb, '加工经练习变得少耗资源以及同时应对多项任务的问题。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/automaticity/stroop-effect', 'cognitive-psychology', 'cognitive-psychology/attention/automaticity', '斯特鲁普效应', '["Stroop effect","color-word interference"]'::jsonb, '字义与墨色不一致时命名颜色的反应显著变慢的干扰现象。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/attention/automaticity/automatic-and-controlled-processing', 'cognitive-psychology', 'cognitive-psychology/attention/automaticity', '自动加工与控制加工', '["automatic processing","controlled processing","两过程说"]'::jsonb, '区分不占资源、难以中止的自动加工与耗资源、可灵活调控的控制加工。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory', 'cognitive-psychology', 'cognitive-psychology/root', '记忆', '["memory"]'::jsonb, '对信息进行编码、保持与提取的系统及其加工过程。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems', 'cognitive-psychology', 'cognitive-psychology/memory', '记忆系统', '["memory systems","multi-store model"]'::jsonb, '按保持时间与表征性质划分的多重记忆存储结构。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/iconic-memory-partial-report', 'cognitive-psychology', 'cognitive-psychology/memory/systems', '图像记忆与部分报告法', '["iconic memory","Sperling partial report","感觉记忆"]'::jsonb, '视觉感觉登记容量大但迅速衰退，可由部分报告法测出其真实容量。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/working-memory', 'cognitive-psychology', 'cognitive-psychology/memory/systems', '短时记忆与工作记忆', '["short-term memory","working memory","Baddeley model"]'::jsonb, '在数秒内保持并操作当前信息的容量有限系统。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/working-memory/memory-span-seven', 'cognitive-psychology', 'cognitive-psychology/memory/systems/working-memory', '短时记忆容量的神奇数字7', '["magical number seven","memory span","chunk"]'::jsonb, '直接记忆广度约为七个组块上下浮动的经验概括。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/working-memory/phonological-loop', 'cognitive-psychology', 'cognitive-psychology/memory/systems/working-memory', '语音回路', '["phonological loop","articulatory rehearsal"]'::jsonb, '以语音编码保持言语材料并靠默读复述刷新的工作记忆子系统。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/working-memory/visuospatial-sketchpad', 'cognitive-psychology', 'cognitive-psychology/memory/systems/working-memory', '视空间画板', '["visuospatial sketchpad"]'::jsonb, '暂存并操作视觉与空间信息的工作记忆子系统。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/working-memory/central-executive-dual-task', 'cognitive-psychology', 'cognitive-psychology/memory/systems/working-memory', '双任务范式下的中央执行器', '["central executive","dual-task paradigm"]'::jsonb, '由两任务资源竞争揭示的负责注意分配与子系统协调的控制成分。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/long-term-memory', 'cognitive-psychology', 'cognitive-psychology/memory/systems', '长时记忆', '["long-term memory","LTM"]'::jsonb, '容量近乎无限且可长期保持的记忆存储。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/long-term-memory/episodic-and-semantic-memory', 'cognitive-psychology', 'cognitive-psychology/memory/systems/long-term-memory', '情景记忆与语义记忆的区分', '["episodic memory","semantic memory","Tulving"]'::jsonb, '按是否带有具体时空情境划分的两类陈述性长时记忆。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/long-term-memory/procedural-memory', 'cognitive-psychology', 'cognitive-psychology/memory/systems/long-term-memory', '程序性记忆', '["procedural memory","implicit memory","内隐记忆"]'::jsonb, '表现为技能与操作程序、难以用言语报告的记忆。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/systems/long-term-memory/anterograde-amnesia-hm', 'cognitive-psychology', 'cognitive-psychology/memory/systems/long-term-memory', 'H.M. 病例与顺行性遗忘', '["H.M.","anterograde amnesia","medial temporal lobe"]'::jsonb, '双侧内侧颞叶损伤后不能形成新的陈述性记忆的经典病例证据。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/processes', 'cognitive-psychology', 'cognitive-psychology/memory', '记忆过程', '["memory processes","encoding and retrieval"]'::jsonb, '决定信息能否被记住和取出的编码、保持与提取环节。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/processes/levels-of-processing', 'cognitive-psychology', 'cognitive-psychology/memory/processes', '加工水平说', '["levels of processing","Craik & Lockhart"]'::jsonb, '主张记忆保持取决于编码时语义加工的深度而非复述时间。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/processes/encoding-specificity', 'cognitive-psychology', 'cognitive-psychology/memory/processes', '编码特异性原则', '["encoding specificity principle","context-dependent memory"]'::jsonb, '提取线索与编码时情境越匹配，回忆成绩越好。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/processes/serial-position-effect', 'cognitive-psychology', 'cognitive-psychology/memory/processes', '系列位置效应', '["serial position effect","primacy effect","recency effect"]'::jsonb, '自由回忆中系列开头与末尾项目的成绩优于中间项目。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/processes/interference-theory', 'cognitive-psychology', 'cognitive-psychology/memory/processes', '前摄抑制与倒摄抑制', '["proactive interference","retroactive interference","interference theory"]'::jsonb, '先前或后来学习的材料干扰目标材料的提取而造成遗忘。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/reconstruction', 'cognitive-psychology', 'cognitive-psychology/memory', '记忆的重构与错误', '["false memory","memory distortion"]'::jsonb, '记忆并非原样复制，而会被已有知识和后续信息改造。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/reconstruction/bartlett-schema-reconstruction', 'cognitive-psychology', 'cognitive-psychology/memory/reconstruction', '巴特莱特的图式重构', '["Bartlett","schema","reconstructive memory"]'::jsonb, '回忆故事时按已有文化图式对材料进行删改与合理化。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/memory/reconstruction/misinformation-effect', 'cognitive-psychology', 'cognitive-psychology/memory/reconstruction', '误导信息效应', '["misinformation effect","Loftus","eyewitness memory"]'::jsonb, '事后接触的误导信息使人对原始事件产生错误记忆。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation', 'cognitive-psychology', 'cognitive-psychology/root', '知识表征', '["knowledge representation"]'::jsonb, '概念、语义关系与表象在心理上被组织和存储的形式。', 4)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/concepts', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation', '概念与范畴', '["concepts","categorization"]'::jsonb, '把个别事物归入类别并据以推断其属性的表征单位。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/concepts/prototype-theory', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation/concepts', '原型理论', '["prototype theory","Rosch"]'::jsonb, '主张范畴由最具代表性的原型表征、成员依相似度归类。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/concepts/prototype-theory/typicality-effect', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation/concepts/prototype-theory', '典型性效应', '["typicality effect"]'::jsonb, '典型成员的归类判断比边缘成员更快且更一致。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/concepts/exemplar-theory', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation/concepts', '样例理论', '["exemplar theory"]'::jsonb, '主张归类依据的是与已存储具体样例之间的相似性。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/semantic-memory-models', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation', '语义记忆的表征模型', '["semantic memory models"]'::jsonb, '描述概念间关系如何被存储与检索的形式化模型。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/semantic-memory-models/collins-quillian-network', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation/semantic-memory-models', '层级语义网络模型', '["Collins & Quillian","hierarchical network model","cognitive economy"]'::jsonb, '概念按上下位层级结点存储并通过属性继承实现表征经济。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/semantic-memory-models/spreading-activation', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation/semantic-memory-models', '激活扩散模型', '["spreading activation","Collins & Loftus"]'::jsonb, '结点激活沿语义距离不等的连线向邻近概念扩散。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/mental-imagery', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation', '心理表象', '["mental imagery"]'::jsonb, '在缺少相应刺激时形成的类知觉心理表征。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/knowledge-representation/mental-imagery/mental-rotation', 'cognitive-psychology', 'cognitive-psychology/knowledge-representation/mental-imagery', '心理旋转', '["mental rotation","Shepard & Metzler"]'::jsonb, '判断旋转图形是否相同所需时间随旋转角度线性增加。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language', 'cognitive-psychology', 'cognitive-psychology/root', '语言', '["language","psycholinguistics"]'::jsonb, '对言语符号进行理解与产生的认知加工。', 5)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/word-recognition', 'cognitive-psychology', 'cognitive-psychology/language', '词汇识别', '["word recognition","mental lexicon"]'::jsonb, '把书面或口语输入映射到心理词典中词条的过程。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/word-recognition/word-frequency-effect', 'cognitive-psychology', 'cognitive-psychology/language/word-recognition', '词频效应', '["word frequency effect"]'::jsonb, '高频词比低频词被更快更准确地识别。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/word-recognition/interactive-activation-model', 'cognitive-psychology', 'cognitive-psychology/language/word-recognition', '交互激活模型', '["interactive activation model","McClelland & Rumelhart"]'::jsonb, '特征、字母与词三层结点通过兴奋与抑制的双向交互完成识别。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/sentence-processing', 'cognitive-psychology', 'cognitive-psychology/language', '句子理解', '["sentence processing","parsing"]'::jsonb, '对词序列进行句法分析并整合语义的在线加工。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/sentence-processing/garden-path-sentence', 'cognitive-psychology', 'cognitive-psychology/language/sentence-processing', '花园路径句', '["garden-path sentence","syntactic reanalysis"]'::jsonb, '局部句法偏好导致先前分析错误而必须重新分析的句子。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/discourse-comprehension', 'cognitive-psychology', 'cognitive-psychology/language', '语篇理解', '["discourse comprehension","text comprehension"]'::jsonb, '跨句整合信息以建立连贯表征的理解加工。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/discourse-comprehension/bridging-inference', 'cognitive-psychology', 'cognitive-psychology/language/discourse-comprehension', '桥接推理', '["bridging inference","anaphoric inference"]'::jsonb, '为连接前后句子而补充未明言信息的推理。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/discourse-comprehension/situation-model', 'cognitive-psychology', 'cognitive-psychology/language/discourse-comprehension', '情境模型', '["situation model","mental model of discourse"]'::jsonb, '读者依据语篇建构的关于所述情境的整体心理表征。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/production', 'cognitive-psychology', 'cognitive-psychology/language', '语言产生', '["language production","speech production"]'::jsonb, '从概念意图到发音输出的言语计划与执行过程。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/language/production/slip-of-the-tongue', 'cognitive-psychology', 'cognitive-psychology/language/production', '口误', '["slip of the tongue","speech error","spoonerism"]'::jsonb, '言语计划失误造成的音素、词或语法成分错位。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking', 'cognitive-psychology', 'cognitive-psychology/root', '思维与推理', '["thinking","higher cognition"]'::jsonb, '对表征进行操作以得出结论、解决问题并做出选择的高级认知。', 6)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/reasoning', 'cognitive-psychology', 'cognitive-psychology/thinking', '推理', '["reasoning","deductive reasoning"]'::jsonb, '依据给定前提得出结论的思维过程。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/reasoning/belief-bias-in-syllogisms', 'cognitive-psychology', 'cognitive-psychology/thinking/reasoning', '三段论推理的信念偏差', '["belief bias","syllogistic reasoning"]'::jsonb, '结论内容是否可信会干扰对其逻辑有效性的判断。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/reasoning/wason-selection-task', 'cognitive-psychology', 'cognitive-psychology/thinking/reasoning', '沃森四卡问题', '["Wason selection task","confirmation bias"]'::jsonb, '检验条件规则时人们倾向寻找证实证据而忽略可能的反例。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/problem-solving', 'cognitive-psychology', 'cognitive-psychology/thinking', '问题解决', '["problem solving"]'::jsonb, '在初始状态与目标状态之间搜索可行路径的认知活动。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/problem-solving/functional-fixedness', 'cognitive-psychology', 'cognitive-psychology/thinking/problem-solving', '功能固着', '["functional fixedness","insight"]'::jsonb, '只按物体的惯常用途思考而妨碍发现新解法的倾向。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/problem-solving/means-ends-analysis', 'cognitive-psychology', 'cognitive-psychology/thinking/problem-solving', '手段—目的分析', '["means-ends analysis","problem space","Newell & Simon"]'::jsonb, '通过缩小当前状态与目标的差距并设立子目标来搜索问题空间。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/decision-making', 'cognitive-psychology', 'cognitive-psychology/thinking', '判断与决策', '["judgment and decision making","heuristics and biases"]'::jsonb, '在不确定条件下评估概率与价值并做出选择的过程。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/decision-making/availability-heuristic', 'cognitive-psychology', 'cognitive-psychology/thinking/decision-making', '可得性启发式', '["availability heuristic"]'::jsonb, '依据事例在头脑中被提取的容易程度来估计其发生概率。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/decision-making/representativeness-heuristic', 'cognitive-psychology', 'cognitive-psychology/thinking/decision-making', '代表性启发式与基率忽视', '["representativeness heuristic","base-rate neglect"]'::jsonb, '依据样本与典型印象的相似度判断概率而忽略基础比率。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/thinking/decision-making/framing-effect', 'cognitive-psychology', 'cognitive-psychology/thinking/decision-making', '框架效应', '["framing effect","prospect theory"]'::jsonb, '同一选项因被表述为获得或损失而导致偏好反转。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control', 'cognitive-psychology', 'cognitive-psychology/root', '执行控制', '["executive control","executive function","cognitive control"]'::jsonb, '为达成目标而对认知加工进行抑制、切换与监控的调节机制。', 7)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/inhibition', 'cognitive-psychology', 'cognitive-psychology/executive-control', '抑制控制', '["inhibition","inhibitory control"]'::jsonb, '压制无关信息或已启动反应的控制能力。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/inhibition/stop-signal-task', 'cognitive-psychology', 'cognitive-psychology/executive-control/inhibition', '停止信号任务的反应抑制', '["stop-signal task","response inhibition","SSRT"]'::jsonb, '用中途出现的停止信号测量取消已启动反应所需的时间。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/inhibition/negative-priming', 'cognitive-psychology', 'cognitive-psychology/executive-control/inhibition', '负启动', '["negative priming"]'::jsonb, '先前被忽略的刺激随后成为目标时加工反而变慢。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/task-switching', 'cognitive-psychology', 'cognitive-psychology/executive-control', '任务切换', '["task switching","cognitive flexibility"]'::jsonb, '在不同任务规则之间转换的控制过程。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/task-switching/switch-cost', 'cognitive-psychology', 'cognitive-psychology/executive-control/task-switching', '任务切换代价', '["switch cost","task-set reconfiguration"]'::jsonb, '切换试次的反应比重复试次更慢且更易出错。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/task-switching/wisconsin-card-sorting-perseveration', 'cognitive-psychology', 'cognitive-psychology/executive-control/task-switching', '威斯康星卡片分类中的固着错误', '["Wisconsin Card Sorting Test","perseveration","WCST"]'::jsonb, '分类规则改变后仍沿用旧标准反应的执行控制缺陷表现。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/monitoring', 'cognitive-psychology', 'cognitive-psychology/executive-control', '监控与元认知', '["monitoring","metacognition"]'::jsonb, '对自身认知过程进行评估并据以调整策略。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/monitoring/error-related-negativity', 'cognitive-psychology', 'cognitive-psychology/executive-control/monitoring', '错误相关负波', '["error-related negativity","ERN"]'::jsonb, '错误反应后额中区出现的早期负向脑电成分。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('cognitive-psychology/executive-control/monitoring/judgment-of-learning', 'cognitive-psychology', 'cognitive-psychology/executive-control/monitoring', '学习判断', '["judgment of learning","JOL"]'::jsonb, '学习后对自己日后能否记住材料所做的主观预测。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO disciplines (slug, name, major, origin)
VALUES ('distributed-systems', '分布式系统', '计算机系统', 'preset')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, major = EXCLUDED.major;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/root', 'distributed-systems', NULL, '分布式系统', '["Distributed Systems"]'::jsonb, '研究由多台通过网络协作的计算机组成的系统如何保持正确性与可用性。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models', 'distributed-systems', 'distributed-systems/root', '系统模型与故障假设', '["System Model","Failure Model"]'::jsonb, '描述节点、网络与故障行为的抽象假设，是协议正确性论证的前提。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models/failure-models', 'distributed-systems', 'distributed-systems/models', '故障模型', '["Failure Model","Fault Model"]'::jsonb, '对节点可能出现的异常行为方式进行分类。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models/failure-models/crash-stop', 'distributed-systems', 'distributed-systems/models/failure-models', '崩溃停止故障', '["Crash-Stop","Fail-Stop"]'::jsonb, '节点故障后永久停止且不再发出任何消息。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models/failure-models/crash-recovery', 'distributed-systems', 'distributed-systems/models/failure-models', '崩溃恢复故障', '["Crash-Recovery"]'::jsonb, '节点崩溃后可以重启并从持久化状态继续参与协议。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models/failure-models/byzantine-fault', 'distributed-systems', 'distributed-systems/models/failure-models', '拜占庭故障', '["Byzantine Fault"]'::jsonb, '节点可任意偏离协议，包括发送伪造或互相矛盾的消息。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models/timing-models', 'distributed-systems', 'distributed-systems/models', '时序模型', '["Timing Model","Synchrony Model"]'::jsonb, '关于消息延迟与处理速度是否存在已知上界的假设。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models/timing-models/partial-synchrony', 'distributed-systems', 'distributed-systems/models/timing-models', '部分同步模型', '["Partial Synchrony"]'::jsonb, '系统在某个未知时刻之后消息延迟存在上界。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/models/timing-models/flp-impossibility', 'distributed-systems', 'distributed-systems/models/timing-models', 'FLP 不可能性结论', '["FLP Impossibility","FLP"]'::jsonb, '异步系统中即使只有一个节点会崩溃也不存在确定性共识算法。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/time-order', 'distributed-systems', 'distributed-systems/root', '时间与事件排序', '["Time and Order"]'::jsonb, '在缺少全局时钟的系统中确定事件先后关系的方法。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/time-order/logical-clocks', 'distributed-systems', 'distributed-systems/time-order', '逻辑时钟', '["Logical Clock"]'::jsonb, '用计数器而非物理时间刻画事件之间的因果顺序。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/time-order/logical-clocks/happens-before', 'distributed-systems', 'distributed-systems/time-order/logical-clocks', '先发生关系', '["Happens-Before"]'::jsonb, '由同进程内顺序与消息收发共同构成的事件偏序关系。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/time-order/logical-clocks/lamport-timestamp', 'distributed-systems', 'distributed-systems/time-order/logical-clocks', 'Lamport 时间戳', '["Lamport Timestamp","Lamport Clock"]'::jsonb, '为事件分配单调递增标量以给出与因果关系兼容的全序。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/time-order/logical-clocks/vector-clock', 'distributed-systems', 'distributed-systems/time-order/logical-clocks', '向量时钟', '["Vector Clock"]'::jsonb, '用每节点一维的计数器向量判断两个事件是否并发。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/time-order/clock-skew', 'distributed-systems', 'distributed-systems/time-order', '时钟偏移与漂移', '["Clock Skew","Clock Drift"]'::jsonb, '不同节点物理时钟读数之间的差异及其随时间累积的速率。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/time-order/truetime-uncertainty', 'distributed-systems', 'distributed-systems/time-order', 'TrueTime 的有界不确定区间', '["TrueTime"]'::jsonb, '把物理时间读数表示为带误差上下界的区间以支撑全局排序。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication', 'distributed-systems', 'distributed-systems/root', '通信与调用原语', '["Communication Primitives"]'::jsonb, '节点之间交换消息与发起远程调用的抽象机制。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/rpc', 'distributed-systems', 'distributed-systems/communication', '远程过程调用', '["RPC","Remote Procedure Call"]'::jsonb, '把跨节点请求包装成本地函数调用形式的通信方式。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/rpc/rpc-semantics', 'distributed-systems', 'distributed-systems/communication/rpc', '调用语义', '["RPC Semantics","Delivery Semantics"]'::jsonb, '在消息丢失与重试情形下远程调用被执行次数的保证。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/rpc/rpc-semantics/at-most-once', 'distributed-systems', 'distributed-systems/communication/rpc/rpc-semantics', '至多一次语义', '["At-Most-Once"]'::jsonb, '调用不会被重复执行，但失败时可能完全没有执行。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/rpc/rpc-semantics/at-least-once', 'distributed-systems', 'distributed-systems/communication/rpc/rpc-semantics', '至少一次语义', '["At-Least-Once"]'::jsonb, '通过重试保证调用最终被执行，但可能重复执行。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/rpc/rpc-semantics/exactly-once', 'distributed-systems', 'distributed-systems/communication/rpc/rpc-semantics', '恰好一次语义的实现代价', '["Exactly-Once"]'::jsonb, '需要幂等键与持久化去重表才能对外表现为只执行一次。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/rpc/timeout-retry', 'distributed-systems', 'distributed-systems/communication/rpc', '超时重试与重试风暴', '["Retry Storm","Timeout"]'::jsonb, '客户端超时后重发请求会在服务端过载时放大流量。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/total-order-broadcast', 'distributed-systems', 'distributed-systems/communication', '全序广播', '["Total Order Broadcast","Atomic Broadcast"]'::jsonb, '所有节点以完全相同顺序交付同一组消息的广播原语。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/communication/causal-broadcast', 'distributed-systems', 'distributed-systems/communication', '因果广播', '["Causal Broadcast"]'::jsonb, '保证存在因果依赖的消息按依赖顺序交付的广播原语。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication', 'distributed-systems', 'distributed-systems/root', '数据复制', '["Replication"]'::jsonb, '把同一份数据维护在多个节点上以提升可用性与读吞吐。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/single-leader', 'distributed-systems', 'distributed-systems/replication', '单主复制', '["Single-Leader Replication","Primary-Backup"]'::jsonb, '所有写入先到唯一主副本再传播给从副本。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/single-leader/log-shipping', 'distributed-systems', 'distributed-systems/replication/single-leader', '基于日志的复制流', '["Log Shipping","WAL Replication"]'::jsonb, '主副本把写前日志按序发送给从副本重放。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/single-leader/sync-vs-async', 'distributed-systems', 'distributed-systems/replication/single-leader', '同步复制与异步复制的取舍', '["Synchronous Replication","Asynchronous Replication"]'::jsonb, '等待从副本确认可避免数据丢失但会拉长写延迟。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/single-leader/failover-split-brain', 'distributed-systems', 'distributed-systems/replication/single-leader', '故障切换与脑裂', '["Failover","Split Brain"]'::jsonb, '主副本切换判断失误会导致两个节点同时以主身份接受写入。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/multi-leader', 'distributed-systems', 'distributed-systems/replication', '多主复制', '["Multi-Leader Replication"]'::jsonb, '多个副本都可以接受写入并互相同步变更。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/multi-leader/write-conflict-detection', 'distributed-systems', 'distributed-systems/replication/multi-leader', '写冲突检测', '["Write Conflict"]'::jsonb, '识别对同一数据项的并发写入以便后续解决。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/multi-leader/crdt', 'distributed-systems', 'distributed-systems/replication/multi-leader', '无冲突复制数据类型', '["CRDT","Conflict-Free Replicated Data Type"]'::jsonb, '通过可交换的合并操作让副本自动收敛到同一状态。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/leaderless', 'distributed-systems', 'distributed-systems/replication', '无主复制', '["Leaderless Replication","Dynamo-style"]'::jsonb, '客户端直接向多个副本读写而不依赖固定主节点。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/leaderless/quorum-rw', 'distributed-systems', 'distributed-systems/replication/leaderless', '读写法定人数', '["Quorum","Read-Write Quorum"]'::jsonb, '通过约束读写涉及的副本数量来保证读到最新写入。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/leaderless/quorum-rw/quorum-intersection', 'distributed-systems', 'distributed-systems/replication/leaderless/quorum-rw', '法定人数交集条件', '["Quorum Intersection","W+R>N"]'::jsonb, '读集合与写集合必须相交才能确保读到最近提交的写。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/leaderless/quorum-rw/stale-read', 'distributed-systems', 'distributed-systems/replication/leaderless/quorum-rw', '法定人数不足导致的陈旧读', '["Stale Read"]'::jsonb, '读写副本数之和不满足交集条件时读操作可能返回旧值。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/replication/leaderless/read-repair', 'distributed-systems', 'distributed-systems/replication/leaderless', '读修复', '["Read Repair"]'::jsonb, '读取时发现副本落后并顺带把新值写回该副本。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus', 'distributed-systems', 'distributed-systems/root', '共识算法', '["Consensus"]'::jsonb, '让多个节点在存在故障时对同一个值或顺序达成一致。', 4)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/paxos', 'distributed-systems', 'distributed-systems/consensus', 'Paxos 家族', '["Paxos"]'::jsonb, '以提案编号与多数派承诺为核心的经典共识协议族。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/paxos/single-decree-two-phase', 'distributed-systems', 'distributed-systems/consensus/paxos', '单决议 Paxos 的两阶段', '["Single-Decree Paxos","Prepare-Accept"]'::jsonb, '先用准备阶段抢占提案权再用接受阶段确定取值。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/paxos/multi-paxos-stable-leader', 'distributed-systems', 'distributed-systems/consensus/paxos', 'Multi-Paxos 的稳定领导者优化', '["Multi-Paxos"]'::jsonb, '让固定领导者跳过重复的准备阶段以摊薄每条日志的开销。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/raft', 'distributed-systems', 'distributed-systems/consensus', 'Raft', '["Raft"]'::jsonb, '以领导者选举加日志复制方式组织的易理解共识算法。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/raft/leader-election', 'distributed-systems', 'distributed-systems/consensus/raft', '领导者选举与任期', '["Leader Election","Term"]'::jsonb, '候选者在选举超时后依靠多数票在新任期内成为领导者。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/raft/log-matching', 'distributed-systems', 'distributed-systems/consensus/raft', '日志匹配性质', '["Log Matching Property"]'::jsonb, '两份日志若在某索引处任期相同则该索引之前的条目完全相同。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/raft/commit-rule', 'distributed-systems', 'distributed-systems/consensus/raft', '提交规则与前任任期日志', '["Commit Rule"]'::jsonb, '领导者只能通过复制当前任期条目来间接提交旧任期的条目。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/raft/log-compaction-snapshot', 'distributed-systems', 'distributed-systems/consensus/raft', '快照与日志压缩', '["Snapshot","Log Compaction"]'::jsonb, '把状态机快照持久化后丢弃已被包含的日志前缀。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/byzantine-consensus', 'distributed-systems', 'distributed-systems/consensus', '拜占庭容错共识', '["BFT","Byzantine Consensus"]'::jsonb, '在部分节点可能作恶的前提下仍能达成一致的协议。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/byzantine-consensus/pbft-three-phase', 'distributed-systems', 'distributed-systems/consensus/byzantine-consensus', 'PBFT 三阶段协议', '["PBFT"]'::jsonb, '通过预准备、准备、提交三轮消息确定请求的执行顺序。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consensus/byzantine-consensus/quorum-3f-plus-1', 'distributed-systems', 'distributed-systems/consensus/byzantine-consensus', '3f+1 副本下界', '["3f+1"]'::jsonb, '容忍 f 个拜占庭节点至少需要 3f+1 个副本才能安全推进。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency', 'distributed-systems', 'distributed-systems/root', '一致性模型', '["Consistency Model"]'::jsonb, '规定并发读写在多副本系统中允许出现哪些可见结果。', 5)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/strong', 'distributed-systems', 'distributed-systems/consistency', '强一致性模型', '["Strong Consistency"]'::jsonb, '对外表现接近单副本的严格顺序保证。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/strong/linearizability', 'distributed-systems', 'distributed-systems/consistency/strong', '线性一致性', '["Linearizability","Atomic Consistency"]'::jsonb, '每个操作看起来在其调用与返回之间的某一瞬间原子生效。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/strong/sequential-consistency', 'distributed-systems', 'distributed-systems/consistency/strong', '顺序一致性', '["Sequential Consistency"]'::jsonb, '所有节点看到同一操作全序且该全序与各自程序顺序一致。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/weak', 'distributed-systems', 'distributed-systems/consistency', '弱一致性模型', '["Weak Consistency"]'::jsonb, '放松顺序保证以换取更高可用性与更低延迟。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/weak/eventual-consistency', 'distributed-systems', 'distributed-systems/consistency/weak', '最终一致性', '["Eventual Consistency"]'::jsonb, '停止写入后各副本经过一段时间会收敛到相同状态。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/weak/causal-consistency', 'distributed-systems', 'distributed-systems/consistency/weak', '因果一致性', '["Causal Consistency"]'::jsonb, '存在因果依赖的操作在所有节点上按相同顺序可见。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/weak/causal-consistency/vector-clock-tracking', 'distributed-systems', 'distributed-systems/consistency/weak/causal-consistency', '因果一致性的向量时钟实现', '["Vector Clock"]'::jsonb, '用向量时钟标记依赖并延迟交付尚未满足依赖的更新。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/weak/causal-consistency/causal-plus-convergence', 'distributed-systems', 'distributed-systems/consistency/weak/causal-consistency', '因果加收敛一致性', '["Causal+","Convergent Causal Consistency"]'::jsonb, '在因果顺序之外再要求并发写入按确定规则收敛到同一结果。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/consistency/cap-theorem', 'distributed-systems', 'distributed-systems/consistency', 'CAP 定理', '["CAP Theorem"]'::jsonb, '网络分区发生时系统只能在强一致性与可用性之间取其一。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions', 'distributed-systems', 'distributed-systems/root', '分布式事务', '["Distributed Transaction"]'::jsonb, '让跨多个节点的操作集合保持原子性与隔离性的机制。', 6)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/atomic-commit', 'distributed-systems', 'distributed-systems/transactions', '原子提交协议', '["Atomic Commit"]'::jsonb, '让所有参与者对事务提交还是回滚做出一致决定。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/atomic-commit/two-phase-commit', 'distributed-systems', 'distributed-systems/transactions/atomic-commit', '两阶段提交', '["2PC","Two-Phase Commit"]'::jsonb, '协调者先收集参与者投票再统一下发提交或中止决定。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/atomic-commit/two-phase-commit/prepare-vote', 'distributed-systems', 'distributed-systems/transactions/atomic-commit/two-phase-commit', '准备阶段与参与者投票', '["Prepare Phase","Vote Request"]'::jsonb, '参与者持久化准备状态后即承诺不再单方面中止事务。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/atomic-commit/two-phase-commit/coordinator-blocking', 'distributed-systems', 'distributed-systems/transactions/atomic-commit/two-phase-commit', '协调者故障导致的阻塞', '["Coordinator Failure","Blocking Problem"]'::jsonb, '参与者投票后失去协调者会持有锁无限等待最终决定。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/concurrency-control', 'distributed-systems', 'distributed-systems/transactions', '并发控制', '["Concurrency Control"]'::jsonb, '协调并发事务对共享数据的访问以保证隔离性。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/concurrency-control/two-phase-locking', 'distributed-systems', 'distributed-systems/transactions/concurrency-control', '两阶段锁', '["2PL","Two-Phase Locking"]'::jsonb, '事务先只加锁后只解锁从而保证调度可串行化。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/concurrency-control/mvcc', 'distributed-systems', 'distributed-systems/transactions/concurrency-control', '多版本并发控制', '["MVCC","Multi-Version Concurrency Control"]'::jsonb, '为数据保留多个版本使读操作不阻塞写操作。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/commit-wait', 'distributed-systems', 'distributed-systems/transactions', '提交等待与全局时间戳', '["Commit Wait","External Consistency"]'::jsonb, '提交前等待时间戳不确定区间过去以保证外部可见顺序正确。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/transactions/saga', 'distributed-systems', 'distributed-systems/transactions', 'Saga 补偿事务', '["Saga"]'::jsonb, '把长事务拆成一串本地事务并用补偿操作回退已完成步骤。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/partitioning', 'distributed-systems', 'distributed-systems/root', '数据分区', '["Partitioning","Sharding"]'::jsonb, '把数据集拆分到多个节点以突破单机容量与吞吐限制。', 7)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/partitioning/schemes', 'distributed-systems', 'distributed-systems/partitioning', '分区方式', '["Partitioning Scheme"]'::jsonb, '决定一条数据归属哪个分区的映射规则。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/partitioning/schemes/consistent-hashing', 'distributed-systems', 'distributed-systems/partitioning/schemes', '一致性哈希', '["Consistent Hashing"]'::jsonb, '把节点与键映射到同一哈希环使节点增减只影响相邻区间。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/partitioning/schemes/virtual-node', 'distributed-systems', 'distributed-systems/partitioning/schemes', '虚拟节点与负载均摊', '["Virtual Node","vnode"]'::jsonb, '让每个物理节点承载多个哈希环位置以减少负载倾斜。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/partitioning/shard-rebalancing', 'distributed-systems', 'distributed-systems/partitioning', '分片再平衡与路由失效', '["Rebalancing","Shard Migration"]'::jsonb, '分片迁移期间客户端缓存的路由表会指向错误的节点。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/partitioning/hot-key-skew', 'distributed-systems', 'distributed-systems/partitioning', '热键倾斜', '["Hot Key","Skew"]'::jsonb, '少量键承担大部分流量使单个分区成为整体瓶颈。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/fault-tolerance', 'distributed-systems', 'distributed-systems/root', '容错与恢复', '["Fault Tolerance","Recovery"]'::jsonb, '在部分组件失效时维持正确性并在事后恢复状态。', 8)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/fault-tolerance/failure-detection', 'distributed-systems', 'distributed-systems/fault-tolerance', '故障检测', '["Failure Detection","Failure Detector"]'::jsonb, '判断远端节点是否已失效的机制及其误判取舍。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/fault-tolerance/failure-detection/heartbeat-timeout', 'distributed-systems', 'distributed-systems/fault-tolerance/failure-detection', '心跳与超时判定', '["Heartbeat","Timeout"]'::jsonb, '依据周期性心跳缺失超过阈值来怀疑节点已经失效。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/fault-tolerance/failure-detection/phi-accrual', 'distributed-systems', 'distributed-systems/fault-tolerance/failure-detection', 'φ 累积故障检测器', '["Phi Accrual Failure Detector"]'::jsonb, '根据心跳到达时间分布输出连续可疑度而非布尔判定。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/fault-tolerance/write-ahead-log-recovery', 'distributed-systems', 'distributed-systems/fault-tolerance', '预写日志与崩溃恢复', '["WAL","Write-Ahead Log"]'::jsonb, '重启后重放持久化日志把状态恢复到崩溃前的提交点。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/fault-tolerance/chandy-lamport-snapshot', 'distributed-systems', 'distributed-systems/fault-tolerance', 'Chandy-Lamport 快照算法', '["Chandy-Lamport","Distributed Snapshot"]'::jsonb, '用标记消息在不停机的情况下记录一致的全局状态。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/fault-tolerance/fencing-token', 'distributed-systems', 'distributed-systems/fault-tolerance', '栅栏令牌', '["Fencing Token"]'::jsonb, '用单调递增令牌让存储端拒绝租约已过期节点的写入。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/storage', 'distributed-systems', 'distributed-systems/root', '分布式存储系统', '["Distributed Storage"]'::jsonb, '把文件或键值数据分布到集群上的系统设计。', 9)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/storage/file-systems', 'distributed-systems', 'distributed-systems/storage', '分布式文件系统', '["Distributed File System"]'::jsonb, '以文件接口对外提供跨节点存储能力的系统。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/storage/file-systems/gfs-master-chunkserver', 'distributed-systems', 'distributed-systems/storage/file-systems', 'GFS 的主控与块服务器结构', '["GFS","Google File System"]'::jsonb, '单一主控管理元数据而数据以固定大小块存放在块服务器上。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/storage/file-systems/namenode-metadata-bottleneck', 'distributed-systems', 'distributed-systems/storage/file-systems', '元数据节点的内存瓶颈', '["NameNode","Metadata Bottleneck"]'::jsonb, '集中式元数据服务的内存容量限制了集群可管理的文件数量。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/storage/erasure-coding-tradeoff', 'distributed-systems', 'distributed-systems/storage', '纠删码与多副本的取舍', '["Erasure Coding","Reed-Solomon"]'::jsonb, '纠删码以更低存储开销换取更高的修复带宽与读延迟。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/performance', 'distributed-systems', 'distributed-systems/root', '性能与可观测性', '["Performance","Observability"]'::jsonb, '衡量并诊断分布式系统的延迟、吞吐与异常行为。', 10)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/performance/tail-latency', 'distributed-systems', 'distributed-systems/performance', '尾延迟放大', '["Tail Latency","Tail at Scale"]'::jsonb, '扇出请求需等待最慢子请求使高分位延迟随扇出度上升。', 0)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/performance/hedged-request', 'distributed-systems', 'distributed-systems/performance', '对冲请求', '["Hedged Request"]'::jsonb, '等待超过阈值后向备份副本再发一份请求以裁剪尾延迟。', 1)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/performance/distributed-tracing-span', 'distributed-systems', 'distributed-systems/performance', '分布式追踪的 Span 因果链', '["Distributed Tracing","Span","Dapper"]'::jsonb, '通过传递追踪上下文把跨服务调用串成有父子关系的调用链。', 2)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

INSERT INTO global_nodes (id, discipline_slug, parent_id, title, aliases, definition, sort_order)
VALUES ('distributed-systems/performance/backpressure', 'distributed-systems', 'distributed-systems/performance', '背压与过载保护', '["Backpressure","Load Shedding"]'::jsonb, '队列积压时向上游施加压力或主动丢弃请求以避免雪崩。', 3)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, aliases = EXCLUDED.aliases, definition = EXCLUDED.definition, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id;

COMMIT;
