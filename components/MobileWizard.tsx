'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { integrations, Integration, IntegrationTrigger, IntegrationAction } from '@/data/integrations';
import { getConfigFields } from '@/components/panels/NodeConfigPanel';

const TOTAL_STEPS = 6;

export default function MobileWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selections
  const [triggerIntegration, setTriggerIntegration] = useState<Integration | null>(null);
  const [triggerEvent, setTriggerEvent] = useState<IntegrationTrigger | null>(null);
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>({});
  const [actionIntegration, setActionIntegration] = useState<Integration | null>(null);
  const [actionEvent, setActionEvent] = useState<IntegrationAction | null>(null);
  const [actionConfig, setActionConfig] = useState<Record<string, string>>({});

  const goBack = () => {
    if (step === 1) {
      router.push('/automations');
    } else {
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    if (!triggerIntegration || !triggerEvent || !actionIntegration || !actionEvent) return;
    setSaving(true);
    setError('');

    const name = `${triggerIntegration.name} -> ${actionIntegration.name}`;
    const triggerType = triggerEvent.id.replace(/^[^-]+-[a-z]+\d+-?/, '').replace(/-/g, '_') || triggerEvent.label.toLowerCase().replace(/\s+/g, '_');
    const actionType = actionEvent.id.replace(/^[^-]+-[a-z]+\d+-?/, '').replace(/-/g, '_') || actionEvent.label.toLowerCase().replace(/\s+/g, '_');

    try {
      const res = await fetch('/api/automations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          trigger_type: triggerType,
          trigger_integration_type: triggerIntegration.id,
          action_type: actionType,
          action_integration_type: actionIntegration.id,
          action_config: actionConfig,
          condition: triggerConfig,
        }),
      });
      if (res.ok) {
        router.push('/automations');
      } else if (res.status === 409) {
        const err = await res.json().catch(() => ({ error: 'Duplicate automation' }));
        setError(err.error || 'This automation already exists');
      } else {
        setError('Failed to save automation');
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  };

  const stepTitle = () => {
    switch (step) {
      case 1: return 'Choose Trigger';
      case 2: return `${triggerIntegration?.name} - Event`;
      case 3: return 'Configure Trigger';
      case 4: return 'Choose Action';
      case 5: return `${actionIntegration?.name} - Event`;
      case 6: return 'Configure Action';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a0a0a' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
        <button onClick={goBack} className="text-[#888] hover:text-white transition-colors p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-white font-semibold text-sm">{stepTitle()}</span>
        <div className="w-7" />
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-3">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i + 1 === step ? 24 : 8,
              height: 8,
              background: i + 1 <= step ? '#6366f1' : '#333',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Step 1: Trigger Integration */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {integrations.filter(i => i.triggers.length > 0).map((intg) => (
              <button
                key={intg.id}
                onClick={() => { setTriggerIntegration(intg); setTriggerEvent(null); setTriggerConfig({}); setStep(2); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors"
                style={{ background: '#141414', border: '1px solid #222' }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${intg.color}`}>
                  {intg.icon.startsWith('/') ? (
                    <img src={intg.icon} alt="" className="w-6 h-6" />
                  ) : (
                    <span className="text-lg">{intg.icon}</span>
                  )}
                </div>
                <span className="text-[#e0e0e0] text-sm font-medium">{intg.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Trigger Event */}
        {step === 2 && triggerIntegration && (
          <div className="space-y-2 pt-2">
            {triggerIntegration.triggers.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTriggerEvent(t); setTriggerConfig({}); setStep(3); }}
                className="w-full text-left p-4 rounded-2xl transition-colors"
                style={{ background: '#141414', border: '1px solid #222' }}
              >
                <p className="text-[#f0f0f0] text-sm font-medium">{t.label}</p>
                <p className="text-[#666] text-xs mt-1">{t.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Configure Trigger */}
        {step === 3 && triggerIntegration && triggerEvent && (
          <ConfigStep
            integrationId={triggerIntegration.id}
            eventId={triggerEvent.id}
            values={triggerConfig}
            onChange={setTriggerConfig}
          />
        )}

        {/* Step 4: Action Integration */}
        {step === 4 && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {integrations.filter(i => i.actions.length > 0).map((intg) => (
              <button
                key={intg.id}
                onClick={() => { setActionIntegration(intg); setActionEvent(null); setActionConfig({}); setStep(5); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors"
                style={{ background: '#141414', border: '1px solid #222' }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${intg.color}`}>
                  {intg.icon.startsWith('/') ? (
                    <img src={intg.icon} alt="" className="w-6 h-6" />
                  ) : (
                    <span className="text-lg">{intg.icon}</span>
                  )}
                </div>
                <span className="text-[#e0e0e0] text-sm font-medium">{intg.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 5: Action Event */}
        {step === 5 && actionIntegration && (
          <div className="space-y-2 pt-2">
            {actionIntegration.actions.map((a) => (
              <button
                key={a.id}
                onClick={() => { setActionEvent(a); setActionConfig({}); setStep(6); }}
                className="w-full text-left p-4 rounded-2xl transition-colors"
                style={{ background: '#141414', border: '1px solid #222' }}
              >
                <p className="text-[#f0f0f0] text-sm font-medium">{a.label}</p>
                <p className="text-[#666] text-xs mt-1">{a.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 6: Configure Action */}
        {step === 6 && actionIntegration && actionEvent && (
          <ConfigStep
            integrationId={actionIntegration.id}
            eventId={actionEvent.id}
            values={actionConfig}
            onChange={setActionConfig}
          />
        )}
      </div>

      {/* Bottom button for steps 3 and 6 */}
      {step === 3 && (
        <div className="px-4 pb-6 pt-2">
          <button
            onClick={() => setStep(4)}
            className="w-full py-3.5 rounded-full text-white font-semibold text-sm transition-colors"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
          >
            Next
          </button>
        </div>
      )}

      {step === 6 && (
        <div className="px-4 pb-6 pt-2 space-y-2">
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-3.5 rounded-full text-white font-semibold text-sm transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
          >
            {saving ? 'Creating...' : 'Create Automation'}
          </button>
        </div>
      )}
    </div>
  );
}

function ConfigStep({
  integrationId,
  eventId,
  values,
  onChange,
}: {
  integrationId: string;
  eventId: string;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const fields = getConfigFields(integrationId, eventId);

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[#555] text-sm">No configuration needed</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-[#888] mb-1.5">{field.label}</label>
          {field.type === 'color' ? (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={values[field.key] || '#ff0000'}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
                className="w-10 h-10 rounded-xl border border-[#333] bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={values[field.key] || ''}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="flex-1 px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] placeholder-[#444] focus:outline-none focus:border-indigo-500 transition-colors"
                style={{ fontSize: '16px' }}
              />
            </div>
          ) : field.type === 'select' && field.options ? (
            <select
              value={values[field.key] || field.defaultValue || ''}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] focus:outline-none focus:border-indigo-500 transition-colors"
              style={{ fontSize: '16px' }}
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
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="w-full px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] placeholder-[#444] focus:outline-none focus:border-indigo-500 transition-colors"
              style={{ fontSize: '16px' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
