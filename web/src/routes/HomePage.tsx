import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { DisciplineSlug } from '@zhihu-explore/contracts';
import {
  dataSourceResolver,
  type AppDataSourceMode,
  type UserSession,
} from '../data/source-resolver.js';
import { KnowledgeCanvas } from '../components/KnowledgeCanvas.js';
import { NodeDetail, type NodeDetailData } from '../components/NodeDetail.js';

const DISCIPLINES: { slug: DisciplineSlug; name: string }[] = [
  { slug: 'agent-app-dev', name: 'Agent 应用开发' },
  { slug: 'cognitive-psychology', name: '认知心理学' },
  { slug: 'distributed-systems', name: '分布式系统' },
];

export const HomePage: React.FC = () => {
  const { disciplineId } = useParams<{ disciplineId?: string }>();
  const navigate = useNavigate();

  const currentSlug: DisciplineSlug =
    (disciplineId as DisciplineSlug) &&
    DISCIPLINES.some((d) => d.slug === disciplineId)
      ? (disciplineId as DisciplineSlug)
      : 'agent-app-dev';

  const [mode, setMode] = useState<AppDataSourceMode>('DEMO');
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes] = useState<any[]>([]);
  const [litNodeIds, setLitNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<NodeDetailData | null>(null);

  // Initialize data mode and session
  const initMode = useCallback(async () => {
    const activeUser = dataSourceResolver.loadUserSession();
    setUser(activeUser);
    const resolvedMode = await dataSourceResolver.resolveMode();
    setMode(resolvedMode);
    return resolvedMode;
  }, []);

  // Load tree data for current discipline
  const loadTreeData = useCallback(async (slug: DisciplineSlug, currentMode: AppDataSourceMode) => {
    setLoading(true);
    try {
      const data = await dataSourceResolver.getDisciplineTree(slug, currentMode);
      setNodes(data.nodes || []);
      setLitNodeIds(data.lit_node_ids || []);
    } catch (err) {
      console.error('Failed to load tree data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const currentMode = await initMode();
      await loadTreeData(currentSlug, currentMode);
    })();
  }, [currentSlug, initMode, loadTreeData]);

  // Load node detail when a node is selected
  const handleSelectNode = async (nodeId: string) => {
    setSelectedNodeId(nodeId);
    try {
      const detail = await dataSourceResolver.getNodeDetail(nodeId, mode);
      if (detail) {
        setSelectedNodeDetail({
          id: detail.id,
          title: detail.title,
          definition: detail.definition,
          proficiency: detail.proficiency,
          records: detail.records || [],
          isLit: litNodeIds.includes(nodeId),
        });
      }
    } catch (err) {
      console.error('Failed to load node detail', err);
    }
  };

  const handleRecordDeleted = async () => {
    await loadTreeData(currentSlug, mode);
    if (selectedNodeId) {
      await handleSelectNode(selectedNodeId);
    }
  };

  const handleLogout = () => {
    dataSourceResolver.clearUserSession();
    setUser(null);
    initMode().then((m) => loadTreeData(currentSlug, m));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* Top Header */}
      <header
        style={{
          height: '60px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>💡</span>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>
              知乎兴趣探索
            </span>
          </div>

          {/* Discipline Switcher Tabs */}
          <nav style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
            {DISCIPLINES.map((d) => {
              const active = d.slug === currentSlug;
              return (
                <button
                  key={d.slug}
                  onClick={() => {
                    navigate(`/d/${d.slug}`);
                    setSelectedNodeId(null);
                    setSelectedNodeDetail(null);
                  }}
                  style={{
                    border: 'none',
                    background: active ? '#eff6ff' : 'transparent',
                    color: active ? '#1d4ed8' : '#64748b',
                    fontWeight: active ? 600 : 500,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User / Extension Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="/downloads"
            style={{
              fontSize: '13px',
              color: '#475569',
              padding: '6px 10px',
              borderRadius: '6px',
              textDecoration: 'none',
              border: '1px solid #cbd5e1',
            }}
          >
            🧩 插件安装
          </a>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                退出
              </button>
            </div>
          ) : (
            <a
              href="/login"
              style={{
                background: '#0066ff',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              知乎登录
            </a>
          )}
        </div>
      </header>

      {/* State Banner (§4.6 four state matrix) */}
      <div
        style={{
          background:
            mode === 'DEMO'
              ? '#fffbeb'
              : mode === 'EXTENSION_GUEST'
              ? '#f0fdf4'
              : mode === 'EXTENSION_USER'
              ? '#f0fdf4'
              : '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '8px 24px',
          fontSize: '13px',
          color:
            mode === 'DEMO'
              ? '#b45309'
              : mode === 'EXTENSION_GUEST'
              ? '#166534'
              : mode === 'EXTENSION_USER'
              ? '#166534'
              : '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {mode === 'DEMO' && (
            <span>
              ℹ️ <strong>当前为演示模式</strong>：展示示例已点亮概念。安装 Chrome
              插件后可在真实知乎专栏划词追问并点亮自己的知识树。
            </span>
          )}
          {mode === 'EXTENSION_GUEST' && (
            <span>
              ✨ <strong>已连接本地浏览器插件（访客模式）</strong>：您的专栏阅读探索已直接呈现在下方树中。
            </span>
          )}
          {mode === 'EXTENSION_USER' && (
            <span>
              🎉 <strong>已连接插件与账号</strong>：{user?.name}，本地阅读记录与云端保持实时双向同步。
            </span>
          )}
          {mode === 'CLOUD_USER' && (
            <span>
              ☁️ <strong>云端账号模式</strong>：{user?.name}，未检测到本地浏览器插件。
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {mode === 'DEMO' && (
            <a
              href="/downloads"
              style={{ color: '#b45309', fontWeight: 600, textDecoration: 'underline' }}
            >
              获取插件
            </a>
          )}
          {mode === 'EXTENSION_GUEST' && (
            <a
              href="/login"
              style={{ color: '#166534', fontWeight: 600, textDecoration: 'underline' }}
            >
              登录账号开启云端同步
            </a>
          )}
        </div>
      </div>

      {/* Main Workspace: Canvas + Drawer */}
      <main style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '14px',
              }}
            >
              加载知识树中…
            </div>
          ) : (
            <KnowledgeCanvas
              nodes={nodes}
              litNodeIds={litNodeIds}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          )}
        </div>

        {/* Slide-in / Side Detail Panel */}
        {selectedNodeDetail && (
          <aside
            style={{
              width: '380px',
              height: '100%',
              position: 'relative',
              boxShadow: '-4px 0 12px rgba(0,0,0,0.05)',
              zIndex: 10,
            }}
          >
            <NodeDetail
              node={selectedNodeDetail}
              mode={mode}
              onClose={() => {
                setSelectedNodeId(null);
                setSelectedNodeDetail(null);
              }}
              onRecordDeleted={handleRecordDeleted}
            />
          </aside>
        )}
      </main>
    </div>
  );
};
