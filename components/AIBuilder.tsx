'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { integrations } from '@/data/integrations';

interface AIBuilderProps {
  onAddNodes: (nodes: Node[], edges: Edge[]) => void;
}

const examplePrompts = [
  'When someone pays on Stripe, add them to Mailchimp and notify Slack',
  'When a GitHub PR is merged, post to Discord and create a Trello card',
  'When I get a new Twitter mention, log it to Google Sheets and send me an SMS',
  'When a new Shopify order comes in, update Airtable and send a Twilio SMS',
  'When I like a YouTube video, get transcript and summarize it',
];

const keywordMap: Record<string, string> = {
  gmail: 'gmail',
  email: 'gmail',
  'e-mail': 'gmail',
  slack: 'slack',
  github: 'github',
  'pull request': 'github',
  pr: 'github',
  repo: 'github',
  spotify: 'spotify',
  music: 'spotify',
  calendar: 'google-calendar',
  'google calendar': 'google-calendar',
  notion: 'notion',
  twitter: 'twitter',
  tweet: 'twitter',
  mention: 'twitter',
  discord: 'discord',
  shopify: 'shopify',
  shop: 'shopify',
  ecommerce: 'shopify',
  stripe: 'stripe',
  payment: 'stripe',
  charge: 'stripe',
  airtable: 'airtable',
  trello: 'trello',
  twilio: 'twilio',
  sms: 'twilio',
  mailchimp: 'mailchimp',
  newsletter: 'mailchimp',
  youtube: 'youtube',
  video: 'youtube',
  transcript: 'youtube',
  liked: 'youtube',
  captions: 'youtube',
  summarize: 'ai-processing',
  summary: 'ai-processing',
  'mind map': 'ai-processing',
  mindmap: 'ai-processing',
  'top ideas': 'ai-processing',
  ideas: 'ai-processing',
  presentation: 'ai-processing',
  deck: 'ai-processing',
  slides: 'ai-processing',
  notes: 'ai-processing',
  digest: 'ai-processing',
  rss: 'rss',
  webhook: 'webhook',
  sheets: 'google-sheets',
  'google sheets': 'google-sheets',
  spreadsheet: 'google-sheets',
  dropbox: 'dropbox',
  file: 'dropbox',
  openai: 'openai',
  gpt: 'openai',
  ai: 'openai',
  hubspot: 'hubspot',
  crm: 'hubspot',
  telegram: 'telegram',
};

function parseDescription(text: string): { nodes: Node[]; edges: Edge[] } {
  const lower = text.toLowerCase();

  const found: string[] = [];
  for (const [keyword, integId] of Object.entries(keywordMap)) {
    if (lower.includes(keyword) && !found.includes(integId)) {
      found.push(integId);
    }
  }

  if (found.length === 0) return { nodes: [], edges: [] };

  const startX = 100 + Math.random() * 100;
  const startY = 600 + Math.random() * 100;

  const newNodes: Node[] = [];
  const newEdges: Edge[] = [];
  const timestamp = Date.now();

  found.forEach((integId, index) => {
    const nodeId = `ai-${timestamp}-${index}`;
    const isFirst = index === 0;

    const integration = integrations.find((i) => i.id === integId);
    const eventLabel = isFirst
      ? integration?.triggers[0]?.label ?? integId
      : integration?.actions[0]?.label ?? integId;

    newNodes.push({
      id: nodeId,
      type: isFirst ? 'triggerNode' : 'actionNode',
      position: { x: startX + index * 300, y: startY },
      data: {
        integrationId: integId,
        integrationName: integration?.name ?? integId,
        icon: integration?.icon ?? '🔗',
        color: integration?.color ?? 'bg-gray-600',
        eventLabel,
        type: isFirst ? 'trigger' : 'action',
      },
    });

    if (index > 0) {
      newEdges.push({
        id: `ai-edge-${timestamp}-${index}`,
        source: `ai-${timestamp}-${index - 1}`,
        target: nodeId,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      });
    }
  });

  return { nodes: newNodes, edges: newEdges };
}

export default function AIBuilder({ onAddNodes }: AIBuilderProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  const handleGenerate = () => {
    if (!text.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const { nodes, edges } = parseDescription(text);
      setLoading(false);
      setOpen(false);
      setText('');
      if (nodes.length > 0) {
        onAddNodes(nodes, edges);
        setToast(true);
        setTimeout(() => setToast(false), 3000);
      }
    }, 1500);
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-xl"
          style={{ background: '#1e1b4b', border: '1px solid #4f46e5' }}
        >
          ✨ Flow created! Check the canvas.
        </div>
      )}

      {/* Floating panel */}
      <div className="absolute top-4 right-4 z-10">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
            }}
            title="AI Automation Builder"
          >
            <span style={{ fontSize: '16px' }}>✨</span>
            <span>AI Build</span>
          </button>
        ) : (
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{
              width: '400px',
              background: '#141414',
              border: '1px solid #2a2a2a',
              boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
            }}
          >
            {/* Panel header */}
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #1e1b4b, #2e1065)',
                borderBottom: '1px solid #2a2a2a',
              }}
            >
              <div>
                <p className="text-white font-bold text-base flex items-center gap-2">
                  <span>✨</span> AI Automation Builder
                </p>
                <p className="text-indigo-300/70 text-xs mt-0.5">
                  Describe what you want to automate in plain English
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-3">
              {/* Textarea */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. When I receive a new email in Gmail, send a Slack message to #dev-team and create a Notion page"
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-[#f0f0f0] placeholder-[#555] resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                style={{ background: '#0f0f0f', border: '1px solid #333' }}
              />

              {/* Example pills */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#555]">
                  Examples
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setText(prompt)}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg text-indigo-300 transition-colors text-left leading-snug"
                      style={{
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.25)',
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!text.trim() || loading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: loading
                    ? '#1e1b4b'
                    : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-pulse">Building your automation</span>
                    <span className="flex gap-0.5">
                      <span
                        className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </span>
                  </span>
                ) : (
                  'Generate Flow ✨'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
