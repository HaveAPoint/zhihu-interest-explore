// Pure view fixtures for local followup tree testing
// Complies with 插件局部树执行计划 §4, §5 (LT01)
// Deterministic valid RFC 4122 v4 UUID generator (strictly hex characters)
function makeUuid(hexPrefix, index) {
    const cleanPrefix = hexPrefix.replace(/[^0-9a-f]/gi, '0').slice(0, 8).padStart(8, '0');
    const hexIndex = index.toString(16).padStart(12, '0');
    return `${cleanPrefix}-0000-4000-a000-${hexIndex}`;
}
const defaultCandidate = {
    global_node_id: 'agent-app-dev/tool-calling',
    title: '工具调用机制',
    degree: 'exact',
    reason: '匹配工具调用相关概念',
};
// ---------------------------------------------------------------------------
// 1. A/B/C/D/E/F Tree (Section 3.2 Canonical Tree)
// ---------------------------------------------------------------------------
// A (root)
// ├─ B (10:01:00)
// │  ├─ D (10:03:00)
// │  └─ F (10:05:00) <- Latest created
// └─ C (10:02:00)
//    └─ E (10:04:00)
const treeAbcdefId = makeUuid('00000001', 1);
const nodeAId = makeUuid('00001001', 1);
const nodeBId = makeUuid('00001001', 2);
const nodeCId = makeUuid('00001001', 3);
const nodeDId = makeUuid('00001001', 4);
const nodeEId = makeUuid('00001001', 5);
const nodeFId = makeUuid('00001001', 6);
export const treeAbcdefFixture = {
    id: treeAbcdefId,
    root_node_id: nodeAId,
    uid: 'user-partition-abcdef',
    article_id: makeUuid('0000a001', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: 'agent-app-dev/tool-calling',
    match_candidates: [defaultCandidate],
    anchor_paragraph: '通过工具调用（Tool Calling / Function Calling），Agent 可以突破自身参数知识的限制，连接数据库、搜索引擎和沙箱计算环境。',
    anchor_highlight: '工具调用（Tool Calling / Function Calling）',
    version: 1,
    nodes: [
        {
            id: nodeAId,
            tree_id: treeAbcdefId,
            parent_id: null,
            highlight_text: '工具调用（Tool Calling / Function Calling）',
            highlight_anchor: {
                exact: '工具调用（Tool Calling / Function Calling）',
                paragraph_index: 0,
                start_offset: 2,
                end_offset: 43,
            },
            question_text: '什么是工具调用？',
            title: 'A 工具调用核心概念',
            answer_original: '通过工具调用（Tool Calling / Function Calling），Agent 可以突破自身参数知识的限制，连接数据库、搜索引擎和沙箱计算环境。',
            answer_extra: '工具调用机制允许模型生成符合规范的结构化参数指令，由宿主环境调度执行并返回观察结果。',
            sources: [{ title: 'Function Calling Guide', url: 'https://platform.openai.com/docs' }],
            created_at: '2026-09-14T10:00:00.000Z',
        },
        {
            id: nodeBId,
            tree_id: treeAbcdefId,
            parent_id: nodeAId,
            highlight_text: '结构化参数指令',
            highlight_anchor: {
                exact: '结构化参数指令',
                prefix: '允许模型生成符合规范的',
                suffix: '，由宿主环境调度',
                start_offset: 17,
                end_offset: 24,
            },
            question_text: '结构化参数是如何定义的？',
            title: 'B 结构化参数定义',
            answer_original: '工具调用机制允许模型生成符合规范的结构化参数指令，由宿主环境调度执行并返回观察结果。',
            answer_extra: '通常使用 JSON Schema 定义参数字段、数据类型及必填约束，模型按照指定模式生成 JSON 格式。',
            sources: [],
            created_at: '2026-09-14T10:01:00.000Z',
        },
        {
            id: nodeCId,
            tree_id: treeAbcdefId,
            parent_id: nodeAId,
            highlight_text: '宿主环境调度',
            highlight_anchor: {
                exact: '宿主环境调度',
                prefix: '结构化参数指令，由',
                suffix: '执行并返回观察结果',
                start_offset: 26,
                end_offset: 32,
            },
            question_text: '宿主环境扮演什么角色？',
            title: 'C 宿主环境调度角色',
            answer_original: '工具调用机制允许模型生成符合规范的结构化参数指令，由宿主环境调度执行并返回观察结果。',
            answer_extra: '宿主运行时拦截 LLM 输出的工具调用标记，校验权限后调用真实的外部 API 或沙盒容器。',
            sources: [],
            created_at: '2026-09-14T10:02:00.000Z',
        },
        {
            id: nodeDId,
            tree_id: treeAbcdefId,
            parent_id: nodeBId,
            highlight_text: 'JSON Schema',
            highlight_anchor: {
                exact: 'JSON Schema',
                prefix: '通常使用 ',
                suffix: ' 定义参数字段',
                start_offset: 5,
                end_offset: 16,
            },
            question_text: 'JSON Schema 验证如何运作？',
            title: 'D JSON Schema 验证',
            answer_original: '通常使用 JSON Schema 定义参数字段、数据类型及必填约束，模型按照指定模式生成 JSON 格式。',
            answer_extra: '现代框架在采样解码阶段使用上下文无关文法引导（Grammar-guided decoding）强制保证 JSON 合法性。',
            sources: [],
            created_at: '2026-09-14T10:03:00.000Z',
        },
        {
            id: nodeEId,
            tree_id: treeAbcdefId,
            parent_id: nodeCId,
            highlight_text: '沙盒容器',
            highlight_anchor: {
                exact: '沙盒容器',
                prefix: '真实的外部 API 或',
                suffix: '。',
                start_offset: 39,
                end_offset: 43,
            },
            question_text: '沙盒容器如何进行安全隔离？',
            title: 'E 沙盒容器安全隔离',
            answer_original: '宿主运行时拦截 LLM 输出的工具调用标记，校验权限后调用真实的外部 API 或沙盒容器。',
            answer_extra: '采用 gVisor 或 WASM 隔离执行不受信代码，限制系统调用与网络出站访问。',
            sources: [],
            created_at: '2026-09-14T10:04:00.000Z',
        },
        {
            id: nodeFId,
            tree_id: treeAbcdefId,
            parent_id: nodeBId,
            highlight_text: '必填约束',
            highlight_anchor: {
                exact: '必填约束',
                prefix: '数据类型及',
                suffix: '，模型按照指定',
                start_offset: 30,
                end_offset: 34,
            },
            question_text: '缺少必填字段时如何处理？',
            title: 'F 缺少必填参数处理',
            answer_original: '通常使用 JSON Schema 定义参数字段、数据类型及必填约束，模型按照指定模式生成 JSON 格式。',
            answer_extra: '运行时向 LLM 返回校验失败错误信息，提示缺少的参数名，触发自我修正多轮对话。',
            sources: [],
            created_at: '2026-09-14T10:05:00.000Z', // Latest created
        },
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:05:00.000Z',
};
// ---------------------------------------------------------------------------
// 2. Long Titles Fixture
// ---------------------------------------------------------------------------
const treeLongTitleId = makeUuid('00000002', 1);
const nodeLongRootId = makeUuid('00001002', 1);
const nodeLongChildId = makeUuid('00001002', 2);
export const longTitleTreeFixture = {
    id: treeLongTitleId,
    root_node_id: nodeLongRootId,
    uid: 'user-partition-long-title',
    article_id: makeUuid('0000a002', 1),
    discipline_slug: 'distributed-systems',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '分布式共识算法在拜占庭容错和非拜占庭容错场景下具有完全不同的状态机复制假设与证明边界。',
    anchor_highlight: '分布式共识算法',
    version: 1,
    nodes: [
        {
            id: nodeLongRootId,
            tree_id: treeLongTitleId,
            parent_id: null,
            highlight_text: '分布式共识算法',
            question_text: '',
            title: '分布式共识算法在状态机复制体系下的理论边界探索',
            answer_original: '分布式共识算法在拜占庭容错和非拜占庭容错场景下具有完全不同的状态机复制假设与证明边界。',
            answer_extra: 'Paxos 与 Raft 解决崩溃容错，PBFT 与 HotStuff 解决拜占庭恶意节点篡改。',
            sources: [{ title: 'Raft Paper', url: 'https://raft.github.io/raft.pdf' }],
            created_at: '2026-09-14T10:00:00.000Z',
        },
        {
            id: nodeLongChildId,
            tree_id: treeLongTitleId,
            parent_id: nodeLongRootId,
            highlight_text: '拜占庭容错',
            highlight_anchor: { exact: '拜占庭容错', start_offset: 9, end_offset: 14 },
            question_text: '拜占庭容错与非拜占庭容错的核心区别？',
            title: '非常长的短标题用于检验卡片文本截断与悬浮完整提示属性（四十八字测试极限）',
            answer_original: 'Paxos 与 Raft 解决崩溃容错，PBFT 与 HotStuff 解决拜占庭恶意节点篡改。',
            answer_extra: 'BFT 协议需 3f+1 节点容忍 f 个作恶节点，CFT 仅需 2f+1 容忍 f 个故障节点。',
            sources: [],
            created_at: '2026-09-14T10:01:00.000Z',
        },
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:01:00.000Z',
};
// ---------------------------------------------------------------------------
// 3. Multiline Answer Fixture
// ---------------------------------------------------------------------------
const treeMultilineId = makeUuid('00000003', 1);
const nodeMultilineRootId = makeUuid('00001003', 1);
export const multilineAnswerTreeFixture = {
    id: treeMultilineId,
    root_node_id: nodeMultilineRootId,
    uid: 'user-partition-multiline',
    article_id: makeUuid('0000a003', 1),
    discipline_slug: 'cognitive-psychology',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '工作记忆由中央执行系统、语音回路和视觉空间模板组成。\n\n各个子系统相互独立且容量有限。\n\n长时记忆则通过精细复述进行编码巩固。',
    anchor_highlight: '工作记忆',
    version: 1,
    nodes: [
        {
            id: nodeMultilineRootId,
            tree_id: treeMultilineId,
            parent_id: null,
            highlight_text: '工作记忆',
            highlight_anchor: {
                exact: '工作记忆',
                start_offset: 0,
                end_offset: 4,
                paragraph_index: 0,
            },
            question_text: '工作记忆的三组件模型是什么？',
            title: '工作记忆模型',
            answer_original: '工作记忆由中央执行系统、语音回路和视觉空间模板组成。\n\n各个子系统相互独立且容量有限。\n\n长时记忆则通过精细复述进行编码巩固。',
            answer_extra: '第一部分：中央执行系统负责注意分配与任务切换。\n\n第二部分：语音回路处理言语信息，视觉空间模板维持表象。\n\n第三部分：情景缓冲器（后期补充）整合跨模态表征。',
            sources: [{ title: 'Baddeley Working Memory', url: 'https://example.com/baddeley' }],
            created_at: '2026-09-14T10:00:00.000Z',
        },
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:00:00.000Z',
};
// ---------------------------------------------------------------------------
// 4. Duplicate Words Fixture
// ---------------------------------------------------------------------------
const treeDuplicateWordsId = makeUuid('00000004', 1);
const nodeDupRootId = makeUuid('00001004', 1);
const nodeDupChildId = makeUuid('00001004', 2);
export const duplicateWordsTreeFixture = {
    id: treeDuplicateWordsId,
    root_node_id: nodeDupRootId,
    uid: 'user-partition-dup-words',
    article_id: makeUuid('0000a004', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '大模型可以构建智能体，而大模型本身也需要外部记忆，大模型的局限性需要工具弥补。',
    anchor_highlight: '大模型',
    version: 1,
    nodes: [
        {
            id: nodeDupRootId,
            tree_id: treeDuplicateWordsId,
            parent_id: null,
            highlight_text: '大模型',
            highlight_anchor: {
                exact: '大模型',
                start_offset: 0,
                end_offset: 3,
                paragraph_index: 0,
            },
            question_text: '大模型与智能体的关系？',
            title: '大模型基础',
            answer_original: '大模型可以构建智能体，而大模型本身也需要外部记忆，大模型的局限性需要工具弥补。',
            // '现代大模型拥有强大的模式识别能力，但大模型缺乏时序状态持久化，因此大模型必须外挂向量检索。'
            // 2nd '大模型' starts at offset 18, ends at offset 21
            answer_extra: '现代大模型拥有强大的模式识别能力，但大模型缺乏时序状态持久化，因此大模型必须外挂向量检索。',
            sources: [],
            created_at: '2026-09-14T10:00:00.000Z',
        },
        {
            id: nodeDupChildId,
            tree_id: treeDuplicateWordsId,
            parent_id: nodeDupRootId,
            highlight_text: '大模型',
            highlight_anchor: {
                exact: '大模型',
                prefix: '强大的模式识别能力，但',
                suffix: '缺乏时序状态持久化，因此',
                start_offset: 18,
                end_offset: 21,
            },
            question_text: '为什么第二处强调大模型缺乏时序状态？',
            title: '大模型时序持久化',
            answer_original: '现代大模型拥有强大的模式识别能力，但大模型缺乏时序状态持久化，因此大模型必须外挂向量检索。',
            answer_extra: '无状态的 Transformer 每次推理独立，无法跨会话直接存储用户历史，需要记忆库注入上下文。',
            sources: [],
            created_at: '2026-09-14T10:01:00.000Z',
        },
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:01:00.000Z',
};
// ---------------------------------------------------------------------------
// 5. Same Highlight Fork Fixture
// ---------------------------------------------------------------------------
const treeSameHighlightId = makeUuid('00000005', 1);
const nodeForkRootId = makeUuid('00001005', 1);
const nodeForkChild1Id = makeUuid('00001005', 2);
const nodeForkChild2Id = makeUuid('00001005', 3);
export const sameHighlightForkTreeFixture = {
    id: treeSameHighlightId,
    root_node_id: nodeForkRootId,
    uid: 'user-partition-fork',
    article_id: makeUuid('0000a005', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '受约束解码直接在 logits 采样层应用状态机掩码，从而保证 100% 格式合规。',
    anchor_highlight: '受约束解码',
    version: 1,
    nodes: [
        {
            id: nodeForkRootId,
            tree_id: treeSameHighlightId,
            parent_id: null,
            highlight_text: '受约束解码',
            highlight_anchor: {
                exact: '受约束解码',
                start_offset: 0,
                end_offset: 5,
                paragraph_index: 0,
            },
            question_text: '什么是受约束解码？',
            title: '受约束解码',
            answer_original: '受约束解码直接在 logits 采样层应用状态机掩码，从而保证 100% 格式合规。',
            answer_extra: '受约束解码通过下推自动机维护当前合法的 Token 集合，将非法 Token 的概率直接设为负无穷。',
            sources: [],
            created_at: '2026-09-14T10:00:00.000Z',
        },
        {
            id: nodeForkChild1Id,
            tree_id: treeSameHighlightId,
            parent_id: nodeForkRootId,
            highlight_text: '下推自动机',
            highlight_anchor: {
                exact: '下推自动机',
                prefix: '受约束解码通过',
                suffix: '维护当前合法的 Token 集合',
                start_offset: 7,
                end_offset: 12,
            },
            question_text: '下推自动机的性能开销大吗？',
            title: '自动机性能开销',
            answer_original: '受约束解码通过下推自动机维护当前合法的 Token 集合，将非法 Token 的概率直接设为负无穷。',
            answer_extra: '可通过预编译词表前缀树减少每步计算耗时，大部分库如 Outlines / Guidance 的延迟在微秒级。',
            sources: [],
            created_at: '2026-09-14T10:01:00.000Z',
        },
        {
            id: nodeForkChild2Id,
            tree_id: treeSameHighlightId,
            parent_id: nodeForkRootId,
            highlight_text: '下推自动机',
            highlight_anchor: {
                exact: '下推自动机',
                prefix: '受约束解码通过',
                suffix: '维护当前合法的 Token 集合',
                start_offset: 7,
                end_offset: 12,
            },
            question_text: '除下推自动机外还有哪些算法？',
            title: '替代文法引擎',
            answer_original: '受约束解码通过下推自动机维护当前合法的 Token 集合，将非法 Token 的概率直接设为负无穷。',
            answer_extra: '还有基于 Earley 解析器的通用上下文无关文法匹配算法，支持左递归但开销稍高。',
            sources: [],
            created_at: '2026-09-14T10:02:00.000Z',
        },
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:02:00.000Z',
};
// ---------------------------------------------------------------------------
// 6. Legacy Tree Without Anchor Fixture
// ---------------------------------------------------------------------------
const treeLegacyId = makeUuid('00000006', 1);
const nodeLegacyRootId = makeUuid('00001006', 1);
const nodeLegacyChildId = makeUuid('00001006', 2);
export const legacyTreeWithoutAnchorFixture = {
    id: treeLegacyId,
    root_node_id: nodeLegacyRootId,
    uid: 'user-partition-legacy',
    article_id: makeUuid('0000a006', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '历史数据没有保存高亮锚点精确位置信息，但仍应当能够展示文本。',
    anchor_highlight: '历史数据',
    version: 1,
    nodes: [
        {
            id: nodeLegacyRootId,
            tree_id: treeLegacyId,
            parent_id: null,
            highlight_text: '历史数据',
            question_text: '无锚点数据如何展示？',
            title: '旧数据兼容',
            answer_original: '历史数据没有保存高亮锚点精确位置信息，但仍应当能够展示文本。',
            answer_extra: '系统会尝试进行全局精确匹配兜底，若多处匹配则不绘制错误箭头，保障阅读。',
            sources: [],
            created_at: '2026-09-14T10:00:00.000Z',
        },
        {
            id: nodeLegacyChildId,
            tree_id: treeLegacyId,
            parent_id: nodeLegacyRootId,
            highlight_text: '精确匹配兜底',
            question_text: '如何降级处理？',
            title: '降级策略',
            answer_original: '系统会尝试进行全局精确匹配兜底，若多处匹配则不绘制错误箭头，保障阅读。',
            answer_extra: '不向云端回写假位置，不增加版本号，静默渲染。',
            sources: [],
            created_at: '2026-09-14T10:01:00.000Z',
        },
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:01:00.000Z',
};
// ---------------------------------------------------------------------------
// 7. Single Root Tree Fixture
// ---------------------------------------------------------------------------
const treeSingleRootId = makeUuid('00000007', 1);
const nodeSingleRootId = makeUuid('00001007', 1);
export const singleRootTreeFixture = {
    id: treeSingleRootId,
    root_node_id: nodeSingleRootId,
    uid: 'user-partition-single-root',
    article_id: makeUuid('0000a007', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '刚创建的新树只有根节点，尚未产生任何后续追问分支。',
    anchor_highlight: '刚创建的新树',
    version: 1,
    nodes: [
        {
            id: nodeSingleRootId,
            tree_id: treeSingleRootId,
            parent_id: null,
            highlight_text: '刚创建的新树',
            highlight_anchor: {
                exact: '刚创建的新树',
                start_offset: 0,
                end_offset: 6,
                paragraph_index: 0,
            },
            question_text: '单根树如何展示？',
            title: '初始单根树',
            answer_original: '刚创建的新树只有根节点，尚未产生任何后续追问分支。',
            answer_extra: '短标题树仅展示单个根节点，回答区默认展示根回答卡片。',
            sources: [],
            created_at: '2026-09-14T10:00:00.000Z',
        },
    ],
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: '2026-09-14T10:00:00.000Z',
};
// ---------------------------------------------------------------------------
// 8. Deep 8-layer Tree Fixture
// ---------------------------------------------------------------------------
const treeDeep8Id = makeUuid('00000008', 1);
const deepNodes = [];
for (let i = 0; i < 8; i++) {
    const nodeId = makeUuid('00001008', i + 1);
    const parentId = i === 0 ? null : makeUuid('00001008', i);
    deepNodes.push({
        id: nodeId,
        tree_id: treeDeep8Id,
        parent_id: parentId,
        highlight_text: `层级深度 ${i + 1}`,
        highlight_anchor: {
            exact: `层级深度 ${i + 1}`,
            start_offset: 0,
            end_offset: 6,
        },
        question_text: `第 ${i + 1} 层的追问？`,
        title: `深度卡片 L${i + 1}`,
        answer_original: `这是第 ${i + 1} 层的原始引用文字，用于测试深度滚动。`,
        answer_extra: `深度 L${i + 1} 的解释内容，验证树向右延伸和滚动能力。`,
        sources: [],
        created_at: new Date(Date.parse('2026-09-14T10:00:00.000Z') + i * 60000).toISOString(),
    });
}
export const deep8TreeFixture = {
    id: treeDeep8Id,
    root_node_id: deepNodes[0].id,
    uid: 'user-partition-deep-8',
    article_id: makeUuid('0000a008', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '深度 8 层的单链追问，验证极端纵深布局与可视横向滚动。',
    anchor_highlight: '层级深度 1',
    version: 1,
    nodes: deepNodes,
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: deepNodes[deepNodes.length - 1].created_at,
};
// ---------------------------------------------------------------------------
// 9. Wide 8-branch Tree Fixture
// ---------------------------------------------------------------------------
const treeWide8Id = makeUuid('00000009', 1);
const wideRootId = makeUuid('00001009', 1);
const wideNodes = [
    {
        id: wideRootId,
        tree_id: treeWide8Id,
        parent_id: null,
        highlight_text: '宽 8 分支根节点',
        highlight_anchor: {
            exact: '宽 8 分支根节点',
            start_offset: 0,
            end_offset: 9,
        },
        question_text: '如何在一个节点下展开多路追问？',
        title: '多分支根节点',
        answer_original: '宽 8 分支根节点测试，每个子节点都是兄弟分支。',
        answer_extra: '验证父节点居中对齐、直接孩子按上下分布且间距均匀。',
        sources: [],
        created_at: '2026-09-14T10:00:00.000Z',
    },
];
for (let i = 1; i <= 8; i++) {
    const childId = makeUuid('00001009', i + 1);
    wideNodes.push({
        id: childId,
        tree_id: treeWide8Id,
        parent_id: wideRootId,
        highlight_text: `分支高亮 ${i}`,
        highlight_anchor: {
            exact: `分支高亮 ${i}`,
            start_offset: 0,
            end_offset: 6,
        },
        question_text: `兄弟分支 ${i} 的问题？`,
        title: `分支选项 ${i}`,
        answer_original: `这是兄弟分支 ${i} 对应的原始引用。`,
        answer_extra: `分支 ${i} 的补充回答。`,
        sources: [],
        created_at: new Date(Date.parse('2026-09-14T10:00:00.000Z') + i * 60000).toISOString(),
    });
}
export const wide8TreeFixture = {
    id: treeWide8Id,
    root_node_id: wideRootId,
    uid: 'user-partition-wide-8',
    article_id: makeUuid('0000a009', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '宽 8 分支根节点测试，每个子节点都是兄弟分支。',
    anchor_highlight: '宽 8 分支根节点',
    version: 1,
    nodes: wideNodes,
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: wideNodes[wideNodes.length - 1].created_at,
};
// ---------------------------------------------------------------------------
// 10. Hundred Nodes Tree Fixture
// ---------------------------------------------------------------------------
const treeHundredId = makeUuid('00000010', 1);
const hundredNodes = [];
const totalNodes = 100;
for (let i = 0; i < totalNodes; i++) {
    const nodeId = makeUuid('00001010', i + 1);
    const parentIndex = i === 0 ? null : Math.floor((i - 1) / 3);
    const parentId = parentIndex === null ? null : makeUuid('00001010', parentIndex + 1);
    hundredNodes.push({
        id: nodeId,
        tree_id: treeHundredId,
        parent_id: parentId,
        highlight_text: `节点高亮 ${i + 1}`,
        highlight_anchor: {
            exact: `节点高亮 ${i + 1}`,
            start_offset: 0,
            end_offset: 7,
        },
        question_text: `第 ${i + 1} 个节点的追问？`,
        title: `百节点 ${i + 1}`,
        answer_original: `节点 ${i + 1} 的原始引用内容。`,
        answer_extra: `节点 ${i + 1} 的详细解释，验证大规模树布局无卡顿与死循环。`,
        sources: [],
        created_at: new Date(Date.parse('2026-09-14T10:00:00.000Z') + i * 1000).toISOString(),
    });
}
export const hundredNodesTreeFixture = {
    id: treeHundredId,
    root_node_id: hundredNodes[0].id,
    uid: 'user-partition-hundred',
    article_id: makeUuid('0000a010', 1),
    discipline_slug: 'agent-app-dev',
    global_node_id: null,
    match_candidates: [],
    anchor_paragraph: '测试百节点复杂树结构的纯函数布局算法与渲染性能。',
    anchor_highlight: '节点高亮 1',
    version: 1,
    nodes: hundredNodes,
    created_at: '2026-09-14T10:00:00.000Z',
    updated_at: hundredNodes[hundredNodes.length - 1].created_at,
};
// Export all 10 fixtures as an array for batch validation
export const allViewFixtures = [
    treeAbcdefFixture,
    longTitleTreeFixture,
    multilineAnswerTreeFixture,
    duplicateWordsTreeFixture,
    sameHighlightForkTreeFixture,
    legacyTreeWithoutAnchorFixture,
    singleRootTreeFixture,
    deep8TreeFixture,
    wide8TreeFixture,
    hundredNodesTreeFixture,
];
//# sourceMappingURL=view-fixtures.js.map