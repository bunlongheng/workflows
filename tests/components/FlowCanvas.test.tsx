// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlowCanvas from '@/components/FlowCanvas';

describe('FlowCanvas', () => {
  it('mounts inside its own ReactFlowProvider and shows the empty state', () => {
    render(<FlowCanvas />);
    expect(screen.getByText('Drop integrations here')).toBeInTheDocument();
    expect(screen.getByText(/Drag from the sidebar/)).toBeInTheDocument();
  });

  it('renders the Trigger -> Action -> Action empty-state hint', () => {
    render(<FlowCanvas />);
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getAllByText('Action').length).toBeGreaterThanOrEqual(2);
  });

  it('reports a trigger count of 0 for an empty canvas', () => {
    const onTriggerCountChange = vi.fn();
    render(<FlowCanvas onTriggerCountChange={onTriggerCountChange} />);
    expect(onTriggerCountChange).toHaveBeenCalledWith(0);
  });

  it('reports an empty flow name for an empty canvas', () => {
    const onFlowNameChange = vi.fn();
    render(<FlowCanvas onFlowNameChange={onFlowNameChange} />);
    expect(onFlowNameChange).toHaveBeenCalledWith('');
  });
});
