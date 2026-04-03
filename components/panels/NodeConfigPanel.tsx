'use client';

import { Node } from '@xyflow/react';
import { integrations } from '@/data/integrations';
import { TriggerNodeData } from '@/components/nodes/TriggerNode';
import { ActionNodeData } from '@/components/nodes/ActionNode';

interface NodeConfigPanelProps {
  node: Node | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

function getConfigFields(integrationId: string, nodeType: string) {
  const configs: Record<string, { label: string; placeholder: string }[]> = {
    gmail: nodeType === 'triggerNode'
      ? [
          { label: 'From Address Filter', placeholder: 'e.g. boss@company.com' },
          { label: 'Subject Contains', placeholder: 'e.g. Invoice, Urgent' },
          { label: 'Label Filter', placeholder: 'e.g. INBOX' },
        ]
      : [
          { label: 'To Address', placeholder: 'recipient@example.com' },
          { label: 'Subject', placeholder: 'Email subject line' },
          { label: 'Body Template', placeholder: 'Your email content here...' },
        ],
    slack: nodeType === 'triggerNode'
      ? [
          { label: 'Channel Name', placeholder: '#general' },
          { label: 'Keyword Filter', placeholder: 'e.g. alert, error' },
        ]
      : [
          { label: 'Channel', placeholder: '#notifications' },
          { label: 'Message', placeholder: 'Your message here...' },
          { label: 'Bot Name', placeholder: 'FlowMate Bot' },
        ],
    github: nodeType === 'triggerNode'
      ? [
          { label: 'Repository', placeholder: 'owner/repo-name' },
          { label: 'Branch Filter', placeholder: 'e.g. main, develop' },
        ]
      : [
          { label: 'Repository', placeholder: 'owner/repo-name' },
          { label: 'Title', placeholder: 'Issue or PR title' },
          { label: 'Body', placeholder: 'Detailed description...' },
        ],
    stripe: nodeType === 'triggerNode'
      ? [
          { label: 'Minimum Amount ($)', placeholder: 'e.g. 100' },
          { label: 'Currency', placeholder: 'USD' },
        ]
      : [
          { label: 'Customer Email', placeholder: 'customer@example.com' },
          { label: 'Amount ($)', placeholder: 'e.g. 49.99' },
          { label: 'Description', placeholder: 'Invoice description' },
        ],
    openai: [
      { label: 'Model', placeholder: 'gpt-4o' },
      { label: 'System Prompt', placeholder: 'You are a helpful assistant...' },
      { label: 'Max Tokens', placeholder: '1000' },
      { label: 'Temperature', placeholder: '0.7' },
    ],
  };

  return configs[integrationId] || [
    { label: 'Configuration', placeholder: 'Enter value...' },
    { label: 'Advanced Options', placeholder: 'Optional settings...' },
  ];
}

export default function NodeConfigPanel({ node, onClose, onDelete }: NodeConfigPanelProps) {
  if (!node) return null;

  const nodeData = node.data as unknown as TriggerNodeData | ActionNodeData;
  const integration = integrations.find((i) => i.id === nodeData.integrationId);
  if (!integration) return null;

  const isTrigger = node.type === 'triggerNode';
  const configFields = getConfigFields(nodeData.integrationId, node.type || '');

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: '300px',
        minWidth: '300px',
        background: '#1a1a1a',
        borderLeft: '1px solid #2a2a2a',
      }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${integration.color}`}
            style={{ fontSize: '16px' }}
          >
            {integration.icon}
          </div>
          <div>
            <p className="text-xs text-[#888] font-medium">{integration.name}</p>
            <p className="text-sm text-[#f0f0f0] font-semibold">
              {isTrigger ? 'Trigger' : 'Action'} Config
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-[#2a2a2a] hover:bg-[#333] flex items-center justify-center text-[#888] hover:text-[#f0f0f0] transition-colors text-sm"
        >
          ×
        </button>
      </div>

      {/* Event info */}
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div
          className={`rounded-lg p-3 ${integration.color} bg-opacity-10`}
          style={{ border: `1px solid rgba(255,255,255,0.08)` }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888] mb-1">
            {isTrigger ? 'Trigger Event' : 'Action Event'}
          </p>
          <p className="text-sm font-semibold text-[#f0f0f0]">{nodeData.eventLabel}</p>
          <span
            className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              isTrigger ? 'bg-green-900/50 text-green-400' : 'bg-indigo-900/50 text-indigo-400'
            }`}
          >
            {isTrigger ? 'IF THIS' : 'THEN THAT'}
          </span>
        </div>
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-3">
          Configuration
        </p>
        <div className="space-y-3">
          {configFields.map((field, i) => (
            <div key={i}>
              <label className="block text-xs font-medium text-[#888] mb-1.5">
                {field.label}
              </label>
              <input
                type="text"
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-lg text-sm bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] placeholder-[#444] focus:outline-none focus:border-[#6366f1] transition-colors"
              />
            </div>
          ))}
        </div>

        {/* Filters section */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#555] mb-3">
            Filters (Optional)
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1.5">
                Run only if condition
              </label>
              <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] focus:outline-none focus:border-[#6366f1]">
                <option value="">Always run</option>
                <option value="contains">Contains text</option>
                <option value="equals">Equals value</option>
                <option value="greater">Greater than</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-4 border-t border-[#2a2a2a] space-y-2">
        <button className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
          Save Configuration
        </button>
        <button
          onClick={() => {
            onDelete(node.id);
            onClose();
          }}
          className="w-full py-2.5 rounded-lg bg-[#2a2a2a] hover:bg-red-900/40 border border-[#333] hover:border-red-800 text-[#888] hover:text-red-400 text-sm font-semibold transition-all"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}
