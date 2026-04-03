'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';

// FlowCanvas uses browser APIs, load it client-side only
const FlowCanvas = dynamic(() => import('@/components/FlowCanvas'), { ssr: false });

export default function ClientLayout() {
  const [triggerCount, setTriggerCount] = useState(3);

  const handleTriggerCountChange = useCallback((count: number) => {
    setTriggerCount(count);
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: '#0f0f0f', overflow: 'hidden' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-indigo-900/40"
        style={{
          height: '56px',
          borderBottom: '1px solid #222',
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"
            style={{ fontSize: '16px' }}
          >
            ⚡
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">⚡ Workflows</span>
            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-400 uppercase tracking-wider">
              Beta
            </span>
          </div>
        </div>

        {/* Center info */}
        <div className="hidden md:flex items-center gap-6 text-[13px] text-[#555]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Untitled Flow
          </span>
          <span className="flex items-center gap-1.5 text-[#666]">
            <span className="text-indigo-400 font-semibold">Flows: {triggerCount}</span>
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg text-sm text-[#888] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-colors"
          >
            My Flows
          </button>
          <button
            className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            + New Flow
          </button>
        </div>
      </header>

      {/* Main content */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 56px)' }}
      >
        <Sidebar />
        <FlowCanvas onTriggerCountChange={handleTriggerCountChange} />
      </div>
    </div>
  );
}
