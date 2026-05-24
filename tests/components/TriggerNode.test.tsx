// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import TriggerNode from '@/components/nodes/TriggerNode';
import type { TriggerNodeData } from '@/components/nodes/TriggerNode';

function renderNode(data: Partial<TriggerNodeData>, selected = false) {
  const onDelete = vi.fn();
  const onSelect = vi.fn();
  const fullData: TriggerNodeData = {
    integrationId: 'gmail',
    eventId: 'gmail-t1',
    eventLabel: 'New Email Received',
    onDelete,
    onSelect,
    ...data,
  };
  // NodeProps requires many fields; the component only reads id/data/selected.
  const props = { id: 'node-1', data: fullData, selected } as unknown as NodeProps;
  render(
    <ReactFlowProvider>
      <TriggerNode {...props} />
    </ReactFlowProvider>
  );
  return { onDelete, onSelect };
}

describe('TriggerNode', () => {
  it('renders the Trigger label and event label', () => {
    renderNode({});
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText('New Email Received')).toBeInTheDocument();
  });

  it('renders the integration name and IF badge', () => {
    renderNode({});
    expect(screen.getByText('Gmail')).toBeInTheDocument();
    expect(screen.getByText('IF')).toBeInTheDocument();
  });

  it('returns null for an unknown integration', () => {
    const { onDelete, onSelect } = { onDelete: vi.fn(), onSelect: vi.fn() };
    const props = {
      id: 'x',
      data: { integrationId: 'nope', eventId: '', eventLabel: '', onDelete, onSelect },
      selected: false,
    } as unknown as NodeProps;
    const { container } = render(
      <ReactFlowProvider>
        <TriggerNode {...props} />
      </ReactFlowProvider>
    );
    expect(container.querySelector('span')).toBeNull();
  });

  it('renders config entries that have values', () => {
    renderNode({ config: { subject: 'Invoice', from: '' } });
    expect(screen.getByText('subject:')).toBeInTheDocument();
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.queryByText('from:')).not.toBeInTheDocument();
  });

  it('calls onSelect with the node id when clicked', async () => {
    const { onSelect } = renderNode({});
    await userEvent.click(screen.getByText('New Email Received'));
    expect(onSelect).toHaveBeenCalledWith('node-1');
  });

  it('shows a delete button with aria-label on hover and fires onDelete', async () => {
    const { onDelete, onSelect } = renderNode({});
    expect(screen.queryByRole('button', { name: 'Delete node' })).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText('Trigger'));
    const del = screen.getByRole('button', { name: 'Delete node' });
    expect(del).toBeInTheDocument();
    await userEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith('node-1');
    // delete click stops propagation, so select must not fire from it
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('is a memoized component', () => {
    // React.memo wraps the function; the export is the memo object.
    expect((TriggerNode as unknown as { $$typeof?: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    );
  });
});
