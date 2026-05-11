'use client';

import { useState, useEffect } from 'react';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  active: boolean;
  action_config: Record<string, string>;
  created_at: string;
  trigger_integration_name: string;
  trigger_integration_type: string;
  action_integration_name: string;
  action_integration_type: string;
  total_runs: string;
  success_runs: string;
  last_run: string | null;
}

interface AutomationsPanelProps {
  onClose: () => void;
}

export default function AutomationsPanel({ onClose }: AutomationsPanelProps) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/automations/list')
      .then((r) => r.json())
      .then((data) => setAutomations(data.automations || []))
      .finally(() => setLoading(false));
  }, []);

  function getIcon(type: string): string {
    const icons: Record<string, string> = {
      youtube: '/icons/youtube.svg',
      stickies_api: '/icons/stickies.svg',
      hue: '/icons/local-apps.svg',
    };
    return icons[type] || '/icons/webhook.svg';
  }

  function getColor(type: string): string {
    const colors: Record<string, string> = {
      youtube: 'bg-red-600',
      stickies_api: 'bg-yellow-500',
      hue: 'bg-orange-500',
    };
    return colors[type] || 'bg-gray-600';
  }

  function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{
          width: '640px',
          maxHeight: '80vh',
          background: '#141414',
          border: '1px solid #252525',
          boxShadow: '0 40px 120px rgba(0,0,0,0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #222' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f0f0f0]">My Automations</h2>
              <p className="text-[11px] text-[#555]">{automations.length} configured</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] flex items-center justify-center text-[#555] hover:text-[#ccc] transition-colors border border-[#2a2a2a]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-[#444] text-sm">Loading...</div>
          ) : automations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#444] text-sm">No automations configured</p>
            </div>
          ) : (
            <div>
              {automations.map((auto) => (
                <div
                  key={auto.id}
                  className="px-6 py-4 hover:bg-[#1a1a1a] transition-colors"
                  style={{ borderBottom: '1px solid #1e1e1e' }}
                >
                  {/* Flow visualization */}
                  <div className="flex items-center gap-3 mb-3">
                    {/* Trigger */}
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColor(auto.trigger_integration_type)}`}>
                        <img src={getIcon(auto.trigger_integration_type)} alt="" style={{ width: '16px', height: '16px' }} />
                      </div>
                      <div>
                        <p className="text-[10px] text-green-400 font-semibold uppercase">IF</p>
                        <p className="text-[11px] text-[#ccc]">{auto.trigger_integration_name || auto.trigger_type}</p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="flex-shrink-0">
                      <path d="M0 6h16M12 1l5 5-5 5" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    {/* Action */}
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColor(auto.action_integration_type)}`}>
                        <img src={getIcon(auto.action_integration_type)} alt="" style={{ width: '16px', height: '16px' }} />
                      </div>
                      <div>
                        <p className="text-[10px] text-indigo-400 font-semibold uppercase">THEN</p>
                        <p className="text-[11px] text-[#ccc]">{auto.action_integration_name || auto.action_type}</p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${auto.active ? 'bg-green-500' : 'bg-[#444]'}`} />
                      <span className="text-[10px] text-[#666]">{auto.active ? 'Active' : 'Paused'}</span>
                    </div>
                  </div>

                  {/* Name */}
                  <p className="text-sm font-semibold text-[#f0f0f0] mb-2">{auto.name}</p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-[11px] text-[#555]">
                    <span>{auto.total_runs} runs</span>
                    <span>{auto.success_runs} succeeded</span>
                    {auto.last_run && <span>Last: {timeAgo(auto.last_run)}</span>}
                    {auto.action_config?.model && (
                      <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-[#666] text-[10px]">
                        {auto.action_config.model}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 flex items-center justify-end" style={{ borderTop: '1px solid #1e1e1e' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
