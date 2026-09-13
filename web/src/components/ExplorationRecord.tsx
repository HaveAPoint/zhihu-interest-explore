import React, { useState } from 'react';

export interface ExplorationRecordItem {
  tree_id: string;
  root_node_id: string;
  article_id: string;
  article_title: string;
  article_url?: string;
  root_title: string;
  created_at: string;
  version?: number;
}

export interface ExplorationRecordProps {
  record: ExplorationRecordItem;
  onDelete: (treeId: string, rootNodeId: string, version?: number) => Promise<void>;
}

export const ExplorationRecord: React.FC<ExplorationRecordProps> = ({ record, onDelete }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Generate deep-link URL into Zhihu article
  const articleBaseUrl = record.article_url?.startsWith('http')
    ? record.article_url.split('?')[0]
    : `https://zhuanlan.zhihu.com/p/${record.article_id}`;

  const deepLinkUrl = `${articleBaseUrl}?explore_tree=${encodeURIComponent(
    record.tree_id
  )}&explore_node=${encodeURIComponent(record.root_node_id)}`;

  const formattedTime = new Date(record.created_at).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDeleteClick = async () => {
    setDeleting(true);
    try {
      await onDelete(record.tree_id, record.root_node_id, record.version);
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '10px',
        background: '#ffffff',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4
          style={{
            margin: '0 0 4px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: '#0f172a',
            lineHeight: 1.4,
          }}
        >
          {record.root_title}
        </h4>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
            title="删除此探索记录"
          >
            删除
          </button>
        ) : null}
      </div>

      {/* Zhihu Article Link */}
      <div style={{ margin: '6px 0', fontSize: '13px' }}>
        <span style={{ color: '#64748b' }}>来源文章：</span>
        <a
          href={deepLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#0284c7',
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
          title="在知乎专栏中打开并定位此追问树"
        >
          {record.article_title || `知乎专栏 (ID: ${record.article_id})`} ↗
        </a>
      </div>

      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{formattedTime}</div>

      {/* Delete Confirmation Modal / Bar */}
      {showConfirm && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        >
          <div style={{ color: '#991b1b', marginBottom: '6px' }}>
            确定要删除该探索记录吗？删除后此处的追问树与锚点将被移除。
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={deleting}
              style={{
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              取消
            </button>
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              style={{
                border: 'none',
                background: '#ef4444',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {deleting ? '删除中…' : '确认删除'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
