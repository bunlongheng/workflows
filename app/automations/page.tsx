'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

function getIcon(type: string): string {
  const icons: Record<string, string> = {
    youtube: '/icons/youtube.svg',
    stickies_api: '/icons/stickies.svg',
    hue: '/icons/hue.svg',
    diagram: '/icons/diagram.svg',
    mindmap: '/icons/mindmap.svg',
    gmail: '/icons/gmail.svg',
    slack: '/icons/slack.svg',
    github: '/icons/github.svg',
    discord: '/icons/discord.svg',
    'google-calendar': '/icons/google-calendar.svg',
    'ai-processing': '/icons/ai-processing.svg',
    'local-apps': '/icons/local-apps.svg',
    'claude-dashboard': '/icons/claude-dashboard.svg',
    spotify: '/icons/spotify.svg',
  };
  return icons[type] || '/icons/ai-processing.svg';
}

function getColor(type: string): string {
  const colors: Record<string, string> = {
    youtube: 'bg-red-600',
    stickies_api: 'bg-yellow-500',
    hue: 'bg-orange-500',
    diagram: 'bg-teal-500',
    mindmap: 'bg-purple-500',
    gmail: 'bg-red-500',
    slack: 'bg-purple-600',
    github: 'bg-gray-700',
    discord: 'bg-indigo-500',
    'google-calendar': 'bg-blue-500',
    'ai-processing': 'bg-violet-600',
    'local-apps': 'bg-gray-500',
    'claude-dashboard': 'bg-amber-500',
    spotify: 'bg-green-600',
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

export default function AutomationsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggle(id: string, currentActive: boolean) {
    setToggling(id);
    const res = await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !currentActive }),
    });
    if (res.ok) {
      setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, active: !currentActive } : a));
    }
    setToggling(null);
  }

  useEffect(() => {
    fetch('/api/automations/list')
      .then((r) => r.json())
      .then((data) => setAutomations(data.automations || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 sm:px-6 py-3"
        style={{ height: '52px', background: '#111', borderBottom: '1px solid #1e1e1e' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#555] hover:text-[#ccc] transition-colors text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-white font-bold text-base">My Automations</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-400 uppercase tracking-wider">
            {automations.length}
          </span>
        </div>
        <Link
          href="/automations/new"
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + New Automation
        </Link>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="text-center py-20 text-[#444] text-sm">Loading...</div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
            <p className="text-[#444] text-base">No automations configured</p>
            <p className="text-[#333] text-sm mt-2">Create your first automation to get started</p>
            <Link
              href="/automations/new"
              className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              + New Automation
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map((auto) => (
              <div
                key={auto.id}
                onClick={() => router.push(`/automations/${auto.id}`)}
                className="rounded-xl border border-[#1e1e1e] hover:border-[#333] transition-colors cursor-pointer"
                style={{ background: '#141414' }}
              >
                <div className="p-4 sm:p-5">
                  {/* Flow: Trigger -> Action */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      {/* Trigger icon */}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getColor(auto.trigger_integration_type)}`}>
                        <img src={getIcon(auto.trigger_integration_type)} alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>

                      {/* Arrow */}
                      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="flex-shrink-0">
                        <path d="M0 6h14M10 1l5 5-5 5" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                      {/* Action icon */}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getColor(auto.action_integration_type)}`}>
                        <img src={getIcon(auto.action_integration_type)} alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                    </div>

                    {/* Status indicator */}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                      auto.active
                        ? 'bg-green-900/30 text-green-400 border border-green-900/50'
                        : 'bg-[#1a1a1a] text-[#555] border border-[#252525]'
                    }`}>
                      {auto.active ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  {/* Name */}
                  <p className="text-sm sm:text-base font-bold text-[#f0f0f0] mb-1">{auto.name}</p>
                  <p className="text-[11px] text-[#555] mb-3">
                    {auto.trigger_integration_name} ({auto.trigger_type.replace(/_/g, ' ')}) &rarr; {auto.action_integration_name} ({auto.action_type.replace(/_/g, ' ')})
                  </p>

                  {/* Stats bar */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-[12px]">
                    <span><span className="text-[#555]">Runs:</span> <span className="text-[#ccc] font-medium">{auto.total_runs}</span></span>
                    <span><span className="text-[#555]">OK:</span> <span className="text-green-400 font-medium">{auto.success_runs}</span></span>
                    {auto.last_run && (
                      <span><span className="text-[#555]">Last:</span> <span className="text-[#ccc]">{timeAgo(auto.last_run)}</span></span>
                    )}
                    {auto.action_config?.model && (
                      <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-[#555] text-[10px] border border-[#252525]">
                        {auto.action_config.model}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
