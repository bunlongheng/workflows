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
      className="flex overflow-x-auto gap-0"
      style={{ scrollbarWidth: 'none', minHeight: 90 }}
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
  );
}
