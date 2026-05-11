'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  active: boolean;
  action_config: Record<string, string>;
  condition: Record<string, string>;
  created_at: string;
  updated_at: string;
  trigger_integration_name: string;
  trigger_integration_type: string;
  action_integration_name: string;
  action_integration_type: string;
}

interface LogEntry {
  id: string;
  automation_name: string;
  triggered_at: string;
  trigger_payload: Record<string, string>;
  result: string;
  detail: string;
  via: string;
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

export default function AutomationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toggling, setToggling] = useState(false);

  // YouTube likes
  const [likes, setLikes] = useState<{ videoId: string; title: string; channel: string; thumbnail: string; views: string }[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalLikes, setTotalLikes] = useState(0);
  const [unliking, setUnliking] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'likes' | 'logs'>('likes');

  // Toast state (Stickies-style)
  const [toast, setToast] = useState('');
  const [toastColor, setToastColor] = useState('#34C759');
  const [toastKey, setToastKey] = useState(0);
  const [toastIsError, setToastIsError] = useState(false);

  const showToast = useCallback((msg: string, color = '#34C759', isError = false) => {
    setToastKey((k) => k + 1);
    setToastColor(color);
    setToast(msg);
    setToastIsError(isError);
    setTimeout(() => { setToast(''); setToastIsError(false); }, 3000);
  }, []);

  const refreshLogs = useCallback(() => {
    fetch(`/api/automations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.logs) setLogs(data.logs);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    fetch(`/api/automations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAutomation(data.automation);
        setLogs(data.logs || []);
        if (data.automation?.trigger_type === 'video_liked') {
          fetchLikes();
        }
      })
      .finally(() => setLoading(false));

    // SSE - live events from VPS watcher
    const es = new EventSource('/api/events');
    es.addEventListener('processing', (e) => {
      const data = JSON.parse(e.data);
      setProcessing(data.videoId);
      showToast(`Processing "${data.title?.slice(0, 30)}"...`, '#6366f1');
    });
    es.addEventListener('processed', (e) => {
      const data = JSON.parse(e.data);
      setProcessing(null);
      setProcessedIds((prev) => new Set([...prev, data.videoId]));
      showToast(`Done "${data.title?.slice(0, 30)}"`, '#34C759');
      refreshLogs();
    });
    es.addEventListener('logged', () => refreshLogs());
    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        showToast(`Failed: ${data.error?.slice(0, 40)}`, '#EF4444', true);
      } catch {}
    });

    return () => es.close();
  }, [id, refreshLogs, showToast]);

  async function fetchLikes(pageToken?: string) {
    setLikesLoading(true);
    try {
      const url = pageToken ? `/api/youtube/likes?pageToken=${pageToken}` : '/api/youtube/likes?maxResults=20';
      const res = await fetch(url);
      const data = await res.json();
      if (data.videos) {
        setLikes((prev) => pageToken ? [...prev, ...data.videos] : data.videos);
        setNextPageToken(data.nextPageToken);
        setTotalLikes(data.totalResults);
      }
    } catch {}
    setLikesLoading(false);
  }

  async function handleUnlike(videoId: string) {
    setUnliking(videoId);
    try {
      const res = await fetch('/api/youtube/unlike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (res.ok) {
        setLikes((prev) => prev.filter((v) => v.videoId !== videoId));
        setTotalLikes((prev) => prev - 1);
      }
    } catch {}
    setUnliking(null);
  }

  async function handleProcess(videoId: string) {
    setProcessing(videoId);
    try {
      const res = await fetch('/api/youtube/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (res.ok) {
        const data = await res.json();
        setProcessedIds((prev) => new Set([...prev, videoId]));
        const label = (data.title || 'Video').slice(0, 30);
        showToast(`Saved "${label}"`, '#34C759');
        refreshLogs();
      } else {
        showToast('Process failed', '#EF4444', true);
      }
    } catch {
      showToast('Process failed', '#EF4444', true);
    }
    setProcessing(null);
  }

  function formatViews(views: string): string {
    const n = parseInt(views);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return views;
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/automations');
    }
    setDeleting(false);
  }

  async function handleToggle() {
    if (!automation) return;
    setToggling(true);
    const res = await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !automation.active }),
    });
    if (res.ok) {
      setAutomation({ ...automation, active: !automation.active });
    }
    setToggling(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f0f' }}>
        <p className="text-[#444] text-sm">Loading...</p>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f0f' }}>
        <p className="text-[#444] text-sm">Automation not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f0f0f' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 sm:px-6 py-3"
        style={{ height: '52px', background: '#111', borderBottom: '1px solid #1e1e1e' }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/automations" className="text-[#555] hover:text-[#ccc] transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-white font-bold text-sm sm:text-base truncate">{automation.name}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Flow card */}
        <div className="rounded-xl border border-[#1e1e1e] p-4 sm:p-6 mb-6" style={{ background: '#141414' }}>
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Trigger */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getColor(automation.trigger_integration_type)}`}>
                <img src={getIcon(automation.trigger_integration_type)} alt="" className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Trigger (IF)</p>
                <p className="text-sm sm:text-base text-[#f0f0f0] font-semibold truncate">{automation.trigger_integration_name}</p>
                <p className="text-[11px] sm:text-xs text-[#555] truncate">{automation.trigger_type.replace(/_/g, ' ')}</p>
              </div>
            </div>

            <svg width="28" height="16" viewBox="0 0 28 16" fill="none" className="flex-shrink-0 sm:w-[40px]">
              <path d="M0 8h22M18 3l5 5-5 5" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* Action */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getColor(automation.action_integration_type)}`}>
                <img src={getIcon(automation.action_integration_type)} alt="" className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Action (THEN)</p>
                <p className="text-sm sm:text-base text-[#f0f0f0] font-semibold truncate">{automation.action_integration_name}</p>
                <p className="text-[11px] sm:text-xs text-[#555] truncate">{automation.action_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Config */}
        {automation.action_config && Object.keys(automation.action_config).length > 0 && (
          <div className="rounded-xl border border-[#1e1e1e] p-4 sm:p-5 mb-6" style={{ background: '#141414' }}>
            <p className="text-xs text-[#555] font-bold uppercase tracking-wider mb-3">Configuration</p>
            <div className="space-y-2">
              {Object.entries(automation.action_config).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#888] flex-shrink-0">{key}</span>
                  <span className="text-xs text-[#ccc] font-mono bg-[#1a1a1a] px-2 py-0.5 rounded truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="rounded-xl border border-[#1e1e1e] p-4 sm:p-5 mb-6" style={{ background: '#141414' }}>
          <p className="text-xs text-[#555] font-bold uppercase tracking-wider mb-3">Details</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-[#888] flex-shrink-0">ID</span>
              <span className="text-[#555] font-mono truncate">{automation.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#888]">Created</span>
              <span className="text-[#ccc]">{new Date(automation.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#888]">Updated</span>
              <span className="text-[#ccc]">{new Date(automation.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-8">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="flex items-center gap-2"
          >
            <div
              className="relative w-10 h-[22px] rounded-full transition-colors duration-200"
              style={{ background: automation.active ? '#22c55e' : '#333' }}
            >
              <div
                className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                style={{ transform: automation.active ? 'translateX(20px)' : 'translateX(3px)' }}
              />
            </div>
            <span className="text-xs text-[#888]">{automation.active ? 'Active' : 'Paused'}</span>
          </button>

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1a1a1a] border border-[#333] text-[#888] hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20 transition-all"
            >
              Delete Automation
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Are you sure?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-2 rounded-lg text-xs text-[#888] hover:text-[#ccc] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Tabs: Likes (YouTube only) + Logs */}
        {automation.trigger_type === 'video_liked' && (
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setTab('likes')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'likes' ? 'bg-[#1e1e1e] text-[#f0f0f0]' : 'text-[#555] hover:text-[#888]'
              }`}
            >
              Liked Videos ({totalLikes})
            </button>
            <button
              onClick={() => setTab('logs')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'logs' ? 'bg-[#1e1e1e] text-[#f0f0f0]' : 'text-[#555] hover:text-[#888]'
              }`}
            >
              Logs ({logs.length})
            </button>
          </div>
        )}

        {/* YouTube Likes */}
        {automation.trigger_type === 'video_liked' && tab === 'likes' && (
          <div>
            {likesLoading && likes.length === 0 ? (
              <p className="text-sm text-[#444] py-8 text-center">Loading liked videos...</p>
            ) : (
              <div className="space-y-1">
                {likes.map((video) => (
                  <div
                    key={video.videoId}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#141414] transition-colors"
                  >
                    <a href={`https://youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img src={video.thumbnail} alt="" className="rounded" style={{ width: '100px', height: '56px', objectFit: 'cover' }} />
                    </a>
                    <div className="flex-1 min-w-0">
                      <a href={`https://youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-[#f0f0f0] hover:text-indigo-400 transition-colors line-clamp-1">
                        {video.title}
                      </a>
                      <p className="text-[11px] text-[#555]">{video.channel} - {formatViews(video.views)} views</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {processedIds.has(video.videoId) ? (
                        <span className="text-[10px] text-green-400 px-2 py-1">Saved</span>
                      ) : (
                        <button
                          onClick={() => handleProcess(video.videoId)}
                          disabled={processing === video.videoId}
                          className="px-2.5 py-1 rounded text-[10px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {processing === video.videoId ? (
                            <>
                              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                              </svg>
                              Processing
                            </>
                          ) : 'Process'}
                        </button>
                      )}
                      <button
                        onClick={() => handleUnlike(video.videoId)}
                        disabled={unliking === video.videoId}
                        className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
                        title="Unlike"
                      >
                        {unliking === video.videoId ? (
                          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" className="hover:opacity-60">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                {nextPageToken && (
                  <div className="text-center py-4">
                    <button
                      onClick={() => fetchLikes(nextPageToken)}
                      disabled={likesLoading}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors"
                    >
                      {likesLoading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Logs */}
        {(automation.trigger_type !== 'video_liked' || tab === 'logs') && (
          <div>
            {!automation.trigger_type || automation.trigger_type !== 'video_liked' ? (
              <p className="text-xs text-[#555] font-bold uppercase tracking-wider mb-3">
                Execution Logs ({logs.length})
              </p>
            ) : null}

            {logs.length === 0 ? (
              <p className="text-sm text-[#333] py-4">No executions yet</p>
            ) : (
              <div className="space-y-1 overflow-x-auto">
                {logs.map((log) => {
                  const payload = typeof log.trigger_payload === 'string'
                    ? (() => { try { return JSON.parse(log.trigger_payload); } catch { return {}; } })()
                    : (log.trigger_payload || {});
                  const videoTitle = payload.title || '';
                  const mindmapId = payload.mindmapId;
                  const diagramId = payload.diagramId;
                  const videoId = payload.videoId;

                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 rounded-lg hover:bg-[#141414] transition-colors min-w-0"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        log.result === 'success' || log.result === 'ok' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-[10px] sm:text-[11px] text-[#555] w-28 sm:w-36 flex-shrink-0">
                        {new Date(log.triggered_at).toLocaleString()}
                      </span>
                      {log.result === 'error' && (
                        <span className="text-[10px] sm:text-[11px] font-medium w-14 sm:w-16 flex-shrink-0 text-red-400">
                          {log.result}
                        </span>
                      )}
                      <span className="text-[10px] sm:text-[11px] text-[#888] truncate flex-1 min-w-0">
                        {videoTitle || log.detail || '-'}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {videoId && (
                          <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors">
                            YT
                          </a>
                        )}
                        {mindmapId && (
                          <a href={`https://mindmaps-bheng.vercel.app/?id=${mindmapId}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 hover:bg-purple-900/50 transition-colors">
                            Mind Map
                          </a>
                        )}
                        {diagramId && (
                          <a href={`https://diagrams-bheng.vercel.app/?id=${diagramId}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50 transition-colors">
                            Diagram
                          </a>
                        )}
                        {log.via && (
                          <span className="text-[10px] text-[#444] bg-[#1a1a1a] px-1.5 py-0.5 rounded hidden sm:inline">
                            {log.via}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stickies-style toast */}
      {toast && typeof document !== 'undefined' && (() => {
        const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
        const cy = 32;
        const isError = toastIsError;
        const hex = toastColor.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const textCol = luma > 0.65 ? '#000' : '#fff';
        return createPortal(
          <div key={toastKey}>
            {/* Confetti / fire particles */}
            {Array.from({ length: isError ? 8 : 12 }).map((_, i) => {
              const count = isError ? 8 : 12;
              const angle = (i / count) * 360;
              const dist = isError ? 20 + (i % 4) * 8 : 28 + (i % 4) * 10;
              const size = isError ? 0 : 3 + (i % 3);
              const tx = Math.round(cx + Math.cos((angle * Math.PI) / 180) * dist);
              const ty = Math.round(cy + Math.sin((angle * Math.PI) / 180) * dist);
              const cols = [toastColor, '#ffffff', '#FFD700', '#a78bfa', '#34d399', '#f472b6'];
              return isError ? (
                <div key={i} className="fixed z-[2147483646] pointer-events-none text-sm"
                  style={{ left: cx, top: cy, animation: `confettiShoot 1.4s cubic-bezier(0.2,1,0.3,1) ${i * 60}ms both`, '--cx': `${tx - cx}px`, '--cy': `${ty - cy}px` } as React.CSSProperties}>
                  🔥
                </div>
              ) : (
                <div key={i} className="fixed z-[2147483646] pointer-events-none rounded-sm"
                  style={{ width: size, height: size, left: cx, top: cy, background: cols[i % cols.length], animation: `confettiShoot 1.2s cubic-bezier(0.2,1,0.3,1) ${i * 45}ms both`, '--cx': `${tx - cx}px`, '--cy': `${ty - cy}px` } as React.CSSProperties} />
              );
            })}
            {/* Toast pill */}
            <div className="fixed z-[2147483647] pointer-events-none"
              style={{ left: 0, right: 0, top: 'calc(env(safe-area-inset-top, 0px) + 14px)', display: 'flex', justifyContent: 'center', animation: 'islandToastInOut 3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{
                background: toastColor,
                border: `1px solid ${toastColor}99`,
                boxShadow: `0 8px 26px ${toastColor}66`,
                color: textCol,
              }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={textCol} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
                  </svg>
                </span>
                <span className="font-bold tracking-tight text-[11px] sm:text-[12px] leading-snug max-w-[220px] break-words text-center">{toast}</span>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      <style jsx global>{`
        @keyframes islandToastInOut {
          0% { opacity: 0; transform: translateY(-8px) scale(0.72); }
          14% { opacity: 1; transform: translateY(0) scale(1); }
          82% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.78); }
        }
        @keyframes confettiShoot {
          0% { transform: translate(0, 0) scale(0); opacity: 1; }
          60% { transform: translate(var(--cx), var(--cy)) scale(1); opacity: 1; }
          100% { transform: translate(var(--cx), var(--cy)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
