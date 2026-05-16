'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { integrations } from '@/data/integrations';

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

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Single source of truth from integrations data
const _iconMap = Object.fromEntries(integrations.map(i => [i.id, i.icon]));
_iconMap['stickies_api'] = _iconMap['stickies'] || '/icons/stickies.svg';

// Map tailwind color classes to hex
const _twToHex: Record<string, string> = {
  'bg-red-600': '#dc2626', 'bg-red-500': '#ef4444', 'bg-yellow-500': '#eab308',
  'bg-green-600': '#16a34a', 'bg-teal-500': '#14b8a6', 'bg-purple-500': '#a855f7',
  'bg-blue-500': '#3b82f6', 'bg-purple-600': '#9333ea', 'bg-gray-800': '#1f2937',
  'bg-gray-700': '#374151', 'bg-indigo-500': '#6366f1', 'bg-orange-500': '#f97316',
  'bg-cyan-600': '#0891b2', 'bg-emerald-600': '#059669', 'bg-gray-500': '#6b7280',
  'bg-amber-600': '#d97706',
};
const _colorHex = Object.fromEntries(integrations.map(i => [i.id, _twToHex[i.color] || '#666']));
_colorHex['stickies_api'] = _colorHex['stickies'] || '#eab308';

function getIcon(type: string): string {
  return _iconMap[type] || '/icons/ai-processing.svg';
}

function IconImg({ type, className }: { type: string; className?: string }) {
  const icon = getIcon(type);
  if (icon.startsWith('/')) return <img src={icon} alt="" className={className} />;
  return <span className={className} style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>;
}

const colorHex = _colorHex;

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCondition, setEditCondition] = useState<Record<string, string>>({});
  const [editActionConfig, setEditActionConfig] = useState<Record<string, string>>({});

  // YouTube likes
  const [likes, setLikes] = useState<{ videoId: string; title: string; channel: string; thumbnail: string; views: string }[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalLikes, setTotalLikes] = useState(0);
  const [unliking, setUnliking] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'likes' | 'logs'>('likes');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Toast
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

  // Underlying fetch
  const fetchLogsNow = useCallback(() => {
    fetch(`/api/automations/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.logs) setLogs(data.logs); })
      .catch(() => {});
  }, [id]);

  // Debounce: coalesce bursts of SSE events into one refetch at most every 2s.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshLogs = useCallback(() => {
    if (refreshTimer.current) return; // already scheduled
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      fetchLogsNow();
    }, 2000);
  }, [fetchLogsNow]);

  useEffect(() => {
    fetch(`/api/automations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAutomation(data.automation);
        setLogs(data.logs || []);
        if (data.automation?.trigger_type === 'video_liked') {
          fetchLikes();
          const loggedIds = (data.logs || []).map((log: LogEntry) => {
            try {
              const p = typeof log.trigger_payload === 'string' ? JSON.parse(log.trigger_payload) : log.trigger_payload;
              return p?.videoId;
            } catch { return null; }
          }).filter(Boolean);
          if (loggedIds.length) setProcessedIds(new Set(loggedIds));
        }
      })
      .finally(() => setLoading(false));

    const es = new EventSource('/api/events');
    let sseErrorCount = 0;
    let sseErrorToastShown = false;
    es.onerror = () => {
      sseErrorCount += 1;
      if (!sseErrorToastShown) {
        sseErrorToastShown = true;
        showToast('Connection lost, retrying...', '#EF4444', true);
      }
      if (sseErrorCount >= 5) {
        es.close();
        showToast('Realtime updates disabled', '#EF4444', true);
      }
    };
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
      // Append synthetic log entry locally instead of refetching all logs.
      // The authoritative row will land on the next debounced refresh from `logged`,
      // but the UI updates instantly here.
      const synthetic: LogEntry = {
        id: `sse-${data.videoId}-${Date.now()}`,
        automation_name: '',
        triggered_at: new Date().toISOString(),
        trigger_payload: { videoId: data.videoId, title: data.title || '' },
        result: 'success',
        detail: data.title || '',
        via: 'sse',
      };
      setLogs((prev) => [synthetic, ...prev]);
    });
    es.addEventListener('logged', () => refreshLogs());
    es.addEventListener('gmail_match', () => refreshLogs());
    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        showToast(`Failed: ${data.error?.slice(0, 40)}`, '#EF4444', true);
      } catch {}
    });
    return () => {
      es.close();
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
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
    } catch {
      showToast('Failed to load liked videos', '#EF4444', true);
    }
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
        // Trigger fade-out animation, then remove from list
        setRemovingIds((prev) => new Set(prev).add(videoId));
        setTotalLikes((prev) => prev - 1);
        setTimeout(() => {
          setLikes((prev) => prev.filter((v) => v.videoId !== videoId));
          setRemovingIds((prev) => {
            const next = new Set(prev);
            next.delete(videoId);
            return next;
          });
        }, 280);
      } else {
        showToast('Unlike failed', '#EF4444', true);
        setUnliking(null);
      }
    } catch {
      showToast('Unlike failed', '#EF4444', true);
      setUnliking(null);
    }
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
        showToast(`Saved "${(data.title || 'Video').slice(0, 30)}"`, '#34C759');
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
    if (res.ok) router.push('/automations');
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
    if (res.ok) setAutomation({ ...automation, active: !automation.active });
    setToggling(false);
  }

  function startEdit() {
    if (!automation) return;
    setEditName(automation.name);
    setEditCondition({ ...(automation.condition || {}) });
    setEditActionConfig({ ...(automation.action_config || {}) });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!automation) return;
    setSaving(true);
    const body: Record<string, unknown> = {};
    if (editName !== automation.name) body.name = editName;
    const condChanged = JSON.stringify(editCondition) !== JSON.stringify(automation.condition || {});
    if (condChanged) body.condition = editCondition;
    const actChanged = JSON.stringify(editActionConfig) !== JSON.stringify(automation.action_config || {});
    if (actChanged) body.action_config = editActionConfig;
    if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return; }
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAutomation({
          ...automation,
          name: editName,
          condition: { ...editCondition },
          action_config: { ...editActionConfig },
        });
        setEditing(false);
        showToast('Saved', '#34C759');
      } else {
        showToast('Save failed', '#EF4444', true);
      }
    } catch {
      showToast('Save failed', '#EF4444', true);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#333] border-t-[#888] animate-spin" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: '#0a0a0a' }}>
        <p className="text-[#444] text-sm">Automation not found</p>
        <Link href="/automations" className="text-xs text-indigo-400 hover:text-indigo-300">Back to automations</Link>
      </div>
    );
  }

  const triggerColor = colorHex[automation.trigger_integration_type] || '#666';
  const actionColor = colorHex[automation.action_integration_type] || '#666';
  const successCount = logs.filter(l => l.result === 'success' || l.result === 'ok').length;

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <header className="px-5 sm:px-8 pt-6 pb-2">
        <Link href="/automations" className="text-[#444] hover:text-[#aaa] transition-colors inline-flex items-center gap-1.5 text-xs mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Automations
        </Link>
        <h1 className="text-[22px] font-bold text-white tracking-tight" style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
          {editing ? editName : automation.name}
        </h1>
      </header>

      <div className="px-5 sm:px-8 py-4 max-w-2xl">
        {/* Hero card */}
        <div
          className="rounded-2xl mb-6 relative overflow-hidden"
          style={{
            background: `linear-gradient(90deg, ${triggerColor}, ${actionColor})`,
            padding: '1px',
          }}
        ><div className="p-5 relative" style={{ background: '#141414', borderRadius: 15 }}>
          {/* Flow row */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: triggerColor, boxShadow: `0 4px 16px ${triggerColor}44` }}
            >
              <IconImg type={automation.trigger_integration_type} className="w-6 h-6" />
            </div>

            <div className="flex-shrink-0 flex items-center">
              <div className="w-8 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${triggerColor}, ${actionColor})` }} />
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="-ml-0.5">
                <path d="M1 1l5 5-5 5" stroke={actionColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: actionColor, boxShadow: `0 4px 16px ${actionColor}44` }}
            >
              <IconImg type={automation.action_integration_type} className="w-6 h-6" />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!editing && (
                <button
                  onClick={startEdit}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium text-[#888] hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  Edit
                </button>
              )}
              <button
                onClick={handleToggle}
                disabled={toggling}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ background: automation.active ? '#22c55e' : '#333' }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm"
                  style={{ left: automation.active ? '22px' : '2px' }}
                />
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-[12px] text-[#888] mb-3">
            {automation.trigger_integration_name || automation.trigger_integration_type} ({automation.trigger_type.replace(/_/g, ' ')})
            {' '}&rarr;{' '}
            {automation.action_integration_name || automation.action_integration_type} ({automation.action_type.replace(/_/g, ' ')})
          </p>

          {/* Config display (when not editing) */}
          {!editing && (Object.keys(automation.condition || {}).some(k => (automation.condition || {})[k]) || Object.keys(automation.action_config || {}).some(k => (automation.action_config || {})[k])) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(automation.condition || {}).filter(([, v]) => v).map(([k, v]) => (
                <span key={`c-${k}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]" style={{ background: '#1e1e1e' }}>
                  <span className="text-[#555]">{k}:</span>
                  <span className="text-[#ccc]">{v}</span>
                </span>
              ))}
              {Object.entries(automation.action_config || {}).filter(([, v]) => v).map(([k, v]) => {
                const isColor = /^#([0-9a-f]{3,8})$/i.test(v);
                return (
                  <span key={`a-${k}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]" style={{ background: '#1e1e1e' }}>
                    <span className="text-[#555]">{k}:</span>
                    {isColor ? (
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: v, border: '1px solid rgba(255,255,255,0.15)' }} />
                    ) : (
                      <span className="text-[#ccc]">{v}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="text-[11px] text-[#555] uppercase tracking-wider font-semibold mb-1 block">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-[14px] text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                  style={{ background: '#0f0f0f', border: '1px solid #333', fontSize: '16px' }}
                />
              </div>
              {Object.keys(editCondition).length > 0 && (
                <div>
                  <label className="text-[11px] text-[#555] uppercase tracking-wider font-semibold mb-1 block">Trigger Config</label>
                  {Object.entries(editCondition).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 mb-2">
                      <span className="text-[12px] text-[#666] w-20 flex-shrink-0">{key}</span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setEditCondition({ ...editCondition, [key]: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl text-[14px] text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        style={{ background: '#0f0f0f', border: '1px solid #333', fontSize: '16px' }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(editActionConfig).length > 0 && (
                <div>
                  <label className="text-[11px] text-[#555] uppercase tracking-wider font-semibold mb-1 block">Action Config</label>
                  {Object.entries(editActionConfig).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 mb-2">
                      <span className="text-[12px] text-[#666] w-20 flex-shrink-0">{key}</span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setEditActionConfig({ ...editActionConfig, [key]: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl text-[14px] text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        style={{ background: '#0f0f0f', border: '1px solid #333', fontSize: '16px' }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#6366f1' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#666] hover:text-[#aaa] transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2">
            <div className="px-3 py-1.5 rounded-full text-[11px] font-medium" style={{ background: 'rgba(255,255,255,0.06)', color: '#aaa' }}>
              {logs.length} runs
            </div>
            {successCount > 0 && (
              <div className="px-3 py-1.5 rounded-full text-[11px] font-medium" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
                {successCount} successful
              </div>
            )}
            <div className="px-3 py-1.5 rounded-full text-[11px] font-medium" style={{ background: 'rgba(255,255,255,0.04)', color: '#666' }}>
              Created {timeAgo(automation.created_at)}
            </div>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="ml-auto px-3 py-1.5 rounded-full text-[11px] text-[#333] hover:text-red-400 hover:bg-red-900/10 transition-all"
              >
                Delete
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
                >
                  {deleting ? '...' : 'Confirm'}
                </button>
                <button onClick={() => setShowConfirm(false)} className="px-2 py-1.5 text-[11px] text-[#555]">Cancel</button>
              </div>
            )}
          </div>
        </div></div>

        {/* Tabs */}
        {automation.trigger_type === 'video_liked' && (
          <div className="flex gap-2 mb-4">
            {(['likes', 'logs'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={{
                  background: tab === t ? '#fff' : 'rgba(255,255,255,0.06)',
                  color: tab === t ? '#000' : '#666',
                }}
              >
                {t === 'likes' ? `Liked Videos (${totalLikes})` : `Logs (${logs.length})`}
              </button>
            ))}
          </div>
        )}

        {/* YouTube Likes */}
        {automation.trigger_type === 'video_liked' && tab === 'likes' && (
          <div className="space-y-2">
            {likesLoading && likes.length === 0 ? (
              <div className="text-center py-12 text-[#333] text-sm">Loading liked videos...</div>
            ) : (
              <>
                {likes.map((video, i) => (
                  <div
                    key={video.videoId}
                    className="group flex items-center gap-3 p-3 rounded-2xl transition-all hover:scale-[1.01]"
                    style={{
                      background: '#141414',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                      animationDelay: `${i * 40}ms`,
                      transition: 'opacity 260ms ease, transform 260ms ease, max-height 260ms ease, padding 260ms ease, margin 260ms ease',
                      opacity: removingIds.has(video.videoId) ? 0 : 1,
                      transform: removingIds.has(video.videoId) ? 'translateX(24px)' : 'translateX(0)',
                      maxHeight: removingIds.has(video.videoId) ? 0 : 200,
                      overflow: 'hidden',
                      pointerEvents: removingIds.has(video.videoId) ? 'none' : 'auto',
                    }}
                  >
                    <a href={`https://youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img src={video.thumbnail} alt="" className="rounded-xl" loading="lazy" decoding="async" style={{ width: '88px', height: '50px', objectFit: 'cover' }} />
                    </a>
                    <div className="flex-1 min-w-0">
                      <a href={`https://youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer"
                        className="text-[13px] font-medium text-[#e0e0e0] hover:text-white transition-colors line-clamp-1">
                        {video.title}
                      </a>
                      <p className="text-[10px] text-[#555] mt-0.5">{video.channel} - {formatViews(video.views)} views</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {processedIds.has(video.videoId) ? (
                        <span className="text-[10px] text-green-400/70 px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)' }}>Done</span>
                      ) : (
                        <button
                          onClick={() => handleProcess(video.videoId)}
                          disabled={processing === video.videoId}
                          className="px-3 py-1.5 rounded-full text-[10px] font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                        >
                          {processing === video.videoId ? 'Processing...' : 'Process'}
                        </button>
                      )}
                      <button
                        onClick={() => handleUnlike(video.videoId)}
                        disabled={unliking === video.videoId}
                        className="p-1.5 rounded-full hover:bg-[#1e1e1e] transition-colors"
                        title="Unlike"
                        aria-label="Unlike video"
                      >
                        {unliking === video.videoId ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="none" style={{ transition: 'fill 200ms ease' }}>
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
                      className="px-5 py-2 rounded-full text-xs font-medium text-[#888] hover:text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {likesLoading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Execution Logs */}
        {(automation.trigger_type !== 'video_liked' || tab === 'logs') && (
          <div>
            {automation.trigger_type !== 'video_liked' && (
              <p className="text-[12px] text-[#555] font-semibold uppercase tracking-wider mb-3">
                Execution Logs ({logs.length})
              </p>
            )}

            {logs.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: '#141414' }}>
                <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <p className="text-[#444] text-sm">No executions yet</p>
                <p className="text-[#333] text-xs mt-1">Waiting for trigger events...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => {
                  const payload = typeof log.trigger_payload === 'string'
                    ? (() => { try { return JSON.parse(log.trigger_payload); } catch { return {}; } })()
                    : (log.trigger_payload || {});
                  const videoTitle = payload.title || payload.subject || '';
                  const mindmapId = payload.mindmapId;
                  const diagramId = payload.diagramId;
                  const videoId = payload.videoId;
                  const isExpanded = expandedLog === log.id;
                  const isSuccess = log.result === 'success' || log.result === 'ok';
                  const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null;

                  return (
                    <div
                      key={log.id}
                      className="rounded-2xl overflow-hidden transition-all"
                      style={{
                        background: '#141414',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                        animationDelay: `${i * 40}ms`,
                      }}
                    >
                      <div
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-[#1a1a1a]"
                      >
                        {/* Status icon */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isSuccess ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          }}
                        >
                          {isSuccess ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#e0e0e0] truncate leading-tight">
                            {videoTitle || log.detail?.slice(0, 60) || 'Execution'}
                          </p>
                          <p className="text-[10px] text-[#555] mt-0.5">
                            {timeAgo(log.triggered_at)}
                            {log.via && <span className="ml-2 text-[#444]">via {log.via}</span>}
                          </p>
                        </div>

                        {/* Chevron */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round"
                          className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          {thumbnail && (
                            <div className="flex gap-3 pt-3">
                              <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                <img src={thumbnail} alt="" className="rounded-xl" loading="lazy" decoding="async" style={{ width: '110px', height: '62px', objectFit: 'cover' }} />
                              </a>
                              <div className="min-w-0">
                                <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
                                  className="text-[13px] font-medium text-[#e0e0e0] hover:text-white transition-colors line-clamp-2">
                                  {videoTitle}
                                </a>
                                <p className="text-[11px] text-[#555] mt-1">{new Date(log.triggered_at).toLocaleString()}</p>
                              </div>
                            </div>
                          )}

                          {!thumbnail && log.detail && (
                            <p className="text-[12px] text-[#888] leading-relaxed pt-3">{log.detail}</p>
                          )}

                          {/* Raw debug details */}
                          <div className="rounded-xl p-3 mt-2" style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}>
                            <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-[11px]" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace" }}>
                              <span className="text-[#555]">result</span>
                              <span className={isSuccess ? 'text-green-400' : 'text-red-400'}>{log.result || '-'}</span>
                              <span className="text-[#555]">via</span>
                              <span className="text-[#888]">{log.via || '-'}</span>
                              <span className="text-[#555]">at</span>
                              <span className="text-[#888]">{new Date(log.triggered_at).toLocaleString()}</span>
                              {log.detail && (
                                <>
                                  <span className="text-[#555]">detail</span>
                                  <span className="text-[#aaa] break-words whitespace-pre-wrap">{log.detail}</span>
                                </>
                              )}
                              {Object.keys(payload).length > 0 && (
                                <>
                                  <span className="text-[#555] self-start">payload</span>
                                  <pre className="text-[#aaa] break-words whitespace-pre-wrap m-0">{JSON.stringify(payload, null, 2)}</pre>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action links */}
                          <div className="flex flex-wrap gap-2">
                            {videoId && (
                              <a href={`https://youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors hover:scale-105"
                                style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171' }}>
                                <img src="/icons/youtube.svg" alt="" className="w-3.5 h-3.5" /> Video
                              </a>
                            )}
                            {mindmapId && automation.action_integration_type === 'mindmap' && (
                              <a href={`https://mindmaps-bheng.vercel.app/?id=${mindmapId}`} target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors hover:scale-105"
                                style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc' }}>
                                <img src="/icons/mindmap.svg" alt="" className="w-3.5 h-3.5" /> Mind Map
                              </a>
                            )}
                            {diagramId && automation.action_integration_type === 'diagram' && (
                              <a href={`https://diagrams-bheng.vercel.app/?id=${diagramId}`} target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors hover:scale-105"
                                style={{ background: 'rgba(20,184,166,0.1)', color: '#5eead4' }}>
                                <img src="/icons/diagram.svg" alt="" className="w-3.5 h-3.5" /> Diagram
                              </a>
                            )}
                            {automation.action_integration_type === 'stickies_api' && (
                              <span className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5"
                                style={{ background: 'rgba(234,179,8,0.1)', color: '#facc15' }}>
                                <img src="/icons/stickies.svg" alt="" className="w-3.5 h-3.5" /> Stickies
                              </span>
                            )}
                            {automation.action_integration_type === 'hue' && (
                              <span className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5"
                                style={{ background: 'rgba(249,115,22,0.1)', color: '#fb923c' }}>
                                <img src="/icons/hue.svg" alt="" className="w-3.5 h-3.5" /> Hue
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
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
                  {String.fromCodePoint(0x1F525)}
                </div>
              ) : (
                <div key={i} className="fixed z-[2147483646] pointer-events-none rounded-sm"
                  style={{ width: size, height: size, left: cx, top: cy, background: cols[i % cols.length], animation: `confettiShoot 1.2s cubic-bezier(0.2,1,0.3,1) ${i * 45}ms both`, '--cx': `${tx - cx}px`, '--cy': `${ty - cy}px` } as React.CSSProperties} />
              );
            })}
            <div className="fixed z-[2147483647] pointer-events-none"
              style={{ left: 0, right: 0, top: 'calc(env(safe-area-inset-top, 0px) + 14px)', display: 'flex', justifyContent: 'center', animation: 'islandToastInOut 3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{
                background: toastColor, border: `1px solid ${toastColor}99`, boxShadow: `0 8px 26px ${toastColor}66`, color: textCol,
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
