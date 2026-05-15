'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  Connection,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TriggerNode from './nodes/TriggerNode';
import ActionNode from './nodes/ActionNode';
import GradientEdge from './edges/GradientEdge';
import NodeConfigPanel from './panels/NodeConfigPanel';
import CodePanel from './panels/CodePanel';
import { integrations, Integration } from '@/data/integrations';

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
};

const edgeTypes = {
  gradient: GradientEdge,
};

let nodeIdCounter = 1;

interface DropModalProps {
  integration: Integration;
  position: { x: number; y: number };
  onConfirm: (type: 'trigger' | 'action', eventId: string, eventLabel: string) => void;
  onClose: () => void;
}

function DropModal({ integration, onConfirm, onClose }: DropModalProps) {
  const [selected, setSelected] = useState<{ type: 'trigger' | 'action'; id: string; label: string } | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          width: '520px',
          background: '#1a1a1a',
          border: '1px solid #333',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className={`${integration.color} px-5 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            {integration.icon.startsWith('/') ? (
              <img src={integration.icon} alt="" style={{ width: 28, height: 28 }} />
            ) : (
              <span style={{ fontSize: '28px' }}>{integration.icon}</span>
            )}
            <div>
              <p className="text-white font-bold text-lg">{integration.name}</p>
              <p className="text-white/70 text-xs">Choose how to use this integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-4 p-5">
          {/* Triggers column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-green-400">Add as Trigger</p>
            </div>
            <div className="space-y-1.5">
              {integration.triggers.map((trigger) => (
                <button
                  key={trigger.id}
                  onClick={() => setSelected({ type: 'trigger', id: trigger.id, label: trigger.label })}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                    selected?.id === trigger.id
                      ? 'bg-green-900/30 border-green-500 text-green-300'
                      : 'bg-[#0f0f0f] border-[#333] text-[#ccc] hover:border-green-700 hover:bg-green-950/20'
                  }`}
                >
                  <p className="text-sm font-medium leading-tight">{trigger.label}</p>
                  <p className="text-[11px] text-[#666] mt-0.5 leading-tight">{trigger.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Add as Action</p>
            </div>
            <div className="space-y-1.5">
              {integration.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setSelected({ type: 'action', id: action.id, label: action.label })}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                    selected?.id === action.id
                      ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                      : 'bg-[#0f0f0f] border-[#333] text-[#ccc] hover:border-indigo-700 hover:bg-indigo-950/20'
                  }`}
                >
                  <p className="text-sm font-medium leading-tight">{action.label}</p>
                  <p className="text-[11px] text-[#666] mt-0.5 leading-tight">{action.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <p className="text-xs text-[#555]">
            {selected ? `Selected: ${selected.label}` : 'Select a trigger or action above'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2a2a2a] text-[#888] hover:text-[#f0f0f0] hover:bg-[#333] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selected) {
                  onConfirm(selected.type, selected.id, selected.label);
                }
              }}
              disabled={!selected}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selected
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-[#2a2a2a] text-[#555] cursor-not-allowed'
              }`}
            >
              Add to Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FlowCanvasInnerProps {
  onTriggerCountChange?: (count: number) => void;
  onFlowNameChange?: (name: string) => void;
  onSave?: (data: { name: string; trigger: Node | null; action: Node | null }) => void;
}

function FlowCanvasInner({ onTriggerCountChange, onFlowNameChange, onSave }: FlowCanvasInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const triggers = nodes.filter((n) => n.type === 'triggerNode');
        const actions = nodes.filter((n) => n.type === 'actionNode');
        if (triggers.length === 0 && actions.length === 0) return;
        const triggerNames = triggers.map((t) => {
          const integ = integrations.find((i) => i.id === t.data.integrationId);
          return `${integ?.name || ''} ${String(t.data.eventLabel || '').replace(integ?.name || '', '').trim()}`;
        });
        const actionNames = actions.map((a) => {
          const integ = integrations.find((i) => i.id === a.data.integrationId);
          return integ?.name || '';
        });
        const name = [...triggerNames, ...actionNames].join(' > ');
        onSave?.({ name, trigger: triggers[0] || null, action: actions[0] || null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodes, onSave]);

  useEffect(() => {
    const triggerCount = nodes.filter((n) => n.type === 'triggerNode').length;
    onTriggerCountChange?.(triggerCount);

    // Auto-name: "TriggerLabel > ActionLabel"
    const triggers = nodes.filter((n) => n.type === 'triggerNode');
    const actions = nodes.filter((n) => n.type === 'actionNode');
    if (triggers.length > 0 || actions.length > 0) {
      const parts: string[] = [];
      for (const t of triggers) {
        const integ = integrations.find((i) => i.id === t.data.integrationId);
        parts.push(`${integ?.name || ''} ${t.data.eventLabel || ''}`);
      }
      for (const a of actions) {
        const integ = integrations.find((i) => i.id === a.data.integrationId);
        parts.push(`${integ?.name || ''} ${a.data.eventLabel || ''}`);
      }
      // Shorten: "YouTube Video Liked > Diagram Create Diagram" -> "YouTube Liked > Diagram"
      const triggerNames = triggers.map((t) => {
        const integ = integrations.find((i) => i.id === t.data.integrationId);
        return `${integ?.name || ''} ${String(t.data.eventLabel || '').replace(integ?.name || '', '').trim()}`;
      });
      const actionNames = actions.map((a) => {
        const integ = integrations.find((i) => i.id === a.data.integrationId);
        return integ?.name || '';
      });
      const name = [...triggerNames, ...actionNames].join(' > ');
      onFlowNameChange?.(name);
    } else {
      onFlowNameChange?.('');
    }
  }, [nodes, onTriggerCountChange, onFlowNameChange]);
  const [modal, setModal] = useState<{
    integration: Integration;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showCode, setShowCode] = useState(false);

  const { screenToFlowPosition, fitView } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const handleSelectNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      setSelectedNode(node || null);
    },
    [nodes]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNode((prev) => (prev?.id === id ? null : prev));
    },
    [setNodes, setEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            type: 'gradient',
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const integrationId = event.dataTransfer.getData('integrationId');
      if (!integrationId) return;

      const integration = integrations.find((i) => i.id === integrationId);
      if (!integration) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setModal({ integration, position });
    },
    [screenToFlowPosition]
  );

  const handleModalConfirm = useCallback(
    (type: 'trigger' | 'action', eventId: string, eventLabel: string) => {
      if (!modal) return;

      const newNodeId = `node-${nodeIdCounter++}`;
      const nodeType = type === 'trigger' ? 'triggerNode' : 'actionNode';

      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: { x: 0, y: 0 }, // placeholder - will be repositioned
        data: {
          integrationId: modal.integration.id,
          eventId,
          eventLabel,
          onDelete: handleDeleteNode,
          onSelect: handleSelectNode,
        },
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];

        // Auto-layout: triggers on left, actions on right, centered vertically
        const NODE_W = 340;
        const GAP = 120;
        const triggers = updated.filter((n) => n.type === 'triggerNode');
        const actions = updated.filter((n) => n.type === 'actionNode');
        const allOrdered = [...triggers, ...actions];
        const totalWidth = allOrdered.length * NODE_W + (allOrdered.length - 1) * GAP;
        const startX = -totalWidth / 2;

        allOrdered.forEach((node, i) => {
          node.position = { x: startX + i * (NODE_W + GAP), y: 0 };
        });

        // Auto-connect: if exactly 1 trigger and 1 action, draw edge
        if (triggers.length === 1 && actions.length === 1) {
          const edgeExists = edges.some(
            (e) => e.source === triggers[0].id && e.target === actions[0].id
          );
          if (!edgeExists) {
            setEdges((eds) =>
              addEdge(
                {
                  id: `edge-${triggers[0].id}-${actions[0].id}`,
                  source: triggers[0].id,
                  target: actions[0].id,
                  animated: true,
                  type: 'gradient',
                },
                eds
              )
            );
          }
        }

        // fitView after layout settles
        setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);

        return updated;
      });
      // Auto-open config panel for the new node
      setSelectedNode(newNode);
      setModal(null);
    },
    [modal, setNodes, setEdges, edges, fitView, handleDeleteNode, handleSelectNode]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleAddAINodes = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setNodes((prev) => [...prev, ...newNodes]);
      setEdges((prev) => [...prev, ...newEdges]);
    },
    [setNodes, setEdges]
  );

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ background: '#0f0f0f' }}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            type: 'gradient',
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#2a2a2a"
          />

          {/* Empty state */}
          {nodes.length === 0 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ zIndex: 0 }}
            >
              <div
                className="flex flex-col items-center gap-4 p-8 rounded-2xl"
                style={{ border: '2px dashed #2a2a2a', background: 'rgba(26,26,26,0.4)' }}
              >
                <div className="text-5xl opacity-30">⚡</div>
                <div className="text-center">
                  <p className="text-[#555] font-semibold text-base">Drop integrations here</p>
                  <p className="text-[#3a3a3a] text-sm mt-1">
                    Drag from the sidebar to build your automation flow
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[#3a3a3a] text-sm">
                  <span>Trigger</span>
                  <span>→</span>
                  <span>Action</span>
                  <span>→</span>
                  <span>Action</span>
                </div>
              </div>
            </div>
          )}
        </ReactFlow>

        {/* AI Builder */}

      </div>

      {/* Config panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onDelete={handleDeleteNode}
          onUpdateConfig={(nodeId, config) => {
            setNodes((nds) => nds.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, config } } : n
            ));
            setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
          }}
        />
      )}

      {/* Drop modal */}
      {modal && (
        <DropModal
          integration={modal.integration}
          position={modal.position}
          onConfirm={handleModalConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

interface FlowCanvasProps {
  onTriggerCountChange?: (count: number) => void;
  onFlowNameChange?: (name: string) => void;
  onSave?: (data: { name: string; trigger: Node | null; action: Node | null }) => void;
}

export default function FlowCanvas({ onTriggerCountChange, onFlowNameChange, onSave }: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner onTriggerCountChange={onTriggerCountChange} onFlowNameChange={onFlowNameChange} onSave={onSave} />
    </ReactFlowProvider>
  );
}
