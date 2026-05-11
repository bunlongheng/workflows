'use client';

import { useState, useEffect } from 'react';
import { integrations } from '@/data/integrations';
import IntegrationCard from './IntegrationCard';

interface SidebarProps {
  onOpenConnections: (integrationId?: string) => void;
}

export default function Sidebar({ onOpenConnections }: SidebarProps) {
  const [connectedIds, setConnectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/connections')
      .then((r) => r.json())
      .then((data) => {
        if (data.connections) {
          setConnectedIds(data.connections.map((c: { integration_id: string }) => c.integration_id));
        }
      })
      .catch(() => {});
  }, []);

  // Sort: connected first, then disconnected
  const sorted = [...integrations].sort((a, b) => {
    const aConn = connectedIds.includes(a.id) ? 0 : 1;
    const bConn = connectedIds.includes(b.id) ? 0 : 1;
    return aConn - bConn;
  });

  return (
    <div
      className="flex flex-col h-full hidden sm:flex"
      style={{
        width: '268px',
        minWidth: '268px',
        background: '#111',
        borderRight: '1px solid #222',
      }}
    >
      <div className="flex-1">
        <div
          className="grid grid-cols-2 h-full"
          style={{ gridAutoRows: '1fr' }}
        >
          {sorted.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              connected={connectedIds.includes(integration.id)}
              onConnect={onOpenConnections}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
