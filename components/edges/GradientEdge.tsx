'use client';

import { memo } from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react';

type GradientEdgeData = {
  sourceColor?: string;
  targetColor?: string;
};

function GradientEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;

  const edgeData = (data || {}) as GradientEdgeData;
  const sourceColor = edgeData.sourceColor || '#6366f1';
  const targetColor = edgeData.targetColor || '#6366f1';

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

export default memo(GradientEdge);
