// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import ActionNode from '@/components/nodes/ActionNode';
import type { ActionNodeData } from '@/components/nodes/ActionNode';

function renderNode(data: Partial<ActionNodeData>, selected = false) {
  const onDelete = vi.fn();
  const onSelect = vi.fn();
  const fullData: ActionNodeData = {
    integrationId: 'hue',
    eventId: 'hue-a1',
    eventLabel: 'Flash Lights',
    onDelete,
    onSelect,
    ...data,
  };
  const props = { id: 'act-9', data: fullData, selected } as unknown as NodeProps;
  render(
    <ReactFlowProvider>
      <ActionNode {...props} />
    </ReactFlowProvider>
  );
  return { onDelete, onSelect };
}

describe('ActionNode', () => {
  it('renders the Action label and event label', () => {
    renderNode({});
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Flash Lights')).toBeInTheDocument();
  });

  it('renders the integration name and THEN badge', () => {
    renderNode({});
    expect(screen.getByText('Philips Hue')).toBeInTheDocument();
    expect(screen.getByText('THEN')).toBeInTheDocument();
  });

  it('shows the ready-to-execute status text', () => {
    renderNode({});
    expect(screen.getByText('Ready to execute')).toBeInTheDocument();
  });

  it('returns null for an unknown integration', () => {
    const props = {
      id: 'x',
      data: { integrationId: 'nope', eventId: '', eventLabel: '', onDelete: vi.fn(), onSelect: vi.fn() },
      selected: false,
    } as unknown as NodeProps;
    const { container } = render(
      <ReactFlowProvider>
        <ActionNode {...props} />
      </ReactFlowProvider>
    );
    expect(container.querySelector('span')).toBeNull();
  });

  it('renders only config entries that have values', () => {
    renderNode({ config: { group: 'Office', scene: '' } });
    expect(screen.getByText('group:')).toBeInTheDocument();
    expect(screen.getByText('Office')).toBeInTheDocument();
    expect(screen.queryByText('scene:')).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const { onSelect } = renderNode({});
    await userEvent.click(screen.getByText('Flash Lights'));
    expect(onSelect).toHaveBeenCalledWith('act-9');
  });

  it('reveals delete button on hover and fires onDelete', async () => {
    const { onDelete } = renderNode({});
    expect(screen.queryByRole('button', { name: 'Delete node' })).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText('Action'));
    const del = screen.getByRole('button', { name: 'Delete node' });
    await userEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith('act-9');
  });

  it('is a memoized component', () => {
    expect((ActionNode as unknown as { $$typeof?: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    );
  });
});
