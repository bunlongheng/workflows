'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { integrations } from '@/data/integrations';
import { motion } from 'motion/react';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  active: boolean;
  action_config: Record<string, string>;
  condition: Record<string, string>;
  created_at: string;
  trigger_integration_name: string;
  trigger_integration_type: string;
  action_integration_name: string;
  action_integration_type: string;
  total_runs: string;
  success_runs: string;
  last_run: string | null;
}

// Single source of truth
const _iconMap = Object.fromEntries(integrations.map(i => [i.id, i.icon]));
_iconMap['stickies_api'] = _iconMap['stickies'] || '/icons/stickies.svg';

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
  return <span className={className} style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>;
}

function getColorHex(type: string): string {
  return _colorHex[type] || '#666';
}

function configDefaults(actionIntegrationType: string): Record<string, string> {
  if (actionIntegrationType === 'mindmap') return { type: 'logic', line: 'brace' };
  return {};
}

const ACTION_LABELS: Record<string, string> = {
  transcribe_and_summarize: 'summarize',
  hue_flash: 'color',
  set_color: 'color',
  create_diagram: 'diagram',
  create_mind_map: 'mind map',
  create_sticky: 'sticky',
  create_event: 'event',
};

function prettyAction(actionType: string): string {
  if (ACTION_LABELS[actionType]) return ACTION_LABELS[actionType];
  return actionType.replace(/_/g, ' ').replace(/^(create|generate|set|send|make|run|post) /i, '');
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const HIDDEN_KEYS = new Set(['model', 'group_id', 'group', 'folder', 'output', 'api_key', 'bot_token', 'chat_id']);


function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ANIMATIONS = [
  { animate: { y: [0, -3, 0] }, transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const } },
  { animate: { rotate: [0, 5, -5, 0] }, transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const } },
  { animate: { scale: [1, 1.08, 1] }, transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' as const } },
  { animate: { x: [0, 2, -2, 0] }, transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const } },
  { animate: { rotate: [0, -3, 3, -3, 0], y: [0, -2, 0] }, transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const } },
];

function BotMascot({ size = 28 }: { size?: number }) {
  const [anim] = useState(() => ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)]);
  return (
    <motion.div
      className="inline-flex items-center justify-center flex-shrink-0"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, ...anim.animate }}
      transition={{ ...anim.transition, scale: { type: 'spring', stiffness: 400, damping: 12, delay: 0.2 }, opacity: { duration: 0.3, delay: 0.2 } }}
    >
      <img src="/bot.svg" alt="" width={size} height={size} style={{ opacity: 0.8 }} />
    </motion.div>
  );
}

export default function AutomationsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/automations/list')
      .then((r) => r.json())
      .then((data) => setAutomations(data.automations || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = automations;

  return (
    <div className="min-h-screen select-none" style={{ background: '#0a0a0a', overflowX: 'hidden' }}>
      {/* Header */}
      <header className="px-5 sm:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between mt-3 mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif", background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Automations
            </h1>
            <BotMascot size={28} />
          </div>
          <Link
            href="/automations/new"
            className="px-4 py-2 rounded-full text-[12px] font-semibold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            + New
          </Link>
        </div>

      </header>

      {/* Content */}
      <div className="px-5 sm:px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#333] border-t-[#888] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#141414] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-[#444] text-sm">No automations yet</p>
            <Link
              href="/automations/new"
              className="mt-3 px-5 py-2 rounded-full text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              Create First Automation
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((auto) => {
              const triggerColor = getColorHex(auto.trigger_integration_type);
              const actionColor = getColorHex(auto.action_integration_type);
              const triggerCfg = Object.entries(auto.condition || {}).filter(([k, v]) => v !== '' && v != null && !HIDDEN_KEYS.has(k));
              const actionCfg = Object.entries({ ...configDefaults(auto.action_integration_type), ...(auto.action_config || {}) }).filter(([k, v]) => v !== '' && v != null && !HIDDEN_KEYS.has(k));
              return (
                <div
                  key={auto.id}
                  onClick={() => router.push(`/automations/${auto.id}`)}
                  className="group automation-card relative rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.005]"
                  style={{
                    background: `linear-gradient(90deg, ${triggerColor}, ${actionColor})`,
                    padding: '1px',
                    filter: auto.active ? 'none' : 'grayscale(1)',
                    opacity: auto.active ? 1 : 0.5,
                    ['--trigger-glow' as string]: `${triggerColor}55`,
                    ['--action-glow' as string]: `${actionColor}55`,
                  }}
                ><div
                  className="p-4 relative"
                  style={{ background: '#141414', borderRadius: 15 }}
                >
                  {/* Title - full width */}
                  <p className="text-[12px] font-semibold text-[#f0f0f0] truncate leading-tight mb-3">
                    {auto.name}
                  </p>

                  {/* Two sides - fixed 50/50 split */}
                  <div className="flex items-stretch">
                    {/* Trigger side */}
                    <div className="p-1" style={{ width: '50%' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: triggerColor, boxShadow: `0 4px 12px ${triggerColor}44` }}
                        >
                          <IconImg type={auto.trigger_integration_type} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] uppercase tracking-wider text-white font-semibold leading-none">If</p>
                          <p className="text-[10px] text-[#888] truncate leading-tight mt-0.5">
                            {triggerCfg.length > 0
                              ? triggerCfg.map(([k, v]) => `${k}: ${v}`).join(' ')
                              : auto.trigger_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action side */}
                    <div className="p-1" style={{ width: '50%' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: actionColor, boxShadow: `0 4px 12px ${actionColor}44` }}
                        >
                          <IconImg type={auto.action_integration_type} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] uppercase tracking-wider text-white font-semibold leading-none">Then</p>
                          <p className="text-[10px] text-[#888] truncate leading-tight mt-0.5 flex items-center gap-1">
                            <span className="truncate">
                              {prettyAction(auto.action_type)}
                              {actionCfg.filter(([, v]) => !HEX_RE.test(String(v))).length > 0 && (
                                <> - {actionCfg.filter(([, v]) => !HEX_RE.test(String(v))).map(([, v]) => String(v)).join(', ')}</>
                              )}
                            </span>
                            {actionCfg.filter(([, v]) => HEX_RE.test(String(v))).map(([, v]) => {
                              const c = String(v);
                              const isHue = auto.action_integration_type === 'hue';
                              return (
                                <span
                                  key={c}
                                  className={`inline-block rounded-full flex-shrink-0${isHue ? ' animate-pulse' : ''}`}
                                  style={{ width: 7, height: 7, background: c, boxShadow: isHue ? `0 0 6px ${c}` : 'none' }}
                                />
                              );
                            })}
                            {auto.action_type === 'hue_flash' && !actionCfg.some(([, v]) => HEX_RE.test(String(v))) && (
                              <span
                                className="inline-block rounded-full flex-shrink-0 animate-pulse"
                                style={{ width: 7, height: 7, background: '#facc15', boxShadow: '0 0 6px #facc15' }}
                              />
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <span className="absolute bottom-2 right-3 text-[9px] text-[#444]">{auto.total_runs}</span>

                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
