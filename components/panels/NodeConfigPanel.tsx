'use client';

import { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { integrations } from '@/data/integrations';

interface NodeConfigPanelProps {
  node: Node | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdateConfig?: (nodeId: string, config: Record<string, string>) => void;
}

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'color' | 'select';
  options?: { value: string; label: string }[];
}

function getConfigFields(integrationId: string, eventId: string): ConfigField[] {
  // Gmail triggers
  if (integrationId === 'gmail') {
    if (eventId.includes('t2')) return [
      { key: 'subject', label: 'Subject contains', placeholder: 'e.g. Invoice, Urgent, Deploy' },
    ];
    if (eventId.includes('t3')) return [
      { key: 'from', label: 'From address', placeholder: 'e.g. boss@company.com' },
    ];
    if (eventId.includes('t4')) return [
      { key: 'body', label: 'Body contains', placeholder: 'e.g. error, alert, payment' },
    ];
    if (eventId.includes('t5')) return [
      { key: 'query', label: 'Gmail search query', placeholder: 'e.g. from:github subject:PR is:unread' },
    ];
    if (eventId.includes('t1')) return [
      { key: 'query', label: 'Filter (optional)', placeholder: 'e.g. is:unread category:primary' },
    ];
    // Gmail actions
    return [
      { key: 'format', label: 'Output format', placeholder: 'summary / full / bullets' },
    ];
  }

  // Hue actions
  if (integrationId === 'hue') {
    if (eventId.includes('a1')) return [
      { key: 'group', label: 'Room / Group', placeholder: 'e.g. Office, Bedroom', type: 'text' },
      { key: 'duration', label: 'Flash duration (ms)', placeholder: '500' },
    ];
    if (eventId.includes('a2')) return [
      { key: 'group', label: 'Room / Group', placeholder: 'e.g. Office' },
      { key: 'scene', label: 'Scene name', placeholder: 'e.g. Concentrate, Relax, Energize' },
    ];
    if (eventId.includes('a3')) return [
      { key: 'group', label: 'Room / Group', placeholder: 'e.g. Office' },
      { key: 'state', label: 'State', placeholder: 'on / off / toggle', type: 'select', options: [
        { value: 'on', label: 'Turn On' }, { value: 'off', label: 'Turn Off' }, { value: 'toggle', label: 'Toggle' },
      ]},
    ];
    if (eventId.includes('a4')) return [
      { key: 'group', label: 'Room / Group', placeholder: 'e.g. Office' },
      { key: 'color', label: 'Color', placeholder: '#ff0000', type: 'color' },
      { key: 'brightness', label: 'Brightness (0-254)', placeholder: '200' },
    ];
    return [];
  }

  // YouTube triggers
  if (integrationId === 'youtube') {
    return [
      { key: 'keyword', label: 'Keyword filter (optional)', placeholder: 'e.g. AI, programming' },
    ];
  }

  // Stickies
  if (integrationId === 'stickies') {
    return [
      { key: 'folder', label: 'Folder', placeholder: 'e.g. YouTube, Gmail, Notes' },
    ];
  }

  // Diagram / Mindmap
  if (integrationId === 'diagram') {
    return [
      { key: 'type', label: 'Diagram type', placeholder: 'sequence', type: 'select', options: [
        { value: 'sequence', label: 'Sequence' }, { value: 'flowchart', label: 'Flowchart' }, { value: 'class', label: 'Class' },
      ]},
    ];
  }
  if (integrationId === 'mindmap') {
    return [
      { key: 'depth', label: 'Max depth', placeholder: '3' },
    ];
  }

  return [];
}

export default function NodeConfigPanel({ node, onClose, onDelete, onUpdateConfig }: NodeConfigPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const nodeData = node?.data as Record<string, unknown> | undefined;
  const integrationId = String(nodeData?.integrationId || '');
  const eventId = String(nodeData?.eventId || '');
  const eventLabel = String(nodeData?.eventLabel || '');
  const integration = integrations.find((i) => i.id === integrationId);

  const fields = getConfigFields(integrationId, eventId);
  const isTrigger = node?.type === 'triggerNode';

  // Load existing config
  useEffect(() => {
    if (nodeData?.config) {
      setValues(nodeData.config as Record<string, string>);
    } else {
      setValues({});
    }
  }, [node?.id]);

  if (!node || !integration) return null;

  const handleSave = () => {
    onUpdateConfig?.(node.id, values);
    onClose();
  };

  return (
    <div
      className="flex flex-col h-full w-full sm:w-[300px] sm:min-w-[300px]"
      style={{ maxWidth: '100vw', background: '#1a1a1a', borderLeft: '1px solid #2a2a2a' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${integration.color}`}>
            {integration.icon.startsWith('/') ? (
              <img src={integration.icon} alt="" className="w-4 h-4" />
            ) : (
              <span style={{ fontSize: '14px' }}>{integration.icon}</span>
            )}
          </div>
          <div>
            <p className="text-xs text-[#888]">{integration.name}</p>
            <p className="text-sm text-[#f0f0f0] font-semibold">{eventLabel}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#2a2a2a] hover:bg-[#333] flex items-center justify-center text-[#888] hover:text-[#f0f0f0] transition-colors text-sm">
          x
        </button>
      </div>

      {/* Badge */}
      <div className="px-4 py-2">
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          isTrigger ? 'bg-green-900/50 text-green-400' : 'bg-indigo-900/50 text-indigo-400'
        }`}>
          {isTrigger ? 'IF THIS' : 'THEN THAT'}
        </span>
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {fields.length > 0 ? (
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[11px] font-medium text-[#888] mb-1.5">{field.label}</label>
                {field.type === 'color' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={values[field.key] || '#ff0000'}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      className="w-10 h-8 rounded border border-[#333] bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] placeholder-[#444] focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                ) : field.type === 'select' && field.options ? (
                  <select
                    value={values[field.key] || ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={values[field.key] || ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] placeholder-[#444] focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#444] py-4">No configuration needed</p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-4 border-t border-[#2a2a2a] space-y-2">
        {fields.length > 0 && (
          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Save
          </button>
        )}
        <button
          onClick={() => { onDelete(node.id); onClose(); }}
          className="w-full py-2 rounded-lg text-[#555] hover:text-red-400 text-xs transition-colors"
        >
          Remove Node
        </button>
      </div>
    </div>
  );
}
