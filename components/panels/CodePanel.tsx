'use client';

import { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { integrations } from '@/data/integrations';

interface CodePanelProps {
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
}

function buildFlowChains(nodes: Node[], edges: Edge[]) {
  // Find trigger nodes (roots)
  const triggerNodes = nodes.filter((n) => n.type === 'triggerNode');
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjList = new Map<string, string[]>();

  for (const edge of edges) {
    if (!adjList.has(edge.source)) adjList.set(edge.source, []);
    adjList.get(edge.source)!.push(edge.target);
  }

  const chains: Node[][] = [];

  for (const trigger of triggerNodes) {
    const chain: Node[] = [trigger];
    let current = trigger.id;
    const visited = new Set<string>([current]);

    while (adjList.has(current)) {
      const targets = adjList.get(current)!;
      const next = targets.find((t) => !visited.has(t));
      if (!next) break;
      const nextNode = nodeMap.get(next);
      if (!nextNode) break;
      chain.push(nextNode);
      visited.add(next);
      current = next;
    }

    chains.push(chain);
  }

  // Orphan nodes (no edges)
  const chained = new Set(chains.flat().map((n) => n.id));
  const orphans = nodes.filter((n) => !chained.has(n.id));
  for (const orphan of orphans) {
    chains.push([orphan]);
  }

  return chains;
}

function getIntegrationMeta(integrationId: string) {
  return integrations.find((i) => i.id === integrationId);
}

function generateCode(nodes: Node[], edges: Edge[]): string {
  if (nodes.length === 0) return '// No automations defined yet\n// Drag integrations from the sidebar to get started';

  const chains = buildFlowChains(nodes, edges);
  const lines: string[] = [
    '// Automation Definition',
    '// Auto-generated from visual canvas',
    '',
  ];

  chains.forEach((chain, i) => {
    const firstNode = chain[0];
    const meta = getIntegrationMeta(firstNode.data.integrationId as string);
    const flowName = meta?.name || 'Unknown';

    lines.push(`automation("${flowName} Flow ${i + 1}") {`);
    lines.push('');

    chain.forEach((node, j) => {
      const integration = getIntegrationMeta(node.data.integrationId as string);
      const name = integration?.name || 'Unknown';
      const event = (node.data.eventLabel as string) || 'event';
      const isTrigger = node.type === 'triggerNode';

      if (isTrigger) {
        lines.push(`  trigger("${name}") {`);
        lines.push(`    event: "${event}"`);
        lines.push(`    integration: "${node.data.integrationId}"`);
        lines.push('  }');
      } else {
        lines.push(`  action("${name}") {`);
        lines.push(`    run: "${event}"`);
        lines.push(`    integration: "${node.data.integrationId}"`);
        if (j > 0) {
          const prev = chain[j - 1];
          const prevMeta = getIntegrationMeta(prev.data.integrationId as string);
          lines.push(`    depends_on: "${prevMeta?.name || prev.id}"`);
        }
        lines.push('  }');
      }

      if (j < chain.length - 1) {
        lines.push('  |');
      }
    });

    lines.push('}');
    if (i < chains.length - 1) lines.push('');
  });

  return lines.join('\n');
}

// Simple syntax highlighting
function highlightLine(line: string) {
  // Comment lines
  if (line.trimStart().startsWith('//')) {
    return <span className="text-[#555]">{line}</span>;
  }

  // Pipe connector
  if (line.trim() === '|') {
    return (
      <span>
        {'  '}
        <span className="text-indigo-400 font-bold">|</span>
      </span>
    );
  }

  // automation/trigger/action keywords
  const keywordMatch = line.match(/^(\s*)(automation|trigger|action)(\()/);
  if (keywordMatch) {
    const [, indent, keyword, paren] = keywordMatch;
    const rest = line.slice(indent.length + keyword.length + paren.length);
    const nameEnd = rest.indexOf('"', 1);
    const name = rest.slice(0, nameEnd + 1);
    const after = rest.slice(nameEnd + 1);

    const color = keyword === 'automation' ? 'text-amber-400' : keyword === 'trigger' ? 'text-green-400' : 'text-indigo-400';

    return (
      <span>
        {indent}
        <span className={`${color} font-semibold`}>{keyword}</span>
        <span className="text-[#888]">{paren}</span>
        <span className="text-orange-300">{name}</span>
        <span className="text-[#888]">{after}</span>
      </span>
    );
  }

  // Property lines (key: "value")
  const propMatch = line.match(/^(\s+)(\w+):\s*"(.+)"$/);
  if (propMatch) {
    const [, indent, key, value] = propMatch;
    return (
      <span>
        {indent}
        <span className="text-cyan-400">{key}</span>
        <span className="text-[#888]">: </span>
        <span className="text-orange-300">&quot;{value}&quot;</span>
      </span>
    );
  }

  // Braces
  if (line.trim() === '{' || line.trim() === '}') {
    return <span className="text-[#666]">{line}</span>;
  }

  return <span className="text-[#ccc]">{line}</span>;
}

export default function CodePanel({ nodes, edges, onClose }: CodePanelProps) {
  const code = useMemo(() => generateCode(nodes, edges), [nodes, edges]);
  const lines = code.split('\n');

  return (
    <div
      className="h-full flex flex-col flex-shrink-0 w-full sm:w-[380px]"
      style={{
        maxWidth: '100vw',
        background: '#141414',
        borderLeft: '1px solid #222',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #222' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-mono font-bold text-amber-400">&lt;/&gt;</span>
          <span className="text-sm font-semibold text-[#ccc]">Code View</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 font-semibold uppercase tracking-wider">
            DSL
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-[#666] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors text-sm"
        >
          x
        </button>
      </div>

      {/* Code block */}
      <div className="flex-1 overflow-auto p-4">
        <pre className="font-mono text-[12px] leading-[20px]">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="text-[#333] select-none w-8 text-right pr-3 flex-shrink-0">
                {i + 1}
              </span>
              <span className="flex-1">{highlightLine(line)}</span>
            </div>
          ))}
        </pre>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ borderTop: '1px solid #222' }}
      >
        <span className="text-[11px] text-[#444]">
          {nodes.length} nodes / {edges.length} edges
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="px-3 py-1 rounded text-[11px] font-medium text-[#888] hover:text-[#ccc] bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#333] transition-colors"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
