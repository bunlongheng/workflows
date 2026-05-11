'use client';

import { useState, useEffect, useCallback } from 'react';
import { integrations } from '@/data/integrations';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

interface ConnectionInfo {
  integration_id: string;
  account_name: string;
  account_email?: string;
  connected_at: string;
  scopes?: string[];
}

const CONNECTABLE_IDS = ['youtube', 'gmail', 'slack', 'github', 'discord', 'notion', 'google-calendar', 'google-sheets', 'spotify', 'stripe', 'trello', 'dropbox', 'ai-processing', 'stickies', 'hue', 'diagram', 'mindmap', 'local-apps', 'claude-dashboard'];

const OAUTH_INTEGRATIONS = ['youtube', 'gmail', 'google-calendar', 'spotify', 'github', 'slack', 'discord'];

interface ConnectionsPanelProps {
  onClose: () => void;
  focusId?: string | null;
}

export default function ConnectionsPanel({ onClose, focusId }: ConnectionsPanelProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'connected' | 'available'>('all');
  const [search, setSearch] = useState(focusId ? '' : '');
  const [setupPrompt, setSetupPrompt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/connections')
      .then((r) => r.json())
      .then((data) => { if (data.connections) setConnections(data.connections); })
      .catch(() => {});
  }, []);

  const getStatus = useCallback(
    (id: string): ConnectionStatus => {
      if (connectingId === id) return 'connecting';
      return connections.some((c) => c.integration_id === id) ? 'connected' : 'disconnected';
    },
    [connections, connectingId]
  );

  const getConnection = useCallback(
    (id: string) => connections.find((c) => c.integration_id === id),
    [connections]
  );

  const handleConnect = useCallback(
    async (integrationId: string) => {
      if (OAUTH_INTEGRATIONS.includes(integrationId)) {
        setConnectingId(integrationId);
        try {
          const res = await fetch(`/api/auth/${integrationId}`, { redirect: 'manual' });
          if (res.type === 'opaqueredirect' || res.status === 307 || res.status === 302) {
            window.location.href = `/api/auth/${integrationId}`;
            return;
          }
          setConnectingId(null);
          setSetupPrompt(integrationId);
        } catch {
          setConnectingId(null);
          setSetupPrompt(integrationId);
        }
        return;
      }

      // Non-OAuth integrations - connect via DB
      setConnectingId(integrationId);
      const integration = integrations.find((i) => i.id === integrationId);
      try {
        const res = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integrationId,
            accountName: integration?.name || integrationId,
            scopes: ['read', 'write'],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setConnections((prev) => [...prev.filter((c) => c.integration_id !== integrationId), data.connection]);
        }
      } catch {}
      setConnectingId(null);
    },
    [connections]
  );

  const handleDisconnect = useCallback(
    async (integrationId: string) => {
      try {
        await fetch('/api/connections', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId }),
        });
        setConnections((prev) => prev.filter((c) => c.integration_id !== integrationId));
      } catch {}
    },
    []
  );

  const connectable = integrations.filter((i) => CONNECTABLE_IDS.includes(i.id));

  // If focusId is set, show only that integration
  const filtered = focusId
    ? connectable.filter((i) => i.id === focusId)
    : connectable.filter((i) => {
        const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (filter === 'connected') return getStatus(i.id) === 'connected';
        if (filter === 'available') return getStatus(i.id) === 'disconnected';
        return true;
      });

  // Sort connected to top
  const sorted = [...filtered].sort((a, b) => {
    const aConn = getStatus(a.id) === 'connected' ? 0 : 1;
    const bConn = getStatus(b.id) === 'connected' ? 0 : 1;
    return aConn - bConn;
  });

  const connectedCount = connectable.filter((i) => getStatus(i.id) === 'connected').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col w-[calc(100%-2rem)] sm:w-[680px]"
        style={{
          maxHeight: '90vh',
          background: '#141414',
          border: '1px solid #252525',
          boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 1px rgba(99,102,241,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 sm:px-6 py-4 sm:py-5 flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,16,16,0) 60%)',
            borderBottom: '1px solid #222',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {(() => {
                const focused = focusId ? integrations.find((i) => i.id === focusId) : null;
                return focused ? (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${focused.color}`}>
                    {focused.icon.startsWith('/') ? (
                      <img src={focused.icon} alt="" style={{ width: '22px', height: '22px' }} draggable={false} />
                    ) : (
                      <span style={{ fontSize: '20px', lineHeight: 1 }}>{focused.icon}</span>
                    )}
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                );
              })()}
              <div>
                <h2 className="text-lg font-bold text-[#f0f0f0] tracking-tight">
                  {focusId ? (integrations.find((i) => i.id === focusId)?.name || 'Connection') : 'Connections'}
                </h2>
                <p className="text-xs text-[#555] mt-0.5">
                  {focusId
                    ? (getStatus(focusId) === 'connected' ? 'Connected' : 'Not connected')
                    : `${connectedCount} of ${connectable.length} integrations connected`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] flex items-center justify-center text-[#555] hover:text-[#ccc] transition-colors border border-[#2a2a2a] hover:border-[#333]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search + Filters (hidden when focused on single integration) */}
          {!focusId && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search integrations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-[#0a0a0a] border border-[#2a2a2a] text-[#f0f0f0] placeholder-[#444] focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
            <div className="flex rounded-lg border border-[#2a2a2a] overflow-hidden">
              {(['all', 'connected', 'available'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    filter === f
                      ? 'bg-[#2a2a2a] text-[#f0f0f0]'
                      : 'bg-[#0a0a0a] text-[#555] hover:text-[#888]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* Integration list */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
          <div className="space-y-2">
            {sorted.map((integration) => {
              const status = getStatus(integration.id);
              const conn = getConnection(integration.id);
              const isFocused = focusId === integration.id;

              return (
                <div
                  key={integration.id}
                  className="group rounded-xl border transition-all duration-200"
                  style={{
                    background: '#0f0f0f',
                    borderColor: '#1e1e1e',
                  }}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${integration.color}`}>
                        {integration.icon.startsWith('/') ? (
                          <img src={integration.icon} alt="" style={{ width: '22px', height: '22px' }} draggable={false} />
                        ) : (
                          <span style={{ fontSize: '20px', lineHeight: 1 }}>{integration.icon}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#f0f0f0]">{integration.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#555] font-medium">
                          {integration.category}
                        </span>
                      </div>
                      {status === 'connected' && conn ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#888] font-medium">{conn.account_name}</span>
                          <span className="text-[10px] text-[#444]">
                            since {new Date(conn.connected_at).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-[#444] mt-0.5">
                          {integration.triggers.length} triggers / {integration.actions.length} actions
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {status === 'connecting' ? (
                        <div className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                          <div className="flex items-center gap-2">
                            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                            <span className="text-xs text-[#888] font-medium">Connecting...</span>
                          </div>
                        </div>
                      ) : status === 'connected' ? (
                        <button
                          onClick={() => handleDisconnect(integration.id)}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#666] hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 transition-all"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(integration.id)}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                          style={{ boxShadow: '0 2px 8px rgba(99,102,241,0.2)' }}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Focused detail: connected - show details */}
                  {isFocused && status === 'connected' && conn && (
                    <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #1e1e1e' }}>
                      <div className="pt-4 space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#555]">Status</span>
                          <span className="text-[#ccc] font-medium">
                            Connected
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#555]">Account</span>
                          <span className="text-[#ccc]">{conn.account_name}</span>
                        </div>
                        {conn.account_email && (
                          <div className="flex justify-between text-xs">
                            <span className="text-[#555]">Email</span>
                            <span className="text-[#ccc]">{conn.account_email}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-[#555]">Connected</span>
                          <span className="text-[#ccc]">{new Date(conn.connected_at).toLocaleString()}</span>
                        </div>
                        {conn.scopes && conn.scopes.length > 0 && (
                          <div>
                            <p className="text-[10px] text-[#555] mb-1.5">Scopes</p>
                            <div className="flex flex-wrap gap-1">
                              {conn.scopes.map((scope: string) => (
                                <span key={scope} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#888] border border-[#252525] font-medium">
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-[#555] mb-1.5">Available triggers</p>
                        <div className="space-y-1">
                          {integration.triggers.map((t) => (
                            <div key={t.id} className="text-[11px] text-[#888] flex items-center gap-1.5">
                              <span className="text-green-400">IF</span> {t.label}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#555] mb-1.5">Available actions</p>
                        <div className="space-y-1">
                          {integration.actions.map((a) => (
                            <div key={a.id} className="text-[11px] text-[#888] flex items-center gap-1.5">
                              <span className="text-indigo-400">THEN</span> {a.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Focused detail: not connected - show how to connect */}
                  {isFocused && status === 'disconnected' && (
                    <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #1e1e1e' }}>
                      <div className="pt-4">
                        <p className="text-xs text-[#888] mb-3">
                          Connect {integration.name} to use it in your automations.
                        </p>
                        <div className="space-y-2 mb-4">
                          <p className="text-[10px] text-[#555] font-bold uppercase tracking-wider">What you get</p>
                          {integration.triggers.length > 0 && (
                            <div className="space-y-1">
                              {integration.triggers.map((t) => (
                                <div key={t.id} className="text-[11px] text-[#666] flex items-center gap-1.5">
                                  <span className="text-green-400/60">IF</span> {t.label}
                                </div>
                              ))}
                            </div>
                          )}
                          {integration.actions.length > 0 && (
                            <div className="space-y-1">
                              {integration.actions.map((a) => (
                                <div key={a.id} className="text-[11px] text-[#666] flex items-center gap-1.5">
                                  <span className="text-indigo-400/60">THEN</span> {a.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleConnect(integration.id)}
                          disabled={connectingId === integration.id}
                          className="w-full py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                          style={{ boxShadow: '0 2px 8px rgba(99,102,241,0.2)' }}
                        >
                          Connect {integration.name}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Non-focused: just show scopes inline */}
                  {!isFocused && status === 'connected' && conn && conn.scopes && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="flex items-center gap-1.5 ml-15">
                        {conn.scopes.map((scope: string) => (
                          <span key={scope} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#555] border border-[#252525] font-medium">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[#444] text-sm">No integrations match your filter</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: '1px solid #1e1e1e' }}
        >
          <p className="text-[10px] sm:text-[11px] text-[#383838] hidden sm:block">
            Connections stored in database. Connect to enable triggers and actions.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* OAuth Setup Prompt */}
      {setupPrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setSetupPrompt(null)}
        >
          <div
            className="rounded-xl overflow-hidden w-[calc(100%-2rem)] sm:w-[480px]"
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #252525' }}>
              <div className="flex items-center gap-3 mb-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <h3 className="text-base font-bold text-[#f0f0f0]">OAuth Setup Required</h3>
              </div>
              <p className="text-xs text-[#666] mt-1">
                {setupPrompt === 'youtube' ? 'YouTube' : setupPrompt} requires Google OAuth credentials to connect your real account.
              </p>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="space-y-2 text-[13px] text-[#999]">
                <p className="font-semibold text-[#ccc]">Quick setup:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-[12px]">
                  <li>Go to <span className="text-indigo-400">console.cloud.google.com</span></li>
                  <li>Create project &rarr; Enable <span className="text-[#ccc]">YouTube Data API v3</span></li>
                  <li>Credentials &rarr; Create <span className="text-[#ccc]">OAuth 2.0 Client ID</span> (Web app)</li>
                  <li>Add redirect URI: <code className="text-[11px] bg-[#0f0f0f] px-1.5 py-0.5 rounded text-amber-400">http://localhost:3008/api/auth/youtube/callback</code></li>
                  <li>Add Client ID + Secret to <code className="text-[11px] bg-[#0f0f0f] px-1.5 py-0.5 rounded text-amber-400">.env.local</code></li>
                </ol>
              </div>

              <div className="rounded-lg p-3 text-[11px] font-mono" style={{ background: '#0f0f0f', border: '1px solid #252525' }}>
                <p className="text-[#555]"># .env.local</p>
                <p className="text-emerald-400">GOOGLE_CLIENT_ID=<span className="text-[#666]">your_client_id</span></p>
                <p className="text-emerald-400">GOOGLE_CLIENT_SECRET=<span className="text-[#666]">your_client_secret</span></p>
              </div>
            </div>

            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #252525' }}>
              <button
                onClick={() => setSetupPrompt(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
