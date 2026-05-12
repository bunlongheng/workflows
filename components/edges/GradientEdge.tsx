'use client';

import { BaseEdge, EdgeProps, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import { integrations } from '@/data/integrations';

const colorMap: Record<string, string> = {
  'bg-red-600': '#dc2626',
  'bg-red-500': '#ef4444',
  'bg-yellow-500': '#eab308',
  'bg-gray-800': '#1f2937',
  'bg-gray-500': '#6b7280',
  'bg-indigo-500': '#6366f1',
  'bg-orange-500': '#f97316',
  'bg-purple-500': '#a855f7',
  'bg-purple-600': '#9333ea',
  'bg-emerald-600': '#059669',
  'bg-blue-500': '#3b82f6',
};

export default function GradientEdge(props: EdgeProps) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const { getNode } = useReactFlow();

  const sourceNode = getNode(source);
  const targetNode = getNode(target);

  const sourceIntegration = integrations.find(
    (i) => i.id === (sourceNode?.data as Record<string, unknown>)?.integrationId
  );
  const targetIntegration = integrations.find(
    (i) => i.id === (targetNode?.data as Record<string, unknown>)?.integrationId
  );

  const sourceColor = colorMap[sourceIntegration?.color || ''] || '#6366f1';
  const targetColor = colorMap[targetIntegration?.color || ''] || '#6366f1';

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const gradientId = `gradient-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: `url(#${gradientId})`, strokeWidth: 2.5 }}
      />
    </>
  );
}
