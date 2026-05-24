// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node } from '@xyflow/react';
import NodeConfigPanel from '@/components/panels/NodeConfigPanel';

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    type: 'actionNode',
    position: { x: 0, y: 0 },
    data: {
      integrationId: 'gmail',
      eventId: 'gmail-a1',
      eventLabel: 'Send Email',
      ...((overrides.data as object) || {}),
    },
    ...overrides,
  } as Node;
}

describe('NodeConfigPanel', () => {
  it('renders nothing when node is null', () => {
    const { container } = render(
      <NodeConfigPanel node={null} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders integration name, event label, and the config field labels', () => {
    render(<NodeConfigPanel node={makeNode()} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Gmail')).toBeInTheDocument();
    expect(screen.getByText('Send Email')).toBeInTheDocument();
    expect(screen.getByText('To address')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
  });

  it('shows the THEN THAT badge for action nodes and IF THIS for trigger nodes', () => {
    const { rerender } = render(
      <NodeConfigPanel node={makeNode()} onClose={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('THEN THAT')).toBeInTheDocument();
    rerender(
      <NodeConfigPanel
        node={makeNode({ type: 'triggerNode', data: { integrationId: 'gmail', eventId: 'gmail-t1', eventLabel: 'New Email' } })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('IF THIS')).toBeInTheDocument();
  });

  it('renders text inputs with placeholders for text fields', () => {
    render(<NodeConfigPanel node={makeNode()} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByPlaceholderText('e.g. user@example.com')).toBeInTheDocument();
  });

  it('renders a select with options for select fields (hue toggle)', () => {
    const node = makeNode({ data: { integrationId: 'hue', eventId: 'hue-a3', eventLabel: 'Toggle Lights' } });
    render(<NodeConfigPanel node={node} onClose={vi.fn()} onDelete={vi.fn()} />);
    const combo = screen.getByRole('combobox');
    expect(combo).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Turn On' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Toggle' })).toBeInTheDocument();
  });

  it('renders a color input for color fields (hue set color)', () => {
    const node = makeNode({ data: { integrationId: 'hue', eventId: 'hue-a4', eventLabel: 'Set Color' } });
    const { container } = render(<NodeConfigPanel node={node} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(container.querySelector('input[type="color"]')).not.toBeNull();
  });

  it('renders a checkbox for the stickies manual field and toggles it', async () => {
    const node = makeNode({ data: { integrationId: 'stickies', eventId: 'stickies-a1', eventLabel: 'Create Sticky' } });
    render(<NodeConfigPanel node={node} onClose={vi.fn()} onDelete={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('shows "No configuration needed" and hides Save when there are no fields', () => {
    const node = makeNode({ data: { integrationId: 'gmail', eventId: 'gmail-a2', eventLabel: 'Archive Email' } });
    render(<NodeConfigPanel node={node} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('No configuration needed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('pre-fills inputs from existing node config', () => {
    const node = makeNode({ data: { integrationId: 'gmail', eventId: 'gmail-a1', eventLabel: 'Send Email', config: { to: 'a@b.com' } } });
    render(<NodeConfigPanel node={node} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByDisplayValue('a@b.com')).toBeInTheDocument();
  });

  it('fires onUpdateConfig with typed values and then onClose when Save is clicked', async () => {
    const onUpdateConfig = vi.fn();
    const onClose = vi.fn();
    render(
      <NodeConfigPanel node={makeNode()} onClose={onClose} onDelete={vi.fn()} onUpdateConfig={onUpdateConfig} />
    );
    await userEvent.type(screen.getByPlaceholderText('e.g. user@example.com'), 'x@y.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdateConfig).toHaveBeenCalledWith('node-1', expect.objectContaining({ to: 'x@y.com' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('fires onClose when the Close button is clicked', async () => {
    const onClose = vi.fn();
    render(<NodeConfigPanel node={makeNode()} onClose={onClose} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape keypress', async () => {
    const onClose = vi.fn();
    render(<NodeConfigPanel node={makeNode()} onClose={onClose} onDelete={vi.fn()} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('fires onDelete and onClose when Remove Node is clicked', async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<NodeConfigPanel node={makeNode()} onClose={onClose} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Node' }));
    expect(onDelete).toHaveBeenCalledWith('node-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('applies select defaultValue when no existing config (diagram type)', () => {
    const node = makeNode({ data: { integrationId: 'diagram', eventId: 'diagram-a1', eventLabel: 'Create Diagram' } });
    render(<NodeConfigPanel node={node} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('sequence');
  });
});
