'use client';

import { Integration } from '@/data/integrations';

interface IntegrationCardProps {
  integration: Integration;
  connected: boolean;
  onConnect: (integrationId?: string) => void;
}

export default function IntegrationCard({ integration, connected, onConnect }: IntegrationCardProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!connected) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('integrationId', integration.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = () => {
    onConnect(integration.id);
  };

  const isSvgIcon = integration.icon.startsWith('/');

  return (
    <div
      draggable={connected}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={`group flex-shrink-0 flex flex-col items-center justify-center select-none transition-all duration-200 active:scale-[0.94] ${
        connected
          ? `${integration.color} cursor-grab active:cursor-grabbing hover:brightness-110`
          : `${integration.color} cursor-pointer grayscale brightness-50 hover:grayscale-0 hover:brightness-75`
      }`}
      style={{
        width: 80,
        height: 90,
        userSelect: 'none',
      }}
    >
      {isSvgIcon ? (
        <img
          src={integration.icon}
          alt={integration.name}
          className="mb-1.5 opacity-95"
          style={{ width: 28, height: 28 }}
          draggable={false}
        />
      ) : (
        <span
          className="block mb-1.5"
          style={{ fontSize: 28, lineHeight: 1, filter: 'saturate(0) brightness(10)' }}
        >
          {integration.icon}
        </span>
      )}
      <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/90 text-center px-1 leading-tight">
        {integration.name}
      </span>
    </div>
  );
}
