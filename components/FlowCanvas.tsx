'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
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
import NodeConfigPanel from './panels/NodeConfigPanel';
import AIBuilder from './AIBuilder';
import { integrations, Integration } from '@/data/integrations';

const initialNodes: Node[] = [
  // Flow 1: Gmail → Slack → Notion
  {
    id: 'trigger-1',
    type: 'triggerNode',
    position: { x: 80, y: 80 },
    data: {
      integrationId: 'gmail',
      integrationName: 'Gmail',
      icon: '📧',
      color: 'bg-red-500',
      eventLabel: 'New Email Received',
      type: 'trigger',
    },
  },
  {
    id: 'action-1',
    type: 'actionNode',
    position: { x: 380, y: 80 },
    data: {
      integrationId: 'slack',
      integrationName: 'Slack',
      icon: '💬',
      color: 'bg-purple-600',
      eventLabel: 'Send Channel Message',
      type: 'action',
    },
  },
  {
    id: 'action-2',
    type: 'actionNode',
    position: { x: 680, y: 80 },
    data: {
      integrationId: 'notion',
      integrationName: 'Notion',
      icon: '📝',
      color: 'bg-gray-700',
      eventLabel: 'Create Page',
      type: 'action',
    },
  },
  // Flow 2: GitHub → Discord → Trello
  {
    id: 'trigger-2',
    type: 'triggerNode',
    position: { x: 80, y: 280 },
    data: {
      integrationId: 'github',
      integrationName: 'GitHub',
      icon: '🐙',
      color: 'bg-gray-800',
      eventLabel: 'New PR Opened',
      type: 'trigger',
    },
  },
  {
    id: 'action-3',
    type: 'actionNode',
    position: { x: 380, y: 280 },
    data: {
      integrationId: 'discord',
      integrationName: 'Discord',
      icon: '🎮',
      color: 'bg-indigo-600',
      eventLabel: 'Send Message',
      type: 'action',
    },
  },
  {
    id: 'action-4',
    type: 'actionNode',
    position: { x: 680, y: 280 },
    data: {
      integrationId: 'trello',
      integrationName: 'Trello',
      icon: '📋',
      color: 'bg-blue-600',
      eventLabel: 'Create Card',
      type: 'action',
    },
  },
  // Flow 3: Stripe → Mailchimp
  {
    id: 'trigger-3',
    type: 'triggerNode',
    position: { x: 80, y: 480 },
    data: {
      integrationId: 'stripe',
      integrationName: 'Stripe',
      icon: '💳',
      color: 'bg-violet-600',
      eventLabel: 'New Payment',
      type: 'trigger',
    },
  },
  {
    id: 'action-5',
    type: 'actionNode',
    position: { x: 380, y: 480 },
    data: {
      integrationId: 'mailchimp',
      integrationName: 'Mailchimp',
      icon: '🐒',
      color: 'bg-yellow-400',
      eventLabel: 'Add Subscriber',
      type: 'action',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'trigger-1', target: 'action-1', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
  { id: 'e2-3', source: 'action-1', target: 'action-2', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
  { id: 'e4-5', source: 'trigger-2', target: 'action-3', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
  { id: 'e5-6', source: 'action-3', target: 'action-4', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
  { id: 'e7-8', source: 'trigger-3', target: 'action-5', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
];

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
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
            <span style={{ fontSize: '28px' }}>{integration.icon}</span>
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
}

function FlowCanvasInner({ onTriggerCountChange }: FlowCanvasInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    const triggerCount = nodes.filter((n) => n.type === 'triggerNode').length;
    onTriggerCountChange?.(triggerCount);
  }, [nodes, onTriggerCountChange]);
  const [modal, setModal] = useState<{
    integration: Integration;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const { screenToFlowPosition } = useReactFlow();
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
            style: { stroke: '#6366f1', strokeWidth: 2 },
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
        position: {
          x: modal.position.x - 120,
          y: modal.position.y - 60,
        },
        data: {
          integrationId: modal.integration.id,
          eventId,
          eventLabel,
          onDelete: handleDeleteNode,
          onSelect: handleSelectNode,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setModal(null);
    },
    [modal, setNodes, handleDeleteNode, handleSelectNode]
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
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ background: '#0f0f0f' }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#2a2a2a"
          />
          <Controls
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
            }}
          />
          <MiniMap
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
            }}
            nodeColor={(n) => {
              return n.type === 'triggerNode' ? '#22c55e' : '#6366f1';
            }}
            maskColor="rgba(0,0,0,0.6)"
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
        <AIBuilder onAddNodes={handleAddAINodes} />
      </div>

      {/* Config panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onDelete={handleDeleteNode}
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
}

export default function FlowCanvas({ onTriggerCountChange }: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner onTriggerCountChange={onTriggerCountChange} />
    </ReactFlowProvider>
  );
}
