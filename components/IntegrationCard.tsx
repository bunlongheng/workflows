'use client';

import { Integration } from '@/data/integrations';

interface IntegrationCardProps {
  integration: Integration;
}

export default function IntegrationCard({ integration }: IntegrationCardProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('integrationId', integration.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] select-none"
      style={{ userSelect: 'none' }}
    >
      {/* Colored left accent bar */}
      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${integration.color}`} />

      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${integration.color} bg-opacity-20`}
        style={{ fontSize: '18px' }}
      >
        {integration.icon}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#f0f0f0] truncate">{integration.name}</p>
        <div className="flex gap-1 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a3a2a] text-green-400 font-medium">
            {integration.triggers.length} trigger{integration.triggers.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a3a] text-indigo-400 font-medium">
            {integration.actions.length} action{integration.actions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Drag handle hint */}
      <div className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" className="text-[#888]">
          <circle cx="4" cy="4" r="1.5" />
          <circle cx="8" cy="4" r="1.5" />
          <circle cx="4" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="4" cy="12" r="1.5" />
          <circle cx="8" cy="12" r="1.5" />
        </svg>
      </div>
    </div>
  );
}
