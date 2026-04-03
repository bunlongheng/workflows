'use client';

import { useState } from 'react';
import { integrations, categories } from '@/data/integrations';
import IntegrationCard from './IntegrationCard';

export default function Sidebar() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = integrations.filter((integration) => {
    const matchesSearch = integration.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || integration.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: '300px',
        minWidth: '300px',
        background: '#1a1a1a',
        borderRight: '1px solid #2a2a2a',
      }}
    >
      {/* Sidebar header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#2a2a2a]">
        <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-3">Integrations</p>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-[#0f0f0f] border border-[#333] text-[#f0f0f0] placeholder-[#555] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all duration-150 ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] hover:bg-[#333]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Integration list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[#555] text-sm">
            No integrations found
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-[#2a2a2a]">
        <p className="text-[11px] text-[#444] text-center">
          Drag any integration onto the canvas
        </p>
      </div>
    </div>
  );
}
