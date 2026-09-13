import React, { useState } from 'react';
import type { Proficiency } from '@zhihu-explore/contracts';
import { ExplorationRecord, type ExplorationRecordItem } from './ExplorationRecord.js';
import { updateNodeProficiency, deleteExplorationRecord } from '../data/mutations.js';
import type { AppDataSourceMode } from '../data/source-resolver.js';

export interface NodeDetailData {
  id: string;
  title: string;
  definition?: string;
  isPersonal?: boolean;
  proficiency?: Proficiency | null;
  records: ExplorationRecordItem[];
  isLit?: boolean;
  isGold?: boolean;
}

export interface NodeDetailProps {
  node: NodeDetailData;
  mode: AppDataSourceMode;
  onClose: () => void;
  onRecordDeleted: () => void;
  onProficiencyChanged?: (val: Proficiency | null) => void;
}

export const NodeDetail: React.FC<NodeDetailProps> = ({
  node,
  mode,
  onClose,
  onRecordDeleted,
  onProficiencyChanged,
}) => {
  const [currentProficiency, setCurrentProficiency] = useState<Proficiency | null>(
    node.proficiency ?? null
  );
  const [updatingProficiency, setUpdatingProficiency] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isGuestOrDemo = mode === 'DEMO' || mode === 'EXTENSION_GUEST';

  const handleProficiencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valStr = e.target.value;
    const newVal: Proficiency | null = valStr === '' ? null : (parseInt(valStr, 10) as Proficiency);
    setCurrentProficiency(newVal);

    if (!isGuestOrDemo) {
      setUpdatingProficiency(true);
      setErrorMessage(null);
      try {
        const ok = await updateNodeProficiency(node.id, newVal, mode);
        if (ok) {
          onProficiencyChanged?.(newVal);
        } else {
          setErrorMessage('保存熟练度失败');
        }
      } catch {
        setErrorMessage('网络异常，无法更新熟练度');
      } finally {
        setUpdatingProficiency(false);
      }
    }
  };

  const handleDeleteRecord = async (treeId: string, rootNodeId: string, version?: number) => {
    setErrorMessage(null);
    const result = await deleteExplorationRecord(treeId, rootNodeId, mode, version);
    if (!result.success) {
      setErrorMessage(result.error || '删除失败');
      if (result.refreshed) {
        onRecordDeleted();
      }
      return;
    }
    onRecordDeleted();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {node.title}
            </h2>
            {node.isGold && (
              <span
                style={{
                  fontSize: '11px',
                  background: '#E6B422',
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                全亮勋章
              </span>
            )}
            {node.isPersonal && (
              <span
                style={{
                  fontSize: '11px',
                  background: '#ede9fe',
                  color: '#6d28d9',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                个人概念
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            ID: {node.id}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#94a3b8',
            padding: '4px',
            lineHeight: 1,
          }}
          title="关闭面板"
        >
          ✕
        </button>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#b91c1c',
            fontSize: '13px',
            marginBottom: '12px',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Concept Definition */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ fontSize: '12px', color: '#64748b', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
          概念释义
        </h4>
        <div
          style={{
            fontSize: '14px',
            color: '#334155',
            lineHeight: 1.6,
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #f1f5f9',
          }}
        >
          {node.definition || '暂无概念定义。'}
        </div>
      </div>

      {/* Proficiency Setting */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '12px', color: '#64748b', margin: 0, textTransform: 'uppercase' }}>
            掌握熟练度
          </h4>
          {isGuestOrDemo && (
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              登录后可保存熟练度
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={currentProficiency === null ? '' : currentProficiency}
            onChange={handleProficiencyChange}
            disabled={isGuestOrDemo || updatingProficiency}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '13px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: isGuestOrDemo ? '#f1f5f9' : '#ffffff',
              color: currentProficiency === null ? '#94a3b8' : '#0f172a',
              cursor: isGuestOrDemo ? 'not-allowed' : 'pointer',
            }}
          >
            <option value="">未设置</option>
            <option value="0">0 - 初次了解</option>
            <option value="1">1 - 基础概念</option>
            <option value="2">2 - 能看懂应用</option>
            <option value="3">3 - 熟练掌握</option>
            <option value="4">4 - 能够自如运用</option>
            <option value="5">5 - 融会贯通</option>
          </select>

          {updatingProficiency && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>保存中…</span>
          )}
        </div>
      </div>

      {/* Exploration Records */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <h4 style={{ fontSize: '12px', color: '#64748b', margin: 0, textTransform: 'uppercase' }}>
            关联探索记录 ({node.records.length})
          </h4>
        </div>

        {node.records.length === 0 ? (
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '24px 16px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '13px',
              lineHeight: 1.6,
            }}
          >
            暂无关联探索记录。
            <br />
            在知乎专栏中选中文字即可追问并收录到此概念。
          </div>
        ) : (
          <div>
            {node.records.map((rec) => (
              <ExplorationRecord
                key={`${rec.tree_id}-${rec.root_node_id}`}
                record={rec}
                onDelete={handleDeleteRecord}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
