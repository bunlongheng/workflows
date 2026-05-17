'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ConnectionsPanel from '@/components/ConnectionsPanel';
import MobileWizard from '@/components/MobileWizard';
import { Node } from '@xyflow/react';

const FlowCanvas = dynamic(() => import('@/components/FlowCanvas'), { ssr: false });

export default function ClientLayout() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [triggerCount, setTriggerCount] = useState(0);
  const [flowName, setFlowName] = useState('');
  const [showConnections, setShowConnections] = useState(false);
  const [focusedIntegration, setFocusedIntegration] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);
  const lastSaveData = useRef<{ name: string; trigger: Node | null; action: Node | null } | null>(null);

  const handleTriggerCountChange = useCallback((count: number) => {
    setTriggerCount(count);
  }, []);

  const saveAutomation = useCallback(async (data: { name: string; trigger: Node | null; action: Node | null }) => {
    if (!data.trigger || !data.action || !data.name) return false;
    setSaving(true);
    try {
      const triggerEventId = String(data.trigger.data.eventId || '');
      const triggerType = triggerEventId.replace(/^[^-]+-[a-z]+\d+-?/, '').replace(/-/g, '_') || String(data.trigger.data.eventLabel || '').toLowerCase().replace(/\s+/g, '_');
      const actionEventId = String(data.action.data.eventId || '');
      const actionType = actionEventId.replace(/^[^-]+-[a-z]+\d+-?/, '').replace(/-/g, '_') || String(data.action.data.eventLabel || '').toLowerCase().replace(/\s+/g, '_');

      const res = await fetch('/api/automations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          trigger_type: triggerType,
          trigger_integration_type: data.trigger.data.integrationId,
          action_type: actionType,
          action_integration_type: data.action.data.integrationId,
          action_config: (data.action.data as Record<string, unknown>).config || {},
          condition: (data.trigger.data as Record<string, unknown>).config || {},
        }),
      });
      if (res.ok) {
        savedRef.current = true;
        setToast({ message: `Saved "${data.name}"`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
        setSaving(false);
        return true;
      }
      if (res.status === 409) {
        const err = await res.json().catch(() => ({ error: 'Duplicate automation' }));
        setToast({ message: err.error || 'This automation already exists', type: 'error' });
        setTimeout(() => setToast(null), 4000);
        setSaving(false);
        return false;
      }
    } catch {}
    setSaving(false);
    setToast({ message: 'Failed to save', type: 'error' });
    setTimeout(() => setToast(null), 3000);
    return false;
  }, []);

  const handleSave = useCallback((data: { name: string; trigger: Node | null; action: Node | null }) => {
    lastSaveData.current = data;
    if (savedRef.current || saving) {
      setToast({ message: 'Already saved', type: 'success' });
      setTimeout(() => setToast(null), 2000);
      return;
    }
    saveAutomation(data);
  }, [saveAutomation, saving]);

  const handleBack = useCallback(async () => {
    if (!savedRef.current && lastSaveData.current?.trigger && lastSaveData.current?.action) {
      await saveAutomation(lastSaveData.current);
    }
    router.push('/automations');
  }, [saveAutomation, router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connection = params.get('connection');
    const status = params.get('status');
    const account = params.get('account');

    if (connection && status) {
      if (status === 'success') {
        const stored = JSON.parse(localStorage.getItem('wf_connections') || '[]');
        const updated = [
          ...stored.filter((c: { integrationId: string }) => c.integrationId !== connection),
          {
            integrationId: connection,
            accountName: account || connection,
            accountEmail: params.get('email') || '',
            connectedAt: new Date().toISOString(),
            scopes: ['youtube.readonly', 'youtube.force-ssl'],
          },
        ];
        localStorage.setItem('wf_connections', JSON.stringify(updated));
        // TODO(ClientLayout.tsx:116): move toast trigger out of effect — fires on URL-param-driven side effect after OAuth redirect, refactor to event handler.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToast({ message: `${account || connection} connected`, type: 'success' });
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToast({ message: `Failed to connect ${connection}`, type: 'error' });
      }

      window.history.replaceState({}, '', '/automations/new');
      setTimeout(() => setToast(null), 4000);
    }
  }, []);

  if (isMobile) return <MobileWizard />;

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: '#0f0f0f', overflow: 'hidden' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-3 sm:px-5 py-3 flex-shrink-0"
        style={{
          height: '52px',
          background: '#111',
          borderBottom: '1px solid #1e1e1e',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={handleBack} className="text-[#555] hover:text-[#ccc] transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-white font-bold text-sm sm:text-base tracking-tight">New Automation</span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-[12px]">
          <span className="text-[#888] font-medium tracking-tight">
            {flowName || 'Untitled Flow'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs text-[#888] hover:text-[#f0f0f0] hover:bg-[#1e1e1e] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </svg>
            <span className="hidden sm:inline">Automations</span>
          </button>
        </div>
      </header>

      {/* Main: grids on top, canvas below */}
      <div className="flex flex-col flex-1 overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>
        {/* Integration grid strip */}
        <div
          className="flex-shrink-0 overflow-x-auto"
          style={{ background: '#111', borderBottom: '1px solid #222', scrollbarWidth: 'none' }}
        >
          <Sidebar onOpenConnections={(id) => { setFocusedIntegration(id || null); setShowConnections(true); }} />
        </div>
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <FlowCanvas onTriggerCountChange={handleTriggerCountChange} onFlowNameChange={setFlowName} onSave={handleSave} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl flex items-center gap-2"
          style={{
            background: toast.type === 'success' ? '#052e16' : '#450a0a',
            border: `1px solid ${toast.type === 'success' ? '#16a34a' : '#dc2626'}`,
            color: toast.type === 'success' ? '#4ade80' : '#fca5a5',
            marginBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {toast.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {showConnections && <ConnectionsPanel onClose={() => { setShowConnections(false); setFocusedIntegration(null); }} focusId={focusedIntegration} />}
    </div>
  );
}
