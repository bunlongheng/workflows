'use client';

import { memo, useMemo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { integrations } from '@/data/integrations';

export type TriggerNodeData = {
  integrationId: string;
  eventId: string;
  eventLabel: string;
  config?: Record<string, string>;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
};

function TriggerNode({ id, data, selected }: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const nodeData = data as unknown as TriggerNodeData;

  const integration = useMemo(
    () => integrations.find((i) => i.id === nodeData.integrationId),
    [nodeData.integrationId]
  );
  if (!integration) return null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => nodeData.onSelect(id)}
      className="relative"
      style={{
        width: '240px',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: selected
          ? '0 0 0 2px #ffffff, 0 8px 32px rgba(255,255,255,0.15)'
          : hovered
          ? '0 4px 24px rgba(0,0,0,0.5)'
          : '0 2px 12px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.15s ease',
        cursor: 'pointer',
      }}
    >
      {/* Header */}
      <div className={`${integration.color} px-3 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {integration.icon.startsWith('/') ? (
            <img src={integration.icon} alt="" style={{ width: '18px', height: '18px' }} draggable={false} />
          ) : (
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{integration.icon}</span>
          )}
          <span className="text-white text-xs font-bold uppercase tracking-wider">Trigger</span>
        </div>
        <span className="bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
          IF
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          background: '#1e1e1e',
          borderLeft: '1px solid #333',
          borderRight: '1px solid #333',
          borderBottom: '1px solid #333',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
        }}
        className="px-3 py-3"
      >
        <p className="text-[#888] text-[10px] font-semibold uppercase tracking-wider mb-0.5">
          {integration.name}
        </p>
        <p className="text-[#f0f0f0] text-sm font-semibold leading-tight">
          {nodeData.eventLabel}
        </p>
        {nodeData.config && Object.entries(nodeData.config).some(([, v]) => v) && (
          <div className="mt-2 space-y-0.5">
            {Object.entries(nodeData.config).filter(([, v]) => v).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#555]">{key}:</span>
                <span className="text-[10px] text-indigo-400 truncate">{value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-[#888]">Listening for events</span>
        </div>
      </div>

      {/* Delete button */}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onDelete(id);
          }}
          aria-label="Delete node"
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/50 hover:bg-red-500 flex items-center justify-center text-white/70 hover:text-white transition-all duration-150 text-xs font-bold z-10"
          style={{ fontSize: '11px', lineHeight: 1 }}
        >
          ×
        </button>
      )}

      {/* Right handle (source) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          right: '-6px',
          width: '12px',
          height: '12px',
          background: '#6366f1',
          border: '2px solid #0f0f0f',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}

export default memo(TriggerNode);
