import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  calculateGlobalLayout,
  calculateLighting,
  getDefaultExpandedNodeIds,
  type UnifiedKnowledgeNode,
} from '@zhihu-explore/domain';
import {
  LIT_BG,
  GOLD_TAG_BG,
  GOLD_TAG_TEXT,
  UNLIT_TEXT,
  ARROW_COLOR,
} from '@zhihu-explore/ui-tokens';

export interface KnowledgeCanvasProps {
  nodes: UnifiedKnowledgeNode[];
  litNodeIds: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export const KnowledgeCanvas: React.FC<KnowledgeCanvasProps> = ({
  nodes,
  litNodeIds,
  selectedNodeId,
  onSelectNode,
}) => {
  // Expansion state
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() =>
    getDefaultExpandedNodeIds(nodes)
  );

  // Re-calculate default expansion when nodes structure changes
  useEffect(() => {
    setExpandedNodeIds((prev) => {
      const defaults = getDefaultExpandedNodeIds(nodes);
      // Merge previous expansions with new defaults
      const merged = new Set(defaults);
      for (const id of prev) merged.add(id);
      return merged;
    });
  }, [nodes]);

  // Pan and Zoom transform
  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 0.9 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute Layout & Lighting pure outputs
  const layout = useMemo(() => {
    return calculateGlobalLayout(nodes, expandedNodeIds);
  }, [nodes, expandedNodeIds]);

  const lighting = useMemo(() => {
    return calculateLighting(nodes, new Set(litNodeIds));
  }, [nodes, litNodeIds]);

  // Toggle node expansion
  const toggleExpand = useCallback((nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Handle canvas mouse drag (Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.25), 2.5);
      return {
        ...prev,
        scale: newScale,
      };
    });
  };

  const handleResetView = () => {
    setTransform({ x: 40, y: 40, scale: 0.9 });
  };

  const handleZoomIn = () => {
    setTransform((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.2, 2.5) }));
  };

  const handleZoomOut = () => {
    setTransform((prev) => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.25) }));
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#f8fafc',
        cursor: 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Canvas Controls Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          padding: '4px 8px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        }}
      >
        <button
          onClick={handleZoomIn}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '4px 8px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
          title="放大"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '4px 8px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
          title="缩小"
        >
          -
        </button>
        <button
          onClick={handleResetView}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '4px',
            color: '#475569',
          }}
          title="居中复位"
        >
          复位
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          fontSize: '12px',
          color: '#64748b',
          background: 'rgba(255, 255, 255, 0.85)',
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
        }}
      >
        共 {nodes.length} 个概念 · 已点亮 {litNodeIds.length} 个
      </div>

      {/* Interactive Transform Layer */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.05s ease-out',
        }}
      >
        {/* SVG Connectors Layer */}
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: Math.max(layout.boundingBox.maxX + 300, 2000),
            height: Math.max(layout.boundingBox.maxY + 300, 2000),
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {layout.connectors.map((c) => (
            <path
              key={`${c.fromId}->${c.toId}`}
              d={c.pathData}
              stroke={ARROW_COLOR}
              strokeWidth="1.5"
              fill="none"
              strokeDasharray={c.pathData.length > 0 ? 'none' : 'none'}
              opacity="0.5"
            />
          ))}
        </svg>

        {/* Node Cards Layer */}
        {layout.nodes.map((node) => {
          const lightingState = lighting.states.get(node.id);
          const isDirectLit = lightingState?.isDirectLit ?? false;
          const isGold = lightingState?.isGold ?? false;
          const isSelected = selectedNodeId === node.id;
          const isExpanded = expandedNodeIds.has(node.id);
          const hasChildren = !node.isLeaf;

          return (
            <div
              key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node.id);
                // If it's a parent, also expand/collapse
                if (hasChildren) {
                  toggleExpand(node.id);
                }
              }}
              onMouseDown={(e) => {
                // Prevent drag initiation when clicking on a card
                e.stopPropagation();
              }}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                background: isDirectLit ? LIT_BG : '#ffffff',
                border: isSelected
                  ? '2px solid #2563eb'
                  : isDirectLit
                  ? '1.5px solid #eab308'
                  : '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: isSelected
                  ? '0 0 0 3px rgba(37, 99, 235, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  : '0 1px 3px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                zIndex: isSelected ? 5 : 1,
              }}
              title={`${node.title} ${lightingState ? `(${lightingState.n}/${lightingState.N})` : ''}`}
            >
              {/* Expand/Collapse Toggle Button for Non-leaves */}
              {hasChildren && (
                <button
                  onClick={(e) => toggleExpand(node.id, e)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '11px',
                    color: '#64748b',
                    marginRight: '6px',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title={isExpanded ? '收起子概念' : '展开子概念'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}

              {/* Node Title */}
              <span
                style={{
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: isDirectLit || isSelected ? 600 : 500,
                  color: isDirectLit ? '#713f12' : '#1e293b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.title}
              </span>

              {/* Badges: Personal, Subtree Ratio, Gold Tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                {node.isPersonal && (
                  <span
                    style={{
                      fontSize: '10px',
                      background: '#ede9fe',
                      color: '#6d28d9',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    个人
                  </span>
                )}

                {/* Subtree statistics for non-leaves */}
                {hasChildren && lightingState && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: lightingState.n > 0 ? '#b45309' : UNLIT_TEXT,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lightingState.n}/{lightingState.N}
                  </span>
                )}

                {/* Small Gold Tag if isGold */}
                {isGold && (
                  <span
                    style={{
                      fontSize: '10px',
                      background: GOLD_TAG_BG,
                      color: GOLD_TAG_TEXT,
                      padding: '1px 4px',
                      borderRadius: '3px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                    title="全亮勋章"
                  >
                    ★
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
