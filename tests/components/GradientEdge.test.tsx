// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider, Position, type EdgeProps } from '@xyflow/react';
import GradientEdge from '@/components/edges/GradientEdge';

function renderEdge(data?: { sourceColor?: string; targetColor?: string }, id = 'e1') {
  const props = {
    id,
    source: 's',
    target: 't',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data,
  } as unknown as EdgeProps;
  return render(
    <ReactFlowProvider>
      <svg>
        <GradientEdge {...props} />
      </svg>
    </ReactFlowProvider>
  );
}

describe('GradientEdge', () => {
  it('renders a linearGradient with the edge id', () => {
    const { container } = renderEdge(undefined, 'edge-abc');
    const grad = container.querySelector('#gradient-edge-abc');
    expect(grad).not.toBeNull();
    expect(grad?.tagName.toLowerCase()).toBe('lineargradient');
  });

  it('uses sourceColor and targetColor from edge.data as gradient stops', () => {
    const { container } = renderEdge({ sourceColor: '#ff0000', targetColor: '#00ff00' });
    const stops = container.querySelectorAll('stop');
    expect(stops).toHaveLength(2);
    expect(stops[0]).toHaveAttribute('offset', '0%');
    expect(stops[0]).toHaveAttribute('stop-color', '#ff0000');
    expect(stops[1]).toHaveAttribute('offset', '100%');
    expect(stops[1]).toHaveAttribute('stop-color', '#00ff00');
  });

  it('falls back to the default indigo color when data is absent', () => {
    const { container } = renderEdge(undefined);
    const stops = container.querySelectorAll('stop');
    expect(stops[0]).toHaveAttribute('stop-color', '#6366f1');
    expect(stops[1]).toHaveAttribute('stop-color', '#6366f1');
  });

  it('renders a path whose stroke references the gradient url', () => {
    const { container } = renderEdge({ sourceColor: '#111', targetColor: '#222' }, 'xyz');
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('style') || '').toContain('gradient-xyz');
    expect(path?.getAttribute('style') || '').toContain('stroke-width: 2.5');
  });

  it('is a memoized component', () => {
    expect((GradientEdge as unknown as { $$typeof?: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    );
  });
});
